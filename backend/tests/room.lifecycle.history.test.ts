import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { db } from '../src/database';
import { authService } from '../src/modules/auth/auth.service';
import { roomsService } from '../src/modules/rooms/rooms.service';
import { io as ClientIO } from 'socket.io-client';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { registerSocketGateway } from '../src/realtime/socket.gateway';

describe('Phase 15: Room Lifecycle, Host Transfer & Watch History Services', () => {
  let hostUser: any;
  let hostToken: string;
  let viewerUser: any;
  let viewerToken: string;
  let thirdUser: any;
  let thirdToken: string;
  let outsiderUser: any;
  let outsiderToken: string;

  let testServer: http.Server;
  let testIo: SocketIOServer;
  let serverPort: number;

  beforeEach(async () => {
    const timestamp = Date.now() + Math.random().toString(36).substring(2, 6);

    const hostReg = await authService.register({
      email: `host_${timestamp}@synctheater.com`,
      username: `Host_${timestamp}`,
      password: 'Password123!',
    });
    hostUser = hostReg.user;
    hostToken = hostReg.token;

    const viewerReg = await authService.register({
      email: `viewer_${timestamp}@synctheater.com`,
      username: `Viewer_${timestamp}`,
      password: 'Password123!',
    });
    viewerUser = viewerReg.user;
    viewerToken = viewerReg.token;

    const thirdReg = await authService.register({
      email: `third_${timestamp}@synctheater.com`,
      username: `Third_${timestamp}`,
      password: 'Password123!',
    });
    thirdUser = thirdReg.user;
    thirdToken = thirdReg.token;

    const outsiderReg = await authService.register({
      email: `outsider_${timestamp}@synctheater.com`,
      username: `Outsider_${timestamp}`,
      password: 'Password123!',
    });
    outsiderUser = outsiderReg.user;
    outsiderToken = outsiderReg.token;

    // Start ephemeral test server for Socket.IO testing
    testServer = http.createServer();
    testIo = new SocketIOServer(testServer, {
      cors: { origin: '*' },
    });
    registerSocketGateway(testIo);

    await new Promise<void>((resolve) => {
      testServer.listen(0, () => {
        const addr = testServer.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(async () => {
    testIo.close();
    await new Promise<void>((resolve) => testServer.close(() => resolve()));
  });

  describe('1. Room Creation and Session Initialization', () => {
    it('initializes a historical session and links activeSessionId upon room creation', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          name: 'Sci-Fi Marathon',
          description: 'Late night movies',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const room = res.body.room;

      expect(room.activeSessionId).toBeDefined();
      expect(room.status).toBe('ACTIVE');

      // Verify the session entity in database
      const session = await db.findSessionById(room.activeSessionId);
      expect(session).toBeDefined();
      expect(session!.roomId).toBe(room.id);
      expect(session!.roomSlug).toBe(room.slug);
      expect(session!.originalHostId).toBe(hostUser.id);
      expect(session!.originalHostUsername).toBe(hostUser.username);
      expect(session!.createdAt).toBeDefined();
      expect(session!.startedAt).toBeNull(); // startedAt is null until first join
      expect(session!.status).toBe('ACTIVE');
    });
  });

  describe('2. Participant Attendance & Session Start', () => {
    it('sets startedAt on first join and records attendance intervals without duplicates', async () => {
      const room = await roomsService.createRoom({
        name: 'Attendance Watch Theater',
        ownerId: hostUser.id,
      });

      // Session is created with startedAt = null
      let session = await db.findSessionById(room.activeSessionId!);
      expect(session!.startedAt).toBeNull();

      // Host joins room
      const hostJoin = await roomsService.joinRoom(room.slug, hostUser.id);
      expect(hostJoin.participant).toBeDefined();

      // Session start timestamp should now be stamped
      session = await db.findSessionById(room.activeSessionId!);
      expect(session!.startedAt).not.toBeNull();

      // Viewer joins with invitation
      const inv = await roomsService.createInvitation(room.slug, hostUser.id);
      await roomsService.joinRoom(room.slug, viewerUser.id, { inviteToken: inv.token });

      // Repeating join request is idempotent and does not create duplicate open intervals
      await roomsService.joinRoom(room.slug, viewerUser.id);

      const details = await db.getSessionDetails(room.activeSessionId!, hostUser.id);
      const viewerAttendances = details!.attendance.filter((a) => a.userId === viewerUser.id);
      expect(viewerAttendances.length).toBe(1);
      expect(viewerAttendances[0].leftAt).toBeNull();
    });

    it('accurately captures multiple attendance intervals when participant leaves and rejoins', async () => {
      const room = await roomsService.createRoom({
        name: 'Multi-Interval Room',
        ownerId: hostUser.id,
      });

      const inv = await roomsService.createInvitation(room.slug, hostUser.id);
      await roomsService.joinRoom(room.slug, viewerUser.id, { inviteToken: inv.token });

      // Viewer leaves room
      await roomsService.leaveRoom(room.slug, viewerUser.id);

      // Viewer rejoins room with invitation token
      await roomsService.joinRoom(room.slug, viewerUser.id, { inviteToken: inv.token });

      const details = await db.getSessionDetails(room.activeSessionId!, hostUser.id);
      const viewerAttendances = details!.attendance.filter((a) => a.userId === viewerUser.id);
      expect(viewerAttendances.length).toBe(2);

      // First interval closed, second interval currently open
      expect(viewerAttendances[0].leftAt).not.toBeNull();
      expect(viewerAttendances[1].leftAt).toBeNull();
    });

    it('supports guest participant attendance with nullable user IDs without duplicates', async () => {
      const room = await roomsService.createRoom({
        name: 'Guest Theater',
        ownerId: hostUser.id,
      });

      // Record guest attendance with null userId
      const guestAtt1 = await db.recordAttendanceJoin({
        sessionId: room.activeSessionId!,
        userId: null,
        displayName: 'Guest_123',
        isOriginalHost: false,
      });

      // Rapid reconnect with same guest display name
      const guestAtt2 = await db.recordAttendanceJoin({
        sessionId: room.activeSessionId!,
        userId: null,
        displayName: 'Guest_123',
        isOriginalHost: false,
      });

      expect(guestAtt1.id).toBe(guestAtt2.id);

      // Guest leaves
      const left = await db.recordAttendanceLeave(room.activeSessionId!, 'Guest_123');
      expect(left).not.toBeNull();
      expect(left!.leftAt).not.toBeNull();
    });
  });

  describe('3. Host Transfer', () => {
    it('successfully and atomically transfers host privileges to an active participant', async () => {
      const room = await roomsService.createRoom({
        name: 'Transferrable Theater',
        ownerId: hostUser.id,
      });

      const inv = await roomsService.createInvitation(room.slug, hostUser.id);
      await roomsService.joinRoom(room.slug, viewerUser.id, { inviteToken: inv.token });

      const res = await request(app)
        .post(`/api/rooms/${room.slug}/transfer-host`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ newHostId: viewerUser.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.newHostId).toBe(viewerUser.id);

      // Verify operational room ownership
      const updatedRoom = await db.findRoomBySlug(room.slug);
      expect(updatedRoom!.ownerId).toBe(viewerUser.id);

      // Verify participant roles
      const participants = await db.listParticipants(room.id);
      const prevHostPart = participants.find((p) => p.userId === hostUser.id);
      const newHostPart = participants.find((p) => p.userId === viewerUser.id);
      expect(prevHostPart!.role).toBe('PARTICIPANT');
      expect(newHostPart!.role).toBe('OWNER');

      // Verify historical session record
      const session = await db.findSessionById(room.activeSessionId!);
      expect(session!.originalHostId).toBe(hostUser.id);
      expect(session!.finalHostId).toBe(viewerUser.id);

      // Verify session transfer audit
      const details = await db.getSessionDetails(room.activeSessionId!, viewerUser.id);
      expect(details!.transfers.length).toBe(1);
      expect(details!.transfers[0].previousHostId).toBe(hostUser.id);
      expect(details!.transfers[0].newHostId).toBe(viewerUser.id);

      // Verify became_host was set on successor's attendance record
      const successorAtt = details!.attendance.find((a) => a.userId === viewerUser.id);
      expect(successorAtt!.becameHost).toBe(true);
    });

    it('rejects unauthorized host transfer from non-host users', async () => {
      const room = await roomsService.createRoom({
        name: 'Protected Transfer Theater',
        ownerId: hostUser.id,
      });

      const inv = await roomsService.createInvitation(room.slug, hostUser.id);
      await roomsService.joinRoom(room.slug, viewerUser.id, { inviteToken: inv.token });

      const res = await request(app)
        .post(`/api/rooms/${room.slug}/transfer-host`)
        .set('Authorization', `Bearer ${viewerToken}`) // Viewer attempting to transfer
        .send({ newHostId: thirdUser.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Only the current room host/i);
    });

    it('rejects transfer when target user is not an active participant', async () => {
      const room = await roomsService.createRoom({
        name: 'Nonparticipant Transfer',
        ownerId: hostUser.id,
      });

      const res = await request(app)
        .post(`/api/rooms/${room.slug}/transfer-host`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ newHostId: outsiderUser.id }); // Outsider not in room

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not an active participant/i);
    });

    it('handles concurrent host transfer requests safely', async () => {
      const room = await roomsService.createRoom({
        name: 'Concurrent Transfer Room',
        ownerId: hostUser.id,
      });

      const inv = await roomsService.createInvitation(room.slug, hostUser.id);
      await roomsService.joinRoom(room.slug, viewerUser.id, { inviteToken: inv.token });
      await roomsService.joinRoom(room.slug, thirdUser.id, { inviteToken: inv.token });

      // Run two transfers concurrently from original host
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/rooms/${room.slug}/transfer-host`)
          .set('Authorization', `Bearer ${hostToken}`)
          .send({ newHostId: viewerUser.id }),
        request(app)
          .post(`/api/rooms/${room.slug}/transfer-host`)
          .set('Authorization', `Bearer ${hostToken}`)
          .send({ newHostId: thirdUser.id }),
      ]);

      // Exactly one transfer succeeds; the other is rejected once host privileges are lost
      const successCount = (res1.status === 200 ? 1 : 0) + (res2.status === 200 ? 1 : 0);
      expect(successCount).toBe(1);

      const finalRoom = await db.findRoomBySlug(room.slug);
      expect([viewerUser.id, thirdUser.id]).toContain(finalRoom!.ownerId);
    });
  });

  describe('4. End Room & Invitation Revocation', () => {
    it('successfully ends room, finalizes session, revokes invitations, and closes attendances', async () => {
      const room = await roomsService.createRoom({
        name: 'Closing Soon Theater',
        ownerId: hostUser.id,
      });

      const inv = await roomsService.createInvitation(room.slug, hostUser.id);
      await roomsService.joinRoom(room.slug, viewerUser.id, { inviteToken: inv.token });

      const res = await request(app)
        .post(`/api/rooms/${room.slug}/end`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.room.status).toBe('CLOSED');

      // Verify operational room is marked CLOSED
      const closedRoom = await db.findRoomBySlug(room.slug);
      expect(closedRoom!.status).toBe('CLOSED');

      // Verify historical session is finalized
      const session = await db.findSessionById(room.activeSessionId!);
      expect(session!.status).toBe('CLOSED');
      expect(session!.closureReason).toBe('HOST_CLOSED');
      expect(session!.endedAt).not.toBeNull();
      expect(session!.totalDurationSeconds).toBeGreaterThanOrEqual(0);

      // Verify all attendances are closed
      const details = await db.getSessionDetails(room.activeSessionId!, hostUser.id);
      for (const att of details!.attendance) {
        expect(att.leftAt).not.toBeNull();
      }

      // Verify all invitations are revoked
      const invCheck = await db.findInvitationByToken(inv.token);
      expect(invCheck!.isRevoked).toBe(true);
    });

    it('rejects unauthorized room closure from non-host users', async () => {
      const room = await roomsService.createRoom({
        name: 'Unauthorized End Test',
        ownerId: hostUser.id,
      });

      const res = await request(app)
        .post(`/api/rooms/${room.slug}/end`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Only the current room host/i);
    });

    it('handles repeated End Room calls idempotently and safely', async () => {
      const room = await roomsService.createRoom({
        name: 'Idempotent End Test',
        ownerId: hostUser.id,
      });

      const res1 = await request(app)
        .post(`/api/rooms/${room.slug}/end`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post(`/api/rooms/${room.slug}/end`)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res2.status).toBe(200);
      expect(res2.body.message).toMatch(/already closed/i);
    });
  });

  describe('5. Room Lifecycle Enforcement (REST & Socket.IO)', () => {
    it('strictly rejects join attempts against closed rooms via REST', async () => {
      const room = await roomsService.createRoom({
        name: 'Closed REST Room',
        ownerId: hostUser.id,
      });

      const inv = await roomsService.createInvitation(room.slug, hostUser.id);
      await roomsService.endRoom(room.slug, hostUser.id);

      const res = await request(app)
        .post(`/api/rooms/${room.slug}/join`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ inviteToken: inv.token });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/closed/i);

      // Also verify getRoomBySlug rejects preview
      const getRes = await request(app)
        .get(`/api/rooms/${room.slug}?invite=${inv.token}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(getRes.status).toBe(403);
      expect(getRes.body.error).toMatch(/closed/i);
    });

    it('strictly rejects join and reconnect attempts against closed rooms via Socket.IO', async () => {
      const room = await roomsService.createRoom({
        name: 'Closed Socket Room',
        ownerId: hostUser.id,
      });

      const inv = await roomsService.createInvitation(room.slug, hostUser.id);
      await roomsService.endRoom(room.slug, hostUser.id);

      const clientSocket = ClientIO(`http://localhost:${serverPort}`, {
        auth: { token: viewerToken },
        transports: ['websocket'],
      });

      const receivedError = await new Promise<any>((resolve) => {
        clientSocket.on('connect', () => {
          clientSocket.emit('JOIN_ROOM', { roomSlug: room.slug, inviteToken: inv.token });
        });
        clientSocket.on('ERROR', (err) => {
          resolve(err);
        });
      });

      expect(receivedError.code).toBe('ROOM_CLOSED');
      expect(receivedError.message).toMatch(/closed by the host/i);

      clientSocket.disconnect();
    });
  });

  describe('6. Watch History APIs & Authorization', () => {
    it('returns paginated personal watch history with correct roles and duration', async () => {
      // Host creates and ends a session with viewer
      const room = await roomsService.createRoom({
        name: 'History Verification Theater',
        ownerId: hostUser.id,
      });

      const inv = await roomsService.createInvitation(room.slug, hostUser.id);
      await roomsService.joinRoom(room.slug, viewerUser.id, { inviteToken: inv.token });
      await roomsService.endRoom(room.slug, hostUser.id);

      // Fetch viewer watch history
      const res = await request(app)
        .get('/api/history/my?page=1&limit=10')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);

      const sessionItem = res.body.history.find((h: any) => h.id === room.activeSessionId);
      expect(sessionItem).toBeDefined();
      expect(sessionItem.userRole).toBe('PARTICIPANT');
      expect(sessionItem.roomName).toBe('History Verification Theater');
      expect(sessionItem.originalHostUsername).toBe(hostUser.username);
    });

    it('strictly restricts GET /api/history/:sessionId to authorized participants/hosts', async () => {
      const room = await roomsService.createRoom({
        name: 'Confidential Watch Party',
        ownerId: hostUser.id,
      });

      const inv = await roomsService.createInvitation(room.slug, hostUser.id);
      await roomsService.joinRoom(room.slug, viewerUser.id, { inviteToken: inv.token });
      await roomsService.endRoom(room.slug, hostUser.id);

      // Authorized attendee accesses details
      const viewerRes = await request(app)
        .get(`/api/history/${room.activeSessionId}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(viewerRes.status).toBe(200);
      expect(viewerRes.body.session.id).toBe(room.activeSessionId);

      // Outsider accesses details -> 403 Forbidden
      const outsiderRes = await request(app)
        .get(`/api/history/${room.activeSessionId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);
      expect(outsiderRes.status).toBe(403);
      expect(outsiderRes.body.error).toMatch(/Access denied/i);

      // Non-existent session -> 404 Not Found
      const nonexistentRes = await request(app)
        .get('/api/history/sess_nonexistent_id')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(nonexistentRes.status).toBe(404);
      expect(nonexistentRes.body.error).toMatch(/not found/i);
    });

    it('preserves watch history permanently even if operational room is deleted', async () => {
      const room = await roomsService.createRoom({
        name: 'Ephemeral Room Permanent History',
        ownerId: hostUser.id,
      });

      const sessionId = room.activeSessionId!;
      const inv = await roomsService.createInvitation(room.slug, hostUser.id);
      await roomsService.joinRoom(room.slug, viewerUser.id, { inviteToken: inv.token });
      await roomsService.endRoom(room.slug, hostUser.id);

      // Delete the operational room entity from rooms table
      await db.deleteRoom(room.id);
      const roomCheck = await db.findRoomById(room.id);
      expect(roomCheck).toBeNull();

      // Historical session and user watch history remain fully intact
      const details = await db.getSessionDetails(sessionId, viewerUser.id);
      expect(details).not.toBeNull();
      expect(details!.session.id).toBe(sessionId);
      expect(details!.attendance.length).toBeGreaterThanOrEqual(1);

      const historyRes = await request(app)
        .get('/api/history/my')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(historyRes.body.history.some((h: any) => h.id === sessionId)).toBe(true);
    });
  });
});
