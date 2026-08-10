import { describe, expect, it } from "vitest";
import {
  getEqualWidthSelectionResult,
  getEqualWidthFlexProps,
  applyEqualWidthProps,
  clearFlexSizingProps,
  isEqualWidthFlexProps,
  type LayoutSizingNode,
} from "../layoutSizing";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a node in the LIVE craft.js editor state shape — the parent id lives
 * at `data.parent`, NOT at the top level. This is the shape the inspector
 * actually passes in (`useEditor(state => state.nodes)`); the top-level
 * `parent` field only exists in the serialized state. A fixture using the
 * wrong shape previously let an always-disabled button pass the tests.
 */
function makeNode(
  displayName: string,
  parent: string | null,
  propsOverride: Record<string, any> = {},
): LayoutSizingNode {
  return {
    data: { parent, displayName, props: propsOverride },
  };
}

function rowHStack(id: string): [string, LayoutSizingNode] {
  return [id, makeNode("AstryxHStack", "ROOT")];
}

function rowSection(id: string): [string, LayoutSizingNode] {
  return [id, makeNode("AstryxSection", "ROOT", { direction: "row" })];
}

function rowArtboard(id: string): [string, LayoutSizingNode] {
  return [id, makeNode("AstryxArtboard", "ROOT", { direction: "row" })];
}

function colSection(id: string): [string, LayoutSizingNode] {
  return [id, makeNode("AstryxSection", "ROOT", { direction: "column" })];
}

function flowChild(id: string, parent: string): [string, LayoutSizingNode] {
  return [id, makeNode("AstryxButton", parent, { position: "flow" })];
}

function absChild(id: string, parent: string): [string, LayoutSizingNode] {
  return [id, makeNode("AstryxButton", parent, { position: "absolute" })];
}

function makeNodes(pairs: [string, LayoutSizingNode][]): Record<string, LayoutSizingNode> {
  return Object.fromEntries(pairs);
}

// ─── Eligibility tests ───────────────────────────────────────────────────────

describe("getEqualWidthSelectionResult", () => {
  it("is eligible for two flow siblings in an HStack", () => {
    const nodes = makeNodes([
      rowHStack("hstack"),
      flowChild("a", "hstack"),
      flowChild("b", "hstack"),
    ]);
    const result = getEqualWidthSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(true);
  });

  it("is eligible for three flow siblings in a row Section", () => {
    const nodes = makeNodes([
      rowSection("sec"),
      flowChild("a", "sec"),
      flowChild("b", "sec"),
      flowChild("c", "sec"),
    ]);
    const result = getEqualWidthSelectionResult(nodes, ["a", "b", "c"]);
    expect(result.eligible).toBe(true);
    if (result.eligible) expect(result.parentId).toBe("sec");
  });

  it("is eligible for siblings in a row-direction AstryxArtboard", () => {
    const nodes = makeNodes([
      rowArtboard("ab"),
      flowChild("a", "ab"),
      flowChild("b", "ab"),
    ]);
    const result = getEqualWidthSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(true);
  });

  it("is ineligible with only one element selected", () => {
    const nodes = makeNodes([
      rowHStack("hstack"),
      flowChild("a", "hstack"),
    ]);
    const result = getEqualWidthSelectionResult(nodes, ["a"]);
    expect(result.eligible).toBe(false);
  });

  it("is ineligible for elements from different parents", () => {
    const nodes = makeNodes([
      rowHStack("hstack1"),
      rowHStack("hstack2"),
      flowChild("a", "hstack1"),
      flowChild("b", "hstack2"),
    ]);
    const result = getEqualWidthSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toMatch(/same container/i);
  });

  it("is ineligible for elements inside a column container", () => {
    const nodes = makeNodes([
      colSection("sec"),
      flowChild("a", "sec"),
      flowChild("b", "sec"),
    ]);
    const result = getEqualWidthSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toMatch(/row/i);
  });

  it("is ineligible if any element is absolute-positioned", () => {
    const nodes = makeNodes([
      rowHStack("hstack"),
      flowChild("a", "hstack"),
      absChild("b", "hstack"),
    ]);
    const result = getEqualWidthSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toMatch(/flow/i);
  });

  it("is ineligible for a column-direction AstryxArtboard", () => {
    const nodes = makeNodes([
      ["ab", makeNode("AstryxArtboard", "ROOT", { direction: "column" })],
      flowChild("a", "ab"),
      flowChild("b", "ab"),
    ]);
    const result = getEqualWidthSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(false);
  });

  it("is ineligible for a column-direction AstryxSection without direction prop set", () => {
    // default direction is column
    const nodes = makeNodes([
      ["sec", makeNode("AstryxSection", "ROOT", {})],
      flowChild("a", "sec"),
      flowChild("b", "sec"),
    ]);
    const result = getEqualWidthSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(false);
  });

  it("is ineligible when the selection contains artboards (screens)", () => {
    // Artboards sit on the canvas surface (ROOT), which is not a flex row and
    // does not consume flex sizing — the action must stay disabled.
    const nodes = makeNodes([
      ["ab1", makeNode("AstryxArtboard", "ROOT", { direction: "column" })],
      ["ab2", makeNode("AstryxArtboard", "ROOT", { direction: "column" })],
    ]);
    const result = getEqualWidthSelectionResult(nodes, ["ab1", "ab2"]);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toMatch(/screen/i);
  });

  it("is ineligible for direct children of ROOT even if they are not artboards", () => {
    const nodes = makeNodes([
      ["a", makeNode("AstryxButton", "ROOT", { position: "flow" })],
      ["b", makeNode("AstryxButton", "ROOT", { position: "flow" })],
    ]);
    const result = getEqualWidthSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toMatch(/screen/i);
  });

  it("returns parentId when eligible", () => {
    const nodes = makeNodes([
      rowHStack("hstack"),
      flowChild("a", "hstack"),
      flowChild("b", "hstack"),
    ]);
    const result = getEqualWidthSelectionResult(nodes, ["a", "b"]);
    if (result.eligible) expect(result.parentId).toBe("hstack");
  });

  it("also accepts nodes in the serialized state shape (top-level parent)", () => {
    // query.serialize() output stores parent at the top level; the helper
    // must tolerate both shapes.
    const serializedNode = (
      displayName: string,
      parent: string | null,
      props: Record<string, any> = {},
    ): LayoutSizingNode => ({ parent, data: { displayName, props } });
    const nodes: Record<string, LayoutSizingNode> = {
      hstack: serializedNode("AstryxHStack", "ROOT"),
      a: serializedNode("AstryxButton", "hstack", { position: "flow" }),
      b: serializedNode("AstryxButton", "hstack", { position: "flow" }),
    };
    const result = getEqualWidthSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(true);
    if (result.eligible) expect(result.parentId).toBe("hstack");
  });
});

