import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

describe('Railway Ingress Client IP Identification & Rate Limiting Security Tests', () => {
  let app: express.Express;
  let limiter: ReturnType<typeof createRateLimiter>;

  beforeEach(() => {
    delete process.env.RAILWAY_ENVIRONMENT;
    delete process.env.TRUSTED_PROXY;
    limiter = createRateLimiter({
      windowMs: 60000,
      max: 2,
      message: 'Rate limit reached',
    });
    app = express();
    app.use(express.json());
    app.post('/api/test', limiter, (req, res) => {
      res.json({ success: true });
    });
  });

  afterEach(() => {
    delete process.env.RAILWAY_ENVIRONMENT;
    delete process.env.TRUSTED_PROXY;
  });

  it('correctly tracks valid Railway-provided IPv4 and IPv6 client IPs across trusted ingress boundary', async () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';

    // IPv4 Client
    const res1 = await request(app).post('/api/test').set('x-real-ip', '198.51.100.25');
    expect(res1.status).toBe(200);
    const res2 = await request(app).post('/api/test').set('x-real-ip', '198.51.100.25');
    expect(res2.status).toBe(200);
    const res3 = await request(app).post('/api/test').set('x-real-ip', '198.51.100.25');
    expect(res3.status).toBe(429);

    // IPv6 Client has independent quota and succeeds
    const ipv6Res1 = await request(app).post('/api/test').set('x-real-ip', '2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    expect(ipv6Res1.status).toBe(200);
  });

  it('safely handles missing client-IP headers by falling back to socket remote address', async () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';
    // No x-real-ip or forwarding headers supplied
    const res1 = await request(app).post('/api/test');
    expect(res1.status).toBe(200);
    const res2 = await request(app).post('/api/test');
    expect(res2.status).toBe(200);
    const res3 = await request(app).post('/api/test');
    expect(res3.status).toBe(429);
  });

  it('rejects malformed IP headers and safely falls back to socket remote address without crashing', async () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';
    const malformedHeaders = ['999.999.999.999', 'not-an-ip', '1.2.3.4.5', 'javascript:void(0)'];
    for (const badIp of malformedHeaders) {
      limiter.reset();
      const res = await request(app).post('/api/test').set('x-real-ip', badIp);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it('prevents spoofing via X-Forwarded-For when behind Railway ingress', async () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';
    const legitimateRailwayIp = '203.0.113.88';

    // Attacker tries to rotate X-Forwarded-For to evade rate limiting
    await request(app)
      .post('/api/test')
      .set('x-real-ip', legitimateRailwayIp)
      .set('x-forwarded-for', '10.0.0.1');

    await request(app)
      .post('/api/test')
      .set('x-real-ip', legitimateRailwayIp)
      .set('x-forwarded-for', '10.0.0.2');

    // 3rd attempt must be blocked even though attacker passes a 3rd forged X-Forwarded-For
    const blockedRes = await request(app)
      .post('/api/test')
      .set('x-real-ip', legitimateRailwayIp)
      .set('x-forwarded-for', '10.0.0.3');

    expect(blockedRes.status).toBe(429);
  });

  it('handles multiple forwarded IP values without manipulating rate-limit identity', async () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';
    const legitimateRailwayIp = '203.0.113.99';

    await request(app)
      .post('/api/test')
      .set('x-real-ip', legitimateRailwayIp)
      .set('x-forwarded-for', '1.1.1.1, 2.2.2.2, 3.3.3.3');

    await request(app)
      .post('/api/test')
      .set('x-real-ip', legitimateRailwayIp)
      .set('x-forwarded-for', '4.4.4.4, 5.5.5.5');

    const blockedRes = await request(app)
      .post('/api/test')
      .set('x-real-ip', legitimateRailwayIp)
      .set('x-forwarded-for', '6.6.6.6, 7.7.7.7');

    expect(blockedRes.status).toBe(429);
  });

  it('prevents attempts to manipulate rate-limit identity with whitespace or special characters', async () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';

    const manipulationHeaders = ['   ', ' 198.51.100.1 ', '198.51.100.1:8080', 'null', 'undefined', '0.0.0.0.0'];
    for (const badHeader of manipulationHeaders) {
      limiter.reset();
      const res = await request(app).post('/api/test').set('x-real-ip', badHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it('strictly isolates rate-limit buckets for separate clients', async () => {
    process.env.RAILWAY_ENVIRONMENT = 'production';

    // Client A consumes quota
    await request(app).post('/api/test').set('x-real-ip', '198.51.100.10');
    await request(app).post('/api/test').set('x-real-ip', '198.51.100.10');
    const clientABlocked = await request(app).post('/api/test').set('x-real-ip', '198.51.100.10');
    expect(clientABlocked.status).toBe(429);

    // Client B has full quota available
    const clientBAllowed1 = await request(app).post('/api/test').set('x-real-ip', '198.51.100.20');
    expect(clientBAllowed1.status).toBe(200);
    const clientBAllowed2 = await request(app).post('/api/test').set('x-real-ip', '198.51.100.20');
    expect(clientBAllowed2.status).toBe(200);
    const clientBBlocked = await request(app).post('/api/test').set('x-real-ip', '198.51.100.20');
    expect(clientBBlocked.status).toBe(429);
  });

  it('ignores test bypass headers in production mode and enforces rate limiting', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      process.env.RAILWAY_ENVIRONMENT = 'production';

      await request(app)
        .post('/api/test')
        .set('x-real-ip', '198.51.100.77')
        .set('x-bypass-rate-limit', 'true');

      await request(app)
        .post('/api/test')
        .set('x-real-ip', '198.51.100.77')
        .set('x-bypass-rate-limit', 'true');

      const blockedRes = await request(app)
        .post('/api/test')
        .set('x-real-ip', '198.51.100.77')
        .set('x-bypass-rate-limit', 'true');

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error).toBe('Rate limit reached');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

