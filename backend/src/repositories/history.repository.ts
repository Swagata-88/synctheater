import { Pool } from 'pg';
import {
  RoomSession,
  ParticipantAttendance,
  HostTransferHistory,
  SessionStatus,
  ClosureReason,
  TransferType,
} from '../database/types';
import { InMemoryDbState } from './types';
import { FallbackStorage } from './fallback.storage';

export interface UserHistoryItem extends RoomSession {
  userRole: 'ORIGINAL_HOST' | 'SUCCESSOR_HOST' | 'PARTICIPANT';
  userParticipationDuration: number;
  participantCount: number;
}

export class HistoryRepository {
  constructor(
    private getPool: () => Pool | null,
    private isConnected: () => boolean,
    private inMemoryDb: InMemoryDbState,
    private storage: FallbackStorage
  ) {}

  /**
   * Creates a new historical watch-party session entity.
   * Note: startedAt is initialized as null until the first participant successfully connects.
   */
  public async createSession(data: {
    roomId: string;
    roomSlug: string;
    roomName: string;
    originalHostId: string;
    originalHostUsername: string;
    createdAt?: Date;
  }): Promise<RoomSession> {
    const id = 'sess_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const createdAt = data.createdAt || new Date();

    const session: RoomSession = {
      id,
      roomId: data.roomId,
      roomSlug: data.roomSlug,
      roomName: data.roomName,
      originalHostId: data.originalHostId,
      originalHostUsername: data.originalHostUsername,
      finalHostId: data.originalHostId,
      finalHostUsername: data.originalHostUsername,
      createdAt,
      startedAt: null,
      endedAt: null,
      totalDurationSeconds: 0,
      status: 'ACTIVE',
      closureReason: null,
    };

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `INSERT INTO room_sessions (
          id, room_id, room_slug, room_name,
          original_host_id, original_host_username,
          final_host_id, final_host_username,
          created_at, started_at, ended_at,
          total_duration_seconds, status, closure_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          session.id,
          session.roomId,
          session.roomSlug,
          session.roomName,
          session.originalHostId,
          session.originalHostUsername,
          session.finalHostId,
          session.finalHostUsername,
          session.createdAt,
          session.startedAt,
          session.endedAt,
          session.totalDurationSeconds,
          session.status,
          session.closureReason,
        ]
      );
    } else {
      this.inMemoryDb.sessions.push(session);
      this.storage.persist(this.inMemoryDb);
    }

    return session;
  }

  /**
   * Sets the session's actual start timestamp when the first participant joins.
   * Idempotent: once set, does not overwrite the start time.
   */
  public async recordSessionStart(sessionId: string, startedAt = new Date()): Promise<void> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      await pool.query(
        `UPDATE room_sessions 
         SET started_at = $1 
         WHERE id = $2 AND started_at IS NULL`,
        [startedAt, sessionId]
      );
      return;
    }

    const sess = this.inMemoryDb.sessions.find((s) => s.id === sessionId);
    if (sess && !sess.startedAt) {
      sess.startedAt = startedAt;
      this.storage.persist(this.inMemoryDb);
    }
  }

  /**
   * Records a participant joining the watch session.
   * If the participant already has an open attendance interval (e.g. rapid socket reconnect),
   * returns the existing interval without creating duplicate entries.
   */
  public async recordAttendanceJoin(data: {
    sessionId: string;
    userId: string | null;
    displayName: string;
    isOriginalHost: boolean;
    becameHost?: boolean;
    joinedAt?: Date;
  }): Promise<ParticipantAttendance> {
    const joinedAt = data.joinedAt || new Date();
    const pool = this.getPool();

    if (this.isConnected() && pool) {
      // Check for existing open interval (handles both registered user and guest by display name)
      const existingRes = await pool.query(
        `SELECT * FROM participant_attendance 
         WHERE session_id = $1 
           AND (($2::varchar IS NOT NULL AND user_id = $2) OR ($2::varchar IS NULL AND user_id IS NULL AND display_name = $3))
           AND left_at IS NULL 
         LIMIT 1`,
        [data.sessionId, data.userId, data.displayName]
      );

      if (existingRes.rows.length > 0) {
        return this.mapAttendanceRow(existingRes.rows[0]);
      }

      const id = 'att_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      const insertRes = await pool.query(
        `INSERT INTO participant_attendance (
          id, session_id, user_id, display_name,
          joined_at, left_at, duration_seconds,
          is_original_host, became_host
        ) VALUES ($1, $2, $3, $4, $5, NULL, 0, $6, $7)
        RETURNING *`,
        [
          id,
          data.sessionId,
          data.userId,
          data.displayName,
          joinedAt,
          data.isOriginalHost,
          data.becameHost || false,
        ]
      );

      // Automatically trigger session start time if this is the first join
      await this.recordSessionStart(data.sessionId, joinedAt);

      return this.mapAttendanceRow(insertRes.rows[0]);
    }

    // In-memory fallback
    const existing = this.inMemoryDb.attendance.find(
      (a) =>
        a.sessionId === data.sessionId &&
        (data.userId ? a.userId === data.userId : a.userId === null && a.displayName === data.displayName) &&
        a.leftAt === null
    );
    if (existing) {
      return existing;
    }

    const attendance: ParticipantAttendance = {
      id: 'att_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36),
      sessionId: data.sessionId,
      userId: data.userId,
      displayName: data.displayName,
      joinedAt,
      leftAt: null,
      durationSeconds: 0,
      isOriginalHost: data.isOriginalHost,
      becameHost: data.becameHost || false,
    };

    this.inMemoryDb.attendance.push(attendance);
    await this.recordSessionStart(data.sessionId, joinedAt);
    this.storage.persist(this.inMemoryDb);
    return attendance;
  }

  /**
   * Finalizes the current open attendance interval for a departing participant.
   * Calculates the exact attendance duration in seconds.
   * Idempotent: repeated calls safely return null if the interval is already closed.
   */
  public async recordAttendanceLeave(
    sessionId: string,
    userIdOrDisplayName: string,
    leftAt = new Date()
  ): Promise<ParticipantAttendance | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `UPDATE participant_attendance 
         SET left_at = $1,
             duration_seconds = GREATEST(0, ROUND(EXTRACT(EPOCH FROM ($1 - joined_at))))
         WHERE session_id = $2 
           AND (user_id = $3 OR (user_id IS NULL AND display_name = $3))
           AND left_at IS NULL
         RETURNING *`,
        [leftAt, sessionId, userIdOrDisplayName]
      );

      if (res.rows.length === 0) return null;
      return this.mapAttendanceRow(res.rows[0]);
    }

    const openIdx = this.inMemoryDb.attendance.findIndex(
      (a) =>
        a.sessionId === sessionId &&
        (a.userId === userIdOrDisplayName || (a.userId === null && a.displayName === userIdOrDisplayName)) &&
        a.leftAt === null
    );
    if (openIdx === -1) return null;

    const record = this.inMemoryDb.attendance[openIdx];
    record.leftAt = leftAt;
    const duration = Math.max(0, Math.floor((leftAt.getTime() - new Date(record.joinedAt).getTime()) / 1000));
    record.durationSeconds = duration;
    this.storage.persist(this.inMemoryDb);
    return record;
  }

  /**
   * Records a host ownership transfer in the historical session audit trail.
   * Atomically marks the new host's attendance record with `became_host = true`
   * and updates finalHostId in the session.
   */
  public async recordHostTransfer(data: {
    sessionId: string;
    previousHostId: string;
    previousHostUsername: string;
    newHostId: string;
    newHostUsername: string;
    reason?: string;
    transferType?: TransferType;
    transferredAt?: Date;
  }): Promise<HostTransferHistory> {
    const id = 'ht_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const transferredAt = data.transferredAt || new Date();
    const reason = data.reason || 'VOLUNTARY_TRANSFER';
    const transferType = data.transferType || 'VOLUNTARY';

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Insert transfer record
        const insertRes = await client.query(
          `INSERT INTO host_transfer_history (
            id, session_id, previous_host_id, previous_host_username,
            new_host_id, new_host_username, transferred_at, reason, transfer_type
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *`,
          [
            id,
            data.sessionId,
            data.previousHostId,
            data.previousHostUsername,
            data.newHostId,
            data.newHostUsername,
            transferredAt,
            reason,
            transferType,
          ]
        );

        // Update final host on session
        await client.query(
          `UPDATE room_sessions 
           SET final_host_id = $1, final_host_username = $2 
           WHERE id = $3`,
          [data.newHostId, data.newHostUsername, data.sessionId]
        );

        // Mark became_host on successor's attendance
        await client.query(
          `UPDATE participant_attendance 
           SET became_host = TRUE 
           WHERE session_id = $1 AND user_id = $2`,
          [data.sessionId, data.newHostId]
        );

        await client.query('COMMIT');
        return this.mapTransferRow(insertRes.rows[0]);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const transfer: HostTransferHistory = {
      id,
      sessionId: data.sessionId,
      previousHostId: data.previousHostId,
      previousHostUsername: data.previousHostUsername,
      newHostId: data.newHostId,
      newHostUsername: data.newHostUsername,
      transferredAt,
      reason,
      transferType,
    };

    this.inMemoryDb.hostTransfers.push(transfer);

    const sess = this.inMemoryDb.sessions.find((s) => s.id === data.sessionId);
    if (sess) {
      sess.finalHostId = data.newHostId;
      sess.finalHostUsername = data.newHostUsername;
    }

    const atts = this.inMemoryDb.attendance.filter(
      (a) => a.sessionId === data.sessionId && a.userId === data.newHostId
    );
    for (const a of atts) {
      a.becameHost = true;
    }

    this.storage.persist(this.inMemoryDb);
    return transfer;
  }

  /**
   * Formally closes a room session:
   * 1. Marks session as CLOSED with ended_at timestamp.
   * 2. Computes total session duration from started_at to ended_at.
   * 3. Closes all remaining open participant attendance intervals.
   */
  public async finalizeSession(
    sessionId: string,
    reason: ClosureReason = 'HOST_ENDED',
    endedAt = new Date()
  ): Promise<RoomSession | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Lock the session row using SELECT ... FOR UPDATE
        const sessionRes = await client.query(
          `SELECT * FROM room_sessions WHERE id = $1 FOR UPDATE`,
          [sessionId]
        );
        if (sessionRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return null;
        }

        const existingRow = sessionRes.rows[0];
        let finalizedRow = existingRow;

        if (existingRow.status !== 'CLOSED' && existingRow.ended_at === null) {
          // Conditional update: only update if status != 'CLOSED' or ended_at IS NULL
          const updateRes = await client.query(
            `UPDATE room_sessions 
             SET status = 'CLOSED',
                 ended_at = $1,
                 closure_reason = $2,
                 total_duration_seconds = CASE 
                   WHEN started_at IS NOT NULL THEN GREATEST(0, ROUND(EXTRACT(EPOCH FROM ($1 - started_at))))
                   ELSE 0
                 END
             WHERE id = $3 AND (status != 'CLOSED' OR ended_at IS NULL)
             RETURNING *`,
            [endedAt, reason, sessionId]
          );

          if (updateRes.rows.length > 0) {
            finalizedRow = updateRes.rows[0];
          }

          // Close all open attendance intervals using this exact endedAt timestamp
          await client.query(
            `UPDATE participant_attendance 
             SET left_at = $1,
                 duration_seconds = GREATEST(0, ROUND(EXTRACT(EPOCH FROM ($1 - joined_at))))
             WHERE session_id = $2 AND left_at IS NULL`,
            [endedAt, sessionId]
          );
        } else {
          // Idempotent: session was ALREADY finalized!
          // Preserve the original ended_at, closure_reason, and total_duration_seconds.
          // Still ensure any lingering open attendance intervals are closed using original ended_at.
          const originalEndedAt = existingRow.ended_at || endedAt;
          await client.query(
            `UPDATE participant_attendance 
             SET left_at = $1,
                 duration_seconds = GREATEST(0, ROUND(EXTRACT(EPOCH FROM ($1 - joined_at))))
             WHERE session_id = $2 AND left_at IS NULL`,
            [originalEndedAt, sessionId]
          );
        }

        await client.query('COMMIT');
        return this.mapSessionRow(finalizedRow);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const sess = this.inMemoryDb.sessions.find((s) => s.id === sessionId);
    if (!sess) return null;

    if (sess.status === 'CLOSED' && sess.endedAt !== null) {
      // Idempotent: already closed. Preserve original endedAt, closureReason, and totalDurationSeconds!
      const originalEndedAt = sess.endedAt;
      for (const a of this.inMemoryDb.attendance) {
        if (a.sessionId === sessionId && a.leftAt === null) {
          a.leftAt = originalEndedAt;
          a.durationSeconds = Math.max(
            0,
            Math.floor((new Date(originalEndedAt).getTime() - new Date(a.joinedAt).getTime()) / 1000)
          );
        }
      }
      this.storage.persist(this.inMemoryDb);
      return sess;
    }

    sess.status = 'CLOSED';
    sess.endedAt = endedAt;
    sess.closureReason = reason;

    if (sess.startedAt) {
      sess.totalDurationSeconds = Math.max(
        0,
        Math.floor((endedAt.getTime() - new Date(sess.startedAt).getTime()) / 1000)
      );
    } else {
      sess.totalDurationSeconds = 0;
    }

    // Close open attendance intervals
    for (const a of this.inMemoryDb.attendance) {
      if (a.sessionId === sessionId && a.leftAt === null) {
        a.leftAt = endedAt;
        a.durationSeconds = Math.max(
          0,
          Math.floor((endedAt.getTime() - new Date(a.joinedAt).getTime()) / 1000)
        );
      }
    }

    this.storage.persist(this.inMemoryDb);
    return sess;
  }

  /**
   * Retrieves paginated personal watch history for a user.
   * Matches sessions the user created, hosted, or joined as a viewer.
   */
  public async listUserWatchHistory(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ sessions: UserHistoryItem[]; total: number }> {
    const limit = Math.min(Math.max(options.limit || 20, 1), 100);
    const offset = Math.max(options.offset || 0, 0);

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const countRes = await pool.query(
        `SELECT COUNT(DISTINCT s.id)::int as total
         FROM room_sessions s
         LEFT JOIN participant_attendance pa ON pa.session_id = s.id
         WHERE s.original_host_id = $1 
            OR s.final_host_id = $1 
            OR pa.user_id = $1`,
        [userId]
      );
      const total = countRes.rows[0]?.total || 0;

      const itemsRes = await pool.query(
        `SELECT s.*,
                COALESCE(SUM(pa_user.duration_seconds), 0)::int as user_participation_duration,
                COUNT(DISTINCT pa_all.user_id)::int as participant_count,
                CASE 
                  WHEN s.original_host_id = $1 THEN 'ORIGINAL_HOST'
                  WHEN s.final_host_id = $1 THEN 'SUCCESSOR_HOST'
                  ELSE 'PARTICIPANT'
                END as user_role
         FROM room_sessions s
         LEFT JOIN participant_attendance pa_user ON pa_user.session_id = s.id AND pa_user.user_id = $1
         LEFT JOIN participant_attendance pa_all ON pa_all.session_id = s.id
         WHERE s.original_host_id = $1 
            OR s.final_host_id = $1 
            OR s.id IN (SELECT session_id FROM participant_attendance WHERE user_id = $1)
         GROUP BY s.id
         ORDER BY s.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const sessions: UserHistoryItem[] = itemsRes.rows.map((row) => ({
        ...this.mapSessionRow(row),
        userRole: row.user_role as any,
        userParticipationDuration: row.user_participation_duration || 0,
        participantCount: Math.max(row.participant_count || 1, 1),
      }));

      return { sessions, total };
    }

    // In-memory fallback
    const matchedSessionIds = new Set<string>();
    for (const s of this.inMemoryDb.sessions) {
      if (s.originalHostId === userId || s.finalHostId === userId) {
        matchedSessionIds.add(s.id);
      }
    }
    for (const a of this.inMemoryDb.attendance) {
      if (a.userId === userId) {
        matchedSessionIds.add(a.sessionId);
      }
    }

    const matchedSessions = this.inMemoryDb.sessions.filter((s) => matchedSessionIds.has(s.id));
    matchedSessions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = matchedSessions.length;
    const paged = matchedSessions.slice(offset, offset + limit);

    const sessions: UserHistoryItem[] = paged.map((s) => {
      let userRole: 'ORIGINAL_HOST' | 'SUCCESSOR_HOST' | 'PARTICIPANT' = 'PARTICIPANT';
      if (s.originalHostId === userId) {
        userRole = 'ORIGINAL_HOST';
      } else if (s.finalHostId === userId) {
        userRole = 'SUCCESSOR_HOST';
      }

      const userAtts = this.inMemoryDb.attendance.filter(
        (a) => a.sessionId === s.id && a.userId === userId
      );
      const userParticipationDuration = userAtts.reduce(
        (sum, a) => sum + (a.durationSeconds || 0),
        0
      );

      const uniqueAttendees = new Set(
        this.inMemoryDb.attendance.filter((a) => a.sessionId === s.id).map((a) => a.userId)
      );
      if (s.originalHostId) uniqueAttendees.add(s.originalHostId);

      return {
        ...s,
        userRole,
        userParticipationDuration,
        participantCount: Math.max(uniqueAttendees.size, 1),
      };
    });

    return { sessions, total };
  }

