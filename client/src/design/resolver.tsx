import { useNode, useEditor } from "@craftjs/core";
import { useEffect, useRef, useContext, useCallback, createContext, useState, type CSSProperties } from "react";
import {
  ALLOWED_CRAFT_COMPONENTS,
  validateCraftState,
  sanitizeCraftState,
} from "./craftValidator";
export type { CraftStateValidationResult } from "./craftValidator";
export { ALLOWED_CRAFT_COMPONENTS, validateCraftState, sanitizeCraftState };
import {
  AstryxButton as AstryxButtonBase,

  AstryxText as AstryxTextBase,
  AstryxTextInput as AstryxTextInputBase,
  AstryxSection as AstryxSectionBase,
  AstryxHeading as AstryxHeadingBase,
  AstryxBadge as AstryxBadgeBase,
  AstryxAvatar as AstryxAvatarBase,
  AstryxSpinner as AstryxSpinnerBase,
  AstryxDivider as AstryxDividerBase,
  AstryxProgressBar as AstryxProgressBarBase,
  AstryxStatusDot as AstryxStatusDotBase,
  AstryxSkeleton as AstryxSkeletonBase,
  AstryxBanner as AstryxBannerBase,
  AstryxEmptyState as AstryxEmptyStateBase,
  AstryxChatMessage as AstryxChatMessageBase,
  AstryxToken as AstryxTokenBase,
  AstryxStack as AstryxStackBase,
  AstryxHStack as AstryxHStackBase,
  AstryxIcon as AstryxIconBase,
  AstryxUnknown as AstryxUnknownBase,
  AstryxTable as AstryxTableBase,
  AstryxTabs as AstryxTabsBase,
  AstryxAccordion as AstryxAccordionBase,
  AstryxSelect as AstryxSelectBase,
  AstryxCheckbox as AstryxCheckboxBase,
  AstryxRadioGroup as AstryxRadioGroupBase,
  AstryxSlider as AstryxSliderBase,
  AstryxCalendar as AstryxCalendarBase,
  AstryxCommand as AstryxCommandBase,
  AstryxCarousel as AstryxCarouselBase,
  AstryxResizable as AstryxResizableBase,
} from "@/components/astryx";

// Canvas zoom context — InfiniteCanvas provides the current scale so that
// absolutely-positioned nodes can convert raw mouse-delta pixels to canvas units.
export const CanvasZoomContext = createContext(1);

// Snap guide context — SnapGuideOverlay inside InfiniteCanvas subscribes; leaf
// nodes call this during absolute-position drag to show alignment guide lines.
// Value is a stable setter so it never triggers canvas-wide re-renders.
export type SnapGuideSetter = (h: number | null, v: number | null) => void;
export const SnapGuideContext = createContext<SnapGuideSetter>(() => {});

type AstryxProps = Record<string, any>;

// ─── Node element registry ────────────────────────────────────────────────────
// Maps craft.js node IDs → their rendered DOM elements so the drag handlers
// can measure sibling bounds without needing a separate DOM query.
const nodeElementRegistry = new Map<string, HTMLElement>();

