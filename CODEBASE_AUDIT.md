# SYNCTHEATER — Codebase Architecture & Modularity Audit

**Audit Date:** November 21, 2026  
**Auditor:** Antigravity Autonomous Systems Engineering  
**Scope:** Full codebase audit for modularity, code quality, readability, and contributor readiness.

---

## 1. Quantitative Codebase Metrics

| Metric | Measurement |
| :--- | :--- |
| **Total Source Files (TS/TSX)** | 38 files |
| **Total Source Lines of Code** | 8,649 lines |
| **Total Test Files** | 14 files |
| **Total Test Lines of Code** | 1,807 lines |
| **Files > 500 lines** | 4 files (`backend/src/database/index.ts`, `frontend/src/app/room/[slug]/page.tsx`, `backend/src/realtime/socket.gateway.ts`, `frontend/src/components/livekit/VoiceVideoPanel.tsx`, `frontend/src/app/dashboard/page.tsx`) |
| **Files 300–500 lines** | 2 files (`backend/src/modules/rooms/rooms.service.ts`, `frontend/src/components/theater/PlaybackControls.tsx`) |
| **Files 200–300 lines** | 3 files (`frontend/src/components/theater/VideoPlayer.tsx`, `frontend/src/app/page.tsx`, `backend/src/modules/rooms/rooms.controller.ts`) |
| **Files < 200 lines** | 29 files (76% of files are already within preferred/normal size) |

---

## 2. Detailed Audit Findings by Subsystem

### 2.1 Backend Layer

1. **Database Service (`backend/src/database/index.ts` - 1,138 lines):**
   - **Issue:** Single monolithic file containing connection pooling, migration DDL/indexes, local JSON persistence, and all entity queries (users, profiles, preferences, rooms, participants, invitations, chat messages, room events).
   - **Risk:** High cognitive load; hard to test query methods in isolation; potential merge conflicts for concurrent contributors.
   - **Remediation:** Deconstruct into modular repositories (`repositories/user.repository.ts`, `room.repository.ts`, `participant.repository.ts`, `invitation.repository.ts`, `chat.repository.ts`, `connection.ts`, `migrations.ts`, `fallback.storage.ts`). Maintain `DatabaseService` as a facade to ensure 100% backward compatibility with all existing consumers and tests.

2. **Socket.IO Gateway (`backend/src/realtime/socket.gateway.ts` - 621 lines):**
   - **Issue:** Giant event switchboard containing auth middleware, join/leave lifecycle, presence map management, chat broadcast, video playback sync events, emergency pause, and moderation kick/transfer.
   - **Risk:** Combining transport layer with domain event orchestration makes testing and adding new real-time events error-prone.
   - **Remediation:** Decompose into modular socket event handlers (`handlers/auth.handler.ts`, `handlers/room.handler.ts`, `handlers/playback.handler.ts`, `handlers/chat.handler.ts`, `handlers/moderation.handler.ts`).

3. **Room Service (`backend/src/modules/rooms/rooms.service.ts` - 381 lines):**
   - **Issue:** Handles room creation, room authorization, invitation generation, token validation, token revocation, participant list, kick, and ownership transfer.
   - **Remediation:** Extract invitation lifecycle logic into a dedicated invitation service or helper, keeping `rooms.service.ts` focused strictly on room lifecycle.

---

### 2.2 Frontend Layer

1. **Room Page (`frontend/src/app/room/[slug]/page.tsx` - 948 lines):**
   - **Issue:** Central monolithic orchestrator handling socket connections, room fetch, invitation validation, modal toggles (video change, password prompt, invite link), drawer toggles (chat, participants, voice), emergency pause, URL token scrubbing, and layout rendering.
   - **Risk:** High complexity; difficult to read and maintain; UI rendering mixed with deep networking and state logic.
   - **Remediation:**
     - Extract custom hook `useRoomSocket` for Socket.IO event binding and state synchronizer.
     - Extract custom hook `useRoomAuth` for invite validation and address bar query scrubbing.
     - Extract subcomponents (`ChangeVideoModal`, `RoomPasswordModal`, `RoomInviteModal`).
     - Reduce `page.tsx` to a clean ~150-line compositional view.

2. **VoiceVideoPanel Component (`frontend/src/components/livekit/VoiceVideoPanel.tsx` - 613 lines):**
   - **Issue:** LiveKit room connection, token retrieval, mic/cam track publication, device toggling, canvas audio visualizer rendering, remote track subscription, participant grid, and active speaker detection all in one file.
   - **Remediation:**
     - Extract `useLiveKitRoom` custom hook for connection, token fetching, track publication, and hardware teardown.
     - Extract `ParticipantTile` component for participant video/audio rendering, visualizer canvas, and active speaker border.
     - Extract `VoiceControls` component for mic, camera, and disconnect controls.

3. **Dashboard Page (`frontend/src/app/dashboard/page.tsx` - 576 lines):**
   - **Issue:** Contains room listings, stats, Create Room modal, and Join Room modal in a single file.
   - **Remediation:**
     - Extract `CreateRoomModal` and `JoinRoomModal`.
     - Extract `RoomCard`.

---

## 3. Refactoring Plan & Phased Roadmap

- **Stage 1:** Audit & Planning (Complete).
- **Stage 2:** Shared Types, Utilities & Configuration Organization.
- **Stage 3:** Backend Architecture & Repository Layering.
- **Stage 4:** Frontend Modularization & Custom Hooks Extraction.
- **Stage 5:** Socket.IO, Video Sync, & LiveKit Modularization.
- **Stage 6:** Test & Dependency Cleanup.
- **Stage 7:** Contributor Documentation (`README`, `CONTRIBUTING`, `ARCHITECTURE`, `CODE_STYLE`, `CHANGELOG`, `docs/`).
- **Stage 8:** Final Regression Verification across all test suites and production builds.
