import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAppUrl, getApiBaseUrl, generateInviteUrl, sanitizeReturnUrl } from '../src/lib/api';
import { getSocketUrl } from '../src/lib/socket';

describe('Production-Ready Invitation Links & URL Resolution', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getAppUrl() resolution', () => {
    it('prioritizes NEXT_PUBLIC_APP_URL when defined', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://cinema.synctheater.com/';
      expect(getAppUrl()).toBe('https://cinema.synctheater.com');
    });

    it('falls back to window.location.origin in browser environment', () => {
      delete process.env.NEXT_PUBLIC_APP_URL;

      // jsdom provides window.location
      const origin = window.location.origin;
      expect(getAppUrl()).toBe(origin);
    });

    it('strips trailing slashes from the configured app URL', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://staging.synctheater.app///';
      expect(getAppUrl()).toBe('https://staging.synctheater.app');
    });
  });

  describe('generateInviteUrl() structure', () => {
    it('formats invitation URLs as ${APP_URL}/room/ROOM_SLUG?invite=INVITATION_TOKEN', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.synctheater.com';
      const roomSlug = 'sci-fi-movie-night-42';
      const token = 'SECURE_CRYPTO_TOKEN_abc123_xyz';

      const url = generateInviteUrl(roomSlug, token);
      expect(url).toBe('https://app.synctheater.com/room/sci-fi-movie-night-42?invite=SECURE_CRYPTO_TOKEN_abc123_xyz');
    });

    it('safely URI-encodes slug and token parameters', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.synctheater.com';
      const roomSlug = 'classic film & party';
      const token = 'token+with/special=chars';

      const url = generateInviteUrl(roomSlug, token);
      expect(url).toBe('https://app.synctheater.com/room/classic%20film%20%26%20party?invite=token%2Bwith%2Fspecial%3Dchars');
    });

    it('produces cross-network compatible absolute URLs', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://192.168.1.150:3000';
      const url = generateInviteUrl('lan-watch-party', 'lan-token-999');
      expect(url.startsWith('http://192.168.1.150:3000/room/')).toBe(true);
      expect(url).toContain('?invite=lan-token-999');
    });
  });

  describe('getApiBaseUrl() and getSocketUrl() dynamic fallback', () => {
    it('prioritizes NEXT_PUBLIC_API_URL and NEXT_PUBLIC_SOCKET_URL', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.synctheater.com/';
      process.env.NEXT_PUBLIC_SOCKET_URL = 'https://ws.synctheater.com/';

      expect(getApiBaseUrl()).toBe('https://api.synctheater.com');
      expect(getSocketUrl()).toBe('https://ws.synctheater.com');
    });

    it('falls back to window hostname on port 8000 when variables are omitted', () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      delete process.env.NEXT_PUBLIC_SOCKET_URL;

      const expected = `${window.location.protocol}//${window.location.hostname}:8000`;
      expect(getApiBaseUrl()).toBe(expected);
      expect(getSocketUrl()).toBe(expected);
    });
  });

  describe('Unauthenticated recipient returnUrl flow & Open Redirect Prevention', () => {
    it('constructs correct returnUrl query parameter preserving invite token', () => {
      const slug = 'cyberpunk-session';
      const token = 'invite-token-xyz-789';
      const destination = `/room/${slug}?invite=${encodeURIComponent(token)}`;

      const loginRedirect = `/login?returnUrl=${encodeURIComponent(destination)}`;
      expect(loginRedirect).toContain('returnUrl=%2Froom%2Fcyberpunk-session%3Finvite%3Dinvite-token-xyz-789');

      // Verify that decoding restores the exact target
      const parsedUrl = new URL(loginRedirect, 'https://example.com');
      const returnUrl = parsedUrl.searchParams.get('returnUrl');
      expect(returnUrl).toBe('/room/cyberpunk-session?invite=invite-token-xyz-789');
    });

    it('sanitizes returnUrl and prevents protocol-relative open redirect attacks', () => {
      // Valid relative paths
      expect(sanitizeReturnUrl('/room/sci-fi?invite=abc')).toBe('/room/sci-fi?invite=abc');
      expect(sanitizeReturnUrl('/dashboard')).toBe('/dashboard');

      // Malicious protocol-relative or backslash open redirect attempts
      expect(sanitizeReturnUrl('//evil.com/phish')).toBeNull();
      expect(sanitizeReturnUrl('/\\evil.com/phish')).toBeNull();
      expect(sanitizeReturnUrl('https://evil.com/phish')).toBeNull();
      expect(sanitizeReturnUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeReturnUrl('')).toBeNull();
      expect(sanitizeReturnUrl(null)).toBeNull();
    });
  });
});
