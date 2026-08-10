import { describe, expect, it } from "vitest";
import {
  getEqualHeightSelectionResult,
  getEqualHeightFlexProps,
  applyEqualHeightProps,
  clearFlexSizingProps,
  isEqualHeightFlexProps,
  type LayoutSizingNode,
} from "../layoutSizing";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeNode(
  displayName: string,
  parent: string | null,
  propsOverride: Record<string, any> = {},
): LayoutSizingNode {
  return {
    parent,
    data: { displayName, props: propsOverride },
  };
}

function colStack(id: string): [string, LayoutSizingNode] {
  return [id, makeNode("AstryxStack", "ROOT")];
}

function colSection(id: string): [string, LayoutSizingNode] {
  return [id, makeNode("AstryxSection", "ROOT", { direction: "column" })];
}

function colSectionDefault(id: string): [string, LayoutSizingNode] {
  // default direction is column (no direction prop)
  return [id, makeNode("AstryxSection", "ROOT", {})];
}

function colArtboard(id: string): [string, LayoutSizingNode] {
  return [id, makeNode("AstryxArtboard", "ROOT", { direction: "column" })];
}

function rowSection(id: string): [string, LayoutSizingNode] {
  return [id, makeNode("AstryxSection", "ROOT", { direction: "row" })];
}

