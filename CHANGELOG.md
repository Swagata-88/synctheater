# Changelog

All notable changes to the SYNCTHEATER project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - Phase 12: Codebase Refactoring & Architecture Organization

### Architectural Modularization
- **Backend Database Repositories**: Decomposed the monolithic 1,138-line database file (`backend/src/database/index.ts`) into domain-driven repositories in `backend/src/repositories/`:
  - `user.repository.ts`: User authentication, profile, and preference queries.
  - `room.repository.ts`: Room CRUD, slug lookups, capacity enforcement, and inactive room cleanup.
  - `participant.repository.ts`: Room participant tracking, membership queries, and role verification.
  - `invitation.repository.ts`: Token creation, cryptographic generation, atomic use counters, and revocation.
  - `chat.repository.ts`: Chat message persistence and room event tracking.
  - `migrations.ts`: Schema definition and 10 PostgreSQL performance B-tree indexes.
  - Unified facade preserved with 100% backward compatibility for all callers and tests.
- **Backend Socket.IO Gateway**: Decomposed the 622-line `socket.gateway.ts` into specialized realtime handlers in `backend/src/realtime/handlers/`:
  - `presence.manager.ts`: Connection tracking, timeout management, and user kick broadcast.
  - `room.handler.ts`: Private room joining, token validation, reconnection, and departure.
  - `playback.handler.ts`: Play, pause, seek, rate changes, and sync dispatch.
  - `emergency.handler.ts`: Emergency pause broadcast and host-only resume.
  - `chat.handler.ts`: Text messaging and reaction broadcast.
- **Frontend Theater Architecture**:
  - Reduced `room/[slug]/page.tsx` from 949 lines to 260 lines by extracting custom hooks and modular presentation components:
    - `useRoomSocket.ts`: Real-time state synchronization, monotonic sequence verification, and socket event dispatch.
    - `useRoomInvitations.ts`: Invitation token lifecycle and sharing logic.
    - `RoomAccessDenied.tsx`: Dedicated access denied display for private rooms.
    - `RoomInviteModal.tsx`: Invitation link sharing and generation management.
    - `ChangeVideoModal.tsx`: Video URL entry with live provider resolution preview.
    - `RoomPasswordModal.tsx`: Room password authentication prompt.
  - Reduced `dashboard/page.tsx` from 577 lines to 170 lines by extracting `CreateRoomModal.tsx`, `RoomCard.tsx`, and `QuickJoinCard.tsx`.
  - Modularized `VoiceVideoPanel.tsx` from 614 lines to 160 lines by extracting `useLiveKitRoom.ts` and `ParticipantTile.tsx`.
  - Extracted `ManualInviteModal.tsx` from `PlaybackControls.tsx`.
- **Shared Contracts & Configuration**: Centralized shared frontend TypeScript types into `frontend/src/types/index.ts` and constants into `frontend/src/constants/index.ts`.

---

## [1.1.0] - Phase 11: Production Deployment Readiness & Real-Device Verification

### Production Readiness
- Audited canonical app URLs (`NEXT_PUBLIC_APP_URL` and `APP_URL`).
- Verified zero hardcoded `localhost` dependencies in client-facing code.
- Added comprehensive deployment guides (`DEPLOYMENT_GUIDE.md`, `PRODUCTION_ENVIRONMENT_VARIABLES.md`).

---

## [1.0.0] - Private Rooms & Cryptographic Invitation System

### Security & Privacy
- Enforced private-only watch party rooms; disabled all public room discovery and listings.
- Cryptographically secure invitation tokens generated via `crypto.randomBytes(24).toString('base64url')`.
- Address bar URL token scrubbing via `window.history.replaceState` upon successful room admission.
- Atomic invitation use counters preventing race conditions and token reuse beyond limits.
