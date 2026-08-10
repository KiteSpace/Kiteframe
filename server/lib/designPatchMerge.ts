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
 * Ensures ROOT's own `type.resolvedName` is never `AstryxArtboard`.
 *
 * The AI occasionally emits a craft state where ROOT itself is typed as
 * AstryxArtboard (e.g. `{ type: { resolvedName: 'AstryxArtboard' }, props: { label: 'Sales Dashboard' } }`).
 * craft.js renders ROOT as the immutable canvas container, not a real screen,
 * so a mis-typed ROOT appears as a blank, undeletable second screen tab.
 *
 * This function resets ROOT's type to AstryxSection and removes any stray
 * `label` prop from ROOT.props when the mis-type is detected. All other ROOT
 * fields (nodes, linkedNodes, isCanvas, etc.) are preserved unchanged.
 *
 * Call this before `layoutArtboards` in every full-state generation path.
 */
export function sanitizeRootType(state: CraftState): CraftState {
  const root = state['ROOT'];
  if (!root || typeof root !== 'object') return state;

  const rootNode = root as Record<string, unknown>;
  const t = rootNode.type;
  if (!t || typeof t !== 'object') return state;

  const resolvedName = (t as Record<string, unknown>).resolvedName;
  if (resolvedName !== 'AstryxArtboard') return state;

  // ROOT should never be typed as AstryxArtboard — correct it.
  const existingProps = (rootNode.props && typeof rootNode.props === 'object'
    ? rootNode.props
    : {}) as Record<string, unknown>;
  // Strip `label` from ROOT props (labels belong on AstryxArtboard children).
  const { label: _removedLabel, ...sanitizedProps } = existingProps;

  console.warn(
    '[sanitizeRootType] ROOT.type was AstryxArtboard (label=%s) — corrected to AstryxSection',
    _removedLabel ?? '(none)',
  );

  return {
    ...state,
    ROOT: {
      ...rootNode,
      type: { resolvedName: 'AstryxSection' },
      displayName: 'AstryxSection',
      props: sanitizedProps,
    },
  };
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

const SYNTHESISED_ROOT_BASE = {
  type: { resolvedName: 'AstryxSection' },
  isCanvas: true,
  props: { direction: 'column', gap: 0, padding: 0 },
  displayName: 'AstryxSection',
  custom: {},
  parent: null,
  hidden: false,
  linkedNodes: {},
};

/**
 * Ensures every direct child of ROOT is an AstryxArtboard.
 *
 * Handles three malformed inputs before doing artboard enforcement:
 *   1. ROOT missing entirely — synthesised from nodes whose `parent === "ROOT"`;
 *      if none, from nodes with null/absent parent (fallback).
 *   2. ROOT present but `nodes` is not an array — treated as empty (nothing to wrap).
 *   3. ROOT.nodes is an empty array — returned unchanged.
 *
 * When the AI omits the artboard wrapper (emitting ROOT → AstryxSection → content
 * instead of ROOT → AstryxArtboard → content), a "Screen 1" artboard is synthesised,
 * the non-artboard ROOT children are moved inside it, and ROOT.nodes is updated.
 *
 * Call this after `layoutArtboards` in the /api/ai/design full-state path so
 * no malformed structure ever reaches the client or the database.
 */
export function wrapRootChildrenInArtboard(state: CraftState): CraftState {
  let workingState = state;
  let root = workingState['ROOT'];

  // ── Synthesise ROOT if missing ─────────────────────────────────────────────
  if (!root || typeof root !== 'object') {
    // Primary: collect nodes that explicitly claim 'ROOT' as their parent.
    const explicitRootChildren: string[] = [];
    for (const [id, node] of Object.entries(workingState)) {
      if (id === 'ROOT' || !node || typeof node !== 'object') continue;
      if ((node as Record<string, unknown>).parent === 'ROOT') {
        explicitRootChildren.push(id);
      }
    }
    // Fallback: if no node explicitly claims ROOT, adopt all parentless nodes.
    const rootChildIds = explicitRootChildren.length > 0
      ? explicitRootChildren
      : Object.entries(workingState)
          .filter(([id, node]) => {
            if (id === 'ROOT' || !node || typeof node !== 'object') return false;
            const p = (node as Record<string, unknown>).parent;
            return p === null || p === undefined;
          })
          .map(([id]) => id);

    console.warn(
      `[wrapRootChildrenInArtboard] ROOT missing — synthesised with ${rootChildIds.length} child(ren)`,
    );
    root = { ...SYNTHESISED_ROOT_BASE, nodes: rootChildIds };
    workingState = { ...workingState, ROOT: root };
  }

  const rootNode = root as Record<string, unknown>;

  // ── Malformed or empty ROOT.nodes ──────────────────────────────────────────
  if (!Array.isArray(rootNode.nodes)) {
    console.warn('[wrapRootChildrenInArtboard] ROOT.nodes is not an array — treating as empty');
    return workingState;
  }
  if (rootNode.nodes.length === 0) return workingState;

  const childIds = rootNode.nodes as string[];
  const artboardIds: string[] = [];
  const nonArtboardIds: string[] = [];

  for (const id of childIds) {
    const node = workingState[id];
    if (!node || typeof node !== 'object') continue;
    const n = node as Record<string, unknown>;
    const t = n.type;
    const resolvedName = (t && typeof t === 'object')
      ? (t as Record<string, unknown>).resolvedName
      : null;
    if (resolvedName === 'AstryxArtboard') {
      artboardIds.push(id);
    } else {
      nonArtboardIds.push(id);
    }
  }

  // All ROOT children are already artboards — nothing to do (ROOT may have been synthesised).
  if (nonArtboardIds.length === 0) return workingState;

  const artboardId = `kf_ab_${Date.now()}`;
  const newState: CraftState = { ...workingState };

  // Re-parent each non-artboard child under the new artboard.
  for (const id of nonArtboardIds) {
    const n = newState[id] as Record<string, unknown>;
    newState[id] = { ...n, parent: artboardId };
  }

  // Synthesise the wrapper artboard.
  newState[artboardId] = {
    type: { resolvedName: 'AstryxArtboard' },
    isCanvas: true,
    props: { label: 'Screen 1', width: 390, direction: 'column', gap: 16, padding: 24 },
    displayName: 'AstryxArtboard',
    custom: {},
    parent: 'ROOT',
    hidden: false,
    nodes: nonArtboardIds,
    linkedNodes: {},
  };

  // Place the new artboard first in ROOT, keep existing artboards after it.
  newState['ROOT'] = { ...rootNode, nodes: [artboardId, ...artboardIds] };

  console.log(
    `[wrapRootChildrenInArtboard] Wrapped ${nonArtboardIds.length} non-artboard ROOT child(ren) in new artboard "${artboardId}"`,
  );

  return newState;
}

/**
 * Enforces the new-screen invariant when the client sent `newScreen: true`.
 *
 * Two cases handled:
 *
 * A) AI correctly adds a new `AstryxArtboard` (a node ID absent from the current
 *    canvas with `parent: "ROOT"`): normalise ROOT so it lists all existing artboard
 *    IDs **plus** the new one. The AI often emits only the new artboard in ROOT,
 *    which leaves existing screens unreachable after client merge.
 *
 * B) AI ignored the prompt override (no new artboard in the patch): collect every
 *    new node (not in the existing canvas), re-parent them into a synthesised
 *    artboard, and **drop all AI edits to existing nodes** so the current canvas
 *    is never mutated. ROOT is rebuilt with all existing artboard IDs plus the new one.
 *
 * The drop-existing-edits behaviour in case B is intentional: for a `newScreen`
 * request the AI must not touch existing artboards. Keeping their AI-modified forms
 * in the patch would leave contradictory `parent` pointers after client merge
 * (e.g. both `screen-1.nodes` and `new-artboard.nodes` referencing the same node).
 *
 * @param patchNodes        The raw patch from the AI response.
 * @param existingStateJson The skeletonised `currentCraftState` sent by the client
 *                          (used only to enumerate existing node / artboard IDs).
 */
export function enforceNewScreenPatch(
  patchNodes: CraftState,
  existingStateJson: string,
): CraftState {
  // Parse existing state to know which IDs and artboards already exist.
  let existingIds = new Set<string>();
  let existingArtboardIds: string[] = [];
  try {
    const existing = JSON.parse(existingStateJson) as CraftState;
    existingIds = new Set(Object.keys(existing));
    const existingRoot = existing['ROOT'] as Record<string, unknown> | undefined;
    const rootNodes = Array.isArray(existingRoot?.nodes)
      ? (existingRoot!.nodes as string[])
      : [];
    existingArtboardIds = rootNodes.filter((id) => {
      const node = existing[id] as Record<string, unknown> | undefined;
      return (node?.type as any)?.resolvedName === 'AstryxArtboard';
    });
  } catch { /* treat as empty canvas */ }

  // ── Case A: AI already added a new artboard ─────────────────────────────────
  // Find a new AstryxArtboard node whose ID is absent from the existing canvas.
  let aiNewArtboardId: string | null = null;
  for (const [id, node] of Object.entries(patchNodes)) {
    if (!node || typeof node !== 'object') continue;
    const n = node as Record<string, unknown>;
    if (
      (n.type as any)?.resolvedName === 'AstryxArtboard' &&
      n.parent === 'ROOT' &&
      !existingIds.has(id)
    ) {
      aiNewArtboardId = id;
      break;
    }
  }

  if (aiNewArtboardId !== null) {
    // Always rebuild ROOT from a strict list: all existing artboard IDs plus the
    // new artboard. Never carry through other new IDs the AI put in ROOT — they
    // could be non-artboard nodes, leaving direct non-artboard ROOT children
    // despite the stated invariant.
    const strictRootNodes = [...existingArtboardIds, aiNewArtboardId].filter(
      (id, i, arr) => arr.indexOf(id) === i,
    );

    const patchRoot = patchNodes['ROOT'] as Record<string, unknown> | undefined;
    const currentRootNodes: string[] = Array.isArray(patchRoot?.nodes)
      ? (patchRoot!.nodes as string[])
      : [];
    const alreadyCorrect =
      strictRootNodes.length === currentRootNodes.length &&
      strictRootNodes.every((id) => currentRootNodes.includes(id));

    if (alreadyCorrect) return patchNodes; // ROOT already correct — pass through unchanged.

    const rootBase: Record<string, unknown> = patchRoot ?? {
      type: { resolvedName: 'AstryxSection' },
      isCanvas: true,
      props: { direction: 'column', gap: 0, padding: 0 },
      displayName: 'AstryxSection',
      custom: {},
      parent: null,
      hidden: false,
      linkedNodes: {},
    };
    return { ...patchNodes, ROOT: { ...rootBase, nodes: strictRootNodes } };
  }

  // ── Case B: AI ignored the override — synthesise a new artboard ─────────────
  console.warn(
    '[enforceNewScreenPatch] newScreen patch contained no new AstryxArtboard — synthesising',
  );

  const newArtboardId = `kf_ab_${Date.now()}`;
  const enforcedPatch: CraftState = {};
  const artboardChildIds: string[] = [];

  // First pass: collect every new node ID so we can identify hierarchy roots.
  const newNodeIds = new Set<string>();
  for (const [id] of Object.entries(patchNodes)) {
    if (id !== 'ROOT' && !existingIds.has(id)) newNodeIds.add(id);
  }

  // Second pass: build the enforced patch.
  for (const [id, node] of Object.entries(patchNodes)) {
    if (id === 'ROOT') continue; // Rebuilt below.
    if (!node || typeof node !== 'object') continue;

    // Drop all modifications to existing nodes. For a newScreen request the AI
    // must not touch existing artboards — keeping their edited forms in the patch
    // would produce contradictory parent pointers after client merge (e.g. both
    // screen-1.nodes and the new artboard.nodes referencing the same new node).
    if (existingIds.has(id)) continue;

    const n = node as Record<string, unknown>;
    const originalParent = n.parent as string | undefined;

    // A new node is a *top-level root* if its original parent is not another new
    // node (i.e. it is either parented to ROOT, an existing node, or has no
    // parent). Only top-level roots become direct children of the synthesised
    // artboard; their descendants keep their original parent pointers so the full
    // AI-generated sub-tree is preserved with consistent graph edges.
    if (!originalParent || !newNodeIds.has(originalParent)) {
      artboardChildIds.push(id);
      enforcedPatch[id] = { ...n, parent: newArtboardId };
    } else {
      // Descendant new node — preserve original parent to maintain nesting.
      enforcedPatch[id] = node;
    }
  }

  // Synthesise the wrapper artboard.
  enforcedPatch[newArtboardId] = {
    type: { resolvedName: 'AstryxArtboard' },
    isCanvas: true,
    props: { label: 'New Screen', width: 390, direction: 'column', gap: 16, padding: 24 },
    displayName: 'AstryxArtboard',
    custom: {},
    parent: 'ROOT',
    hidden: false,
    nodes: artboardChildIds,
    linkedNodes: {},
  };

  // Rebuild ROOT: preserve all existing artboard IDs, append the new artboard.
  enforcedPatch['ROOT'] = {
    type: { resolvedName: 'AstryxSection' },
    isCanvas: true,
    props: { direction: 'column', gap: 0, padding: 0 },
    displayName: 'AstryxSection',
    custom: {},
    parent: null,
    hidden: false,
    nodes: [...existingArtboardIds, newArtboardId],
    linkedNodes: {},
  };

  return enforcedPatch;
}
