/**
 * Determines whether a node label is generic/unnamed.
 * A generic label is one that carries no meaningful semantic content —
 * auto-generated placeholders, short IDs, or default type labels.
 *
 * Used in two places:
 *   1. Proposal generation: to decide which origin nodes the AI should rename.
 *   2. Accept-time guard: to ensure nodes with real labels are never overwritten.
 *
 * Keep this as the single source of truth for both callers.
 */
export function isGenericNodeLabel(label: string | undefined, nodeId: string): boolean {
  if (!label || label.trim() === '') return true;
  if (label === nodeId) return true;
  if (label.trim().length <= 3) return true;
  const lower = label.toLowerCase().trim();
  if (['new process', 'process', 'new node', 'node', 'untitled', 'step'].includes(lower)) return true;
  if (/^node[-_]?[a-z0-9]{4,}$/i.test(label)) return true;
  return false;
}
