/**
 * Inspection-panel contract tests.
 *
 * The panel is intentionally kept private to DesignEditor because it is only
 * rendered as part of the editor. These tests guard the user-facing structure
 * of that private panel at the source boundary so a redesign cannot quietly
 * drop the tab structure, break progressive disclosure, or reintroduce
 * duplicate controls.
 */

import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const editorSource = fs.readFileSync(
  path.resolve(__dirname, "../DesignEditor.tsx"),
  "utf8",
);

const componentPropsSource = editorSource.slice(
  editorSource.indexOf("function ComponentProps"),
  editorSource.indexOf("// ─── Inspect panel"),
);

// The inspect panel now spans its token/kind constants, InspectPanel, and the
// StyleTab / LayoutTab sub-components, up to the node-icon mapping that follows.
const inspectPanelSource = editorSource.slice(
  editorSource.indexOf("// ─── Inspect panel: node-kind → tabs"),
  editorSource.indexOf("// ─── Node type → display icon mapping"),
);

const rowsSource = fs.readFileSync(
  path.resolve(__dirname, "../InspectRows.tsx"),
  "utf8",
);

describe("inspect panel tab structure", () => {
  it("renders Style / Layout / Content tabs from a per-kind tab model", () => {
    // The tab labels and the node-kind → tabs mapping both exist.
    expect(inspectPanelSource).toContain("TABS_BY_KIND");
    expect(inspectPanelSource).toContain('role="tablist"');
    expect(inspectPanelSource).toContain('role="tab"');
    expect(inspectPanelSource).toContain("aria-selected={isActive}");
    // Style, Layout, Content labels.
    expect(inspectPanelSource).toContain("style: \"Style\"");
    expect(inspectPanelSource).toContain("layout: \"Layout\"");
    expect(inspectPanelSource).toContain("content: \"Content\"");
  });

  it("remembers the active tab per node kind and falls back to the first available", () => {
    expect(inspectPanelSource).toContain("tabByKind");
    // Fall back to the first available tab when the remembered one is gone.
    expect(inspectPanelSource).toContain("availableTabs.includes(remembered)");
    expect(inspectPanelSource).toContain("availableTabs[0]");
  });

  it("gives artboards Style + Layout only — no Content tab", () => {
    expect(inspectPanelSource).toContain('artboard: ["style", "layout"]');
  });

  it("supports arrow-key navigation between tabs", () => {
    expect(inspectPanelSource).toContain('"ArrowRight"');
    expect(inspectPanelSource).toContain('"ArrowLeft"');
    expect(inspectPanelSource).toContain("onTabKeyDown");
  });

  it("routes each tab to its dedicated sub-component", () => {
    expect(inspectPanelSource).toContain('activeTab === "style"');
    expect(inspectPanelSource).toContain('activeTab === "layout"');
    expect(inspectPanelSource).toContain('activeTab === "content"');
    expect(inspectPanelSource).toContain("<StyleTab");
    expect(inspectPanelSource).toContain("<LayoutTab");
  });

  it("renders the Content tab from the existing ComponentProps dispatcher", () => {
    // The Content tab wraps ComponentProps rather than re-implementing it.
    expect(inspectPanelSource).toMatch(
      /activeTab === "content"[\s\S]{0,300}<ComponentProps/,
    );
  });
});

describe("inspect panel header", () => {
  it("shows a breadcrumb, node name, kind chip and a close control", () => {
    expect(inspectPanelSource).toContain("buildBreadcrumb");
    expect(inspectPanelSource).toContain('aria-label="Ancestors"');
    expect(inspectPanelSource).toContain("KIND_CHIP");
    // Close returns to the palette by deselecting.
    expect(inspectPanelSource).toContain("returnToPalette");
    expect(inspectPanelSource).toContain("actions.selectNode(undefined as any)");
  });

  it("returns to the palette on Escape when focus is not in a field", () => {
    expect(inspectPanelSource).toContain('e.key !== "Escape"');
    expect(inspectPanelSource).toContain("onPanelKeyDown");
  });

  it("reads N selected with a mixed chip for multi-select", () => {
    expect(inspectPanelSource).toContain("`${selectedIds.length} selected`");
    expect(inspectPanelSource).toContain('"mixed"');
  });
});

