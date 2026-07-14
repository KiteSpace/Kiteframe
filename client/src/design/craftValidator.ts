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

  return changed ? JSON.stringify(map) : craftStateJson;
}
