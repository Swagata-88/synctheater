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

    -- Production Performance & Query Optimization Indexes
    CREATE INDEX IF NOT EXISTS idx_rooms_slug ON rooms(slug);
    CREATE INDEX IF NOT EXISTS idx_rooms_owner_id ON rooms(owner_id);
    CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON room_participants(room_id);
    CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
    CREATE INDEX IF NOT EXISTS idx_room_invitations_token ON room_invitations(token);
    CREATE INDEX IF NOT EXISTS idx_room_invitations_room_id ON room_invitations(room_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
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
