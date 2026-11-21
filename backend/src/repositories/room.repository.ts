import { Pool } from 'pg';
import { Room, RoomPrivacy, VideoProviderType } from '../database/types';
import { InMemoryDbState } from './types';
import { FallbackStorage } from './fallback.storage';

export class RoomRepository {
  constructor(
    private getPool: () => Pool | null,
    private isConnected: () => boolean,
    private inMemoryDb: InMemoryDbState,
    private storage: FallbackStorage
  ) {}

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
    const slug =
      data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') +
      '-' +
      Math.random().toString(36).substring(2, 7);

    const room: Room = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      slug,
      name: data.name,
      description: data.description || null,
      privacy: 'PRIVATE',
      passwordHash: data.passwordHash || null,
      maxCapacity: data.maxCapacity || 20,
      ownerId: data.ownerId,
      currentVideoId: data.currentVideoId || 'dQw4w9WgXcQ',
      currentVideoUrl: data.currentVideoUrl || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      currentProvider: data.currentProvider || 'YOUTUBE',
      isEmergencyPaused: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `INSERT INTO rooms (id, slug, name, description, privacy, password_hash, max_capacity, owner_id, current_video_id, current_video_url, current_provider, is_emergency_paused, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          room.id,
          room.slug,
          room.name,
          room.description,
          room.privacy,
          room.passwordHash,
          room.maxCapacity,
          room.ownerId,
          room.currentVideoId,
          room.currentVideoUrl,
          room.currentProvider,
          room.isEmergencyPaused,
          room.createdAt,
          room.updatedAt,
        ]
      );
    } else {
      this.inMemoryDb.rooms.push(room);
      this.storage.persist(this.inMemoryDb);
    }

    return room;
  }

  public async findRoomById(id: string): Promise<Room | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(`SELECT * FROM rooms WHERE id = $1 LIMIT 1`, [id]);
      if (res.rows.length === 0) return null;
      return this.mapRoomRow(res.rows[0]);
    }
    return this.inMemoryDb.rooms.find((r) => r.id === id) || null;
  }

  public async findRoomBySlug(slug: string): Promise<Room | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(`SELECT * FROM rooms WHERE slug = $1 LIMIT 1`, [slug]);
      if (res.rows.length === 0) return null;
      return this.mapRoomRow(res.rows[0]);
    }
    return this.inMemoryDb.rooms.find((r) => r.slug === slug) || null;
  }

  public async listPublicRooms(limit = 50): Promise<Room[]> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `SELECT * FROM rooms WHERE privacy = 'PUBLIC' ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
      return res.rows.map(this.mapRoomRow);
    }
    return this.inMemoryDb.rooms.filter((r) => r.privacy === 'PUBLIC').slice(0, limit);
  }

  public async updateRoomVideo(
    roomId: string,
    videoId: string,
    videoUrl: string,
    provider: VideoProviderType = 'YOUTUBE'
  ): Promise<void> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `UPDATE rooms SET current_video_id = $1, current_video_url = $2, current_provider = $3, updated_at = NOW() WHERE id = $4`,
        [videoId, videoUrl, provider, roomId]
      );
      return;
    }
    const idx = this.inMemoryDb.rooms.findIndex((r) => r.id === roomId);
    if (idx !== -1) {
      this.inMemoryDb.rooms[idx].currentVideoId = videoId;
      this.inMemoryDb.rooms[idx].currentVideoUrl = videoUrl;
      this.inMemoryDb.rooms[idx].currentProvider = provider;
      this.inMemoryDb.rooms[idx].updatedAt = new Date();
      this.storage.persist(this.inMemoryDb);
    }
  }

  public async updateRoomEmergencyPause(roomId: string, isPaused: boolean): Promise<void> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `UPDATE rooms SET is_emergency_paused = $1, updated_at = NOW() WHERE id = $2`,
        [isPaused, roomId]
      );
      return;
    }
    const idx = this.inMemoryDb.rooms.findIndex((r) => r.id === roomId);
    if (idx !== -1) {
      this.inMemoryDb.rooms[idx].isEmergencyPaused = isPaused;
      this.inMemoryDb.rooms[idx].updatedAt = new Date();
      this.storage.persist(this.inMemoryDb);
    }
  }

  public async updateRoomPassword(roomId: string, passwordHash: string | null): Promise<void> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `UPDATE rooms SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [passwordHash, roomId]
      );
      return;
    }
    const idx = this.inMemoryDb.rooms.findIndex((r) => r.id === roomId);
    if (idx !== -1) {
      this.inMemoryDb.rooms[idx].passwordHash = passwordHash;
      this.inMemoryDb.rooms[idx].updatedAt = new Date();
      this.storage.persist(this.inMemoryDb);
    }
  }

  public async updateRoomOwner(roomId: string, newOwnerId: string): Promise<void> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `UPDATE rooms SET owner_id = $1, updated_at = NOW() WHERE id = $2`,
        [newOwnerId, roomId]
      );
      return;
    }
    const idx = this.inMemoryDb.rooms.findIndex((r) => r.id === roomId);
    if (idx !== -1) {
      this.inMemoryDb.rooms[idx].ownerId = newOwnerId;
      this.inMemoryDb.rooms[idx].updatedAt = new Date();
      this.storage.persist(this.inMemoryDb);
    }
  }

  public async updateRoom(roomId: string, data: Partial<Room>): Promise<Room | null> {
    const current = await this.findRoomById(roomId);
    if (!current) return null;
    const updated: Room = {
      ...current,
      ...data,
      updatedAt: new Date(),
    };

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `UPDATE rooms 
         SET name = $1, description = $2, privacy = $3, password_hash = $4, max_capacity = $5, owner_id = $6, current_video_id = $7, current_video_url = $8, current_provider = $9, is_emergency_paused = $10, updated_at = NOW() 
         WHERE id = $11`,
        [
          updated.name,
          updated.description,
          updated.privacy,
          updated.passwordHash,
          updated.maxCapacity,
          updated.ownerId,
          updated.currentVideoId,
          updated.currentVideoUrl,
          updated.currentProvider,
          updated.isEmergencyPaused,
          roomId,
        ]
      );
    } else {
      const idx = this.inMemoryDb.rooms.findIndex((r) => r.id === roomId);
      if (idx !== -1) {
        this.inMemoryDb.rooms[idx] = updated;
        this.storage.persist(this.inMemoryDb);
      }
    }
    return updated;
  }

  public async deleteRoom(roomId: string): Promise<void> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
      return;
    }
    this.inMemoryDb.rooms = this.inMemoryDb.rooms.filter((r) => r.id !== roomId);
    this.inMemoryDb.participants = this.inMemoryDb.participants.filter((p) => p.roomId !== roomId);
    this.inMemoryDb.invitations = this.inMemoryDb.invitations.filter((i) => i.roomId !== roomId);
    this.inMemoryDb.chatMessages = this.inMemoryDb.chatMessages.filter((c) => c.roomId !== roomId);
    this.storage.persist(this.inMemoryDb);
  }

  public async listRoomsForUser(userId: string): Promise<(Room & { participantCount: number; isOwner: boolean })[]> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `SELECT r.*,
                (SELECT COUNT(*)::int FROM room_participants rp WHERE rp.room_id = r.id) AS participant_count,
                (r.owner_id = $1) AS is_owner
         FROM rooms r
         WHERE r.owner_id = $1
            OR r.id IN (SELECT room_id FROM room_participants WHERE user_id = $1)
         ORDER BY r.updated_at DESC`,
        [userId]
      );
      return res.rows.map((row) => ({
        ...this.mapRoomRow(row),
        participantCount: row.participant_count || 0,
        isOwner: row.is_owner,
      }));
    }

    const userRoomIds = new Set(
      this.inMemoryDb.participants.filter((p) => p.userId === userId).map((p) => p.roomId)
    );
    const rooms = this.inMemoryDb.rooms.filter((r) => r.ownerId === userId || userRoomIds.has(r.id));
    return rooms.map((r) => ({
      ...r,
      participantCount: this.inMemoryDb.participants.filter((p) => p.roomId === r.id).length,
      isOwner: r.ownerId === userId,
    }));
  }

  public async cleanupInactiveRooms(maxInactiveMs = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - maxInactiveMs);
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `DELETE FROM rooms 
         WHERE updated_at < $1 
           AND id NOT IN (SELECT DISTINCT room_id FROM room_participants)`,
        [cutoff]
      );
      return res.rowCount ?? 0;
    }

    const candidateIds = this.inMemoryDb.rooms
      .filter((r) => {
        const hasParts = this.inMemoryDb.participants.some((p) => p.roomId === r.id);
        return !hasParts && new Date(r.updatedAt).getTime() < cutoff.getTime();
      })
      .map((r) => r.id);

    if (candidateIds.length > 0) {
      for (const id of candidateIds) {
        await this.deleteRoom(id);
      }
    }
    return candidateIds.length;
  }

  public mapRoomRow(r: any): Room {
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      privacy: r.privacy,
      passwordHash: r.password_hash,
      maxCapacity: r.max_capacity,
      ownerId: r.owner_id,
      currentVideoId: r.current_video_id,
      currentVideoUrl: r.current_video_url,
      currentProvider: r.current_provider,
      isEmergencyPaused: r.is_emergency_paused,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
