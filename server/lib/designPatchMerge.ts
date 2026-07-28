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
 *
 * ROOT protection: if the patch rewrites the ROOT node and omits artboard IDs
 * that exist in the current state, those IDs are merged back in so that no
 * artboard is silently disconnected from the document.
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
 * - ROOT protection: when the patch includes ROOT, any artboard IDs already
 *   listed in the existing ROOT.nodes that are still present in the merged map
 *   are re-added to the merged ROOT.nodes so a partial patch cannot silently
 *   disconnect an artboard.
 * - After merging, every node's `nodes` child-reference array is filtered to
 *   remove IDs that no longer exist in the merged map. This mirrors the
 *   `mergeGraphAware` helper on the client side.
 */
export function mergeDesignPatch(
  existingState: CraftState,
  patchNodes: CraftState,
): MergeResult {
  const merged: CraftState = { ...existingState, ...patchNodes };

  // ROOT protection: when the patch rewrites ROOT, preserve any existing
  // artboard child refs that the patch omitted but whose nodes still exist.
  const ROOT = 'ROOT';
  if (ROOT in patchNodes) {
    const existingRoot = existingState[ROOT];
    const patchedRoot = patchNodes[ROOT];

    if (
      existingRoot &&
      typeof existingRoot === 'object' &&
      Array.isArray((existingRoot as Record<string, unknown>).nodes) &&
      patchedRoot &&
      typeof patchedRoot === 'object' &&
      Array.isArray((patchedRoot as Record<string, unknown>).nodes)
    ) {
      const existingChildRefs = (existingRoot as Record<string, unknown>).nodes as string[];
      const patchedChildRefs = (patchedRoot as Record<string, unknown>).nodes as string[];
      const patchedSet = new Set(patchedChildRefs);

      // Re-add any existing child refs that the patch dropped but whose nodes
      // are still in the merged map (i.e. they were not explicitly deleted).
      const restoredRefs: string[] = [];
      for (const id of existingChildRefs) {
        if (!patchedSet.has(id) && id in merged) {
          restoredRefs.push(id);
        }
      }

      if (restoredRefs.length > 0) {
        const mergedRoot = merged[ROOT] as Record<string, unknown>;
        merged[ROOT] = { ...mergedRoot, nodes: [...patchedChildRefs, ...restoredRefs] };
      }
    }
  }

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

/**
 * Lay out all AstryxArtboard children of ROOT in left-to-right order.
 *
 * Each artboard gets `x = sum of preceding artboard widths + 40 px per gap`
 * and `y = 0`. Artboards without an explicit `width` prop are treated as
 * 390 px wide (a sensible mobile-frame default). Non-artboard ROOT children
 * (e.g. free-floating components) are left untouched.
 *
 * Call this after every AI generation or patch-merge before returning the
 * craftState to the client so multi-screen designs always open spread out.
 */
const ARTBOARD_GAP = 80;       // matches spreadArtboardsInState on the client
const ARTBOARD_START_X = 64;   // non-zero so craft.js never treats it as "absent"
const ARTBOARD_START_Y = 64;
const DEFAULT_ARTBOARD_WIDTH = 390;

export function layoutArtboards(state: CraftState): CraftState {
  const root = state['ROOT'];
  if (!root || typeof root !== 'object') return state;

  const rootNode = root as Record<string, unknown>;
  if (!Array.isArray(rootNode.nodes) || rootNode.nodes.length === 0) return state;

  const childIds = rootNode.nodes as string[];

  // Collect artboard IDs (order matters — matches SCREEN MAPPING order)
  const artboardIds = childIds.filter((id) => {
    const node = state[id];
    if (!node || typeof node !== 'object') return false;
    const n = node as Record<string, unknown>;
    const t = n.type;
    if (!t || typeof t !== 'object') return false;
    return (t as Record<string, unknown>).resolvedName === 'AstryxArtboard';
  });

  if (artboardIds.length < 1) return state; // Nothing to lay out

  let cursor = ARTBOARD_START_X;
  const updates: CraftState = {};

  for (const id of artboardIds) {
    const node = state[id] as Record<string, unknown>;
    const props = (node.props && typeof node.props === 'object'
      ? node.props
      : {}) as Record<string, unknown>;
    const width = typeof props.width === 'number' && props.width > 0
      ? props.width
      : DEFAULT_ARTBOARD_WIDTH;

    updates[id] = {
      ...node,
      props: { ...props, x: cursor, y: ARTBOARD_START_Y },
    };

    cursor += width + ARTBOARD_GAP;
  }

  return { ...state, ...updates };
}
