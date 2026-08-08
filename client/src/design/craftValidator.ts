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

  // ── ROOT reconstruction fallback ─────────────────────────────────────────
  // If the AI omits ROOT entirely, synthesise a minimal one so the canvas has
  // something to anchor to. Prefer nodes whose parent field already says "ROOT";
  // if none exist, collect all nodes that have no valid parent (truly orphaned).
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
    // Set every adopted child's parent to ROOT
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

  // ── Orphan reattachment ──────────────────────────────────────────────────
  // The AI sometimes emits nodes (including whole artboard subtrees) whose
  // `parent` field is set but which are missing from that parent's `nodes`
  // array. Reachability-based pruning would silently delete that valid
  // content, producing a blank canvas. Reattach every unreferenced node to
  // its declared parent (or ROOT as a fallback) BEFORE any pruning runs.
  // Genuinely empty disconnected artboards ("ghosts" from the old bug) are
  // deliberately left alone so the ghost-cleanup prune can still remove them.
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
    // are the legacy "ghost" blank canvases the on-open prune cleans up.
    for (const nodeId of Object.keys(map)) {
      if (!isOrphan(nodeId) || resolvedNameOf(nodeId) !== "AstryxArtboard") continue;
      const n = map[nodeId] as Record<string, unknown>;
      const childCount = Array.isArray(n["nodes"]) ? (n["nodes"] as unknown[]).length : 0;
      if (childCount === 0) continue;
      reattach(nodeId);
    }
  }

  // ── Artboard enforcement ─────────────────────────────────────────────────
  // ROOT's direct children must be AstryxArtboard nodes. If the AI emits
  // ROOT → AstryxSection/Stack/etc → content (omitting the artboard wrapper),
  // synthesise a "Screen 1" artboard and re-parent the orphan children under
  // it so the canvas always has the required ROOT → AstryxArtboard → content
  // hierarchy before craft.js deserializes the state.
  const rootNodeEntry = map["ROOT"] as Record<string, unknown> | undefined;
  if (rootNodeEntry && Array.isArray(rootNodeEntry["nodes"])) {
    const rootChildren = rootNodeEntry["nodes"] as string[];
    const artboardIds: string[] = [];
    const nonArtboardIds: string[] = [];

    for (const id of rootChildren) {
      const node = map[id];
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      const resolvedName = (n["type"] as Record<string, unknown> | undefined)?.["resolvedName"];
      if (resolvedName === "AstryxArtboard") {
        artboardIds.push(id);
      } else {
        nonArtboardIds.push(id);
      }
    }

    if (nonArtboardIds.length > 0) {
      const artboardId = `kf_ab_${Math.random().toString(36).slice(2, 8)}`;
      console.warn(
        `[repairCraftState] Wrapping ${nonArtboardIds.length} non-artboard ROOT child(ren) in synthesised artboard "${artboardId}"`,
      );
      for (const id of nonArtboardIds) {
        const n = map[id] as Record<string, unknown>;
        map[id] = { ...n, parent: artboardId };
      }
      map[artboardId] = {
        type: { resolvedName: "AstryxArtboard" },
        isCanvas: true,
        props: { label: "Screen 1", direction: "column", gap: 16, padding: 24 },
        displayName: "AstryxArtboard",
        custom: {},
        parent: "ROOT",
        hidden: false,
        nodes: nonArtboardIds,
        linkedNodes: {},
      };
      map["ROOT"] = { ...rootNodeEntry, nodes: [artboardId, ...artboardIds] };
    }
  }

  return map;
}

/**
 * JSON-string convenience wrapper around repairCraftState. Returns the input
 * unchanged when it cannot be parsed. Use this before any reachability-based
 * pruning so orphaned-but-valid content is reattached instead of deleted.
 */
