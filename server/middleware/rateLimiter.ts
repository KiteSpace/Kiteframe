import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { pgStore } from './pgRateLimitStore';

const getClientKey = (req: Request): string => {
  const user = req.user as any;
  if (user?.claims?.sub) return `user:${user.claims.sub}`;
  if (user?.id) return `user:${user.id}`;
  return req.ip || 'anonymous';
};

export const aiRateLimiter = rateLimit({
  store: pgStore('aiRateLimiter'),
  windowMs: 60 * 1000,
  max: 20,
  message: {
    error: 'Too many AI requests. Please wait a moment and try again.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { keyGeneratorIpFallback: false },
  skip: (req: Request) => req.path === '/api/health'
});

export const authRateLimiter = rateLimit({
  store: pgStore('authRateLimiter'),
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many authentication attempts. Please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false }
});

export const projectRateLimiter = rateLimit({
  store: pgStore('projectRateLimiter'),
  windowMs: 60 * 1000,
  max: 60,
  message: {
    error: 'Too many requests. Please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { keyGeneratorIpFallback: false }
});

export const uploadRateLimiter = rateLimit({
  store: pgStore('uploadRateLimiter'),
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: 'Too many file uploads. Please wait a moment.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { keyGeneratorIpFallback: false }
});

export const generalRateLimiter = rateLimit({
  store: pgStore('generalRateLimiter'),
  windowMs: 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests. Please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { keyGeneratorIpFallback: false },
  skip: (req: Request) => req.path.startsWith('/assets') || req.path === '/api/health'
});

export const sensitiveRateLimiter = rateLimit({
  store: pgStore('sensitiveRateLimiter'),
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many attempts for this sensitive operation. Please try again later.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { keyGeneratorIpFallback: false }
});

export const adminLoginRateLimiter = rateLimit({
  store: pgStore('adminLoginRateLimiter'),
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many admin login attempts. Account locked for 15 minutes.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  skipSuccessfulRequests: false,
});

export const waitlistRateLimiter = rateLimit({
  store: pgStore('waitlistRateLimiter'),
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many waitlist submissions. Please try again later.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false }
});

export const creditUnlockRateLimiter = rateLimit({
  store: pgStore('creditUnlockRateLimiter'),
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many unlock code attempts. Please try again later.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { keyGeneratorIpFallback: false }
});

export const chatRateLimiter = rateLimit({
  store: pgStore('chatRateLimiter'),
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: 'Too many chat messages. Please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientKey,
  validate: { keyGeneratorIpFallback: false }
});

// Keyed by scoped API key id (set by the external-API auth middleware),
// not by IP, since callers may share an IP (e.g. CI runners) but must each
// stay within their own key's quota.
const getExternalApiKey = (req: Request): string => {
  const apiKey = (req as any).apiKey;
  return apiKey?.id ? `apikey:${apiKey.id}` : (req.ip || 'anonymous');
};

export const externalApiRateLimiter = rateLimit({
  store: pgStore('externalApiRateLimiter'),
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: 'Too many requests for this API key. Please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getExternalApiKey,
  validate: { keyGeneratorIpFallback: false }
});

export const adminApiRateLimiter = rateLimit({
  store: pgStore('adminApiRateLimiter'),
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    error: 'Too many admin requests. Please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
});
