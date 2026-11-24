import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { roomsService } from './rooms.service';
import { authenticate, AuthenticatedRequest } from '../auth/auth.middleware';
import { kickUserFromRoom } from '../../realtime/socket.gateway';

export const roomsRouter = Router();

const createRoomSchema = z.object({
  name: z.string().min(2, 'Room name must be at least 2 characters.').max(80, 'Room name too long.'),
  description: z.string().max(300).optional(),
  privacy: z.enum(['PUBLIC', 'PRIVATE']).optional().default('PRIVATE'),
  password: z.string().min(4, 'Password must be at least 4 characters.').optional().or(z.literal('')),
  maxCapacity: z.number().int().min(2).max(100).default(25),
  initialVideoUrl: z.string().url().optional().or(z.literal('')),
});

const joinRoomSchema = z.object({
  inviteToken: z.string().optional(),
  password: z.string().optional(),
});

const createInvitationSchema = z.object({
  expiresInHours: z.number().int().positive().max(720).optional(),
  maxUses: z.number().int().positive().optional(),
});

// GET /api/rooms/my - List private rooms the authenticated user owns or belongs to
roomsRouter.get('/my', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rooms = await roomsService.listUserRooms(req.user!.userId);
    return res.json({ success: true, rooms });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/rooms/public - Public room listings are disabled. Returns empty array.
roomsRouter.get('/public', async (req: Request, res: Response) => {
  try {
    const rooms = await roomsService.listPublicRooms();
    return res.json({
      success: true,
      rooms,
      message: 'Public room listings are disabled. All watch rooms in SYNCTHEATER are strictly private.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms - Create a new private watch room
roomsRouter.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = createRoomSchema.parse(req.body);

    if (req.body.privacy === 'PUBLIC') {
      return res.status(400).json({
        error: 'Public rooms are disabled. All watch rooms must be private.',
      });
    }

    const room = await roomsService.createRoom({
      ...validated,
      privacy: 'PRIVATE',
      password: validated.password || undefined,
      initialVideoUrl: validated.initialVideoUrl || undefined,
      ownerId: req.user!.userId,
    });

    return res.status(201).json({
      success: true,
      message: 'Private watch room created successfully.',
      room,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/rooms/:slug/invitations - Generate a cryptographically secure invitation token
roomsRouter.post('/:slug/invitations', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = createInvitationSchema.parse(req.body || {});
    const invitation = await roomsService.createInvitation(
      req.params.slug,
      req.user!.userId,
      validated
    );
    return res.status(201).json({
      success: true,
      message: 'Invitation link generated successfully.',
      invitation,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    return res.status(403).json({ error: err.message });
  }
});

// GET /api/rooms/:slug/invitations - List invitations for a room (Owner/Mod only)
roomsRouter.get('/:slug/invitations', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invitations = await roomsService.listInvitations(req.params.slug, req.user!.userId);
    return res.json({ success: true, invitations });
  } catch (err: any) {
    return res.status(403).json({ error: err.message });
  }
});

// DELETE /api/rooms/:slug/invitations/:token - Revoke an invitation token
roomsRouter.delete('/:slug/invitations/:token', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await roomsService.revokeInvitation(req.params.slug, req.user!.userId, req.params.token);
    return res.json({ success: true, message: 'Invitation token revoked successfully.' });
  } catch (err: any) {
    return res.status(403).json({ error: err.message });
  }
});

// POST /api/rooms/:slug/validate-invite - Validate an invitation token before joining
roomsRouter.post('/:slug/validate-invite', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { inviteToken } = req.body;
    if (!inviteToken) {
      return res.status(400).json({ error: 'inviteToken is required.' });
    }
    const validation = await roomsService.validateInvitation(req.params.slug, inviteToken);
    if (!validation.valid) {
      return res.status(403).json({ error: validation.error || 'Invalid invitation.' });
    }
    const { passwordHash: _, ...safeRoom } = validation.room!;
    return res.json({
      success: true,
      valid: true,
      room: safeRoom,
      needsPassword: !!validation.room!.passwordHash,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/rooms/:slug - Fetch room details with private authorization enforcement
roomsRouter.get('/:slug', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const inviteToken = typeof req.query.invite === 'string' ? req.query.invite : undefined;
    const data = await roomsService.getRoomBySlug(req.params.slug, req.user!.userId, inviteToken);

    if (!data) {
      return res.status(404).json({ error: 'Watch room not found.' });
    }

    if (!data.isAuthorized && data.unauthorizedReason) {
      return res.status(403).json({
        error: data.unauthorizedReason,
        isPrivate: true,
        slug: req.params.slug,
      });
    }

    const { passwordHash: _, ...safeRoom } = data.room;

    return res.json({
      success: true,
      room: {
        ...safeRoom,
        hasPassword: !!data.room.passwordHash,
      },
      participants: data.participants,
      isAuthorized: data.isAuthorized,
      needsPassword: data.needsPassword || false,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms/:slug/join - Join a private room with invitation authorization
roomsRouter.post('/:slug/join', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = joinRoomSchema.parse(req.body || {});
    const result = await roomsService.joinRoom(req.params.slug, req.user!.userId, {
      inviteToken: validated.inviteToken,
      password: validated.password,
    });

    const { passwordHash: _, ...safeRoom } = result.room;

    return res.json({
      success: true,
      message: 'Joined room successfully.',
      room: safeRoom,
      participant: result.participant,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/rooms/:slug/leave
roomsRouter.post('/:slug/leave', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await roomsService.leaveRoom(req.params.slug, req.user!.userId);
    return res.json({ success: true, message: 'Left room successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms/:slug/kick
roomsRouter.post('/:slug/kick', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetUserId, reason } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required.' });
    }
    await roomsService.kickParticipant(req.params.slug, req.user!.userId, targetUserId);
    await kickUserFromRoom(req.params.slug, targetUserId, reason);
    return res.json({ success: true, message: 'Participant kicked.' });
  } catch (err: any) {
    return res.status(403).json({ error: err.message });
  }
});

// POST /api/rooms/:slug/transfer-owner
roomsRouter.post('/:slug/transfer-owner', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newOwnerId } = req.body;
    if (!newOwnerId) {
      return res.status(400).json({ error: 'newOwnerId is required.' });
    }
    const updated = await roomsService.transferOwnership(req.params.slug, req.user!.userId, newOwnerId);
    return res.json({ success: true, room: updated });
  } catch (err: any) {
    return res.status(403).json({ error: err.message });
  }
});

// POST /api/rooms/:slug/transfer-host - Voluntary host privileges transfer (Host only)
roomsRouter.post('/:slug/transfer-host', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newHostId } = req.body || {};
    if (!newHostId || typeof newHostId !== 'string') {
      return res.status(400).json({ error: 'newHostId is required.' });
    }
    const result = await roomsService.transferHost(
      req.params.slug,
      req.user!.userId,
      newHostId
    );
    return res.json({
      success: true,
      message: 'Host privileges transferred successfully.',
      ...result,
    });
  } catch (err: any) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('Only the current room host')) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/rooms/:slug/end - End room lifecycle and finalize watch session (Host only)
roomsRouter.post('/:slug/end', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await roomsService.endRoom(req.params.slug, req.user!.userId);
    return res.json(result);
  } catch (err: any) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('Only the current room host')) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(400).json({ error: err.message });
  }
});
