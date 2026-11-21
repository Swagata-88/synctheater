# SYNCTHEATER — Real-Device Multi-Network Acceptance Test Plan

**Scope:** Post-Deployment End-to-End Acceptance Testing  
**Test Setup:** Two separate devices on two distinct physical networks (e.g., Device A on Home/Office Wi-Fi, Device B on Mobile Cellular 4G/5G).

---

## 1. Test Environment Setup

| Role | Device Specs | Network Connection | Web Browser |
| :--- | :--- | :--- | :--- |
| **Device A (Host)** | Laptop / Desktop PC | Home / Office Wi-Fi | Chrome / Firefox / Safari (Latest) |
| **Device B (Guest)** | Mobile Smartphone (Android / iOS) | Cellular 4G / 5G (Disconnected from Wi-Fi) | Mobile Chrome / Safari Mobile |
| **Device C (Attacker)** | Any Device / Incognito Window | Any Network | Mobile / Desktop Browser |

---

## 2. Test Execution Matrix

### Test Suite 1: Authentication & Private Room Creation (Device A)
- [ ] **1.1 Account Registration:**
  - Navigate to `https://synctheater.com/register`.
  - Create host account (`host@example.com` / `Password123!`).
  - Expected: Instant redirection to `/dashboard`, JWT token stored in `localStorage`, user avatar in navigation.
- [ ] **1.2 Private Room Creation:**
  - Click **Create Room** on the dashboard.
  - Enter Room Name: `Cinema Premiere Night`.
  - Notice: Privacy selector is disabled/locked to **Private** (no option for public rooms).
  - Click **Submit**.
  - Expected: Redirected to `/room/cinema-premiere-night-<hash>`.
  - Check browser console/network: `POST /api/rooms` responded with `201 Created` and `privacy: "PRIVATE"`.

---

### Test Suite 2: Invitation Link Generation & Clipboard Fallback (Device A)
- [ ] **2.1 Copy Invitation Link:**
  - On the room page, locate the playback toolbar and click the **Invite** button.
  - Expected: Toast notification appears with `"Copied Link!"`.
  - If tested on HTTP or Android browser where `navigator.clipboard` is restricted:
    - Expected: Manual Copy Modal pops up displaying the selectable invitation URL with a **Copy** button.
- [ ] **2.2 Inspect Invitation URL Format:**
  - Paste clipboard content into a text editor.
  - Expected format:
    ```text
    https://synctheater.com/room/cinema-premiere-night-<hash>?invite=<cryptographic_token>
    ```
  - Verify that the hostname matches the production domain (`NEXT_PUBLIC_APP_URL`) and contains NO `localhost` or `127.0.0.1`.

---

### Test Suite 3: Cross-Network Guest Join & Return-To-Invitation Flow (Device B)
- [ ] **3.1 Open Invitation on Cellular Network:**
  - Open the invitation link on Device B via Mobile Browser (cellular data).
  - Since Device B is not logged in:
    - Expected: Redirected to `/login?returnUrl=%2Froom%2Fcinema-premiere-night-...%3Finvite%3D...`.
- [ ] **3.2 Complete Registration / Login:**
  - Switch to `/register` or enter guest credentials on `/login`.
  - Click **Sign In**.
  - Expected: Upon successful authentication, the application immediately navigates back to the exact target room with the invitation token intact.
- [ ] **3.3 Room Admission & URL Address Bar Scrubbing:**
  - The guest joins the room successfully.
  - **Security Check:** Inspect Device B's browser address bar.
  - Expected: The `?invite=<token>` query string has been automatically scrubbed from the address bar via `window.history.replaceState`, displaying clean `/room/<slug>`.

---

### Test Suite 4: Negative Security & Access Control Tests (Device C)
- [ ] **4.1 Unauthorized Slug Guessing:**
  - From Device C, attempt to navigate directly to the room slug without an invitation token:
    `https://synctheater.com/room/cinema-premiere-night-<hash>`
  - Expected: HTTP 403 Forbidden error with message:
    `"This room is private. A valid invitation link is required."`
    Direct entry is strictly blocked.