// ─── Alignment guide helper ────────────────────────────────────────────────────
// Alignment guides — display-only, no snapping. Lines appear when the dragged
// node comes within ALIGN_THRESHOLD canvas-px of an alignment axis.
const ALIGN_THRESHOLD = 8;
function computeAlignmentGuides(
  nodeId: string,
  newX: number,
  newY: number,
  elRect: DOMRect,
  zoom: number,
  nodes: Record<string, any>,
): { vGuide: number | null; hGuide: number | null } {
  const nodeWidth  = elRect.width  / zoom;
  const nodeHeight = elRect.height / zoom;
  const nodeCenterX = newX + nodeWidth  / 2;
  const nodeCenterY = newY + nodeHeight / 2;

  let vGuide: number | null = null;
  let hGuide: number | null = null;

  try {
    const nodeData = nodes[nodeId];
    const parentId = nodeData?.parent;

    // 1. Artboard centre axes
    const artboardWidth = (parentId ? (nodes[parentId]?.props?.width as number) : undefined) ?? 390;
    const artboardCenterX = artboardWidth / 2;
    if (Math.abs(nodeCenterX - artboardCenterX) < ALIGN_THRESHOLD) {
      vGuide = artboardCenterX;
    }
    if (parentId) {
      const artboardEl = nodeElementRegistry.get(parentId);
      if (artboardEl) {
        const artboardRect = artboardEl.getBoundingClientRect();
        const artboardCenterY = (artboardRect.height / zoom) / 2;
        if (hGuide === null && Math.abs(nodeCenterY - artboardCenterY) < ALIGN_THRESHOLD) {
          hGuide = artboardCenterY;
        }
      }
    }

    // 2. Sibling absolute nodes — left/centre/right and top/middle/bottom
    if (parentId) {
      const siblingIds = (nodes[parentId]?.nodes ?? []) as string[];
      let bestVDist = ALIGN_THRESHOLD;
      let bestHDist = ALIGN_THRESHOLD;

      for (const sibId of siblingIds) {
        if (sibId === nodeId) continue;
        const sibProps = nodes[sibId]?.props;
        if (sibProps?.position !== "absolute") continue;
        const sibEl = nodeElementRegistry.get(sibId);
        if (!sibEl) continue;
        const sibRect = sibEl.getBoundingClientRect();
        const sibWidth  = sibRect.width  / zoom;
        const sibHeight = sibRect.height / zoom;
        const sibX = (sibProps.x as number) ?? 0;
        const sibY = (sibProps.y as number) ?? 0;
        const sibRight   = sibX + sibWidth;
        const sibCenterX = sibX + sibWidth  / 2;
        const sibBottom  = sibY + sibHeight;
        const sibCenterY = sibY + sibHeight / 2;

        const nodeRight  = newX + nodeWidth;
        const nodeBottom = newY + nodeHeight;

        // X-axis alignment: edges and centres
        for (const [dist, guide] of [
          [Math.abs(newX        - sibX),       sibX      ] as const,
          [Math.abs(newX        - sibCenterX), sibCenterX] as const,
          [Math.abs(newX        - sibRight),   sibRight  ] as const,
          [Math.abs(nodeCenterX - sibX),       sibX      ] as const,
          [Math.abs(nodeCenterX - sibCenterX), sibCenterX] as const,
          [Math.abs(nodeCenterX - sibRight),   sibRight  ] as const,
          [Math.abs(nodeRight   - sibX),       sibX      ] as const,
          [Math.abs(nodeRight   - sibCenterX), sibCenterX] as const,
          [Math.abs(nodeRight   - sibRight),   sibRight  ] as const,
        ]) {
          if (dist < bestVDist) { bestVDist = dist; vGuide = guide; }
        }

        // Y-axis alignment: edges and centres
        for (const [dist, guide] of [
          [Math.abs(newY        - sibY),       sibY      ] as const,
          [Math.abs(newY        - sibCenterY), sibCenterY] as const,
          [Math.abs(newY        - sibBottom),  sibBottom ] as const,
          [Math.abs(nodeCenterY - sibY),       sibY      ] as const,
          [Math.abs(nodeCenterY - sibCenterY), sibCenterY] as const,
          [Math.abs(nodeCenterY - sibBottom),  sibBottom ] as const,
          [Math.abs(nodeBottom  - sibY),       sibY      ] as const,
          [Math.abs(nodeBottom  - sibCenterY), sibCenterY] as const,
          [Math.abs(nodeBottom  - sibBottom),  sibBottom ] as const,
        ]) {
          if (dist < bestHDist) { bestHDist = dist; hGuide = guide; }
        }
      }
    }
  } catch { /* ignore any craft.js or DOM errors */ }

  return { vGuide, hGuide };
}

// ─── Shared visual constants ──────────────────────────────────────────────────

const EMPTY_DROP_STYLE: CSSProperties = {
  flex: 1,
  minHeight: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1.5px dashed #93c5fd",
  borderRadius: 6,
  background: "rgba(219,234,254,0.45)",
  fontSize: 11,
  color: "#3b82f6",
  opacity: 0.7,
  userSelect: "none",
  pointerEvents: "none",
};

const SELECTION_RING: CSSProperties = {
  outline: "2px solid #3b82f6",
  outlineOffset: 2,
};

function absPositionStyle(position: string, x: number, y: number): CSSProperties {
  if (position !== "absolute") return {};
  return { position: "absolute", left: x, top: y, zIndex: 10 };
}

// ─── Leaf node hook ───────────────────────────────────────────────────────────
// Provides drag/connect ref, selection ring, and absolute positioning for all
// leaf (non-canvas) components from a single hook.

const RADIUS_TOKEN: Record<string, number> = { None: 0, S: 4, M: 8, L: 16, Full: 9999 };

