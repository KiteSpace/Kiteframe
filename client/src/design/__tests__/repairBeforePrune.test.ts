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
