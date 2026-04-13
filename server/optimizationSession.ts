import { randomUUID } from 'crypto';

interface OptimizationSession {
  userIdentifier: string;
  createdAt: number;
  lastUsed: number;
}

const sessions = new Map<string, OptimizationSession>();

const SESSION_TTL_MS = 60 * 60 * 1000;

function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastUsed > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

export function createOptimizationSession(userIdentifier: string): string {
  cleanExpiredSessions();
  const id = randomUUID();
  sessions.set(id, {
    userIdentifier,
    createdAt: Date.now(),
    lastUsed: Date.now(),
  });
  return id;
}

export function isValidOptimizationSession(sessionId: string, userIdentifier: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (session.userIdentifier !== userIdentifier) return false;
  const now = Date.now();
  if (now - session.lastUsed > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return false;
  }
  session.lastUsed = now;
  return true;
}

export function invalidateOptimizationSession(sessionId: string): void {
  sessions.delete(sessionId);
}
