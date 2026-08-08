import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const resolverSource = fs.readFileSync(
  path.resolve(__dirname, "../resolver.tsx"),
  "utf8",
);
const editorSource = fs.readFileSync(
  path.resolve(__dirname, "../DesignEditor.tsx"),
  "utf8",
);
const generationSource = fs.readFileSync(
  path.resolve(__dirname, "../../lib/designGeneration.ts"),
  "utf8",
);

describe("card and chart layout defaults", () => {
  it("gives cards an editable pixel gap with a safe default", () => {
    expect(resolverSource).toContain(
      'gap = 12, position = "flow"',
    );
    expect(resolverSource).toContain(
      "gap: Math.max(0, Number(gap) || 0)",
    );
    expect(editorSource).toContain('<PropRow label="Gap (px)">');
    expect(editorSource).toContain(
      'setProp("gap", Math.max(0, v))',
    );
    expect(editorSource).toContain(
      'is={AstryxCard} variant="elevated" gap={12}',
    );
    expect(generationSource).toContain(
      'AstryxCard:        content card, props: { variant: "elevated"|"outlined"|"ghost", gap: number (default 12) }',
    );
  });

  it("defaults every chart wrapper to fill its containing width", () => {
    for (const chart of [
      "AstryxBarChart",
      "AstryxLineChart",
      "AstryxPieChart",
    ]) {
      expect(resolverSource).toContain(`"${chart}",`);
    }

    const fullWidthBlock = resolverSource.match(
      /const FULL_WIDTH_LEAF = new Set\(\[([\s\S]*?)\]\);/,
    )?.[1] ?? "";
    expect(fullWidthBlock).toContain('"AstryxBarChart"');
    expect(fullWidthBlock).toContain('"AstryxLineChart"');
    expect(fullWidthBlock).toContain('"AstryxPieChart"');
    expect(resolverSource).toContain(
      'isFullWidth ? { width: "100%" } : { width: "fit-content" }',
    );
  });

  it("still lets explicit chart dimensions override the default", () => {
    expect(resolverSource).toContain(
      'nodeWidth !== undefined && nodeWidth !== "auto"',
    );
    expect(resolverSource).toContain(
      'nodeHeight !== undefined && nodeHeight !== "auto"',
    );
    expect(resolverSource).toContain("{ width: nodeWidth }");
    expect(resolverSource).toContain("{ height: nodeHeight }");
  });
});