describe("layout tab controls", () => {
  it("keeps W/H editing wired to width/height props via a paired number row", () => {
    expect(inspectPanelSource).toContain('setProp("width", v)');
    expect(inspectPanelSource).toContain('setProp("height", v)');
    expect(inspectPanelSource).toContain("<NumberPairRow");
    // AUTO affordance lives inside the W/H fields.
    expect(inspectPanelSource).toContain("showAuto: true");
  });

  it("hides X/Y unless the node is absolutely positioned (progressive disclosure)", () => {
    expect(inspectPanelSource).toContain('const isAbsolute = position === "absolute"');
    expect(inspectPanelSource).toContain('setProp("position", v)');
    // The X/Y offset pair only renders when isAbsolute.
    expect(inspectPanelSource).toMatch(/isAbsolute &&[\s\S]{0,200}prefix: "X"/);
  });

  it("uses word-label pills for Direction, Align and Wrap and a select for Justify", () => {
    expect(inspectPanelSource).toContain('label="Direction"');
    expect(inspectPanelSource).toContain('label="Align"');
    expect(inspectPanelSource).toContain('label="Wrap"');
    expect(inspectPanelSource).toContain('label="Justify"');
    expect(inspectPanelSource).toContain('setProp("wrap", v)');
    // Wrap offers all three flex-wrap values.
    expect(inspectPanelSource).toContain('value: "nowrap"');
    expect(inspectPanelSource).toContain('value: "wrap"');
    expect(inspectPanelSource).toContain('value: "wrap-reverse"');
  });

  it("exposes density presets that write gap + padding together", () => {
    expect(inspectPanelSource).toContain("DENSITY_PRESETS");
    expect(inspectPanelSource).toContain('setProp("gap", preset.gap)');
    expect(inspectPanelSource).toContain('setProp("padding", preset.padding)');
  });

  it("keeps artboard align + distribute actions in the SCREENS group", () => {
    expect(inspectPanelSource).toContain('eyebrow="SCREENS"');
    expect(inspectPanelSource).toContain("applyArtboardAlign");
    expect(inspectPanelSource).toContain("applyArtboardDistribute");
    expect(inspectPanelSource).toContain('data-testid="artboard-align-panel"');
    expect(inspectPanelSource).toContain('data-testid="artboard-distribute-horizontal"');
  });

  it("keeps equal-width / equal-height actions for element multi-select", () => {
    expect(inspectPanelSource).toContain("makeEqualWidths");
    expect(inspectPanelSource).toContain("makeEqualHeights");
  });
});

describe("style tab controls", () => {
  it("presents Fill and Text colour through ColorRow + a curated SwatchRow", () => {
    expect(inspectPanelSource).toContain("<ColorRow");
    expect(inspectPanelSource).toContain("<SwatchRow");
    expect(inspectPanelSource).toContain('setProp("backgroundColor", c)');
    expect(inspectPanelSource).toContain("setTextColor(c)");
    expect(inspectPanelSource).toContain("PALETTE_BG_SWATCHES");
    expect(inspectPanelSource).toContain("PALETTE_TEXT_SWATCHES");
  });

  it("hides the text colour row for artboards", () => {
    // Text row is gated behind !isArtboard.
    expect(inspectPanelSource).toMatch(/!isArtboard &&[\s\S]{0,200}<ColorRow label="Text"/);
  });

  it("uses radius pills mapped to the token scale and a named shadow select", () => {
    expect(inspectPanelSource).toContain("RADIUS_PILLS");
    expect(inspectPanelSource).toContain('setProp("borderRadius", v)');
    expect(inspectPanelSource).toContain("SHADOW_OPTIONS");
    expect(inspectPanelSource).toContain('setProp("shadow", v)');
    // Radius token scale mirrors resolver.tsx.
    expect(inspectPanelSource).toContain('token: "None", label: "None", px: 0');
    expect(inspectPanelSource).toContain('token: "Full", label: "Full", px: 9999');
  });

  it("suppresses the swatch grid in multi-select", () => {
    // SwatchRow only renders when !isMultiSelect.
    expect(inspectPanelSource).toMatch(/!isMultiSelect &&[\s\S]{0,120}<SwatchRow/);
  });

  it("keeps the artboard background picker for Color / Gradient / Image", () => {
    expect(inspectPanelSource).toContain("ArtboardBackgroundPicker");
  });

  it("lets artboards be renamed from Style (they have no Content tab)", () => {
    expect(inspectPanelSource).toContain('setProp("label", e.target.value)');
    expect(inspectPanelSource).toContain('aria-label="Artboard name"');
    // Empty names fall back to the default instead of persisting "".
    expect(inspectPanelSource).toContain('setProp("label", "Artboard")');
  });
});

