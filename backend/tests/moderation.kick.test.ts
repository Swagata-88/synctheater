import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import express from 'express';
import request from 'supertest';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { registerSocketGateway } from '../src/realtime/socket.gateway';
import { roomsRouter } from '../src/modules/rooms/rooms.controller';
import { authService } from '../src/modules/auth/auth.service';
import { roomsService } from '../src/modules/rooms/rooms.service';

describe('Real-Time Room Moderation & Kicked Presence', () => {
  let app: express.Express;
  let server: http.Server;
  let ioServer: SocketIOServer;
  let port: number;
  let testRoomSlug: string;
  let hostUser: any;
  let hostToken: string;
  let guestUser: any;
  let guestToken: string;
  let thirdUser: any;
  let thirdToken: string;
  let hostClient: ClientSocket;
  let guestClient: ClientSocket;
  let inviteToken: string;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/rooms', roomsRouter);

    server = http.createServer(app);
    ioServer = new SocketIOServer(server, { cors: { origin: '*' } });
    registerSocketGateway(ioServer);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });

    const timestamp = Date.now() + Math.random().toString(36).substring(2, 6);

    const hostReg = await authService.register({
      email: `mod_host_${timestamp}@synctheater.com`,
      username: `ModHost_${timestamp}`,
      password: 'Password123!',
    });
    hostUser = hostReg.user;
    hostToken = hostReg.token;

    const guestReg = await authService.register({
      email: `mod_guest_${timestamp}@synctheater.com`,
      username: `ModGuest_${timestamp}`,
      password: 'Password123!',
    });
    guestUser = guestReg.user;
    guestToken = guestReg.token;

    const thirdReg = await authService.register({
      email: `mod_third_${timestamp}@synctheater.com`,
      username: `ModThird_${timestamp}`,
      password: 'Password123!',
    });
    thirdUser = thirdReg.user;
    thirdToken = thirdReg.token;

    const room = await roomsService.createRoom({
      name: `Moderation Room ${timestamp}`,
      privacy: 'PRIVATE',
      maxCapacity: 20,
      ownerId: hostUser.id,
    });
    testRoomSlug = room.slug;
    inviteToken = room.initialInviteToken!;
  });

  afterEach(async () => {
    if (hostClient && hostClient.connected) hostClient.disconnect();
    if (guestClient && guestClient.connected) guestClient.disconnect();
    if (ioServer) ioServer.close();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('allows the host to kick a participant, emitting KICKED_FROM_ROOM and USER_LEFT', async () => {
    // Connect host client
    hostClient = ClientIO(`http://localhost:${port}`, {
      auth: { token: hostToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      hostClient.on('connect', () => {
        hostClient.emit('JOIN_ROOM', { roomSlug: testRoomSlug });
      });
      hostClient.on('INITIAL_ROOM_STATE', () => resolve());
    });

    // Connect guest client
    guestClient = ClientIO(`http://localhost:${port}`, {
      auth: { token: guestToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      guestClient.on('connect', () => {
        guestClient.emit('JOIN_ROOM', { roomSlug: testRoomSlug, inviteToken });
      });
      guestClient.on('INITIAL_ROOM_STATE', () => resolve());
    });

    // Setup listener promises
    const kickedPromise = new Promise<any>((resolve) => {
      guestClient.on('KICKED_FROM_ROOM', (data) => resolve(data));
    });

    const userLeftPromise = new Promise<any>((resolve) => {
      hostClient.on('USER_LEFT', (data) => resolve(data));
    });

    // Host invokes kick REST API
    const kickRes = await request(app)
      .post(`/api/rooms/${testRoomSlug}/kick`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ targetUserId: guestUser.id, reason: 'Disruptive behavior in chat.' });

    expect(kickRes.status).toBe(200);
    expect(kickRes.body.success).toBe(true);

    // Verify guest received KICKED_FROM_ROOM
    const kickedData = await kickedPromise;
    expect(kickedData.roomSlug).toBe(testRoomSlug);
    expect(kickedData.reason).toBe('Disruptive behavior in chat.');

    // Verify host received USER_LEFT with updated participant list
    const userLeftData = await userLeftPromise;
    expect(userLeftData.userId).toBe(guestUser.id);
    expect(userLeftData.participants.some((p: any) => p.userId === guestUser.id)).toBe(false);
  });

  it('denies a non-host viewer from kicking another participant (403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/api/rooms/${testRoomSlug}/kick`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ targetUserId: thirdUser.id });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/permission/);
  });

  it('prevents kicking the room owner (403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/api/rooms/${testRoomSlug}/kick`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ targetUserId: hostUser.id });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/The room owner cannot be kicked/);
  });
});