function useLeafNode() {
  const zoom = useContext(CanvasZoomContext);
  const setGuides = useContext(SnapGuideContext);
  const { id, connectors: { connect, drag }, actions, selected, nodePosition, nodeX, nodeY,
          nodeBg, nodeColor, nodeRadius, nodeWidth, nodeHeight } = useNode((node) => ({
    selected: node.events.selected,
    nodePosition: (node.data.props?.position as string) ?? "flow",
    nodeX: (node.data.props?.x as number) ?? 0,
    nodeY: (node.data.props?.y as number) ?? 0,
    nodeBg:     node.data.props?.backgroundColor as string | undefined,
    nodeColor:  node.data.props?.textColor as string | undefined,
    nodeRadius: node.data.props?.borderRadius as string | undefined,
    nodeWidth:  node.data.props?.width as number | string | undefined,
    nodeHeight: node.data.props?.height as number | string | undefined,
  }));
  const { query } = useEditor(() => ({}));

  const isAbsolute = nodePosition === "absolute";
  const elementRef = useRef<HTMLElement | null>(null);
  const dragStartRef = useRef<{ mx: number; my: number; sx: number; sy: number } | null>(null);
  const stateRef = useRef({ x: nodeX, y: nodeY, zoom, isAbsolute, setProp: actions.setProp });
  stateRef.current = { x: nodeX, y: nodeY, zoom, isAbsolute, setProp: actions.setProp };
  const queryRef = useRef(query);
  queryRef.current = query;
  const setGuidesRef = useRef(setGuides);
  setGuidesRef.current = setGuides;
  const nodeIdRef = useRef(id); // id is stable for a mounted node

  // Attach a single native mousedown listener on mount so we don't need to
  // touch every individual leaf component's JSX.
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    const handle = (e: MouseEvent) => {
      _dragOccurred = false; // reset on every mousedown (absolute or not)
      if (!stateRef.current.isAbsolute) return;
      const { x: sx, y: sy } = stateRef.current;
      dragStartRef.current = { mx: e.clientX, my: e.clientY, sx, sy };
      const onMove = (ev: MouseEvent) => {
        if (!dragStartRef.current) return;
        const { zoom: z, setProp } = stateRef.current;
        const rawDx = ev.clientX - dragStartRef.current.mx;
        const rawDy = ev.clientY - dragStartRef.current.my;
        if (Math.hypot(rawDx, rawDy) < 3) return;
        _dragOccurred = true; // movement exceeded threshold → real drag
        const dx = rawDx / z;
        const dy = rawDy / z;
        const newX = Math.round(dragStartRef.current.sx + dx);
        const newY = Math.round(dragStartRef.current.sy + dy);

        const elRect = elementRef.current?.getBoundingClientRect();
        if (elRect) {
          const nodes = queryRef.current.getSerializedNodes();
          const { vGuide, hGuide } = computeAlignmentGuides(
            nodeIdRef.current, newX, newY, elRect, z, nodes,
          );
          setGuidesRef.current(hGuide, vGuide);
          setProp((p: any) => { p.x = newX; p.y = newY; });
        } else {
          setGuidesRef.current(null, null);
          setProp((p: any) => { p.x = newX; p.y = newY; });
        }
      };
      const onUp = () => {
        dragStartRef.current = null;
        setGuidesRef.current(null, null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
    el.addEventListener("mousedown", handle);
    return () => el.removeEventListener("mousedown", handle);
  }, []); // register once on mount

  const resolvedRadius = nodeRadius !== undefined ? (RADIUS_TOKEN[nodeRadius] ?? 8) : undefined;
  const extraStyle: CSSProperties = {
    ...absPositionStyle(nodePosition, nodeX, nodeY),
    ...(selected ? SELECTION_RING : {}),
    ...(isAbsolute ? { cursor: "grab" } : {}),
    ...(nodeBg     ? { backgroundColor: nodeBg } : {}),
    ...(nodeColor  ? { color: nodeColor } : {}),
    // borderRadius applied to the wrapper so the selection ring matches the shape,
    // and overflow:hidden clips the inner component to the same corners.
    ...(resolvedRadius !== undefined ? { borderRadius: resolvedRadius, overflow: "hidden" } : {}),
    ...(nodeWidth  !== undefined && nodeWidth  !== "auto" ? { width: nodeWidth } : { width: "fit-content" }),
    ...(nodeHeight !== undefined && nodeHeight !== "auto" ? { height: nodeHeight } : {}),
  };

  // For absolute nodes we skip craft.js `drag` so no snap/alignment indicators
  // appear. Selection still works via `connect`.
  const connectRef = (r: HTMLElement | null) => {
    elementRef.current = r;
    if (r) {
      nodeElementRegistry.set(nodeIdRef.current, r);
      connect(r);
      if (!isAbsolute) drag(r);
    } else {
      nodeElementRegistry.delete(nodeIdRef.current);
    }
  };
  return { connectRef, extraStyle };
}

// Module-level flag: set true when an absolute-node drag exceeds the movement
// threshold. Cleared at the next mousedown. useInlineEdit checks it so a
// rapid double-drag never accidentally opens the text editor.
let _dragOccurred = false;

// ─── Inline text edit hook ────────────────────────────────────────────────────
// Double-click any text-bearing leaf to edit its text prop in place.
// Enter or blur commits; Escape discards. The wrapper must be position:relative.

function useInlineEdit(propKey: string, currentValue: string) {
  const { actions: { setProp } } = useNode(() => ({}));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft to external prop changes (e.g. AI rewrites) while not editing.
  useEffect(() => {
    if (!editing) setDraft(currentValue);
  }, [currentValue, editing]);

  // Auto-focus and select all text when entering edit mode.
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    const val = draft.trim();
    if (val) setProp((p: any) => { p[propKey] = val; });
    setEditing(false);
  }, [draft, propKey, setProp]);

  const discard = useCallback(() => {
    setDraft(currentValue);
    setEditing(false);
  }, [currentValue]);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Suppress edit mode if the user was dragging (mouse moved > threshold).
    if (_dragOccurred) return;
    setDraft(currentValue);
    setEditing(true);
  }, [currentValue]);

  const editOverlay = editing ? (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        if (e.key === "Escape") { e.stopPropagation(); discard(); }
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(255,255,255,0.95)",
        border: "none",
        outline: "2px solid #3b82f6",
        outlineOffset: 1,
        borderRadius: 3,
        padding: "0 4px",
        font: "inherit",
        color: "inherit",
        width: "100%",
        height: "100%",
        cursor: "text",
        zIndex: 100,
        boxSizing: "border-box",
      }}
    />
  ) : null;

  return { editing, onDoubleClick, editOverlay };
}

