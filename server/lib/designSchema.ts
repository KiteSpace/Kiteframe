import Ajv, { type ValidateFunction } from "ajv";

// ─── Legacy flat-JSON schema (external_entities, old /api/designs/generate) ──

export const DESIGN_MAX_COMPONENTS = 150;

export const designJsonSchema = {
  $id: "external-design-submission",
  type: "object",
  additionalProperties: false,
  required: ["components"],
  properties: {
    title: { type: "string", nullable: true },
    components: {
      type: "array",
      minItems: 1,
      maxItems: DESIGN_MAX_COMPONENTS,
      items: {
        type: "object",
        required: ["id", "astryxComponent", "x", "y"],
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          astryxComponent: { type: "string", minLength: 1 },
          x: { type: "number" },
          y: { type: "number" },
          props: { type: "object", nullable: true },
        },
      },
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: false });
const validateFn: ValidateFunction = ajv.compile(designJsonSchema);

export interface DesignValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateExternalDesign(data: unknown): DesignValidationResult {
  const schemaValid = validateFn(data);

  const errors: string[] = schemaValid
    ? []
    : (validateFn.errors || []).map((e) => {
        const path = e.instancePath || "(root)";
        if (path === "/components" && e.keyword === "maxItems") {
          return `Too many components: maximum is ${DESIGN_MAX_COMPONENTS}, got ${(data as any)?.components?.length ?? "?"}`;
        }
        return `${path} ${e.message}`;
      });

  return { valid: errors.length === 0, errors };
}

// ─── craft.js state schema (new designs table) ────────────────────────────────
// Allowed component resolvedName values — must stay in sync with client/src/design/resolver.tsx

export const SERVER_ALLOWED_CRAFT_COMPONENTS = [
  // Containers
  "AstryxSection",
  "AstryxStack",
  "AstryxHStack",
  "AstryxArtboard",
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
  // Fallback
  "AstryxUnknown",
] as const;

export const CRAFT_STATE_SCHEMA = {
  $id: "craft-js-design-state",
  type: "object",
  minProperties: 1,
  additionalProperties: {
    type: "object",
    required: ["type", "props", "parent", "nodes", "linkedNodes"],
    properties: {
      type: {
        type: "object",
        required: ["resolvedName"],
        properties: {
          resolvedName: {
            type: "string",
            enum: [...SERVER_ALLOWED_CRAFT_COMPONENTS],
          },
        },
      },
      isCanvas: { type: "boolean" },
      props: { type: "object" },
      displayName: { type: "string" },
      custom: { type: "object" },
      parent: { type: ["string", "null"] },
      hidden: { type: "boolean" },
      nodes: { type: "array", items: { type: "string" } },
      linkedNodes: { type: "object" },
    },
  },
} as const;

const craftAjv = new Ajv({ allErrors: true, strict: false });
const craftValidateFn: ValidateFunction = craftAjv.compile(CRAFT_STATE_SCHEMA as any);

