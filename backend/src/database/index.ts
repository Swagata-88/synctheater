import { Pool } from 'pg';
import { config } from '../config';
import {
  User,
  UserProfile,
  UserPreference,
  Room,
  RoomParticipant,
  RoomInvitation,
  ChatMessage,
  RoomEvent,
  VideoSource,
  Role,
  RoomRole,
  RoomPrivacy,
  VideoProviderType,
  RoomStatus,
  RoomSession,
  ParticipantAttendance,
  HostTransferHistory,
  SessionStatus,
  ClosureReason,
  TransferType,
} from './types';
import { InMemoryDbState } from '../repositories/types';
import { FallbackStorage } from '../repositories/fallback.storage';
import { runPostgresMigrations } from '../repositories/migrations';
import { UserRepository } from '../repositories/user.repository';
import { RoomRepository } from '../repositories/room.repository';
import { ParticipantRepository } from '../repositories/participant.repository';
import { InvitationRepository } from '../repositories/invitation.repository';
import { ChatRepository } from '../repositories/chat.repository';
import { HistoryRepository, UserHistoryItem } from '../repositories/history.repository';

export class DatabaseService {
  private static instance: DatabaseService;
  private pool: Pool | null = null;
  private isPostgresConnected = false;
  private fallbackStorage: FallbackStorage;
  private inMemoryDb: InMemoryDbState;

  // Domain Repositories
  public readonly users: UserRepository;
  public readonly rooms: RoomRepository;
  public readonly participants: ParticipantRepository;
  public readonly invitations: InvitationRepository;
  public readonly chat: ChatRepository;
  public readonly history: HistoryRepository;

