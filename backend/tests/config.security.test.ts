import { describe, it, expect } from 'vitest';
import { validateProductionConfig } from '../src/config';

describe('Production JWT Security & Configuration Validation', () => {
  it('throws fatal startup error when NODE_ENV=production and JWT_SECRET is missing', () => {
    expect(() => {
      validateProductionConfig('production', '');
    }).toThrowError(/JWT_SECRET environment variable is missing/);
  });

  it('throws fatal startup error when NODE_ENV=production and JWT_SECRET is an insecure default', () => {
    expect(() => {
      validateProductionConfig('production', 'synctheater-super-secret-jwt-key-2026-production');
    }).toThrowError(/JWT_SECRET is set to an insecure development default/);

    expect(() => {
      validateProductionConfig('production', 'secret');
    }).toThrowError(/JWT_SECRET is set to an insecure development default/);
  });

  it('throws fatal startup error when NODE_ENV=production and JWT_SECRET is less than 32 characters', () => {
    expect(() => {
      validateProductionConfig('production', 'short-secret-under-32-chars!');
    }).toThrowError(/at least 32 characters long/);
  });

  it('passes validation when NODE_ENV=production and all production requirements are satisfied', () => {
    expect(() => {
      validateProductionConfig(
        'production',
        'a9f24c8b3d1e7045b182f093d56e71c94b281f6e073d8a5c2194b63e80f12d4a',
        'https://synctheater.com',
        'https://synctheater.com',
        true,
        'SYNCTHEATER <noreply@synctheater.com>'
      );
    }).not.toThrow();
  });

  it('preserves convenient development configuration when NODE_ENV=development', () => {
    expect(() => {
      validateProductionConfig('development', 'synctheater-super-secret-jwt-key-2026-production');
    }).not.toThrow();
  });

  it('rejects CORS wildcard in production mode', () => {
    expect(() => {
      validateProductionConfig(
        'production',
        'a9f24c8b3d1e7045b182f093d56e71c94b281f6e073d8a5c2194b63e80f12d4a',
        '*',
        'https://synctheater.com',
        true,
        'noreply@synctheater.com'
      );
    }).toThrowError(/CORS wildcard "\*" is strictly prohibited/);
  });

  it('rejects localhost and non-HTTPS CLIENT_URL in production mode', () => {
    expect(() => {
      validateProductionConfig(
        'production',
        'a9f24c8b3d1e7045b182f093d56e71c94b281f6e073d8a5c2194b63e80f12d4a',
        'https://synctheater.com',
        'http://localhost:3000',
        true,
        'noreply@synctheater.com'
      );
    }).toThrowError(/CLIENT_URL must be an explicitly configured, secure HTTPS origin/);

    expect(() => {
      validateProductionConfig(
        'production',
        'a9f24c8b3d1e7045b182f093d56e71c94b281f6e073d8a5c2194b63e80f12d4a',
        'https://synctheater.com',
        'http://insecure-http-url.com',
        true,
        'noreply@synctheater.com'
      );
    }).toThrowError(/CLIENT_URL must be an explicitly configured, secure HTTPS origin/);
  });

  it('rejects missing SMTP credentials in production mode', () => {
    expect(() => {
      validateProductionConfig(
        'production',
        'a9f24c8b3d1e7045b182f093d56e71c94b281f6e073d8a5c2194b63e80f12d4a',
        'https://synctheater.com',
        'https://synctheater.com',
        false,
        'noreply@synctheater.com'
      );
    }).toThrowError(/SMTP email credentials.*are strictly required/);
  });

  it('rejects invalid or missing SMTP_FROM sender address in production mode', () => {
    expect(() => {
      validateProductionConfig(
        'production',
        'a9f24c8b3d1e7045b182f093d56e71c94b281f6e073d8a5c2194b63e80f12d4a',
        'https://synctheater.com',
        'https://synctheater.com',
        true,
        'invalid-sender-no-at-sign'
      );
    }).toThrowError(/SMTP_FROM must be explicitly configured with a verified sender email address/);

    expect(() => {
      validateProductionConfig(
        'production',
        'a9f24c8b3d1e7045b182f093d56e71c94b281f6e073d8a5c2194b63e80f12d4a',
        'https://synctheater.com',
        'https://synctheater.com',
        true,
        undefined
      );
    }).toThrowError(/SMTP_FROM must be explicitly configured with a verified sender email address/);
  });
});
