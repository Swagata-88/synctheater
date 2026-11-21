# Contributing to SYNCTHEATER

Thank you for your interest in contributing to **SYNCTHEATER**! We welcome contributions from developers of all skill levels. To ensure the codebase remains maintainable, scalable, and easy to navigate, please adhere to the following architectural guidelines and engineering standards.

---

## 1. Core Engineering Principles

1. **Strict File Size Limits**:
   - **Target**: 100–200 lines per file.
   - **Acceptable**: Up to 300 lines for complex integration modules.
   - **Review Required**: Files > 300 lines.
   - **Prohibited**: Files > 450 lines without explicit architectural justification and modular decomposition.
2. **Single Responsibility Principle**:
   - Every module, hook, service, repository, and component must have one clearly defined responsibility.
   - Business logic belongs in services, database queries in repositories, real-time dispatch in socket handlers, and UI presentation in decoupled components.
3. **No Breaking Changes to Security / Core Contracts**:
   - SYNCTHEATER rooms are strictly private and invite-only. Public room listings and unauthenticated creation are prohibited.
   - Monotonic sequence numbers and dynamic clock offset tracking must be preserved across video synchronization handlers.
   - Token scrubbing in the browser (`history.replaceState`) must remain active to prevent invitation token leakage.

---

## 2. Project Directory Structure

```text
SYNCTHEATER/
├── backend/
│   ├── src/
│   │   ├── config/              # Environment configuration & JWT validation
│   │   ├── database/            # Database facade & type definitions
│   │   ├── repositories/        # Domain-driven SQL/InMemory repositories
│   │   ├── middleware/          # Security, auth, & rate limiting middleware
│   │   ├── modules/             # Core business services & HTTP controllers
│   │   │   ├── auth/            # User authentication, registration, JWT
│   │   │   ├── rooms/           # Room creation, membership, & moderation
│   │   │   ├── video/           # Multi-provider URL resolver (YouTube, MP4, HLS, Drive)
│   │   │   └── livekit/         # LiveKit WebRTC access token issuing
│   │   └── realtime/            # Real-time WebSocket architecture
│   │       ├── state.manager.ts # Authoritative video playback state
│   │       ├── socket.gateway.ts# Socket.IO connection & dispatcher facade
│   │       └── handlers/        # Domain-specific event handlers (chat, room, playback, emergency)
│   └── tests/                   # Backend Vitest unit & integration test suites
│
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router routes (login, dashboard, room/[slug])
│   │   ├── components/          # Reusable UI components
│   │   │   ├── dashboard/       # Dashboard room cards & create modals
│   │   │   ├── theater/         # Theater video player, controls, & modals
│   │   │   ├── livekit/         # WebRTC voice/video mesh & participant tiles
│   │   │   └── chat/            # Live chat panel & message list
│   │   ├── hooks/               # Custom React hooks (useRoomSocket, useRoomInvitations, useLiveKitRoom)
│   │   ├── types/               # Centralized shared TypeScript definitions
│   │   ├── constants/           # Platform defaults & configuration constants
│   │   └── lib/                 # Client utilities (API client, socket, clipboard)
│   └── tests/                   # Frontend Vitest & React Testing Library suites
```

---

## 3. Development Workflow

### Prerequisites
- Node.js 18+ (tested on Node 20 & Node 22)
- npm or pnpm
- Optional: PostgreSQL 14+ (SYNCTHEATER automatically falls back to persistent in-memory JSON storage for local offline development)

### Getting Started
```bash
# 1. Clone repository
git clone https://github.com/your-username/SYNCTHEATER.git
cd SYNCTHEATER

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example backend/.env
cp .env.example frontend/.env.local

# 4. Start backend development server
cd backend && npm run dev

# 5. Start frontend development server (in separate terminal)
cd frontend && npm run dev
```

---

## 4. Testing & Code Quality Requirements

Before submitting a Pull Request, all tests and TypeScript compiler checks must pass with zero errors:

```bash
# Backend checks
cd backend
npm run build     # Must compile with zero errors (tsc)
npm test          # Must pass 100% of Vitest suites (52 tests)

# Frontend checks
cd frontend
npm run build     # Next.js production build must succeed
npm test          # Must pass 100% of Vitest suites (31 tests)
```

---

## 5. Architectural Standards

- **Database Queries**: Never write raw SQL inside controllers or services. Place queries in `backend/src/repositories/` and access them via the unified `db` facade.
- **WebSocket Handlers**: Never place large inline closures in `socket.gateway.ts`. Extract handlers to `backend/src/realtime/handlers/`.
- **Frontend Components**: Never exceed 250 lines in a page or component. Extract sub-components (modals, cards, panels) and stateful logic into custom hooks (`src/hooks/`).
- **Typing**: Avoid `any` where possible. Use shared interfaces from `@frontend/types` and `@backend/database/types`.
