import type { Request, Response, NextFunction } from "express";

export function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.status(401).json({ 
      error: "Authentication required" 
    });
    return;
  }

  const base64Credentials = authHeader.slice(6);
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedPassword) {
    console.error('ADMIN_PASSWORD environment variable not set');
    res.status(500).json({ 
      error: "Admin access not configured" 
    });
    return;
  }

  if (username === expectedUsername && password === expectedPassword) {
    next();
  } else {
    console.warn('Failed admin login attempt:', { username, ip: req.ip });
    res.status(401).json({ 
      error: "Invalid credentials" 
    });
  }
}