// ─── Container node hook ──────────────────────────────────────────────────────
// Shared logic for Section / Stack / HStack / Card — provides grey fill, blue
// selected treatment, drag-over highlight, and free-drag when position === "absolute".

function useContainerNode(position: string, x: number, y: number) {
  const zoom = useContext(CanvasZoomContext);
  const setGuides = useContext(SnapGuideContext);
  const { connectors: { connect, drag }, id, actions, isEmpty, selected, hovered } = useNode((node) => ({
    isEmpty: node.data.nodes.length === 0,
    selected: node.events.selected,
    hovered: node.events.hovered,
  }));

  // Detect whether any node is currently being dragged in the editor.
  const { query, isDragging } = useEditor((state) => ({
    isDragging: state.events.dragged.size > 0,
  }));

  // True when the user is dragging something over this container.
  const isDragOver = isDragging && hovered;

  const isAbsolute = position === "absolute";
  const elementRef = useRef<HTMLElement | null>(null);
  const dragStartRef = useRef<{ mx: number; my: number; sx: number; sy: number } | null>(null);
  const stateRef = useRef({ x, y, zoom, isAbsolute, setProp: actions.setProp });
  stateRef.current = { x, y, zoom, isAbsolute, setProp: actions.setProp };
  const queryRef = useRef(query);
  queryRef.current = query;
  const setGuidesRef = useRef(setGuides);
  setGuidesRef.current = setGuides;
  const nodeIdRef = useRef(id);

  const onMouseDown = useCallback((e: { clientX: number; clientY: number }) => {
    if (!stateRef.current.isAbsolute) return;
    const { x: sx, y: sy } = stateRef.current;
    dragStartRef.current = { mx: e.clientX, my: e.clientY, sx, sy };
    const onMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return;
      const { zoom: z, setProp } = stateRef.current;
      const rawDx = ev.clientX - dragStartRef.current.mx;
      const rawDy = ev.clientY - dragStartRef.current.my;
      if (Math.hypot(rawDx, rawDy) < 3) return;
      const dx = rawDx / z;
      const dy = rawDy / z;
      const newX = Math.round(dragStartRef.current.sx + dx);
      const newY = Math.round(dragStartRef.current.sy + dy);
      const elRect = elementRef.current?.getBoundingClientRect();
      if (elRect) {
        const nodes = queryRef.current.getSerializedNodes();
        const { vGuide, hGuide } = computeAlignmentGuides(
          nodeIdRef.current, newX, newY, elRect, z, nodes,
        );
        setGuidesRef.current(hGuide, vGuide);
        setProp((p: any) => { p.x = newX; p.y = newY; });
      } else {
        setGuidesRef.current(null, null);
        setProp((p: any) => { p.x = newX; p.y = newY; });
      }
    };
    const onUp = () => {
      dragStartRef.current = null;
      setGuidesRef.current(null, null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []); // stable — reads from stateRef and refs

  const connectRef = (r: HTMLElement | null) => {
    elementRef.current = r;
    if (r) {
      nodeElementRegistry.set(nodeIdRef.current, r);
      connect(r);
      if (!isAbsolute) drag(r);
    } else {
      nodeElementRegistry.delete(nodeIdRef.current);
    }
  };

  // Very subtle fill — only visible enough to convey layout structure.
  // Selected: blue tint + solid blue border.
  // Drag-over: blue dashed border to signal "drop here".
  const containerVisual: CSSProperties = selected
    ? { background: "rgba(59,130,246,0.05)", border: "1.5px solid #3b82f6", borderRadius: 4 }
    : isDragOver
    ? { background: "rgba(59,130,246,0.05)", border: "1.5px dashed #3b82f6", borderRadius: 4 }
    : { background: "rgba(0,0,0,0.025)", borderRadius: 4 };

  return { connectRef, id, isEmpty, selected, isDragOver, isAbsolute, containerVisual, onMouseDown };
}

// ─── Leaf components ──────────────────────────────────────────────────────────

export function AstryxButton(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("children", props.children ?? "Button");
  return (
    <div ref={connectRef} style={{ display: "inline-block", position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxButtonBase {...props} /></div>
      {editOverlay}
    </div>
  );
}
(AstryxButton as any).craft = { displayName: "AstryxButton", rules: { canMoveIn: () => false } };

export function AstryxText(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("children", props.children ?? "Text");
  return (
    <div ref={connectRef} style={{ display: "inline-block", position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxTextBase {...props} /></div>
      {editOverlay}
    </div>
  );
}
(AstryxText as any).craft = { displayName: "AstryxText", rules: { canMoveIn: () => false } };

export function AstryxHeading(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("children", props.children ?? "Heading");
  return (
    <div ref={connectRef} style={{ position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxHeadingBase {...props} /></div>
      {editOverlay}
    </div>
  );
}
(AstryxHeading as any).craft = { displayName: "AstryxHeading", rules: { canMoveIn: () => false } };

export function AstryxTextInput(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxTextInputBase {...props} />
    </div>
  );
}
(AstryxTextInput as any).craft = { displayName: "AstryxTextInput", rules: { canMoveIn: () => false } };

export function AstryxBadge(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("children", props.children ?? "Badge");
  return (
    <div ref={connectRef} style={{ display: "inline-block", position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxBadgeBase {...props} /></div>
      {editOverlay}
    </div>
  );
}
(AstryxBadge as any).craft = { displayName: "AstryxBadge", rules: { canMoveIn: () => false } };

export function AstryxAvatar(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={{ display: "inline-block", ...extraStyle }}>
      <AstryxAvatarBase {...props} />
    </div>
  );
}
(AstryxAvatar as any).craft = { displayName: "AstryxAvatar", rules: { canMoveIn: () => false } };

export function AstryxSpinner(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={{ display: "inline-block", ...extraStyle }}>
      <AstryxSpinnerBase {...props} />
    </div>
  );
}
(AstryxSpinner as any).craft = { displayName: "AstryxSpinner", rules: { canMoveIn: () => false } };

export function AstryxDivider(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxDividerBase {...props} />
    </div>
  );
}
(AstryxDivider as any).craft = { displayName: "AstryxDivider", rules: { canMoveIn: () => false } };

export function AstryxProgressBar(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxProgressBarBase {...props} />
    </div>
  );
}
(AstryxProgressBar as any).craft = { displayName: "AstryxProgressBar", rules: { canMoveIn: () => false } };

export function AstryxStatusDot(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={{ display: "inline-block", ...extraStyle }}>
      <AstryxStatusDotBase {...props} />
    </div>
  );
}
(AstryxStatusDot as any).craft = { displayName: "AstryxStatusDot", rules: { canMoveIn: () => false } };

export function AstryxSkeleton(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxSkeletonBase {...props} />
    </div>
  );
}
(AstryxSkeleton as any).craft = { displayName: "AstryxSkeleton", rules: { canMoveIn: () => false } };

export function AstryxBanner(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("children", props.children ?? "Banner message");
  return (
    <div ref={connectRef} style={{ position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxBannerBase {...props} /></div>
      {editOverlay}
    </div>
  );
}
(AstryxBanner as any).craft = { displayName: "AstryxBanner", rules: { canMoveIn: () => false } };

export function AstryxEmptyState(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("title", props.title ?? "Nothing here yet");
  return (
    <div ref={connectRef} style={{ position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxEmptyStateBase {...props} /></div>
      {editOverlay}
    </div>
  );
}
(AstryxEmptyState as any).craft = { displayName: "AstryxEmptyState", rules: { canMoveIn: () => false } };

export function AstryxChatMessage(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("children", props.children ?? "Hello!");
  return (
    <div ref={connectRef} style={{ position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxChatMessageBase {...props} /></div>
      {editOverlay}
    </div>
  );
}
(AstryxChatMessage as any).craft = { displayName: "AstryxChatMessage", rules: { canMoveIn: () => false } };

export function AstryxToken(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("children", props.children ?? "Token");
  return (
    <div ref={connectRef} style={{ display: "inline-block", position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxTokenBase {...props} /></div>
      {editOverlay}
    </div>
  );
}
(AstryxToken as any).craft = { displayName: "AstryxToken", rules: { canMoveIn: () => false } };

export function AstryxIcon(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={{ display: "inline-block", ...extraStyle }}>
      <AstryxIconBase {...props} />
    </div>
  );
}
(AstryxIcon as any).craft = { displayName: "AstryxIcon", rules: { canMoveIn: () => false } };

export function AstryxUnknown(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxUnknownBase astryxComponent={props.astryxComponent ?? "Unknown"} />
    </div>
  );
}
(AstryxUnknown as any).craft = { displayName: "AstryxUnknown", rules: { canMoveIn: () => false } };

export function AstryxTable(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxTableBase {...props} />
    </div>
  );
}
(AstryxTable as any).craft = { displayName: "AstryxTable", rules: { canMoveIn: () => false } };

export function AstryxTabs(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxTabsBase {...props} />
    </div>
  );
}
(AstryxTabs as any).craft = { displayName: "AstryxTabs", rules: { canMoveIn: () => false } };

export function AstryxAccordion(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxAccordionBase {...props} />
    </div>
  );
}
(AstryxAccordion as any).craft = { displayName: "AstryxAccordion", rules: { canMoveIn: () => false } };

export function AstryxSelect(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxSelectBase {...props} />
    </div>
  );
}
(AstryxSelect as any).craft = { displayName: "AstryxSelect", rules: { canMoveIn: () => false } };

export function AstryxCheckbox(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={{ display: "inline-block", ...extraStyle }}>
      <AstryxCheckboxBase {...props} />
    </div>
  );
}
(AstryxCheckbox as any).craft = { displayName: "AstryxCheckbox", rules: { canMoveIn: () => false } };

export function AstryxRadioGroup(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxRadioGroupBase {...props} />
    </div>
  );
}
(AstryxRadioGroup as any).craft = { displayName: "AstryxRadioGroup", rules: { canMoveIn: () => false } };

export function AstryxSlider(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxSliderBase {...props} />
    </div>
  );
}
(AstryxSlider as any).craft = { displayName: "AstryxSlider", rules: { canMoveIn: () => false } };

export function AstryxCalendar(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxCalendarBase {...props} />
    </div>
  );
}
(AstryxCalendar as any).craft = { displayName: "AstryxCalendar", rules: { canMoveIn: () => false } };

export function AstryxCommand(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxCommandBase {...props} />
    </div>
  );
}
(AstryxCommand as any).craft = { displayName: "AstryxCommand", rules: { canMoveIn: () => false } };

