# SYNCTHEATER — Environment Setup Guide

## Prerequisites

- **Node.js**: v18.0.0 or newer (tested on Node.js v26)
- **Package Manager**: npm or pnpm
- **Database**: PostgreSQL (or the automatic embedded atomic database fallback for instant local execution)
- **Optional Services**:
  - Redis (for multi-instance clustering; automatic in-memory fallback included)
  - LiveKit Cloud (for production WebRTC multi-peer audio/video; development token generator included)

---

## 1. Quick Start (Local Development)

### Clone & Install Dependencies
```bash
git clone https://github.com/your-org/synctheater.git
cd synctheater

# Install root & workspace packages
npm install
```

### Environment Configuration
Copy `.env.example` into `.env`:
```bash
cp .env.example .env
```

Review default settings in `.env`:
```env
PORT=8000
NODE_ENV=development
API_BASE_URL=http://localhost:8000
CLIENT_URL=http://localhost:3000
JWT_SECRET=synctheater-super-secret-jwt-key-change-in-production-2026
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/synctheater?schema=public"
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
```

### Start Services

**Option A: Run Both Backend & Frontend Simultaneously**
```bash
npm run dev
```

**Option B: Run Independently**
```bash
# Terminal 1: Backend Server (Port 8000)
cd backend && npm run dev

# Terminal 2: Next.js Frontend (Port 3000)
cd frontend && npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 2. Running Automated Tests

Run the backend unit & integration test suite (Vitest):
```bash
cd backend
npm run test
```

Expected output:
```
 ✓ tests/video.service.test.ts (7)
 ✓ tests/sync.state.test.ts (4)
 ✓ tests/auth.service.test.ts (3)

 Test Files  3 passed (3)
      Tests  14 passed (14)
```
