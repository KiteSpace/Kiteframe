export type LayoutSizingNode = {
  /** Parent id in the *serialized* craft state shape. */
  parent?: string | null;
  data?: {
    /** Parent id in the *live* craft.js editor state shape (state.nodes). */
    parent?: string | null;
    displayName?: string;
    props?: Record<string, any>;
  };
};

/**
 * Reads a node's parent id from either craft.js state shape.
 * The live editor state (`useEditor(state => state.nodes)`) stores the parent
 * at `node.data.parent`, while the serialized state (`query.serialize()`)
 * stores it at the top level as `node.parent`. Eligibility checks must accept
 * both, or live-editor selections all look parentless.
 */
function getParentId(node: LayoutSizingNode): string | null {
  return node.data?.parent ?? node.parent ?? null;
}

export type EqualWidthSelectionResult =
  | { eligible: true; parentId: string }
  | { eligible: false; reason: string };

export type EqualHeightSelectionResult =
  | { eligible: true; parentId: string }
  | { eligible: false; reason: string };

const ROW_CONTAINER_TYPES = new Set(["AstryxArtboard", "AstryxHStack"]);

function isRowContainer(node: LayoutSizingNode | undefined): boolean {
  if (!node) return false;
  const displayName = node.data?.displayName;
  if (displayName === "AstryxHStack") return true;
  return (
    (displayName === "AstryxArtboard" || displayName === "AstryxSection") &&
    node.data?.props?.direction === "row"
  );
}

export function getEqualWidthSelectionResult(
  nodes: Record<string, LayoutSizingNode>,
  selectedIds: string[],
): EqualWidthSelectionResult {
  if (selectedIds.length < 2) {
    return { eligible: false, reason: "Select at least two elements." };
  }

  const selectedNodes = selectedIds.map((id) => nodes[id]);
  if (selectedNodes.some((node) => !node)) {
    return { eligible: false, reason: "The selection contains an unavailable element." };
  }

  // Artboards live on the canvas surface (ROOT), which is not a flex row and
  // AstryxArtboard does not consume flex sizing props — the action would
  // silently do nothing, so keep it disabled for artboard selections.
  if (selectedNodes.some((node) => node.data?.displayName === "AstryxArtboard")) {
    return { eligible: false, reason: "Equal widths apply to elements inside a screen, not to screens." };
  }

  const parentIds = new Set(selectedNodes.map((node) => getParentId(node)));
  if (parentIds.size !== 1 || parentIds.has(null)) {
    return { eligible: false, reason: "Select elements from the same container." };
  }

  if (parentIds.has("ROOT")) {
    return { eligible: false, reason: "Equal widths apply to elements inside a screen, not to screens." };
  }

  if (selectedNodes.some((node) => node.data?.props?.position === "absolute")) {
    return { eligible: false, reason: "Equal widths require flow-positioned elements." };
  }

  const parentId = getParentId(selectedNodes[0]) as string;
  const parent = nodes[parentId];
  if (!isRowContainer(parent)) {
    return { eligible: false, reason: "Equal widths require a row-oriented container." };
  }

  return { eligible: true, parentId };
}

export function getEqualWidthFlexProps(): Record<string, number> {
  return {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  };
}

/**
 * Mutates a node's props to apply equal-width flex sizing.
 * Clears any explicit width so the flex algorithm controls the size —
 * an explicit width always takes precedence over flex sizing in the
 * renderer, which is what lets a later manual resize opt back out.
 */
export function applyEqualWidthProps(props: Record<string, any>): void {
  Object.assign(props, getEqualWidthFlexProps());
  delete props.width;
}

export function isEqualWidthFlexProps(props: Record<string, any> | undefined): boolean {
  return props?.flexGrow === 1 && props?.flexShrink === 1 && props?.flexBasis === 0;
}

/**
 * Removes flex sizing props from a node so an explicit width takes effect
 * again. The renderer suppresses `width` whenever `flexBasis` is set, so any
 * manual width change (inspector input or drag-resize) must call this or the
 * new width would be silently ignored.
 */
export function clearFlexSizingProps(props: Record<string, any>): void {
  if (props.flexBasis === undefined && props.flexGrow === undefined && props.flexShrink === undefined) {
    return;
  }
  delete props.flexGrow;
  delete props.flexShrink;
  delete props.flexBasis;
}

// ─── Equal-height helpers (column containers) ────────────────────────────────

function isColumnContainer(node: LayoutSizingNode | undefined): boolean {
  if (!node) return false;
  const displayName = node.data?.displayName;
  // AstryxStack is always column
  if (displayName === "AstryxStack") return true;
  // AstryxSection / AstryxArtboard default to column; explicit "column" also qualifies
  if (displayName === "AstryxSection" || displayName === "AstryxArtboard") {
    const dir = node.data?.props?.direction;
    return dir === "column" || dir == null;
  }
  return false;
}

export function getEqualHeightSelectionResult(
  nodes: Record<string, LayoutSizingNode>,
  selectedIds: string[],
): EqualHeightSelectionResult {
  if (selectedIds.length < 2) {
    return { eligible: false, reason: "Select at least two elements." };
  }

  const selectedNodes = selectedIds.map((id) => nodes[id]);
  if (selectedNodes.some((node) => !node)) {
    return { eligible: false, reason: "The selection contains an unavailable element." };
  }

  // Artboards live on the canvas surface (ROOT), which is not a flex column and
  // AstryxArtboard does not consume flex sizing props — the action would
  // silently do nothing, so keep it disabled for artboard selections.
  if (selectedNodes.some((node) => node.data?.displayName === "AstryxArtboard")) {
    return { eligible: false, reason: "Equal heights apply to elements inside a screen, not to screens." };
  }

  const parentIds = new Set(selectedNodes.map((node) => getParentId(node)));
  if (parentIds.size !== 1 || parentIds.has(null)) {
    return { eligible: false, reason: "Select elements from the same container." };
  }

  if (parentIds.has("ROOT")) {
    return { eligible: false, reason: "Equal heights apply to elements inside a screen, not to screens." };
  }

  if (selectedNodes.some((node) => node.data?.props?.position === "absolute")) {
    return { eligible: false, reason: "Equal heights require flow-positioned elements." };
  }

  const parentId = getParentId(selectedNodes[0]) as string;
  const parent = nodes[parentId];
  if (!isColumnContainer(parent)) {
    return { eligible: false, reason: "Equal heights require a column-oriented container." };
  }

  return { eligible: true, parentId };
}

export function getEqualHeightFlexProps(): Record<string, number> {
  return {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  };
}

/**
 * Mutates a node's props to apply equal-height flex sizing.
 * Clears any explicit height so the flex algorithm controls the size —
 * an explicit height always takes precedence over flex sizing in the
 * renderer, which is what lets a later manual resize opt back out.
 */
export function applyEqualHeightProps(props: Record<string, any>): void {
  Object.assign(props, getEqualHeightFlexProps());
  delete props.height;
}

export function isEqualHeightFlexProps(props: Record<string, any> | undefined): boolean {
  return props?.flexGrow === 1 && props?.flexShrink === 1 && props?.flexBasis === 0;
}