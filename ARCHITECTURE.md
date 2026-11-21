# SYNCTHEATER — System Architecture

## 1. High-Level System Overview

SYNCTHEATER is designed around a **server-authoritative distributed state model**. Video streaming bandwidth is decoupled entirely from the application server: media is pulled directly by each client from the respective provider (YouTube CDN, direct MP4/HLS host, or Google Drive), while the SYNCTHEATER backend coordinates playback events, chat messages, user state, and permissions.

```
                      +---------------------------------------+
                      |             User Browser              |
                      |  Next.js 14 / React 18 / Tailwind CSS |
                      +-------------------+-------------------+
                                          |
                        +-----------------+-----------------+
                        |                                   |
             [HTTP / REST API]                     [Socket.IO WebSockets]
             Auth, Rooms, Profiles                 Playback Sync, Chat, Alerts
                        |                                   |
                        v                                   v
          +-------------------------------------------------------+
          |             SYNCTHEATER Node.js Server                |
          |  - Authentication Controller (JWT / bcrypt)           |
          |  - Room Management Service                            |
          |  - Authorization & Permissions Guard                  |
          |  - Authoritative Playback Synchronization Engine       |
          |  - Emergency Pause Coordinator                        |
          |  - Chat & Presence Gateway                            |
          |  - LiveKit Access Token Dispatcher                    |
          |  - Video Provider Detection Service                   |
          +-------------+-----------------------------+-----------+
                        |                             |
                        v                             v
           +-----------------------+     +------------------------+
           |  PostgreSQL / SQLite  |     |   LiveKit SFU Mesh     |
           |  Domain Repositories  |     | Real-Time WebRTC Media |
           +-----------------------+     +------------------------+
```

---

## 2. Server-Authoritative Video Synchronization Engine

The central challenge in social watch parties is preventing desynchronization, packet race conditions, and playback jitter.

### Authoritative Room State
Every active room maintains an in-memory state managed by `StateManager`:

```typescript
interface RoomPlaybackState {
  roomId: string;
  provider: 'YOUTUBE' | 'DIRECT' | 'HLS' | 'GOOGLE_DRIVE' | 'UNSUPPORTED';
  videoId: string;
  videoUrl: string;
  status: 'PLAYING' | 'PAUSED' | 'BUFFERING';
  currentPosition: number;        // in seconds
  playbackRate: number;           // e.g. 1.0, 1.25, 1.5
  lastServerTimestamp: number;    // Date.now() when last updated
  sequenceNumber: number;         // Monotonically increasing event ID
  isEmergencyPaused: boolean;
  emergencyPausedBy?: {
    userId: string;
    username: string;
  };
}
```

### Calculated Playback Position (Drift Compensation)
When clients query the room state, or when the server broadcasts `SYNC_STATE`, the exact position is calculated based on elapsed time:

$$\text{effectivePosition} = \begin{cases} \text{currentPosition} + \frac{(\text{Date.now()} - \text{lastServerTimestamp})}{1000} \times \text{playbackRate} & \text{if status} = \text{PLAYING} \\ \text{currentPosition} & \text{if status} \in \{\text{PAUSED}, \text{BUFFERING}\} \end{cases}$$

### Client Smoothing & Threshold Seeking
Clients calculate the difference $\Delta = |\text{localTime} - \text{serverEffectiveTime}|$:
- If $\Delta < 1.0\text{s}$: No action taken (prevents audible stutter and video buffering loops).
- If $1.0\text{s} \le \Delta \le 3.0\text{s}$: Gradual drift correction (micro-adjust playback rate by $\pm 5\%$).
- If $\Delta > 3.0\text{s}$: Hard seek to $\text{serverEffectiveTime}$ (e.g. after user scrubbing or network lag).

---

## 3. Emergency Pause Architecture

The **Emergency Pause** button is a core safety and social feature:
1. **Universal Access**: Any participant can trigger an emergency pause, regardless of role.
2. **Instant State Transition**: The backend immediately locks `status = 'PAUSED'`, records `emergencyPausedBy = user`, and increments the `sequenceNumber`.
3. **Global Broadcast**: Server fires `EMERGENCY_PAUSE_TRIGGERED` and `SYNC_STATE` to all connected sockets in the room.
4. **Resume Restriction**: Only the Room Owner or designated Room Moderators have the authority to clear the emergency pause and resume playback.

