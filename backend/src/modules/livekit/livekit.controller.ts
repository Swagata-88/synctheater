import { Router, Response } from 'express';
import { z } from 'zod';
import { liveKitService } from './livekit.service';
import { authenticate, AuthenticatedRequest } from '../auth/auth.middleware';
import { db } from '../../database';

export const livekitRouter = Router();

const tokenQuerySchema = z.object({
  room: z.string().min(1, 'Room name/slug is required.'),
});

// GET /api/livekit/token
livekitRouter.get('/token', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = tokenQuerySchema.parse(req.query);
    const user = req.user!;

    // 1. Verify that the room actually exists
    const room = await db.findRoomBySlug(validated.room);
    if (!room) {
      return res.status(404).json({ error: 'Watch room not found.' });
    }

    // 2. Enforce room authorization
    // If the room is private, user must be either the owner or an active participant
    if (room.privacy === 'PRIVATE') {
      const isOwner = room.ownerId === user.userId;
      const participant = await db.findParticipant(room.id, user.userId);
      if (!isOwner && !participant) {
        return res.status(403).json({
          error: 'Unauthorized: You must join this private room before requesting a voice/video token.',
        });
      }
    }

    // 3. Generate authorized short-lived WebRTC access token
    const result = await liveKitService.generateRoomToken({
      roomName: room.slug,
      participantIdentity: user.userId,
      participantName: user.username,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    return res.status(500).json({ error: err.message || 'Failed to generate voice/video token.' });
  }
});
