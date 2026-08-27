import { describe, expect, it } from "vitest";
import type { CanvasObject, Edge, Node } from "../../types";
import {
  appendCanvasStackHistory,
  reorderCanvasStack,
  type CanvasHistoryState,
} from "../canvasZOrder";

const node = (id: string, zIndex?: number): Node => ({
  id,
  type: "process",
  position: { x: 0, y: 0 },
  data: { label: id },
  zIndex,
});

const object = (id: string, zIndex?: number): CanvasObject => ({
  id,
  type: "shape",
  position: { x: 0, y: 0 },
  data: { shapeType: "rectangle" } as CanvasObject["data"],
  zIndex,
});

const stackOrder = (nodes: Node[], objects: CanvasObject[]): string[] =>
  [
    ...nodes.map((item, renderOrder) => ({
      id: `node:${item.id}`,
      zIndex: item.zIndex ?? 0,
      renderOrder,
    })),
    ...objects.map((item, index) => ({
      id: `canvasObject:${item.id}`,
      zIndex: item.zIndex ?? 0,
      renderOrder: nodes.length + index,
    })),
  ]
    .sort((a, b) => a.zIndex - b.zIndex || a.renderOrder - b.renderOrder)
    .map((item) => item.id);

describe("reorderCanvasStack", () => {
  it("moves a node forward by one visible layer across object types", () => {
    const result = reorderCanvasStack(
      [node("node-a", 0)],
      [object("shape-a", 0), object("text-a", 5)],
      { kind: "node", id: "node-a" },
      "bring-forward",
    );

    expect(stackOrder(result.nodes, result.canvasObjects)).toEqual([
      "canvasObject:shape-a",
      "node:node-a",
      "canvasObject:text-a",
    ]);
    expect(result.changed).toBe(true);
  });

  it("moves a canvas object backward by one visible layer across nodes", () => {
    const result = reorderCanvasStack(
      [node("node-a", -20), node("node-b", 10)],
      [object("shape-a", 10)],
      { kind: "canvasObject", id: "shape-a" },
      "send-backward",
    );

    expect(stackOrder(result.nodes, result.canvasObjects)).toEqual([
      "node:node-a",
      "canvasObject:shape-a",
      "node:node-b",
    ]);
  });

  it("normalizes duplicate, missing, and non-finite z-index values", () => {
    const result = reorderCanvasStack(
      [node("node-a"), node("node-b", Number.POSITIVE_INFINITY)],
      [object("shape-a", 0)],
      { kind: "canvasObject", id: "shape-a" },
      "bring-to-front",
    );

    expect(stackOrder(result.nodes, result.canvasObjects)).toEqual([
      "node:node-a",
      "node:node-b",
      "canvasObject:shape-a",
    ]);
    expect([
      ...result.nodes.map((item) => item.zIndex),
      ...result.canvasObjects.map((item) => item.zIndex),
    ].sort()).toEqual([0, 1, 2]);
  });

  it("moves targets to the true front and back of the combined stack", () => {
    const front = reorderCanvasStack(
      [node("node-a", 100)],
      [object("shape-a", -100), object("text-a", 50)],
      { kind: "canvasObject", id: "shape-a" },
      "bring-to-front",
    );
    expect(stackOrder(front.nodes, front.canvasObjects).at(-1)).toBe(
      "canvasObject:shape-a",
    );

    const back = reorderCanvasStack(
      front.nodes,
      front.canvasObjects,
      { kind: "node", id: "node-a" },
      "send-to-back",
    );
    expect(stackOrder(back.nodes, back.canvasObjects)[0]).toBe("node:node-a");
  });

  it("does not mutate the input arrays", () => {
    const nodes = [node("node-a", 0), node("node-b", 1)];
    const objects = [object("shape-a", 2)];

    reorderCanvasStack(
      nodes,
      objects,
      { kind: "node", id: "node-a" },
      "bring-to-front",
    );

    expect(nodes.map((item) => item.zIndex)).toEqual([0, 1]);
    expect(objects.map((item) => item.zIndex)).toEqual([2]);
  });
});

describe("appendCanvasStackHistory", () => {
  const edge: Edge = { id: "edge", source: "node-a", target: "node-b" };
  const snapshot = (zIndex: number): CanvasHistoryState => ({
    nodes: [node("node-a", zIndex), node("node-b", 1)],
    edges: [edge],
    canvasObjects: [object("shape-a", 2)],
    viewport: { x: 0, y: 0, zoom: 1 },
  });

  it("makes the pre-change state the immediate undo target", () => {
    const before = snapshot(0);
    const after = snapshot(2);
    const result = appendCanvasStackHistory([before], 0, before, after);

    expect(result.history).toEqual([before, after]);
    expect(result.historyIndex).toBe(1);
    expect(result.history[result.historyIndex - 1]).toEqual(before);
  });

  it("repairs a stale history cursor before appending the changed state", () => {
    const stale = snapshot(-1);
    const before = snapshot(0);
    const after = snapshot(2);
    const result = appendCanvasStackHistory([stale], 0, before, after);

    expect(result.history).toEqual([stale, before, after]);
    expect(result.history[result.historyIndex - 1]).toEqual(before);
  });
});
