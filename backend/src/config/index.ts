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
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'SYNCTHEATER <noreply@synctheater.com>',
  },
};

export function isSmtpConfigured(): boolean {
  return Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
}

export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '***@***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export function validateProductionConfig(
  customEnv?: string,
  customSecret?: string,
  customCorsOrigin?: string,
  customClientUrl?: string,
  customSmtpConfigured?: boolean,
  customSmtpFrom?: string
): void {
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

    const currentClientUrl =
      customClientUrl !== undefined ? customClientUrl : (process.env.CLIENT_URL || config.clientUrl);

    if (
      !currentClientUrl ||
      currentClientUrl.includes('localhost') ||
      !currentClientUrl.startsWith('https://')
    ) {
      throw new Error(
        `[Security Exception] Fatal startup failure: In production (NODE_ENV=production), CLIENT_URL must be an explicitly configured, secure HTTPS origin (current: "${currentClientUrl}"). Plaintext HTTP and localhost origins are strictly prohibited.`
      );
    }

    const isSmtpReady =
      customSmtpConfigured !== undefined ? customSmtpConfigured : isSmtpConfigured();

    if (!isSmtpReady) {
      throw new Error(
        '[Security Exception] Fatal startup failure: In production (NODE_ENV=production), SMTP email credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are strictly required for secure password recovery.'
      );
    }

    const currentSmtpFrom =
      customSmtpFrom !== undefined ? customSmtpFrom : process.env.SMTP_FROM;

    if (!currentSmtpFrom || !currentSmtpFrom.trim() || !currentSmtpFrom.includes('@')) {
      throw new Error(
        '[Security Exception] Fatal startup failure: In production (NODE_ENV=production), SMTP_FROM must be explicitly configured with a verified sender email address matching your SMTP provider domain.'
      );
    }
  }
}

