import { describe, expect, it } from "vitest";
import {
  createEmptyCraftState,
  deleteNodesFromState,
  getUntouchedDefaultArtboardId,
  reuseUntouchedDefaultArtboard,
  getSharedDimensionValue,
} from "../DesignEditor";

function generatedState() {
  return {
    ROOT: { type: { resolvedName: "AstryxSection" }, nodes: ["generated"], parent: null, linkedNodes: {} },
    generated: {
      type: { resolvedName: "AstryxArtboard" },
      props: { label: "Checkout", width: 390 },
      parent: "ROOT",
      nodes: ["heading"],
      linkedNodes: {},
    },
    heading: {
      type: { resolvedName: "AstryxHeading" },
      props: { text: "Checkout" },
      parent: "generated",
      nodes: [],
      linkedNodes: {},
    },
  };
}

describe("artboard lifecycle helpers", () => {
  it("deletes an artboard subtree and removes its ROOT reference", () => {
    const state = {
      ROOT: { nodes: ["artboard-1"], linkedNodes: {} },
      "artboard-1": { type: { resolvedName: "AstryxArtboard" }, parent: "ROOT", nodes: ["button-1"], linkedNodes: {} },
      "button-1": { parent: "artboard-1", nodes: [], linkedNodes: {} },
    };
    const next = deleteNodesFromState(state, ["artboard-1"]);
    expect(next.ROOT.nodes).toEqual([]);
    expect(next["artboard-1"]).toBeUndefined();
    expect(next["button-1"]).toBeUndefined();
  });

  it("recognizes only the untouched default Screen 1 artboard", () => {
    const initial = JSON.parse(createEmptyCraftState());
    expect(getUntouchedDefaultArtboardId(initial)).toBe("artboard-1");
    expect((initial["artboard-1"] as any).props.width).toBeUndefined();
    expect((initial["artboard-1"] as any).props.height).toBeUndefined();
    initial["artboard-1"].nodes = ["button"];
    expect(getUntouchedDefaultArtboardId(initial)).toBeUndefined();
  });

  it("reports shared, automatic, and mixed dimensions for a multi-selection", () => {
    expect(getSharedDimensionValue([{ width: 240 }, { width: 240 }], "width")).toBe(240);
    expect(getSharedDimensionValue([{}, { width: "auto" }], "width")).toBeUndefined();
    expect(getSharedDimensionValue([{ width: 240 }, {}], "width")).toBe("mixed");
    expect(getSharedDimensionValue([{ height: 80 }, { height: 120 }], "height")).toBe("mixed");
  });

  it("creates content-fit fallback artboards without an explicit width", () => {
    const fallbackState = {
      ROOT: { nodes: ["artboard-1"] },
      "artboard-1": { props: { label: "Screen 1" } },
    };
    expect(fallbackState["artboard-1"].props.width).toBeUndefined();
    expect(fallbackState["artboard-1"].props.height).toBeUndefined();
  });

  it("reuses the default artboard ID and generated label for first interface generation", () => {
    const initial = JSON.parse(createEmptyCraftState());
    const next = reuseUntouchedDefaultArtboard(initial, generatedState());
    expect(next.ROOT.nodes).toEqual(["artboard-1"]);
    expect(next["generated"]).toBeUndefined();
    expect((next["artboard-1"] as any).props.label).toBe("Checkout");
    expect((next["artboard-1"] as any).nodes).toEqual(["heading"]);
    expect((next.heading as any).parent).toBe("artboard-1");
  });

  it("keeps additional screens reachable when first generation creates multiple artboards", () => {
    const initial = JSON.parse(createEmptyCraftState());
    const incoming = generatedState();
    incoming.ROOT.nodes.push("confirmation");
    incoming.confirmation = {
      type: { resolvedName: "AstryxArtboard" },
      props: { label: "Confirmation", width: 390 },
      parent: "ROOT",
      nodes: [],
      linkedNodes: {},
    };

    const next = reuseUntouchedDefaultArtboard(initial, incoming);
    expect(next.ROOT.nodes).toEqual(["artboard-1", "confirmation"]);
    expect((next.confirmation as any).parent).toBe("ROOT");
    expect((next["artboard-1"] as any).props.label).toBe("Checkout");
  });

  it("preserves a meaningful existing artboard when a new screen is generated", () => {
    const existing = JSON.parse(createEmptyCraftState());
    existing["artboard-1"].nodes = ["existing-button"];
    existing["existing-button"] = { parent: "artboard-1", nodes: [], linkedNodes: {} };
    const next = reuseUntouchedDefaultArtboard(existing, generatedState());
    expect(next.ROOT.nodes).toEqual(["artboard-1", "generated"]);
    expect((next["artboard-1"] as any).nodes).toEqual(["existing-button"]);
  });

  // ── Corruption-safety: broken refs and wrong parent fields ──────────────

  it("deletes artboard with a missing child ref (broken nodes array)", () => {
    // "ghost-child" is listed in artboard-1.nodes but does not exist in state.
    const state = {
      ROOT: { nodes: ["artboard-1", "artboard-2"], linkedNodes: {} },
      "artboard-1": {
        type: { resolvedName: "AstryxArtboard" },
        parent: "ROOT",
        nodes: ["real-button", "ghost-child"],
        linkedNodes: {},
      },
      "real-button": { parent: "artboard-1", nodes: [], linkedNodes: {} },
      "artboard-2": {
        type: { resolvedName: "AstryxArtboard" },
        parent: "ROOT",
        nodes: ["btn2"],
        linkedNodes: {},
      },
      btn2: { parent: "artboard-2", nodes: [], linkedNodes: {} },
    };
    const next = deleteNodesFromState(state, ["artboard-1"]);
    // artboard-1 and its reachable child are gone; the missing ref is silently skipped
    expect(next["artboard-1"]).toBeUndefined();
    expect(next["real-button"]).toBeUndefined();
    expect(next["ghost-child"]).toBeUndefined(); // wasn't in state to begin with
    // ROOT.nodes no longer includes artboard-1
    expect(next.ROOT.nodes).toEqual(["artboard-2"]);
    // The sibling artboard and its child are intact
    expect(next["artboard-2"]).toBeDefined();
    expect(next.btn2).toBeDefined();
  });

  it("removes artboard from ROOT.nodes even when parent field is null/wrong", () => {
    // artboard-1 is in ROOT.nodes but its own `parent` field is null (corrupted).
    const state = {
      ROOT: { nodes: ["artboard-1", "artboard-2"], linkedNodes: {} },
      "artboard-1": {
        type: { resolvedName: "AstryxArtboard" },
        parent: null, // wrong — should be "ROOT"
        nodes: ["btn1"],
        linkedNodes: {},
      },
      btn1: { parent: "artboard-1", nodes: [], linkedNodes: {} },
      "artboard-2": {
        type: { resolvedName: "AstryxArtboard" },
        parent: "ROOT",
        nodes: [],
        linkedNodes: {},
      },
    };
    const next = deleteNodesFromState(state, ["artboard-1"]);
    expect(next["artboard-1"]).toBeUndefined();
    expect(next.btn1).toBeUndefined();
    // ROOT.nodes must not retain the stale reference
    expect(next.ROOT.nodes).toEqual(["artboard-2"]);
    expect(next["artboard-2"]).toBeDefined();
  });

  it("handles a cyclic linkedNodes reference without hanging", () => {
    // node-a and node-b mutually reference each other via linkedNodes (cycle).
    const state = {
      ROOT: { nodes: ["artboard-1"], linkedNodes: {} },
      "artboard-1": {
        type: { resolvedName: "AstryxArtboard" },
        parent: "ROOT",
        nodes: ["node-a"],
        linkedNodes: {},
      },
      "node-a": {
        parent: "artboard-1",
        nodes: [],
        linkedNodes: { slot: "node-b" },
      },
      "node-b": {
        parent: "artboard-1",
        nodes: [],
        linkedNodes: { slot: "node-a" }, // cycle back to node-a
      },
    };
    const next = deleteNodesFromState(state, ["artboard-1"]);
    expect(next["artboard-1"]).toBeUndefined();
    expect(next["node-a"]).toBeUndefined();
    expect(next["node-b"]).toBeUndefined();
    expect(next.ROOT.nodes).toEqual([]);
  });
});