export function repairCraftStateJson(craftStateJson: string): string {
  try {
    const parsed = JSON.parse(craftStateJson);
    return JSON.stringify(repairCraftState(parsed));
  } catch {
    return craftStateJson;
  }
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

  // ROOT.nodes is the authoritative Craft.js tree. Reconcile direct children
  // against it so stale parent pointers cannot turn disconnected AI nodes into
  // visible canvas artifacts. Nodes listed in ROOT are reparented to ROOT;
  // nodes merely claiming ROOT as parent remain disconnected until a generation
  // explicitly includes them in the tree.
  const rootEntry = map["ROOT"] as Record<string, unknown> | undefined;
  if (rootEntry && Array.isArray(rootEntry.nodes)) {
    const rootNodes = (rootEntry.nodes as string[]).filter(
      (id, index, all) => typeof id === "string" && id in map && all.indexOf(id) === index,
    );
    if (rootNodes.length !== (rootEntry.nodes as string[]).length) {
      map["ROOT"] = { ...rootEntry, nodes: rootNodes };
      changed = true;
    }
    for (const id of rootNodes) {
      const node = map[id];
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      if (n.parent !== "ROOT") {
        map[id] = { ...n, parent: "ROOT" };
        changed = true;
      }
    }
    if (rootNodes.length > 0) {
      const rootNodeSet = new Set(rootNodes);
      for (const [id, node] of Object.entries(map)) {
        if (id === "ROOT" || rootNodeSet.has(id) || !node || typeof node !== "object") continue;
        const n = node as Record<string, unknown>;
        if (n.parent === "ROOT") {
          map[id] = { ...n, parent: null };
          changed = true;
        }
      }
    }
  }

  return changed ? JSON.stringify(map) : craftStateJson;
}

// ─── Disconnected artboard detector ──────────────────────────────────────────
/**
 * Inspects a craft state and returns the labels (or IDs) of AstryxArtboard
 * nodes that exist in the map but are NOT reachable from ROOT via the `nodes`
 * / `linkedNodes` tree.  These are the "ghost" artboards that appear as blank
 * canvases when a design was saved before the pruning safeguard was in place.
 *
 * Returns an empty array when the state is healthy — safe to call on every
 * design open without changing anything.
 */
export function detectDisconnectedArtboards(craftStateJson: string): { id: string; label: string }[] {
  let map: Record<string, unknown>;
  try {
    map = JSON.parse(craftStateJson) as Record<string, unknown>;
  } catch {
    return [];
  }

  // Build the reachable set (same BFS as pruneUnreachableCraftNodes).
  const root = map["ROOT"] as Record<string, unknown> | undefined;
  if (!root || typeof root !== "object") return [];

  const reachable = new Set<string>(["ROOT"]);
  const queue = ["ROOT"];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = map[id] as Record<string, unknown> | undefined;
    if (!node || typeof node !== "object") continue;
    const children = [
      ...(Array.isArray(node.nodes) ? (node.nodes as string[]) : []),
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

  // Collect AstryxArtboard nodes that were not reached.
  const disconnected: { id: string; label: string }[] = [];
  for (const [id, node] of Object.entries(map)) {
    if (reachable.has(id) || !node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    const resolvedName = (n["type"] as Record<string, unknown> | undefined)?.["resolvedName"];
    if (resolvedName === "AstryxArtboard") {
      const props = n["props"] as Record<string, unknown> | undefined;
      const label =
        typeof props?.["label"] === "string" && props["label"].trim()
          ? props["label"]
          : id;
      disconnected.push({ id, label });
    }
  }

  return disconnected;
}

/**
 * Returns a state containing only nodes reachable from ROOT through `nodes`
 * and `linkedNodes`. Fresh full-state AI generations use this before
 * persistence so disconnected canvas nodes cannot render as ghost artboards.
 */
export function pruneUnreachableCraftNodes(craftStateJson: string): string {
  let map: Record<string, unknown>;
  try {
    map = JSON.parse(craftStateJson) as Record<string, unknown>;
  } catch {
    return craftStateJson;
  }

  const root = map["ROOT"] as Record<string, unknown> | undefined;
  if (!root || typeof root !== "object") return craftStateJson;

  const reachable = new Set<string>(["ROOT"]);
  const queue = ["ROOT"];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = map[id] as Record<string, unknown> | undefined;
    if (!node || typeof node !== "object") continue;
    const children = [
      ...(Array.isArray(node.nodes) ? node.nodes : []),
      ...Object.values(
        node.linkedNodes && typeof node.linkedNodes === "object"
          ? node.linkedNodes as Record<string, unknown>
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

  if (reachable.size === Object.keys(map).length) return craftStateJson;
  const pruned = Object.fromEntries(
    Object.entries(map).filter(([id]) => reachable.has(id)),
  );
  return JSON.stringify(pruned);
}