export function AstryxCarousel(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxCarouselBase {...props} />
    </div>
  );
}
(AstryxCarousel as any).craft = { displayName: "AstryxCarousel", rules: { canMoveIn: () => false } };

export function AstryxResizable(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxResizableBase {...props} />
    </div>
  );
}
(AstryxResizable as any).craft = { displayName: "AstryxResizable", rules: { canMoveIn: () => false } };

// ─── Container components ─────────────────────────────────────────────────────
// canMoveIn: true — children can be dropped in.
// All containers show a blue dashed drop zone when empty,
// a selection ring when selected, and support absolute positioning.

const ALIGN_MAP: Record<string, string> = {
  start: "flex-start", center: "center", end: "flex-end", stretch: "stretch",
};
const JUSTIFY_MAP: Record<string, string> = {
  start: "flex-start", center: "center", end: "flex-end", between: "space-between", around: "space-around",
};

export function AstryxSection({ children, direction = "column", gap = 16, padding = 16, align = "stretch", justify = "start", position = "flow", x = 0, y = 0, backgroundColor, textColor }: AstryxProps) {
  const { connectRef, id, isEmpty, isAbsolute, containerVisual, selected, onMouseDown } = useContainerNode(position, x, y);
  const isRoot = id === "ROOT";
  const bgOverride = !isRoot && !selected && backgroundColor ? { background: backgroundColor as string } : {};
  return (
    <div
      ref={connectRef}
      onMouseDown={onMouseDown}
      style={{
        display: "flex",
        flexDirection: direction as "row" | "column",
        alignItems: ALIGN_MAP[align] ?? "stretch",
        justifyContent: JUSTIFY_MAP[justify] ?? "flex-start",
        gap,
        padding,
        minHeight: isRoot ? 480 : 48,
        width: isRoot ? "max-content" : "100%",
        minWidth: isRoot ? "100%" : undefined,
        position: "relative",
        boxSizing: "border-box",
        ...(!isRoot ? containerVisual : {}),
        ...bgOverride,
        ...(textColor ? { color: textColor as string } : {}),
        ...(!isRoot ? absPositionStyle(position, x, y) : {}),
        ...(isAbsolute && !isRoot ? { cursor: "grab" } : {}),
      }}
    >
      {!isRoot && isEmpty ? <div style={EMPTY_DROP_STYLE}>drop here</div> : children}
    </div>
  );
}
(AstryxSection as any).craft = {
  displayName: "AstryxSection",
  rules: {
    // ROOT section only accepts artboards; non-root sections accept any component except artboards.
    canMoveIn: (incomingNode: any, currentNode: any) => {
      if (currentNode?.id === "ROOT") return incomingNode?.data?.displayName === "AstryxArtboard";
      return incomingNode?.data?.displayName !== "AstryxArtboard";
    },
  },
};

