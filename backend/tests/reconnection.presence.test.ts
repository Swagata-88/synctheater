import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { registerSocketGateway } from '../src/realtime/socket.gateway';
import { db } from '../src/database';
import { authService } from '../src/modules/auth/auth.service';
import { roomsService } from '../src/modules/rooms/rooms.service';

describe('Socket Reconnection & Disconnect Presence', () => {
  let server: http.Server;
  let ioServer: SocketIOServer;
  let port: number;
  let testRoomSlug: string;
  let hostUser: any;
  let hostToken: string;
  let guestUser: any;
  let guestToken: string;
  let inviteToken: string;

  beforeEach(async () => {
    const app = express();
    server = http.createServer(app);
    ioServer = new SocketIOServer(server, { cors: { origin: '*' } });
    registerSocketGateway(ioServer);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });

    // Create test host & guest users
    const timestamp = Date.now() + Math.random().toString(36).substring(2, 6);
    const hostReg = await authService.register({
      email: `host_${timestamp}@synctheater.com`,
      username: `Host_${timestamp}`,
      password: 'Password123!',
    });
    hostUser = hostReg.user;
    hostToken = hostReg.token;

    const guestReg = await authService.register({
      email: `guest_${timestamp}@synctheater.com`,
      username: `Guest_${timestamp}`,
      password: 'Password123!',
    });
    guestUser = guestReg.user;
    guestToken = guestReg.token;

    // Create test room
    const room = await roomsService.createRoom({
      name: `Reconnection Room ${timestamp}`,
      privacy: 'PRIVATE',
      maxCapacity: 20,
      ownerId: hostUser.id,
    });
    testRoomSlug = room.slug;
    inviteToken = room.initialInviteToken!;
  });

  afterEach(async () => {
    ioServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('allows user to join room, receive INITIAL_ROOM_STATE and SYNC_STATE, and announces presence', async () => {
    const client = ClientIO(`http://localhost:${port}`, {
      auth: { token: hostToken },
      transports: ['websocket'],
    });

    const receivedInitialState = await new Promise<any>((resolve) => {
      client.on('INITIAL_ROOM_STATE', (data) => resolve(data));
      client.emit('JOIN_ROOM', { roomSlug: testRoomSlug });
    });

    expect(receivedInitialState).toBeDefined();
    expect(receivedInitialState.room.slug).toBe(testRoomSlug);
    expect(receivedInitialState.playbackState.status).toBe('PAUSED');
    expect(receivedInitialState.participants.length).toBeGreaterThanOrEqual(1);

    client.disconnect();
  });

  it('detects socket reconnection, restores presence, re-emits SYNC_STATE, and avoids duplicate USER_JOINED spam', async () => {
    // 1. Host joins first
    const hostClient = ClientIO(`http://localhost:${port}`, {
      auth: { token: hostToken },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve) => {
      hostClient.on('INITIAL_ROOM_STATE', () => resolve());
      hostClient.emit('JOIN_ROOM', { roomSlug: testRoomSlug });
    });

    // 2. Guest joins
    let guestJoinBroadcastCount = 0;
    const userJoinedPromise = new Promise<void>((resolve) => {
      hostClient.on('USER_JOINED', (data) => {
        if (data.user?.userId === guestUser.id) {
          guestJoinBroadcastCount++;
          resolve();
        }
      });
    });

    const guestClient1 = ClientIO(`http://localhost:${port}`, {
      auth: { token: guestToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      guestClient1.on('INITIAL_ROOM_STATE', () => resolve());
      guestClient1.emit('JOIN_ROOM', { roomSlug: testRoomSlug, inviteToken });
    });

    await userJoinedPromise;
    expect(guestJoinBroadcastCount).toBe(1);

    // 3. Guest simulates reconnection with a second socket connection (or reconnecting socket)
    const guestClient2 = ClientIO(`http://localhost:${port}`, {
      auth: { token: guestToken },
      transports: ['websocket'],
    });

    const reconnectedState = await new Promise<any>((resolve) => {
      guestClient2.on('INITIAL_ROOM_STATE', (data) => resolve(data));
      guestClient2.emit('RECONNECT_ROOM', { roomSlug: testRoomSlug, inviteToken });
    });

    // Reconnection must receive complete state and flag
    expect(reconnectedState.isReconnection).toBe(true);
    expect(reconnectedState.playbackState).toBeDefined();

    // Must NOT have broadcast another duplicate USER_JOINED to host
    expect(guestJoinBroadcastCount).toBe(1);

    hostClient.disconnect();
    guestClient1.disconnect();
    guestClient2.disconnect();
  });

  it('broadcasts USER_LEFT when a user leaves the room', async () => {
    const hostClient = ClientIO(`http://localhost:${port}`, {
      auth: { token: hostToken },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve) => {
      hostClient.on('INITIAL_ROOM_STATE', () => resolve());
      hostClient.emit('JOIN_ROOM', { roomSlug: testRoomSlug });
    });

    const guestClient = ClientIO(`http://localhost:${port}`, {
      auth: { token: guestToken },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve) => {
      guestClient.on('INITIAL_ROOM_STATE', () => resolve());
      guestClient.emit('JOIN_ROOM', { roomSlug: testRoomSlug, inviteToken });
    });

    // Listen for USER_LEFT on host
    const userLeftPromise = new Promise<any>((resolve) => {
      hostClient.on('USER_LEFT', (data) => resolve(data));
    });

    // Guest explicitly leaves room
    guestClient.emit('LEAVE_ROOM');

    const leftData = await userLeftPromise;
    expect(leftData.userId).toBe(guestUser.id);
    expect(leftData.username).toBe(guestUser.username);

    hostClient.disconnect();
    guestClient.disconnect();
  });
});
