import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimeStateManager } from '../src/realtime/state.manager';

describe('Realtime Video Synchronization Engine', () => {
  let stateManager: RealtimeStateManager;

  beforeEach(() => {
    stateManager = new RealtimeStateManager();
  });

  it('initializes room playback state with PAUSED status and sequence 1', async () => {
    const state = await stateManager.getOrCreateRoomState('room-1', 'test-cinema');
    expect(state.status).toBe('PAUSED');
    expect(state.currentPosition).toBe(0);
    expect(state.sequenceNumber).toBe(1);
    expect(state.isEmergencyPaused).toBe(false);
  });

  it('increments sequence numbers monotonically on playback actions', async () => {
    const state = await stateManager.getOrCreateRoomState('room-1', 'test-cinema');
    const seq0 = state.sequenceNumber;

    stateManager.play('room-1', 10);
    expect(state.sequenceNumber).toBe(seq0 + 1);
    expect(state.status).toBe('PLAYING');

    stateManager.pause('room-1', 15);
    expect(state.sequenceNumber).toBe(seq0 + 2);
    expect(state.status).toBe('PAUSED');

    stateManager.seek('room-1', 45);
    expect(state.sequenceNumber).toBe(seq0 + 3);
    expect(state.currentPosition).toBe(45);
  });

  it('computes accurate calculatedPosition based on elapsed wall-clock time', async () => {
    const state = await stateManager.getOrCreateRoomState('room-2', 'elapsed-test');
    stateManager.play('room-2', 100);
    // Simulate timestamp 5 seconds ago
    state.lastServerTimestamp = Date.now() - 5000;

    const snapshot = stateManager.getSnapshot(state);
    expect(snapshot.calculatedPosition).toBeGreaterThanOrEqual(104.9);
    expect(snapshot.calculatedPosition).toBeLessThanOrEqual(105.5);
  });

  it('triggers emergency pause and blocks normal play resumption until cleared', async () => {
    const state = await stateManager.getOrCreateRoomState('room-3', 'emergency-test');
    stateManager.play('room-3', 20);

    // Any participant activates emergency pause
    stateManager.emergencyPause('room-3', { userId: 'guest-99', username: 'ConcernedViewer' });
    expect(state.status).toBe('PAUSED');
    expect(state.isEmergencyPaused).toBe(true);
    expect(state.emergencyPausedBy?.username).toBe('ConcernedViewer');

    // Attempting normal play while emergency paused should throw error
    expect(() => stateManager.play('room-3', 25)).toThrowError(/Emergency Pause/);

    // Host resumes
    stateManager.resumeFromEmergency('room-3');
    expect(state.isEmergencyPaused).toBe(false);
    expect(state.status).toBe('PLAYING');
  });

  it('initializes room playbackMode as VOD by default and propagates playbackMode on changeVideo', async () => {
    const state = await stateManager.getOrCreateRoomState('room-4', 'mode-test');
    expect(state.playbackMode).toBe('VOD');

    const updatedLive = stateManager.changeVideo('room-4', {
      provider: 'YOUTUBE',
      videoId: '5qap5aO4i9A',
      videoUrl: 'https://www.youtube.com/live/5qap5aO4i9A',
      playbackMode: 'LIVE',
    });
    expect(updatedLive.playbackMode).toBe('LIVE');
    expect(stateManager.getSnapshot(updatedLive).playbackMode).toBe('LIVE');

    const updatedVod = stateManager.changeVideo('room-4', {
      provider: 'YOUTUBE',
      videoId: 'dQw4w9WgXcQ',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      playbackMode: 'VOD',
    });
    expect(updatedVod.playbackMode).toBe('VOD');
    expect(stateManager.getSnapshot(updatedVod).playbackMode).toBe('VOD');
  });

  it('isolates LIVE mode from VOD position calculations and keeps calculatedPosition at 0', async () => {
    const state = await stateManager.getOrCreateRoomState('room-5', 'live-pos-test');
    stateManager.changeVideo('room-5', {
      provider: 'YOUTUBE',
      videoId: '5qap5aO4i9A',
      videoUrl: 'https://www.youtube.com/live/5qap5aO4i9A',
      playbackMode: 'LIVE',
    });

    stateManager.play('room-5', 120);
    state.lastServerTimestamp = Date.now() - 10000;

    expect(state.currentPosition).toBe(0);
    expect(stateManager.calculateCurrentPosition(state)).toBe(0);
    expect(stateManager.getSnapshot(state).calculatedPosition).toBe(0);

    stateManager.pause('room-5', 250);
    expect(state.currentPosition).toBe(0);

    stateManager.seek('room-5', 500);
    expect(state.currentPosition).toBe(0);
  });

  it('reconstructs LIVE and VOD playbackMode accurately from database persistence', async () => {
    const { db } = await import('../src/database');
    const liveRoom = await db.createRoom({
      name: 'Persisted Live Room',
      privacy: 'PRIVATE',
      ownerId: 'owner-persist-1',
      currentVideoId: '5qap5aO4i9A',
      currentVideoUrl: 'https://www.youtube.com/live/5qap5aO4i9A',
      currentProvider: 'YOUTUBE',
    });

    const vodRoom = await db.createRoom({
      name: 'Persisted VOD Room',
      privacy: 'PRIVATE',
      ownerId: 'owner-persist-1',
      currentVideoId: 'dQw4w9WgXcQ',
      currentVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      currentProvider: 'YOUTUBE',
    });

    // Simulate fresh state manager reconstruction from persistence
    const freshManager = new RealtimeStateManager();
    const reconstructedLive = await freshManager.getOrCreateRoomState(liveRoom.id, liveRoom.slug);
    const reconstructedVod = await freshManager.getOrCreateRoomState(vodRoom.id, vodRoom.slug);

    expect(reconstructedLive.playbackMode).toBe('LIVE');
    expect(reconstructedVod.playbackMode).toBe('VOD');
  });
});