export function AstryxStack({ children, gap = 8, align = "stretch", justify = "start", position = "flow", x = 0, y = 0, backgroundColor, textColor }: AstryxProps) {
  const { connectRef, isEmpty, selected, isAbsolute, containerVisual, onMouseDown } = useContainerNode(position, x, y);
  return (
    <div
      ref={connectRef}
      onMouseDown={onMouseDown}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: ALIGN_MAP[align] ?? "stretch",
        justifyContent: JUSTIFY_MAP[justify] ?? "flex-start",
        gap,
        minHeight: 32,
        width: "100%",
        position: "relative",
        boxSizing: "border-box",
        ...containerVisual,
        ...(!selected && backgroundColor ? { background: backgroundColor as string } : {}),
        ...(textColor ? { color: textColor as string } : {}),
        ...absPositionStyle(position, x, y),
        ...(isAbsolute ? { cursor: "grab" } : {}),
      }}
    >
      {isEmpty ? <div style={EMPTY_DROP_STYLE}>drop here</div> : children}
    </div>
  );
}
(AstryxStack as any).craft = { displayName: "AstryxStack", rules: { canMoveIn: () => true } };

export function AstryxHStack({ children, gap = 8, align = "center", justify = "start", position = "flow", x = 0, y = 0, backgroundColor, textColor }: AstryxProps) {
  const { connectRef, isEmpty, selected, isAbsolute, containerVisual, onMouseDown } = useContainerNode(position, x, y);
  return (
    <div
      ref={connectRef}
      onMouseDown={onMouseDown}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: ALIGN_MAP[align] ?? "center",
        justifyContent: JUSTIFY_MAP[justify] ?? "flex-start",
        gap,
        minHeight: 32,
        width: "100%",
        position: "relative",
        boxSizing: "border-box",
        ...containerVisual,
        ...(!selected && backgroundColor ? { background: backgroundColor as string } : {}),
        ...(textColor ? { color: textColor as string } : {}),
        ...absPositionStyle(position, x, y),
        ...(isAbsolute ? { cursor: "grab" } : {}),
      }}
    >
      {isEmpty ? <div style={{ ...EMPTY_DROP_STYLE, minHeight: 32 }}>drop here</div> : children}
    </div>
  );
}
(AstryxHStack as any).craft = { displayName: "AstryxHStack", rules: { canMoveIn: () => true } };

