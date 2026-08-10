/**
 * Tests for multi-artboard selection helpers: partitioning, group translation,
 * geometry-based alignment/distribution, and multi-artboard paste.
 */
import { describe, it, expect } from "vitest";
import {
  partitionSelection,
  resolveArtboardGeometries,
  translateArtboardsInState,
  alignArtboardsInState,
  distributeArtboardsInState,
  pasteArtboardsInState,
} from "../artboardAlignment";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Pass h = null to create an auto-height artboard (no height prop stored).
function makeArtboard(id: string, x: number, y: number, w = 390, h: number | null = 480, children: string[] = []) {
  return {
    [id]: {
      type: { resolvedName: "AstryxArtboard" },
      isCanvas: true,
      displayName: "AstryxArtboard",
      parent: "ROOT",
      nodes: children,
      linkedNodes: {},
      props: { label: id, x, y, width: w, ...(h != null ? { height: h } : {}) },
    },
  };
}

function makeComponent(id: string, parent: string, children: string[] = []) {
  return {
    [id]: {
      type: { resolvedName: "AstryxText" },
      displayName: "AstryxText",
      parent,
      nodes: children,
      linkedNodes: {},
      props: { children: "hello" },
    },
  };
}

function makeState(...parts: Record<string, any>[]): Record<string, any> {
  const artboardIds = parts
    .flatMap((p) => Object.entries(p))
    .filter(([, n]) => (n as any).parent === "ROOT")
    .map(([id]) => id);
  return Object.assign(
    {
      ROOT: {
        type: { resolvedName: "AstryxCanvas" },
        isCanvas: true,
        displayName: "AstryxCanvas",
        parent: null,
        nodes: artboardIds,
        linkedNodes: {},
        props: {},
      },
    },
    ...parts,
  );
}

// ─── partitionSelection ───────────────────────────────────────────────────────

describe("partitionSelection", () => {
  it("splits artboards and components, dropping ROOT and missing ids", () => {
    const state = makeState(
      makeArtboard("a1", 0, 0, 390, 480, ["t1"]),
      makeArtboard("a2", 500, 0),
      makeComponent("t1", "a1"),
    );
    const { artboardIds, componentIds } = partitionSelection(state, ["a1", "a2", "t1", "ROOT", "ghost"]);
    expect(artboardIds).toEqual(["a1", "a2"]);
    expect(componentIds).toEqual(["t1"]);
  });
});

// ─── translateArtboardsInState ────────────────────────────────────────────────

describe("translateArtboardsInState", () => {
  it("moves all selected artboards by the same delta, preserving relative offsets", () => {
    const state = makeState(makeArtboard("a1", 100, 200), makeArtboard("a2", 600, 250));
    const next = translateArtboardsInState(state, ["a1", "a2"], 50, -30);
    expect(next["a1"].props.x).toBe(150);
    expect(next["a1"].props.y).toBe(170);
    expect(next["a2"].props.x).toBe(650);
    expect(next["a2"].props.y).toBe(220);
    // Relative offset unchanged
    expect(next["a2"].props.x - next["a1"].props.x).toBe(500);
  });

  it("is a no-op for zero delta or empty selection", () => {
    const state = makeState(makeArtboard("a1", 100, 200));
    expect(translateArtboardsInState(state, ["a1"], 0, 0)).toBe(state);
    expect(translateArtboardsInState(state, [], 10, 10)).toBe(state);
  });

  it("ignores non-artboard nodes in the id list", () => {
    const state = makeState(makeArtboard("a1", 100, 200, 390, 480, ["t1"]), makeComponent("t1", "a1"));
    const next = translateArtboardsInState(state, ["a1", "t1"], 10, 10);
    expect(next["a1"].props.x).toBe(110);
    expect(next["t1"].props.x).toBeUndefined();
  });
});

// ─── alignArtboardsInState ────────────────────────────────────────────────────

