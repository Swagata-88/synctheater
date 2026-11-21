# SYNCTHEATER — REST API Documentation

Base URL: `http://localhost:8000/api` (or custom `API_BASE_URL` in production)

All requests and responses use `application/json`. Authenticated routes require an `Authorization: Bearer <JWT_TOKEN>` header.

---

## 1. Authentication Endpoints (`/api/auth`)

### `POST /api/auth/register`
Creates a new user account with hashed password and initial profile/preferences.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "username": "CinemaHost42",
    "password": "SecurePassword123!"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Registration successful! Welcome to SYNCTHEATER.",
    "user": {
      "id": "c1f7a28...",
      "email": "user@example.com",
      "username": "CinemaHost42",
      "role": "USER",
      "createdAt": "2026-11-21T03:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### `POST /api/auth/login`
Authenticates a user with email or username and password.
- **Request Body**:
  ```json
  {
    "identifier": "user@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### `GET /api/auth/me`
Retrieves current authenticated session, profile, and preferences.
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
  ```json
  {
    "user": { "id": "...", "email": "...", "username": "..." },
    "profile": { "avatarUrl": "...", "bio": "..." },
    "preferences": {
      "theme": "dark",
      "accentColor": "#6366f1",
      "theaterSetting": "classic",
      "audioVolume": 0.8
    }
  }
  ```

### `POST /api/auth/forgot-password`
Initiates password recovery instructions and token generation.
- **Request Body**: `{ "email": "user@example.com" }`

### `POST /api/auth/reset-password`
Resets password given a valid reset token.
- **Request Body**: `{ "token": "...", "newPassword": "NewPassword123!" }`

---

## 2. User & Profile Endpoints (`/api/users`)

### `PATCH /api/users/profile`
Updates username, avatar URL, or bio. Prevents username conflicts.
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "username": "NewUsername",
    "avatarUrl": "https://api.dicebear.com/7.x/bottts/svg?seed=Cinema1",
    "bio": "Watching classic movies together."
  }
  ```

### `PATCH /api/users/preferences`
Saves user preferences (theater ambience environment, volume, color theme).
- **Request Body**:
  ```json
  {
    "theaterSetting": "gaming",
    "audioVolume": 0.9
  }
  ```

---

## 3. Room Management Endpoints (`/api/rooms`)

### `GET /api/rooms/public`
Lists public cinema rooms with live participant counts and current video information.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "rooms": [
      {
        "id": "...",
        "slug": "classic-scifi-night-a1b2c",
        "name": "Classic Sci-Fi Night",
        "description": "Relaxed evening watching ambient sci-fi.",
        "privacy": "PUBLIC",
        "participantCount": 8,
        "maxCapacity": 50,
        "currentProvider": "YOUTUBE",
        "currentVideoId": "dQw4w9WgXcQ"
      }
    ]
  }
  ```

### `POST /api/rooms`
Creates a new watch-party theater.
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "name": "Weekend Anime Marathon",
    "description": "Syncing episodes with live voice chat",
    "privacy": "PUBLIC",
    "password": "",
    "maxCapacity": 25,
    "initialVideoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }
  ```

### `GET /api/rooms/:slug`
Fetches room metadata and current participant roster.

### `POST /api/rooms/:slug/join`
Enters the room, checking password if private and validating capacity limits.

### `POST /api/rooms/:slug/leave`
Leaves the room; handles owner failover if owner departs.

### `POST /api/rooms/:slug/kick`
Host or Moderator kicks a participant.

### `POST /api/rooms/:slug/transfer-owner`
Transfers room ownership to another participant.

---

## 4. Video Source Resolution (`/api/video`)

### `POST /api/video/resolve`
Analyzes any media URL, identifies provider, extracts IDs, and generates preview embeds.
- **Request Body**:
  ```json
  { "url": "https://youtu.be/dQw4w9WgXcQ" }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "provider": "YOUTUBE",
    "videoId": "dQw4w9WgXcQ",
    "originalUrl": "https://youtu.be/dQw4w9WgXcQ",
    "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ?enablejsapi=1...",
    "title": "YouTube Video [dQw4w9WgXcQ]",
    "isSupported": true
  }
  ```

---

## 5. LiveKit WebRTC Voice/Video (`/api/livekit`)

### `GET /api/livekit/token?room=:roomSlug`
Generates short-lived WebRTC access token for voice/video channels.
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1Ni...",
    "serverUrl": "https://synctheater.livekit.cloud",
    "isConfigured": true
  }
  ```
