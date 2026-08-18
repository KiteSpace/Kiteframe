/**
 * Equal-width flex sizing — rendered behaviour tests
 *
 * These tests exercise the real craft.js Editor + Frame + resolver pipeline
 * (not just the pure helpers) to confirm:
 *
 *  1. Nodes carrying the persisted equal-width flex props render with
 *     flex-grow/flex-shrink/flex-basis styles and WITHOUT an explicit width,
 *     so the browser's flex algorithm controls the size.
 *  2. Nodes without flex props keep their explicit width — the two sizing
 *     modes don't interfere.
 *  3. A manual drag-resize on a node with equal-width flex props clears the
 *     flex props and writes an explicit width, restoring normal sizing
 *     behaviour (the opt-out path the inspector width input also uses).
 *
 * jsdom does not compute layout, so assertions target inline styles and
 * serialized craft props rather than pixel measurements.
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { Editor, Frame, useEditor } from "@craftjs/core";
import { resolver, CanvasZoomContext, SnapGuideContext } from "../resolver";
import {
  getEqualWidthFlexProps,
  isEqualWidthFlexProps,
  getEqualWidthSelectionResult,
  getEqualHeightSelectionResult,
} from "../layoutSizing";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CanvasProviders({ children }: { children: React.ReactNode }) {
  return (
    <CanvasZoomContext.Provider value={1}>
      <SnapGuideContext.Provider value={() => {}}>{children}</SnapGuideContext.Provider>
    </CanvasZoomContext.Provider>
  );
}

/** Exposes the live serialized state so tests can inspect node props. */
let latestSerialize: (() => string) | null = null;
function SerializeProbe() {
  const { query } = useEditor(() => ({}));
  latestSerialize = () => query.serialize();
  return null;
}

/**
 * Exposes the LIVE editor state nodes (state.nodes) — the exact object the
 * inspector passes to the eligibility helpers. This shape differs from the
 * serialized state: parent ids live at `node.data.parent`, and a helper that
 * only reads the serialized shape's top-level `parent` silently disables the
 * Equal widths/heights buttons for every real selection.
 */
let latestLiveNodes: Record<string, any> | null = null;
function LiveNodesProbe() {
  const { nodes } = useEditor((state) => ({ nodes: state.nodes }));
  latestLiveNodes = nodes;
  return null;
}

function nodeProps(id: string): Record<string, any> {
  if (!latestSerialize) throw new Error("SerializeProbe not mounted");
  return JSON.parse(latestSerialize())[id]?.props ?? {};
}

/**
 * State: ROOT section → artboard → HStack with two buttons.
 * "grow-btn" carries the persisted equal-width flex props (no width).
 * "fixed-btn" has an explicit width and no flex props.
 */
