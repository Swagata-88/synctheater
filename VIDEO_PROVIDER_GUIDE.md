# SYNCTHEATER — Video Provider Architecture Guide

SYNCTHEATER decouples video streaming bandwidth from backend servers. Video is pulled directly by each participant from source CDNs while the backend orchestrates playback state.

---

## Supported Providers

### 1. YouTube & YouTube Shorts (`YOUTUBE`)
- **Supported Formats**:
  - `https://www.youtube.com/watch?v=VIDEO_ID`
  - `https://youtu.be/VIDEO_ID`
  - `https://www.youtube.com/shorts/VIDEO_ID`
  - `https://www.youtube.com/embed/VIDEO_ID`
- **Engine**: Official YouTube IFrame Player API.
- **Features**: Exact millisecond seek, play/pause synchronization, auto-quality negotiation, mobile compatibility.
- **Embedding Policy**: Respects YouTube content owners. Videos with embedding disabled by creator will show a native notice.

### 2. Google Drive (`GOOGLE_DRIVE`)
- **Supported Formats**:
  - `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`
  - `https://drive.google.com/file/d/FILE_ID`
  - `https://drive.google.com/open?id=FILE_ID`
- **Engine**: Google Drive Media Preview Embed.
- **Permissions**: Requires the file's sharing permission to be configured as *"Anyone with the link can view"*.

### 3. Direct HTML5 Video (`DIRECT`)
- **Supported Formats**: Direct accessible video URLs ending in `.mp4`, `.webm`, `.ogv`, `.m4v`.
- **Engine**: Native HTML5 `<video>` tag with hardware acceleration.
- **Features**: Sub-millisecond drift correction, custom volume/gain, native playback rate control.

### 4. HTTP Live Streaming (`HLS`)
- **Supported Formats**: `.m3u8` playlist manifests.
- **Engine**: `hls.js` adaptive bitrate streaming engine with Apple Safari native HLS fallback.
- **Features**: Adaptive resolution switching, low-latency live and VOD watch parties.

---

## Adding New Video Providers

SYNCTHEATER is designed to be easily extensible. To implement a new provider (e.g. Vimeo, Dailymotion, PeerTube):

1. **Backend Resolver**:
   Add provider pattern matching to `backend/src/modules/video/video.service.ts`:
   ```typescript
   // Extract identifier and return ResolvedVideoSource
   if (url.includes('vimeo.com')) {
     return {
       provider: 'VIMEO',
       videoId: extractVimeoId(url),
       originalUrl: url,
       embedUrl: `https://player.vimeo.com/video/${id}`,
       title: `Vimeo Video [${id}]`,
       isSupported: true
     };
   }
   ```

2. **Frontend Adapter**:
   Update `frontend/src/components/theater/VideoPlayer.tsx` to mount the respective player SDK or iframe, attaching the `onTimeUpdate` and drift correction callbacks.
