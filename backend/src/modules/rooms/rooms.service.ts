import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../../database';
import { Room, RoomParticipant, RoomInvitation, VideoProviderType } from '../../database/types';
import { videoService } from '../video/video.service';
import { config } from '../../config';

export class RoomsService {
  private static instance: RoomsService;

  public static getInstance(): RoomsService {
    if (!RoomsService.instance) {
      RoomsService.instance = new RoomsService();
    }
    return RoomsService.instance;
  }

  public async createRoom(data: {
    name: string;
    description?: string;
    privacy?: string;
    password?: string;
    maxCapacity?: number;
    initialVideoUrl?: string;
    ownerId: string;
  }): Promise<Room & { initialInviteToken?: string }> {
    if (data.privacy === 'PUBLIC') {
      throw new Error('Public rooms are disabled. All rooms must be private.');
    }

    let passwordHash: string | null = null;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 10);
    }

    let videoId = 'dQw4w9WgXcQ';
    let videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    let provider: VideoProviderType = 'YOUTUBE';

    if (data.initialVideoUrl) {
      const resolved = videoService.resolveUrl(data.initialVideoUrl);
      if (resolved.isSupported) {
        videoId = resolved.videoId;
        videoUrl = resolved.originalUrl;
        provider = resolved.provider;
      }
    }

    const roomCapacity = Math.min(
      Math.max(data.maxCapacity || 25, 2),
      config.maxRoomCapacity || 100
    );

    const room = await db.createRoom({
      name: data.name,
      description: data.description,
      privacy: 'PRIVATE',
      passwordHash,
      maxCapacity: roomCapacity,
      ownerId: data.ownerId,
      currentVideoId: videoId,
      currentVideoUrl: videoUrl,
      currentProvider: provider,
    });

    // Automatically generate an initial invitation token for the room owner
    const inviteToken = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + (config.invitationTokenTtlHours || 72) * 60 * 60 * 1000);

    await db.createInvitation({
      roomId: room.id,
      token: inviteToken,
      createdBy: data.ownerId,
      expiresAt,
    });

    return {
      ...room,
      initialInviteToken: inviteToken,
    };
  }

  public async createInvitation(
    roomSlug: string,
    requesterId: string,
    options?: { expiresInHours?: number; maxUses?: number }
  ): Promise<RoomInvitation> {
    const room = await db.findRoomBySlug(roomSlug);
    if (!room) {
      throw new Error('Watch room not found.');
    }

    // Verify requester is owner or moderator
    const isOwner = room.ownerId === requesterId;
    const participant = await db.findParticipant(room.id, requesterId);
    const isMod = participant?.role === 'MODERATOR' || participant?.role === 'OWNER';

    if (!isOwner && !isMod) {
      throw new Error('Only the room host and moderators can create invitation links.');
    }

    const token = crypto.randomBytes(24).toString('base64url');
    const hours = options?.expiresInHours || config.invitationTokenTtlHours || 72;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    return db.createInvitation({
      roomId: room.id,
      token,
      createdBy: requesterId,
      expiresAt,
      maxUses: options?.maxUses,
    });
  }

  public async listInvitations(roomSlug: string, requesterId: string): Promise<RoomInvitation[]> {
    const room = await db.findRoomBySlug(roomSlug);
    if (!room) {
      throw new Error('Watch room not found.');
    }

    const isOwner = room.ownerId === requesterId;
    const participant = await db.findParticipant(room.id, requesterId);
    const isMod = participant?.role === 'MODERATOR' || participant?.role === 'OWNER';

    if (!isOwner && !isMod) {
      throw new Error('You do not have permission to view invitations.');
    }

    return db.listInvitationsForRoom(room.id);
  }

  public async revokeInvitation(roomSlug: string, requesterId: string, token: string): Promise<boolean> {
    const room = await db.findRoomBySlug(roomSlug);
    if (!room) {
      throw new Error('Watch room not found.');
    }

    const isOwner = room.ownerId === requesterId;
    const participant = await db.findParticipant(room.id, requesterId);
    const isMod = participant?.role === 'MODERATOR' || participant?.role === 'OWNER';

    if (!isOwner && !isMod) {
      throw new Error('You do not have permission to revoke invitations.');
    }

    const inv = await db.findInvitationByToken(token);
    if (!inv || inv.roomId !== room.id) {
      throw new Error('Invitation not found for this room.');
    }

    return db.revokeInvitation(token);
  }

  public async validateInvitation(
    roomSlug: string,
    token: string
  ): Promise<{ valid: boolean; error?: string; room?: Room; invitation?: RoomInvitation }> {
    const room = await db.findRoomBySlug(roomSlug);
    if (!room) {
      return { valid: false, error: 'Watch room not found.' };
    }

    const invitation = await db.findInvitationByToken(token);
    if (!invitation || invitation.roomId !== room.id) {
      return { valid: false, error: 'Invalid or unrecognized invitation token.' };
    }

    if (invitation.isRevoked) {
      return { valid: false, error: 'This invitation has been revoked by the room host.' };
    }

    if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() < Date.now()) {
      return { valid: false, error: 'This invitation has expired. Please request a new link from the host.' };
    }

    if (invitation.maxUses && invitation.usesCount >= invitation.maxUses) {
      return { valid: false, error: 'This invitation link has reached its maximum allowed uses.' };
    }

    const participants = await db.listParticipants(room.id);
    if (participants.length >= room.maxCapacity) {
      return { valid: false, error: 'Room has reached its maximum participant capacity.' };
    }

    return { valid: true, room, invitation };
  }

  public async getRoomBySlug(
    slug: string,
    userId?: string,
    inviteToken?: string
  ): Promise<{
    room: Room;
    participants: RoomParticipant[];
    isAuthorized: boolean;
    needsPassword?: boolean;
    unauthorizedReason?: string;
  } | null> {
    const room = await db.findRoomBySlug(slug);
    if (!room) return null;

    let isAuthorized = false;
    let participant: RoomParticipant | null = null;

    if (userId) {
      if (room.ownerId === userId) {
        isAuthorized = true;
      } else {
        participant = await db.findParticipant(room.id, userId);
        if (participant) {
          isAuthorized = true;
        }
      }
    }

    // If not already a member, check if a valid invite token was provided
    if (!isAuthorized && inviteToken) {
      const validation = await this.validateInvitation(slug, inviteToken);
      if (validation.valid) {
        // Valid invite: return safe preview so the frontend can display room join modal
        return {
          room,
          participants: [],
          isAuthorized: false,
          needsPassword: !!room.passwordHash,
        };
      } else {
        return {
          room,
          participants: [],
          isAuthorized: false,
          unauthorizedReason: validation.error || 'Invalid invitation token.',
        };
      }
    }

    if (!isAuthorized) {
      return {
        room,
        participants: [],
        isAuthorized: false,
        unauthorizedReason: 'This room is private. A valid invitation link is required.',
      };
    }

    const participants = await db.listParticipants(room.id);
    return {
      room,
      participants,
      isAuthorized: true,
      needsPassword: false,
    };
  }

  public async listUserRooms(userId: string): Promise<(Room & { participantCount: number; isOwner: boolean })[]> {
    return db.listRoomsForUser(userId);
  }

  public async listPublicRooms(): Promise<(Room & { participantCount: number })[]> {
    // Public room discovery is intentionally disabled.
    return [];
  }

  public async joinRoom(
    slug: string,
    userId: string,
    options?: {
      inviteToken?: string;
      password?: string;
    }
  ): Promise<{ room: Room; participant: RoomParticipant }> {
    const room = await db.findRoomBySlug(slug);
    if (!room) {
      throw new Error('Room not found.');
    }

    const isOwner = room.ownerId === userId;
    const existingPart = await db.findParticipant(room.id, userId);

    // If not owner and not an existing participant, an invitation token is strictly required
    if (!isOwner && !existingPart) {
      if (!options?.inviteToken) {
        throw new Error('This room is private. A valid invitation link is required.');
      }

      const validation = await this.validateInvitation(slug, options.inviteToken);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid or expired invitation token.');
      }

      // Check capacity
      const participants = await db.listParticipants(room.id);
      if (participants.length >= room.maxCapacity) {
        throw new Error('Room has reached its maximum participant capacity.');
      }

      // Atomically increment invitation use count
      const claimed = await db.incrementInvitationUse(options.inviteToken);
      if (!claimed) {
        throw new Error('This invitation has reached its maximum uses or has expired.');
      }
    }

    // Check password if configured on room
    if (room.passwordHash) {
      if (!isOwner && !existingPart) {
        if (!options?.password) {
          throw new Error('This room is password-protected. A password is required.');
        }
        const isMatch = await bcrypt.compare(options.password, room.passwordHash);
        if (!isMatch) {
          throw new Error('Incorrect room password.');
        }
      }
    }

    const participant = await db.addParticipant(
      room.id,
      userId,
      isOwner ? 'OWNER' : 'PARTICIPANT'
    );

    return { room, participant };
  }

  public async leaveRoom(slug: string, userId: string): Promise<boolean> {
    const room = await db.findRoomBySlug(slug);
    if (!room) return false;

    await db.removeParticipant(room.id, userId);

    if (room.ownerId === userId) {
      const remaining = await db.listParticipants(room.id);
      if (remaining.length > 0) {
        const nextOwner = remaining.find((p) => p.role === 'MODERATOR') || remaining[0];
        await db.updateRoom(room.id, { ownerId: nextOwner.userId });
        await db.updateParticipantRole(room.id, nextOwner.userId, 'OWNER');
      }
    }

    return true;
  }

  public async kickParticipant(slug: string, requesterId: string, targetUserId: string): Promise<boolean> {
    const room = await db.findRoomBySlug(slug);
    if (!room) throw new Error('Room not found.');

    const requesterPart = await db.findParticipant(room.id, requesterId);
    if (!requesterPart || (requesterPart.role !== 'OWNER' && requesterPart.role !== 'MODERATOR')) {
      throw new Error('You do not have permission to kick participants.');
    }

    if (targetUserId === room.ownerId) {
      throw new Error('The room owner cannot be kicked.');
    }

    return db.removeParticipant(room.id, targetUserId);
  }

  public async transferOwnership(slug: string, currentOwnerId: string, newOwnerId: string): Promise<Room> {
    const room = await db.findRoomBySlug(slug);
    if (!room) throw new Error('Room not found.');

    if (room.ownerId !== currentOwnerId) {
      throw new Error('Only the current room owner can transfer ownership.');
    }

    const newOwnerPart = await db.findParticipant(room.id, newOwnerId);
    if (!newOwnerPart) {
      throw new Error('The target user is not a participant in this room.');
    }

    await db.updateParticipantRole(room.id, currentOwnerId, 'MODERATOR');
    await db.updateParticipantRole(room.id, newOwnerId, 'OWNER');

    const updated = await db.updateRoom(room.id, { ownerId: newOwnerId });
    return updated!;
  }
}

export const roomsService = RoomsService.getInstance();
