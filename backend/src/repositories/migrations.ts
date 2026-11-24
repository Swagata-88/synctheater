import { Pool } from 'pg';
import { config } from '../config';

export async function runPostgresMigrations(pool: Pool): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      email_verified BOOLEAN DEFAULT FALSE,
      verification_token VARCHAR(255),
      reset_token VARCHAR(255),
      reset_token_expiry TIMESTAMPTZ,
      role VARCHAR(20) DEFAULT 'USER',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      avatar_url TEXT,
      bio TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      theme VARCHAR(20) DEFAULT 'dark',
      accent_color VARCHAR(30) DEFAULT '#E50914',
      theater_setting VARCHAR(30) DEFAULT 'classic',
      audio_volume NUMERIC DEFAULT 0.8,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id VARCHAR(64) PRIMARY KEY,
      slug VARCHAR(120) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      privacy VARCHAR(20) DEFAULT 'PRIVATE',
      password_hash VARCHAR(255),
      max_capacity INT DEFAULT 20,
      owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      current_video_id VARCHAR(255),
      current_video_url TEXT,
      current_provider VARCHAR(50) DEFAULT 'YOUTUBE',
      is_emergency_paused BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS room_participants (
      id VARCHAR(64) PRIMARY KEY,
      room_id VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) DEFAULT 'PARTICIPANT',
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(room_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS room_invitations (
      id VARCHAR(64) PRIMARY KEY,
      room_id VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      created_by VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ,
      max_uses INT,
      uses_count INT DEFAULT 0,
      is_revoked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id VARCHAR(64) PRIMARY KEY,
      room_id VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username VARCHAR(100) NOT NULL,
      avatar_url TEXT,
      content TEXT NOT NULL,
      is_system BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS room_events (
      id VARCHAR(64) PRIMARY KEY,
      room_id VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      event_type VARCHAR(50) NOT NULL,
      payload JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS video_sources (
      id VARCHAR(64) PRIMARY KEY,
      room_id VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      provider VARCHAR(50) NOT NULL,
      external_id VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      duration INT,
      added_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Phase 15: Room Lifecycle & Persistent Watch History
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS active_session_id VARCHAR(64);

    -- Persistent Watch Party Sessions (Independent of operational room deletion)
    CREATE TABLE IF NOT EXISTS room_sessions (
      id VARCHAR(64) PRIMARY KEY,
      room_id VARCHAR(64) NOT NULL,
      room_slug VARCHAR(120) NOT NULL,
      room_name VARCHAR(100) NOT NULL,
      original_host_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      original_host_username VARCHAR(100) NOT NULL,
      final_host_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      final_host_username VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      total_duration_seconds INT DEFAULT 0,
      status VARCHAR(20) DEFAULT 'ACTIVE',
      closure_reason VARCHAR(50)
    );

    -- Participant Attendance Intervals (Tracks multiple join/leave cycles per participant)
    CREATE TABLE IF NOT EXISTS participant_attendance (
      id VARCHAR(64) PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL REFERENCES room_sessions(id) ON DELETE CASCADE,
      user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      display_name VARCHAR(100) NOT NULL,
      joined_at TIMESTAMPTZ NOT NULL,
      left_at TIMESTAMPTZ,
      duration_seconds INT DEFAULT 0,
      is_original_host BOOLEAN DEFAULT FALSE,
      became_host BOOLEAN DEFAULT FALSE
    );

    -- Host Transfer Audit History
    CREATE TABLE IF NOT EXISTS host_transfer_history (
      id VARCHAR(64) PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL REFERENCES room_sessions(id) ON DELETE CASCADE,
      previous_host_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      previous_host_username VARCHAR(100) NOT NULL,
      new_host_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      new_host_username VARCHAR(100) NOT NULL,
      transferred_at TIMESTAMPTZ DEFAULT NOW(),
      reason VARCHAR(100) DEFAULT 'VOLUNTARY_TRANSFER',
      transfer_type VARCHAR(30) DEFAULT 'VOLUNTARY'
    );

    -- Production Performance & Query Optimization Indexes
    CREATE INDEX IF NOT EXISTS idx_rooms_slug ON rooms(slug);
    CREATE INDEX IF NOT EXISTS idx_rooms_owner_id ON rooms(owner_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
    CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON room_participants(room_id);
    CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
    CREATE INDEX IF NOT EXISTS idx_room_invitations_token ON room_invitations(token);
    CREATE INDEX IF NOT EXISTS idx_room_invitations_room_id ON room_invitations(room_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

    -- History Performance & Partial Unique Constraints
    CREATE INDEX IF NOT EXISTS idx_room_sessions_slug ON room_sessions(room_slug);
    CREATE INDEX IF NOT EXISTS idx_room_sessions_host ON room_sessions(original_host_id, final_host_id);
    CREATE INDEX IF NOT EXISTS idx_room_sessions_status ON room_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_participant_attendance_user ON participant_attendance(user_id, session_id);
    CREATE INDEX IF NOT EXISTS idx_participant_attendance_session ON participant_attendance(session_id);
    CREATE INDEX IF NOT EXISTS idx_host_transfers_session ON host_transfer_history(session_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_open_attendance ON participant_attendance(session_id, user_id) WHERE left_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_open_attendance_guest ON participant_attendance(session_id, display_name) WHERE user_id IS NULL AND left_at IS NULL;

    -- Migration Backfill for pre-existing active rooms without an activeSessionId
    DO $$
    DECLARE
      r RECORD;
      sess_id VARCHAR(64);
      host_uname VARCHAR(100);
    BEGIN
      FOR r IN SELECT id, slug, name, owner_id, created_at FROM rooms WHERE active_session_id IS NULL AND (status IS NULL OR status = 'ACTIVE') LOOP
        sess_id := 'sess_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24);
        SELECT username INTO host_uname FROM users WHERE id = r.owner_id;
        IF host_uname IS NULL THEN
          host_uname := 'Host';
        END IF;

        INSERT INTO room_sessions (id, room_id, room_slug, room_name, original_host_id, original_host_username, final_host_id, final_host_username, created_at, started_at, status)
        VALUES (sess_id, r.id, r.slug, r.name, r.owner_id, host_uname, r.owner_id, host_uname, r.created_at, r.created_at, 'ACTIVE')
        ON CONFLICT (id) DO NOTHING;

        UPDATE rooms SET active_session_id = sess_id, status = 'ACTIVE' WHERE id = r.id;

        INSERT INTO participant_attendance (id, session_id, user_id, display_name, joined_at, is_original_host, became_host)
        SELECT 'att_' || substr(md5(random()::text || clock_timestamp()::text || rp.user_id), 1, 24),
               sess_id,
               rp.user_id,
               COALESCE(u.username, 'Participant'),
               rp.joined_at,
               (rp.user_id = r.owner_id),
               (rp.role = 'OWNER' AND rp.user_id <> r.owner_id)
        FROM room_participants rp
        LEFT JOIN users u ON u.id = rp.user_id
        WHERE rp.room_id = r.id
        ON CONFLICT DO NOTHING;
      END LOOP;
    END $$;
  `;

  try {
    await pool.query(ddl);
    console.log('[Database] PostgreSQL migrations and performance indexes applied successfully.');
  } catch (err: any) {
    console.error('[Database] Failed to execute PostgreSQL migrations:', err);
    if (config.env === 'production') {
      throw new Error(`[Database Exception] Fatal schema migration failure in production: ${err.message}`);
    }
  }
}
