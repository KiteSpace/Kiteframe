import { describe, expect, it } from "vitest";
import {
  repairCraftState,
  repairCraftStateJson,
  pruneUnreachableCraftNodes,
  detectDisconnectedArtboards,
} from "../craftValidator";

/** State where the AI emitted artboards but forgot to list one in ROOT.nodes. */
function orphanedArtboardState() {
  return {
    ROOT: {
      type: { resolvedName: "AstryxSection" },
      nodes: ["ab1"], // ab2 missing!
      linkedNodes: {},
      parent: null,
      isCanvas: true,
      props: {},
    },
    ab1: {
      type: { resolvedName: "AstryxArtboard" },
      props: { label: "Login" },
      parent: "ROOT",
      nodes: ["h1"],
      linkedNodes: {},
    },
    h1: {
      type: { resolvedName: "AstryxHeading" },
      props: { text: "Login" },
      parent: "ab1",
      nodes: [],
      linkedNodes: {},
    },
    ab2: {
      type: { resolvedName: "AstryxArtboard" },
      props: { label: "Dashboard" },
      parent: "ROOT",
      nodes: ["h2"],
      linkedNodes: {},
    },
    h2: {
      type: { resolvedName: "AstryxHeading" },
      props: { text: "Dashboard" },
      parent: "ab2",
      nodes: [],
      linkedNodes: {},
    },
  };
}

describe("repair before prune (blank canvas regression)", () => {
  it("reattaches an artboard missing from ROOT.nodes so pruning keeps it", () => {
    const json = JSON.stringify(orphanedArtboardState());
    const repaired = repairCraftStateJson(json);
    const pruned = JSON.parse(pruneUnreachableCraftNodes(repaired));
    expect(pruned.ROOT.nodes).toContain("ab1");
    expect(pruned.ROOT.nodes).toContain("ab2");
    expect(pruned.ab2).toBeDefined();
    expect(pruned.h2).toBeDefined();
  });

  it("without repair, the same state would lose the orphaned artboard (documents the old bug)", () => {
    const json = JSON.stringify(orphanedArtboardState());
    const pruned = JSON.parse(pruneUnreachableCraftNodes(json));
    expect(pruned.ab2).toBeUndefined();
    expect(pruned.h2).toBeUndefined();
  });

  it("reports no disconnected artboards after repair", () => {
    const repaired = repairCraftStateJson(JSON.stringify(orphanedArtboardState()));
    expect(detectDisconnectedArtboards(repaired)).toEqual([]);
  });

  it("leaves genuinely empty ghost artboards disconnected so pruning still removes them", () => {
    const state = {
      ...orphanedArtboardState(),
      ghost: {
        type: { resolvedName: "AstryxArtboard" },
        props: { label: "Ghost" },
        parent: "ROOT",
        nodes: [],
        linkedNodes: {},
      },
    };
    const repaired = repairCraftStateJson(JSON.stringify(state));
    const ghosts = detectDisconnectedArtboards(repaired);
    expect(ghosts.map((g) => g.id)).toEqual(["ghost"]);
    const pruned = JSON.parse(pruneUnreachableCraftNodes(repaired));
    expect(pruned.ghost).toBeUndefined();
    expect(pruned.ab2).toBeDefined();
  });

  it("reattaches an orphaned non-artboard subtree via its declared parent chain", () => {
    const state = orphanedArtboardState();
    // ab2's heading detached from ab2's nodes array too
    (state.ab2 as any).nodes = [];
    const repaired = JSON.parse(repairCraftStateJson(JSON.stringify(state))) as any;
    expect(repaired.ab2.nodes).toContain("h2");
    const pruned = JSON.parse(pruneUnreachableCraftNodes(JSON.stringify(repaired)));
    expect(pruned.h2).toBeDefined();
  });

  it("falls back to ROOT when the declared parent does not exist", () => {
    const state: any = orphanedArtboardState();
    state.ab2.parent = "does-not-exist";
    const repaired = repairCraftState(state) as any;
    // Reattached somewhere reachable — either directly or via a synthesized wrapper.
    const pruned = JSON.parse(pruneUnreachableCraftNodes(JSON.stringify(repaired)));
    expect(pruned.ab2).toBeDefined();
    expect(pruned.h2).toBeDefined();
  });

  it("returns malformed JSON unchanged", () => {
    expect(repairCraftStateJson("{not json")).toBe("{not json");
  });
});

