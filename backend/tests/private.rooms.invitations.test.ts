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

describe('Private Rooms & Secure Invitation System', () => {
  let ownerUser: any;
  let ownerToken: string;
  let guestUser: any;
  let guestToken: string;
  let thirdUser: any;
  let thirdToken: string;

  beforeEach(async () => {
    const timestamp = Date.now() + Math.random().toString(36).substring(2, 6);

    const ownerReg = await authService.register({
      email: `owner_${timestamp}@synctheater.com`,
      username: `Owner_${timestamp}`,
      password: 'Password123!',
    });
    ownerUser = ownerReg.user;
    ownerToken = ownerReg.token;

    const guestReg = await authService.register({
      email: `guest_${timestamp}@synctheater.com`,
      username: `Guest_${timestamp}`,
      password: 'Password123!',
    });
    guestUser = guestReg.user;
    guestToken = guestReg.token;

    const thirdReg = await authService.register({
      email: `third_${timestamp}@synctheater.com`,
      username: `Third_${timestamp}`,
      password: 'Password123!',
    });
    thirdUser = thirdReg.user;
    thirdToken = thirdReg.token;
  });

  describe('Room Privacy Enforcement', () => {
    it('creates rooms with privacy strictly set to PRIVATE by default', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Strictly Private Theater',
          description: 'A private screening room.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.room.privacy).toBe('PRIVATE');
      expect(res.body.room.initialInviteToken).toBeDefined();
    });

    it('rejects public room creation attempts with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Attempted Public Theater',
          privacy: 'PUBLIC',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Public rooms are disabled/);
    });

    it('returns an empty list for public room discovery', async () => {
      const res = await request(app).get('/api/rooms/public');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rooms).toEqual([]);
    });

    it('lists private rooms in /api/rooms/my only for authenticated participants and owners', async () => {
      const room = await roomsService.createRoom({
        name: 'My Personal Lounge',
        ownerId: ownerUser.id,
      });

      // Owner sees the room
      const ownerRes = await request(app)
        .get('/api/rooms/my')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body.rooms.some((r: any) => r.id === room.id)).toBe(true);

      // Guest does NOT see the room before joining
      const guestRes = await request(app)
        .get('/api/rooms/my')
        .set('Authorization', `Bearer ${guestToken}`);
      expect(guestRes.status).toBe(200);
      expect(guestRes.body.rooms.some((r: any) => r.id === room.id)).toBe(false);
    });
  });

  describe('Authorization & Invitation-Based Access Control', () => {
    it('denies access (403 Forbidden) to unauthorized users who try to guess a room slug', async () => {
      const room = await roomsService.createRoom({
        name: 'Hidden Secret Theater',
        ownerId: ownerUser.id,
      });

      // Guest attempts to access without an invite token
      const res = await request(app)
        .get(`/api/rooms/${room.slug}`)
        .set('Authorization', `Bearer ${guestToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/private|invitation/i);
    });

    it('allows room owner and moderators to generate invitation tokens', async () => {
      const room = await roomsService.createRoom({
        name: 'VIP Screening',
        ownerId: ownerUser.id,
      });

      const res = await request(app)
        .post(`/api/rooms/${room.slug}/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ expiresInHours: 48, maxUses: 5 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.invitation.token).toBeDefined();
      expect(res.body.invitation.token.length).toBeGreaterThanOrEqual(24);
      expect(res.body.invitation.maxUses).toBe(5);
    });

    it('denies non-owners/non-moderators from generating invitation tokens (403)', async () => {
      const room = await roomsService.createRoom({
        name: 'Executive Room',
        ownerId: ownerUser.id,
      });

      const res = await request(app)
        .post(`/api/rooms/${room.slug}/invitations`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Only the room host and moderators/i);
    });

    it('allows an invited user to join a private room using a valid invitation token', async () => {
      const room = await roomsService.createRoom({
        name: 'Premier Watch Party',
        ownerId: ownerUser.id,
      });

      const inv = await roomsService.createInvitation(room.slug, ownerUser.id);

      // Validate invitation endpoint
      const validateRes = await request(app)
        .post(`/api/rooms/${room.slug}/validate-invite`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ inviteToken: inv.token });
      expect(validateRes.status).toBe(200);
      expect(validateRes.body.valid).toBe(true);

      // Join room with invite token
      const joinRes = await request(app)
        .post(`/api/rooms/${room.slug}/join`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ inviteToken: inv.token });

      expect(joinRes.status).toBe(200);
      expect(joinRes.body.success).toBe(true);

      // Once joined, user can fetch full room details without supplying the token again
      const accessRes = await request(app)
        .get(`/api/rooms/${room.slug}`)
        .set('Authorization', `Bearer ${guestToken}`);
      expect(accessRes.status).toBe(200);
      expect(accessRes.body.isAuthorized).toBe(true);
      expect(accessRes.body.participants.length).toBe(2);
    });

    it('rejects revoked invitation tokens with 403', async () => {
      const room = await roomsService.createRoom({
        name: 'Exclusive Room',
        ownerId: ownerUser.id,
      });

      const inv = await roomsService.createInvitation(room.slug, ownerUser.id);

      // Owner revokes the invitation
      const revokeRes = await request(app)
        .delete(`/api/rooms/${room.slug}/invitations/${inv.token}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(revokeRes.status).toBe(200);

      // Guest attempts to join with revoked token
      const joinRes = await request(app)
        .post(`/api/rooms/${room.slug}/join`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ inviteToken: inv.token });

      expect(joinRes.status).toBe(400);
      expect(joinRes.body.error).toMatch(/revoked/i);
    });

    it('rejects expired invitation tokens with 400/403', async () => {
      const room = await roomsService.createRoom({
        name: 'Time Limited Event',
        ownerId: ownerUser.id,
      });

      // Create an expired invitation directly in db
      const expiredInv = await db.createInvitation({
        roomId: room.id,
        token: `expired_test_token_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        createdBy: ownerUser.id,
        expiresAt: new Date(Date.now() - 1000 * 60), // 1 minute ago
      });

      const joinRes = await request(app)
        .post(`/api/rooms/${room.slug}/join`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ inviteToken: expiredInv.token });

      expect(joinRes.status).toBe(400);
      expect(joinRes.body.error).toMatch(/expired/i);
    });

    it('enforces maximum room capacity and rejects joins when full', async () => {
      const room = await roomsService.createRoom({
        name: 'Intimate Cinema for Two',
        maxCapacity: 2, // Owner + 1 guest
        ownerId: ownerUser.id,
      });

      const inv = await roomsService.createInvitation(room.slug, ownerUser.id);

      // Guest 1 joins successfully (room now at 2/2)
      const join1 = await request(app)
        .post(`/api/rooms/${room.slug}/join`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ inviteToken: inv.token });
      expect(join1.status).toBe(200);

      // Guest 2 (third user) attempts to join -> capacity exceeded
      const join2 = await request(app)
        .post(`/api/rooms/${room.slug}/join`)
        .set('Authorization', `Bearer ${thirdToken}`)
        .send({ inviteToken: inv.token });

      expect(join2.status).toBe(400);
      expect(join2.body.error).toMatch(/maximum participant capacity/i);
    });
  });

  describe('Socket.IO Authorization & Direct Join Protection', () => {
    let testServer: http.Server;
    let testIo: SocketIOServer;
    let serverPort: number;

    beforeEach(async () => {
      testServer = http.createServer();
      testIo = new SocketIOServer(testServer, {
        cors: { origin: '*' },
      });
      registerSocketGateway(testIo);

      await new Promise<void>((resolve) => {
        testServer.listen(0, () => {
          serverPort = (testServer.address() as any).port;
          resolve();
        });
      });
    });

    afterEach(async () => {
      testIo.close();
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    });

    it('rejects unauthorized guest socket attempting to join a private room directly', async () => {
      const room = await roomsService.createRoom({
        name: 'Socket Protected Room',
        ownerId: ownerUser.id,
      });

      const clientSocket = ClientIO(`http://localhost:${serverPort}`, {
        auth: { token: guestToken }, // Guest is authenticated but not invited
        transports: ['websocket'],
      });

      const receivedError = await new Promise<any>((resolve) => {
        clientSocket.on('connect', () => {
          clientSocket.emit('JOIN_ROOM', { roomSlug: room.slug });
        });
        clientSocket.on('ERROR', (err) => {
          resolve(err);
        });
      });

      expect(receivedError.code).toBe('INVITE_REQUIRED');
      expect(receivedError.message).toMatch(/valid invitation link is required/i);

      clientSocket.disconnect();
    });

    it('allows joining via Socket.IO when a valid invitation token is supplied', async () => {
      const room = await roomsService.createRoom({
        name: 'Socket Invite Room',
        ownerId: ownerUser.id,
      });

      const inv = await roomsService.createInvitation(room.slug, ownerUser.id);

      const clientSocket = ClientIO(`http://localhost:${serverPort}`, {
        auth: { token: guestToken },
        transports: ['websocket'],
      });

      const initialRoomState = await new Promise<any>((resolve) => {
        clientSocket.on('connect', () => {
          clientSocket.emit('JOIN_ROOM', { roomSlug: room.slug, inviteToken: inv.token });
        });
        clientSocket.on('INITIAL_ROOM_STATE', (data) => {
          resolve(data);
        });
      });

      expect(initialRoomState).toBeDefined();
      expect(initialRoomState.room.id).toBe(room.id);
      expect(initialRoomState.participants.some((p: any) => p.userId === guestUser.id)).toBe(true);

      clientSocket.disconnect();
    });
  });
});
