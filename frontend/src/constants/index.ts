// Shared Application Constants for SYNCTHEATER Frontend

export const DEFAULT_STARTER_VIDEO = {
  id: 'dQw4w9WgXcQ',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  provider: 'YOUTUBE' as const,
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'token',
  AUTH_USER: 'user',
  THEME_PREFERENCE: 'synctheater_theme',
} as const;

export const SYNC_TOLERANCE_SECONDS = 0.5;

export const DRIFT_CORRECTION_THRESHOLD = 1.0;