export function validateCraftState(data: unknown): DesignValidationResult {
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["craft_state must be an object"] };
  }

  const map = data as Record<string, any>;

  if (!map["ROOT"]) {
    return { valid: false, errors: ["craft_state must have a ROOT node"] };
  }

  const schemaValid = craftValidateFn(data);
  const errors: string[] = schemaValid
    ? []
    : (craftValidateFn.errors || []).map((e) => {
        const path = e.instancePath || "(root)";
        return `${path} ${e.message}`;
      });

  // Additional cross-node reference integrity checks
  const nodeIds = new Set(Object.keys(map));
  for (const [nodeId, node] of Object.entries(map)) {
    if (!node || typeof node !== "object") continue;
    if (nodeId !== "ROOT" && node.parent && !nodeIds.has(node.parent)) {
      errors.push(`Node "${nodeId}" references non-existent parent: "${node.parent}"`);
    }
    if (Array.isArray(node.nodes)) {
      for (const childId of node.nodes) {
        if (!nodeIds.has(childId)) {
          errors.push(`Node "${nodeId}" references non-existent child: "${childId}"`);
        }
      }
    }
  }

  // Cycle detection via DFS from ROOT over the nodes[] (parent→child) links
  const adjacency = new Map<string, string[]>();
  for (const [id, node] of Object.entries(map)) {
    adjacency.set(id, Array.isArray(node?.nodes) ? (node.nodes as string[]) : []);
  }
  const visited = new Set<string>();
  const inStack = new Set<string>();
  function dfs(id: string): boolean {
    if (inStack.has(id)) return true; // cycle
    if (visited.has(id)) return false;
    visited.add(id);
    inStack.add(id);
    for (const child of adjacency.get(id) ?? []) {
      if (dfs(child)) return true;
    }
    inStack.delete(id);
    return false;
  }
  if (dfs("ROOT")) {
    errors.push("craft_state contains a cycle in the node tree");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Repairs AI-generated craft state before strict validation:
 * 1. Adds missing required fields with safe defaults (props, nodes, linkedNodes, parent).
 * 2. Replaces any resolvedName not in SERVER_ALLOWED_CRAFT_COMPONENTS with "AstryxUnknown"
 *    (mirrors the client-side sanitizeCraftState so server-only paths like the workflow
 *    interface generator don't 422 on hallucinated component names).
 * 3. Strips dangling child/linkedNodes references that point to non-existent nodes.
 * 4. Nulls parent pointers that reference non-existent nodes.
 * 5. Reconstructs a missing ROOT node from orphaned nodes (mirrors client repairCraftState).
 *
 * Call this before validateCraftState so transient AI omissions and node-ID
 * mismatches don't hard-fail saves.
 */
export function repairCraftState(state: unknown): unknown {
  if (!state || typeof state !== "object") return state;
  const map = { ...(state as Record<string, unknown>) } as Record<string, unknown>;
  const nodeIds = new Set(Object.keys(map));
  const allowedSet = new Set<string>(SERVER_ALLOWED_CRAFT_COMPONENTS);

  for (const [nodeId, node] of Object.entries(map)) {
    if (!node || typeof node !== "object") continue;
    const n = { ...(node as Record<string, unknown>) };

    // ── Hydrate missing required fields with safe defaults ──────────────────
    if (!n["props"] || typeof n["props"] !== "object") n["props"] = {};
    if (!Array.isArray(n["nodes"])) n["nodes"] = [];
    if (!n["linkedNodes"] || typeof n["linkedNodes"] !== "object") n["linkedNodes"] = {};
    if (!("parent" in n)) n["parent"] = nodeId === "ROOT" ? null : null;
    if (!n["type"] || typeof n["type"] !== "object") {
      // Can't recover a node with no type — mark as unknown so it renders as a placeholder
      n["type"] = { resolvedName: "AstryxUnknown" };
    }
    const typeObj = n["type"] as Record<string, unknown>;
    if (!typeObj["resolvedName"]) typeObj["resolvedName"] = "AstryxUnknown";

    // ── Sanitize unknown component types ────────────────────────────────────
    // The AJV schema uses a strict enum; any hallucinated name causes a 422.
    // Replace with AstryxUnknown so the canvas renders a placeholder instead.
    const resolvedName = typeObj["resolvedName"] as string;
    if (resolvedName !== "AstryxUnknown" && !allowedSet.has(resolvedName)) {
      console.warn(
        `[repairCraftState] Unknown component "${resolvedName}" on node "${nodeId}" — replacing with AstryxUnknown`,
      );
      typeObj["resolvedName"] = "AstryxUnknown";
    }

    // ── Strip dangling child references ─────────────────────────────────────
    const childIds = n["nodes"] as string[];
    const repairedChildren = childIds.filter((id) => nodeIds.has(id));
    if (repairedChildren.length !== childIds.length) n["nodes"] = repairedChildren;

    // ── Strip dangling linkedNodes references ────────────────────────────────
    const ln = { ...(n["linkedNodes"] as Record<string, string>) };
    let lnChanged = false;
    for (const [k, v] of Object.entries(ln)) {
      if (!nodeIds.has(v)) { delete ln[k]; lnChanged = true; }
    }
    if (lnChanged) n["linkedNodes"] = ln;

    // ── Clear parent that points to a missing node ───────────────────────────
    if (nodeId !== "ROOT" && n["parent"] && !nodeIds.has(n["parent"] as string)) {
      n["parent"] = null;
    }

    map[nodeId] = n;
  }

  // ── ROOT reconstruction fallback ─────────────────────────────────────────
  // If the AI omits ROOT entirely, synthesise a minimal one so the canvas has
  // something to anchor to. Prefer nodes whose parent field already says "ROOT";
  // if none exist, collect all nodes with no valid parent (truly orphaned).
  if (!map["ROOT"]) {
    console.warn("[repairCraftState] ROOT node missing — synthesising from orphaned nodes");
    const childrenOfRoot: string[] = [];
    const orphans: string[] = [];
    for (const [id, node] of Object.entries(map)) {
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      if (n["parent"] === "ROOT") {
        childrenOfRoot.push(id);
      } else if (!n["parent"] || !nodeIds.has(n["parent"] as string)) {
        orphans.push(id);
      }
    }
    const rootChildren = childrenOfRoot.length > 0 ? childrenOfRoot : orphans;
    for (const id of rootChildren) {
      const n = map[id] as Record<string, unknown>;
      map[id] = { ...n, parent: "ROOT" };
    }
    map["ROOT"] = {
      type: { resolvedName: "AstryxSection" },
      displayName: "Root",
      props: {},
      nodes: rootChildren,
      linkedNodes: {},
      parent: null,
      hidden: false,
      isCanvas: true,
      custom: {},
    };
  }

  return map;
}

// ─── Unreachable-node pruner ──────────────────────────────────────────────────
/**
 * Returns a state map containing only nodes reachable from ROOT through the
 * `nodes` and `linkedNodes` adjacency lists.  Disconnected "ghost" artboards
 * (nodes that exist in the map but are never referenced by any ancestor) are
 * silently dropped so they cannot appear as blank canvases.
 *
 * This mirrors the client-side pruneUnreachableCraftNodes in craftValidator.ts.
 * Call it in the PATCH handler after repairCraftState so the pruning never
 * races with an in-flight client edit.
 */
export function pruneUnreachableCraftNodes(state: unknown): unknown {
  if (!state || typeof state !== "object") return state;
  const map = state as Record<string, unknown>;

  const root = map["ROOT"] as Record<string, unknown> | undefined;
  if (!root || typeof root !== "object") return state;

  const reachable = new Set<string>(["ROOT"]);
  const queue = ["ROOT"];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = map[id] as Record<string, unknown> | undefined;
    if (!node || typeof node !== "object") continue;
    const children: unknown[] = [
      ...(Array.isArray(node.nodes) ? (node.nodes as unknown[]) : []),
      ...Object.values(
        node.linkedNodes && typeof node.linkedNodes === "object"
          ? (node.linkedNodes as Record<string, unknown>)
          : {},
      ),
    ];
    for (const childId of children) {
      if (typeof childId === "string" && childId in map && !reachable.has(childId)) {
        reachable.add(childId);
        queue.push(childId);
      }
    }
  }

  if (reachable.size === Object.keys(map).length) return state; // nothing to prune
  return Object.fromEntries(Object.entries(map).filter(([id]) => reachable.has(id)));
}