function makeState(): string {
  return JSON.stringify({
    ROOT: {
      type: { resolvedName: "AstryxSection" },
      isCanvas: true,
      props: { direction: "row", gap: 80, padding: 40, align: "start", justify: "start" },
      displayName: "AstryxSection",
      custom: {},
      parent: null,
      hidden: false,
      nodes: ["artboard-1"],
      linkedNodes: {},
    },
    "artboard-1": {
      type: { resolvedName: "AstryxArtboard" },
      isCanvas: true,
      props: { label: "Screen 1", width: 390, direction: "column", gap: 16, padding: 24, x: 64, y: 64 },
      displayName: "AstryxArtboard",
      custom: {},
      parent: "ROOT",
      hidden: false,
      nodes: ["hstack-1"],
      linkedNodes: {},
    },
    "hstack-1": {
      type: { resolvedName: "AstryxHStack" },
      isCanvas: true,
      props: { gap: 8 },
      displayName: "AstryxHStack",
      custom: {},
      parent: "artboard-1",
      hidden: false,
      nodes: ["grow-btn", "fixed-btn"],
      linkedNodes: {},
    },
    "grow-btn": {
      type: { resolvedName: "AstryxButton" },
      isCanvas: false,
      props: { children: "Grow me", variant: "primary", ...getEqualWidthFlexProps() },
      displayName: "AstryxButton",
      custom: {},
      parent: "hstack-1",
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
    "fixed-btn": {
      type: { resolvedName: "AstryxButton" },
      isCanvas: false,
      props: { children: "Fixed me", variant: "secondary", width: 140 },
      displayName: "AstryxButton",
      custom: {},
      parent: "hstack-1",
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
  });
}

/** The leaf wrapper div is the connected element that carries sizing styles. */
function leafWrapper(label: string): HTMLElement {
  const inner = screen.getByText(label);
  // AstryxButton renders: wrapper div (connectRef, sizing) > div > button
  const wrapper = inner.closest("button")?.parentElement?.parentElement as HTMLElement;
  expect(wrapper).toBeTruthy();
  return wrapper;
}

function renderEditor() {
  return render(
    <CanvasProviders>
      <Editor resolver={resolver} enabled>
        <SerializeProbe />
        <LiveNodesProbe />
        <Frame data={makeState()} />
      </Editor>
    </CanvasProviders>,
  );
}

// ---------------------------------------------------------------------------
// Suite 1 – flex props render as flex styles, width suppressed
// ---------------------------------------------------------------------------

describe("equal-width flex props → rendered styles", () => {
  it("renders flexGrow/flexShrink/flexBasis and omits explicit width", async () => {
    renderEditor();
    await screen.findByText("Grow me");

    const wrapper = leafWrapper("Grow me");
    expect(wrapper.style.flexGrow).toBe("1");
    expect(wrapper.style.flexShrink).toBe("1");
    expect(wrapper.style.flexBasis).toBe("0px");
    // No explicit width — the flex algorithm must control the size.
    expect(wrapper.style.width).toBe("");
    // minWidth:0 lets the item shrink below its content size.
    expect(["0", "0px"]).toContain(wrapper.style.minWidth);
  });

  it("keeps explicit width on siblings without flex props", async () => {
    renderEditor();
    await screen.findByText("Fixed me");

    const wrapper = leafWrapper("Fixed me");
    expect(wrapper.style.width).toBe("140px");
    expect(wrapper.style.flexGrow).toBe("");
    expect(wrapper.style.flexBasis).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Suite 2 – eligibility computed from the LIVE editor state (regression)
// ---------------------------------------------------------------------------

describe("eligibility from live craft.js editor state", () => {
  it("enables Equal widths for two flow siblings in a real HStack", async () => {
    renderEditor();
    await screen.findByText("Grow me");

    expect(latestLiveNodes).toBeTruthy();
    // Sanity: this is the live shape — parent at data.parent, not top level.
    expect(latestLiveNodes!["grow-btn"].data.parent).toBe("hstack-1");

    const result = getEqualWidthSelectionResult(latestLiveNodes!, ["grow-btn", "fixed-btn"]);
    expect(result.eligible).toBe(true);
    if (result.eligible) expect(result.parentId).toBe("hstack-1");
  });

  it("keeps Equal widths disabled for a real artboard selection", async () => {
    renderEditor();
    await screen.findByText("Grow me");

    const result = getEqualWidthSelectionResult(latestLiveNodes!, ["artboard-1", "hstack-1"]);
    expect(result.eligible).toBe(false);
  });

  it("keeps Equal heights disabled inside the row HStack but explains why", async () => {
    renderEditor();
    await screen.findByText("Grow me");

    const result = getEqualHeightSelectionResult(latestLiveNodes!, ["grow-btn", "fixed-btn"]);
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.reason).toMatch(/column/i);
  });
});

// ---------------------------------------------------------------------------
// Suite 3 – manual drag-resize opts the node back out of flex sizing
// ---------------------------------------------------------------------------

describe("manual resize after equal widths", () => {
  it("clears flex props and applies the dragged width", async () => {
    renderEditor();
    await screen.findByText("Grow me");

    // Confirm starting state: flex sizing active.
    expect(isEqualWidthFlexProps(nodeProps("grow-btn"))).toBe(true);

    // Select the node so resize handles mount.
    const wrapper = leafWrapper("Grow me");
    await act(async () => {
      fireEvent.mouseDown(wrapper);
    });

    // The east handle is the first resize handle child (ew-resize cursor at right edge).
    await waitFor(() => {
      const handles = Array.from(wrapper.querySelectorAll("div")).filter(
        (el) => (el as HTMLElement).style.cursor === "ew-resize",
      );
      expect(handles.length).toBeGreaterThan(0);
    });
    const eastHandle = Array.from(wrapper.querySelectorAll("div")).filter(
      (el) => (el as HTMLElement).style.cursor === "ew-resize",
    )[0] as HTMLElement;

    // Drag the east handle 60px to the right. Resize listeners are attached
    // natively (addEventListener), so dispatch real MouseEvents.
    await act(async () => {
      eastHandle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 100, clientY: 50 }));
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 160, clientY: 50 }));
      window.dispatchEvent(new MouseEvent("mouseup", {}));
    });

    await waitFor(() => {
      const props = nodeProps("grow-btn");
      // Flex sizing cleared — explicit width is back in control.
      expect(isEqualWidthFlexProps(props)).toBe(false);
      expect(props.flexGrow).toBeUndefined();
      expect(props.flexShrink).toBeUndefined();
      expect(props.flexBasis).toBeUndefined();
      expect(typeof props.width).toBe("number");
      expect(props.width).toBeGreaterThanOrEqual(20);
    });

    // The rendered wrapper now carries an explicit width and no flex styles.
    await waitFor(() => {
      const w = leafWrapper("Grow me");
      expect(w.style.flexBasis).toBe("");
      expect(w.style.width).not.toBe("");
    });
  });
});
