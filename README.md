# SYNCTHEATER

> **"Watch Together. Anywhere. In Sync."**

SYNCTHEATER is a production-ready, server-authoritative social watch-party platform where friends, communities, and families can watch online videos together from separate physical locations in near-perfect synchronization.

Unlike basic screen-sharing applications, SYNCTHEATER coordinates playback events over WebSockets while every participant streams content directly through their own internet connection. This delivers native high-definition video, zero server video-transcoding bottlenecks, independent local audio controls, and an authentic synchronized cinema experience.

---

## 🌟 Key Features

1. **Server-Authoritative Video Synchronization**
   - Millisecond-accurate timestamp coordination using Socket.IO.
   - Low-latency state distribution with monotonic sequence numbers.
   - Intelligent drift correction with threshold-based seeking (no jarring jumps for sub-second network jitter).
   - Late-join synchronization: new arrivals automatically catch up to the current room video and playback state.

2. **Universal Video Provider Architecture**
   - **YouTube**: Full support for standard URLs, short links (`youtu.be`), and YouTube Shorts with the official IFrame Player API.
   - **Direct Video Streams**: HTML5 MP4, WebM, and adaptive bitrate HTTP Live Streaming (**HLS .m3u8**) via HLS.js.
   - **Google Drive**: Sharing link detection and preview/media playback compatibility.
   - Extensible `VideoProvider` abstraction layer for adding new platforms without altering the sync core.

3. **Strict Private Rooms & Cryptographic Invitations**
   - All rooms are strictly private and invite-only; zero public room discovery.
   - High-entropy cryptographic invitation tokens (`crypto.randomBytes(24).toString('base64url')`).
   - Browser address bar token scrubbing via `window.history.replaceState` upon admission.
   - Atomic use counters and optional expiration limits.

4. **Instant Emergency Pause System**
   - Accessible to **any** participant in the room.
   - Immediately pauses playback across all clients.
   - Emits visual status banner announcing who requested the pause.
   - Server-enforced resume permission (only owner/moderators can resume playback).

5. **Integrated Real-Time Voice, Video & Text Communication**
   - LiveKit WebRTC mesh for ultra-low latency camera and microphone streaming.
   - In-room chat with persistent message history and emoji reaction animations.
   - System notifications for joins, leaves, video switches, and emergency pauses.

6. **Cinematic Theater Environments**
   - Distinct theater ambience modes:
     - 🏛️ **Classic Cinema**
     - ☕ **Cozy Room**
     - 🎮 **Gaming Lounge**
     - ✨ **Minimal Theater**
   - Responsive layout for desktop, tablets, and mobile devices (tested on Android browsers).

---

## 🛠️ Architecture & Modularity

The codebase is organized into small, focused, maintainable modules following strict engineering standards:

- **Backend**:
  - `src/repositories/`: Domain repositories (`UserRepository`, `RoomRepository`, `InvitationRepository`, `ParticipantRepository`, `ChatRepository`).
  - `src/realtime/handlers/`: Specialized Socket.IO handlers (`playback.handler.ts`, `emergency.handler.ts`, `chat.handler.ts`, `room.handler.ts`, `presence.manager.ts`).
  - `src/modules/`: Business services (auth, rooms, video resolution, LiveKit token issuance).
- **Frontend**:
  - `src/hooks/`: Custom React hooks (`useRoomSocket`, `useRoomInvitations`, `useLiveKitRoom`).
  - `src/components/theater/`: Video player, controls, and modals (`RoomInviteModal`, `ChangeVideoModal`, `RoomPasswordModal`, `RoomAccessDenied`).
  - `src/components/dashboard/`: Dashboard room cards and creation dialogs (`RoomCard`, `CreateRoomModal`, `QuickJoinCard`).
  - `src/components/livekit/`: WebRTC lounge and `ParticipantTile`.

For in-depth details, see [ARCHITECTURE.md](file:///data/user/0/com.agy/files/SYNCTHEATER/ARCHITECTURE.md), [CONTRIBUTING.md](file:///data/user/0/com.agy/files/SYNCTHEATER/CONTRIBUTING.md), and [CODE_STYLE.md](file:///data/user/0/com.agy/files/SYNCTHEATER/CODE_STYLE.md).

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example backend/.env
cp .env.example frontend/.env.local
```

### 3. Start Development Servers
```bash
# Terminal 1: Backend API & WebSocket Server (Port 4000)
cd backend && npm run dev

# Terminal 2: Frontend Next.js Client (Port 3000)
cd frontend && npm run dev
```

Visit `http://localhost:3000` (or your device's LAN IP) to create a private theater and invite guests.

---

## 🧪 Testing

```bash
# Run backend tests (52 tests across 9 test suites)
cd backend && npm test

# Run frontend tests (31 tests across 5 test suites)
cd frontend && npm test
```
