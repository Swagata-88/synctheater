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

  it('passes validation when NODE_ENV=production and a high-entropy secret >= 32 chars is provided', () => {
    expect(() => {
      validateProductionConfig('production', 'a9f24c8b3d1e7045b182f093d56e71c94b281f6e073d8a5c2194b63e80f12d4a');
    }).not.toThrow();
  });

  it('preserves convenient development configuration when NODE_ENV=development', () => {
    expect(() => {
      validateProductionConfig('development', 'synctheater-super-secret-jwt-key-2026-production');
    }).not.toThrow();
  });

  it('rejects CORS wildcard in production mode', () => {
    expect(() => {
      validateProductionConfig('production', 'a9f24c8b3d1e7045b182f093d56e71c94b281f6e073d8a5c2194b63e80f12d4a', '*');
    }).toThrowError(/CORS wildcard "\*" is strictly prohibited/);
  });
});
