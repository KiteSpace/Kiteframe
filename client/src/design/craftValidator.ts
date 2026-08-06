/**
 * Pure craft.js state validation utilities — no React or craftjs runtime deps.
 * Safe to import from server-side code, tests, and scripts alike.
 *
 * Keeping this module framework-free is intentional: resolver.tsx imports from
 * here (not the other way around) so tests can import the real production
 * validators without dragging in @craftjs/core or @/components/astryx.
 */

// ─── Allowed component list ────────────────────────────────────────────────────
// This is the single source of truth.  resolver.tsx imports it to build its
// resolver map; the design-system prompt must document every entry here.
// AstryxUnknown is included so the validator accepts graceful-degradation nodes.

export const ALLOWED_CRAFT_COMPONENTS: readonly string[] = [
  // Containers
  "AstryxSection",
  "AstryxStack",
  "AstryxHStack",
  // Typography
  "AstryxHeading",
  "AstryxText",
  // Inputs & actions
  "AstryxButton",
  "AstryxTextInput",
  // Form controls
  "AstryxSelect",
  "AstryxCheckbox",
  "AstryxRadioGroup",
  "AstryxSlider",
  // Status & feedback
  "AstryxBadge",
  "AstryxBanner",
  "AstryxProgressBar",
  "AstryxStatusDot",
  "AstryxSpinner",
  "AstryxSkeleton",
  // Media & identity
  "AstryxAvatar",
  "AstryxIcon",
  // Data display
  "AstryxTable",
  "AstryxTabs",
  "AstryxAccordion",
  // Content
  "AstryxCard",
  "AstryxChatMessage",
  "AstryxEmptyState",
  "AstryxToken",
  "AstryxDivider",
  // Media & navigation
  "AstryxCalendar",
  "AstryxCommand",
  "AstryxCarousel",
  // Layout
  "AstryxResizable",
  // Navigation
  "AstryxNavbar",
  "AstryxSidebar",
  "AstryxBreadcrumb",
  // Overlays
  "AstryxModal",
  "AstryxDrawer",
  "AstryxSheet",
  // Charts
  "AstryxBarChart",
  "AstryxLineChart",
  "AstryxPieChart",
  // Media
  "AstryxVideoPlayer",
  "AstryxCodeBlock",
  // List
  "AstryxList",
  "AstryxListItem",
  // Artboard (named canvas frame for multi-screen editing)
  "AstryxArtboard",
  // Fallback for unknown components (not in prompt; used by sanitizeCraftState)
  "AstryxUnknown",
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CraftStateValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Validator ────────────────────────────────────────────────────────────────

export function validateCraftState(state: unknown): CraftStateValidationResult {
  const errors: string[] = [];

  if (!state || typeof state !== "object") {
    return { valid: false, errors: ["craft_state must be an object"] };
  }

  const map = state as Record<string, unknown>;

  if (!map["ROOT"]) {
    errors.push("craft_state must have a ROOT node");
  }

  const nodeIds = new Set(Object.keys(map));

  for (const [nodeId, node] of Object.entries(map)) {
    if (!node || typeof node !== "object") {
      errors.push(`Node "${nodeId}" is not an object`);
      continue;
    }

    const n = node as Record<string, unknown>;
    const resolvedName = (n["type"] as Record<string, unknown> | undefined)?.["resolvedName"];

    if (!resolvedName) {
      errors.push(`Node "${nodeId}" missing type.resolvedName`);
    } else if (!ALLOWED_CRAFT_COMPONENTS.includes(resolvedName as string)) {
      console.warn(
        `[validateCraftState] Node "${nodeId}" has unknown component type: "${resolvedName}" — will be rendered as AstryxUnknown`,
      );
    }

    if (nodeId !== "ROOT" && n["parent"] && !nodeIds.has(n["parent"] as string)) {
      errors.push(`Node "${nodeId}" references non-existent parent: "${n["parent"]}"`);
    }

    if (Array.isArray(n["nodes"])) {
      for (const childId of n["nodes"] as string[]) {
        if (!nodeIds.has(childId)) {
          errors.push(`Node "${nodeId}" references non-existent child: "${childId}"`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Reference repairer ──────────────────────────────────────────────────────
// Removes dangling parent/child cross-references from AI-generated craft state.
// Call this before validateCraftState so broken references don't hard-fail saves.

export function repairCraftState(state: unknown): unknown {
  if (!state || typeof state !== "object") return state;
  const map = { ...(state as Record<string, unknown>) } as Record<string, unknown>;
  const nodeIds = new Set(Object.keys(map));

  for (const [nodeId, node] of Object.entries(map)) {
    if (!node || typeof node !== "object") continue;
    const n = { ...(node as Record<string, unknown>) };

    // Strip dangling child references
    if (Array.isArray(n["nodes"])) {
      const repaired = (n["nodes"] as string[]).filter((id) => nodeIds.has(id));
      if (repaired.length !== (n["nodes"] as string[]).length) {
        n["nodes"] = repaired;
      }
    }

    // Strip dangling linkedNodes references
    if (n["linkedNodes"] && typeof n["linkedNodes"] === "object") {
      const ln = { ...(n["linkedNodes"] as Record<string, string>) };
      let changed = false;
      for (const [k, v] of Object.entries(ln)) {
        if (!nodeIds.has(v)) { delete ln[k]; changed = true; }
      }
      if (changed) n["linkedNodes"] = ln;
    }

    // Strip parent reference if parent node doesn't exist
    if (n["parent"] && !nodeIds.has(n["parent"] as string) && nodeId !== "ROOT") {
      n["parent"] = null;
    }

    map[nodeId] = n;
  }

  return map;
}

// ─── Sanitizer ────────────────────────────────────────────────────────────────
// Replaces any resolvedName not in ALLOWED_CRAFT_COMPONENTS with "AstryxUnknown"
// and preserves the original name in props.astryxComponent so the placeholder
// can display it.  Call this before passing a craft state string to <Frame>.

export function sanitizeCraftState(craftStateJson: string): string {
  let map: Record<string, unknown>;
  try {
    map = JSON.parse(craftStateJson) as Record<string, unknown>;
  } catch {
    return craftStateJson;
  }

  if (!map || typeof map !== "object") return craftStateJson;

  let changed = false;
  for (const [nodeId, node] of Object.entries(map)) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    const resolvedName = (n["type"] as Record<string, unknown> | undefined)?.["resolvedName"] as
      | string
      | undefined;
    if (resolvedName && resolvedName !== "AstryxUnknown" && !ALLOWED_CRAFT_COMPONENTS.includes(resolvedName)) {
      console.warn(
        `[sanitizeCraftState] Replacing unknown component "${resolvedName}" on node "${nodeId}" with AstryxUnknown`,
      );
      map[nodeId] = {
        ...n,
        type: { resolvedName: "AstryxUnknown" },
        displayName: "AstryxUnknown",
        props: { ...(n["props"] as object | undefined), astryxComponent: resolvedName },
        isCanvas: false,
      };
      changed = true;
    }
  }

  // Promote any node whose `parent` field is "ROOT" but that is absent from
  // ROOT.nodes — this happens when the AI generates a state with a correctly-
  // parented artboard but forgets to list it in ROOT's nodes array.
  // We run this here (not only in mergeIntoCanvas) so fresh generations also
  // benefit, since those bypass mergeIntoCanvas entirely.
  const rootEntry = map["ROOT"] as Record<string, unknown> | undefined;
  if (rootEntry && Array.isArray(rootEntry.nodes)) {
    const rootNodeSet = new Set(rootEntry.nodes as string[]);
    const promoted: string[] = [];
    for (const [id, node] of Object.entries(map)) {
      if (id === "ROOT" || !node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      if (n.parent === "ROOT" && !rootNodeSet.has(id)) {
        promoted.push(id);
        console.warn(`[sanitizeCraftState] Promoting orphaned ROOT child: "${id}"`);
      }
    }
    if (promoted.length > 0) {
      map["ROOT"] = { ...rootEntry, nodes: [...(rootEntry.nodes as string[]), ...promoted] };
      changed = true;
    }
  }

  return changed ? JSON.stringify(map) : craftStateJson;
}