describe("alignArtboardsInState", () => {
  const base = () => makeState(
    makeArtboard("a1", 100, 100, 200, 400),
    makeArtboard("a2", 500, 300, 300, 600),
  );

  it("aligns left edges to the leftmost x", () => {
    const next = alignArtboardsInState(base(), ["a1", "a2"], "left");
    expect(next["a1"].props.x).toBe(100);
    expect(next["a2"].props.x).toBe(100);
    // y untouched
    expect(next["a1"].props.y).toBe(100);
    expect(next["a2"].props.y).toBe(300);
  });

  it("aligns right edges to the rightmost edge", () => {
    const next = alignArtboardsInState(base(), ["a1", "a2"], "right");
    // Rightmost edge = max(100+200, 500+300) = 800
    expect(next["a1"].props.x).toBe(600);
    expect(next["a2"].props.x).toBe(500);
  });

  it("aligns horizontal centers to the group bounding-box center", () => {
    const next = alignArtboardsInState(base(), ["a1", "a2"], "center-h");
    // bbox: minX=100, maxX=800 → center 450
    expect(next["a1"].props.x).toBe(450 - 100); // 350
    expect(next["a2"].props.x).toBe(450 - 150); // 300
  });

  it("aligns top edges", () => {
    const next = alignArtboardsInState(base(), ["a1", "a2"], "top");
    expect(next["a1"].props.y).toBe(100);
    expect(next["a2"].props.y).toBe(100);
  });

  it("aligns bottom edges", () => {
    const next = alignArtboardsInState(base(), ["a1", "a2"], "bottom");
    // bbox bottom = max(100+400, 300+600) = 900
    expect(next["a1"].props.y).toBe(500);
    expect(next["a2"].props.y).toBe(300);
  });

  it("aligns vertical centers", () => {
    const next = alignArtboardsInState(base(), ["a1", "a2"], "center-v");
    // bbox: minY=100, maxY=900 → center 500
    expect(next["a1"].props.y).toBe(500 - 200); // 300
    expect(next["a2"].props.y).toBe(500 - 300); // 200
  });

  it("is a no-op with fewer than 2 artboards", () => {
    const state = makeState(makeArtboard("a1", 100, 100));
    expect(alignArtboardsInState(state, ["a1"], "left")).toBe(state);
  });

  it("uses a fallback height for auto-height artboards", () => {
    const state = makeState(
      makeArtboard("a1", 100, 100, 200, null), // auto height → 800 fallback
      makeArtboard("a2", 500, 300, 300, 600),
    );
    const next = alignArtboardsInState(state, ["a1", "a2"], "bottom");
    // bbox bottom = max(100+800, 300+600) = 900
    expect(next["a1"].props.y).toBe(100); // 900 - 800
    expect(next["a2"].props.y).toBe(300); // 900 - 600
  });
});

// ─── distributeArtboardsInState ───────────────────────────────────────────────

describe("distributeArtboardsInState", () => {
  it("equalizes horizontal gaps keeping outermost fixed", () => {
    const state = makeState(
      makeArtboard("a1", 0, 0, 100, 400),
      makeArtboard("a2", 150, 0, 100, 400),   // uneven middle
      makeArtboard("a3", 500, 0, 100, 400),
    );
    const next = distributeArtboardsInState(state, ["a1", "a2", "a3"], "horizontal");
    // span = 600, widths total = 300, gaps total = 300, per-gap = 150
    expect(next["a1"].props.x).toBe(0);
    expect(next["a2"].props.x).toBe(250); // 0+100+150
    expect(next["a3"].props.x).toBe(500);
  });

  it("equalizes vertical gaps keeping outermost fixed", () => {
    const state = makeState(
      makeArtboard("a1", 0, 0, 100, 100),
      makeArtboard("a2", 0, 120, 100, 100),
      makeArtboard("a3", 0, 500, 100, 100),
    );
    const next = distributeArtboardsInState(state, ["a1", "a2", "a3"], "vertical");
    // span = 600, heights total = 300, gaps total = 300, per-gap = 150
    expect(next["a1"].props.y).toBe(0);
    expect(next["a2"].props.y).toBe(250);
    expect(next["a3"].props.y).toBe(500);
  });

  it("is a no-op with fewer than 3 artboards", () => {
    const state = makeState(makeArtboard("a1", 0, 0), makeArtboard("a2", 500, 0));
    expect(distributeArtboardsInState(state, ["a1", "a2"], "horizontal")).toBe(state);
  });
});

