import type { Request, Response, NextFunction } from "express";

export function requireHttps(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isSecure = 
    req.secure || 
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'development';

  if (!isSecure) {
    console.warn('Admin endpoint accessed over insecure connection:', {
      ip: req.ip,
      path: req.path,
      protocol: req.protocol,
      forwardedProto: req.headers['x-forwarded-proto'],
    });
    
    res.status(403).json({
      error: 'HTTPS required for admin endpoints',
    });
    return;
  }

  next();
}