describe("style props actually render", () => {
  const resolverSource = fs.readFileSync(
    path.resolve(__dirname, "../resolver.tsx"),
    "utf8",
  );

  it("maps the named shadow scale to real box-shadows in the renderer", () => {
    expect(resolverSource).toContain("SHADOW_TOKEN");
    // Every option the inspector offers exists in the renderer's scale.
    for (const token of ["none", "soft", "raised", "overlay"]) {
      expect(resolverSource, `shadow token ${token}`).toMatch(
        new RegExp(`${token}:`),
      );
    }
  });

  it("applies shadow + opacity on leaf and container nodes", () => {
    expect(resolverSource).toContain("function shadowOpacityStyle");
    const applications = resolverSource.match(/\.\.\.shadowOpacityStyle\(/g) ?? [];
    expect(applications.length, "leaf + container application sites").toBeGreaterThanOrEqual(2);
  });

  it("applies shadow, radius token and opacity on artboards, keeping the selection ring", () => {
    // Artboard style consults the user shadow prop rather than only the hardcoded default.
    expect(resolverSource).toMatch(/SHADOW_TOKEN\[shadow as string\]/);
    expect(resolverSource).toMatch(/RADIUS_TOKEN\[borderRadius as string\]/);
    // Selection ring is prepended even when a custom shadow is set.
    expect(resolverSource).toContain('`0 0 0 2px #3b82f6${base !== "none" ? `, ${base}` : ""}`');
  });
});

describe("component props ownership", () => {
  it("no longer hand-rolls sizing / position / layout rows inside ComponentProps", () => {
    expect(componentPropsSource).not.toContain('label="Width (px)"');
    expect(componentPropsSource).not.toContain('label="Height (px)"');
    expect(componentPropsSource).not.toContain('label="X (px)"');
    expect(componentPropsSource).not.toContain('label="Y (px)"');
    expect(componentPropsSource).not.toContain('if (displayName === "AstryxSection")');
    expect(componentPropsSource).not.toContain('if (displayName === "AstryxStack")');
    expect(componentPropsSource).not.toContain('if (displayName === "AstryxHStack")');
  });
});

describe("inspect row primitives", () => {
  it("exports the six row primitives plus the MIXED sentinel", () => {
    for (const name of ["ColorRow", "SwatchRow", "PillRow", "NumberRow", "SelectRow", "SwitchRow"]) {
      expect(rowsSource, `${name} export`).toContain(`export function ${name}`);
    }
    expect(rowsSource).toContain("export const MIXED");
  });

  it("uses a real <label htmlFor> gutter, not a bare div, for row labels", () => {
    expect(rowsSource).toContain("<label");
    expect(rowsSource).toContain("htmlFor={htmlFor}");
    // A single shared gutter constant, applied everywhere.
    expect(rowsSource).toContain("const GUTTER = 56");
  });

  it("marks pill groups as an accessible radiogroup", () => {
    expect(rowsSource).toContain('role="radiogroup"');
    expect(rowsSource).toContain('role="radio"');
  });

  it("marks the switch with role=switch and wires help via aria-describedby", () => {
    expect(rowsSource).toContain('role="switch"');
    expect(rowsSource).toContain("aria-describedby={helpId}");
  });

  it("labels swatches with a name, not colour alone", () => {
    expect(rowsSource).toContain("aria-label={`${s.label}`}");
  });

  it("uses CSS variables for tokens rather than raw theme hex literals", () => {
    expect(rowsSource).toContain("var(--primary)");
    expect(rowsSource).toContain("var(--foreground)");
    expect(rowsSource).toContain("var(--brand-soft)");
    // The token comment block documents the mapping.
    expect(rowsSource).toContain("--ip-ink");
  });
});
