/**
 * Flex-wrap container prop — rendered behaviour tests
 *
 * Confirms the `wrap` prop on flex containers (Section, Stack, HStack, Card,
 * Artboard) renders as CSS `flex-wrap`, defaults to nowrap when absent, and
 * rejects invalid values. jsdom does not compute layout, so assertions target
 * inline styles on the rendered container elements.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { Editor, Frame } from "@craftjs/core";
import { resolver, CanvasZoomContext, SnapGuideContext } from "../resolver";

function CanvasProviders({ children }: { children: React.ReactNode }) {
  return (
    <CanvasZoomContext.Provider value={1}>
      <SnapGuideContext.Provider value={() => {}}>{children}</SnapGuideContext.Provider>
    </CanvasZoomContext.Provider>
  );
}

function makeNode(id: string, resolvedName: string, props: Record<string, any>, parent: string, nodes: string[] = []) {
  return {
    [id]: {
      type: { resolvedName },
      isCanvas: resolvedName !== "AstryxButton",
      props,
      displayName: resolvedName,
      custom: {},
      parent,
      hidden: false,
      nodes,
      linkedNodes: {},
    },
  };
}

function makeState(containerName: string, containerProps: Record<string, any>): string {
  return JSON.stringify({
    ROOT: {
      type: { resolvedName: "AstryxSection" },
      isCanvas: true,
      props: { direction: "row", gap: 80, padding: 40 },
      displayName: "AstryxSection",
      custom: {},
      parent: null,
      hidden: false,
      nodes: ["artboard-1"],
      linkedNodes: {},
    },
    ...makeNode("artboard-1", "AstryxArtboard", { label: "Screen 1", width: 390, x: 64, y: 64 }, "ROOT", ["container-1"]),
    ...makeNode("container-1", containerName, containerProps, "artboard-1", ["btn-1"]),
    ...makeNode("btn-1", "AstryxButton", { children: "Child btn", variant: "primary" }, "container-1"),
  });
}

function renderState(state: string) {
  return render(
    <CanvasProviders>
      <Editor resolver={resolver} enabled>
        <Frame data={state} />
      </Editor>
    </CanvasProviders>,
  );
}

/** Finds the rendered flex container element that owns the child button. */
function containerEl(): HTMLElement {
  const btn = screen.getByText("Child btn").closest("button")!;
  // Walk up until we find a display:flex ancestor with an inline flex-wrap.
  let el: HTMLElement | null = btn.parentElement;
  while (el) {
    if (el.style.display === "flex") return el;
    el = el.parentElement;
  }
  throw new Error("flex container not found");
}

describe("flex-wrap container prop → rendered styles", () => {
  it("HStack renders flexWrap: wrap when wrap='wrap'", async () => {
    renderState(makeState("AstryxHStack", { gap: 8, wrap: "wrap" }));
    await screen.findByText("Child btn");
    expect(containerEl().style.flexWrap).toBe("wrap");
  });

  it("HStack renders flexWrap: wrap-reverse when wrap='wrap-reverse'", async () => {
    renderState(makeState("AstryxHStack", { gap: 8, wrap: "wrap-reverse" }));
    await screen.findByText("Child btn");
    expect(containerEl().style.flexWrap).toBe("wrap-reverse");
  });

  it("defaults to nowrap when the wrap prop is absent", async () => {
    renderState(makeState("AstryxHStack", { gap: 8 }));
    await screen.findByText("Child btn");
    expect(containerEl().style.flexWrap).toBe("nowrap");
  });

  it("falls back to nowrap for invalid wrap values", async () => {
    renderState(makeState("AstryxHStack", { gap: 8, wrap: "banana" }));
    await screen.findByText("Child btn");
    expect(containerEl().style.flexWrap).toBe("nowrap");
  });

  it("Section renders flexWrap: wrap", async () => {
    renderState(makeState("AstryxSection", { direction: "row", gap: 8, padding: 8, wrap: "wrap" }));
    await screen.findByText("Child btn");
    expect(containerEl().style.flexWrap).toBe("wrap");
  });

  it("Stack renders flexWrap: wrap", async () => {
    renderState(makeState("AstryxStack", { gap: 8, wrap: "wrap" }));
    await screen.findByText("Child btn");
    expect(containerEl().style.flexWrap).toBe("wrap");
  });

  it("Card renders flexWrap: wrap", async () => {
    renderState(makeState("AstryxCard", { variant: "elevated", wrap: "wrap" }));
    await screen.findByText("Child btn");
    expect(containerEl().style.flexWrap).toBe("wrap");
  });

  it("Artboard renders flexWrap: wrap on its content frame", async () => {
    const state = JSON.parse(makeState("AstryxHStack", { gap: 8 }));
    state["artboard-1"].props.wrap = "wrap";
    render(
      <CanvasProviders>
        <Editor resolver={resolver} enabled>
          <Frame data={JSON.stringify(state)} />
        </Editor>
      </CanvasProviders>,
    );
    await screen.findByText("Child btn");
    // Artboard content frame is the flex element carrying direction+wrap.
    const btn = screen.getByText("Child btn").closest("button")!;
    let el: HTMLElement | null = btn.parentElement;
    const flexAncestors: HTMLElement[] = [];
    while (el) {
      if (el.style.display === "flex") flexAncestors.push(el);
      el = el.parentElement;
    }
    // Innermost flex is the HStack (nowrap); the artboard frame above it wraps.
    expect(flexAncestors.some((a) => a.style.flexWrap === "wrap")).toBe(true);
  });
});
