import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logAdminLogin } from "./auditLog";
import { pool } from "../db";

const ADMIN_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
type AdminSession = { expiresAt: number; username: string };

// Sessions live in Postgres (token hashes only) so admin logins work across instances.
// Tests have no database and use an in-memory map.
const useMemoryStore = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
const memorySessions = new Map<string, AdminSession>();
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
let tableReady: Promise<unknown> | null = null;
function ensureTable(): Promise<unknown> {
  tableReady ??= pool
    .query(
      `CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash text PRIMARY KEY,
        username text NOT NULL,
        expires_at timestamptz NOT NULL
      )`,
    )
    .catch((error: unknown) => {
      tableReady = null;
      throw error;
    });
  return tableReady!;
}

const adminSessions = {
  async get(token: string): Promise<AdminSession | null> {
    if (useMemoryStore) return memorySessions.get(token) ?? null;
    await ensureTable();
    const { rows } = await pool.query(
      `SELECT username, expires_at FROM admin_sessions WHERE token_hash = $1`,
      [hashToken(token)],
    );
    return rows[0] ? { username: rows[0].username, expiresAt: new Date(rows[0].expires_at).getTime() } : null;
  },
  async set(token: string, session: AdminSession): Promise<void> {
    if (useMemoryStore) {
      memorySessions.set(token, session);
      return;
    }
    await ensureTable();
    await pool.query(
      `INSERT INTO admin_sessions (token_hash, username, expires_at) VALUES ($1, $2, to_timestamp($3 / 1000.0))
       ON CONFLICT (token_hash) DO UPDATE SET username = EXCLUDED.username, expires_at = EXCLUDED.expires_at`,
      [hashToken(token), session.username, session.expiresAt],
    );
  },
  async delete(token: string): Promise<void> {
    if (useMemoryStore) {
      memorySessions.delete(token);
      return;
    }
    await ensureTable();
    await pool.query(`DELETE FROM admin_sessions WHERE token_hash = $1`, [hashToken(token)]);
  },
  async cleanup(): Promise<void> {
    if (useMemoryStore) {
      const now = Date.now();
      memorySessions.forEach((session, token) => {
        if (session.expiresAt < now) memorySessions.delete(token);
      });
      return;
    }
    await ensureTable();
    await pool.query(`DELETE FROM admin_sessions WHERE expires_at < now()`);
  },
};

function safeEqual(a: unknown, b: string): boolean {
  if (typeof a !== 'string') return false;
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function cleanExpiredSessions(): void {
  adminSessions.cleanup().catch((error) => console.error('Admin session cleanup failed:', error));
}

setInterval(cleanExpiredSessions, 5 * 60 * 1000).unref?.();

export async function adminLogin(
  req: Request,
  res: Response
): Promise<void> {
  const { username, password } = req.body;

  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    console.error('ADMIN_USERNAME and ADMIN_PASSWORD environment variables must be set');
    res.status(500).json({ 
      error: "Admin access not configured" 
    });
    return;
  }

  const usernameOk = safeEqual(username, expectedUsername);
  const passwordOk = safeEqual(password, expectedPassword);
  if (usernameOk && passwordOk) {
    const token = generateSecureToken();
    const expiresAt = Date.now() + ADMIN_TOKEN_EXPIRY_MS;
    
    await adminSessions.set(token, { expiresAt, username });
    
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

function bearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

export async function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const session = await adminSessions.get(token);
    if (session && session.expiresAt > Date.now()) {
      await adminSessions.set(token, { ...session, expiresAt: Date.now() + ADMIN_TOKEN_EXPIRY_MS });
      (req as any).adminUser = session.username;
      next();
      return;
    }
    if (session) await adminSessions.delete(token);
    res.status(401).json({ error: "Session expired. Please login again." });
  } catch (error) {
    console.error('Admin session lookup failed:', error);
    res.status(503).json({ error: "Admin sessions unavailable" });
  }
}

export async function adminLogout(
  req: Request,
  res: Response
): Promise<void> {
  const token = bearerToken(req);
  try {
    if (token) await adminSessions.delete(token);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin logout failed:', error);
    res.status(503).json({ error: "Admin sessions unavailable" });
  }
}

export async function refreshAdminSession(
  req: Request,
  res: Response
): Promise<void> {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "No session to refresh" });
    return;
  }
  try {
    const session = await adminSessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      if (session) await adminSessions.delete(token);
      res.status(401).json({ error: "Session expired" });
      return;
    }
    const newToken = generateSecureToken();
    const expiresAt = Date.now() + ADMIN_TOKEN_EXPIRY_MS;
    await adminSessions.delete(token);
    await adminSessions.set(newToken, { expiresAt, username: session.username });
    res.json({
      success: true,
      token: newToken,
      expiresAt,
      expiresIn: ADMIN_TOKEN_EXPIRY_MS / 1000,
    });
  } catch (error) {
    console.error('Admin session refresh failed:', error);
    res.status(503).json({ error: "Admin sessions unavailable" });
  }
}
