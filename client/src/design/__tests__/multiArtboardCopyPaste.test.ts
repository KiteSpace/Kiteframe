/**
 * Regression coverage for the real multi-artboard copy → paste path
 * (copyNodesToClipboard → pasteFromClipboard), exercising the module-level
 * clipboard exactly as the keyboard shortcuts do.
 *
 * Guards against clone-ID collisions: extractNodeSubtree previously derived
 * IDs from Date.now() alone, so two artboards copied in the same millisecond
 * (i.e. every multi-select copy) produced identical clone IDs and the second
 * pasted artboard silently overwrote the first.
 */
import { describe, it, expect } from "vitest";
import {
  extractNodeSubtree,
  copyNodesToClipboard,
  pasteFromClipboard,
} from "../DesignEditor";

function makeArtboard(id: string, label: string, x: number, y: number, children: string[] = []) {
  return {
    [id]: {
      type: { resolvedName: "AstryxArtboard" },
      isCanvas: true,
      displayName: "AstryxArtboard",
      parent: "ROOT",
      hidden: false,
      custom: {},
      nodes: children,
      linkedNodes: {},
      props: { label, x, y, width: 390, height: 480 },
    },
  };
}

function makeText(id: string, parent: string, text: string) {
  return {
    [id]: {
      type: { resolvedName: "AstryxText" },
      displayName: "AstryxText",
      parent,
      hidden: false,
      custom: {},
      nodes: [],
      linkedNodes: {},
      props: { children: text },
    },
  };
}

function makeState(): Record<string, any> {
  return {
    ROOT: {
      type: { resolvedName: "AstryxSection" },
      isCanvas: true,
      displayName: "AstryxSection",
      parent: null,
      hidden: false,
      custom: {},
      nodes: ["ab-1", "ab-2"],
      linkedNodes: {},
      props: {},
    },
    ...makeArtboard("ab-1", "Screen A", 100, 100, ["t-1"]),
    ...makeText("t-1", "ab-1", "hello A"),
    ...makeArtboard("ab-2", "Screen B", 600, 100, ["t-2"]),
    ...makeText("t-2", "ab-2", "hello B"),
  };
}

describe("extractNodeSubtree ID uniqueness", () => {
  it("produces distinct clone IDs for subtrees extracted in the same millisecond", () => {
    const state = makeState();
    // Extract both artboards back-to-back — same Date.now() tick in practice.
    const a = extractNodeSubtree(state, "ab-1");
    const b = extractNodeSubtree(state, "ab-2");
    expect(a.newRootId).not.toBe(b.newRootId);
    const aIds = Object.keys(a.subtree);
    const bIds = Object.keys(b.subtree);
    // No ID appears in both clones.
    const overlap = aIds.filter((id) => bIds.includes(id));
    expect(overlap).toEqual([]);
  });
});

describe("copyNodesToClipboard → pasteFromClipboard (two artboards)", () => {
  it("pastes both artboards with descendants, fresh unique IDs, and offsets", () => {
    const state = makeState();

    // Real copy path: fills the module-level clipboard.
    expect(copyNodesToClipboard(state, ["ab-1", "ab-2"])).toBe(true);

    // Real paste path (no explicit selection — same as keyboard paste after multi-copy).
    const next = pasteFromClipboard(state, null);
    expect(next).not.toBeNull();

    const rootNodes: string[] = next!["ROOT"].nodes;
    // Originals + 2 pasted copies, no duplicate references.
    expect(rootNodes).toHaveLength(4);
    expect(new Set(rootNodes).size).toBe(4);

    const pastedIds = rootNodes.filter((id) => id !== "ab-1" && id !== "ab-2");
    expect(pastedIds).toHaveLength(2);

    const pasted = pastedIds.map((id) => next![id]);
    for (const node of pasted) {
      expect(node.type.resolvedName).toBe("AstryxArtboard");
      expect(node.parent).toBe("ROOT");
      // Each copy keeps exactly one text child with a fresh ID.
      expect(node.nodes).toHaveLength(1);
      const childId = node.nodes[0];
      expect(["t-1", "t-2"]).not.toContain(childId);
      expect(next![childId].parent).toBe(pastedIds.find((p) => p === node.nodes[0] || next![p].nodes.includes(childId)));
    }

    // Both source labels are represented — the second did not overwrite the first.
    const labels = pasted.map((n) => n.props.label).sort();
    expect(labels).toEqual(["Screen A", "Screen B"]);

    // Positions offset by (40, 40) from each original, preserving relative layout.
    const byLabel = Object.fromEntries(pasted.map((n) => [n.props.label, n]));
    expect(byLabel["Screen A"].props.x).toBe(140);
    expect(byLabel["Screen A"].props.y).toBe(140);
    expect(byLabel["Screen B"].props.x).toBe(640);
    expect(byLabel["Screen B"].props.y).toBe(140);

    // Descendant content preserved.
    const textContents = pasted.map((n) => next![n.nodes[0]].props.children).sort();
    expect(textContents).toEqual(["hello A", "hello B"]);

    // Originals untouched.
    expect(next!["ab-1"].props.x).toBe(100);
    expect(next!["ab-2"].props.x).toBe(600);
    expect(next!["t-1"].props.children).toBe("hello A");
  });

  it("repeated paste produces another two unique artboards (no ID reuse across pastes)", () => {
    const state = makeState();
    copyNodesToClipboard(state, ["ab-1", "ab-2"]);
    const once = pasteFromClipboard(state, null)!;
    const twice = pasteFromClipboard(once, null)!;
    const rootNodes: string[] = twice["ROOT"].nodes;
    expect(rootNodes).toHaveLength(6);
    expect(new Set(rootNodes).size).toBe(6);
    // Every referenced node exists in the state map.
    for (const id of rootNodes) expect(twice[id]).toBeTruthy();
  });

  it("mixed clipboard pastes artboards under ROOT and components as siblings", () => {
    const state = makeState();
    // Copy one artboard and one loose component.
    copyNodesToClipboard(state, ["ab-1", "t-2"]);
    const next = pasteFromClipboard(state, "t-2")!;

    // Artboard copy went to ROOT.
    const rootNodes: string[] = next["ROOT"].nodes;
    expect(rootNodes).toHaveLength(3);

    // Component copy became a sibling of t-2 inside ab-2.
    const ab2Children: string[] = next["ab-2"].nodes;
    expect(ab2Children).toHaveLength(2);
    const newChild = ab2Children.find((id) => id !== "t-2")!;
    expect(next[newChild].props.children).toBe("hello B");
    expect(next[newChild].parent).toBe("ab-2");
  });
});
