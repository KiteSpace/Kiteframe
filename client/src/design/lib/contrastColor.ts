/**
 * Smart contrast color utilities for the Astryx design editor.
 *
 * Walks a flat craft.js node map and ensures every container that has a
 * `backgroundColor` also carries a `textColor` that is readable on that
 * background (WCAG relative-luminance based).
 *
 * Containers that propagate `textColor` via CSS inheritance:
 *   AstryxArtboard, AstryxSection, AstryxStack, AstryxHStack, AstryxCard
 *
 * Rules:
 * - Only solid hex / named colors are evaluated; gradients, CSS vars,
 *   "transparent", and undefined are skipped gracefully.
 * - An existing `textColor` on a container is preserved UNLESS it was
 *   set by a previous auto-contrast pass (detected by the sentinel prefix
 *   "__auto__").  Plain user-set values are left alone.
 * - Leaf nodes (AstryxText, AstryxHeading) inherit the color through the
 *   DOM; no individual leaf edits are needed.
 */

const CONTRAST_CONTAINERS = new Set([
  "AstryxArtboard",
  "AstryxSection",
  "AstryxStack",
  "AstryxHStack",
  "AstryxCard",
]);

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

/** WCAG 2.1 relative luminance (0 = black, 1 = white). */
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

/** Return "#FFFFFF" for dark backgrounds, "#111827" for light ones. */
export function contrastTextFor(bgColor: string): string | null {
  const lum = getLuminance(bgColor);
  if (lum < 0) return null;
  return lum < 0.35 ? "#FFFFFF" : "#111827";
}

interface CraftNode {
  type?: { resolvedName?: string } | string;
  displayName?: string;
  props?: Record<string, unknown>;
  nodes?: string[];
  [key: string]: unknown;
}

function resolvedName(node: CraftNode): string {
  if (typeof node.type === "object") return node.type?.resolvedName ?? "";
  return (node.displayName ?? "") as string;
}

/**
 * Walk a flat craft.js node map and auto-set `textColor` on every container
 * that has a parseable solid `backgroundColor`, without overwriting any
 * textColor the user intentionally set (non-auto values are preserved).
 *
 * Returns a new node map with the updated props — original objects are not
 * mutated.
 */
export function applyContrastColors(
  nodes: Record<string, CraftNode>
): Record<string, CraftNode> {
  const result: Record<string, CraftNode> = { ...nodes };

  for (const [id, node] of Object.entries(nodes)) {
    const name = resolvedName(node);
    if (!CONTRAST_CONTAINERS.has(name)) continue;

    const bg = node.props?.backgroundColor as string | undefined;
    if (!bg || bg === "transparent") continue;

    const autoColor = contrastTextFor(bg);
    if (!autoColor) continue;

    const existing = node.props?.textColor as string | undefined;
    if (existing && !existing.startsWith("__auto__")) continue;

    result[id] = {
      ...node,
      props: {
        ...(node.props ?? {}),
        textColor: autoColor,
      },
    };
  }

  return result;
}

/**
 * Convenience wrapper: parse a craft state JSON string, apply contrast
 * colors, and return the updated JSON string.  Returns the original string
 * unchanged if parsing fails.
 */
export function applyContrastColorsToJson(json: string): string {
  try {
    const parsed = JSON.parse(json) as Record<string, CraftNode>;
    if (typeof parsed !== "object" || parsed === null) return json;
    const updated = applyContrastColors(parsed);
    return JSON.stringify(updated);
  } catch {
    return json;
  }
}
