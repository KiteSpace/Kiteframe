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

// ─── ROOT container contract ─────────────────────────────────────────────────
// ROOT is craft.js's immutable canvas container and must always resolve to a
// real *container* component. A non-container ROOT (an artboard, craft.js's own
// literal "Root", a hallucinated name, or the AstryxUnknown leaf placeholder)
// renders none of its children — the entire design silently disappears even
// though every node is still present and correctly parented in the state map.
// Must stay in sync with ROOT_CONTAINER_COMPONENTS in client/src/design/craftValidator.ts.
export const ROOT_CONTAINER_COMPONENTS: readonly string[] = [
  "AstryxSection",
  "AstryxStack",
  "AstryxHStack",
];

// Components whose ONLY valid semantic is "container". craft.js reads `isCanvas`
// from the stored node state, not from the component's static .craft config, so a
// generator that omits or falsifies the field produces a node that renders none of
// its children — the content is still in the node map and the layers panel, but the
// canvas shows an empty box. Enforce the field for every one of these on repair.
// Must stay in sync with ALWAYS_CANVAS_COMPONENTS in client/src/design/craftValidator.ts
// and with the "Containers (isCanvas:true)" line in server/lib/designPrompt.ts.
export const ALWAYS_CANVAS_COMPONENTS: readonly string[] = [
  "AstryxArtboard",
  "AstryxSection",
  "AstryxStack",
  "AstryxHStack",
  "AstryxCard",
  "AstryxList",
  "AstryxGrid",
  "AstryxFormLayout",
  "AstryxField",
  "AstryxInputGroup",
  "AstryxFieldStatus",
  "AstryxOverlay",
];

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
  // Form structure (containers)
  "AstryxField",
  "AstryxFieldStatus",
  "AstryxFormLayout",
  "AstryxInputGroup",
  "AstryxGrid",
  // Form inputs
  "AstryxTextArea",
  "AstryxSwitch",
  "AstryxNumberInput",
  "AstryxToggleButton",
  "AstryxSegmentedControl",
  "AstryxCheckboxList",
  "AstryxIconButton",
  // Date & time inputs
  "AstryxDateInput",
  "AstryxTimeInput",
  "AstryxDateTimeInput",
  "AstryxDateRangeInput",
  // File input
  "AstryxFileInput",
  // Advanced selection & search
  "AstryxTypeahead",
  "AstryxMultiSelector",
  "AstryxComplexSelector",
  "AstryxPowerSearch",
  "AstryxTokenizer",
  // Navigation
  "AstryxNavbar",
  "AstryxSidebar",
  "AstryxBreadcrumb",
  // Overlays
  "AstryxModal",
  "AstryxDrawer",
  "AstryxSheet",
  // Anchored overlays
  "AstryxPopover",
  "AstryxTooltip",
  "AstryxHoverCard",
  // Menus
  "AstryxDropdownMenu",
  "AstryxContextMenu",
  "AstryxMoreMenu",
  // Dialogs & surfaces
  "AstryxAlertDialog",
  "AstryxToast",
  "AstryxLightbox",
  "AstryxOverlay",
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
/** What repairCraftState had to change, for reporting back to the caller. */
export interface CraftRepairReport {
  /** Original names of components replaced by the placeholder, de-duplicated. */
  substitutedComponents: string[];
  /** Nodes that arrived with no usable type at all and were given the placeholder. */
  typelessNodeIds: string[];
}

export interface CraftRepairResult {
  state: unknown;
  report: CraftRepairReport;
}

export function repairCraftState(state: unknown): unknown {
  return repairCraftStateWithReport(state).state;
}