function rowHStack(id: string): [string, LayoutSizingNode] {
  return [id, makeNode("AstryxHStack", "ROOT")];
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

describe("getEqualHeightSelectionResult", () => {
  it("is eligible for two flow siblings in an AstryxStack", () => {
    const nodes = makeNodes([
      colStack("stack"),
      flowChild("a", "stack"),
      flowChild("b", "stack"),
    ]);
    const result = getEqualHeightSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(true);
  });

  it("is eligible for three flow siblings in a column Section", () => {
    const nodes = makeNodes([
      colSection("sec"),
      flowChild("a", "sec"),
      flowChild("b", "sec"),
      flowChild("c", "sec"),
    ]);
    const result = getEqualHeightSelectionResult(nodes, ["a", "b", "c"]);
    expect(result.eligible).toBe(true);
    if (result.eligible) expect(result.parentId).toBe("sec");
  });

  it("is eligible for siblings in a column Section without direction prop (default column)", () => {
    const nodes = makeNodes([
      colSectionDefault("sec"),
      flowChild("a", "sec"),
      flowChild("b", "sec"),
    ]);
    const result = getEqualHeightSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(true);
  });

  it("is eligible for siblings in a column-direction AstryxArtboard", () => {
    const nodes = makeNodes([
      colArtboard("ab"),
      flowChild("a", "ab"),
      flowChild("b", "ab"),
    ]);
    const result = getEqualHeightSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(true);
  });

  it("is ineligible with only one element selected", () => {
    const nodes = makeNodes([
      colStack("stack"),
      flowChild("a", "stack"),
    ]);
    const result = getEqualHeightSelectionResult(nodes, ["a"]);
    expect(result.eligible).toBe(false);
  });

  it("is ineligible for elements from different parents", () => {
    const nodes = makeNodes([
      colStack("stack1"),
      colStack("stack2"),
      flowChild("a", "stack1"),
      flowChild("b", "stack2"),
    ]);
    const result = getEqualHeightSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toMatch(/same container/i);
  });

  it("is ineligible for elements inside a row container", () => {
    const nodes = makeNodes([
      rowSection("sec"),
      flowChild("a", "sec"),
      flowChild("b", "sec"),
    ]);
    const result = getEqualHeightSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toMatch(/column/i);
  });

  it("is ineligible for elements inside an HStack (row container)", () => {
    const nodes = makeNodes([
      rowHStack("hstack"),
      flowChild("a", "hstack"),
      flowChild("b", "hstack"),
    ]);
    const result = getEqualHeightSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toMatch(/column/i);
  });

  it("is ineligible if any element is absolute-positioned", () => {
    const nodes = makeNodes([
      colStack("stack"),
      flowChild("a", "stack"),
      absChild("b", "stack"),
    ]);
    const result = getEqualHeightSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toMatch(/flow/i);
  });

  it("is ineligible for a row-direction AstryxArtboard", () => {
    const nodes = makeNodes([
      ["ab", makeNode("AstryxArtboard", "ROOT", { direction: "row" })],
      flowChild("a", "ab"),
      flowChild("b", "ab"),
    ]);
    const result = getEqualHeightSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(false);
  });

  it("is ineligible when the selection contains artboards (screens)", () => {
    const nodes = makeNodes([
      ["ab1", makeNode("AstryxArtboard", "ROOT", { direction: "column" })],
      ["ab2", makeNode("AstryxArtboard", "ROOT", { direction: "column" })],
    ]);
    const result = getEqualHeightSelectionResult(nodes, ["ab1", "ab2"]);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toMatch(/screen/i);
  });

  it("is ineligible for direct children of ROOT even if they are not artboards", () => {
    const nodes = makeNodes([
      ["a", makeNode("AstryxButton", "ROOT", { position: "flow" })],
      ["b", makeNode("AstryxButton", "ROOT", { position: "flow" })],
    ]);
    const result = getEqualHeightSelectionResult(nodes, ["a", "b"]);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toMatch(/screen/i);
  });

  it("returns parentId when eligible", () => {
    const nodes = makeNodes([
      colStack("stack"),
      flowChild("a", "stack"),
      flowChild("b", "stack"),
    ]);
    const result = getEqualHeightSelectionResult(nodes, ["a", "b"]);
    if (result.eligible) expect(result.parentId).toBe("stack");
  });
});

// ─── Flex prop tests ─────────────────────────────────────────────────────────

describe("getEqualHeightFlexProps", () => {
  it("returns flexGrow:1, flexShrink:1, flexBasis:0", () => {
    const props = getEqualHeightFlexProps();
    expect(props.flexGrow).toBe(1);
    expect(props.flexShrink).toBe(1);
    expect(props.flexBasis).toBe(0);
  });
});

describe("applyEqualHeightProps", () => {
  it("applies the flex props and clears any explicit height", () => {
    const props: Record<string, any> = { width: 120, height: 80, label: "Buy" };
    applyEqualHeightProps(props);
    expect(props.flexGrow).toBe(1);
    expect(props.flexShrink).toBe(1);
    expect(props.flexBasis).toBe(0);
    expect(props.height).toBeUndefined();
    // Unrelated props survive.
    expect(props.width).toBe(120);
    expect(props.label).toBe("Buy");
  });

  it("survives a serialize/deserialize round-trip", () => {
    const props: Record<string, any> = { height: 200 };
    applyEqualHeightProps(props);
    const restored = JSON.parse(JSON.stringify({ props })).props;
    expect(isEqualHeightFlexProps(restored)).toBe(true);
    expect(restored.height).toBeUndefined();
  });
});

describe("clearFlexSizingProps (height axis round-trip)", () => {
  it("removes all three flex props so an explicit height takes effect again", () => {
    const props: Record<string, any> = { flexGrow: 1, flexShrink: 1, flexBasis: 0, height: 150 };
    clearFlexSizingProps(props);
    expect(props.flexGrow).toBeUndefined();
    expect(props.flexShrink).toBeUndefined();
    expect(props.flexBasis).toBeUndefined();
    expect(props.height).toBe(150);
  });

  it("round-trips with applyEqualHeightProps (opt-in then opt-out)", () => {
    const props: Record<string, any> = { height: 200 };
    applyEqualHeightProps(props);
    expect(isEqualHeightFlexProps(props)).toBe(true);
    props.height = 90; // simulate a manual resize writing a new height
    clearFlexSizingProps(props);
    expect(isEqualHeightFlexProps(props)).toBe(false);
    expect(props.height).toBe(90);
  });
});

describe("isEqualHeightFlexProps", () => {
  it("recognises a node that has had equal-height applied", () => {
    expect(isEqualHeightFlexProps({ flexGrow: 1, flexShrink: 1, flexBasis: 0 })).toBe(true);
  });

  it("returns false when any field differs", () => {
    expect(isEqualHeightFlexProps({ flexGrow: 2, flexShrink: 1, flexBasis: 0 })).toBe(false);
    expect(isEqualHeightFlexProps({ flexGrow: 1, flexShrink: 0, flexBasis: 0 })).toBe(false);
    expect(isEqualHeightFlexProps({ flexGrow: 1, flexShrink: 1, flexBasis: 10 })).toBe(false);
    expect(isEqualHeightFlexProps(undefined)).toBe(false);
    expect(isEqualHeightFlexProps({})).toBe(false);
  });

  it("returns true when extra props are present alongside the three flex props", () => {
    expect(isEqualHeightFlexProps({ flexGrow: 1, flexShrink: 1, flexBasis: 0, height: 120 })).toBe(true);
  });
});
