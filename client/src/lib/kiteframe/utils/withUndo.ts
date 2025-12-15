/**
 * withUndo - A helper to ensure all canvas mutations are undoable
 * 
 * This enforces the rule: NO CANVAS-RELEVANT MUTATION MAY OCCUR WITHOUT AN EXPLICIT UNDO SNAPSHOT.
 * 
 * Rules:
 * - saveToHistory() MUST be called BEFORE mutation
 * - fn() MUST contain all mutations
 * - label is required (used for debugging / analytics)
 * 
 * Usage:
 * withUndo("Delete node", saveToHistory, () => {
 *   setNodes(...)
 *   setEdges(...)
 * })
 */

export function withUndo(
  label: string,
  saveToHistory: (label?: string) => void,
  fn: () => void
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[UNDO] Preparing snapshot: ${label}`);
  }
  saveToHistory(label);
  fn();
}

/**
 * withUndoAsync - Async version for mutations that involve promises
 */
export async function withUndoAsync(
  label: string,
  saveToHistory: (label?: string) => void,
  fn: () => Promise<void>
): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[UNDO] Preparing snapshot (async): ${label}`);
  }
  saveToHistory(label);
  await fn();
}
