# SYNCTHEATER — Production Deployment Guide

This guide provides end-to-end instructions for deploying SYNCTHEATER to production in a modern cloud environment.

SYNCTHEATER utilizes a decoupled architecture:
1. **Frontend:** Next.js 14 Web Application (Hosted on Vercel, Render, Fly.io, or VPS).
2. **Backend:** Express API & Socket.IO Real-Time Gateway (Hosted on Railway, Render, Fly.io, or VPS).
3. **Database:** Managed PostgreSQL 14+ (Supabase, Neon, AWS RDS, Railway PG, or Render PG).
4. **WebRTC SFU:** LiveKit Cloud (or self-hosted LiveKit Server).

---

## 1. Prerequisites & Required Accounts

Before beginning deployment, ensure you have:
- A GitHub repository with the SYNCTHEATER source code.
- A managed PostgreSQL database connection string (`DATABASE_URL`).
- A LiveKit Cloud project (free tier available at [livekit.io](https://livekit.io)).
- A platform account for hosting (e.g., Vercel + Railway, or Render, or Docker VPS).
- A domain name with SSL (HTTPS) enabled (required for WebRTC camera/microphone permissions and Clipboard API).

---

## 2. Infrastructure Setup & Provisioning

### 2.1 Provision PostgreSQL Database
1. Create a database instance on your provider (e.g., Supabase or Railway).
2. Obtain the standard PostgreSQL URI:
   ```text
   postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>?sslmode=require
   ```
3. *Note:* SYNCTHEATER executes database schema migrations and creates performance B-tree indexes automatically on backend startup. No manual SQL scripts are required.

### 2.2 Provision LiveKit Cloud WebRTC
1. Log in to [LiveKit Cloud Console](https://cloud.livekit.io).
2. Create a new project (e.g., `synctheater-production`).
3. Note your credentials from **Project Settings > Keys**:
   - `LIVEKIT_URL`: WebSockets endpoint (`wss://your-project.livekit.cloud`)
   - `LIVEKIT_API_KEY`: API Key (e.g., `API...`)
   - `LIVEKIT_API_SECRET`: Secret Key (e.g., `secret...`)

---

## 3. Deploying the Backend API & WebSocket Gateway

The backend must be deployed first so its public URL can be provided to the frontend build.

### Option A: Deploy to Railway (Recommended)
1. In Railway, click **New Project > Deploy from GitHub repo**.
2. Select your repository and choose the `backend/` root directory (or set **Root Directory** to `backend` in Settings).
3. Set the build and start commands:
   - **Build Command:** `npm install && npm run build` (or `tsc`)
   - **Start Command:** `npm run start` (or `node dist/index.js`)
4. Configure Environment Variables in Railway:
   ```env
   NODE_ENV=production
   PORT=8000
   DATABASE_URL=postgresql://...
   JWT_SECRET=<GENERATE_A_RANDOM_64_CHAR_HEX_STRING>
   JWT_EXPIRATION=7d
   REFRESH_TOKEN_SECRET=<GENERATE_ANOTHER_RANDOM_64_CHAR_HEX_STRING>
   MAX_ROOM_CAPACITY=50
   INVITATION_TOKEN_TTL_HOURS=72
   LIVEKIT_URL=https://your-project.livekit.cloud
   LIVEKIT_API_KEY=your_key
   LIVEKIT_API_SECRET=your_secret
   # Leave CORS_ORIGIN and CLIENT_URL empty for now; configure them after frontend is deployed
   ```
5. Click **Deploy** and assign a public domain (e.g., `https://api.synctheater.com` or `https://backend-production.up.railway.app`).

### Option B: Deploy with Docker / VPS
Build and run the container:
```bash
cd backend
docker build -t synctheater-backend .
docker run -d \
  -p 8000:8000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your_production_secret_32_chars_minimum" \
  -e CORS_ORIGIN="https://synctheater.com" \
  -e LIVEKIT_URL="https://your-project.livekit.cloud" \
  -e LIVEKIT_API_KEY="..." \
  -e LIVEKIT_API_SECRET="..." \
  --name synctheater-api synctheater-backend
```

---

## 4. Deploying the Frontend (Next.js 14)

### Option A: Deploy to Vercel (Recommended)
1. Go to [Vercel](https://vercel.com) and import the GitHub repository.
2. Set **Root Directory** to `frontend`.
3. Framework Preset will auto-detect as **Next.js**.
4. Configure Environment Variables (**Crucial for Build Step**):
   ```env
   NEXT_PUBLIC_APP_URL=https://synctheater.com
   NEXT_PUBLIC_API_URL=https://api.synctheater.com
   NEXT_PUBLIC_SOCKET_URL=https://api.synctheater.com
   NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
   ```
   > [!IMPORTANT]
   > `NEXT_PUBLIC_*` variables are embedded into the client-side JavaScript bundle during `next build`. You must set `NEXT_PUBLIC_APP_URL` to your production frontend domain before building so invitation links point to the real canonical domain.
5. Click **Deploy**. Vercel will run `npm run build` and produce an optimized edge distribution.

### Option B: Standalone Node / Docker Container
```bash
cd frontend
docker build \
  --build-arg NEXT_PUBLIC_APP_URL=https://synctheater.com \
  --build-arg NEXT_PUBLIC_API_URL=https://api.synctheater.com \
  --build-arg NEXT_PUBLIC_SOCKET_URL=https://api.synctheater.com \
  --build-arg NEXT_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud \
  -t synctheater-frontend .
docker run -d -p 3000:3000 --name synctheater-web synctheater-frontend
```

---

## 5. Completing Backend CORS & Security Whitelisting

Now that the frontend domain is live (e.g., `https://synctheater.com`):
1. Return to your backend settings (e.g. Railway or Render).
2. Set the exact frontend origin(s):
   ```env
   CLIENT_URL=https://synctheater.com
   CORS_ORIGIN=https://synctheater.com
   ```
   *(For multiple domains such as custom domain and preview domain, use comma separation: `https://synctheater.com,https://synctheater.vercel.app`)*.
3. Restart or redeploy the backend service.

---

## 6. Post-Deployment Verification Smoke Test

Execute this rapid 4-step smoke test immediately after deployment:

1. **Backend Health & Security Guard Check:**
   - Run `curl -i https://api.synctheater.com/api/rooms/public`
   - Verify `HTTP 200` with response body:
     ```json
     {"success":true,"rooms":[],"message":"Public room listings are disabled. All watch rooms in SYNCTHEATER are strictly private."}
     ```
   - Verify security headers are present in the response:
     - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: SAMEORIGIN`
     - `Referrer-Policy: strict-origin-when-cross-origin`

2. **Frontend Routing & SSL Check:**
   - Open `https://synctheater.com` in a browser.
   - Confirm HTTPS lock icon is active.
   - Register a test account and navigate to `/dashboard`.

3. **Private Room Creation & Invitation Link Check:**
   - Create a new room from the dashboard.
   - Click the **Invite** button in the playback controls bar.
   - Confirm the copied link format is strictly:
     `https://synctheater.com/room/<slug>?invite=<token>`
   - Notice that the link points to your production domain, NOT localhost.

4. **WebRTC Permissions & Video Sync:**
   - Open the invitation link on a secondary device.
   - Grant camera/mic permissions and verify peer connection.