// ─── pasteArtboardsInState ────────────────────────────────────────────────────

describe("pasteArtboardsInState", () => {
  it("clones subtrees with fresh ids, offsets positions, and attaches to ROOT", () => {
    const state = makeState(
      makeArtboard("a1", 100, 100, 390, 480, ["t1"]),
      makeComponent("t1", "a1"),
    );

    // Simulate a clipboard entry (subtree keyed by original ids)
    const subtree = {
      a1: JSON.parse(JSON.stringify(state["a1"])),
      t1: JSON.parse(JSON.stringify(state["t1"])),
    };
    const next = pasteArtboardsInState(state, [{ subtree, rootId: "a1" }], 40, 40);

    // Original untouched
    expect(next["a1"].props.x).toBe(100);
    expect(next["ROOT"].nodes).toContain("a1");

    // One new artboard appended to ROOT
    const newIds = next["ROOT"].nodes.filter((id: string) => id !== "a1");
    expect(newIds).toHaveLength(1);
    const clone = next[newIds[0]];
    expect(clone.type.resolvedName).toBe("AstryxArtboard");
    expect(clone.parent).toBe("ROOT");
    expect(clone.props.x).toBe(140);
    expect(clone.props.y).toBe(140);

    // Child cloned with fresh id, parented to the clone
    expect(clone.nodes).toHaveLength(1);
    const childId = clone.nodes[0];
    expect(childId).not.toBe("t1");
    expect(next[childId].parent).toBe(newIds[0]);
    expect(next[childId].props.children).toBe("hello");
  });

  it("pastes multiple artboards preserving each one's own offset origin", () => {
    const state = makeState(makeArtboard("a1", 0, 0), makeArtboard("a2", 500, 0));
    const entries = [
      { subtree: { a1: JSON.parse(JSON.stringify(state["a1"])) }, rootId: "a1" },
      { subtree: { a2: JSON.parse(JSON.stringify(state["a2"])) }, rootId: "a2" },
    ];
    const next = pasteArtboardsInState(state, entries, 40, 40);
    const newIds = next["ROOT"].nodes.filter((id: string) => id !== "a1" && id !== "a2");
    expect(newIds).toHaveLength(2);
    const xs = newIds.map((id: string) => next[id].props.x).sort((a: number, b: number) => a - b);
    expect(xs).toEqual([40, 540]); // group's relative offset preserved
    // All ids are unique
    expect(new Set(next["ROOT"].nodes).size).toBe(next["ROOT"].nodes.length);
  });

  it("returns state unchanged for empty entries", () => {
    const state = makeState(makeArtboard("a1", 0, 0));
    expect(pasteArtboardsInState(state, [], 40, 40)).toBe(state);
  });
});

// ─── resolveArtboardGeometries ────────────────────────────────────────────────

describe("resolveArtboardGeometries", () => {
  it("skips components, ROOT, and missing nodes", () => {
    const state = makeState(
      makeArtboard("a1", 10, 20, 300, 500, ["t1"]),
      makeComponent("t1", "a1"),
    );
    const geos = resolveArtboardGeometries(state, ["a1", "t1", "ROOT", "nope"]);
    expect(geos).toEqual([{ id: "a1", x: 10, y: 20, w: 300, h: 500 }]);
  });
});