describe("hydration repair of ROOT mis-typed as AstryxArtboard (blank undeletable screen regression)", () => {
  /**
   * Simulates a design already persisted to the DB before the server-side
   * sanitizer existed: ROOT itself is typed AstryxArtboard with a stray
   * label, exactly as captured in the browser artboard-trace that revealed
   * the bug (ROOT label "Sales Dashboard", one real kf_ab_… artboard).
   */
  function persistedMalformedDesignJson(): string {
    return JSON.stringify({
      ROOT: {
        type: { resolvedName: "AstryxArtboard" },
        isCanvas: true,
        props: { label: "Sales Dashboard", direction: "row", gap: 80 },
        displayName: "AstryxArtboard",
        custom: {},
        parent: null,
        hidden: false,
        nodes: ["kf_ab_1786315591750"],
        linkedNodes: {},
      },
      kf_ab_1786315591750: {
        type: { resolvedName: "AstryxArtboard" },
        props: { label: "Screen 1" },
        parent: "ROOT",
        nodes: ["h1", "t1", "b1"],
        linkedNodes: {},
      },
      h1: { type: { resolvedName: "AstryxHeading" }, props: { text: "Sales" }, parent: "kf_ab_1786315591750", nodes: [], linkedNodes: {} },
      t1: { type: { resolvedName: "AstryxText" }, props: { text: "Overview" }, parent: "kf_ab_1786315591750", nodes: [], linkedNodes: {} },
      b1: { type: { resolvedName: "AstryxButton" }, props: { label: "Export" }, parent: "kf_ab_1786315591750", nodes: [], linkedNodes: {} },
    });
  }

  it("corrects ROOT's type to AstryxSection during hydration repair", () => {
    const repaired = JSON.parse(repairCraftStateJson(persistedMalformedDesignJson())) as any;
    expect(repaired.ROOT.type.resolvedName).toBe("AstryxSection");
    expect(repaired.ROOT.displayName).toBe("AstryxSection");
  });

  it("strips the stray label from ROOT but keeps other ROOT props and graph fields", () => {
    const repaired = JSON.parse(repairCraftStateJson(persistedMalformedDesignJson())) as any;
    expect(repaired.ROOT.props.label).toBeUndefined();
    expect(repaired.ROOT.props.direction).toBe("row");
    expect(repaired.ROOT.props.gap).toBe(80);
    expect(repaired.ROOT.nodes).toEqual(["kf_ab_1786315591750"]);
    expect(repaired.ROOT.isCanvas).toBe(true);
    expect(repaired.ROOT.parent).toBeNull();
  });

  it("keeps the real artboard and its children fully intact", () => {
    const repaired = JSON.parse(repairCraftStateJson(persistedMalformedDesignJson())) as any;
    expect(repaired.kf_ab_1786315591750.type.resolvedName).toBe("AstryxArtboard");
    expect(repaired.kf_ab_1786315591750.props.label).toBe("Screen 1");
    expect(repaired.kf_ab_1786315591750.nodes).toEqual(["h1", "t1", "b1"]);
    expect(repaired.h1).toBeDefined();
    expect(repaired.t1).toBeDefined();
    expect(repaired.b1).toBeDefined();
  });

  it("summarizeArtboards no longer lists ROOT after the full hydrate pipeline (repair + prune)", async () => {
    const { summarizeArtboards } = await import("../craftValidator");
    const repaired = repairCraftStateJson(persistedMalformedDesignJson());
    const pruned = pruneUnreachableCraftNodes(repaired);
    const summary = summarizeArtboards(pruned);
    expect(summary.artboards.map((a: any) => a.id)).toEqual(["kf_ab_1786315591750"]);
    expect(summary.artboards.some((a: any) => a.id === "ROOT")).toBe(false);
  });

  it("does not touch a well-formed persisted design (no-op hydration)", () => {
    const good = {
      ROOT: { type: { resolvedName: "AstryxSection" }, props: { direction: "row" }, nodes: ["ab1"], linkedNodes: {}, parent: null, isCanvas: true },
      ab1: { type: { resolvedName: "AstryxArtboard" }, props: { label: "Home" }, parent: "ROOT", nodes: [], linkedNodes: {} },
    };
    const repaired = JSON.parse(repairCraftStateJson(JSON.stringify(good))) as any;
    expect(repaired.ROOT.type.resolvedName).toBe("AstryxSection");
    expect(repaired.ROOT.props.direction).toBe("row");
    expect(repaired.ab1.props.label).toBe("Home");
  });
});