  private constructor() {
    this.fallbackStorage = new FallbackStorage();
    this.inMemoryDb = this.fallbackStorage.load();

    const getPool = () => this.pool;
    const isConnected = () => this.isPostgresConnected;

    this.users = new UserRepository(getPool, isConnected, this.inMemoryDb, this.fallbackStorage);
    this.rooms = new RoomRepository(getPool, isConnected, this.inMemoryDb, this.fallbackStorage);
    this.participants = new ParticipantRepository(getPool, isConnected, this.inMemoryDb, this.fallbackStorage);
    this.invitations = new InvitationRepository(getPool, isConnected, this.inMemoryDb, this.fallbackStorage);
    this.chat = new ChatRepository(getPool, isConnected, this.inMemoryDb, this.fallbackStorage);
    this.history = new HistoryRepository(getPool, isConnected, this.inMemoryDb, this.fallbackStorage);
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      this.pool = new Pool({
        connectionString: config.database.url,
        connectionTimeoutMillis: 3000,
      });

      const client = await this.pool.connect();
      this.isPostgresConnected = true;
      client.release();
      console.log('[Database] Connected to PostgreSQL successfully.');

      await runPostgresMigrations(this.pool);
    } catch (err: any) {
      this.isPostgresConnected = false;
      this.pool = null;
      if (config.env === 'production') {
        throw new Error(
          `[Database Exception] Fatal PostgreSQL connection failure in production: ${err.message}. Local fallback storage is strictly disabled in production mode.`
        );
      }
      console.warn('[Database] PostgreSQL connection failed, operating with persistent local fallback.');
    }
  }

  // --- USER OPERATIONS ---
  public createUser(data: {
    email: string;
    username: string;
    passwordHash: string;
    role?: Role;
    emailVerified?: boolean;
    verificationToken?: string | null;
  }): Promise<User> {
    return this.users.createUser(data);
  }
  public findUserByEmail(email: string): Promise<User | null> {
    return this.users.findUserByEmail(email);
  }
  public findUserByUsername(username: string): Promise<User | null> {
    return this.users.findUserByUsername(username);
  }
  public findUserById(id: string): Promise<User | null> {
    return this.users.findUserById(id);
  }
  public findUserByResetToken(token: string): Promise<User | null> {
    return this.users.findUserByResetToken(token);
  }
  public updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    return this.users.updateUserPassword(userId, passwordHash);
  }
  public consumeResetTokenAndSetPassword(
    tokenHash: string,
    legacyToken: string,
    passwordHash: string
  ): Promise<User | null> {
    return this.users.consumeResetTokenAndSetPassword(tokenHash, legacyToken, passwordHash);
  }
  public updateResetToken(userId: string, token: string | null, expiry: Date | null): Promise<void> {
    return this.users.updateResetToken(userId, token, expiry);
  }
  public updateUser(userId: string, data: Partial<User>): Promise<User | null> {
    return this.users.updateUser(userId, data);
  }
  public getProfileByUserId(userId: string): Promise<UserProfile | null> {
    return this.users.getProfileByUserId(userId);
  }
  public findProfileByUserId(userId: string): Promise<UserProfile | null> {
    return this.users.getProfileByUserId(userId);
  }
  public updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile | null> {
    return this.users.updateProfile(userId, data);
  }
  public getPreferencesByUserId(userId: string): Promise<UserPreference | null> {
    return this.users.getPreferencesByUserId(userId);
  }
  public findPreferencesByUserId(userId: string): Promise<UserPreference | null> {
    return this.users.getPreferencesByUserId(userId);
  }
  public updatePreferences(userId: string, data: Partial<UserPreference>): Promise<UserPreference | null> {
    return this.users.updatePreferences(userId, data);
  }

  // --- ROOM OPERATIONS ---
  public async createRoom(data: {
    name: string;
    description?: string;
    privacy?: RoomPrivacy;
    passwordHash?: string | null;
    maxCapacity?: number;
    ownerId: string;
    currentVideoId?: string;
    currentVideoUrl?: string;
    currentProvider?: VideoProviderType;
  }): Promise<Room> {
    const room = await this.rooms.createRoom(data);
    await this.participants.addParticipant(room.id, data.ownerId, 'OWNER');
    return room;
  }
  public findRoomById(id: string): Promise<Room | null> {
    return this.rooms.findRoomById(id);
  }
  public findRoomBySlug(slug: string): Promise<Room | null> {
    return this.rooms.findRoomBySlug(slug);
  }
  public listPublicRooms(limit = 50): Promise<Room[]> {
    return this.rooms.listPublicRooms(limit);
  }
  public updateRoomVideo(roomId: string, videoId: string, videoUrl: string, provider: VideoProviderType = 'YOUTUBE'): Promise<void> {
    return this.rooms.updateRoomVideo(roomId, videoId, videoUrl, provider);
  }
  public updateRoomEmergencyPause(roomId: string, isPaused: boolean): Promise<void> {
    return this.rooms.updateRoomEmergencyPause(roomId, isPaused);
  }
  public updateRoomPassword(roomId: string, passwordHash: string | null): Promise<void> {
    return this.rooms.updateRoomPassword(roomId, passwordHash);
  }
  public updateRoomOwner(roomId: string, newOwnerId: string): Promise<void> {
    return this.rooms.updateRoomOwner(roomId, newOwnerId);
  }
  public updateRoom(roomId: string, data: Partial<Room>): Promise<Room | null> {
    return this.rooms.updateRoom(roomId, data);
  }
  public deleteRoom(roomId: string): Promise<void> {
    return this.rooms.deleteRoom(roomId);
  }
  public listRoomsForUser(userId: string): Promise<(Room & { participantCount: number; isOwner: boolean })[]> {
    return this.rooms.listRoomsForUser(userId);
  }
  public cleanupInactiveRooms(maxInactiveMs = 24 * 60 * 60 * 1000): Promise<number> {
    return this.rooms.cleanupInactiveRooms(maxInactiveMs);
  }

  // --- PARTICIPANT OPERATIONS ---
  public addParticipant(roomId: string, userId: string, role: RoomRole = 'PARTICIPANT'): Promise<RoomParticipant> {
    return this.participants.addParticipant(roomId, userId, role);
  }
  public addParticipantWithCustodianship(roomId: string, userId: string, isOwner: boolean): Promise<RoomParticipant> {
    return this.participants.addParticipantWithCustodianship(roomId, userId, isOwner);
  }
  public removeParticipant(roomId: string, userId: string): Promise<boolean> {
    return this.participants.removeParticipant(roomId, userId);
  }
  public findParticipant(roomId: string, userId: string): Promise<RoomParticipant | null> {
    return this.participants.findParticipant(roomId, userId);
  }
  public listParticipants(roomId: string): Promise<RoomParticipant[]> {
    return this.participants.listParticipants(roomId);
  }
  public updateParticipantRole(roomId: string, userId: string, role: RoomRole): Promise<RoomParticipant> {
    return this.participants.updateParticipantRole(roomId, userId, role);
  }

  // --- INVITATION OPERATIONS ---
  public createInvitation(data: {
    roomId: string;
    token: string;
    createdBy: string;
    expiresAt?: Date | null;
    maxUses?: number | null;
  }): Promise<RoomInvitation> {
    return this.invitations.createInvitation(data);
  }
  public findInvitationByToken(token: string): Promise<RoomInvitation | null> {
    return this.invitations.findInvitationByToken(token);
  }
  public listInvitationsForRoom(roomId: string): Promise<RoomInvitation[]> {
    return this.invitations.listInvitationsForRoom(roomId);
  }
  public revokeInvitation(token: string): Promise<boolean> {
    return this.invitations.revokeInvitation(token);
  }
  public revokeAllInvitationsForRoom(roomId: string): Promise<number> {
    return this.invitations.revokeAllInvitationsForRoom(roomId);
  }
  public incrementInvitationUse(token: string): Promise<boolean> {
    return this.invitations.incrementInvitationUse(token);
  }

  // --- CHAT & EVENT OPERATIONS ---
  public saveChatMessage(data: {
    roomId: string;
    userId: string;
    username: string;
    avatarUrl?: string | null;
    content: string;
    isSystem?: boolean;
  }): Promise<ChatMessage> {
    return this.chat.saveChatMessage(data);
  }
  public createChatMessage(data: {
    roomId: string;
    userId: string;
    username: string;
    avatarUrl?: string | null;
    content: string;
    isSystem?: boolean;
  }): Promise<ChatMessage> {
    return this.chat.createChatMessage(data);
  }
  public listMessagesForRoom(roomId: string, limit = 100): Promise<ChatMessage[]> {
    return this.chat.listMessagesForRoom(roomId, limit);
  }
  public listChatMessages(roomId: string, limit = 100): Promise<ChatMessage[]> {
    return this.chat.listChatMessages(roomId, limit);
  }
  public logRoomEvent(data: { roomId: string; userId?: string | null; eventType: string; payload?: any }): Promise<RoomEvent> {
    return this.chat.logRoomEvent(data);
  }
  public addVideoSource(data: {
    roomId: string;
    provider: VideoProviderType;
    externalId: string;
    url: string;
    title?: string | null;
    duration?: number | null;
  }): Promise<VideoSource> {
    return this.chat.addVideoSource(data);
  }
  public getVideoSourcesForRoom(roomId: string): Promise<VideoSource[]> {
    return this.chat.getVideoSourcesForRoom(roomId);
  }

  // --- ROOM LIFECYCLE & WATCH HISTORY OPERATIONS ---
  public updateRoomStatus(roomId: string, status: RoomStatus): Promise<void> {
    return this.rooms.updateRoomStatus(roomId, status);
  }
  public updateRoomActiveSession(roomId: string, activeSessionId: string | null): Promise<void> {
    return this.rooms.updateRoomActiveSession(roomId, activeSessionId);
  }
  public findActiveRoomBySlug(slug: string): Promise<Room | null> {
    return this.rooms.findActiveRoomBySlug(slug);
  }

  public createRoomSession(data: {
    roomId: string;
    roomSlug: string;
    roomName: string;
    originalHostId: string;
    originalHostUsername: string;
    createdAt?: Date;
  }): Promise<RoomSession> {
    return this.history.createSession(data);
  }
  public recordSessionStart(sessionId: string, startedAt?: Date): Promise<void> {
    return this.history.recordSessionStart(sessionId, startedAt);
  }
  public recordAttendanceJoin(data: {
    sessionId: string;
    userId: string | null;
    displayName: string;
    isOriginalHost: boolean;
    becameHost?: boolean;
    joinedAt?: Date;
  }): Promise<ParticipantAttendance> {
    return this.history.recordAttendanceJoin(data);
  }
  public recordAttendanceLeave(
    sessionId: string,
    userIdOrDisplayName: string,
    leftAt?: Date
  ): Promise<ParticipantAttendance | null> {
    return this.history.recordAttendanceLeave(sessionId, userIdOrDisplayName, leftAt);
  }
  public recordHostTransfer(data: {
    sessionId: string;
    previousHostId: string;
    previousHostUsername: string;
    newHostId: string;
    newHostUsername: string;
    reason?: string;
    transferType?: TransferType;
    transferredAt?: Date;
  }): Promise<HostTransferHistory> {
    return this.history.recordHostTransfer(data);
  }
  public finalizeRoomSession(
    sessionId: string,
    reason?: ClosureReason,
    endedAt?: Date
  ): Promise<RoomSession | null> {
    return this.history.finalizeSession(sessionId, reason, endedAt);
  }
  public listUserWatchHistory(
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ sessions: UserHistoryItem[]; total: number }> {
    return this.history.listUserWatchHistory(userId, options);
  }
  public getSessionDetails(
    sessionId: string,
    userId: string
  ): Promise<{
    session: RoomSession;
    attendance: ParticipantAttendance[];
    transfers: HostTransferHistory[];
  } | null> {
    return this.history.getSessionDetails(sessionId, userId);
  }
  public findSessionById(sessionId: string): Promise<RoomSession | null> {
    return this.history.findSessionById(sessionId);
  }
  public findActiveSessionByRoomSlug(slug: string): Promise<RoomSession | null> {
    return this.history.findActiveSessionByRoomSlug(slug);
  }

  /**
   * Executes an atomic host transfer inside a single PostgreSQL transaction with row-level locking.
   * Guarantees that concurrent requests from separate backend processes cannot create inconsistent ownership.
   */
  public async executeAtomicHostTransfer(data: {
    roomId: string;
    roomSlug: string;
    currentHostId: string;
    newHostId: string;
    newHostUsername: string;
    currentHostUsername: string;
    sessionId?: string | null;
    reason?: string;
    transferType?: TransferType;
  }): Promise<{
    room: Room;
    participants: RoomParticipant[];
  }> {
    if (this.isPostgresConnected && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Lock the room row with SELECT ... FOR UPDATE
        const roomRes = await client.query(
          `SELECT * FROM rooms WHERE id = $1 FOR UPDATE`,
          [data.roomId]
        );
        if (roomRes.rows.length === 0) {
          throw new Error('Watch room not found.');
        }
        const roomRow = roomRes.rows[0];

        if (roomRow.status === 'CLOSED') {
          throw new Error('Cannot transfer host: room has been closed.');
        }

        // 2. Revalidate requesting user's ownership under the lock
        if (roomRow.owner_id !== data.currentHostId) {
          throw new Error('Only the current room host can transfer host privileges.');
        }

        if (data.currentHostId === data.newHostId) {
          throw new Error('Cannot transfer host to yourself.');
        }

        // 3. Verify target is an active participant under the lock
        const partRes = await client.query(
          `SELECT * FROM room_participants WHERE room_id = $1 AND user_id = $2 FOR UPDATE`,
          [data.roomId, data.newHostId]
        );
        if (partRes.rows.length === 0) {
          throw new Error('The target user is not an active participant in this room.');
        }

        // 4. Update rooms.owner_id
        const updateRoomRes = await client.query(
          `UPDATE rooms SET owner_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
          [data.newHostId, data.roomId]
        );

        // 5. Update participant roles
        await client.query(
          `UPDATE room_participants SET role = 'PARTICIPANT' WHERE room_id = $1 AND user_id = $2`,
          [data.roomId, data.currentHostId]
        );
        await client.query(
          `UPDATE room_participants SET role = 'OWNER' WHERE room_id = $1 AND user_id = $2`,
          [data.roomId, data.newHostId]
        );

        // 6. Update session host metadata, insert host_transfer_history audit, and update attendance
        const activeSessionId = roomRow.active_session_id || data.sessionId;
        if (activeSessionId) {
          const transferId = 'ht_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
          const transferredAt = new Date();

          await client.query(
            `INSERT INTO host_transfer_history (
              id, session_id, previous_host_id, previous_host_username,
              new_host_id, new_host_username, transferred_at, reason, transfer_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              transferId,
              activeSessionId,
              data.currentHostId,
              data.currentHostUsername,
              data.newHostId,
              data.newHostUsername,
              transferredAt,
              data.reason || 'VOLUNTARY_TRANSFER',
              data.transferType || 'VOLUNTARY',
            ]
          );

          await client.query(
            `UPDATE room_sessions 
             SET final_host_id = $1, final_host_username = $2 
             WHERE id = $3`,
            [data.newHostId, data.newHostUsername, activeSessionId]
          );

          await client.query(
            `UPDATE participant_attendance 
             SET became_host = TRUE 
             WHERE session_id = $1 AND user_id = $2`,
            [activeSessionId, data.newHostId]
          );
        }

        // Fetch updated participants under the transaction
        const updatedPartsRes = await client.query(
          `SELECT rp.*, u.username, up.avatar_url 
           FROM room_participants rp
           JOIN users u ON u.id = rp.user_id
           LEFT JOIN user_profiles up ON up.user_id = u.id
           WHERE rp.room_id = $1
           ORDER BY rp.joined_at ASC`,
          [data.roomId]
        );

        await client.query('COMMIT');

        const participants: RoomParticipant[] = updatedPartsRes.rows.map((r) => ({
          id: r.id,
          roomId: r.room_id,
          userId: r.user_id,
          role: r.role,
          joinedAt: r.joined_at,
          user: {
            id: r.user_id,
            username: r.username,
            avatarUrl: r.avatar_url,
          },
        }));

        return {
          room: this.rooms.mapRoomRow(updateRoomRes.rows[0]),
          participants,
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory fallback
    const room = this.inMemoryDb.rooms.find((r) => r.id === data.roomId);
    if (!room) throw new Error('Watch room not found.');
    if (room.status === 'CLOSED') throw new Error('Cannot transfer host: room has been closed.');
    if (room.ownerId !== data.currentHostId) throw new Error('Only the current room host can transfer host privileges.');
    if (data.currentHostId === data.newHostId) throw new Error('Cannot transfer host to yourself.');

    const targetPart = this.inMemoryDb.participants.find(
      (p) => p.roomId === data.roomId && p.userId === data.newHostId
    );
    if (!targetPart) throw new Error('The target user is not an active participant in this room.');

    room.ownerId = data.newHostId;
    room.updatedAt = new Date();

    for (const p of this.inMemoryDb.participants) {
      if (p.roomId === data.roomId && p.userId === data.currentHostId) p.role = 'PARTICIPANT';
      if (p.roomId === data.roomId && p.userId === data.newHostId) p.role = 'OWNER';
    }

    const activeSessionId = room.activeSessionId || data.sessionId;
    if (activeSessionId) {
      this.inMemoryDb.hostTransfers.push({
        id: 'ht_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
        sessionId: activeSessionId,
        previousHostId: data.currentHostId,
        previousHostUsername: data.currentHostUsername,
        newHostId: data.newHostId,
        newHostUsername: data.newHostUsername,
        transferredAt: new Date(),
        reason: data.reason || 'VOLUNTARY_TRANSFER',
        transferType: data.transferType || 'VOLUNTARY',
      });

      const sess = this.inMemoryDb.sessions.find((s) => s.id === activeSessionId);
      if (sess) {
        sess.finalHostId = data.newHostId;
        sess.finalHostUsername = data.newHostUsername;
      }

      for (const a of this.inMemoryDb.attendance) {
        if (a.sessionId === activeSessionId && a.userId === data.newHostId) {
          a.becameHost = true;
        }
      }
    }

    this.fallbackStorage.persist(this.inMemoryDb);
    const participants = await this.listParticipants(data.roomId);
    return { room, participants };
  }
}

export const db = DatabaseService.getInstance();

