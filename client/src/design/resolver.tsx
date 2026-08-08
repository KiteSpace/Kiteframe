import { useNode, useEditor } from "@craftjs/core";
import { useEffect, useRef, useContext, useCallback, createContext, useState, type CSSProperties } from "react";
import {
  ALLOWED_CRAFT_COMPONENTS,
  validateCraftState,
  sanitizeCraftState,
  pruneUnreachableCraftNodes,
  detectDisconnectedArtboards,
  repairCraftStateJson,
} from "./craftValidator";
export type { CraftStateValidationResult } from "./craftValidator";
export { ALLOWED_CRAFT_COMPONENTS, validateCraftState, sanitizeCraftState, pruneUnreachableCraftNodes, detectDisconnectedArtboards, repairCraftStateJson };
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
  // Navigation
  AstryxNavbar as AstryxNavbarBase,
  AstryxSidebar as AstryxSidebarBase,
  AstryxBreadcrumb as AstryxBreadcrumbBase,
  // Overlays
  AstryxModal as AstryxModalBase,
  AstryxDrawer as AstryxDrawerBase,
  AstryxSheet as AstryxSheetBase,
  // Charts
  AstryxBarChart as AstryxBarChartBase,
  AstryxLineChart as AstryxLineChartBase,
  AstryxPieChart as AstryxPieChartBase,
  // Media
  AstryxVideoPlayer as AstryxVideoPlayerBase,
  AstryxCodeBlock as AstryxCodeBlockBase,
  // List
  AstryxListItem as AstryxListItemBase,
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
// Provides drag/connect ref, selection ring, absolute positioning, full-width
// defaulting, and drag-to-resize handles for all leaf components.

const RADIUS_TOKEN: Record<string, number> = { None: 0, S: 4, M: 8, L: 16, Full: 9999 };

// Components that should fill their parent's width by default rather than
// shrink-wrapping. These are block-level by nature (tables, inputs, carousels…).
const FULL_WIDTH_LEAF = new Set([
  "AstryxCarousel", "AstryxResizable", "AstryxTable", "AstryxTabs",
  "AstryxAccordion", "AstryxSlider", "AstryxCalendar", "AstryxCommand",
  "AstryxBanner", "AstryxEmptyState", "AstryxChatMessage", "AstryxDivider",
  "AstryxProgressBar", "AstryxTextInput", "AstryxSelect", "AstryxRadioGroup",
  "AstryxHeading", "AstryxBarChart", "AstryxLineChart", "AstryxPieChart",
]);

