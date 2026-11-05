import { AsyncLocalStorage } from 'async_hooks';

/** Whether this request reached Claude and whether Claude returned a billed response. */
export interface AiBilling { attempted: boolean; completed: boolean }

export const aiBilling = new AsyncLocalStorage<AiBilling>();

export function markAiAttempt(): void {
  const b = aiBilling.getStore();
  if (b) b.attempted = true;
}

export function markAiCompleted(): void {
  const b = aiBilling.getStore();
  if (b) b.completed = true;
}
