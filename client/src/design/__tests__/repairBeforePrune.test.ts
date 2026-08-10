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

describe("isCanvas enforcement (workflow-bridge blank canvas regression)", () => {
  /** Simulates a craft state produced by an external generator that omits
   *  isCanvas on artboard nodes — the exact pattern seen in workflow-bridge
   *  designs that render as blank "Container" boxes on the canvas. */
  function workflowBridgeState() {
    return {
      ROOT: {
        type: { resolvedName: "AstryxSection" },
        isCanvas: true,
        props: {},
        nodes: ["artboard-pattern", "artboard-preview"],
        linkedNodes: {},
        parent: null,
      },
      "artboard-pattern": {
        type: { resolvedName: "AstryxArtboard" },
        // isCanvas intentionally absent — the bug
        props: { label: "Pattern Selection" },
        parent: "ROOT",
        nodes: ["heading-1", "button-1"],
        linkedNodes: {},
      },
      "artboard-preview": {
        type: { resolvedName: "AstryxArtboard" },
        isCanvas: false, // explicitly false — also the bug
        props: { label: "Preview & Configuration" },
        parent: "ROOT",
        nodes: ["heading-2"],
        linkedNodes: {},
      },
      "heading-1": { type: { resolvedName: "AstryxHeading" }, props: { text: "Choose a Pattern" }, parent: "artboard-pattern", nodes: [], linkedNodes: {} },
      "button-1":  { type: { resolvedName: "AstryxButton" },  props: { label: "Select" },          parent: "artboard-pattern", nodes: [], linkedNodes: {} },
      "heading-2": { type: { resolvedName: "AstryxHeading" }, props: { text: "Preview" },           parent: "artboard-preview", nodes: [], linkedNodes: {} },
    };
  }

  it("sets isCanvas:true on artboard nodes that are missing the field", () => {
    const repaired = repairCraftState(workflowBridgeState()) as any;
    expect(repaired["artboard-pattern"].isCanvas).toBe(true);
  });

  it("sets isCanvas:true on artboard nodes where isCanvas was explicitly false", () => {
    const repaired = repairCraftState(workflowBridgeState()) as any;
    expect(repaired["artboard-preview"].isCanvas).toBe(true);
  });

  it("does not change isCanvas on non-artboard nodes", () => {
    const repaired = repairCraftState(workflowBridgeState()) as any;
    // heading and button nodes should not gain isCanvas
    expect(repaired["heading-1"].isCanvas).toBeUndefined();
    expect(repaired["button-1"].isCanvas).toBeUndefined();
    expect(repaired["heading-2"].isCanvas).toBeUndefined();
  });

  it("preserves all other artboard props after the isCanvas fix", () => {
    const repaired = repairCraftState(workflowBridgeState()) as any;
    expect(repaired["artboard-pattern"].props.label).toBe("Pattern Selection");
    expect(repaired["artboard-pattern"].nodes).toEqual(["heading-1", "button-1"]);
    expect(repaired["artboard-pattern"].parent).toBe("ROOT");
  });

  it("works end-to-end via the JSON wrapper", () => {
    const repaired = JSON.parse(repairCraftStateJson(JSON.stringify(workflowBridgeState()))) as any;
    expect(repaired["artboard-pattern"].isCanvas).toBe(true);
    expect(repaired["artboard-preview"].isCanvas).toBe(true);
  });

  it("already-correct artboards (isCanvas:true) are left unchanged", () => {
    const state = {
      ROOT: { type: { resolvedName: "AstryxSection" }, isCanvas: true, props: {}, nodes: ["ab1"], linkedNodes: {}, parent: null },
      ab1: { type: { resolvedName: "AstryxArtboard" }, isCanvas: true, props: { label: "Good" }, parent: "ROOT", nodes: [], linkedNodes: {} },
    };
    const repaired = repairCraftState(state) as any;
    expect(repaired.ab1.isCanvas).toBe(true);
    expect(repaired.ab1.props.label).toBe("Good");
  });
});