- [ ] **4.2 Expired Invitation Token:**
  - Generate an invitation with short expiration or test an expired token.
  - Device C attempts to join using the expired token.
  - Expected: Error modal:
    `"This invitation has expired. Please request a new link from the host."`
- [ ] **4.3 Revoked Invitation Token:**
  - Device A opens Room Settings and clicks **Revoke** on the active invite token.
  - Device C attempts to join using the revoked token.
  - Expected: HTTP 403 Forbidden:
    `"This invitation has been revoked by the room host."`
- [ ] **4.4 Room Capacity Cap:**
  - Create a private room with `maxCapacity: 2`.
  - Device A (Host) and Device B (Guest) join.
  - Device C attempts to join with a valid invite token.
  - Expected: HTTP 400 Bad Request:
    `"Room has reached its maximum participant capacity."`

---

### Test Suite 5: Synchronized Video Playback Across Networks
- [ ] **5.1 Initial Load Sync:**
  - Device A loads YouTube video URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`.
  - Device B's player automatically loads the identical YouTube video.
- [ ] **5.2 Play Synchronization:**
  - Device A presses **Play**.
  - Expected: Device B starts playing within 300ms.
- [ ] **5.3 Pause Synchronization:**
  - Device A presses **Pause**.
  - Expected: Device B pauses immediately.
- [ ] **5.4 Seek / Scrub Synchronization:**
  - Device A seeks the progress bar to `01:45`.
  - Expected: Device B seeks to `01:45` (timestamp difference < 0.5s).
- [ ] **5.5 Emergency Pause:**
  - Device A clicks the red **Emergency Pause** button.
  - Expected:
    - Global red banner displays on both Device A and Device B: `"Emergency Pause Triggered by Host"`.
    - Video halts across all connected devices immediately.
    - Play button is disabled until host resumes.

---

### Test Suite 6: Real-Time Chat & Moderation
- [ ] **6.1 Instant Chat Delivery:**
  - Device A sends: `"Welcome to the premiere!"`.
  - Expected: Message appears in Device B's chat drawer instantaneously (< 150ms).
- [ ] **6.2 Host Moderation Kick:**
  - Device A opens the Participant List, clicks the options menu next to Device B, and selects **Kick Participant**.
  - Expected:
    - Device B receives a modal: `"You have been kicked from the room by the host"`.
    - Device B is disconnected and redirected to `/dashboard`.
    - Device A's participant count drops from 2 to 1 immediately.

---

### Test Suite 7: LiveKit WebRTC Voice & Video
- [ ] **7.1 Permissions & Track Publishing:**
  - On Device A and Device B, click **Connect Voice & Video**.
  - Grant browser microphone and camera permissions.
  - Expected:
    - Local video preview displays in the grid.
    - Remote participant's video and audio stream display on the other device.
- [ ] **7.2 Active Speaker & Mute Indicators:**
  - Speak into Device A.
  - Expected: Device A's avatar border highlights green on Device B.
  - Toggle **Mute** on Device A.
  - Expected: Muted icon reflects on Device B.
- [ ] **7.3 Hardware Teardown (LED Safety):**
  - Click **Disconnect** in the Voice/Video panel on Device A.
  - Expected:
    - LiveKit session closes.
    - Physical camera and microphone LEDs on Device A turn off completely (`track.stop()` verified).
- [ ] **7.4 Reconnection Resilience:**
  - On Device B, toggle Airplane Mode for 4 seconds, then toggle off.
  - Expected: Socket.IO and LiveKit automatically re-establish connection without requiring a full page refresh.

---

## 3. Test Sign-Off Checklist

| Test Phase | Tester Name | Date | Status (Pass/Fail) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Phase 1: Auth & Private Rooms | | | | |
| Phase 2: Invite Link Generation | | | | |
| Phase 3: Cross-Network Guest Join | | | | |
| Phase 4: Negative Security Tests | | | | |
| Phase 5: Video Sync (±0.5s) | | | | |
| Phase 6: Chat & Moderation Kick | | | | |
| Phase 7: LiveKit WebRTC Audio/Video | | | | |