  /**
   * Retrieves full historical session details with authorization verification.
   * Strictly enforces that the requesting user actually participated in or hosted the session.
   */
  public async getSessionDetails(
    sessionId: string,
    userId: string
  ): Promise<{
    session: RoomSession;
    attendance: ParticipantAttendance[];
    transfers: HostTransferHistory[];
  } | null> {
    const session = await this.findSessionById(sessionId);
    if (!session) return null;

    const pool = this.getPool();
    if (this.isConnected() && pool) {
      // Authorization check
      const authRes = await pool.query(
        `SELECT 1 FROM participant_attendance 
         WHERE session_id = $1 AND user_id = $2 
         LIMIT 1`,
        [sessionId, userId]
      );

      const isHost = session.originalHostId === userId || session.finalHostId === userId;
      const isParticipant = authRes.rows.length > 0;

      if (!isHost && !isParticipant) {
        return null; // Unauthorized
      }

      const [attendanceRes, transfersRes] = await Promise.all([
        pool.query(
          `SELECT * FROM participant_attendance 
           WHERE session_id = $1 
           ORDER BY joined_at ASC`,
          [sessionId]
        ),
        pool.query(
          `SELECT * FROM host_transfer_history 
           WHERE session_id = $1 
           ORDER BY transferred_at ASC`,
          [sessionId]
        ),
      ]);

      return {
        session,
        attendance: attendanceRes.rows.map(this.mapAttendanceRow),
        transfers: transfersRes.rows.map(this.mapTransferRow),
      };
    }

    const isHost = session.originalHostId === userId || session.finalHostId === userId;
    const isParticipant = this.inMemoryDb.attendance.some(
      (a) => a.sessionId === sessionId && a.userId === userId
    );

    if (!isHost && !isParticipant) {
      return null;
    }

    const attendance = this.inMemoryDb.attendance
      .filter((a) => a.sessionId === sessionId)
      .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

    const transfers = this.inMemoryDb.hostTransfers
      .filter((t) => t.sessionId === sessionId)
      .sort((a, b) => new Date(a.transferredAt).getTime() - new Date(b.transferredAt).getTime());

    return { session, attendance, transfers };
  }

