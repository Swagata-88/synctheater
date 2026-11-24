import { Pool } from 'pg';
import { RoomParticipant, RoomRole } from '../database/types';
import { InMemoryDbState } from './types';
import { FallbackStorage } from './fallback.storage';

export class ParticipantRepository {
  constructor(
    private getPool: () => Pool | null,
    private isConnected: () => boolean,
    private inMemoryDb: InMemoryDbState,
    private storage: FallbackStorage
  ) {}

  public async addParticipant(
    roomId: string,
    userId: string,
    role: RoomRole = 'PARTICIPANT'
  ): Promise<RoomParticipant> {
    const existing = await this.findParticipant(roomId, userId);
    if (existing) {
      if (existing.role !== role) {
        return this.updateParticipantRole(roomId, userId, role);
      }
      return existing;
    }

    const participant: RoomParticipant = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      roomId,
      userId,
      role,
      joinedAt: new Date(),
    };

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `INSERT INTO room_participants (id, room_id, user_id, role, joined_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (room_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
        [participant.id, participant.roomId, participant.userId, participant.role, participant.joinedAt]
      );
    } else {
      this.inMemoryDb.participants.push(participant);
      this.storage.persist(this.inMemoryDb);
    }

    return participant;
  }

  /**
   * Atomically adds a participant and determines their role using row-level locking
   * to guarantee only one Acting Custodian (MODERATOR) is assigned on empty-room joins.
   */
  public async addParticipantWithCustodianship(
    roomId: string,
    userId: string,
    isOwner: boolean
  ): Promise<RoomParticipant> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Lock the room row to serialize concurrent joins for this room
        const roomRes = await client.query(
          `SELECT * FROM rooms WHERE id = $1 FOR UPDATE`,
          [roomId]
        );
        if (roomRes.rows.length === 0) {
          throw new Error('Room not found.');
        }

        // 2. Query all current participants under the lock
        const partsRes = await client.query(
          `SELECT * FROM room_participants WHERE room_id = $1 FOR UPDATE`,
          [roomId]
        );
        const existingParticipants = partsRes.rows;
        const existingUserPart = existingParticipants.find((p) => p.user_id === userId);

        let role: RoomRole = 'PARTICIPANT';
        if (isOwner) {
          role = 'OWNER';
        } else if (existingUserPart) {
          // Preserve role upon reconnect
          role = existingUserPart.role as RoomRole;
        } else {
          // Check if any host or custodian is currently active in the room
          const hasHostOrMod = existingParticipants.some(
            (p) => p.role === 'OWNER' || p.role === 'MODERATOR'
          );
          if (!hasHostOrMod && existingParticipants.length === 0) {
            role = 'MODERATOR';
          } else {
            role = 'PARTICIPANT';
          }
        }

        const id = existingUserPart
          ? existingUserPart.id
          : Math.random().toString(36).substring(2) + Date.now().toString(36);
        const joinedAt = existingUserPart ? existingUserPart.joined_at : new Date();

        const insertRes = await client.query(
          `INSERT INTO room_participants (id, room_id, user_id, role, joined_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (room_id, user_id) DO UPDATE SET role = EXCLUDED.role
           RETURNING *`,
          [id, roomId, userId, role, joinedAt]
        );

        await client.query('COMMIT');
        const r = insertRes.rows[0];
        return {
          id: r.id,
          roomId: r.room_id,
          userId: r.user_id,
          role: r.role as RoomRole,
          joinedAt: new Date(r.joined_at),
        };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory fallback
    const existing = this.inMemoryDb.participants.find(
      (p) => p.roomId === roomId && p.userId === userId
    );
    let role: RoomRole = 'PARTICIPANT';
    if (isOwner) {
      role = 'OWNER';
    } else if (existing) {
      role = existing.role;
    } else {
      const roomParts = this.inMemoryDb.participants.filter((p) => p.roomId === roomId);
      const hasHostOrMod = roomParts.some((p) => p.role === 'OWNER' || p.role === 'MODERATOR');
      if (!hasHostOrMod && roomParts.length === 0) {
        role = 'MODERATOR';
      } else {
        role = 'PARTICIPANT';
      }
    }

    if (existing) {
      existing.role = role;
      this.storage.persist(this.inMemoryDb);
      return existing;
    }

    const participant: RoomParticipant = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      roomId,
      userId,
      role,
      joinedAt: new Date(),
    };
    this.inMemoryDb.participants.push(participant);
    this.storage.persist(this.inMemoryDb);
    return participant;
  }

  public async removeParticipant(roomId: string, userId: string): Promise<boolean> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(`DELETE FROM room_participants WHERE room_id = $1 AND user_id = $2`, [roomId, userId]);
      return (res.rowCount ?? 0) > 0;
    }
    const initialLen = this.inMemoryDb.participants.length;
    this.inMemoryDb.participants = this.inMemoryDb.participants.filter(
      (p) => !(p.roomId === roomId && p.userId === userId)
    );
    const removed = this.inMemoryDb.participants.length < initialLen;
    this.storage.persist(this.inMemoryDb);
    return removed;
  }

  public async findParticipant(roomId: string, userId: string): Promise<RoomParticipant | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `SELECT rp.*, u.username, up.avatar_url 
         FROM room_participants rp
         JOIN users u ON u.id = rp.user_id
         LEFT JOIN user_profiles up ON up.user_id = u.id
         WHERE rp.room_id = $1 AND rp.user_id = $2
         LIMIT 1`,
        [roomId, userId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
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
      };
    }
    const part = this.inMemoryDb.participants.find((p) => p.roomId === roomId && p.userId === userId);
    if (!part) return null;
    const user = this.inMemoryDb.users.find((u) => u.id === userId);
    const profile = this.inMemoryDb.profiles.find((pr) => pr.userId === userId);
    return {
      ...part,
      user: user
        ? {
            id: user.id,
            username: user.username,
            avatarUrl: profile?.avatarUrl || null,
          }
        : undefined,
    };
  }

  public async listParticipants(roomId: string): Promise<RoomParticipant[]> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `SELECT rp.*, u.username, up.avatar_url 
         FROM room_participants rp
         JOIN users u ON u.id = rp.user_id
         LEFT JOIN user_profiles up ON up.user_id = u.id
         WHERE rp.room_id = $1
         ORDER BY rp.joined_at ASC`,
        [roomId]
      );
      return res.rows.map((r) => ({
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
    }

    return this.inMemoryDb.participants
      .filter((p) => p.roomId === roomId)
      .map((p) => {
        const user = this.inMemoryDb.users.find((u) => u.id === p.userId);
        const profile = this.inMemoryDb.profiles.find((pr) => pr.userId === p.userId);
        return {
          ...p,
          user: user
            ? {
                id: user.id,
                username: user.username,
                avatarUrl: profile?.avatarUrl || null,
              }
            : undefined,
        };
      });
  }

  public async updateParticipantRole(
    roomId: string,
    userId: string,
    role: RoomRole
  ): Promise<RoomParticipant> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `UPDATE room_participants SET role = $1 WHERE room_id = $2 AND user_id = $3`,
        [role, roomId, userId]
      );
    } else {
      const idx = this.inMemoryDb.participants.findIndex((p) => p.roomId === roomId && p.userId === userId);
      if (idx !== -1) {
        this.inMemoryDb.participants[idx].role = role;
        this.storage.persist(this.inMemoryDb);
      }
    }
    const updated = await this.findParticipant(roomId, userId);
    return updated!;
  }
}
