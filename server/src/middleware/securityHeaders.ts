import { Request, Response, NextFunction } from 'express';

/**
 * Security Headers Middleware — Enforces HTTP defense-in-depth protections
 * Prevents MIME sniffing, clickjacking, inline script execution attacks, and removes fingerprinting headers.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Remove technology fingerprint headers
  res.removeHeader('X-Powered-By');

  // 2. Prevent MIME-type confusion attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 3. Mitigate clickjacking via framing restrictions
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // 4. Enable browser XSS filter block mode
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // 5. Enforce HTTPS via HSTS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // 6. Referrer leakage defense
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 7. Restrict unneeded browser hardware capabilities
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  next();
}
