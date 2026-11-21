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
} from './types';
import { InMemoryDbState } from '../repositories/types';
import { FallbackStorage } from '../repositories/fallback.storage';
import { runPostgresMigrations } from '../repositories/migrations';
import { UserRepository } from '../repositories/user.repository';
import { RoomRepository } from '../repositories/room.repository';
import { ParticipantRepository } from '../repositories/participant.repository';
import { InvitationRepository } from '../repositories/invitation.repository';
import { ChatRepository } from '../repositories/chat.repository';

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
}

export const db = DatabaseService.getInstance();
