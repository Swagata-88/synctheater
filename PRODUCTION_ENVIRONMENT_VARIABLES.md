# SYNCTHEATER — Production Environment Variables Reference

This document provides a comprehensive specification of all environment variables required to operate SYNCTHEATER in staging and production environments.

---

## 1. Backend Environment Variables (`backend/.env`)

These variables configure the Express REST API, Socket.IO WebSocket gateway, PostgreSQL database connection, security guards, and LiveKit WebRTC server credentials.

| Variable Name | Required | Default / Staging Example | Production Example | Description & Security Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | `development` | `production` | Enables production optimizations, strict JWT validation, security headers (HSTS), and disables local fallback data file storage. |
| `PORT` | No | `8000` | `8000` (or assigned by PaaS) | The HTTP and WebSocket listening port. In cloud hosts like Railway/Render, usually injected automatically. |
| `DATABASE_URL` | **Yes** | `postgresql://...` | `postgresql://user:pass@ep-xyz.postgres.database.azure.com:5432/synctheater?sslmode=require` | Connection string for PostgreSQL 14+. In production, `sslmode=require` must be appended. Local memory/JSON fallback is strictly disabled in production. |
| `JWT_SECRET` | **Yes** | Dev fallback | `a9f3b827c194e82b71d93e84a205c6198f2371940a1b82736450192837465abc` | Cryptographically random secret (minimum 32 characters). The backend fails startup if missing, empty, or using a default insecure secret. |
| `JWT_EXPIRATION` | No | `7d` | `7d` | JSON Web Token lifespan. Supported formats: `1d`, `7d`, `24h`. |
| `REFRESH_TOKEN_SECRET` | No | Dev fallback | `e83719284756192837465a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d` | Secondary secret for token refreshing routines. |
| `CORS_ORIGIN` | **Yes** | `http://localhost:3000` | `https://synctheater.com,https://staging.synctheater.com` | Comma-separated whitelist of allowed client origins. Wildcard `*` is strictly rejected in production. |
| `CLIENT_URL` | No | `http://localhost:3000` | `https://synctheater.com` | Canonical frontend origin used for fallback redirects and internal origin verification. |
| `MAX_ROOM_CAPACITY` | No | `50` | `50` | Hard cap on maximum concurrent participants allowed in any private room. |
| `INVITATION_TOKEN_TTL_HOURS` | No | `72` | `72` | Default validity window (in hours) for newly generated private room invitation tokens. |
| `REDIS_URL` | No | `redis://localhost:6379` | `rediss://default:token@fly-synctheater-redis.upstash.io:6379` | Redis connection URL. Used for multi-instance Socket.IO clustering if enabled. |
| `REDIS_ENABLED` | No | `false` | `false` (or `true` if clustered) | Set to `true` to attach Redis adapter for multi-node horizontal scaling. |
| `LIVEKIT_URL` | **Yes** | `https://synctheater.livekit.cloud` | `https://your-tenant.livekit.cloud` | Public LiveKit Cloud or self-hosted HTTP/HTTPS endpoint. |
| `LIVEKIT_API_KEY` | **Yes** | `devkey` | `APIxxxxxxxxx` | API key from LiveKit Console used to sign participant room access tokens. |
| `LIVEKIT_API_SECRET` | **Yes** | Dev secret | `secretxxxxxxxxxxxxxxxxxxxxxxxxx` | Secret key used by `livekit-server-sdk` for HMAC token signing. |

---

## 2. Frontend Environment Variables (`frontend/.env.local` / CI Build)

These variables are consumed by the Next.js 14 App Router.

> [!IMPORTANT]
> Variables prefixed with `NEXT_PUBLIC_` are compiled into the static JavaScript client bundle during `next build`. They **must be present at build time**.

| Variable Name | Required | Default / Staging Example | Production Example | Description & Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `http://localhost:3000` | `https://synctheater.com` | **Canonical application URL**. Crucial for invitation links: used by `generateInviteUrl()` to build `${NEXT_PUBLIC_APP_URL}/room/<slug>?invite=<token>`. Must NOT have trailing slash. |
| `NEXT_PUBLIC_API_URL` | **Yes** | `http://localhost:8000` | `https://api.synctheater.com` | Public base URL of the backend REST API endpoints. |
| `NEXT_PUBLIC_SOCKET_URL` | **Yes** | `http://localhost:8000` | `https://api.synctheater.com` | Public WebSocket endpoint for real-time video sync, chat, and room presence. |
| `NEXT_PUBLIC_LIVEKIT_URL` | **Yes** | `https://synctheater.livekit.cloud` | `wss://your-tenant.livekit.cloud` | WebSocket signaling endpoint for LiveKit WebRTC client connections. |

---

## 3. Secret Generation & Cryptographic Guidelines

For production environments, generate secure random secrets using standard OpenSSL commands:

```bash
# Generate 64-character hex secret for JWT_SECRET:
openssl rand -hex 32

# Generate 64-character hex secret for REFRESH_TOKEN_SECRET:
openssl rand -hex 32
```

---

## 4. Production Security Checklist

- [ ] `NODE_ENV` is set to `production` on backend.
- [ ] `JWT_SECRET` is randomized and not equal to default development strings.
- [ ] `CORS_ORIGIN` does NOT contain `*` (wildcards).
- [ ] `DATABASE_URL` connects to managed PostgreSQL with SSL enabled.
- [ ] `NEXT_PUBLIC_APP_URL` points to the exact public HTTPS frontend domain.
- [ ] `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` point to the public HTTPS backend domain.
- [ ] `NEXT_PUBLIC_LIVEKIT_URL` uses `wss://` secure WebSockets.
- [ ] SSL/TLS certificates are active on both frontend and backend domains.
