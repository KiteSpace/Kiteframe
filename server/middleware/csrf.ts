import type { Request, Response, NextFunction } from 'express';

const ALLOWED_ORIGINS = [
  'https://kiteframe-workflow-editor.replit.app',
  'https://kiteframe.dev',
  'https://kiteframe.space',
  'https://www.kiteframe.space',
];

const isDevEnvironment = process.env.NODE_ENV !== 'production' || process.env.REPLIT_DEV === 'true';

function getOrigin(req: Request): string | null {
  return req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/') || null;
}

function isValidOrigin(origin: string | null, hostname: string): boolean {
  if (!origin) return false;
  
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  
  try {
    const url = new URL(origin);
    if (url.hostname === hostname) return true;
    if (url.hostname.endsWith('.replit.dev')) return true;
    if (url.hostname.endsWith('.repl.co')) return true;
    if (isDevEnvironment && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
      return true;
    }
  } catch {
    return false;
  }
  
  return false;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (safeMethod) {
    return next();
  }

  const origin = getOrigin(req);
  const hostname = req.hostname;
  
  if (!isValidOrigin(origin, hostname)) {
    console.warn(`CSRF blocked: origin=${origin}, hostname=${hostname}, path=${req.path}`);
    res.status(403).json({ error: 'Request blocked: invalid origin' });
    return;
  }
  
  next();
}

export function csrfProtectionForApi(req: Request, res: Response, next: NextFunction): void {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }
  
  return csrfProtection(req, res, next);
}
