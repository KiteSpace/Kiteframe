import { randomUUID } from 'crypto';

// Maximum number of free refinement turns per optimization session.
// After this many credit-skipped turns, the session is considered exhausted and
// the next turn is charged normally — this bounds the free-turn window and ensures
// that a user who pivots to an unrelated workflow while a draft is pending will be
// charged after at most MAX_FREE_TURNS free turns.
export const MAX_FREE_TURNS = 5;

interface OptimizationSession {
  userIdentifier: string;
  createdAt: number;
  lastUsed: number;
  // How many times this session has already bypassed a credit charge.
  // When this reaches MAX_FREE_TURNS, the session is exhausted and invalidated.
  freeTurnsUsed: number;
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
    freeTurnsUsed: 0,
  });
  return id;
}

// Returns true and increments the turn counter if the session is valid and has
// free turns remaining. Returns false (and deletes the session) when the session
// is expired, belongs to a different user, or has exhausted its free turns.
export function isValidOptimizationSession(sessionId: string, userIdentifier: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (session.userIdentifier !== userIdentifier) return false;
  const now = Date.now();
  if (now - session.lastUsed > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return false;
  }
  if (session.freeTurnsUsed >= MAX_FREE_TURNS) {
    // Session has exhausted its free turn budget — remove it so the client generates
    // a fresh UUID on the next send and pays the normal credit.
    sessions.delete(sessionId);
    return false;
  }
  session.lastUsed = now;
  session.freeTurnsUsed += 1;
  return true;
}

// Register a client-generated UUID as a valid session, bound to the given user.
// Called by creditCheck atomically after deducting the credit so that retries on
// a failed first generation are free (the credit was already spent).
export function registerOptimizationSession(sessionId: string, userIdentifier: string): void {
  cleanExpiredSessions();
  // Only register if not already present (idempotent for concurrent calls).
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      userIdentifier,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      freeTurnsUsed: 0,
    });
  }
}

export function invalidateOptimizationSession(sessionId: string): void {
  sessions.delete(sessionId);
}

// Returns true if the session exists, belongs to this user, has not expired,
// and has at least one free turn remaining — WITHOUT consuming a turn or
// touching lastUsed. Used by the async precheck so we can skip the credit
// reservation for genuinely valid free turns without double-counting them.
export function peekOptimizationSession(sessionId: string, userIdentifier: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (session.userIdentifier !== userIdentifier) return false;
  if (Date.now() - session.lastUsed > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return false;
  }
  return session.freeTurnsUsed < MAX_FREE_TURNS;
}

// Returns the owning userIdentifier for a session, or null if not found / expired.
export function getOptimizationSessionOwner(sessionId: string): string | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.lastUsed > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return null;
  }
  return session.userIdentifier;
}
