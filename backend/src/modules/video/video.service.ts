import { VideoProviderType, PlaybackMode, BroadcastStatus } from '../../database/types';
import { config } from '../../config';

export interface ResolvedVideoSource {
  provider: VideoProviderType;
  videoId: string;
  originalUrl: string;
  embedUrl: string;
  title: string;
  isSupported: boolean;
  playbackMode: PlaybackMode;
  broadcastStatus?: BroadcastStatus;
  notes?: string;
}

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const YOUTU_BE_HOSTS = new Set(['youtu.be', 'www.youtu.be']);

export class VideoService {
  private static instance: VideoService;

  public static getInstance(): VideoService {
    if (!VideoService.instance) {
      VideoService.instance = new VideoService();
    }
    return VideoService.instance;
  }

  public resolveUrl(url: string): ResolvedVideoSource {
    const trimmed = (url || '').trim();
    if (!trimmed) {
      return {
        provider: 'UNSUPPORTED',
        videoId: '',
        originalUrl: url,
        embedUrl: '',
        title: 'Empty URL',
        isSupported: false,
        playbackMode: 'VOD',
        notes: 'Please paste a valid video URL.',
      };
    }

    // 1. YouTube detection
    const ytInfo = this.extractYouTubeInfo(trimmed);
    if (ytInfo) {
      const playbackMode: PlaybackMode = ytInfo.isLiveUrl ? 'LIVE' : 'VOD';
      return {
        provider: 'YOUTUBE',
        videoId: ytInfo.videoId,
        originalUrl: trimmed,
        embedUrl: `https://www.youtube.com/embed/${ytInfo.videoId}?enablejsapi=1&origin=${encodeURIComponent(
          config.clientUrl || process.env.CLIENT_URL || ''
        )}`,
        title: ytInfo.isLiveUrl
          ? `YouTube Live [${ytInfo.videoId}]`
          : `YouTube Video [${ytInfo.videoId}]`,
        isSupported: true,
        playbackMode,
        broadcastStatus: 'UNKNOWN_UNVERIFIED',
      };
    }

    // 2. Google Drive detection
    const driveMatch = this.extractGoogleDriveId(trimmed);
    if (driveMatch) {
      return {
        provider: 'GOOGLE_DRIVE',
        videoId: driveMatch,
        originalUrl: trimmed,
        embedUrl: `https://drive.google.com/file/d/${driveMatch}/preview`,
        title: `Google Drive Media [${driveMatch}]`,
        isSupported: true,
        playbackMode: 'VOD',
        notes: 'Ensure file permissions are set to "Anyone with the link can view".',
      };
    }

    // 3. HLS Streaming (.m3u8)
    if (trimmed.includes('.m3u8') || trimmed.includes('/hls/')) {
      return {
        provider: 'HLS',
        videoId: trimmed,
        originalUrl: trimmed,
        embedUrl: trimmed,
        title: 'HLS Live/VOD Stream',
        isSupported: true,
        playbackMode: 'VOD',
      };
    }

    // 4. Direct HTML5 Video (.mp4, .webm, .ogg)
    if (/\.(mp4|webm|ogv|m4v)(\?.*)?$/i.test(trimmed)) {
      const filename = trimmed.split('/').pop()?.split('?')[0] || 'Direct Video';
      return {
        provider: 'DIRECT',
        videoId: trimmed,
        originalUrl: trimmed,
        embedUrl: trimmed,
        title: decodeURIComponent(filename),
        isSupported: true,
        playbackMode: 'VOD',
      };
    }

    // 5. Unsupported
    return {
      provider: 'UNSUPPORTED',
      videoId: '',
      originalUrl: trimmed,
      embedUrl: '',
      title: 'Unsupported Source',
      isSupported: false,
      playbackMode: 'VOD',
      notes:
        'SYNCTHEATER supports YouTube videos, YouTube Live streams, YouTube Shorts, Google Drive share links, direct MP4/WebM files, and HLS .m3u8 streams.',
    };
  }

  public extractYouTubeInfo(url: string): { videoId: string; isLiveUrl: boolean } | null {
    try {
      const trimmed = (url || '').trim();
      if (!trimmed) return null;

      // Raw 11-char ID
      if (YOUTUBE_ID_REGEX.test(trimmed)) {
        return { videoId: trimmed, isLiveUrl: false };
      }

      let candidate = trimmed;
      if (
        !candidate.includes('://') &&
        /^(?:www\.|m\.|music\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be)\//i.test(candidate)
      ) {
        candidate = `https://${candidate}`;
      }

      const parsed = new URL(candidate);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }

      const host = parsed.hostname.toLowerCase();

      // youtu.be/<id>
      if (YOUTU_BE_HOSTS.has(host)) {
        const match = parsed.pathname.match(/^\/([a-zA-Z0-9_-]{11})(?:\/)?$/);
        if (match?.[1]) {
          return { videoId: match[1], isLiveUrl: false };
        }
        return null;
      }

      if (!YOUTUBE_HOSTS.has(host)) {
        return null;
      }

      // youtube.com/live/<id>
      const liveMatch = parsed.pathname.match(/^\/live\/([a-zA-Z0-9_-]{11})(?:\/)?$/);
      if (liveMatch?.[1]) {
        return { videoId: liveMatch[1], isLiveUrl: true };
      }

      // youtube.com/shorts/<id>
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})(?:\/)?$/);
      if (shortsMatch?.[1]) {
        return { videoId: shortsMatch[1], isLiveUrl: false };
      }

      // youtube.com/embed/<id>
      const embedMatch = parsed.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})(?:\/)?$/);
      if (embedMatch?.[1]) {
        return { videoId: embedMatch[1], isLiveUrl: false };
      }

      // youtube.com/watch?v=<id>
      if (parsed.pathname === '/watch' || parsed.pathname === '/watch/') {
        const vParam = parsed.searchParams.get('v');
        if (vParam && YOUTUBE_ID_REGEX.test(vParam)) {
          return { videoId: vParam, isLiveUrl: false };
        }
      }
    } catch (e) {}
    return null;
  }

  public extractYouTubeId(url: string): string | null {
    return this.extractYouTubeInfo(url)?.videoId || null;
  }

  public extractGoogleDriveId(url: string): string | null {
    try {
      // drive.google.com/file/d/<id>/...
      const fileDRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
      const match = url.match(fileDRegex);
      if (match && match[1]) return match[1];

      // drive.google.com/open?id=<id>
      const idParamRegex = /[?&]id=([a-zA-Z0-9_-]+)/;
      const matchParam = url.match(idParamRegex);
      if (url.includes('drive.google.com') && matchParam && matchParam[1]) {
        return matchParam[1];
      }
    } catch (e) {}
    return null;
  }
}

export const videoService = VideoService.getInstance();
