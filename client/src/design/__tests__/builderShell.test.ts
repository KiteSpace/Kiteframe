/**
 * Builder Shell tests — component registry alignment, ranked search,
 * recent/persistence helpers, and Preview state building.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  COMPONENT_REGISTRY,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  searchRegistry,
  groupByCategory,
  readRecentIds,
  pushRecentId,
  readPanelView,
  writePanelView,
} from "../builderRegistry";
import { listArtboards, buildPreviewState } from "../DesignEditor";

// ─── Registry integrity ────────────────────────────────────────────────────────

describe("component registry", () => {
  it("has unique ids", () => {
    const ids = COMPONENT_REGISTRY.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every def belongs to a known category", () => {
    for (const def of COMPONENT_REGISTRY) {
      expect(CATEGORY_ORDER).toContain(def.category);
      expect(CATEGORY_LABELS[def.category]).toBeTruthy();
    }
  });

  it("every def has a 3-char glyph", () => {
    for (const def of COMPONENT_REGISTRY) {
      expect(def.glyph).toHaveLength(3);
    }
  });

  it("groupByCategory follows CATEGORY_ORDER and drops empty groups", () => {
    const groups = groupByCategory(COMPONENT_REGISTRY);
    const cats = groups.map((g) => g.category);
    expect(cats).toEqual(CATEGORY_ORDER.filter((c) => cats.includes(c)));
    for (const g of groups) expect(g.items.length).toBeGreaterThan(0);
  });
});

// ─── Ranked search ─────────────────────────────────────────────────────────────

describe("searchRegistry", () => {
  it("exact name match ranks first", () => {
    const results = searchRegistry("Button");
    expect(results[0].id).toBe("Button");
  });

  it("prefix beats substring", () => {
    const results = searchRegistry("Text");
    const textIdx = results.findIndex((d) => d.id === "Text");
    const textAreaIdx = results.findIndex((d) => d.id === "TextArea");
    const richIdx = results.findIndex((d) => d.id === "ContextMenu"); // substring only
    expect(textIdx).toBeGreaterThanOrEqual(0);
    expect(textAreaIdx).toBeGreaterThanOrEqual(0);
    if (richIdx >= 0) {
      expect(textIdx).toBeLessThan(richIdx);
      expect(textAreaIdx).toBeLessThan(richIdx);
    }
  });

  it("matches keywords", () => {
    const results = searchRegistry("autocomplete");
    expect(results.map((d) => d.id)).toContain("Typeahead");
  });

  it("is case-insensitive", () => {
    expect(searchRegistry("bUtToN")[0].id).toBe("Button");
  });

  it("empty query returns everything", () => {
    expect(searchRegistry("")).toHaveLength(COMPONENT_REGISTRY.length);
  });

  it("no match returns empty", () => {
    expect(searchRegistry("zzzznotacomponent")).toHaveLength(0);
  });
});

// ─── localStorage persistence ──────────────────────────────────────────────────

describe("recent components + panel view persistence", () => {
  beforeEach(() => localStorage.clear());

  it("pushRecentId puts newest first and dedupes", () => {
    pushRecentId("Button");
    pushRecentId("Card");
    pushRecentId("Button");
    expect(readRecentIds()).toEqual(["Button", "Card"]);
  });

  it("caps the recent list", () => {
    for (let i = 0; i < 20; i++) pushRecentId(`Comp${i}`);
    expect(readRecentIds().length).toBeLessThanOrEqual(12);
    expect(readRecentIds()[0]).toBe("Comp19");
  });

  it("readRecentIds tolerates corrupt storage", () => {
    localStorage.setItem("builder.recentComponents", "{not json");
    expect(readRecentIds()).toEqual([]);
  });

  it("panel view round-trips and defaults to grid", () => {
    expect(readPanelView()).toBe("grid");
    writePanelView("list");
    expect(readPanelView()).toBe("list");
    localStorage.setItem("builder.panelView", "bogus");
    expect(readPanelView()).toBe("grid");
  });
});

// ─── Preview state building ────────────────────────────────────────────────────

function makeState() {
  return JSON.stringify({
    ROOT: {
      type: { resolvedName: "AstryxSection" },
      isCanvas: true,
      props: { direction: "row", gap: 80, padding: 40 },
      displayName: "AstryxSection",
      custom: {},
      hidden: false,
      nodes: ["ab-1", "ab-2"],
      linkedNodes: {},
    },
    "ab-1": {
      type: { resolvedName: "AstryxArtboard" },
      isCanvas: true,
      props: { label: "Home", x: 64, y: 64 },
      displayName: "AstryxArtboard",
      custom: {},
      parent: "ROOT",
      hidden: false,
      nodes: ["btn-1"],
      linkedNodes: {},
    },
    "btn-1": {
      type: { resolvedName: "AstryxButton" },
      isCanvas: false,
      props: { children: "Go" },
      displayName: "AstryxButton",
      custom: {},
      parent: "ab-1",
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
    "ab-2": {
      type: { resolvedName: "AstryxArtboard" },
      isCanvas: true,
      props: { label: "Settings", x: 600, y: 64 },
      displayName: "AstryxArtboard",
      custom: {},
      parent: "ROOT",
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
  });
}

describe("listArtboards", () => {
  it("returns artboards in ROOT order with labels", () => {
    expect(listArtboards(makeState())).toEqual([
      { id: "ab-1", label: "Home" },
      { id: "ab-2", label: "Settings" },
    ]);
  });

  it("handles null and corrupt input", () => {
    expect(listArtboards(null)).toEqual([]);
    expect(listArtboards("{bad json")).toEqual([]);
  });

  it("skips non-artboard ROOT children", () => {
    const state = JSON.parse(makeState());
    state.ROOT.nodes.push("btn-loose");
    state["btn-loose"] = {
      type: { resolvedName: "AstryxButton" },
      props: {}, displayName: "AstryxButton", custom: {}, parent: "ROOT",
      hidden: false, nodes: [], linkedNodes: {},
    };
    expect(listArtboards(JSON.stringify(state)).map((a) => a.id)).toEqual(["ab-1", "ab-2"]);
  });
});

describe("buildPreviewState", () => {
  it("keeps only the chosen artboard subtree", () => {
    const out = buildPreviewState(makeState(), "ab-1");
    expect(out).toBeTruthy();
    const state = JSON.parse(out!);
    expect(state.ROOT.nodes).toEqual(["ab-1"]);
    expect(state["ab-1"]).toBeTruthy();
    expect(state["btn-1"]).toBeTruthy();
    expect(state["ab-2"]).toBeUndefined();
  });

  it("resets ROOT layout so the single screen renders cleanly", () => {
    const state = JSON.parse(buildPreviewState(makeState(), "ab-2")!);
    expect(state.ROOT.props.padding).toBe(0);
    expect(state.ROOT.props.gap).toBe(0);
  });

  it("returns null for unknown artboard", () => {
    expect(buildPreviewState(makeState(), "nope")).toBeNull();
  });
});