export function repairCraftStateWithReport(state: unknown): CraftRepairResult {
  const substitutedComponents: string[] = [];
  const typelessNodeIds: string[] = [];
  const report = (): CraftRepairReport => ({
    substitutedComponents: Array.from(new Set(substitutedComponents)),
    typelessNodeIds,
  });

  if (!state || typeof state !== "object") return { state, report: report() };
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
    if (!n["type"] || typeof n["type"] !== "object" || Array.isArray(n["type"])) {
      // Can't recover a node with no type — mark as unknown so it renders as a placeholder
      n["type"] = { resolvedName: "AstryxUnknown" };
      typelessNodeIds.push(nodeId);
    } else {
      // Clone: `n` is a shallow copy, so its `type` still aliases the input.
      n["type"] = { ...(n["type"] as Record<string, unknown>) };
    }
    const typeObj = n["type"] as Record<string, unknown>;
    if (typeof typeObj["resolvedName"] !== "string" || !typeObj["resolvedName"]) {
      typeObj["resolvedName"] = "AstryxUnknown";
      if (!typelessNodeIds.includes(nodeId)) typelessNodeIds.push(nodeId);
    }

    // ── Sanitize unknown component types ────────────────────────────────────
    // The AJV schema uses a strict enum; any hallucinated name causes a 422.
    // Replace with AstryxUnknown so the canvas renders a placeholder instead.
    // This MUST run before displayName is derived so the display name always
    // reflects the final, validated resolved name.
    //
    // ROOT is deliberately exempt: AstryxUnknown is a leaf placeholder that
    // renders no children, so demoting ROOT to it blanks the whole canvas even
    // though every node survives in the state map. ROOT is normalized to a real
    // container after this loop instead (see ROOT type normalization below).
    const resolvedName = typeObj["resolvedName"] as string;
    if (nodeId !== "ROOT" && resolvedName !== "AstryxUnknown" && !allowedSet.has(resolvedName)) {
      console.warn(
        `[repairCraftState] Unknown component "${resolvedName}" on node "${nodeId}" — replacing with AstryxUnknown`,
      );
      typeObj["resolvedName"] = "AstryxUnknown";
      const existingProps =
        n["props"] && typeof n["props"] === "object" && !Array.isArray(n["props"])
          ? (n["props"] as Record<string, unknown>)
          : {};
      // The placeholder renders this name, so the user can see what was swapped.
      n["props"] = { ...existingProps, astryxComponent: resolvedName };
      n["displayName"] = "AstryxUnknown";
      substitutedComponents.push(resolvedName);
    }

    // ── A placeholder keeps the container-ness of what it replaced ──────────
    // If the missing component was a container, forcing a leaf here hides its
    // entire subtree — the same whole-design loss this fallback exists to
    // prevent, one level down. The placeholder renders its children, so the
    // content survives inside a clearly marked gap.
    //
    // Applied to every placeholder node, not just freshly substituted ones, so
    // designs saved while the placeholder was leaf-only get their hidden
    // subtrees back the next time they are opened.
    if (typeObj["resolvedName"] === "AstryxUnknown") {
      n["isCanvas"] = Array.isArray(n["nodes"]) && (n["nodes"] as unknown[]).length > 0;
    }

    // `hidden`      — normalize any non-boolean (absent, null, "false", 1…)
    //                 to a proper false so the schema's required-boolean check
    //                 never rejects the node.
    // `custom`      — Craft.js spreads this onto the node's user-data bag;
    //                 absent/non-object → crashes the resolver on first access.
    // `displayName` — Used by Craft.js in the layers panel and during drag-
    //                 drop; must be a string, defaulting to the final resolved
    //                 name (set AFTER sanitization so it is always consistent).
    if (typeof n["hidden"] !== "boolean") n["hidden"] = false;
    if (!n["custom"] || typeof n["custom"] !== "object" || Array.isArray(n["custom"])) {
      n["custom"] = {};
    }
    if (typeof n["displayName"] !== "string") {
      n["displayName"] = typeObj["resolvedName"] as string;
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
      // Must match the resolved name. A displayName of "Root" round-trips back
      // through craft.js's reverse resolver lookup as a literal "Root" type,
      // which is not a known component and gets demoted to a non-container
      // placeholder — blanking the canvas.
      displayName: "AstryxSection",
      props: {},
      nodes: rootChildren,
      linkedNodes: {},
      parent: null,
      hidden: false,
      isCanvas: true,
      custom: {},
    };
  }

  // ── ROOT type normalization ──────────────────────────────────────────────
  // ROOT must always resolve to a real container component. If it arrives as
  // an artboard, craft.js's literal "Root", a hallucinated name, or with
  // isCanvas unset, the canvas renders none of its children even though every
  // node is present and correctly parented. Runs after the per-node loop (which
  // deliberately skips ROOT) and after the reconstruction fallback, so an
  // existing-but-invalid ROOT is always corrected.
  {
    const root = map["ROOT"] as Record<string, unknown> | undefined;
    if (root && typeof root === "object") {
      const rootType = root["type"];
      const resolvedName =
        rootType && typeof rootType === "object"
          ? (rootType as Record<string, unknown>)["resolvedName"]
          : undefined;
      const typeIsValid =
        typeof resolvedName === "string" && ROOT_CONTAINER_COMPONENTS.includes(resolvedName);
      const isCanvasValid = root["isCanvas"] === true;

      if (!typeIsValid || !isCanvasValid) {
        const existingProps =
          root["props"] && typeof root["props"] === "object"
            ? (root["props"] as Record<string, unknown>)
            : {};
        const patch: Record<string, unknown> = { ...root, isCanvas: true };
        if (!typeIsValid) {
          const { label: removedLabel, astryxComponent: _dropped, ...sanitizedProps } = existingProps;
          console.warn(
            `[repairCraftState] ROOT.type was "${String(resolvedName ?? "(missing)")}"${
              removedLabel !== undefined ? ` (label=${String(removedLabel)})` : ""
            } — corrected to AstryxSection so the canvas renders its children`,
          );
          patch["type"] = { resolvedName: "AstryxSection" };
          patch["displayName"] = "AstryxSection";
          patch["props"] = sanitizedProps;
        } else {
          console.warn("[repairCraftState] Enforcing isCanvas:true on ROOT");
        }
        map["ROOT"] = patch;
      }
    }
  }

  // ── isCanvas enforcement for container components ────────────────────────
  // Craft.js reads `isCanvas` from the stored node state to decide whether a
  // node renders its children. If absent or false on a container, the canvas
  // shows a blank "Container" box even though children exist and the layers
  // panel shows them correctly. Enforce the field here so designs saved via the
  // workflow-bridge or any external path always have a valid value.
  // See ALWAYS_CANVAS_COMPONENTS for why these names are always containers.
  for (const [nodeId, node] of Object.entries(map)) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    const resolvedName = (n["type"] as Record<string, unknown> | undefined)?.["resolvedName"];
    if (typeof resolvedName === "string" && ALWAYS_CANVAS_COMPONENTS.includes(resolvedName) && n["isCanvas"] !== true) {
      console.warn(`[repairCraftState] Enforcing isCanvas:true on ${resolvedName} node "${nodeId}"`);
      map[nodeId] = { ...n, isCanvas: true };
    }
  }

  // ── Orphan reattachment (mirrors client craftValidator.repairCraftState) ──
  // The AI sometimes emits nodes (including whole artboard subtrees) whose
  // `parent` field is set but which are missing from that parent's `nodes`
  // array. Reachability-based pruning would silently delete that valid
  // content, producing a blank canvas. Reattach every unreferenced node to
  // its declared parent (or ROOT as a fallback) BEFORE any pruning runs.
  // Genuinely empty disconnected artboards ("ghosts") are deliberately left
  // alone so ghost-cleanup pruning can still remove them.
  {
    const referenced = new Set<string>();
    for (const node of Object.values(map)) {
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      if (Array.isArray(n["nodes"])) {
        for (const id of n["nodes"] as unknown[]) {
          if (typeof id === "string") referenced.add(id);
        }
      }
      if (n["linkedNodes"] && typeof n["linkedNodes"] === "object") {
        for (const id of Object.values(n["linkedNodes"] as Record<string, unknown>)) {
          if (typeof id === "string") referenced.add(id);
        }
      }
    }

    const reattach = (nodeId: string) => {
      const n = map[nodeId] as Record<string, unknown>;
      const declaredParent = typeof n["parent"] === "string" ? (n["parent"] as string) : null;
      const parentId = declaredParent && nodeIds.has(declaredParent) ? declaredParent : "ROOT";
      const parentNode = map[parentId] as Record<string, unknown> | undefined;
      if (!parentNode || typeof parentNode !== "object") return;
      const parentChildren = Array.isArray(parentNode["nodes"])
        ? [...(parentNode["nodes"] as string[])]
        : [];
      console.warn(
        `[repairCraftState] Reattaching orphaned node "${nodeId}" to parent "${parentId}"`,
      );
      parentChildren.push(nodeId);
      map[parentId] = { ...parentNode, nodes: parentChildren };
      if (parentId !== declaredParent) {
        // Re-read from the map — this node may have been updated already
        // (e.g. children appended to it as a parent).
        map[nodeId] = { ...(map[nodeId] as Record<string, unknown>), parent: parentId };
      }
      referenced.add(nodeId);
    };

    const isOrphan = (nodeId: string) =>
      nodeId !== "ROOT" && !referenced.has(nodeId) && !!map[nodeId] && typeof map[nodeId] === "object";
    const resolvedNameOf = (nodeId: string) =>
      ((map[nodeId] as Record<string, unknown>)["type"] as Record<string, unknown> | undefined)?.["resolvedName"];

    // Pass 1: non-artboard orphans — attaching them may repopulate an
    // artboard whose own `nodes` array was also broken.
    for (const nodeId of Object.keys(map)) {
      if (!isOrphan(nodeId) || resolvedNameOf(nodeId) === "AstryxArtboard") continue;
      reattach(nodeId);
    }
    // Pass 2: artboard orphans — skip only artboards STILL empty now, which
    // are the legacy "ghost" blank canvases that pruning cleans up.
    for (const nodeId of Object.keys(map)) {
      if (!isOrphan(nodeId) || resolvedNameOf(nodeId) !== "AstryxArtboard") continue;
      const n = map[nodeId] as Record<string, unknown>;
      const childCount = Array.isArray(n["nodes"]) ? (n["nodes"] as unknown[]).length : 0;
      if (childCount === 0) continue;
      reattach(nodeId);
    }
  }

  return { state: map, report: report() };
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

