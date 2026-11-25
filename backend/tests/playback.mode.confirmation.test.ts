import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { registerSocketGateway } from '../src/realtime/socket.gateway';
import { authService } from '../src/modules/auth/auth.service';
import { roomsService } from '../src/modules/rooms/rooms.service';
import { stateManager } from '../src/realtime/state.manager';

describe('NOTIFY_PLAYBACK_MODE_CONFIRMED Authorization & State Invariants', () => {
  let server: http.Server;
  let ioServer: SocketIOServer;
  let port: number;
  let hostUser: any;
  let hostToken: string;
  let guestUser: any;
  let guestToken: string;
  let room: any;
  let hostSocket: ClientSocket;
  let guestSocket: ClientSocket;

  beforeEach(async () => {
    const app = express();
    server = http.createServer(app);
    ioServer = new SocketIOServer(server, { cors: { origin: '*' } });
    registerSocketGateway(ioServer);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as any).port;

    const ts = Date.now() + Math.random().toString(36).substring(2, 6);
    const hostReg = await authService.register({
      email: `pmc_host_${ts}@synctheater.com`,
      username: `PMCHost_${ts}`,
      password: 'Password123!',
    });
    hostUser = hostReg.user;
    hostToken = hostReg.token;

    const guestReg = await authService.register({
      email: `pmc_guest_${ts}@synctheater.com`,
      username: `PMCGuest_${ts}`,
      password: 'Password123!',
    });
    guestUser = guestReg.user;
    guestToken = guestReg.token;

    room = await roomsService.createRoom({
      name: `PMC Room ${ts}`,
      ownerId: hostUser.id,
      initialVideoUrl: 'https://www.youtube.com/live/5qap5aO4i9A',
    });

    hostSocket = ClientIO(`http://localhost:${port}`, { auth: { token: hostToken } });
    guestSocket = ClientIO(`http://localhost:${port}`, { auth: { token: guestToken } });

    await Promise.all([
      new Promise<void>((r) => hostSocket.on('connect', r)),
      new Promise<void>((r) => guestSocket.on('connect', r)),
    ]);

    await new Promise<void>((resolve) => {
      hostSocket.once('INITIAL_ROOM_STATE', () => resolve());
      hostSocket.emit('JOIN_ROOM', { roomSlug: room.slug });
    });

    await new Promise<void>((resolve) => {
      guestSocket.once('INITIAL_ROOM_STATE', () => resolve());
      guestSocket.emit('JOIN_ROOM', { roomSlug: room.slug, inviteToken: room.initialInviteToken });
    });
  }, 20000);

  afterEach(async () => {
    hostSocket.disconnect();
    guestSocket.disconnect();
    await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    server.close();
  });

  it('rejects unauthorized ordinary participant from confirming playback mode (FORBIDDEN)', async () => {
    const res = await new Promise<any>((resolve) => {
      guestSocket.emit(
        'NOTIFY_PLAYBACK_MODE_CONFIRMED',
        { videoId: '5qap5aO4i9A', mode: 'LIVE', broadcastStatus: 'ACTIVE_LIVE' },
        resolve
      );
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('FORBIDDEN');

    const state = await stateManager.getOrCreateRoomState(room.id, room.slug);
    expect(state.broadcastStatus).toBe('UNKNOWN_UNVERIFIED');
  });

  it('rejects wrong videoId and stale sequence confirmations', async () => {
    // Wrong videoId
    const wrongVid = await new Promise<any>((resolve) => {
      hostSocket.emit(
        'NOTIFY_PLAYBACK_MODE_CONFIRMED',
        { videoId: 'wrongVideo1', mode: 'LIVE', broadcastStatus: 'ACTIVE_LIVE' },
        resolve
      );
    });
    expect(wrongVid.success).toBe(false);
    expect(wrongVid.code).toBe('STALE_VIDEO_CONFIRMATION');

    // Advance sequence via PLAY
    await new Promise<void>((resolve) => {
      hostSocket.once('SYNC_STATE', () => resolve());
      hostSocket.emit('PLAY', {});
    });

    const stateAfterPlay = await stateManager.getOrCreateRoomState(room.id, room.slug);
    expect(stateAfterPlay.sequenceNumber).toBeGreaterThan(1);

    // Stale sequence (sequenceNumber: 1 < current)
    const staleSeq = await new Promise<any>((resolve) => {
      hostSocket.emit(
        'NOTIFY_PLAYBACK_MODE_CONFIRMED',
        {
          videoId: '5qap5aO4i9A',
          mode: 'LIVE',
          broadcastStatus: 'ACTIVE_LIVE',
          sequenceNumber: 1,
        },
        resolve
      );
    });
    expect(staleSeq.success).toBe(false);
    expect(staleSeq.code).toBe('STALE_SEQUENCE');
  });

  it('accepts authorized host confirmation and propagates playbackMode & broadcastStatus on initial & reconnect', async () => {
    const ack = await new Promise<any>((resolve) => {
      hostSocket.emit(
        'NOTIFY_PLAYBACK_MODE_CONFIRMED',
        { videoId: '5qap5aO4i9A', mode: 'LIVE', broadcastStatus: 'ACTIVE_LIVE' },
        resolve
      );
    });
    expect(ack.success).toBe(true);
    expect(ack.changed).toBe(true);

    // Reconnect guest and verify both playbackMode and broadcastStatus are propagated
    const reconnectState = await new Promise<any>((resolve) => {
      guestSocket.once('INITIAL_ROOM_STATE', resolve);
      guestSocket.emit('RECONNECT_ROOM', { roomSlug: room.slug, inviteToken: room.initialInviteToken });
    });
    expect(reconnectState.playbackState.playbackMode).toBe('LIVE');
    expect(reconnectState.playbackState.broadcastStatus).toBe('ACTIVE_LIVE');
  });

  it('preserves Emergency Pause state and never resumes playback when telemetry arrives', async () => {
    // Guest triggers Emergency Pause
    await new Promise<void>((resolve) => {
      hostSocket.once('EMERGENCY_PAUSE_TRIGGERED', () => resolve());
      guestSocket.emit('EMERGENCY_PAUSE');
    });

    const pausedState = await stateManager.getOrCreateRoomState(room.id, room.slug);
    expect(pausedState.isEmergencyPaused).toBe(true);
    expect(pausedState.status).toBe('PAUSED');

    // Host emits mode confirmation while emergency paused
    const ack = await new Promise<any>((resolve) => {
      hostSocket.emit(
        'NOTIFY_PLAYBACK_MODE_CONFIRMED',
        { videoId: '5qap5aO4i9A', mode: 'LIVE', broadcastStatus: 'ACTIVE_LIVE' },
        resolve
      );
    });
    expect(ack.success).toBe(true);

    // Emergency Pause MUST remain active and playback MUST remain PAUSED
    const afterTelemetry = await stateManager.getOrCreateRoomState(room.id, room.slug);
    expect(afterTelemetry.isEmergencyPaused).toBe(true);
    expect(afterTelemetry.status).toBe('PAUSED');
    expect(afterTelemetry.broadcastStatus).toBe('ACTIVE_LIVE');
  });

  it('rejects confirmation from a demoted host after host transfer', async () => {
    await roomsService.transferHost(room.slug, hostUser.id, guestUser.id);

    const demotedRes = await new Promise<any>((resolve) => {
      hostSocket.emit(
        'NOTIFY_PLAYBACK_MODE_CONFIRMED',
        { videoId: '5qap5aO4i9A', mode: 'LIVE', broadcastStatus: 'ACTIVE_LIVE' },
        resolve
      );
    });

    expect(demotedRes.success).toBe(false);
    expect(demotedRes.code).toBe('FORBIDDEN');
  });

  it('rejects confirmation on a closed room (ROOM_CLOSED)', async () => {
    const { db } = await import('../src/database');
    await db.updateRoom(room.id, { status: 'CLOSED' });

    const closedRes = await new Promise<any>((resolve) => {
      hostSocket.emit(
        'NOTIFY_PLAYBACK_MODE_CONFIRMED',
        { videoId: '5qap5aO4i9A', mode: 'LIVE', broadcastStatus: 'ACTIVE_LIVE' },
        resolve
      );
    });

    expect(closedRes.success).toBe(false);
    expect(closedRes.code).toBe('ROOM_CLOSED');
  });
});
