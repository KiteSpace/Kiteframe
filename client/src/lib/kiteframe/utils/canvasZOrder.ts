import type { CanvasObject, Edge, Node } from "../types";

export type CanvasStackTarget =
  | { kind: "node"; id: string }
  | { kind: "canvasObject"; id: string };

export type CanvasStackOperation =
  | "bring-to-front"
  | "bring-forward"
  | "send-backward"
  | "send-to-back";

export interface CanvasHistoryState {
  nodes: Node[];
  edges: Edge[];
  canvasObjects: CanvasObject[];
  viewport: { x: number; y: number; zoom: number };
}

interface StackEntry {
  kind: CanvasStackTarget["kind"];
  id: string;
  zIndex: number;
  renderOrder: number;
}

const finiteZIndex = (value: number | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const sameTarget = (entry: StackEntry, target: CanvasStackTarget): boolean =>
  entry.kind === target.kind && entry.id === target.id;

/**
 * Reorder nodes and canvas objects in their shared CSS stacking domain.
 *
 * Nodes render before canvas objects, so DOM order is the deterministic
 * tie-breaker for legacy data where multiple items share the same z-index.
 * Every operation writes unique, contiguous z-indexes to remove that ambiguity.
 */
export function reorderCanvasStack(
  nodes: Node[],
  canvasObjects: CanvasObject[],
  target: CanvasStackTarget,
  operation: CanvasStackOperation,
): { nodes: Node[]; canvasObjects: CanvasObject[]; changed: boolean } {
  const entries: StackEntry[] = [
    ...nodes.map((node, index) => ({
      kind: "node" as const,
      id: node.id,
      zIndex: finiteZIndex(node.zIndex),
      renderOrder: index,
    })),
    ...canvasObjects.map((object, index) => ({
      kind: "canvasObject" as const,
      id: object.id,
      zIndex: finiteZIndex(object.zIndex),
      renderOrder: nodes.length + index,
    })),
  ].sort(
    (a, b) =>
      a.zIndex - b.zIndex ||
      a.renderOrder - b.renderOrder ||
      a.id.localeCompare(b.id),
  );

  const currentIndex = entries.findIndex((entry) => sameTarget(entry, target));
  if (currentIndex === -1) {
    return { nodes, canvasObjects, changed: false };
  }

  const reordered = [...entries];
  const [selected] = reordered.splice(currentIndex, 1);

  switch (operation) {
    case "bring-to-front":
      reordered.push(selected);
      break;
    case "bring-forward":
      reordered.splice(Math.min(currentIndex + 1, reordered.length), 0, selected);
      break;
    case "send-backward":
      reordered.splice(Math.max(currentIndex - 1, 0), 0, selected);
      break;
    case "send-to-back":
      reordered.unshift(selected);
      break;
  }

  const nextZIndex = new Map<string, number>();
  reordered.forEach((entry, index) => {
    nextZIndex.set(`${entry.kind}:${entry.id}`, index);
  });

  const updatedNodes = nodes.map((node) => ({
    ...node,
    zIndex: nextZIndex.get(`node:${node.id}`) ?? 0,
  }));
  const updatedCanvasObjects = canvasObjects.map((object) => ({
    ...object,
    zIndex: nextZIndex.get(`canvasObject:${object.id}`) ?? 0,
  }));

  const changed =
    updatedNodes.some((node, index) => node.zIndex !== nodes[index]?.zIndex) ||
    updatedCanvasObjects.some(
      (object, index) => object.zIndex !== canvasObjects[index]?.zIndex,
    );

  return {
    nodes: changed ? updatedNodes : nodes,
    canvasObjects: changed ? updatedCanvasObjects : canvasObjects,
    changed,
  };
}

const statesMatch = (
  left: CanvasHistoryState | undefined,
  right: CanvasHistoryState,
): boolean =>
  !!left &&
  JSON.stringify(left.nodes) === JSON.stringify(right.nodes) &&
  JSON.stringify(left.edges) === JSON.stringify(right.edges) &&
  JSON.stringify(left.canvasObjects) === JSON.stringify(right.canvasObjects) &&
  JSON.stringify(left.viewport) === JSON.stringify(right.viewport);

/**
 * Append the post-reorder snapshot while preserving the current snapshot as
 * its immediate predecessor. This makes one Ctrl+Z undo exactly one layer move
 * even when older mutations left history pointing at a stale snapshot.
 */
export function appendCanvasStackHistory(
  history: CanvasHistoryState[],
  historyIndex: number,
  currentState: CanvasHistoryState,
  nextState: CanvasHistoryState,
  maxHistorySize = 20,
): { history: CanvasHistoryState[]; historyIndex: number } {
  const currentIndex = Math.max(-1, Math.min(historyIndex, history.length - 1));
  const nextHistory = history.slice(0, currentIndex + 1);

  if (!statesMatch(nextHistory[nextHistory.length - 1], currentState)) {
    nextHistory.push(currentState);
  }
  nextHistory.push(nextState);

  const trimmedHistory =
    nextHistory.length > maxHistorySize
      ? nextHistory.slice(-maxHistorySize)
      : nextHistory;

  return {
    history: trimmedHistory,
    historyIndex: trimmedHistory.length - 1,
  };
}