/**
 * Compact diagnostic summary of a craft state's artboard structure, used by
 * the "[artboard-trace]" lifecycle logging around interface generation and
 * design persistence. Mirrors the client-side summarizeArtboards in
 * craftValidator.ts so the client and server logs are directly comparable.
 */
export function summarizeArtboards(state: unknown): {
  totalNodes: number;
  rootNodes: string[];
  artboards: { id: string; label: string; parent: unknown; childCount: number; inRootNodes: boolean; empty: boolean; reachable: boolean }[];
} {
  if (!state || typeof state !== "object") return { totalNodes: 0, rootNodes: [], artboards: [] };
  const map = state as Record<string, unknown>;
  const root = map["ROOT"] as Record<string, unknown> | undefined;
  const rootNodes = Array.isArray(root?.nodes) ? (root!.nodes as string[]) : [];

  // Reachability BFS (same traversal as pruneUnreachableCraftNodes).
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

  const artboards: { id: string; label: string; parent: unknown; childCount: number; inRootNodes: boolean; empty: boolean; reachable: boolean }[] = [];
  for (const [id, node] of Object.entries(map)) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    if ((n["type"] as Record<string, unknown> | undefined)?.["resolvedName"] !== "AstryxArtboard") continue;
    const props = n["props"] as Record<string, unknown> | undefined;
    const children = Array.isArray(n["nodes"]) ? (n["nodes"] as string[]) : [];
    artboards.push({
      id,
      label: typeof props?.["label"] === "string" ? (props["label"] as string) : id,
      parent: n["parent"],
      childCount: children.length,
      inRootNodes: rootNodes.includes(id),
      empty: children.length === 0,
      reachable: reachable.has(id),
    });
  }
  return { totalNodes: Object.keys(map).length, rootNodes, artboards };
}
