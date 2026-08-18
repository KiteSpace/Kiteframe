/**
 * Shared ID generation utility.
 *
 * Generates a time-based random ID with an optional prefix.
 *
 * @param prefix - Optional prefix string.  When supplied the returned ID is
 *                 `<prefix>-<timestamp>-<random>`.  When omitted the returned
 *                 ID is `<timestamp>-<random>`.
 *
 * Examples:
 *   generateId()         → "1718000000000-abc123xyz"
 *   generateId('figma')  → "figma-1718000000000-abc123xyz"
 */
export function generateId(prefix?: string): string {
  const base = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return prefix ? `${prefix}-${base}` : base;
}
