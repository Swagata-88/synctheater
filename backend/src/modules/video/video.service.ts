import { VideoProviderType } from '../../database/types';
import { config } from '../../config';

export interface ResolvedVideoSource {
  provider: VideoProviderType;
  videoId: string;
  originalUrl: string;
  embedUrl: string;
  title: string;
  isSupported: boolean;
  notes?: string;
}

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
        notes: 'Please paste a valid video URL.',
      };
    }

    // 1. YouTube detection
    const ytMatch = this.extractYouTubeId(trimmed);
    if (ytMatch) {
      return {
        provider: 'YOUTUBE',
        videoId: ytMatch,
        originalUrl: trimmed,
        embedUrl: `https://www.youtube.com/embed/${ytMatch}?enablejsapi=1&origin=${encodeURIComponent(
          config.clientUrl || process.env.CLIENT_URL || ''
        )}`,
        title: `YouTube Video [${ytMatch}]`,
        isSupported: true,
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
      notes:
        'SYNCTHEATER supports YouTube videos, YouTube Shorts, Google Drive share links, direct MP4/WebM files, and HLS .m3u8 streams.',
    };
  }

  public extractYouTubeId(url: string): string | null {
    try {
      // youtu.be/<id>
      const youtuBeRegex = /youtu\.be\/([a-zA-Z0-9_-]{11})/;
      const matchYoutuBe = url.match(youtuBeRegex);
      if (matchYoutuBe && matchYoutuBe[1]) return matchYoutuBe[1];

      // youtube.com/shorts/<id>
      const shortsRegex = /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/;
      const matchShorts = url.match(shortsRegex);
      if (matchShorts && matchShorts[1]) return matchShorts[1];

      // youtube.com/watch?v=<id>
      const watchRegex = /[?&]v=([a-zA-Z0-9_-]{11})/;
      const matchWatch = url.match(watchRegex);
      if (matchWatch && matchWatch[1]) return matchWatch[1];

      // youtube.com/embed/<id>
      const embedRegex = /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/;
      const matchEmbed = url.match(embedRegex);
      if (matchEmbed && matchEmbed[1]) return matchEmbed[1];

      // Raw 11-char ID
      if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
        return url;
      }
    } catch (e) {}
    return null;
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
