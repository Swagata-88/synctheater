import { describe, it, expect } from 'vitest';
import { videoService } from '../src/modules/video/video.service';

describe('VideoService Provider Resolution', () => {
  it('correctly extracts standard YouTube watch URLs', () => {
    const res = videoService.resolveUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('YOUTUBE');
    expect(res.videoId).toBe('dQw4w9WgXcQ');
    expect(res.embedUrl).toContain('dQw4w9WgXcQ');
  });

  it('correctly extracts youtu.be short URLs', () => {
    const res = videoService.resolveUrl('https://youtu.be/dQw4w9WgXcQ?si=abcdef123');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('YOUTUBE');
    expect(res.videoId).toBe('dQw4w9WgXcQ');
  });

  it('correctly extracts YouTube Shorts URLs', () => {
    const res = videoService.resolveUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('YOUTUBE');
    expect(res.videoId).toBe('dQw4w9WgXcQ');
  });

  it('correctly resolves Google Drive sharing links', () => {
    const res = videoService.resolveUrl('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIvE2up0/view?usp=sharing');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('GOOGLE_DRIVE');
    expect(res.videoId).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIvE2up0');
    expect(res.embedUrl).toContain('/preview');
  });

  it('correctly identifies direct MP4 video URLs', () => {
    const res = videoService.resolveUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('DIRECT');
  });

  it('correctly identifies HLS .m3u8 streaming links', () => {
    const res = videoService.resolveUrl('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
    expect(res.isSupported).toBe(true);
    expect(res.provider).toBe('HLS');
  });

  it('returns clean error message for unsupported websites', () => {
    const res = videoService.resolveUrl('https://unknown-streaming-site.fake/video-xyz');
    expect(res.isSupported).toBe(false);
    expect(res.provider).toBe('UNSUPPORTED');
    expect(res.notes).toBeDefined();
  });
});