describe("hidden / custom / displayName field enforcement", () => {
  /** A minimal craft state whose nodes intentionally omit hidden, custom, and
   *  displayName to simulate AI-generated or legacy-saved designs. */
  function bareState() {
    return {
      ROOT: {
        type: { resolvedName: "AstryxSection" },
        isCanvas: true,
        props: {},
        nodes: ["ab1"],
        linkedNodes: {},
        parent: null,
        // hidden, custom, displayName intentionally absent
      },
      ab1: {
        type: { resolvedName: "AstryxArtboard" },
        isCanvas: true,
        props: { label: "Screen 1" },
        parent: "ROOT",
        nodes: ["txt1"],
        linkedNodes: {},
        // hidden, custom, displayName intentionally absent
      },
      txt1: {
        type: { resolvedName: "AstryxText" },
        props: { text: "Hello" },
        parent: "ab1",
        nodes: [],
        linkedNodes: {},
        // hidden, custom, displayName intentionally absent
      },
    };
  }

  it("adds hidden:false when the field is absent", () => {
    const repaired = repairCraftState(bareState()) as any;
    expect(repaired.ROOT.hidden).toBe(false);
    expect(repaired.ab1.hidden).toBe(false);
    expect(repaired.txt1.hidden).toBe(false);
  });

  it("does not overwrite an explicit hidden:true value", () => {
    const state = bareState() as any;
    state.txt1.hidden = true;
    const repaired = repairCraftState(state) as any;
    expect(repaired.txt1.hidden).toBe(true);
  });

  it("normalizes a string hidden value ('false') to boolean false", () => {
    const state = bareState() as any;
    state.ab1.hidden = "false";
    const repaired = repairCraftState(state) as any;
    expect(repaired.ab1.hidden).toBe(false);
  });

  it("normalizes a numeric hidden value (1) to boolean false", () => {
    const state = bareState() as any;
    state.ab1.hidden = 1;
    const repaired = repairCraftState(state) as any;
    expect(repaired.ab1.hidden).toBe(false);
  });

  it("normalizes a null hidden value to boolean false", () => {
    const state = bareState() as any;
    state.txt1.hidden = null;
    const repaired = repairCraftState(state) as any;
    expect(repaired.txt1.hidden).toBe(false);
  });

  it("adds custom:{} when the field is absent", () => {
    const repaired = repairCraftState(bareState()) as any;
    expect(repaired.ROOT.custom).toEqual({});
    expect(repaired.ab1.custom).toEqual({});
    expect(repaired.txt1.custom).toEqual({});
  });

  it("replaces an invalid custom value (array) with an empty object", () => {
    const state = bareState() as any;
    state.txt1.custom = ["bad", "value"];
    const repaired = repairCraftState(state) as any;
    expect(repaired.txt1.custom).toEqual({});
  });

  it("replaces an invalid custom value (string) with an empty object", () => {
    const state = bareState() as any;
    state.ab1.custom = "not-an-object";
    const repaired = repairCraftState(state) as any;
    expect(repaired.ab1.custom).toEqual({});
  });

  it("does not overwrite a valid custom object", () => {
    const state = bareState() as any;
    state.ab1.custom = { myFlag: true };
    const repaired = repairCraftState(state) as any;
    expect(repaired.ab1.custom).toEqual({ myFlag: true });
  });

  it("sets displayName to the resolvedName when absent", () => {
    const repaired = repairCraftState(bareState()) as any;
    expect(repaired.ROOT.displayName).toBe("AstryxSection");
    expect(repaired.ab1.displayName).toBe("AstryxArtboard");
    expect(repaired.txt1.displayName).toBe("AstryxText");
  });

  it("does not overwrite an existing displayName", () => {
    const state = bareState() as any;
    state.ab1.displayName = "My Custom Screen";
    const repaired = repairCraftState(state) as any;
    expect(repaired.ab1.displayName).toBe("My Custom Screen");
  });

  it("replaces an invalid displayName (non-string) with the resolvedName", () => {
    const state = bareState() as any;
    state.txt1.displayName = 42;
    const repaired = repairCraftState(state) as any;
    expect(repaired.txt1.displayName).toBe("AstryxText");
  });

  it("defaults displayName to 'Unknown' when resolvedName is also absent/non-string", () => {
    const state = bareState() as any;
    // Give the node a numeric resolvedName (truthy, non-string) — simulates
    // a malformed AI output that would also cause the schema to reject it.
    state.txt1.type = { resolvedName: 99 };
    const repaired = repairCraftState(state) as any;
    expect(repaired.txt1.displayName).toBe("Unknown");
  });

  it("works end-to-end via the JSON wrapper", () => {
    const repaired = JSON.parse(repairCraftStateJson(JSON.stringify(bareState()))) as any;
    expect(repaired.ab1.hidden).toBe(false);
    expect(repaired.ab1.custom).toEqual({});
    expect(repaired.ab1.displayName).toBe("AstryxArtboard");
    expect(repaired.txt1.hidden).toBe(false);
    expect(repaired.txt1.custom).toEqual({});
    expect(repaired.txt1.displayName).toBe("AstryxText");
  });

  it("a node with all three fields already set is not mutated", () => {
    const state = bareState() as any;
    state.ab1.hidden = false;
    state.ab1.custom = { id: "preserved" };
    state.ab1.displayName = "Preserved Name";
    const repaired = repairCraftState(state) as any;
    expect(repaired.ab1.hidden).toBe(false);
    expect(repaired.ab1.custom).toEqual({ id: "preserved" });
    expect(repaired.ab1.displayName).toBe("Preserved Name");
  });
});
