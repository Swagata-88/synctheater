import { Request, Response, NextFunction } from 'express';
import net from 'net';
import { config } from '../../config';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface RateLimiterMiddleware {
  (req: Request, res: Response, next: NextFunction): void;
  reset: () => void;
}

/**
 * Validates whether a candidate string is a syntactically valid IPv4 or IPv6 address.
 */
export function isValidIp(ip: string | undefined | null): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  return net.isIP(trimmed) !== 0;
}

/**
 * Checks whether the execution environment is inside Railway's public-ingress boundary
 * or an explicitly configured trusted reverse-proxy environment.
 */
export function isTrustedProxyIngress(): boolean {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RAILWAY_SERVICE_ID ||
    process.env.TRUSTED_PROXY === 'true' ||
    (config.env === 'production' && process.env.TRUST_PROXY !== 'false')
  );
}

/**
 * Safely extracts and validates the client IP address.
 *
 * Railway Ingress Trust Boundary:
 * 1. Railway's edge reverse proxy strips incoming client-supplied `X-Real-IP` headers
 *    and injects the authentic connecting client's IP into `X-Real-IP`.
 * 2. When within the trusted proxy ingress boundary, we inspect `X-Real-IP` and strictly
 *    validate that it is a valid IPv4 or IPv6 address using `net.isIP`.
 * 3. We NEVER trust arbitrary client-supplied `X-Forwarded-For` headers directly, as they
 *    can be spoofed or contain multiple untrusted forwarded hops.
 * 4. If `X-Real-IP` is missing, malformed, or outside the trusted proxy boundary, we safely
 *    fall back to the direct TCP socket address (`req.socket.remoteAddress`), or 'unknown-client'.
 */
export function getTrustedClientIp(req: Request): string {
  // Check trusted proxy ingress boundary first
  if (isTrustedProxyIngress()) {
    const rawRealIp = req.headers['x-real-ip'];
    if (typeof rawRealIp === 'string') {
      const candidate = rawRealIp.trim();
      if (isValidIp(candidate)) {
        return candidate;
      }
    }
  }

  // Safe fallback to socket remote address across all environments
  const socketAddress = req.socket?.remoteAddress;
  if (socketAddress && typeof socketAddress === 'string') {
    const candidate = socketAddress.trim();
    if (isValidIp(candidate)) {
      if (candidate.startsWith('::ffff:')) {
        const ipv4Part = candidate.slice(7);
        if (isValidIp(ipv4Part)) {
          return ipv4Part;
        }
      }
      return candidate;
    }
  }

  return 'unknown-client';
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
}): RateLimiterMiddleware {
  const store = new Map<string, RateLimitRecord>();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, 60000);
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  const middleware: any = (req: Request, res: Response, next: NextFunction) => {
    // In production, client-supplied bypass headers are ALWAYS ignored.
    // Bypass is strictly restricted to non-production environments when NODE_ENV is explicitly 'test'.
    const isProduction = process.env.NODE_ENV === 'production' || config.env === 'production';
    if (!isProduction && process.env.NODE_ENV === 'test' && req.headers['x-bypass-rate-limit'] === 'true') {
      return next();
    }

    // Safely resolve client IP across trusted ingress boundary
    const ip = getTrustedClientIp(req);

    const now = Date.now();
    let record = store.get(ip);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      store.set(ip, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, options.max - record.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));

    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > options.max) {
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        error: options.message || 'Too many requests. Please try again later.',
        retryAfter: retryAfterSeconds,
      });
    }

    next();
  };

  middleware.reset = () => {
    store.clear();
  };

  return middleware as RateLimiterMiddleware;
}

// 10 attempts per 15 minutes for sensitive authentication endpoints
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts from this IP. Please try again later.',
});

// 5 attempts per 15 minutes for password reset requests to prevent brute force and spam
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password reset attempts from this IP. Please try again after 15 minutes.',
});