function useLeafNode() {
  const zoom = useContext(CanvasZoomContext);
  const setGuides = useContext(SnapGuideContext);
  const { id, connectors: { connect, drag }, actions, selected, nodePosition, nodeX, nodeY,
          nodeBg, nodeColor, nodeRadius, nodeWidth, nodeHeight, displayName } = useNode((node) => ({
    selected: node.events.selected,
    nodePosition: (node.data.props?.position as string) ?? "flow",
    nodeX: (node.data.props?.x as number) ?? 0,
    nodeY: (node.data.props?.y as number) ?? 0,
    nodeBg:     node.data.props?.backgroundColor as string | undefined,
    nodeColor:  node.data.props?.textColor as string | undefined,
    nodeRadius: node.data.props?.borderRadius as string | undefined,
    nodeWidth:  node.data.props?.width as number | string | undefined,
    nodeHeight: node.data.props?.height as number | string | undefined,
    displayName: node.data.displayName as string,
  }));
  const { query } = useEditor(() => ({}));

  const isAbsolute = nodePosition === "absolute";
  const isFullWidth = FULL_WIDTH_LEAF.has(displayName);

  const elementRef = useRef<HTMLElement | null>(null);
  const handleERef  = useRef<HTMLDivElement | null>(null);
  const handleSRef  = useRef<HTMLDivElement | null>(null);
  const handleSERef = useRef<HTMLDivElement | null>(null);
  // Additional handles for absolute-positioned nodes (top/left edges + missing corners).
  const handleNRef  = useRef<HTMLDivElement | null>(null);
  const handleWRef  = useRef<HTMLDivElement | null>(null);
  const handleNWRef = useRef<HTMLDivElement | null>(null);
  const handleNERef = useRef<HTMLDivElement | null>(null);
  const handleSWRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ mx: number; my: number; sx: number; sy: number } | null>(null);
  const stateRef = useRef({ x: nodeX, y: nodeY, zoom, isAbsolute, setProp: actions.setProp });
  stateRef.current = { x: nodeX, y: nodeY, zoom, isAbsolute, setProp: actions.setProp };
  // Live size snapshot so resize handlers don't close over stale props.
  const sizeRef = useRef({
    w: nodeWidth != null && nodeWidth !== "auto" ? Number(nodeWidth) : undefined,
    h: nodeHeight != null && nodeHeight !== "auto" ? Number(nodeHeight) : undefined,
  });
  sizeRef.current = {
    w: nodeWidth != null && nodeWidth !== "auto" ? Number(nodeWidth) : undefined,
    h: nodeHeight != null && nodeHeight !== "auto" ? Number(nodeHeight) : undefined,
  };
  const queryRef = useRef(query);
  queryRef.current = query;
  const setGuidesRef = useRef(setGuides);
  setGuidesRef.current = setGuides;
  const nodeIdRef = useRef(id);

  // Attach drag-to-move (absolute nodes only) once on mount.
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    const handle = (e: MouseEvent) => {
      _dragOccurred = false;
      if (!stateRef.current.isAbsolute) return;
      const { x: sx, y: sy } = stateRef.current;
      dragStartRef.current = { mx: e.clientX, my: e.clientY, sx, sy };
      const onMove = (ev: MouseEvent) => {
        if (!dragStartRef.current) return;
        const { zoom: z, setProp } = stateRef.current;
        const rawDx = ev.clientX - dragStartRef.current.mx;
        const rawDy = ev.clientY - dragStartRef.current.my;
        if (Math.hypot(rawDx, rawDy) < 3) return;
        _dragOccurred = true;
        const dx = rawDx / z;
        const dy = rawDy / z;
        const newX = Math.round(dragStartRef.current.sx + dx);
        const newY = Math.round(dragStartRef.current.sy + dy);
        setProp((p: any) => { p.x = newX; p.y = newY; });
      };
      const onUp = () => {
        dragStartRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
    el.addEventListener("mousedown", handle);
    return () => el.removeEventListener("mousedown", handle);
  }, []);

  // Stable factory for all 8 resize directions — reads live values via refs.
  // n/w directions also shift x/y so the opposite edge stays fixed (absolute nodes only).
  type ResizeDir8 = "n" | "s" | "e" | "w" | "nw" | "ne" | "se" | "sw";
  const makeResizeHandler = useCallback((dir: ResizeDir8) => (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Clicking a resize handle blocks the bubble-phase drag-to-move handler that normally
    // resets _dragOccurred. Reset it here so subsequent double-clicks open the text editor.
    _dragOccurred = false;
    const { zoom: z } = stateRef.current;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startW = sizeRef.current.w ?? Math.round((elementRef.current?.getBoundingClientRect().width  ?? 100) / z);
    const startH = sizeRef.current.h ?? Math.round((elementRef.current?.getBoundingClientRect().height ?? 40)  / z);
    // Capture start position so n/w handlers can shift x/y to keep the opposite edge fixed.
    const startPX = stateRef.current.x;
    const startPY = stateRef.current.y;
    const onMove = (ev: MouseEvent) => {
      const { zoom: cz, setProp, isAbsolute } = stateRef.current;
      const dw = (ev.clientX - startMouseX) / cz;
      const dh = (ev.clientY - startMouseY) / cz;
      setProp((p: any) => {
        // East: right edge moves → width grows rightward
        if (dir === "e" || dir === "se" || dir === "ne") {
          p.width = Math.max(20, Math.round(startW + dw));
        }
        // South: bottom edge moves → height grows downward
        if (dir === "s" || dir === "se" || dir === "sw") {
          p.height = Math.max(20, Math.round(startH + dh));
        }
        // West: left edge moves → width grows leftward, x shifts right stays fixed
        if (dir === "w" || dir === "nw" || dir === "sw") {
          const newW = Math.max(20, Math.round(startW - dw));
          p.width = newW;
          if (isAbsolute) p.x = Math.round(startPX + (startW - newW));
        }
        // North: top edge moves → height grows upward, y shifts so bottom stays fixed
        if (dir === "n" || dir === "nw" || dir === "ne") {
          const newH = Math.max(20, Math.round(startH - dh));
          p.height = newH;
          if (isAbsolute) p.y = Math.round(startPY + (startH - newH));
        }
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // Re-attach resize listeners whenever selection changes (handles conditionally mount).
  useEffect(() => {
    const eEl  = handleERef.current;
    const sEl  = handleSRef.current;
    const seEl = handleSERef.current;
    if (!eEl || !sEl || !seEl) return;

    const pairs: [HTMLDivElement, ResizeDir8][] = [
      [eEl,  "e"],
      [sEl,  "s"],
      [seEl, "se"],
    ];
    // Additional handles are only mounted for absolute nodes.
    const extras: [React.RefObject<HTMLDivElement | null>, ResizeDir8][] = [
      [handleNRef,  "n"],
      [handleWRef,  "w"],
      [handleNWRef, "nw"],
      [handleNERef, "ne"],
      [handleSWRef, "sw"],
    ];
    for (const [ref, dir] of extras) {
      if (ref.current) pairs.push([ref.current, dir]);
    }

    const handlers = pairs.map(([el, dir]) => {
      const h = makeResizeHandler(dir);
      el.addEventListener("mousedown", h, { capture: true });
      return [el, h] as [HTMLDivElement, (e: MouseEvent) => void];
    });
    return () => {
      for (const [el, h] of handlers) el.removeEventListener("mousedown", h, { capture: true });
    };
  }, [selected, makeResizeHandler]);

  const resolvedRadius = nodeRadius !== undefined ? (RADIUS_TOKEN[nodeRadius] ?? 8) : undefined;
  const extraStyle: CSSProperties = {
    ...absPositionStyle(nodePosition, nodeX, nodeY),
    // Flow nodes get position:relative so resize handles (position:absolute) anchor correctly.
    ...(!isAbsolute ? { position: "relative" } : {}),
    ...(selected ? SELECTION_RING : {}),
    ...(isAbsolute ? { cursor: "grab" } : {}),
    ...(nodeBg  ? { backgroundColor: nodeBg } : {}),
    ...(nodeColor ? { color: nodeColor } : {}),
    // borderRadius on the wrapper matches the selection ring shape.
    // Use overflow:visible when selected so resize handles aren't clipped.
    ...(resolvedRadius !== undefined
      ? { borderRadius: resolvedRadius, overflow: selected ? "visible" : "hidden" }
      : {}),
    // Full-width components expand to fill their parent; inline ones shrink-wrap.
    ...(isFullWidth ? { display: "block" } : {}),
    ...(nodeWidth !== undefined && nodeWidth !== "auto"
      ? { width: nodeWidth }
      : isFullWidth ? { width: "100%" } : { width: "fit-content" }),
    ...(nodeHeight !== undefined && nodeHeight !== "auto" ? { height: nodeHeight } : {}),
  };

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

  // Resize handles — rendered only when selected. All 8 directions on every component.
  const resizeHandles = selected ? (
    <>
      <div
        ref={handleERef}
        style={{ position: "absolute", top: 0, right: -4, width: 8, bottom: 0,
                  cursor: "ew-resize", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{ borderRadius: 2, background: "#3b82f6", width: 4, height: 20, transition: "background 0.12s" }} />
      </div>
      <div
        ref={handleSRef}
        style={{ position: "absolute", left: 0, right: 0, bottom: -4, height: 8,
                  cursor: "ns-resize", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{ borderRadius: 2, background: "#3b82f6", height: 4, width: 20, transition: "background 0.12s" }} />
      </div>
      <div
        ref={handleSERef}
        style={{ position: "absolute", right: -5, bottom: -5, width: 12, height: 12,
                  cursor: "nwse-resize", zIndex: 21, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", transition: "background 0.12s" }} />
      </div>
      <div
        ref={handleNRef}
        style={{ position: "absolute", left: 0, right: 0, top: -4, height: 8,
                  cursor: "ns-resize", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{ borderRadius: 2, background: "#3b82f6", height: 4, width: 20, transition: "background 0.12s" }} />
      </div>
      <div
        ref={handleWRef}
        style={{ position: "absolute", top: 0, left: -4, width: 8, bottom: 0,
                  cursor: "ew-resize", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{ borderRadius: 2, background: "#3b82f6", width: 4, height: 20, transition: "background 0.12s" }} />
      </div>
      <div
        ref={handleNWRef}
        style={{ position: "absolute", left: -5, top: -5, width: 12, height: 12,
                  cursor: "nwse-resize", zIndex: 21, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", transition: "background 0.12s" }} />
      </div>
      <div
        ref={handleNERef}
        style={{ position: "absolute", right: -5, top: -5, width: 12, height: 12,
                  cursor: "nesw-resize", zIndex: 21, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", transition: "background 0.12s" }} />
      </div>
      <div
        ref={handleSWRef}
        style={{ position: "absolute", left: -5, bottom: -5, width: 12, height: 12,
                  cursor: "nesw-resize", zIndex: 21, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", transition: "background 0.12s" }} />
      </div>
    </>
  ) : null;

  return { connectRef, extraStyle, resolvedRadius, resizeHandles };
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
    // Always reset afterwards so a single blocked attempt doesn't permanently disable editing.
    const wasDragging = _dragOccurred;
    _dragOccurred = false;
    if (wasDragging) return;
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
  const { connectors: { connect, drag }, id, actions, isEmpty, selected, hovered, nodeWidth, nodeHeight } = useNode((node) => ({
    isEmpty: node.data.nodes.length === 0,
    selected: node.events.selected,
    hovered: node.events.hovered,
    nodeWidth:  node.data.props?.width  as number | string | undefined,
    nodeHeight: node.data.props?.height as number | string | undefined,
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
      setProp((p: any) => { p.x = newX; p.y = newY; });
    };
    const onUp = () => {
      dragStartRef.current = null;
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

  // ── Resize handles (8-direction, same as useLeafNode) ─────────────────────
  const handleERef  = useRef<HTMLDivElement | null>(null);
  const handleSRef  = useRef<HTMLDivElement | null>(null);
  const handleSERef = useRef<HTMLDivElement | null>(null);
  const handleNRef  = useRef<HTMLDivElement | null>(null);
  const handleWRef  = useRef<HTMLDivElement | null>(null);
  const handleNWRef = useRef<HTMLDivElement | null>(null);
  const handleNERef = useRef<HTMLDivElement | null>(null);
  const handleSWRef = useRef<HTMLDivElement | null>(null);

  const sizeRef = useRef({
    w: nodeWidth  != null && nodeWidth  !== "auto" ? Number(nodeWidth)  : undefined,
    h: nodeHeight != null && nodeHeight !== "auto" ? Number(nodeHeight) : undefined,
  });
  sizeRef.current = {
    w: nodeWidth  != null && nodeWidth  !== "auto" ? Number(nodeWidth)  : undefined,
    h: nodeHeight != null && nodeHeight !== "auto" ? Number(nodeHeight) : undefined,
  };

  type ResizeDir8 = "n" | "s" | "e" | "w" | "nw" | "ne" | "se" | "sw";
  const makeResizeHandler = useCallback((dir: ResizeDir8) => (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const { zoom: z } = stateRef.current;
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startW = sizeRef.current.w ?? Math.round((elementRef.current?.getBoundingClientRect().width  ?? 200) / z);
    const startH = sizeRef.current.h ?? Math.round((elementRef.current?.getBoundingClientRect().height ?? 100) / z);
    const startPX = stateRef.current.x;
    const startPY = stateRef.current.y;
    const onMove = (ev: MouseEvent) => {
      const { zoom: cz, setProp, isAbsolute } = stateRef.current;
      const dw = (ev.clientX - startMouseX) / cz;
      const dh = (ev.clientY - startMouseY) / cz;
      setProp((p: any) => {
        if (dir === "e" || dir === "se" || dir === "ne") p.width = Math.max(20, Math.round(startW + dw));
        if (dir === "s" || dir === "se" || dir === "sw") p.height = Math.max(20, Math.round(startH + dh));
        if (dir === "w" || dir === "nw" || dir === "sw") {
          const newW = Math.max(20, Math.round(startW - dw));
          p.width = newW;
          if (isAbsolute) p.x = Math.round(startPX + (startW - newW));
        }
        if (dir === "n" || dir === "nw" || dir === "ne") {
          const newH = Math.max(20, Math.round(startH - dh));
          p.height = newH;
          if (isAbsolute) p.y = Math.round(startPY + (startH - newH));
        }
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const allPairs: [React.RefObject<HTMLDivElement | null>, ResizeDir8][] = [
      [handleERef, "e"], [handleSRef, "s"], [handleSERef, "se"],
      [handleNRef, "n"], [handleWRef, "w"], [handleNWRef, "nw"],
      [handleNERef, "ne"], [handleSWRef, "sw"],
    ];
    const attached: [HTMLDivElement, (e: MouseEvent) => void][] = [];
    for (const [ref, dir] of allPairs) {
      if (!ref.current) continue;
      const h = makeResizeHandler(dir);
      ref.current.addEventListener("mousedown", h, { capture: true });
      attached.push([ref.current, h]);
    }
    return () => { for (const [el, h] of attached) el.removeEventListener("mousedown", h, { capture: true }); };
  }, [selected, makeResizeHandler]);

  // Width / height from props override the hardcoded defaults in each container.
  // Only applied when explicitly set (not "auto") so natural defaults are preserved.
  const containerSizeStyle: CSSProperties = {
    ...(nodeWidth  != null && nodeWidth  !== "auto" ? { width:  nodeWidth  } : {}),
    ...(nodeHeight != null && nodeHeight !== "auto" ? { height: nodeHeight } : {}),
    // overflow:visible when selected so handles rendered at negative offsets aren't clipped.
    ...(selected ? { overflow: "visible" } : {}),
  };

  const resizeHandles = selected ? (
    <>
      <div ref={handleERef}  style={{ position: "absolute", top: 0, right: -4, width: 8, bottom: 0, cursor: "ew-resize", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ borderRadius: 2, background: "#3b82f6", width: 4, height: 20 }} />
      </div>
      <div ref={handleSRef}  style={{ position: "absolute", left: 0, right: 0, bottom: -4, height: 8, cursor: "ns-resize", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ borderRadius: 2, background: "#3b82f6", height: 4, width: 20 }} />
      </div>
      <div ref={handleSERef} style={{ position: "absolute", right: -5, bottom: -5, width: 12, height: 12, cursor: "nwse-resize", zIndex: 21, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
      </div>
      <div ref={handleNRef}  style={{ position: "absolute", left: 0, right: 0, top: -4, height: 8, cursor: "ns-resize", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ borderRadius: 2, background: "#3b82f6", height: 4, width: 20 }} />
      </div>
      <div ref={handleWRef}  style={{ position: "absolute", top: 0, left: -4, width: 8, bottom: 0, cursor: "ew-resize", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ borderRadius: 2, background: "#3b82f6", width: 4, height: 20 }} />
      </div>
      <div ref={handleNWRef} style={{ position: "absolute", left: -5, top: -5, width: 12, height: 12, cursor: "nwse-resize", zIndex: 21, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
      </div>
      <div ref={handleNERef} style={{ position: "absolute", right: -5, top: -5, width: 12, height: 12, cursor: "nesw-resize", zIndex: 21, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
      </div>
      <div ref={handleSWRef} style={{ position: "absolute", left: -5, bottom: -5, width: 12, height: 12, cursor: "nesw-resize", zIndex: 21, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
      </div>
    </>
  ) : null;

  // Very subtle fill — only visible enough to convey layout structure.
  // Selected: blue tint + solid blue border.
  // Drag-over: blue dashed border to signal "drop here".
  const containerVisual: CSSProperties = selected
    ? { background: "rgba(59,130,246,0.05)", border: "1.5px solid #3b82f6", borderRadius: 4 }
    : isDragOver
    ? { background: "rgba(59,130,246,0.05)", border: "1.5px dashed #3b82f6", borderRadius: 4 }
    : { background: "rgba(0,0,0,0.025)", borderRadius: 4 };

  return { connectRef, id, isEmpty, selected, isDragOver, isAbsolute, containerVisual, onMouseDown, containerSizeStyle, resizeHandles };
}

// ─── Leaf components ──────────────────────────────────────────────────────────

export function AstryxButton(props: AstryxProps) {
  const { connectRef, extraStyle, resolvedRadius, resizeHandles } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("children", props.children ?? "Button");
  return (
    <div ref={connectRef} style={{ display: "inline-block", position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxButtonBase {...props} borderRadius={resolvedRadius} /></div>
      {editOverlay}
      {resizeHandles}
    </div>
  );
}
(AstryxButton as any).craft = { displayName: "AstryxButton", rules: { canMoveIn: () => false } };

export function AstryxText(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("children", props.children ?? "Text");
  return (
    <div ref={connectRef} style={{ display: "inline-block", position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxTextBase {...props} /></div>
      {editOverlay}
      {resizeHandles}
    </div>
  );
}
(AstryxText as any).craft = { displayName: "AstryxText", rules: { canMoveIn: () => false } };

export function AstryxHeading(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("children", props.children ?? "Heading");
  return (
    <div ref={connectRef} style={{ position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxHeadingBase {...props} /></div>
      {editOverlay}
      {resizeHandles}
    </div>
  );
}
(AstryxHeading as any).craft = { displayName: "AstryxHeading", rules: { canMoveIn: () => false } };

export function AstryxTextInput(props: AstryxProps) {
  const { connectRef, extraStyle, resolvedRadius, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxTextInputBase {...props} borderRadius={resolvedRadius} />
      {resizeHandles}
    </div>
  );
}
(AstryxTextInput as any).craft = { displayName: "AstryxTextInput", rules: { canMoveIn: () => false } };

export function AstryxBadge(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("children", props.children ?? "Badge");
  return (
    <div ref={connectRef} style={{ display: "inline-block", position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxBadgeBase {...props} /></div>
      {editOverlay}
      {resizeHandles}
    </div>
  );
}
(AstryxBadge as any).craft = { displayName: "AstryxBadge", rules: { canMoveIn: () => false } };

export function AstryxAvatar(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={{ display: "inline-block", position: "relative", ...extraStyle }}>
      <AstryxAvatarBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxAvatar as any).craft = { displayName: "AstryxAvatar", rules: { canMoveIn: () => false } };

export function AstryxSpinner(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={{ display: "inline-block", position: "relative", ...extraStyle }}>
      <AstryxSpinnerBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxSpinner as any).craft = { displayName: "AstryxSpinner", rules: { canMoveIn: () => false } };

export function AstryxDivider(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxDividerBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxDivider as any).craft = { displayName: "AstryxDivider", rules: { canMoveIn: () => false } };

export function AstryxProgressBar(props: AstryxProps) {
  const { connectRef, extraStyle, resolvedRadius, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxProgressBarBase {...props} borderRadius={resolvedRadius} />
      {resizeHandles}
    </div>
  );
}
(AstryxProgressBar as any).craft = { displayName: "AstryxProgressBar", rules: { canMoveIn: () => false } };

export function AstryxStatusDot(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={{ display: "inline-block", position: "relative", ...extraStyle }}>
      <AstryxStatusDotBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxStatusDot as any).craft = { displayName: "AstryxStatusDot", rules: { canMoveIn: () => false } };

export function AstryxSkeleton(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxSkeletonBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxSkeleton as any).craft = { displayName: "AstryxSkeleton", rules: { canMoveIn: () => false } };

export function AstryxBanner(props: AstryxProps) {
  const { connectRef, extraStyle, resolvedRadius, resizeHandles } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("children", props.children ?? "Banner message");
  return (
    <div ref={connectRef} style={{ position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxBannerBase {...props} borderRadius={resolvedRadius} /></div>
      {editOverlay}
      {resizeHandles}
    </div>
  );
}
(AstryxBanner as any).craft = { displayName: "AstryxBanner", rules: { canMoveIn: () => false } };

export function AstryxEmptyState(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("title", props.title ?? "Nothing here yet");
  return (
    <div ref={connectRef} style={{ position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxEmptyStateBase {...props} /></div>
      {editOverlay}
      {resizeHandles}
    </div>
  );
}
(AstryxEmptyState as any).craft = { displayName: "AstryxEmptyState", rules: { canMoveIn: () => false } };

export function AstryxChatMessage(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("children", props.children ?? "Hello!");
  return (
    <div ref={connectRef} style={{ position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxChatMessageBase {...props} /></div>
      {editOverlay}
      {resizeHandles}
    </div>
  );
}
(AstryxChatMessage as any).craft = { displayName: "AstryxChatMessage", rules: { canMoveIn: () => false } };

export function AstryxToken(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("children", props.children ?? "Token");
  return (
    <div ref={connectRef} style={{ display: "inline-block", position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}><AstryxTokenBase {...props} /></div>
      {editOverlay}
      {resizeHandles}
    </div>
  );
}
(AstryxToken as any).craft = { displayName: "AstryxToken", rules: { canMoveIn: () => false } };

export function AstryxIcon(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={{ display: "inline-block", position: "relative", ...extraStyle }}>
      <AstryxIconBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxIcon as any).craft = { displayName: "AstryxIcon", rules: { canMoveIn: () => false } };

export function AstryxUnknown(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxUnknownBase astryxComponent={props.astryxComponent ?? "Unknown"} />
      {resizeHandles}
    </div>
  );
}
(AstryxUnknown as any).craft = { displayName: "AstryxUnknown", rules: { canMoveIn: () => false } };

// ─── Navigation ───────────────────────────────────────────────────────────────

export function AstryxNavbar(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxNavbarBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxNavbar as any).craft = { displayName: "AstryxNavbar", rules: { canMoveIn: () => false } };

export function AstryxSidebar(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxSidebarBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxSidebar as any).craft = { displayName: "AstryxSidebar", rules: { canMoveIn: () => false } };

export function AstryxBreadcrumb(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxBreadcrumbBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxBreadcrumb as any).craft = { displayName: "AstryxBreadcrumb", rules: { canMoveIn: () => false } };

// ─── Overlays ─────────────────────────────────────────────────────────────────

export function AstryxModal(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxModalBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxModal as any).craft = { displayName: "AstryxModal", rules: { canMoveIn: () => false } };

export function AstryxDrawer(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxDrawerBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxDrawer as any).craft = { displayName: "AstryxDrawer", rules: { canMoveIn: () => false } };

export function AstryxSheet(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxSheetBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxSheet as any).craft = { displayName: "AstryxSheet", rules: { canMoveIn: () => false } };

// ─── Charts ───────────────────────────────────────────────────────────────────

export function AstryxBarChart(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxBarChartBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxBarChart as any).craft = { displayName: "AstryxBarChart", rules: { canMoveIn: () => false } };

export function AstryxLineChart(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxLineChartBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxLineChart as any).craft = { displayName: "AstryxLineChart", rules: { canMoveIn: () => false } };

export function AstryxPieChart(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxPieChartBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxPieChart as any).craft = { displayName: "AstryxPieChart", rules: { canMoveIn: () => false } };

// ─── Media ────────────────────────────────────────────────────────────────────

export function AstryxVideoPlayer(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxVideoPlayerBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxVideoPlayer as any).craft = { displayName: "AstryxVideoPlayer", rules: { canMoveIn: () => false } };

export function AstryxCodeBlock(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxCodeBlockBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxCodeBlock as any).craft = { displayName: "AstryxCodeBlock", rules: { canMoveIn: () => false } };

// ─── List ─────────────────────────────────────────────────────────────────────

export function AstryxList({ children, position = "flow", x = 0, y = 0 }: AstryxProps) {
  const { connectRef, isEmpty, selected, isAbsolute, containerVisual, onMouseDown, containerSizeStyle, resizeHandles } = useContainerNode(position, x, y);
  return (
    <div
      ref={connectRef}
      onMouseDown={onMouseDown}
      className="w-full rounded-md border border-gray-200 bg-white divide-y divide-gray-100"
      style={{
        position: "relative",
        minHeight: 48,
        boxSizing: "border-box",
        ...containerVisual,
        ...absPositionStyle(position, x, y),
        ...(isAbsolute ? { cursor: "grab" } : {}),
        ...(selected ? { outline: "2px solid #3b82f6", outlineOffset: 2 } : {}),
        ...containerSizeStyle,
      }}
    >
      {isEmpty ? <div style={{ ...EMPTY_DROP_STYLE, minHeight: 48, flex: "unset" as any }}>drop here</div> : children}
      {resizeHandles}
    </div>
  );
}
(AstryxList as any).craft = { displayName: "AstryxList", isCanvas: true, rules: { canMoveIn: () => true } };

export function AstryxListItem(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  const { editing, onDoubleClick, editOverlay } = useInlineEdit("label", props.label ?? "List item");
  return (
    <div ref={connectRef} style={{ position: "relative", ...extraStyle }} onDoubleClick={onDoubleClick}>
      <div style={editing ? { visibility: "hidden" } : undefined}>
        <AstryxListItemBase {...props} />
      </div>
      {editOverlay}
      {resizeHandles}
    </div>
  );
}
(AstryxListItem as any).craft = { displayName: "AstryxListItem", rules: { canMoveIn: () => false } };

const CELL_EDIT_INPUT_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(255,255,255,0.97)",
  border: "none",
  outline: "2px solid #3b82f6",
  outlineOffset: -1,
  borderRadius: 2,
  padding: "0 4px",
  font: "inherit",
  color: "#111827",
  width: "100%",
  height: "100%",
  cursor: "text",
  zIndex: 100,
  boxSizing: "border-box" as const,
  fontSize: "0.75rem",
};

export function AstryxTable(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  const { actions: { setProp }, nodeSelected } = useNode((node) => ({ nodeSelected: node.events.selected }));
  const zoom = useContext(CanvasZoomContext);

  type EditTarget = { row: number; col: number; isHeader: boolean };
  const [editingCell, setEditingCell] = useState<EditTarget | null>(null);
  const [draft, setDraft] = useState("");
  const cellInputRef = useRef<HTMLInputElement>(null);

  // Live column widths during drag (numeric px, canvas units). null = use prop/auto.
  const [liveColWidths, setLiveColWidths] = useState<(number | null)[]>([]);
  const tableRef = useRef<HTMLTableElement>(null);
  const resizingRef = useRef<{ col: number; startX: number; startW: number } | null>(null);

  const numCols = Math.min(Math.max(1, Number(props.columns ?? 3)), 6);
  const numRows = Math.min(Math.max(1, Number(props.rows ?? 3)), 10);

  const headers: string[] = Array.from({ length: numCols }, (_, i) =>
    (props.headers as string[] | undefined)?.[i] ?? `Col ${i + 1}`
  );
  const cellData: string[][] = Array.from({ length: numRows }, (_, r) =>
    Array.from({ length: numCols }, (_, c) =>
      (props.cellData as string[][] | undefined)?.[r]?.[c] ?? "—"
    )
  );

  // Merge prop widths with live drag widths for rendering.
  const propColWidths: (string | undefined)[] = Array.from({ length: numCols }, (_, i) =>
    (props.colWidths as string[] | undefined)?.[i]
  );
  const colWidths: (string | undefined)[] = Array.from({ length: numCols }, (_, i) => {
    const live = liveColWidths[i];
    if (live != null) return `${live}px`;
    return propColWidths[i];
  });

  useEffect(() => {
    if (editingCell) {
      cellInputRef.current?.focus();
      cellInputRef.current?.select();
    }
  }, [editingCell]);

  // Reset live widths when columns prop changes.
  useEffect(() => {
    setLiveColWidths([]);
  }, [numCols]);

  const startEdit = useCallback((row: number, col: number, isHeader: boolean, currentVal: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (_dragOccurred) return;
    setDraft(currentVal);
    setEditingCell({ row, col, isHeader });
  }, []);

  const commitCell = useCallback(() => {
    if (!editingCell) return;
    const { row, col, isHeader } = editingCell;
    const val = draft;
    if (isHeader) {
      setProp((p: any) => {
        const nC = Math.min(Math.max(1, Number(p.columns ?? 3)), 6);
        const cur: string[] = Array.from({ length: nC }, (_, i) =>
          (p.headers as string[] | undefined)?.[i] ?? `Col ${i + 1}`
        );
        cur[col] = val || `Col ${col + 1}`;
        p.headers = cur;
      });
    } else {
      setProp((p: any) => {
        const nR = Math.min(Math.max(1, Number(p.rows ?? 3)), 10);
        const nC = Math.min(Math.max(1, Number(p.columns ?? 3)), 6);
        const cur: string[][] = Array.from({ length: nR }, (_, r) =>
          Array.from({ length: nC }, (_, c) =>
            (p.cellData as string[][] | undefined)?.[r]?.[c] ?? "—"
          )
        );
        cur[row][col] = val || "—";
        p.cellData = cur;
      });
    }
    setEditingCell(null);
  }, [editingCell, draft, setProp]);

  const discardCell = useCallback(() => setEditingCell(null), []);

  const onResizeMouseDown = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // offsetWidth is the element's layout width in CSS pixels (unaffected by CSS
    // transform: scale). Since the canvas zoom is applied via transform, offsetWidth
    // is already in canvas-pixel units — no zoom division needed for startW.
    // Mouse deltas (clientX) are in screen pixels, so we divide those by zoom.
    const ths = tableRef.current?.querySelectorAll("thead th");
    const th = ths?.[colIndex] as HTMLElement | undefined;
    const startW = th?.offsetWidth ?? 100;
    const z = zoom || 1;

    resizingRef.current = { col: colIndex, startX: e.clientX, startW };

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const { col, startX, startW: sw } = resizingRef.current;
      const delta = (ev.clientX - startX) / z;
      const newW = Math.max(40, Math.round(sw + delta));
      setLiveColWidths((prev) => {
        const next = Array.from({ length: numCols }, (_, i) => prev[i] ?? null);
        next[col] = newW;
        return next;
      });
    };

    const onUp = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const { col, startX, startW: sw } = resizingRef.current;
      const delta = (ev.clientX - startX) / z;
      const newW = Math.max(40, Math.round(sw + delta));

      setProp((p: any) => {
        const nC = Math.min(Math.max(1, Number(p.columns ?? 3)), 6);
        const cur: string[] = Array.from({ length: nC }, (_, i) =>
          (p.colWidths as string[] | undefined)?.[i] ?? ""
        );
        cur[col] = `${newW}px`;
        p.colWidths = cur;
      });

      // Clear live overrides so props.colWidths (now committed) drive rendering,
      // and any subsequent inspector edits are not masked by stale live values.
      setLiveColWidths([]);

      resizingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [zoom, numCols, setProp]);

  const cellInput = (
    <input
      ref={cellInputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitCell}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commitCell(); }
        if (e.key === "Escape") { e.stopPropagation(); discardCell(); }
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={CELL_EDIT_INPUT_STYLE}
    />
  );

  const isResizing = resizingRef.current !== null;

  return (
    <div ref={connectRef} style={extraStyle}>
      <div className="rounded-md border border-gray-200 overflow-hidden w-full">
        <table
          ref={tableRef}
          className="w-full text-sm"
          style={{ tableLayout: colWidths.some(Boolean) ? "fixed" : "auto", userSelect: isResizing ? "none" : undefined }}
        >
          {colWidths.some(Boolean) && (
            <colgroup>
              {colWidths.map((w, i) => (
                <col key={i} style={w ? { width: w } : undefined} />
              ))}
            </colgroup>
          )}
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {headers.map((h, i) => {
                const isEditing = editingCell?.isHeader && editingCell.col === i;
                return (
                  <th
                    key={i}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 relative cursor-default select-none"
                    style={{ minWidth: 60 }}
                    onDoubleClick={(e) => startEdit(-1, i, true, h, e)}
                    title="Double-click to edit"
                  >
                    {isEditing ? cellInput : h}
                    {/* Column resize handle — right border of each header cell */}
                    <span
                      onMouseDown={(e) => onResizeMouseDown(i, e)}
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: 6,
                        height: "100%",
                        cursor: "col-resize",
                        zIndex: 10,
                        userSelect: "none",
                        borderRight: nodeSelected ? "2px solid rgba(59,130,246,0.65)" : undefined,
                        boxSizing: "border-box",
                        transition: "border-color 0.12s",
                      }}
                      title=""
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {cellData.map((row, r) => (
              <tr key={r} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                {row.map((cell, c) => {
                  const isEditing = editingCell && !editingCell.isHeader && editingCell.row === r && editingCell.col === c;
                  return (
                    <td
                      key={c}
                      className="px-3 py-2 text-gray-400 relative cursor-default select-none"
                      style={{ minWidth: 60 }}
                      onDoubleClick={(e) => startEdit(r, c, false, cell, e)}
                      title="Double-click to edit"
                    >
                      {isEditing ? cellInput : cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {resizeHandles}
    </div>
  );
}
(AstryxTable as any).craft = { displayName: "AstryxTable", rules: { canMoveIn: () => false } };

export function AstryxTabs(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxTabsBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxTabs as any).craft = { displayName: "AstryxTabs", rules: { canMoveIn: () => false } };

export function AstryxAccordion(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxAccordionBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxAccordion as any).craft = { displayName: "AstryxAccordion", rules: { canMoveIn: () => false } };

export function AstryxSelect(props: AstryxProps) {
  const { connectRef, extraStyle, resolvedRadius, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxSelectBase {...props} borderRadius={resolvedRadius} />
      {resizeHandles}
    </div>
  );
}
(AstryxSelect as any).craft = { displayName: "AstryxSelect", rules: { canMoveIn: () => false } };

export function AstryxCheckbox(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={{ display: "inline-block", position: "relative", ...extraStyle }}>
      <AstryxCheckboxBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxCheckbox as any).craft = { displayName: "AstryxCheckbox", rules: { canMoveIn: () => false } };

export function AstryxRadioGroup(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxRadioGroupBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxRadioGroup as any).craft = { displayName: "AstryxRadioGroup", rules: { canMoveIn: () => false } };

export function AstryxSlider(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxSliderBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxSlider as any).craft = { displayName: "AstryxSlider", rules: { canMoveIn: () => false } };

export function AstryxCalendar(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxCalendarBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxCalendar as any).craft = { displayName: "AstryxCalendar", rules: { canMoveIn: () => false } };

export function AstryxCommand(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxCommandBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxCommand as any).craft = { displayName: "AstryxCommand", rules: { canMoveIn: () => false } };

export function AstryxCarousel(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxCarouselBase {...props} />
      {resizeHandles}
    </div>
  );
}
(AstryxCarousel as any).craft = { displayName: "AstryxCarousel", rules: { canMoveIn: () => false } };

export function AstryxResizable(props: AstryxProps) {
  const { connectRef, extraStyle, resizeHandles } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxResizableBase {...props} />
      {resizeHandles}
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
  const { connectRef, id, isEmpty, isAbsolute, containerVisual, selected, onMouseDown, containerSizeStyle, resizeHandles } = useContainerNode(position, x, y);
  const isRoot = id === "ROOT";
  const bgOverride = !isRoot && !selected && backgroundColor ? { background: backgroundColor as string } : {};
  return (
    <div
      ref={connectRef}
      onMouseDown={onMouseDown}
      // Marker so InfiniteCanvas can treat clicks on the ROOT's own div as
      // empty-canvas background clicks (panning + deselection). Never use
      // pointer-events:none here — craft.js hit-testing needs this element.
      {...(isRoot ? { "data-canvas-root": "true" } : {})}
      style={isRoot ? {
        position: "relative",
        minWidth: "max(100%, 3000px)",
        minHeight: 2000,
        boxSizing: "border-box",
      } : {
        display: "flex",
        flexDirection: direction as "row" | "column",
        alignItems: ALIGN_MAP[align] ?? "stretch",
        justifyContent: JUSTIFY_MAP[justify] ?? "flex-start",
        gap,
        padding,
        minHeight: 48,
        width: "100%",
        position: "relative",
        boxSizing: "border-box",
        ...containerVisual,
        ...bgOverride,
        ...(textColor ? { color: textColor as string } : {}),
        ...absPositionStyle(position, x, y),
        ...(isAbsolute ? { cursor: "grab" } : {}),
        ...containerSizeStyle,
      }}
    >
      {!isRoot && isEmpty ? <div style={EMPTY_DROP_STYLE}>drop here</div> : children}
      {!isRoot && resizeHandles}
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
  const { connectRef, isEmpty, selected, isAbsolute, containerVisual, onMouseDown, containerSizeStyle, resizeHandles } = useContainerNode(position, x, y);
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
        ...containerSizeStyle,
      }}
    >
      {isEmpty ? <div style={EMPTY_DROP_STYLE}>drop here</div> : children}
      {resizeHandles}
    </div>
  );
}
(AstryxStack as any).craft = { displayName: "AstryxStack", rules: { canMoveIn: () => true } };

export function AstryxHStack({ children, gap = 8, align = "center", justify = "start", position = "flow", x = 0, y = 0, backgroundColor, textColor }: AstryxProps) {
  const { connectRef, isEmpty, selected, isAbsolute, containerVisual, onMouseDown, containerSizeStyle, resizeHandles } = useContainerNode(position, x, y);
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
        ...containerSizeStyle,
      }}
    >
      {isEmpty ? <div style={{ ...EMPTY_DROP_STYLE, minHeight: 32 }}>drop here</div> : children}
      {resizeHandles}
    </div>
  );
}
(AstryxHStack as any).craft = { displayName: "AstryxHStack", rules: { canMoveIn: () => true } };

export function AstryxCard({ children, variant = "elevated", gap = 12, position = "flow", x = 0, y = 0, backgroundColor, textColor, borderRadius: borderRadiusToken }: AstryxProps) {
  const { connectRef, isEmpty, selected, isDragOver, isAbsolute, onMouseDown, containerSizeStyle, resizeHandles } = useContainerNode(position, x, y);
  const resolvedRadius = borderRadiusToken !== undefined ? (RADIUS_TOKEN[borderRadiusToken as string] ?? 8) : undefined;
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
        display: "flex",
        flexDirection: "column",
        gap: Math.max(0, Number(gap) || 0),
        minHeight: 56,
        boxSizing: "border-box",
        ...absPositionStyle(position, x, y),
        ...(isAbsolute ? { cursor: "grab" } : {}),
        ...(!selected && backgroundColor ? { background: backgroundColor as string } : {}),
        ...(textColor ? { color: textColor as string } : {}),
        ...(resolvedRadius !== undefined ? { borderRadius: resolvedRadius } : {}),
        ...(selected ? { outline: "2px solid #3b82f6", outlineOffset: 2 } : {}),
        ...(isDragOver && !selected ? { outline: "1.5px dashed #3b82f6", outlineOffset: 2 } : {}),
        ...containerSizeStyle,
      }}
    >
      {isEmpty
        ? <div style={{ ...EMPTY_DROP_STYLE, minHeight: 48, flex: "unset" as any }}>drop here</div>
        : children}
      {resizeHandles}
    </div>
  );
}
(AstryxCard as any).craft = { displayName: "AstryxCard", isCanvas: true, rules: { canMoveIn: () => true } };

// ─── Artboard ─────────────────────────────────────────────────────────────────
// Named canvas frame — the top-level screen container in the design editor.
// Multiple artboards sit side-by-side inside the ROOT section.

// Resize handle styles (reused across all three handles)
const HANDLE_DOT: CSSProperties = { borderRadius: 2, background: "rgba(0,0,0,0.18)", transition: "background 0.12s" };

export function AstryxArtboard({ children, label = "Artboard", width, height, x = 64, y = 64, direction = "column", gap = 16, padding = 24, align = "stretch", justify = "start", backgroundColor, textColor, backgroundType, backgroundGradient, backgroundImageUrl }: AstryxProps) {
  const zoom = useContext(CanvasZoomContext);
  const { connectors: { connect }, id, actions, isEmpty, selected } = useNode((node) => ({
    isEmpty: node.data.nodes.length === 0,
    selected: node.events.selected,
  }));
  const { actions: editorActions } = useEditor(() => ({}));

  const nodeIdRef = useRef(id);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(String(label));
  const handleERef  = useRef<HTMLDivElement | null>(null);
  const handleSRef  = useRef<HTMLDivElement | null>(null);
  const handleSERef = useRef<HTMLDivElement | null>(null);
  const handleNRef  = useRef<HTMLDivElement | null>(null);
  const handleWRef  = useRef<HTMLDivElement | null>(null);
  const handleNWRef = useRef<HTMLDivElement | null>(null);
  const handleNERef = useRef<HTMLDivElement | null>(null);
  const handleSWRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const editorActionsRef = useRef(editorActions);
  editorActionsRef.current = editorActions;
  // Live snapshot of current dimensions so resize handlers don't close over stale props
  const sizeRef = useRef({ w: Number(width) || 390, h: height != null ? Number(height) : undefined });
  sizeRef.current = { w: Number(width) || 390, h: height != null ? Number(height) : undefined };
  // Live snapshot of current position for drag-to-move
  const posRef = useRef({ x: Number(x) || 0, y: Number(y) || 0 });
  posRef.current = { x: Number(x) || 0, y: Number(y) || 0 };

  useEffect(() => {
    if (isEditingLabel) {
      labelInputRef.current?.focus();
      labelInputRef.current?.select();
    }
  }, [isEditingLabel]);

  const finishLabelEdit = useCallback((save: boolean) => {
    const nextLabel = labelDraft.trim();
    if (save && nextLabel) actionsRef.current.setProp((props: any) => { props.label = nextLabel; });
    setIsEditingLabel(false);
  }, [labelDraft]);

  const artboardConnectRef = useCallback((r: HTMLDivElement | null) => {
    frameRef.current = r;
    if (r) {
      nodeElementRegistry.set(nodeIdRef.current, r);
      connect(r);
    } else {
      nodeElementRegistry.delete(nodeIdRef.current);
    }
  }, [connect]);

  // Returns a native mousedown handler for a resize direction (all 8 compass directions).
  // n/w directions adjust position (x/y) so the opposite edge stays fixed.
  // Uses native MouseEvent so the handler fires before craft.js's listener on the frame.
  type ArtboardResizeDir = "n" | "s" | "e" | "w" | "nw" | "ne" | "se" | "sw";
  const makeResizeHandler = useCallback((dir: ArtboardResizeDir) => (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startW = sizeRef.current.w;
    // Resolve starting height from the stored prop or the live DOM measurement
    const startH = sizeRef.current.h ?? Math.round((frameRef.current?.getBoundingClientRect().height ?? 480) / zoomRef.current);
    // Capture start position so n/w handlers can shift the artboard origin
    const startPX = posRef.current.x;
    const startPY = posRef.current.y;

    const onMove = (ev: MouseEvent) => {
      const z = zoomRef.current;
      const dw = (ev.clientX - startMouseX) / z;
      const dh = (ev.clientY - startMouseY) / z;
      actionsRef.current.setProp((p: any) => {
        // East: right edge expands
        if (dir === "e" || dir === "se" || dir === "ne") {
          p.width = Math.max(100, Math.round(startW + dw));
        }
        // South: bottom edge expands
        if (dir === "s" || dir === "se" || dir === "sw") {
          p.height = Math.max(100, Math.round(startH + dh));
        }
        // West: left edge moves; x shifts so right edge is fixed
        if (dir === "w" || dir === "nw" || dir === "sw") {
          const newW = Math.max(100, Math.round(startW - dw));
          p.width = newW;
          p.x = Math.round(startPX + (startW - newW));
        }
        // North: top edge moves; y shifts so bottom edge is fixed
        if (dir === "n" || dir === "nw" || dir === "ne") {
          const newH = Math.max(100, Math.round(startH - dh));
          p.height = newH;
          p.y = Math.round(startPY + (startH - newH));
        }
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // Attach native mousedown listeners to all resize handle divs.
  // Native child bubble fires before craft.js's listener on the parent frame.
  useEffect(() => {
    const eEl  = handleERef.current;
    const sEl  = handleSRef.current;
    const seEl = handleSERef.current;
    if (!eEl || !sEl || !seEl) return;

    const pairs: [HTMLDivElement, ArtboardResizeDir][] = [
      [eEl,  "e"],
      [sEl,  "s"],
      [seEl, "se"],
    ];
    const extras: [React.RefObject<HTMLDivElement | null>, ArtboardResizeDir][] = [
      [handleNRef,  "n"],
      [handleWRef,  "w"],
      [handleNWRef, "nw"],
      [handleNERef, "ne"],
      [handleSWRef, "sw"],
    ];
    for (const [ref, dir] of extras) {
      if (ref.current) pairs.push([ref.current, dir]);
    }
    const handlers = pairs.map(([el, dir]) => {
      const h = makeResizeHandler(dir);
      el.addEventListener("mousedown", h, { capture: true });
      return [el, h] as [HTMLDivElement, (e: MouseEvent) => void];
    });
    return () => {
      for (const [el, h] of handlers) el.removeEventListener("mousedown", h, { capture: true });
    };
  }, [makeResizeHandler]);

  // Attach native mousedown to the label for drag-to-move.
  useEffect(() => {
    const el = labelRef.current;
    if (!el) return;
    const handle = (e: MouseEvent) => {
      if (isEditingLabel) return;
      e.stopPropagation();
      // Select the artboard when its label is clicked or drag-started.
      editorActionsRef.current.selectNode(nodeIdRef.current);
      const startMX = e.clientX;
      const startMY = e.clientY;
      const { x: startPX, y: startPY } = posRef.current;
      const onMove = (ev: MouseEvent) => {
        const z = zoomRef.current;
        const newX = Math.round(startPX + (ev.clientX - startMX) / z);
        const newY = Math.round(startPY + (ev.clientY - startMY) / z);
        actionsRef.current.setProp((p: any) => { p.x = newX; p.y = newY; });
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
    el.addEventListener("mousedown", handle);
    return () => el.removeEventListener("mousedown", handle);
  }, [isEditingLabel]); // rebind while inline editor is open

  const resolvedHeight = height != null ? Number(height) : undefined;
  const handleColor = selected ? "#3b82f6" : undefined;

  return (
    <div style={{ position: "absolute", left: Number(x) || 0, top: Number(y) || 0 }}>
      <div
        ref={labelRef}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setLabelDraft(String(label));
          setIsEditingLabel(true);
        }}
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: selected ? "#3b82f6" : "var(--muted-foreground)",
          marginBottom: 6,
          paddingLeft: 2,
          userSelect: "none",
          letterSpacing: "0.01em",
          transition: "color 0.15s",
          cursor: isEditingLabel ? "text" : "grab",
        }}
      >
        {isEditingLabel ? (
          <input
            ref={labelInputRef}
            value={labelDraft}
            aria-label="Artboard name"
            onChange={(e) => setLabelDraft(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onBlur={() => finishLabelEdit(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); finishLabelEdit(true); }
              if (e.key === "Escape") { e.preventDefault(); finishLabelEdit(false); }
            }}
            style={{ font: "inherit", color: "inherit", width: "min(220px, 100%)", border: "1px solid #3b82f6", borderRadius: 3, padding: "1px 4px", background: "var(--background)" }}
          />
        ) : label}
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
          height: resolvedHeight,
          minHeight: resolvedHeight != null ? resolvedHeight : 0,
          ...(backgroundType === "gradient" && backgroundGradient
          ? { background: backgroundGradient as string }
          : backgroundType === "image" && backgroundImageUrl
          ? {
              backgroundImage: `url(${backgroundImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundColor: (backgroundColor as string) || "var(--card)",
            }
          : { background: (backgroundColor as string) || "var(--card)" }),
          color: (textColor as string) || undefined,
          borderRadius: 12,
          boxShadow: selected
            ? "0 0 0 2px #3b82f6, 0 4px 24px rgba(0,0,0,0.10)"
            : "0 4px 24px rgba(0,0,0,0.10)",
          position: "relative",
          boxSizing: "border-box",
          transition: "box-shadow 0.15s",
          overflow: "visible",
        }}
      >
        {children}

        {/* ── edge handles ─────────────────────────────────────────────────── */}
        {/* Right */}
        <div ref={handleERef}
          style={{ position: "absolute", top: 0, right: -5, width: 10, bottom: 0, cursor: "ew-resize", zIndex: 20,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...HANDLE_DOT, width: 4, height: 28, ...(handleColor ? { background: handleColor } : {}) }} />
        </div>
        {/* Bottom */}
        <div ref={handleSRef}
          style={{ position: "absolute", left: 0, right: 0, bottom: -5, height: 10, cursor: "ns-resize", zIndex: 20,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...HANDLE_DOT, height: 4, width: 28, ...(handleColor ? { background: handleColor } : {}) }} />
        </div>
        {/* Left */}
        <div ref={handleWRef}
          style={{ position: "absolute", top: 0, left: -5, width: 10, bottom: 0, cursor: "ew-resize", zIndex: 20,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...HANDLE_DOT, width: 4, height: 28, ...(handleColor ? { background: handleColor } : {}) }} />
        </div>
        {/* Top */}
        <div ref={handleNRef}
          style={{ position: "absolute", left: 0, right: 0, top: -5, height: 10, cursor: "ns-resize", zIndex: 20,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...HANDLE_DOT, height: 4, width: 28, ...(handleColor ? { background: handleColor } : {}) }} />
        </div>

        {/* ── corner handles ───────────────────────────────────────────────── */}
        {/* SE (original) */}
        <div ref={handleSERef}
          style={{ position: "absolute", right: -6, bottom: -6, width: 14, height: 14, cursor: "nwse-resize", zIndex: 21,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%",
                        background: handleColor ?? "rgba(0,0,0,0.22)", transition: "background 0.12s" }} />
        </div>
        {/* NW */}
        <div ref={handleNWRef}
          style={{ position: "absolute", left: -6, top: -6, width: 14, height: 14, cursor: "nwse-resize", zIndex: 21,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%",
                        background: handleColor ?? "rgba(0,0,0,0.22)", transition: "background 0.12s" }} />
        </div>
        {/* NE */}
        <div ref={handleNERef}
          style={{ position: "absolute", right: -6, top: -6, width: 14, height: 14, cursor: "nesw-resize", zIndex: 21,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%",
                        background: handleColor ?? "rgba(0,0,0,0.22)", transition: "background 0.12s" }} />
        </div>
        {/* SW */}
        <div ref={handleSWRef}
          style={{ position: "absolute", left: -6, bottom: -6, width: 14, height: 14, cursor: "nesw-resize", zIndex: 21,
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%",
                        background: handleColor ?? "rgba(0,0,0,0.22)", transition: "background 0.12s" }} />
        </div>
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
  // Navigation
  AstryxNavbar,
  AstryxSidebar,
  AstryxBreadcrumb,
  // Overlays
  AstryxModal,
  AstryxDrawer,
  AstryxSheet,
  // Charts
  AstryxBarChart,
  AstryxLineChart,
  AstryxPieChart,
  // Media
  AstryxVideoPlayer,
  AstryxCodeBlock,
  // List
  AstryxList,
  AstryxListItem,
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
// Default Screen 1 starts content-sized; users can set explicit dimensions later.

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
      props: { label: "Screen 1", direction: "column", gap: 16, padding: 24 },
      displayName: "AstryxArtboard",
      custom: {},
      parent: "ROOT",
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
  });
}
