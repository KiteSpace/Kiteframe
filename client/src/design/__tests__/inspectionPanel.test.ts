/**
 * Inspection-panel contract tests.
 *
 * The panel is intentionally kept private to DesignEditor because it is only
 * rendered as part of the editor. These tests guard the user-facing structure
 * of that private panel at the source boundary so a future component audit
 * cannot quietly reintroduce a second Layout section or duplicate controls.
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

const inspectPanelSource = editorSource.slice(
  editorSource.indexOf("function InspectPanel"),
  editorSource.indexOf("// ─── Node type → display icon mapping"),
);

describe("component inspection panel layout controls", () => {
  it("keeps sizing and layout controls under Properties without a standalone top-level Layout heading", () => {
    expect(inspectPanelSource).toContain(">Properties</div>");
    // A "Layout" label is allowed inside the scoped multi-select card (guarded by isMultiSelect),
    // but must not appear as a standalone section heading outside that card.
    expect(inspectPanelSource).not.toMatch(/(?<!isMultiSelect[^}]{0,200})>\s*Layout\s*<\/div>/s);
    expect(inspectPanelSource).toContain("<DimensionControl");
    expect(inspectPanelSource).toContain('setProp("width", v)');
    expect(inspectPanelSource).toContain('setProp("height", v)');
  });

  it("provides Auto controls with a consistent undefined/auto-compatible reset", () => {
    expect(editorSource).toContain('value == null || value === "auto"');
    // The Auto button resets to undefined (auto).
    expect(editorSource).toContain('onClick={() => onChange(undefined)');
    // The dimension input shows "auto" as its placeholder when the value is unset.
    expect(editorSource).toContain('"auto"');
  });

  it("keeps Position and disables X/Y unless the node is absolute", () => {
    expect(inspectPanelSource).toContain('options={["flow", "absolute"]}');
    expect(inspectPanelSource).toContain('setProp("position", v)');
    expect(inspectPanelSource).toContain('selected.props.position !== "absolute"');
    expect(inspectPanelSource).toContain("disabled={selected.props.position !== \"absolute\"}");
  });

  it("uses icon-button groups for both Align items and Justify", () => {
    expect(inspectPanelSource).toContain('<PropRow label="Align items">');
    expect(inspectPanelSource).toContain('<PropRow label="Justify">');
    expect(inspectPanelSource).toContain("<LayoutIconGroup");
    expect(editorSource).toContain('aria-pressed={value === option.value}');
    expect(editorSource).toContain('value: "between"');
    expect(editorSource).toContain('value: "around"');
    expect(componentPropsSource).not.toMatch(/label="(?:Align items|Justify)"/);
  });

  it("keeps artboard label, background, and coordinates without duplicate layout rows", () => {
    expect(componentPropsSource).toContain('label="Label"');
    expect(inspectPanelSource).toContain("ArtboardBackgroundPicker");
    expect(inspectPanelSource).toContain('aria-label={`${label} position`}');
    expect(componentPropsSource).not.toContain('label="Width (px)"');
    expect(componentPropsSource).not.toContain('label="Height (px)"');
    expect(componentPropsSource).not.toContain('label="X (px)"');
    expect(componentPropsSource).not.toContain('label="Y (px)"');
    expect(componentPropsSource).not.toContain('if (displayName === "AstryxSection")');
    expect(componentPropsSource).not.toContain('if (displayName === "AstryxStack")');
    expect(componentPropsSource).not.toContain('if (displayName === "AstryxHStack")');
    expect(componentPropsSource).not.toMatch(/if \(displayName === "AstryxArtboard"\)[\s\S]*label="Label"[\s\S]*(?:Width|Height|X \(|Y \(|Align items|Justify|Gap \(|Padding \()/);
  });
});