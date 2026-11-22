import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { registerSocketGateway } from '../src/realtime/socket.gateway';
import { roomsRouter } from '../src/modules/rooms/rooms.controller';
import { authService } from '../src/modules/auth/auth.service';
import { roomsService } from '../src/modules/rooms/rooms.service';
import { stateManager } from '../src/realtime/state.manager';

describe('Emergency Pause Participant Authorization & State Synchronization', () => {
  let app: express.Express;
  let server: http.Server;
  let ioServer: SocketIOServer;
  let port: number;
  let testRoomSlug: string;
  let testRoomId: string;
  let hostUser: any;
  let hostToken: string;
  let guestUser: any;
  let guestToken: string;
  let outsiderUser: any;
  let outsiderToken: string;
  let hostClient: ClientSocket;
  let guestClient: ClientSocket;
  let outsiderClient: ClientSocket;
  let unauthClient: ClientSocket;
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
      email: `ep_host_${timestamp}@synctheater.com`,
      username: `EPHost_${timestamp}`,
      password: 'Password123!',
    });
    hostUser = hostReg.user;
    hostToken = hostReg.token;

    const guestReg = await authService.register({
      email: `ep_guest_${timestamp}@synctheater.com`,
      username: `EPGuest_${timestamp}`,
      password: 'Password123!',
    });
    guestUser = guestReg.user;
    guestToken = guestReg.token;

    const outsiderReg = await authService.register({
      email: `ep_outsider_${timestamp}@synctheater.com`,
      username: `EPOutsider_${timestamp}`,
      password: 'Password123!',
    });
    outsiderUser = outsiderReg.user;
    outsiderToken = outsiderReg.token;

    const room = await roomsService.createRoom({
      name: `Emergency Theater ${timestamp}`,
      privacy: 'PRIVATE',
      maxCapacity: 25,
      ownerId: hostUser.id,
      initialVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    testRoomSlug = room.slug;
    testRoomId = room.id;
    inviteToken = room.initialInviteToken!;
  });

  afterEach(async () => {
    if (hostClient?.connected) hostClient.disconnect();
    if (guestClient?.connected) guestClient.disconnect();
    if (outsiderClient?.connected) outsiderClient.disconnect();
    if (unauthClient?.connected) unauthClient.disconnect();
    if (ioServer) ioServer.close();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('allows the host to trigger emergency pause and halts room playback', async () => {
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

    // Start video playback
    hostClient.emit('PLAY', { reportedPosition: 12 });
    await new Promise((r) => setTimeout(r, 100));

    // Host triggers emergency pause
    const emergencyPromise = new Promise<any>((resolve) => {
      hostClient.on('EMERGENCY_PAUSE_TRIGGERED', (data) => resolve(data));
    });

    hostClient.emit('EMERGENCY_PAUSE', { roomSlug: testRoomSlug });
    const eventData = await emergencyPromise;

    expect(eventData.triggeredBy.username).toBe(hostUser.username);
    expect(eventData.playbackState.isEmergencyPaused).toBe(true);
    expect(eventData.playbackState.status).toBe('PAUSED');

    // Authoritative state in state manager must be updated
    const snapshot = stateManager.getSnapshot(stateManager['roomStates'].get(testRoomId)!);
    expect(snapshot.isEmergencyPaused).toBe(true);
    expect(snapshot.status).toBe('PAUSED');
  });

  it('allows an ordinary authenticated participant to trigger emergency pause for the entire room', async () => {
    // 1. Connect host
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

    // Set playing
    hostClient.emit('PLAY', { reportedPosition: 30 });
    await new Promise((r) => setTimeout(r, 100));

    // 2. Connect ordinary participant via invitation token
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

    // Listen on both host and guest for EMERGENCY_PAUSE_TRIGGERED, EMERGENCY_PAUSED, and SYNC_STATE
    let hostReceivedPause = false;
    let guestReceivedPause = false;
    let guestReceivedPausedEvent = false;

    hostClient.on('EMERGENCY_PAUSE_TRIGGERED', (data) => {
      if (data.triggeredBy.username === guestUser.username) {
        hostReceivedPause = true;
      }
    });

    guestClient.on('EMERGENCY_PAUSE_TRIGGERED', (data) => {
      if (data.triggeredBy.username === guestUser.username) {
        guestReceivedPause = true;
      }
    });

    guestClient.on('EMERGENCY_PAUSED', (data) => {
      if (data.triggeredBy.username === guestUser.username) {
        guestReceivedPausedEvent = true;
      }
    });

    // 3. Ordinary participant clicks Emergency Pause
    const ackPromise = new Promise<{ success: boolean; error?: string }>((resolve) => {
      guestClient.emit('EMERGENCY_PAUSE', { roomSlug: testRoomSlug }, (res: any) => resolve(res));
    });

    const ack = await ackPromise;
    expect(ack.success).toBe(true);

    await new Promise((r) => setTimeout(r, 200));

    expect(guestReceivedPause).toBe(true);
    expect(guestReceivedPausedEvent).toBe(true);
    expect(hostReceivedPause).toBe(true);

    // Test duplicate emergency pause: should safely acknowledge without errors
    const duplicateAckPromise = new Promise<{ success: boolean; error?: string }>((resolve) => {
      guestClient.emit('EMERGENCY_PAUSE', { roomSlug: testRoomSlug }, (res: any) => resolve(res));
    });
    const dupAck = await duplicateAckPromise;
    expect(dupAck.success).toBe(true);

    // Verify authoritative server state
    const snapshot = stateManager.getSnapshot(stateManager['roomStates'].get(testRoomId)!);
    expect(snapshot.isEmergencyPaused).toBe(true);
    expect(snapshot.status).toBe('PAUSED');
    expect(snapshot.emergencyPausedBy?.username).toBe(guestUser.username);
  });

  it('rejects unauthenticated socket connections from triggering emergency pause', async () => {
    unauthClient = ClientIO(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      unauthClient.on('connect', () => resolve());
    });

    const errorPromise = new Promise<any>((resolve) => {
      unauthClient.on('ERROR', (err) => resolve(err));
    });

    const ackPromise = new Promise<any>((resolve) => {
      unauthClient.emit('EMERGENCY_PAUSE', { roomSlug: testRoomSlug }, (res: any) => resolve(res));
    });

    const [errorData, ackData] = await Promise.all([errorPromise, ackPromise]);
    expect(errorData.code).toBe('UNAUTHENTICATED');
    expect(ackData.success).toBe(false);
    expect(ackData.error).toMatch(/Authentication required/);
  });

  it('rejects non-members who are authenticated but have not joined the room', async () => {
    outsiderClient = ClientIO(`http://localhost:${port}`, {
      auth: { token: outsiderToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      outsiderClient.on('connect', () => resolve());
    });

    const errorPromise = new Promise<any>((resolve) => {
      outsiderClient.on('ERROR', (err) => resolve(err));
    });

    const ackPromise = new Promise<any>((resolve) => {
      outsiderClient.emit('EMERGENCY_PAUSE', { roomSlug: testRoomSlug }, (res: any) => resolve(res));
    });

    const [errorData, ackData] = await Promise.all([errorPromise, ackPromise]);
    expect(errorData.code).toBe('FORBIDDEN');
    expect(ackData.success).toBe(false);
    expect(ackData.error).toMatch(/authorized member/);
  });

  it('prevents participants from resuming playback or using normal playback controls', async () => {
    // 1. Join host and participant
    hostClient = ClientIO(`http://localhost:${port}`, {
      auth: { token: hostToken },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve) => {
      hostClient.on('INITIAL_ROOM_STATE', () => resolve());
      hostClient.emit('JOIN_ROOM', { roomSlug: testRoomSlug });
    });

    guestClient = ClientIO(`http://localhost:${port}`, {
      auth: { token: guestToken },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve) => {
      guestClient.on('INITIAL_ROOM_STATE', () => resolve());
      guestClient.emit('JOIN_ROOM', { roomSlug: testRoomSlug, inviteToken });
    });

    // 2. Guest triggers emergency pause
    await new Promise<void>((resolve) => {
      guestClient.emit('EMERGENCY_PAUSE', { roomSlug: testRoomSlug }, () => resolve());
    });

    // 3. Guest attempts to resume from emergency -> Must be rejected with FORBIDDEN
    const resumeErrorPromise = new Promise<any>((resolve) => {
      guestClient.on('ERROR', (err) => resolve(err));
      guestClient.emit('RESUME_FROM_EMERGENCY', { roomSlug: testRoomSlug });
    });
    const resumeErr = await resumeErrorPromise;
    expect(resumeErr.code).toBe('FORBIDDEN');

    // 4. Guest attempts normal PLAY -> Must be rejected
    const playErrorPromise = new Promise<any>((resolve) => {
      guestClient.on('ERROR', (err) => resolve(err));
      guestClient.emit('PLAY', { reportedPosition: 15 });
    });
    const playErr = await playErrorPromise;
    expect(playErr.message).toMatch(/Only the room host or moderators/);

    // Authoritative state must still be EMERGENCY PAUSED
    const snapshot = stateManager.getSnapshot(stateManager['roomStates'].get(testRoomId)!);
    expect(snapshot.isEmergencyPaused).toBe(true);
    expect(snapshot.status).toBe('PAUSED');
  });

  it('preserves emergency-pause capability and room state through socket reconnection', async () => {
    // 1. Host joins
    hostClient = ClientIO(`http://localhost:${port}`, {
      auth: { token: hostToken },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve) => {
      hostClient.on('INITIAL_ROOM_STATE', () => resolve());
      hostClient.emit('JOIN_ROOM', { roomSlug: testRoomSlug });
    });

    // 2. Guest joins
    const guestClient1 = ClientIO(`http://localhost:${port}`, {
      auth: { token: guestToken },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve) => {
      guestClient1.on('INITIAL_ROOM_STATE', () => resolve());
      guestClient1.emit('JOIN_ROOM', { roomSlug: testRoomSlug, inviteToken });
    });

    // Disconnect guest socket 1 to simulate phone lock or network glitch
    guestClient1.disconnect();

    // Reconnect as guest socket 2
    const guestClient2 = ClientIO(`http://localhost:${port}`, {
      auth: { token: guestToken },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      guestClient2.on('INITIAL_ROOM_STATE', () => resolve());
      guestClient2.emit('RECONNECT_ROOM', { roomSlug: testRoomSlug, inviteToken });
    });

    // Guest triggers emergency pause on reconnected socket
    const ackPromise = new Promise<any>((resolve) => {
      guestClient2.emit('EMERGENCY_PAUSE', { roomSlug: testRoomSlug }, (res: any) => resolve(res));
    });

    const ack = await ackPromise;
    expect(ack.success).toBe(true);

    const snapshot = stateManager.getSnapshot(stateManager['roomStates'].get(testRoomId)!);
    expect(snapshot.isEmergencyPaused).toBe(true);

    guestClient2.disconnect();
  });
});
