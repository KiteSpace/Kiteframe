/**
 * Inspection-panel contract tests — single-pane edition.
 *
 * The panel is intentionally kept private to DesignEditor because it is only
 * rendered as part of the editor. These tests guard the user-facing structure
 * of that private panel at the source boundary so a redesign cannot quietly
 * drop the section structure, break progressive disclosure, lose collapse
 * memory, or reintroduce duplicate controls.
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

// The inspect panel spans its section/kind constants, InspectPanel, and the
// section sub-components, up to the node-icon mapping that follows.
const inspectPanelSource = editorSource.slice(
  editorSource.indexOf("// ─── Inspect panel: single-pane sections"),
  editorSource.indexOf("// ─── Node type → display icon mapping"),
);

const rowsSource = fs.readFileSync(
  path.resolve(__dirname, "../InspectRows.tsx"),
  "utf8",
);

describe("single-pane section structure", () => {
  it("declares the five sections in fixed order", () => {
    expect(inspectPanelSource).toContain(
      'type SectionId = "layout" | "stack" | "spacing" | "style" | "content"',
    );
    expect(inspectPanelSource).toContain('layout: "Layout"');
    expect(inspectPanelSource).toContain('stack: "Stack"');
    expect(inspectPanelSource).toContain('spacing: "Spacing"');
    expect(inspectPanelSource).toContain('style: "Style"');
    expect(inspectPanelSource).toContain('content: "Content"');
  });

  it("renders every section through the shared InspectSection collapsible", () => {
    expect(inspectPanelSource).toContain("function InspectSection");
    // Toggle exposes its state accessibly.
    expect(inspectPanelSource).toContain("aria-expanded={!collapsed}");
    // Each of the five sections is mounted through it.
    for (const sid of ["layout", "stack", "spacing", "style", "content"]) {
      expect(inspectPanelSource, `section ${sid}`).toContain(`id="${sid}"`);
    }
    expect(inspectPanelSource).toContain("<LayoutSection");
    expect(inspectPanelSource).toContain("<StackSection");
    expect(inspectPanelSource).toContain("<SpacingSection");
    expect(inspectPanelSource).toContain("<StyleSection");
  });

  it("no longer renders a tab model", () => {
    expect(inspectPanelSource).not.toContain("TABS_BY_KIND");
    expect(inspectPanelSource).not.toContain('role="tablist"');
    expect(inspectPanelSource).not.toContain("activeTab");
  });

  it("gives artboards no Content section and no Content chip", () => {
    // Content is appended only for non-artboard kinds.
    expect(inspectPanelSource).toMatch(
      /if \(kind !== "artboard"\) list\.push\("content"\)/,
    );
  });

  it("shows stack/spacing sections only for flex containers", () => {
    expect(inspectPanelSource).toMatch(
      /if \(isFlexContainer\) list\.push\("stack", "spacing"\)/,
    );
  });

  it("renders the Content section from the existing ComponentProps dispatcher", () => {
    expect(inspectPanelSource).toMatch(
      /id="content"[\s\S]{0,700}<ComponentProps/,
    );
  });
});

describe("collapse memory", () => {
  it("persists collapse state per node kind under kiteframe.inspect.collapse", () => {
    expect(inspectPanelSource).toContain('"kiteframe.inspect.collapse"');
    expect(inspectPanelSource).toContain("readCollapsePrefs");
    expect(inspectPanelSource).toContain("writeCollapsePrefs");
    // Keyed by node kind, then section.
    expect(inspectPanelSource).toContain("collapsePrefs[kind]?.[sid]");
  });

  it("survives corrupt localStorage without crashing", () => {
    expect(inspectPanelSource).toMatch(/function readCollapsePrefs[\s\S]{0,300}catch/);
  });

  it("shows a live one-line summary only while collapsed", () => {
    expect(inspectPanelSource).toContain("{collapsed && summary && (");
    expect(inspectPanelSource).toContain("sectionSummaries");
    // Summaries cover the collapsible value groups.
    expect(inspectPanelSource).toContain("layout: `${w} × ${h}`");
    expect(inspectPanelSource).toContain("spacing: `${gap} / ${pad}`");
  });
});

describe("section index chips", () => {
  it("renders one chip per available section and marks the current one", () => {
    expect(inspectPanelSource).toContain('aria-label="Inspector sections"');
    expect(inspectPanelSource).toContain("availableSections.map((sid)");
    expect(inspectPanelSource).toContain('aria-current={isCurrent ? "true" : undefined}');
    expect(inspectPanelSource).toContain("section-chip-");
  });

  it("expands a collapsed section before scrolling to it on chip click", () => {
    expect(inspectPanelSource).toMatch(
      /onChipClick[\s\S]{0,300}if \(isCollapsed\(sid\)\) setSectionCollapsed\(sid, false\)/,
    );
    expect(inspectPanelSource).toContain("scrollIntoView");
  });

  it("tracks the scrolled-to section to highlight the current chip", () => {
    expect(inspectPanelSource).toContain("setActiveSection(current)");
    expect(inspectPanelSource).toMatch(/addEventListener\("scroll", onScroll/);
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

describe("layout section controls", () => {
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

describe("stack + spacing section controls", () => {
  it("uses icon pills (IconPillRow) for Direction, Align and Wrap and a JustifySelectRow for Justify", () => {
    // All four controls are labelled correctly.
    expect(inspectPanelSource).toContain('label="Direction"');
    expect(inspectPanelSource).toContain('label="Align"');
    expect(inspectPanelSource).toContain('label="Wrap"');
    expect(inspectPanelSource).toContain('label="Justify"');
    // Direction and Align use IconPillRow, not the legacy plain PillRow.
    expect(inspectPanelSource).toContain("<IconPillRow");
    // Justify uses the new glyph-aware JustifySelectRow.
    expect(inspectPanelSource).toContain("<JustifySelectRow");
    // Wrap still writes all three flex-wrap values.
    expect(inspectPanelSource).toContain('setProp("wrap", v)');
    expect(inspectPanelSource).toContain('value: "nowrap"');
    expect(inspectPanelSource).toContain('value: "wrap"');
    expect(inspectPanelSource).toContain('value: "wrap-reverse"');
  });

  it("direction icons are the correct column/row SVG glyphs from the handoff", () => {
    // Column: stacked horizontal bars.
    expect(inspectPanelSource).toContain('DIRECTION_ICONS');
    expect(inspectPanelSource).toContain('x="2.5" y="1.5" width="9" height="3"');
    // Row: vertical bars side by side.
    expect(inspectPanelSource).toContain('x="1.5" y="2.5" width="3" height="9"');
  });

  it("align icons cover Start / Center / End / Stretch", () => {
    expect(inspectPanelSource).toContain('ALIGN_ICONS');
    // Stretch has rules on both sides.
    expect(inspectPanelSource).toContain('x="11.6" y="1.5" width="1.4" height="11"');
  });

  it("wrap icons cover No wrap / Wrap / Reverse", () => {
    expect(inspectPanelSource).toContain('WRAP_ICONS');
    // No wrap: three side-by-side rects.
    expect(inspectPanelSource).toContain('x="1" y="5.5" width="3.4" height="3"');
  });

  it("density section uses IconPillRow with the prescribed icon set", () => {
    expect(inspectPanelSource).toContain('DENSITY_ICONS');
    // Density label is rendered through the icon pill group.
    expect(inspectPanelSource).toContain('label="Density"');
  });

  it("JustifySelectRow is exported from InspectRows", () => {
    expect(rowsSource).toContain("export function JustifySelectRow");
    // Glyph groups cover all five justify values.
    expect(rowsSource).toContain('"Start"');
    expect(rowsSource).toContain('"Center"');
    expect(rowsSource).toContain('"End"');
    expect(rowsSource).toContain('"Space between"');
    expect(rowsSource).toContain('"Space around"');
  });

  it("IconPillRow is exported from InspectRows with accessible radio semantics", () => {
    expect(rowsSource).toContain("export function IconPillRow");
    // Uses role=radiogroup and aria-checked per button.
    expect(rowsSource).toContain('role="radiogroup"');
    expect(rowsSource).toContain('aria-checked={isActive}');
    // data-label on each pill so callers can read label without SVG textContent.
    expect(rowsSource).toContain('data-label={opt.label}');
  });

  it("exposes density presets that write gap + padding together", () => {
    expect(inspectPanelSource).toContain("DENSITY_PRESETS");
    expect(inspectPanelSource).toContain('setProp("gap", preset.gap)');
    expect(inspectPanelSource).toContain('setProp("padding", preset.padding)');
  });

  it("still exposes gap alone for padding-less stacks", () => {
    expect(inspectPanelSource).toMatch(/if \(!supportsPadding\)[\s\S]{0,500}label="Gap"/);
  });
});

describe("style section controls", () => {
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

  it("lets artboards be renamed from Style (they have no Content section)", () => {
    expect(inspectPanelSource).toContain('setProp("label", e.target.value)');
    expect(inspectPanelSource).toContain('aria-label="Artboard name"');
    // Empty names fall back to the default instead of persisting "".
    expect(inspectPanelSource).toContain('setProp("label", "Artboard")');
  });
});

describe("multi-select behavior", () => {
  it("limits multi-select to Layout + Style sections", () => {
    expect(inspectPanelSource).toMatch(
      /if \(isMultiSelect\) return \["layout", "style"\]/,
    );
  });

  it("writes absolute values to every selected node in one history entry", () => {
    expect(inspectPanelSource).toContain("actions.history.throttle(0)");
    expect(inspectPanelSource).toContain("targetIds.forEach");
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
