/**
 * Server-side patch merge for the /api/ai/design endpoint.
 *
 * When the AI responds with `{ type: 'patch', nodes: {...} }` the route calls
 * this helper to merge the patch into the existing craft state and return a
 * complete, ready-to-apply state object.
 *
 * Isolation guarantee: nodes that belong to artboards NOT targeted by the patch
 * are preserved byte-for-byte; only nodes referenced by the patch are added or
 * updated, and orphan child-list entries (IDs that no longer exist in the merged
 * result) are pruned to prevent silent corruption.
 */

export type CraftState = Record<string, unknown>;

export interface MergeResult {
  merged: CraftState;
  orphansRemoved: number;
}

/**
 * Merge `patchNodes` into `existingState`.
 *
 * - Existing nodes NOT present in `patchNodes` are carried over unchanged.
 * - Nodes in `patchNodes` are added or overwrite their counterpart in
 *   `existingState` (last-write-wins at node-ID granularity).
 * - After merging, every node's `nodes` child-reference array is filtered to
 *   remove IDs that no longer exist in the merged map. This mirrors the
 *   `mergeGraphAware` helper on the client side.
 */
export function mergeDesignPatch(
  existingState: CraftState,
  patchNodes: CraftState,
): MergeResult {
  const merged: CraftState = { ...existingState, ...patchNodes };

  const nodeIds = new Set(Object.keys(merged));
  let orphansRemoved = 0;

  for (const [nodeId, node] of Object.entries(merged)) {
    if (!node || typeof node !== 'object') continue;
    const n = node as Record<string, unknown>;
    if (!Array.isArray(n.nodes)) continue;

    const before = n.nodes as string[];
    const cleaned = before.filter((id) => nodeIds.has(id));
    const removed = before.length - cleaned.length;

    if (removed > 0) {
      orphansRemoved += removed;
      merged[nodeId] = { ...n, nodes: cleaned };
    }
  }

  return { merged, orphansRemoved };
}
