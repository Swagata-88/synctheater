import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { liveKitService } from '../src/modules/livekit/livekit.service';
import { livekitRouter } from '../src/modules/livekit/livekit.controller';
import { authService } from '../src/modules/auth/auth.service';
import { roomsService } from '../src/modules/rooms/rooms.service';
import { db } from '../src/database';

describe('LiveKit WebRTC Service & Controller Security', () => {
  let app: express.Express;
  let ownerUser: any;
  let ownerToken: string;
  let guestUser: any;
  let guestToken: string;
  let privateRoom: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/livekit', livekitRouter);

    const timestamp = Date.now() + Math.random().toString(36).substring(2, 6);

    // Register owner
    const ownerReg = await authService.register({
      email: `lk_owner_${timestamp}@synctheater.com`,
      username: `lk_owner_${timestamp}`,
      password: 'Password123!',
    });
    ownerUser = ownerReg.user;
    ownerToken = ownerReg.token;

    // Register guest
    const guestReg = await authService.register({
      email: `lk_guest_${timestamp}@synctheater.com`,
      username: `lk_guest_${timestamp}`,
      password: 'Password123!',
    });
    guestUser = guestReg.user;
    guestToken = guestReg.token;

    // Create private room
    privateRoom = await roomsService.createRoom({
      name: `LK Private Room ${timestamp}`,
      privacy: 'PRIVATE',
      maxCapacity: 20,
      ownerId: ownerUser.id,
    });
  });

  describe('LiveKitService unit methods', () => {
    it('generates a cryptographically valid LiveKit JWT with room grants', async () => {
      const roomName = 'test-theater-room';
      const participantIdentity = 'user-12345';
      const participantName = 'Cinephile';

      const result = await liveKitService.generateRoomToken({
        roomName,
        participantIdentity,
        participantName,
      });

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.serverUrl).toBeDefined();

      // Verify the generated token using TokenVerifier
      const claims = await liveKitService.verifyRoomToken(result.token);
      expect(claims).toBeDefined();
      expect(claims.sub).toBe(participantIdentity);
      expect(claims.name).toBe(participantName);
      expect(claims.video).toBeDefined();
      expect(claims.video.roomJoin).toBe(true);
      expect(claims.video.room).toBe(roomName);
      expect(claims.video.canPublish).toBe(true);
      expect(claims.video.canSubscribe).toBe(true);
    });

    it('rejects verification for an invalid or tampered token', async () => {
      await expect(
        liveKitService.verifyRoomToken('invalid.token.payload')
      ).rejects.toThrow();
    });
  });

  describe('GET /api/livekit/token authorization checks', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get(`/api/livekit/token?room=${privateRoom.slug}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Authentication required/);
    });

    it('rejects requests missing room parameter with 400', async () => {
      const res = await request(app)
        .get('/api/livekit/token')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Required|Room name\/slug is required/);
    });

    it('rejects requests for non-existent room with 404', async () => {
      const res = await request(app)
        .get('/api/livekit/token?room=non-existent-room-slug-xyz')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Watch room not found/);
    });

    it('allows the room owner to acquire a token for a PRIVATE room', async () => {
      const res = await request(app)
        .get(`/api/livekit/token?room=${privateRoom.slug}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });

    it('denies an unauthorized user from acquiring a token for a PRIVATE room (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/livekit/token?room=${privateRoom.slug}`)
        .set('Authorization', `Bearer ${guestToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Unauthorized/);
    });

    it('allows a guest who has joined a PRIVATE room to acquire a token', async () => {
      // Add guest to room participant list
      await db.addParticipant(privateRoom.id, guestUser.id, 'VIEWER' as any);

      const res = await request(app)
        .get(`/api/livekit/token?room=${privateRoom.slug}`)
        .set('Authorization', `Bearer ${guestToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });
  });
});
