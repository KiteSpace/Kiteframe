import type { SessionModelLock } from './types';

const sessionLocks = new Map<string, SessionModelLock>();

export function getSessionLock(sessionId: string): SessionModelLock | undefined {
  return sessionLocks.get(sessionId);
}

export function setSessionLock(sessionId: string, lock: SessionModelLock): void {
  if (sessionLocks.has(sessionId)) {
    console.warn(`[SessionLock] Attempted to overwrite lock for session ${sessionId}. Ignoring.`);
    return;
  }
  sessionLocks.set(sessionId, lock);
}

export function clearSessionLock(sessionId: string): void {
  sessionLocks.delete(sessionId);
}

export function hasSessionLock(sessionId: string): boolean {
  return sessionLocks.has(sessionId);
}

export function createSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
