/**
 * Smart contrast color utilities for the Astryx design editor.
 *
 * Walks a flat craft.js node map and ensures every container that has a
 * solid `backgroundColor` carries a readable `textColor`, AND that direct
 * leaf text nodes (AstryxText, AstryxHeading) receive an explicit `color`
 * override — necessary because those base components render `text-gray-900`
 * via Tailwind which CSS cascade from the parent cannot override.
 *
 * Containers that propagate `textColor` via CSS inheritance:
 *   AstryxArtboard, AstryxSection, AstryxStack, AstryxHStack, AstryxCard
 *
 * Rules:
 * - Only solid hex / named colors are evaluated; gradients, CSS vars,
 *   "transparent", and undefined are skipped gracefully.
 * - Container `textColor` is always recomputed whenever `backgroundColor`
 *   is present and parseable — no stale sentinel logic.
 * - Leaf text nodes (`AstryxText`, `AstryxHeading`) get `color` set to the
 *   contrast value derived from their nearest ancestor with a backgroundColor,
 *   but only when they currently have no explicit `color` prop.
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
 * Walk a flat craft.js node map and apply contrast colors:
 *
 * Pass 1 — Containers: for every container with a parseable solid backgroundColor,
 *   set textColor to the contrast value (always recomputed, never stale).
 *
 * Pass 2 — Leaf text nodes: for every AstryxText/AstryxHeading without an
 *   explicit color prop, walk up the parent chain to find the nearest container
 *   with backgroundColor and apply the same contrast color as an explicit `color`
 *   prop — required because those components render text-gray-900 via Tailwind
 *   which CSS cascade alone cannot override.
 *
 * Returns a new node map — original objects are not mutated.
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
  const getInheritedContrast = (nodeId: string, depth = 0): string | null => {
    if (depth > 20) return null; // cycle guard
    const node = nodes[nodeId];
    if (!node) return null;
    const parentId = node.parent as string | undefined;
    if (!parentId || parentId === nodeId) return null;
    if (bgContrastMap[parentId]) return bgContrastMap[parentId];
    return getInheritedContrast(parentId, depth + 1);
  };

  for (const [id, node] of Object.entries(nodes)) {
    const name = resolvedName(node);
    if (!LEAF_TEXT_NODES.has(name)) continue;
    // Preserve explicitly set user colors
    if (node.props?.color) continue;
    const inheritedColor = getInheritedContrast(id);
    if (!inheritedColor) continue;
    result[id] = {
      ...node,
      props: { ...(node.props ?? {}), color: inheritedColor },
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