// ─── Flex prop tests ─────────────────────────────────────────────────────────

describe("getEqualWidthFlexProps", () => {
  it("returns flexGrow:1, flexShrink:1, flexBasis:0", () => {
    const props = getEqualWidthFlexProps();
    expect(props.flexGrow).toBe(1);
    expect(props.flexShrink).toBe(1);
    expect(props.flexBasis).toBe(0);
  });
});

describe("applyEqualWidthProps", () => {
  it("applies the flex props and clears any explicit width", () => {
    const props: Record<string, any> = { width: 120, height: 40, label: "Buy" };
    applyEqualWidthProps(props);
    expect(props.flexGrow).toBe(1);
    expect(props.flexShrink).toBe(1);
    expect(props.flexBasis).toBe(0);
    expect(props.width).toBeUndefined();
    // Unrelated props survive.
    expect(props.height).toBe(40);
    expect(props.label).toBe("Buy");
  });

  it("survives a serialize/deserialize round-trip", () => {
    const props: Record<string, any> = { width: 200 };
    applyEqualWidthProps(props);
    const restored = JSON.parse(JSON.stringify({ props })).props;
    expect(isEqualWidthFlexProps(restored)).toBe(true);
    expect(restored.width).toBeUndefined();
  });
});

describe("clearFlexSizingProps", () => {
  it("removes all three flex props so an explicit width takes effect again", () => {
    const props: Record<string, any> = { flexGrow: 1, flexShrink: 1, flexBasis: 0, width: 150 };
    clearFlexSizingProps(props);
    expect(props.flexGrow).toBeUndefined();
    expect(props.flexShrink).toBeUndefined();
    expect(props.flexBasis).toBeUndefined();
    expect(props.width).toBe(150);
  });

  it("is a no-op on props without flex sizing", () => {
    const props: Record<string, any> = { width: 100, height: 40 };
    clearFlexSizingProps(props);
    expect(props).toEqual({ width: 100, height: 40 });
  });

  it("round-trips with applyEqualWidthProps (opt-in then opt-out)", () => {
    const props: Record<string, any> = { width: 200 };
    applyEqualWidthProps(props);
    expect(isEqualWidthFlexProps(props)).toBe(true);
    props.width = 90; // simulate a manual resize writing a new width
    clearFlexSizingProps(props);
    expect(isEqualWidthFlexProps(props)).toBe(false);
    expect(props.width).toBe(90);
  });
});

describe("isEqualWidthFlexProps", () => {
  it("recognises a node that has had equal-width applied", () => {
    expect(isEqualWidthFlexProps({ flexGrow: 1, flexShrink: 1, flexBasis: 0 })).toBe(true);
  });

  it("returns false when any field differs", () => {
    expect(isEqualWidthFlexProps({ flexGrow: 2, flexShrink: 1, flexBasis: 0 })).toBe(false);
    expect(isEqualWidthFlexProps({ flexGrow: 1, flexShrink: 0, flexBasis: 0 })).toBe(false);
    expect(isEqualWidthFlexProps({ flexGrow: 1, flexShrink: 1, flexBasis: 10 })).toBe(false);
    expect(isEqualWidthFlexProps(undefined)).toBe(false);
    expect(isEqualWidthFlexProps({})).toBe(false);
  });

  it("returns true when extra props are present alongside the three flex props", () => {
    expect(isEqualWidthFlexProps({ flexGrow: 1, flexShrink: 1, flexBasis: 0, width: 120 })).toBe(true);
  });
});
