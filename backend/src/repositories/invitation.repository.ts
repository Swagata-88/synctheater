import { Pool } from 'pg';
import { RoomInvitation } from '../database/types';
import { InMemoryDbState } from './types';
import { FallbackStorage } from './fallback.storage';

export class InvitationRepository {
  constructor(
    private getPool: () => Pool | null,
    private isConnected: () => boolean,
    private inMemoryDb: InMemoryDbState,
    private storage: FallbackStorage
  ) {}

  public async createInvitation(data: {
    roomId: string;
    token: string;
    createdBy: string;
    expiresAt?: Date | null;
    maxUses?: number | null;
  }): Promise<RoomInvitation> {
    const invitation: RoomInvitation = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      roomId: data.roomId,
      token: data.token,
      createdBy: data.createdBy,
      expiresAt: data.expiresAt || null,
      maxUses: data.maxUses ?? null,
      usesCount: 0,
      isRevoked: false,
      createdAt: new Date(),
    };

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `INSERT INTO room_invitations (id, room_id, token, created_by, expires_at, max_uses, uses_count, is_revoked, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          invitation.id,
          invitation.roomId,
          invitation.token,
          invitation.createdBy,
          invitation.expiresAt,
          invitation.maxUses,
          invitation.usesCount,
          invitation.isRevoked,
          invitation.createdAt,
        ]
      );
    } else {
      const existingIdx = this.inMemoryDb.invitations.findIndex((i) => i.token === invitation.token);
      if (existingIdx !== -1) {
        this.inMemoryDb.invitations[existingIdx] = invitation;
      } else {
        this.inMemoryDb.invitations.push(invitation);
      }
      this.storage.persist(this.inMemoryDb);
    }

    return invitation;
  }

  public async findInvitationByToken(token: string): Promise<RoomInvitation | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `SELECT * FROM room_invitations WHERE token = $1 LIMIT 1`,
        [token]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        roomId: r.room_id,
        token: r.token,
        createdBy: r.created_by,
        expiresAt: r.expires_at,
        maxUses: r.max_uses,
        usesCount: r.uses_count,
        isRevoked: r.is_revoked,
        createdAt: r.created_at,
      };
    }
    return this.inMemoryDb.invitations.find((inv) => inv.token === token) || null;
  }

  public async listInvitationsForRoom(roomId: string): Promise<RoomInvitation[]> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `SELECT * FROM room_invitations WHERE room_id = $1 ORDER BY created_at DESC`,
        [roomId]
      );
      return res.rows.map((r) => ({
        id: r.id,
        roomId: r.room_id,
        token: r.token,
        createdBy: r.created_by,
        expiresAt: r.expires_at,
        maxUses: r.max_uses,
        usesCount: r.uses_count,
        isRevoked: r.is_revoked,
        createdAt: r.created_at,
      }));
    }
    return this.inMemoryDb.invitations.filter((i) => i.roomId === roomId);
  }

  public async revokeInvitation(token: string): Promise<boolean> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `UPDATE room_invitations SET is_revoked = TRUE WHERE token = $1`,
        [token]
      );
      return (res.rowCount ?? 0) > 0;
    }
    const idx = this.inMemoryDb.invitations.findIndex((i) => i.token === token);
    if (idx !== -1) {
      this.inMemoryDb.invitations[idx].isRevoked = true;
      this.storage.persist(this.inMemoryDb);
      return true;
    }
    return false;
  }

  public async revokeAllInvitationsForRoom(roomId: string): Promise<number> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `UPDATE room_invitations SET is_revoked = TRUE WHERE room_id = $1 AND is_revoked = FALSE`,
        [roomId]
      );
      return res.rowCount ?? 0;
    }

    let count = 0;
    for (const inv of this.inMemoryDb.invitations) {
      if (inv.roomId === roomId && !inv.isRevoked) {
        inv.isRevoked = true;
        count++;
      }
    }
    if (count > 0) {
      this.storage.persist(this.inMemoryDb);
    }
    return count;
  }

  public async incrementInvitationUse(token: string): Promise<boolean> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `UPDATE room_invitations 
         SET uses_count = uses_count + 1 
         WHERE token = $1 
           AND is_revoked = FALSE 
           AND (expires_at IS NULL OR expires_at > NOW())
           AND (max_uses IS NULL OR uses_count < max_uses)
         RETURNING uses_count`,
        [token]
      );
      return (res.rowCount ?? 0) > 0;
    }

    const idx = this.inMemoryDb.invitations.findIndex((i) => i.token === token);
    if (idx !== -1) {
      const inv = this.inMemoryDb.invitations[idx];
      if (inv.isRevoked) return false;
      if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) return false;
      if (inv.maxUses && inv.usesCount >= inv.maxUses) return false;

      this.inMemoryDb.invitations[idx].usesCount += 1;
      this.storage.persist(this.inMemoryDb);
      return true;
    }
    return false;
  }
}
