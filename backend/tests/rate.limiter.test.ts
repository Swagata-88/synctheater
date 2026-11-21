import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../src/modules/auth/rate.limiter';

describe('Authentication Rate Limiting Middleware', () => {
  let app: express.Express;
  let testLimiter: ReturnType<typeof createRateLimiter>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    testLimiter = createRateLimiter({
      windowMs: 2000, // 2s window for test
      max: 3,         // max 3 requests
      message: 'Too many authentication attempts.',
    });

    app.post('/api/auth/test-endpoint', testLimiter, (req, res) => {
      res.json({ success: true });
    });
  });

  it('allows requests within the configured threshold and sets rate limit headers', async () => {
    for (let i = 1; i <= 3; i++) {
      const res = await request(app).post('/api/auth/test-endpoint');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['x-ratelimit-limit']).toBe('3');
      expect(res.headers['x-ratelimit-remaining']).toBe(String(3 - i));
    }
  });

  it('blocks requests exceeding the threshold with HTTP 429 and Retry-After header', async () => {
    // Make 3 requests
    await request(app).post('/api/auth/test-endpoint');
    await request(app).post('/api/auth/test-endpoint');
    await request(app).post('/api/auth/test-endpoint');

    // 4th request must be blocked
    const blockedRes = await request(app).post('/api/auth/test-endpoint');
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error).toBe('Too many authentication attempts.');
    expect(blockedRes.body.retryAfter).toBeDefined();
    expect(blockedRes.headers['retry-after']).toBeDefined();
    expect(blockedRes.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('clears rate limits when reset is invoked', async () => {
    // Fill quota
    await request(app).post('/api/auth/test-endpoint');
    await request(app).post('/api/auth/test-endpoint');
    await request(app).post('/api/auth/test-endpoint');

    testLimiter.reset();

    // After reset, request should succeed again
    const res = await request(app).post('/api/auth/test-endpoint');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