describe('Realtime LIVE Mode Socket.IO Synchronization & Authorization', () => {
  it('preserves playbackMode on initial join & reconnection and blocks unauthorized mode changes', async () => {
    const http = await import('http');
    const express = (await import('express')).default;
    const { Server: SocketIOServer } = await import('socket.io');
    const { io: ClientIO } = await import('socket.io-client');
    const { registerSocketGateway } = await import('../src/realtime/socket.gateway');
    const { authService } = await import('../src/modules/auth/auth.service');
    const { roomsService } = await import('../src/modules/rooms/rooms.service');

    const app = express();
    const server = http.createServer(app);
    const ioServer = new SocketIOServer(server, { cors: { origin: '*' } });
    registerSocketGateway(ioServer);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const ts = Date.now() + Math.random().toString(36).substring(2, 6);

    const hostReg = await authService.register({
      email: `live_host_${ts}@synctheater.com`,
      username: `LiveHost_${ts}`,
      password: 'Password123!',
    });
    const guestReg = await authService.register({
      email: `live_guest_${ts}@synctheater.com`,
      username: `LiveGuest_${ts}`,
      password: 'Password123!',
    });

    const room = await roomsService.createRoom({
      name: `Live Auth Room ${ts}`,
      ownerId: hostReg.user.id,
      initialVideoUrl: 'https://www.youtube.com/live/5qap5aO4i9A',
    });

    const hostSocket = ClientIO(`http://localhost:${port}`, { auth: { token: hostReg.token } });
    const guestSocket = ClientIO(`http://localhost:${port}`, { auth: { token: guestReg.token } });

    try {
      await Promise.all([
        new Promise<void>((r) => hostSocket.on('connect', r)),
        new Promise<void>((r) => guestSocket.on('connect', r)),
      ]);

      // Host initial join receives LIVE playbackMode
      const hostInitial = await new Promise<any>((resolve) => {
        hostSocket.once('INITIAL_ROOM_STATE', resolve);
        hostSocket.emit('JOIN_ROOM', { roomSlug: room.slug });
      });
      expect(hostInitial.playbackState.playbackMode).toBe('LIVE');

      // Guest joins via inviteToken and receives LIVE playbackMode
      const guestInitial = await new Promise<any>((resolve) => {
        guestSocket.once('INITIAL_ROOM_STATE', resolve);
        guestSocket.emit('JOIN_ROOM', { roomSlug: room.slug, inviteToken: room.initialInviteToken });
      });
      expect(guestInitial.playbackState.playbackMode).toBe('LIVE');

      // Guest reconnects and retains LIVE playbackMode
      const guestReconnect = await new Promise<any>((resolve) => {
        guestSocket.once('INITIAL_ROOM_STATE', resolve);
        guestSocket.emit('RECONNECT_ROOM', { roomSlug: room.slug, inviteToken: room.initialInviteToken });
      });
      expect(guestReconnect.playbackState.playbackMode).toBe('LIVE');

      // Unauthorized guest attempts to change video (and thus global playbackMode) -> rejected
      const errorMsg = await new Promise<any>((resolve) => {
        guestSocket.once('ERROR', resolve);
        guestSocket.emit('CHANGE_VIDEO', { videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
      });
      expect(errorMsg.message).toMatch(/Only the room host or moderators/i);

      // Verify state remains LIVE
      const { stateManager: singletonStateManager } = await import('../src/realtime/state.manager');
      const currentState = await singletonStateManager.getOrCreateRoomState(room.id, room.slug);
      expect(currentState.playbackMode).toBe('LIVE');
    } finally {
      hostSocket.disconnect();
      guestSocket.disconnect();
      await new Promise<void>((resolve) => ioServer.close(() => resolve()));
      server.close();
    }
  }, 20000);
});
