/**
 * Smart contrast color utilities for the Astryx design editor.
 *
 * Walks a flat craft.js node map and ensures every container that has a
 * solid `backgroundColor` carries a readable `textColor`, AND that direct
 * leaf text nodes (AstryxText, AstryxHeading) receive an explicit `color`
 * override — necessary because those base components render `text-gray-900`
 * via Tailwind which CSS cascade from the parent cannot override.
 *
 * Sentinel: `_autoColor: true` is written alongside any auto-set `color`
 * value on a leaf text node. This lets subsequent background changes
 * re-apply contrast even if the node already has a color (auto-set).
 * When the user manually changes a text node's color via the inspector,
 * `_autoColor` is cleared (set to false) so auto-contrast no longer
 * overwrites their choice.
 *
 * Containers that carry `textColor`:
 *   AstryxArtboard, AstryxSection, AstryxStack, AstryxHStack, AstryxCard
 */

export const CONTRAST_CONTAINERS = new Set([
  "AstryxArtboard",
  "AstryxSection",
  "AstryxStack",
  "AstryxHStack",
  "AstryxCard",
]);

export const LEAF_TEXT_NODES = new Set(["AstryxText", "AstryxHeading"]);

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  magenta: "#ff00ff",
  orange: "#ffa500",
  purple: "#800080",
  pink: "#ffc0cb",
  brown: "#a52a2a",
  gray: "#808080",
  grey: "#808080",
  navy: "#000080",
  teal: "#008080",
  lime: "#00ff00",
  indigo: "#4b0082",
  violet: "#ee82ee",
  silver: "#c0c0c0",
  maroon: "#800000",
  olive: "#808000",
};

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().toLowerCase();
  const resolved = NAMED_COLORS[clean] ?? clean;
  const short = resolved.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    const [, h] = short;
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  const full = resolved.match(/^#([0-9a-f]{6})$/i);
  if (full) {
    const [, h] = full;
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  return null;
}

/** WCAG 2.1 relative luminance (0 = black, 1 = white). Returns -1 for unparseable colors. */
export function getLuminance(color: string): number {
  const rgb = hexToRgb(color);
  if (!rgb) return -1;
  const [r8, g8, b8] = rgb;
  const [r, g, b] = [r8, g8, b8].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Return "#FFFFFF" for dark backgrounds, "#111827" for light ones. Null for unparseable. */
export function contrastTextFor(bgColor: string): string | null {
  const lum = getLuminance(bgColor);
  if (lum < 0) return null;
  return lum < 0.35 ? "#FFFFFF" : "#111827";
}

interface CraftNode {
  type?: { resolvedName?: string } | string;
  displayName?: string;
  parent?: string | null;
  props?: Record<string, unknown>;
  nodes?: string[];
  [key: string]: unknown;
}

function resolvedName(node: CraftNode): string {
  if (typeof node.type === "object") return node.type?.resolvedName ?? "";
  return (node.displayName ?? "") as string;
}

/**
 * Walk a flat craft.js node map and apply contrast colors.
 *
 * Pass 1 — Containers:
 *   For every container (Artboard/Section/Stack/HStack/Card) with a parseable
 *   solid backgroundColor, set textColor to the contrast value. Always
 *   recomputed — no stale sentinel logic.
 *
 * Pass 2 — Leaf text nodes (AstryxText, AstryxHeading):
 *   Walk up the parent chain to find the nearest ancestor with a backgroundColor.
 *   This correctly handles nested containers (dark parent, light nested container).
 *   - If the node has NO color → always set auto color.
 *   - If the node has a color AND `_autoColor === true` → it was auto-set before;
 *     re-apply the new contrast so it stays synchronized with background changes.
 *   - If the node has a color AND `_autoColor` is falsy → user explicitly set it;
 *     skip to preserve their choice.
 *
 * Returns a new node map — originals are not mutated.
 */
export function applyContrastColors(
  nodes: Record<string, CraftNode>
): Record<string, CraftNode> {
  const result: Record<string, CraftNode> = { ...nodes };

  // Pass 1: containers → textColor
  const bgContrastMap: Record<string, string> = {};
  for (const [id, node] of Object.entries(nodes)) {
    const name = resolvedName(node);
    if (!CONTRAST_CONTAINERS.has(name)) continue;
    const bg = node.props?.backgroundColor as string | undefined;
    if (!bg || bg === "transparent") continue;
    const autoColor = contrastTextFor(bg);
    if (!autoColor) continue;
    bgContrastMap[id] = autoColor;
    result[id] = {
      ...node,
      props: { ...(node.props ?? {}), textColor: autoColor },
    };
  }

  // Pass 2: leaf text nodes → explicit color override
  // Walk up the parent chain to find the nearest ancestor's contrast color.
  // This respects nested containers — a light inner container within a dark outer
  // one will correctly derive its contrast from the inner background, not the outer.
  const getInheritedContrast = (nodeId: string, depth = 0): string | null => {
    if (depth > 20) return null; // cycle guard
    const node = nodes[nodeId];
    if (!node) return null;
    const parentId = node.parent as string | undefined;
    if (!parentId || parentId === nodeId) return null;
    if (bgContrastMap[parentId] !== undefined) return bgContrastMap[parentId];
    return getInheritedContrast(parentId, depth + 1);
  };

  for (const [id, node] of Object.entries(nodes)) {
    const name = resolvedName(node);
    if (!LEAF_TEXT_NODES.has(name)) continue;

    // If the user manually set color (_autoColor is falsy but color exists), preserve it.
    const existingColor = node.props?.color as string | undefined;
    const wasAutoSet = !!node.props?._autoColor;
    if (existingColor && !wasAutoSet) continue;

    const inheritedColor = getInheritedContrast(id);
    if (!inheritedColor) continue;

    // Skip if already correct (no-op avoids unnecessary writes)
    if (existingColor === inheritedColor) continue;

    result[id] = {
      ...node,
      props: { ...(node.props ?? {}), color: inheritedColor, _autoColor: true },
    };
  }

  return result;
}

/**
 * Convenience wrapper: parse a craft state JSON string, apply contrast
 * colors, and return the updated JSON string. Returns the original unchanged
 * if parsing fails.
 */
export function applyContrastColorsToJson(json: string): string {
  try {
    const parsed = JSON.parse(json) as Record<string, CraftNode>;
    if (typeof parsed !== "object" || parsed === null) return json;
    return JSON.stringify(applyContrastColors(parsed));
  } catch {
    return json;
  }
}
