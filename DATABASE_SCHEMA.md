# SYNCTHEATER — Database Schema & Persistence Architecture

SYNCTHEATER operates on a dual-tier persistence model:
1. **Production Tier**: Managed PostgreSQL 14+ with native SQL migrations, foreign key constraints, and 10 performance B-tree indexes (`backend/src/repositories/migrations.ts`).
2. **Development Tier**: Persistent in-memory JSON storage (`backend/src/repositories/fallback.storage.ts`) for local offline development when PostgreSQL is not configured.

---

## 1. Relational Database Tables (PostgreSQL DDL)

### Users (`users`)
Stores core identity and authentication state. Passwords are encrypted with `bcrypt` (10 rounds).
```sql
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
```

### User Profiles (`user_profiles`)
Stores public avatar URLs and biography.
```sql
CREATE TABLE IF NOT EXISTS user_profiles (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### User Preferences (`user_preferences`)
Stores client-side theater ambiance themes and volume presets.
```sql
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
```

### Watch Rooms (`rooms`)
All rooms on SYNCTHEATER are strictly **private** and invite-only (`privacy = 'PRIVATE'`).
```sql
CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(120) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  privacy VARCHAR(20) DEFAULT 'PRIVATE',
  password_hash VARCHAR(255),
  max_capacity INT DEFAULT 25,
  owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_video_id VARCHAR(255),
  current_video_url TEXT,
  current_provider VARCHAR(50) DEFAULT 'YOUTUBE',
  is_emergency_paused BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Room Participants (`room_participants`)
Tracks room memberships and moderation roles (`OWNER`, `MODERATOR`, `PARTICIPANT`).
```sql
CREATE TABLE IF NOT EXISTS room_participants (
  id VARCHAR(64) PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'PARTICIPANT',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_room_user UNIQUE(room_id, user_id)
);
```

### Room Invitations (`room_invitations`)
Cryptographically secure tokens generated via `crypto.randomBytes(24).toString('base64url')`. Supports atomic increment operations for use limits.
```sql
CREATE TABLE IF NOT EXISTS room_invitations (
  id VARCHAR(64) PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  max_uses INT,
  uses_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Chat Messages (`chat_messages`)
Stores persistent text messages and automated system announcements.
```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(64) PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL,
  username VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  content TEXT NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Room Events (`room_events`)
Records audit logs of playback events, emergency pauses, and membership transitions.
```sql
CREATE TABLE IF NOT EXISTS room_events (
  id VARCHAR(64) PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id VARCHAR(64),
  event_type VARCHAR(50) NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. PostgreSQL Performance B-Tree Indexes

The migration engine automatically verifies and applies 10 performance B-tree indexes on backend startup:

```sql
CREATE INDEX IF NOT EXISTS idx_rooms_slug ON rooms(slug);
CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms(owner_id);
CREATE INDEX IF NOT EXISTS idx_participants_room ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON room_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_room ON room_invitations(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_created ON chat_messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_room_created ON room_events(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
```

---

## 3. Ephemeral Real-Time Playback State (Memory / Redis)

High-frequency video playback heartbeats, monotonic sequence numbers, and active drift calculations are maintained in RAM (`backend/src/realtime/state.manager.ts`), decoupling media playback coordination from database I/O:

```typescript
interface RoomPlaybackState {
  roomId: string;
  provider: 'YOUTUBE' | 'DIRECT' | 'HLS' | 'GOOGLE_DRIVE' | 'UNSUPPORTED';
  videoId: string;
  videoUrl: string;
  status: 'PLAYING' | 'PAUSED' | 'BUFFERING';
  currentPosition: number;        // Current playback head position in seconds
  playbackRate: number;           // 0.5 to 2.0x
  lastServerTimestamp: number;    // UTC epoch timestamp in milliseconds
  sequenceNumber: number;         // Monotonically increasing sequence tracker
  isEmergencyPaused: boolean;     // Emergency pause lock
  emergencyPausedBy?: {
    userId: string;
    username: string;
  };
}
```
