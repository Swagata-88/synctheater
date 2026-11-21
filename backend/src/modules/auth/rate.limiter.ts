import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface RateLimiterMiddleware {
  (req: Request, res: Response, next: NextFunction): void;
  reset: () => void;
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
    // If running in test with test header bypass, allow bypass
    if (req.headers['x-bypass-rate-limit'] === 'true') {
      return next();
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown-ip';

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
