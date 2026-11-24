import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { authService } from '../src/modules/auth/auth.service';
import { passwordResetRateLimiter } from '../src/modules/auth/rate.limiter';

describe('Password Recovery Security & API Verification', () => {
  beforeEach(() => {
    // Reset rate limiter between tests to prevent cross-test contamination
    passwordResetRateLimiter.reset();
  });

  it('never exposes raw resetToken or sensitive fields in public forgot-password API response', async () => {
    const email = `security_exposure_${Date.now()}@synctheater.com`;
    const username = `sec_user_${Date.now()}`;
    await authService.register({
      email,
      username,
      password: 'StrongPassword123!',
    });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBeDefined();

    // Verify token is NOT exposed in response payload
    expect(res.body.resetToken).toBeUndefined();
    expect(res.body.token).toBeUndefined();
    expect(res.body.rawToken).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('resetToken');
    expect(JSON.stringify(res.body)).not.toContain('rawToken');
  });

  it('returns an identical generic response for both registered and unregistered email addresses', async () => {
    const registeredEmail = `registered_${Date.now()}@synctheater.com`;
    await authService.register({
      email: registeredEmail,
      username: `reg_${Date.now()}`,
      password: 'Password123!',
    });

    const unregEmail = `unregistered_${Date.now()}@synctheater.com`;

    const resRegistered = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: registeredEmail });

    const resUnregistered = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: unregEmail });

    expect(resRegistered.status).toBe(200);
    expect(resUnregistered.status).toBe(200);
    expect(resRegistered.body.message).toBe(resUnregistered.body.message);
    expect(resRegistered.body.success).toBe(true);
    expect(resUnregistered.body.success).toBe(true);
  });

  it('enforces rate limiting on password-reset endpoints and blocks after 5 requests', async () => {
    const testEmail = `ratelimit_test_${Date.now()}@synctheater.com`;

    // Make 5 permitted requests
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testEmail });
      expect(res.status).toBe(200);
    }

    // 6th request must be blocked with HTTP 429 Too Many Requests
    const blockedRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: testEmail });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error).toContain('Too many password reset attempts');
    expect(blockedRes.headers['retry-after']).toBeDefined();
  });

  it('allows rate limit bypass when authorized x-bypass-rate-limit header is present', async () => {
    const testEmail = `bypass_test_${Date.now()}@synctheater.com`;

    // Consume all 5 quota units
    for (let i = 1; i <= 5; i++) {
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testEmail });
    }

    // Request with bypass header must succeed
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .set('x-bypass-rate-limit', 'true')
      .send({ email: testEmail });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects invalid or expired reset token on POST /api/auth/reset-password', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .set('x-bypass-rate-limit', 'true')
      .send({
        token: 'invalid-non-existent-token-1234567890',
        newPassword: 'BrandNewSecurePassword123!',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid or expired password reset token');
  });

  it('rejects passwords shorter than 8 characters or exceeding 128 characters on reset', async () => {
    const resShort = await request(app)
      .post('/api/auth/reset-password')
      .set('x-bypass-rate-limit', 'true')
      .send({
        token: 'some-token',
        newPassword: 'short12', // 7 chars
      });

    expect(resShort.status).toBe(400);
    expect(resShort.body.error).toContain('at least 8 characters');

    const resLong = await request(app)
      .post('/api/auth/reset-password')
      .set('x-bypass-rate-limit', 'true')
      .send({
        token: 'some-token',
        newPassword: 'a'.repeat(129),
      });

    expect(resLong.status).toBe(400);
    expect(resLong.body.error).toContain('cannot exceed 128 characters');
  });

  it('strictly ignores x-bypass-rate-limit header in production mode and enforces rate limiting', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      // Simulate production mode
      process.env.NODE_ENV = 'production';
      const testEmail = `prod_bypass_${Date.now()}@synctheater.com`;

      // Exhaust 5 allowed requests
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post('/api/auth/forgot-password')
          .set('x-bypass-rate-limit', 'true')
          .send({ email: testEmail });
      }

      // 6th request with bypass header MUST be rejected in production
      const blockedRes = await request(app)
        .post('/api/auth/forgot-password')
        .set('x-bypass-rate-limit', 'true')
        .send({ email: testEmail });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error).toContain('Too many password reset attempts');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('atomically prevents concurrent token reuse: simultaneous requests with same token results in exactly one success', async () => {
    const email = `concurrency_${Date.now()}@synctheater.com`;
    const username = `concurrent_user_${Date.now()}`;
    await authService.register({
      email,
      username,
      password: 'InitialPassword123!',
    });

    const { rawToken } = await authService.requestPasswordReset(email);
    expect(rawToken).toBeDefined();

    // Fire 2 concurrent password resets with the exact same token simultaneously
    const [result1, result2] = await Promise.allSettled([
      authService.resetPassword(rawToken!, 'ConcurrentNewPassOne1!'),
      authService.resetPassword(rawToken!, 'ConcurrentNewPassTwo2!'),
    ]);

    const successes = [result1, result2].filter((r) => r.status === 'fulfilled');
    const failures = [result1, result2].filter((r) => r.status === 'rejected');

    // Exactly 1 request must succeed; the other must be rejected
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const failureReason = (failures[0] as PromiseRejectedResult).reason;
    expect(failureReason.message).toContain('Invalid or expired password reset token');
  }, 20000);

  it('completes secure end-to-end password reset without leaking token in API responses', async () => {
    const email = `e2e_secure_${Date.now()}@synctheater.com`;
    const username = `e2e_user_${Date.now()}`;
    await authService.register({
      email,
      username,
      password: 'OriginalPassword123!',
    });

    // Request password reset via public API endpoint
    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .set('x-bypass-rate-limit', 'true')
      .send({ email });

    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.resetToken).toBeUndefined();

    // Retrieve raw token via server-side service dispatch (simulating user clicking link from email)
    const { rawToken } = await authService.requestPasswordReset(email);
    expect(rawToken).toBeDefined();

    // Reset password using the token
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .set('x-bypass-rate-limit', 'true')
      .send({
        token: rawToken!,
        newPassword: 'NewUpdatedPassword456!',
      });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // Verify login with new password succeeds
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        identifier: email,
        password: 'NewUpdatedPassword456!',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();

    // Verify token is single-use and cannot be used a second time
    const secondResetRes = await request(app)
      .post('/api/auth/reset-password')
      .set('x-bypass-rate-limit', 'true')
      .send({
        token: rawToken!,
        newPassword: 'YetAnotherPassword789!',
      });

    expect(secondResetRes.status).toBe(400);
    expect(secondResetRes.body.error).toContain('Invalid or expired password reset token');
  }, 20000);

  it('reports SMTP configuration status in /api/health endpoint without leaking secrets', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.smtpConfigured).toBe('boolean');
    // Ensure no secrets exist in health check response
    expect(res.body.smtpPass).toBeUndefined();
    expect(res.body.jwtSecret).toBeUndefined();
  });
});
