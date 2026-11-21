# SYNCTHEATER Code Style & Architecture Guidelines

This document details the code formatting, structural patterns, and architectural conventions enforced across the SYNCTHEATER codebase.

---

## 1. File Size Policies

| File Category | Preferred Length | Max Acceptable | Action Required if Exceeded |
|---|---|---|---|
| Domain Repositories | 100–250 lines | 350 lines | Split into specialized domain repositories |
| Business Services | 150–250 lines | 350 lines | Extract helper services or validator modules |
| Socket.IO Handlers | 50–150 lines | 200 lines | Extract event groups to `realtime/handlers/` |
| React Page Components | 100–200 lines | 250 lines | Extract custom hooks and subcomponents |
| React Modals & Cards | 50–150 lines | 200 lines | Keep focused on presentation and user actions |
| Custom React Hooks | 80–180 lines | 250 lines | Split into composable hooks |

---

## 2. Layering & Architectural Patterns

### The Facade Pattern (Database & Real-time)
- **Database Facade**: `backend/src/database/index.ts` exposes a clean, single-point-of-entry `db` object that implements `DatabaseService`. Under the hood, it delegates to domain repositories (`this.users`, `this.rooms`, `this.invitations`, `this.participants`, `this.chat`).
- **Real-time Gateway Facade**: `backend/src/realtime/socket.gateway.ts` initializes Socket.IO, applies authentication middleware, and registers domain handler functions from `backend/src/realtime/handlers/`.

### The Custom Hook Pattern (Frontend)
Stateful interactions with WebSocket connections, external APIs, and hardware devices (microphones/cameras) are isolated in custom hooks:
- `useRoomSocket`: Encapsulates Socket.IO room events, sequence reconciliation, and sync emitters.
- `useRoomInvitations`: Encapsulates invitation list fetching, generation, copying, and revocation.
- `useLiveKitRoom`: Encapsulates WebRTC room connection, audio/video track publishing, and hardware release.

---

## 3. TypeScript Conventions

1. **Strict Type Safety**: All files run with `strict: true`. Avoid casting to `any` whenever explicit typing or generics are possible.
2. **Centralized Types**:
   - Frontend interfaces are declared in `frontend/src/types/index.ts`.
   - Backend database models and queries are typed in `backend/src/database/types.ts`.
   - Real-time packet types are typed in `backend/src/realtime/types.ts`.
3. **Explicit Return Types**: All public service and repository functions must specify their return type explicitly (`Promise<Room>`, `Promise<boolean>`, etc.).

---

## 4. Error Handling & Security Guidelines

1. **Defensive Async Operations**: Always wrap socket handlers and API endpoints in `try/catch` blocks. Emit structured error packets:
   ```typescript
   socket.emit('ERROR', { message: 'Human-readable description', code: 'ERROR_CODE' });
   ```
2. **Never Log Sensitive Credentials**:
   - Passwords, reset tokens, JWT secrets, and LiveKit API secrets must never be logged to `console.log` or error monitoring.
3. **Canonical URLs & Token Protection**:
   - Invitations must generate canonical URLs using `getAppUrl()`, respecting `NEXT_PUBLIC_APP_URL` and `APP_URL`.
   - Once an invitation token is verified on room entry, the browser address bar must scrub the query string using `history.replaceState` to prevent token leakage via screenshot or referer headers.
