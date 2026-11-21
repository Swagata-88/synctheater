# SYNCTHEATER — GitHub Publication Checklist & Runbook

This runbook outlines the exact step-by-step procedure for initializing Git and publishing the SYNCTHEATER repository to GitHub for the first time.

---

## 1. Pre-Flight Verification Checklist

Ensure all items are verified prior to running any Git commands:

- [x] **No Real Secrets on Disk**: Verified that zero live production keys, passwords, or cloud credentials reside in source files.
- [x] **`.gitignore` Hardened**: Excludes `.env*` (except `.env.example`), `node_modules/`, `dist/`, `.next/`, `backend/data/*.json`, and `*.tsbuildinfo`.
- [x] **`.gitkeep` Present**: `backend/data/.gitkeep` is present to ensure directory creation on clean clones.
- [x] **Documentation Complete**: `README.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `CODE_STYLE.md`, `DEPLOYMENT_GUIDE.md` verified.
- [x] **Zero TypeScript Errors**: Both frontend and backend compile cleanly with `strict: true`.
- [x] **83/83 Tests Passing**: 52 backend tests and 31 frontend tests passing (100%).
- [x] **Build Scripts Clean**: Obsolete Prisma scripts removed from root `package.json`.

---

## 2. Step-by-Step Initial Publication Procedure

> [!IMPORTANT]
> Do NOT execute these steps until ready to publish. Wait for explicit user authorization before running `git init`, committing, or pushing.

### Step 1: Initialize Git Repository
In the root directory (`/data/user/0/com.agy/files/SYNCTHEATER`):
```bash
git init
git branch -M main
```

### Step 2: Verify Ignored Files Before Staging
Run `git status` to confirm that `node_modules/`, `.next/`, `dist/`, `.env*`, and `backend/data/synctheater.json` are NOT in the untracked file list:
```bash
git status
```
*Expected: Only source code, documentation, package configs, and `.gitkeep` files should appear.*

### Step 3: Stage Files for Initial Commit
```bash
git add .
```

Confirm staged files:
```bash
git status
```
Verify that no `.env` or `.json` database files are staged for commit.

### Step 4: Create the Initial Commit
```bash
git commit -m "feat: initial commit of SYNCTHEATER v1.2.0

- Server-authoritative video synchronization engine
- Multi-provider video resolver (YouTube, MP4, HLS, Google Drive)
- Private-only watch rooms with cryptographic invitation tokens
- Real-time chat, reactions, and universal emergency pause
- WebRTC voice/video lounge via LiveKit SFU integration
- Domain-driven repository persistence with in-memory fallback
- Complete unit and integration test suites (83 tests)"
```

### Step 5: Add Remote & Push to GitHub
1. Create a new repository on GitHub (e.g., `https://github.com/your-username/SYNCTHEATER.git`).
2. Link remote and push:
```bash
git remote add origin https://github.com/<your-username>/SYNCTHEATER.git
git push -u origin main
```

---

## 3. Post-Publication GitHub Settings Recommendations

After pushing to GitHub:

1. **Branch Protection Rules**:
   - Navigate to **Settings > Branches > Add branch protection rule**.
   - Require status checks to pass before merging (`npm test` across frontend and backend).
   - Require pull request reviews before merging.
2. **Secret Scanning & Dependabot**:
   - Under **Settings > Code security and analysis**, enable:
     - Dependabot alerts & security updates.
     - Secret scanning (blocks accidental secret commits).
3. **Repository Metadata**:
   - Set repository description: *"Watch Together. Anywhere. In Sync. Real-Time Social Cinema Platform."*
   - Add topics: `watch-party`, `socket-io`, `webrtc`, `livekit`, `nextjs`, `typescript`, `video-synchronization`.
