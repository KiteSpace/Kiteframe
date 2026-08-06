import { describe, expect, it } from "vitest";
import {
  createEmptyCraftState,
  deleteNodesFromState,
  getUntouchedDefaultArtboardId,
  reuseUntouchedDefaultArtboard,
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
    initial["artboard-1"].nodes = ["button"];
    expect(getUntouchedDefaultArtboardId(initial)).toBeUndefined();
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
});