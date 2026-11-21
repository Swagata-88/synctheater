# SYNCTHEATER — WebSocket & Real-Time Synchronization Protocol

All real-time room communication operates over **Socket.IO** (`ws://localhost:8000` or production domain) using server-authoritative state distribution.

---

## 1. Handshake & Authentication

Clients pass their JWT Bearer token in the handshake auth object or headers:
```javascript
const socket = io('http://localhost:8000', {
  auth: { token: 'eyJhbGci...' }
});
```

---

## 2. Client-to-Server Events

| Event | Payload | Permissions | Description |
|---|---|---|---|
| `JOIN_ROOM` | `{ roomSlug: string }` | Public / Password | Joins socket room channel `room:<slug>` and requests initial room snapshot. |
| `PLAY` | `{ reportedPosition?: number }` | Owner / Moderator | Resumes video playback; updates server timestamp and increments sequence number. |
| `PAUSE` | `{ reportedPosition?: number }` | Owner / Moderator | Pauses video playback across all clients. |
| `SEEK` | `{ targetPosition: number }` | Owner / Moderator | Jumps playback to target time; broadcasts new calculated position. |
| `CHANGE_VIDEO` | `{ videoUrl: string }` | Owner / Moderator | Replaces current video source; validates URL, resets position to 0, pauses. |
| `CHANGE_PLAYBACK_RATE`| `{ rate: number }` | Owner / Moderator | Sets playback speed (0.25x – 2.5x). |
| `EMERGENCY_PAUSE` | `{}` | **ANY Participant** | **Halts playback for all clients instantly**. Emits banner announcing requester. |
| `RESUME_FROM_EMERGENCY`| `{}` | Owner / Moderator | Clears Emergency Pause and resumes synchronized playback. |
| `REQUEST_SYNC` | `{}` | Any Viewer | Solicits current calculated state for drift verification or re-sync. |
| `SEND_CHAT_MESSAGE` | `{ content: string }` | Any Viewer | Posts room chat message (persisted in DB; broadcast to room). |
| `SEND_REACTION` | `{ emoji: string }` | Any Viewer | Sends floating cinema emoji reaction (e.g. 🍿, ❤️, 🔥, 👏). |

---

## 3. Server-to-Client Events

### `INITIAL_ROOM_STATE`
Emitted directly to a client upon successful `JOIN_ROOM`:
```json
{
  "room": { ... },
  "playbackState": {
    "provider": "YOUTUBE",
    "videoId": "dQw4w9WgXcQ",
    "status": "PLAYING",
    "currentPosition": 124.5,
    "calculatedPosition": 132.8,
    "playbackRate": 1.0,
    "lastServerTimestamp": 1795324800000,
    "sequenceNumber": 14,
    "isEmergencyPaused": false
  },
  "participants": [ ... ],
  "messages": [ ... ]
}
```

### `SYNC_STATE`
Broadcast to all sockets in the room whenever playback changes or seeks:
```json
{
  "provider": "YOUTUBE",
  "videoId": "dQw4w9WgXcQ",
  "status": "PLAYING",
  "currentPosition": 124.5,
  "calculatedPosition": 132.8,
  "playbackRate": 1.0,
  "lastServerTimestamp": 1795324800000,
  "sequenceNumber": 15,
  "isEmergencyPaused": false
}
```

### `EMERGENCY_PAUSE_TRIGGERED`
Broadcast when any user triggers Emergency Pause:
```json
{
  "triggeredBy": {
    "userId": "user-489",
    "username": "ConcernedViewer"
  },
  "playbackState": {
    "status": "PAUSED",
    "isEmergencyPaused": true,
    "emergencyPausedBy": { "userId": "user-489", "username": "ConcernedViewer" },
    "sequenceNumber": 16
  }
}
```

### `NEW_CHAT_MESSAGE`
Broadcast on incoming chat message:
```json
{
  "id": "msg-992",
  "roomId": "room-12",
  "userId": "user-489",
  "username": "ConcernedViewer",
  "avatarUrl": "https://...",
  "content": "This scene is legendary!",
  "isSystem": false,
  "createdAt": "2026-11-21T03:45:00Z"
}
```

### `NEW_REACTION`
Broadcast to display floating cinema animations:
```json
{
  "id": "rx-338",
  "emoji": "🍿",
  "username": "CinemaHost",
  "timestamp": 1795324850000
}
```