export function AstryxCard({ children, variant = "elevated", position = "flow", x = 0, y = 0, backgroundColor, textColor }: AstryxProps) {
  const { connectRef, isEmpty, selected, isDragOver, isAbsolute, onMouseDown } = useContainerNode(position, x, y);
  const variantClass =
    variant === "outlined" ? "bg-white border border-gray-300" :
    variant === "ghost"    ? "bg-gray-50" :
                             "bg-white shadow-md border border-gray-100";
  // Apply connectRef directly to the card visual so Craft.js children are
  // nested inside the connected element — required for correct drop targeting.
  return (
    <div
      ref={connectRef}
      onMouseDown={onMouseDown}
      className={`rounded-lg p-4 ${variantClass}`}
      style={{
        position: "relative",
        minHeight: 56,
        boxSizing: "border-box",
        ...absPositionStyle(position, x, y),
        ...(isAbsolute ? { cursor: "grab" } : {}),
        ...(!selected && backgroundColor ? { background: backgroundColor as string } : {}),
        ...(textColor ? { color: textColor as string } : {}),
        ...(selected ? { outline: "2px solid #3b82f6", outlineOffset: 2 } : {}),
        ...(isDragOver && !selected ? { outline: "1.5px dashed #3b82f6", outlineOffset: 2 } : {}),
      }}
    >
      {isEmpty
        ? <div style={{ ...EMPTY_DROP_STYLE, minHeight: 48, flex: "unset" as any }}>drop here</div>
        : children}
    </div>
  );
}
(AstryxCard as any).craft = { displayName: "AstryxCard", rules: { canMoveIn: () => true } };

// ─── Artboard ─────────────────────────────────────────────────────────────────
// Named canvas frame — the top-level screen container in the design editor.
// Multiple artboards sit side-by-side inside the ROOT section.

