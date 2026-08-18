import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logAdminLogin } from "./auditLog";

const ADMIN_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const activeAdminSessions = new Map<string, { expiresAt: number; username: string }>();

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function cleanExpiredSessions(): void {
  const now = Date.now();
  const entries = Array.from(activeAdminSessions.entries());
  for (const [token, session] of entries) {
    if (session.expiresAt < now) {
      activeAdminSessions.delete(token);
    }
  }
}

setInterval(cleanExpiredSessions, 5 * 60 * 1000);

export async function adminLogin(
  req: Request,
  res: Response
): Promise<void> {
  const { username, password } = req.body;

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
    const token = generateSecureToken();
    const expiresAt = Date.now() + ADMIN_TOKEN_EXPIRY_MS;
    
    activeAdminSessions.set(token, { expiresAt, username });
    
    await logAdminLogin(req, true, username);
    
    res.json({
      success: true,
      token,
      expiresAt,
      expiresIn: ADMIN_TOKEN_EXPIRY_MS / 1000,
    });
  } else {
    console.warn('Failed admin login attempt:', { username, ip: req.ip });
    await logAdminLogin(req, false, username || 'unknown');
    
    res.status(401).json({ 
      error: "Invalid credentials" 
    });
  }
}

export function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const session = activeAdminSessions.get(token);
    
    if (session && session.expiresAt > Date.now()) {
      session.expiresAt = Date.now() + ADMIN_TOKEN_EXPIRY_MS;
      (req as any).adminUser = session.username;
      next();
      return;
    }
    
    if (session) {
      activeAdminSessions.delete(token);
    }
    
    res.status(401).json({ 
      error: "Session expired. Please login again." 
    });
    return;
  }
  
  if (authHeader?.startsWith('Basic ')) {
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
      (req as any).adminUser = username;
      next();
      return;
    } else {
      console.warn('Failed admin login attempt:', { username, ip: req.ip });
      res.status(401).json({ 
        error: "Invalid credentials" 
      });
      return;
    }
  }
  
  res.status(401).json({ 
    error: "Authentication required" 
  });
}

export function adminLogout(
  req: Request,
  res: Response
): void {
  const authHeader = req.headers.authorization;
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    activeAdminSessions.delete(token);
  }
  
  res.json({ success: true });
}

export function refreshAdminSession(
  req: Request,
  res: Response
): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: "No session to refresh" });
    return;
  }
  
  const token = authHeader.slice(7);
  const session = activeAdminSessions.get(token);
  
  if (!session || session.expiresAt < Date.now()) {
    if (session) activeAdminSessions.delete(token);
    res.status(401).json({ error: "Session expired" });
    return;
  }
  
  const newToken = generateSecureToken();
  const expiresAt = Date.now() + ADMIN_TOKEN_EXPIRY_MS;
  
  activeAdminSessions.delete(token);
  activeAdminSessions.set(newToken, { expiresAt, username: session.username });
  
  res.json({
    success: true,
    token: newToken,
    expiresAt,
    expiresIn: ADMIN_TOKEN_EXPIRY_MS / 1000,
  });
}
