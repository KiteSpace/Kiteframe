/**
 * Pure-function helpers for multi-artboard operations on a serialised craft
 * state map.  All functions are side-effect-free and return a new state object
 * (or null on no-op / invalid input).  They do not import React or craft.js so
 * they can be unit-tested in a plain Node/vitest environment.
 *
 * Coordinate system: artboard x/y are canvas-space pixels from the top-left
 * origin.  Width and height are explicit props; height defaults to 800 when
 * absent (content-sized artboard estimate used for distribution calculations).
 */

// ─── Geometry helpers ─────────────────────────────────────────────────────────

const ARTBOARD_HEIGHT_FALLBACK = 800;

export interface ArtboardGeometry {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Coerce to a finite number, falling back only when NaN/undefined (0 is valid). */
function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Extract x/y/w/h for one serialised AstryxArtboard node. */
export function getArtboardGeometry(node: Record<string, any>, id: string): ArtboardGeometry {
  const props = node.props ?? {};
  return {
    id,
    x: num(props.x, 64),
    y: num(props.y, 64),
    w: num(props.width, 390) || 390, // width 0 is not meaningful — keep 390
    h: typeof props.height === "number" && Number.isFinite(props.height) ? props.height : ARTBOARD_HEIGHT_FALLBACK,
  };
}

/** Return the artboard geometry list for a given set of node IDs.
 *  Silently skips IDs that are missing or not AstryxArtboard nodes. */
export function resolveArtboardGeometries(
  state: Record<string, any>,
  ids: string[],
): ArtboardGeometry[] {
  return ids
    .filter((id) => id && id !== "ROOT" && state[id]?.type?.resolvedName === "AstryxArtboard")
    .map((id) => getArtboardGeometry(state[id], id));
}

// ─── Partition helpers ────────────────────────────────────────────────────────

/**
 * Splits a multi-select id set into artboard ids and component ids.
 * ROOT and missing nodes are always excluded from both lists.
 */
export function partitionSelection(
  state: Record<string, any>,
  ids: string[],
): { artboardIds: string[]; componentIds: string[] } {
  const artboardIds: string[] = [];
  const componentIds: string[] = [];
  for (const id of ids) {
    if (!id || id === "ROOT" || !state[id]) continue;
    if (state[id]?.type?.resolvedName === "AstryxArtboard") {
      artboardIds.push(id);
    } else {
      componentIds.push(id);
    }
  }
  return { artboardIds, componentIds };
}

// ─── Group translate ──────────────────────────────────────────────────────────

/**
 * Translate all artboards in `ids` by (dx, dy), preserving their relative
 * positions.  Returns the mutated state (or the original if nothing changed).
 */
export function translateArtboardsInState(
  state: Record<string, any>,
  ids: string[],
  dx: number,
  dy: number,
): Record<string, any> {
  if (dx === 0 && dy === 0) return state;
  const geos = resolveArtboardGeometries(state, ids);
  if (geos.length === 0) return state;

  let next = { ...state };
  for (const g of geos) {
    const node = next[g.id];
    if (!node) continue;
    next[g.id] = {
      ...node,
      props: { ...node.props, x: g.x + dx, y: g.y + dy },
    };
  }
  return next;
}

// ─── Alignment ────────────────────────────────────────────────────────────────

export type AlignEdge =
  | "left"
  | "center-h"
  | "right"
  | "top"
  | "center-v"
  | "bottom";

/**
 * Align all artboards in the selection to the same edge or center axis.
 * The anchor is the bounding box of the entire selection (leftmost x for
 * "left", rightmost edge for "right", etc.).
 *
 * Returns the new state, or the original state when < 2 artboards exist.
 */
export function alignArtboardsInState(
  state: Record<string, any>,
  ids: string[],
  edge: AlignEdge,
): Record<string, any> {
  const geos = resolveArtboardGeometries(state, ids);
  if (geos.length < 2) return state;

  // Compute bounding box of the entire group
  const minX = Math.min(...geos.map((g) => g.x));
  const minY = Math.min(...geos.map((g) => g.y));
  const maxX = Math.max(...geos.map((g) => g.x + g.w));
  const maxY = Math.max(...geos.map((g) => g.y + g.h));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  let next = { ...state };
  for (const g of geos) {
    const node = next[g.id];
    if (!node) continue;
    let newX = g.x;
    let newY = g.y;
    switch (edge) {
      case "left":      newX = minX; break;
      case "center-h":  newX = centerX - g.w / 2; break;
      case "right":     newX = maxX - g.w; break;
      case "top":       newY = minY; break;
      case "center-v":  newY = centerY - g.h / 2; break;
      case "bottom":    newY = maxY - g.h; break;
    }
    if (newX !== g.x || newY !== g.y) {
      next[g.id] = { ...node, props: { ...node.props, x: newX, y: newY } };
    }
  }
  return next;
}

// ─── Distribute ───────────────────────────────────────────────────────────────

export type DistributeAxis = "horizontal" | "vertical";

/**
 * Distribute artboards so they have equal gaps along the given axis.
 * The outermost artboards stay fixed; inner ones are repositioned.
 *
 * Returns the new state, or the original state when < 3 artboards exist
 * (2 artboards trivially have equal gap already).
 */
export function distributeArtboardsInState(
  state: Record<string, any>,
  ids: string[],
  axis: DistributeAxis,
): Record<string, any> {
  const geos = resolveArtboardGeometries(state, ids);
  if (geos.length < 3) return state;

  let next = { ...state };

  if (axis === "horizontal") {
    // Sort by left edge (x)
    const sorted = [...geos].sort((a, b) => a.x - b.x);
    const totalWidth = sorted.reduce((sum, g) => sum + g.w, 0);
    const spanX = (sorted[sorted.length - 1].x + sorted[sorted.length - 1].w) - sorted[0].x;
    const totalGap = spanX - totalWidth;
    const gap = totalGap / (sorted.length - 1);

    let cursor = sorted[0].x + sorted[0].w;
    for (let i = 1; i < sorted.length - 1; i++) {
      const g = sorted[i];
      const newX = Math.round(cursor + gap);
      const node = next[g.id];
      if (node) next[g.id] = { ...node, props: { ...node.props, x: newX } };
      cursor = newX + g.w;
    }
  } else {
    // Sort by top edge (y)
    const sorted = [...geos].sort((a, b) => a.y - b.y);
    const totalHeight = sorted.reduce((sum, g) => sum + g.h, 0);
    const spanY = (sorted[sorted.length - 1].y + sorted[sorted.length - 1].h) - sorted[0].y;
    const totalGap = spanY - totalHeight;
    const gap = totalGap / (sorted.length - 1);

    let cursor = sorted[0].y + sorted[0].h;
    for (let i = 1; i < sorted.length - 1; i++) {
      const g = sorted[i];
      const newY = Math.round(cursor + gap);
      const node = next[g.id];
      if (node) next[g.id] = { ...node, props: { ...node.props, y: newY } };
      cursor = newY + g.h;
    }
  }
  return next;
}

// ─── Multi-artboard copy/paste helpers ───────────────────────────────────────

/** Monotonic counter so pasted clone IDs never collide, even when several
 *  entries are pasted within the same millisecond. */
let _pasteSeq = 0;

/**
 * Clone multiple artboard subtrees into state under ROOT, offsetting each by
 * (offsetX, offsetY) relative to its original position.  Fresh IDs are
 * assigned to every node in every subtree.  Returns the new state.
 */
export function pasteArtboardsInState(
  state: Record<string, any>,
  entries: { subtree: Record<string, any>; rootId: string }[],
  offsetX: number,
  offsetY: number,
): Record<string, any> {
  if (entries.length === 0) return state;

  let next = { ...state };
  const rootNodes: string[] = Array.isArray(next["ROOT"]?.nodes) ? [...next["ROOT"].nodes] : [];

  for (const entry of entries) {
    // Re-clone with fresh IDs (same pattern as extractNodeSubtree)
    const src = entry.subtree;
    const srcRoot = entry.rootId;

    const allIds: string[] = [];
    const queue: string[] = [srcRoot];
    while (queue.length) {
      const cur = queue.shift()!;
      allIds.push(cur);
      const node = src[cur];
      if (!node) continue;
      for (const c of node.nodes ?? []) queue.push(c as string);
      for (const v of Object.values(node.linkedNodes ?? {})) queue.push(v as string);
    }

    const batch = `${Date.now().toString(36)}-${++_pasteSeq}`; // unique across loop iterations and rapid pastes
    const idMap: Record<string, string> = {};
    allIds.forEach((id, i) => { idMap[id] = `node-${batch}-${i}`; });
    const newRootId = idMap[srcRoot];

    for (const id of allIds) {
      const node: Record<string, any> = JSON.parse(JSON.stringify(src[id]));
      if (Array.isArray(node.nodes)) node.nodes = node.nodes.map((c: string) => idMap[c] ?? c);
      if (node.linkedNodes && typeof node.linkedNodes === "object") {
        const r: Record<string, string> = {};
        for (const [k, v] of Object.entries(node.linkedNodes)) r[k] = idMap[v as string] ?? (v as string);
        node.linkedNodes = r;
      }
      node.parent = id === srcRoot ? "ROOT" : (idMap[node.parent] ?? node.parent);

      // Shift artboard root position (0 is a valid coordinate — only fall back on NaN)
      if (id === srcRoot) {
        node.props = {
          ...node.props,
          x: num(node.props?.x, 64) + offsetX,
          y: num(node.props?.y, 64) + offsetY,
        };
      }
      next[idMap[id]] = node;
    }
    rootNodes.push(newRootId);
  }

  next["ROOT"] = { ...next["ROOT"], nodes: rootNodes };
  return next;
}