export function AstryxArtboard({ children, label = "Artboard", width = 390, direction = "column", gap = 16, padding = 24, align = "stretch", justify = "start", backgroundColor, textColor }: AstryxProps) {
  const { connectors: { connect, drag }, id, isEmpty, selected } = useNode((node) => ({
    isEmpty: node.data.nodes.length === 0,
    selected: node.events.selected,
  }));
  // Register the artboard DOM element in the shared registry so computeSnapGuides
  // can measure its height for artboard-centre-Y snap.
  const nodeIdRef = useRef(id);
  const artboardConnectRef = useCallback((r: HTMLElement | null) => {
    if (r) {
      nodeElementRegistry.set(nodeIdRef.current, r);
      connect(drag(r));
    } else {
      nodeElementRegistry.delete(nodeIdRef.current);
    }
  }, [connect, drag]);
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 500,
        color: selected ? "#3b82f6" : "var(--muted-foreground)",
        marginBottom: 6,
        paddingLeft: 2,
        userSelect: "none",
        letterSpacing: "0.01em",
        transition: "color 0.15s",
      }}>
        {label}
      </div>
      <div
        ref={artboardConnectRef}
        style={{
          display: "flex",
          flexDirection: direction as "row" | "column",
          alignItems: ALIGN_MAP[align] ?? "stretch",
          justifyContent: JUSTIFY_MAP[justify] ?? "flex-start",
          gap,
          padding,
          width,
          minHeight: 480,
          background: (backgroundColor as string) || "var(--card)",
          color: (textColor as string) || undefined,
          borderRadius: 12,
          boxShadow: selected
            ? "0 0 0 2px #3b82f6, 0 4px 24px rgba(0,0,0,0.10)"
            : "0 4px 24px rgba(0,0,0,0.10)",
          position: "relative",
          boxSizing: "border-box",
          transition: "box-shadow 0.15s",
        }}
      >
        {isEmpty ? <div style={{ ...EMPTY_DROP_STYLE, margin: 8 }}>drop here</div> : children}
      </div>
    </div>
  );
}
(AstryxArtboard as any).craft = { displayName: "AstryxArtboard", rules: { canMoveIn: () => true } };

// ─── Resolver map ──────────────────────────────────────────────────────────────

export const resolver = {
  AstryxButton,
  AstryxCard,
  AstryxText,
  AstryxHeading,
  AstryxTextInput,
  AstryxBadge,
  AstryxAvatar,
  AstryxSpinner,
  AstryxDivider,
  AstryxProgressBar,
  AstryxStatusDot,
  AstryxSkeleton,
  AstryxBanner,
  AstryxEmptyState,
  AstryxChatMessage,
  AstryxToken,
  AstryxIcon,
  AstryxUnknown,
  AstryxSection,
  AstryxStack,
  AstryxHStack,
  AstryxArtboard,
  AstryxTable,
  AstryxTabs,
  AstryxAccordion,
  AstryxSelect,
  AstryxCheckbox,
  AstryxRadioGroup,
  AstryxSlider,
  AstryxCalendar,
  AstryxCommand,
  AstryxCarousel,
  AstryxResizable,
};

// ─── Alignment guard ───────────────────────────────────────────────────────────
// Detects drift between craftValidator.ts and the resolver map at module load.

{
  const resolverKeys = Object.keys(resolver);
  const missingFromResolver = ALLOWED_CRAFT_COMPONENTS.filter((k) => !resolverKeys.includes(k));
  const missingFromValidator = resolverKeys.filter((k) => !ALLOWED_CRAFT_COMPONENTS.includes(k));
  if (missingFromResolver.length || missingFromValidator.length) {
    console.error(
      "[Astryx] ALLOWED_CRAFT_COMPONENTS ↔ resolver MISMATCH",
      { missingFromResolver, missingFromValidator },
    );
  }
}

// ─── Empty state factory ───────────────────────────────────────────────────────
// Default craft state: a transparent ROOT row-flex wrapper containing one
// AstryxArtboard ("Screen 1") at 390 px wide — matching a standard mobile frame.

export function createEmptyCraftState(): string {
  return JSON.stringify({
    ROOT: {
      type: { resolvedName: "AstryxSection" },
      isCanvas: true,
      props: { direction: "row", gap: 80, padding: 40, align: "start", justify: "start" },
      displayName: "AstryxSection",
      custom: {},
      parent: null,
      hidden: false,
      nodes: ["artboard-1"],
      linkedNodes: {},
    },
    "artboard-1": {
      type: { resolvedName: "AstryxArtboard" },
      isCanvas: true,
      props: { label: "Screen 1", width: 390, direction: "column", gap: 16, padding: 24 },
      displayName: "AstryxArtboard",
      custom: {},
      parent: "ROOT",
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
  });
}
