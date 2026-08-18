/**
 * withUndo - A helper to ensure all canvas mutations are undoable
 * 
 * This enforces the rule: NO CANVAS-RELEVANT MUTATION MAY OCCUR WITHOUT AN EXPLICIT UNDO SNAPSHOT.
 * 
 * IMPORTANT: This helper calls saveToHistory() BEFORE fn(), which captures the current
 * state as the "before" snapshot. However, due to saveToHistory's debounce + dedupe logic,
 * this pattern may NOT work correctly with some mutation patterns:
 * 
 * ❌ BAD: If the pre-mutation state is identical to the last history entry, the snapshot
 *    will be deduplicated and discarded, leaving no undo entry.
 * 
 * ✅ GOOD: Use this for mutations where the current state is NOT the same as the last
 *    saved history entry (e.g., after user has made canvas changes).
 * 
 * For AI-driven mutations (APPLY, REPLACE, etc.) that may trigger on a fresh canvas
 * where the current state equals the history head, use the POST-MUTATION pattern instead:
 * 
 *   // Do the mutation first
 *   setNodes(newNodes);
 *   setEdges(newEdges);
 *   // Then save history after (captures NEW state; undo restores PREVIOUS entry)
 *   setTimeout(() => saveToHistory("Label"), 0);
 * 
 * Rules:
 * - saveToHistory() MUST be called BEFORE mutation (for this helper)
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
