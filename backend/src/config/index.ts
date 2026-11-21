import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory or root directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8000', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN || '',
  maxRoomCapacity: parseInt(process.env.MAX_ROOM_CAPACITY || '50', 10),
  invitationTokenTtlHours: parseInt(process.env.INVITATION_TOKEN_TTL_HOURS || '72', 10),
  jwt: {
    secret: process.env.JWT_SECRET || 'synctheater-super-secret-jwt-key-2026-production',
    expiresIn: process.env.JWT_EXPIRATION || '7d',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/synctheater',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    enabled: process.env.REDIS_ENABLED === 'true',
  },
  livekit: {
    url: process.env.LIVEKIT_URL || 'https://synctheater.livekit.cloud',
    apiKey: process.env.LIVEKIT_API_KEY || 'devkey',
    apiSecret: process.env.LIVEKIT_API_SECRET || 'secret_synctheater_livekit_development_key_2026',
  },
};

export function validateProductionConfig(customEnv?: string, customSecret?: string, customCorsOrigin?: string): void {
  const currentEnv = customEnv !== undefined ? customEnv : (process.env.NODE_ENV || config.env);
  const currentSecret =
    customSecret !== undefined
      ? customSecret
      : (process.env.JWT_SECRET || (currentEnv === 'production' ? '' : config.jwt.secret));

  if (currentEnv === 'production') {
    const knownInsecureSecrets = [
      'synctheater-super-secret-jwt-key-2026-production',
      'synctheater-super-secret-jwt-key-change-in-production-2026',
      'secret',
      'changeme',
      'jwtsecret',
      'development',
      'test',
      'password',
    ];

    if (!currentSecret || currentSecret.trim() === '') {
      throw new Error(
        '[Security Exception] Fatal startup failure: In production (NODE_ENV=production), JWT_SECRET environment variable is missing. A secure, random 32+ character secret is strictly required.'
      );
    }

    if (knownInsecureSecrets.includes(currentSecret.trim().toLowerCase())) {
      throw new Error(
        '[Security Exception] Fatal startup failure: In production (NODE_ENV=production), JWT_SECRET is set to an insecure development default. Please set a unique, cryptographically strong secret in production.'
      );
    }

    if (currentSecret.length < 32) {
      throw new Error(
        `[Security Exception] Fatal startup failure: In production (NODE_ENV=production), JWT_SECRET must be at least 32 characters long for cryptographic security (current length: ${currentSecret.length}).`
      );
    }

    const currentCors =
      customCorsOrigin !== undefined
        ? customCorsOrigin
        : (process.env.CORS_ORIGIN || config.corsOrigin || process.env.CLIENT_URL || config.clientUrl);

    if (currentCors === '*' || currentCors.includes('*')) {
      throw new Error(
        '[Security Exception] Fatal startup failure: In production (NODE_ENV=production), CORS wildcard "*" is strictly prohibited. Set CORS_ORIGIN or CLIENT_URL to explicit production origins.'
      );
    }
  }
}

