import { describe, it, expect } from 'vitest';
import { videoService } from '../src/modules/video/video.service';

describe('VideoService Provider Resolution', () => {
  it('correctly extracts standard YouTube watch URLs and defaults to VOD', () => {
    const res = videoService.resolveUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('YOUTUBE');
    expect(res.videoId).toBe('dQw4w9WgXcQ');
    expect(res.embedUrl).toContain('dQw4w9WgXcQ');
    expect(res.playbackMode).toBe('VOD');
    expect(res.broadcastStatus).toBe('UNKNOWN_UNVERIFIED');
  });

  it('correctly extracts youtu.be short URLs and defaults to VOD', () => {
    const res = videoService.resolveUrl('https://youtu.be/dQw4w9WgXcQ?si=abcdef123');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('YOUTUBE');
    expect(res.videoId).toBe('dQw4w9WgXcQ');
    expect(res.playbackMode).toBe('VOD');
  });

  it('correctly extracts YouTube Shorts URLs and defaults to VOD', () => {
    const res = videoService.resolveUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('YOUTUBE');
    expect(res.videoId).toBe('dQw4w9WgXcQ');
    expect(res.playbackMode).toBe('VOD');
  });

  it('correctly extracts YouTube embed URLs and defaults to VOD', () => {
    const res = videoService.resolveUrl('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('YOUTUBE');
    expect(res.videoId).toBe('dQw4w9WgXcQ');
    expect(res.playbackMode).toBe('VOD');
  });

  it('recognizes YouTube /live/ URLs with LIVE intent and UNKNOWN_UNVERIFIED broadcast status', () => {
    const res = videoService.resolveUrl('https://www.youtube.com/live/5qap5aO4i9A');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('YOUTUBE');
    expect(res.videoId).toBe('5qap5aO4i9A');
    expect(res.embedUrl).toContain('5qap5aO4i9A');
    expect(res.playbackMode).toBe('LIVE');
    expect(res.broadcastStatus).toBe('UNKNOWN_UNVERIFIED');
  });

  it('handles YouTube /live/ URLs with mobile host and query parameters without altering video ID', () => {
    const res = videoService.resolveUrl('https://m.youtube.com/live/jfKfPfyJRdk?si=xyz123&feature=share&t=45');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('YOUTUBE');
    expect(res.videoId).toBe('jfKfPfyJRdk');
    expect(res.playbackMode).toBe('LIVE');
    expect(res.broadcastStatus).toBe('UNKNOWN_UNVERIFIED');
  });

  it('does not classify normal watch?v= URLs as LIVE merely because they contain a YouTube ID', () => {
    const res = videoService.resolveUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk&ab_channel=LofiGirl');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('YOUTUBE');
    expect(res.videoId).toBe('jfKfPfyJRdk');
    expect(res.playbackMode).toBe('VOD');
  });

  it('rejects malformed YouTube URLs, invalid IDs, and unrelated domains containing YouTube-like text', () => {
    const invalidUrls = [
      'https://www.youtube.com/live/short',
      'https://www.youtube.com/live/toolong1234567',
      'https://www.youtube.com/live/',
      'https://www.youtube.com/watch?v=invalid',
      'https://evil-site.com/youtube.com/live/5qap5aO4i9A',
      'https://notyoutube.com/watch?v=dQw4w9WgXcQ',
      'https://example.com/?next=https://www.youtube.com/live/5qap5aO4i9A',
    ];

    for (const url of invalidUrls) {
      const res = videoService.resolveUrl(url);
      expect(res.isSupported).toBe(false);
      expect(res.provider).toBe('UNSUPPORTED');
      expect(res.playbackMode).toBe('VOD');
    }
  });

  it('correctly resolves Google Drive sharing links as VOD', () => {
    const res = videoService.resolveUrl('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIvE2up0/view?usp=sharing');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('GOOGLE_DRIVE');
    expect(res.videoId).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIvE2up0');
    expect(res.embedUrl).toContain('/preview');
    expect(res.playbackMode).toBe('VOD');
  });

  it('correctly identifies direct MP4 and WebM video URLs as VOD', () => {
    const mp4Res = videoService.resolveUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    expect(mp4Res.isSupported).toBe(true);
    expect(mp4Res.provider).toBe('DIRECT');
    expect(mp4Res.playbackMode).toBe('VOD');

    const webmRes = videoService.resolveUrl('https://cdn.example.com/videos/sample.webm?token=abc');
    expect(webmRes.isSupported).toBe(true);
    expect(webmRes.provider).toBe('DIRECT');
    expect(webmRes.playbackMode).toBe('VOD');
  });

  it('correctly identifies HLS .m3u8 streaming links as VOD by default', () => {
    const res = videoService.resolveUrl('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('HLS');
    expect(res.playbackMode).toBe('VOD');
  });

  it('returns clean error message for unsupported websites', () => {
    const res = videoService.resolveUrl('https://unknown-streaming-site.fake/video-xyz');
    expect(res.isSupported).toBe(false);
    expect(res.provider).toBe('UNSUPPORTED');
    expect(res.playbackMode).toBe('VOD');
    expect(res.notes).toBeDefined();
  });
});