---

## 4. Video Provider Abstraction

Each video provider implements a unified interface:

```typescript
export interface VideoProviderAdapter {
  id: string;
  name: string;
  canHandle(url: string): boolean;
  extractIdentifier(url: string): string | null;
  getEmbedUrl(identifier: string): string;
}
```

Adapters exist for:
- `YouTubeProvider`: Handles `youtube.com/watch?v=...`, `youtu.be/...`, and `youtube.com/shorts/...`.
- `DirectVideoProvider`: Handles `.mp4`, `.webm`, and direct audio/video MIME types.
- `HlsVideoProvider`: Handles HTTP Live Streaming `.m3u8` playlists using `hls.js`.
- `GoogleDriveProvider`: Detects Drive file IDs (`drive.google.com/file/d/...`) and provides compatible preview embeds.

---

## 5. Security & Permission Hierarchy

- **Room Owner**: Full privileges (update room settings, transfer ownership, delete room, kick participants, change video, play/pause/seek).
- **Room Moderator**: Video control, emergency pause clearance, participant moderation.
- **Participant**: View video, participate in chat, emergency pause, voice/video streaming.
- **Zero Client Trust**: All mutations (`PLAY`, `PAUSE`, `SEEK`, `VIDEO_CHANGED`, `KICK`) validate the user's role on the backend before changing state.

---

## 6. Modular Database Repository Architecture (`backend/src/repositories/`)

The persistence layer follows a clean Facade pattern over domain repositories:
- `DatabaseService` (`backend/src/database/index.ts`): Unified entry point.
- `UserRepository` (`backend/src/repositories/user.repository.ts`): User accounts, profiles, preferences, password resets.
- `RoomRepository` (`backend/src/repositories/room.repository.ts`): Room CRUD, slug lookups, capacity enforcement, inactive cleanup.
- `ParticipantRepository` (`backend/src/repositories/participant.repository.ts`): Membership, roles (OWNER, MODERATOR, PARTICIPANT), presence.
- `InvitationRepository` (`backend/src/repositories/invitation.repository.ts`): Cryptographic token creation, atomic uses counter, revocation.
- `ChatRepository` (`backend/src/repositories/chat.repository.ts`): Message persistence, system announcements, room event history.
- `Migrations` (`backend/src/repositories/migrations.ts`): PostgreSQL DDL and 10 performance B-tree indexes.

---

## 7. Real-Time Socket.IO Modular Gateway (`backend/src/realtime/`)

The WebSocket infrastructure is decoupled into domain handlers:
- `socket.gateway.ts`: Authentication middleware and event dispatcher facade (<60 lines).
- `handlers/presence.manager.ts`: Connection sets, disconnect timeouts, and `kickUserFromRoom`.
- `handlers/room.handler.ts`: `JOIN_ROOM`, `RECONNECT_ROOM`, `LEAVE_ROOM`, `KICK_USER`, disconnect cleanup.
- `handlers/playback.handler.ts`: `PLAY`, `PAUSE`, `SEEK`, `CHANGE_VIDEO`, `CHANGE_PLAYBACK_RATE`, `REQUEST_SYNC`.
- `handlers/emergency.handler.ts`: `EMERGENCY_PAUSE` and `RESUME_FROM_EMERGENCY`.
- `handlers/chat.handler.ts`: `SEND_CHAT_MESSAGE` and `SEND_REACTION`.

---

## 8. Frontend Custom Hooks & Modular Components

Complex pages and features are broken down into composable, testable units:
- **Custom Hooks** (`frontend/src/hooks/`):
  - `useRoomSocket`: Real-time state synchronization and event emitters.
  - `useRoomInvitations`: Invitation lifecycle and clipboard integration.
  - `useLiveKitRoom`: WebRTC room connection, track publishing, and hardware teardown.
- **Modular Presentation**:
  - `RoomInviteModal.tsx`, `ChangeVideoModal.tsx`, `RoomPasswordModal.tsx`, `RoomAccessDenied.tsx`.
  - `CreateRoomModal.tsx`, `RoomCard.tsx`, `QuickJoinCard.tsx`.
  - `ParticipantTile.tsx`, `EmergencyPauseBanner.tsx`, `PlaybackControls.tsx`.
