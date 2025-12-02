import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

const getClientIdentifier = (req: Request): string => {
  const user = req.user as any;
  if (user?.claims?.sub) return `user:${user.claims.sub}`;
  if (user?.id) return `user:${user.id}`;
  
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' 
    ? forwarded.split(',')[0].trim() 
    : req.socket?.remoteAddress || 'anonymous';
  
  return `ip:${ip}`;
};

const getIpIdentifier = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' 
    ? forwarded.split(',')[0].trim() 
    : req.socket?.remoteAddress || 'anonymous';
  
  return `ip:${ip}`;
};

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    error: 'Too many AI requests. Please wait a moment and try again.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIdentifier,
  validate: { xForwardedForHeader: false },
  skip: (req: Request) => req.path === '/api/health'
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many authentication attempts. Please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getIpIdentifier,
  validate: { xForwardedForHeader: false }
});

export const projectRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    error: 'Too many requests. Please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIdentifier,
  validate: { xForwardedForHeader: false }
});

export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: 'Too many file uploads. Please wait a moment.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIdentifier,
  validate: { xForwardedForHeader: false }
});

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests. Please slow down.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIdentifier,
  validate: { xForwardedForHeader: false },
  skip: (req: Request) => req.path.startsWith('/assets') || req.path === '/api/health'
});

export const sensitiveRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many attempts for this sensitive operation. Please try again later.',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIdentifier,
  validate: { xForwardedForHeader: false }
});