  public async findSessionById(id: string): Promise<RoomSession | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(`SELECT * FROM room_sessions WHERE id = $1 LIMIT 1`, [id]);
      if (res.rows.length === 0) return null;
      return this.mapSessionRow(res.rows[0]);
    }
    return this.inMemoryDb.sessions.find((s) => s.id === id) || null;
  }

  public async findActiveSessionByRoomSlug(slug: string): Promise<RoomSession | null> {
    const pool = this.getPool();
    if (this.isConnected() && pool) {
      const res = await pool.query(
        `SELECT * FROM room_sessions 
         WHERE room_slug = $1 AND status = 'ACTIVE' 
         ORDER BY created_at DESC LIMIT 1`,
        [slug]
      );
      if (res.rows.length === 0) return null;
      return this.mapSessionRow(res.rows[0]);
    }
    return (
      this.inMemoryDb.sessions
        .filter((s) => s.roomSlug === slug && s.status === 'ACTIVE')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ||
      null
    );
  }

  public mapSessionRow(r: any): RoomSession {
    return {
      id: r.id,
      roomId: r.room_id,
      roomSlug: r.room_slug,
      roomName: r.room_name,
      originalHostId: r.original_host_id,
      originalHostUsername: r.original_host_username,
      finalHostId: r.final_host_id,
      finalHostUsername: r.final_host_username,
      createdAt: r.created_at,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      totalDurationSeconds: r.total_duration_seconds || 0,
      status: r.status as SessionStatus,
      closureReason: r.closure_reason as ClosureReason,
    };
  }

  public mapAttendanceRow(r: any): ParticipantAttendance {
    return {
      id: r.id,
      sessionId: r.session_id,
      userId: r.user_id,
      displayName: r.display_name,
      joinedAt: r.joined_at,
      leftAt: r.left_at,
      durationSeconds: r.duration_seconds || 0,
      isOriginalHost: r.is_original_host,
      becameHost: r.became_host,
    };
  }

  public mapTransferRow(r: any): HostTransferHistory {
    return {
      id: r.id,
      sessionId: r.session_id,
      previousHostId: r.previous_host_id,
      previousHostUsername: r.previous_host_username,
      newHostId: r.new_host_id,
      newHostUsername: r.new_host_username,
      transferredAt: r.transferred_at,
      reason: r.reason,
      transferType: r.transfer_type as TransferType,
    };
  }
}
