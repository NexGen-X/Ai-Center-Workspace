import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  code?: string;
  skipInTests?: boolean;
}

/**
 * Creates an in-memory sliding-window rate limiter middleware
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    max,
    message = 'Terlalu banyak permintaan. Silakan coba beberapa saat lagi.',
    code = 'RATE_LIMIT_EXCEEDED',
    skipInTests = true
  } = options;

  const hits = new Map<string, RateLimitRecord>();

  // Periodic memory garbage collection every 60 seconds
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetAt) {
        hits.delete(key);
      }
    }
  }, 60000);

  // Prevent interval from blocking process shutdown
  cleanupInterval.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    if (skipInTests && process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const clientIp = (req.ip || req.socket.remoteAddress || 'unknown').toString();
    const now = Date.now();
    const existing = hits.get(clientIp);

    if (!existing || now > existing.resetAt) {
      hits.set(clientIp, {
        count: 1,
        resetAt: now + windowMs
      });
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
      return next();
    }

    if (existing.count >= max) {
      const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(existing.resetAt / 1000));

      return res.status(429).json({
        error: {
          code,
          message,
          retryAfterSeconds: retryAfterSec
        }
      });
    }

    existing.count += 1;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - existing.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(existing.resetAt / 1000));
    return next();
  };
}

// 1. Strict rate limiter for Authentication (prevent credential brute-force)
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  message: 'Terlalu banyak percobaan login gagal. Mohon tunggu 1 menit sebelum mencoba kembali.',
  code: 'AUTH_RATE_LIMIT_EXCEEDED'
});

// 2. Compute / Task execution rate limiter (prevent LLM compute exhaustion)
export const computeRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: 'Batas eksekusi komputasi intensif tercapai. Silakan coba kembali dalam 1 menit.',
  code: 'COMPUTE_RATE_LIMIT_EXCEEDED'
});

// 3. Global API flood protection limiter (prevent DoS flooding)
export const globalApiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  message: 'Terlalu banyak request ke API. Silakan perlambat frekuensi panggilan Anda.',
  code: 'API_RATE_LIMIT_EXCEEDED'
});
