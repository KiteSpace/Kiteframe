import { useNode } from "@craftjs/core";
import { useEffect, useRef, useContext, useCallback, createContext, type CSSProperties } from "react";
import {
  ALLOWED_CRAFT_COMPONENTS,
  validateCraftState,
  sanitizeCraftState,
} from "./craftValidator";
export type { CraftStateValidationResult } from "./craftValidator";
export { ALLOWED_CRAFT_COMPONENTS, validateCraftState, sanitizeCraftState };
import {
  AstryxButton as AstryxButtonBase,
  AstryxCard as AstryxCardBase,
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

type AstryxProps = Record<string, any>;

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

function useLeafNode() {
  const zoom = useContext(CanvasZoomContext);
  const { connectors: { connect, drag }, actions, selected, nodePosition, nodeX, nodeY } = useNode((node) => ({
    selected: node.events.selected,
    nodePosition: (node.data.props?.position as string) ?? "flow",
    nodeX: (node.data.props?.x as number) ?? 0,
    nodeY: (node.data.props?.y as number) ?? 0,
  }));

  const isAbsolute = nodePosition === "absolute";
  const elementRef = useRef<HTMLElement | null>(null);
  const dragStartRef = useRef<{ mx: number; my: number; sx: number; sy: number } | null>(null);
  const stateRef = useRef({ x: nodeX, y: nodeY, zoom, isAbsolute, setProp: actions.setProp });
  stateRef.current = { x: nodeX, y: nodeY, zoom, isAbsolute, setProp: actions.setProp };

  // Attach a single native mousedown listener on mount so we don't need to
  // touch every individual leaf component's JSX.
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    const handle = (e: MouseEvent) => {
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
        setProp((p: any) => {
          p.x = Math.round(dragStartRef.current!.sx + dx);
          p.y = Math.round(dragStartRef.current!.sy + dy);
        });
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
  }, []); // register once on mount

  const extraStyle: CSSProperties = {
    ...absPositionStyle(nodePosition, nodeX, nodeY),
    ...(selected ? SELECTION_RING : {}),
    ...(isAbsolute ? { cursor: "grab" } : {}),
  };

  // For absolute nodes we skip craft.js `drag` so no snap/alignment indicators
  // appear. Selection still works via `connect`.
  const connectRef = (r: HTMLElement | null) => {
    elementRef.current = r;
    if (!r) return;
    connect(r);
    if (!isAbsolute) drag(r);
  };
  return { connectRef, extraStyle };
}

// ─── Container node hook ──────────────────────────────────────────────────────
// Shared logic for Section / Stack / HStack — provides grey fill, blue
// selected treatment, and free-drag when position === "absolute".

function useContainerNode(position: string, x: number, y: number) {
  const zoom = useContext(CanvasZoomContext);
  const { connectors: { connect, drag }, id, actions, isEmpty, selected } = useNode((node) => ({
    isEmpty: node.data.nodes.length === 0,
    selected: node.events.selected,
  }));

  const isAbsolute = position === "absolute";
  const dragStartRef = useRef<{ mx: number; my: number; sx: number; sy: number } | null>(null);
  const stateRef = useRef({ x, y, zoom, isAbsolute, setProp: actions.setProp });
  stateRef.current = { x, y, zoom, isAbsolute, setProp: actions.setProp };

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
      setProp((p: any) => {
        p.x = Math.round(dragStartRef.current!.sx + dx);
        p.y = Math.round(dragStartRef.current!.sy + dy);
      });
    };
    const onUp = () => {
      dragStartRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []); // stable — reads from stateRef

  const connectRef = (r: HTMLElement | null) => {
    if (!r) return;
    connect(r);
    if (!isAbsolute) drag(r);
  };

  // Default: very light grey fill + subtle dashed outline (makes containers
  // visible on the canvas without being visually heavy).
  // Selected: blue tint + solid blue border (clear selection indicator).
  const containerVisual: CSSProperties = selected
    ? { background: "rgba(59,130,246,0.06)", border: "1.5px solid #3b82f6", borderRadius: 4 }
    : { background: "rgba(0,0,0,0.025)", border: "1px dashed rgba(100,100,100,0.15)", borderRadius: 4 };

  return { connectRef, id, isEmpty, selected, isAbsolute, containerVisual, onMouseDown };
}

// ─── Leaf components ──────────────────────────────────────────────────────────

export function AstryxButton(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={{ display: "inline-block", ...extraStyle }}>
      <AstryxButtonBase {...props} />
    </div>
  );
}
(AstryxButton as any).craft = { displayName: "AstryxButton", rules: { canMoveIn: () => false } };

export function AstryxText(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={{ display: "inline-block", ...extraStyle }}>
      <AstryxTextBase {...props} />
    </div>
  );
}
(AstryxText as any).craft = { displayName: "AstryxText", rules: { canMoveIn: () => false } };

export function AstryxHeading(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxHeadingBase {...props} />
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
  return (
    <div ref={connectRef} style={{ display: "inline-block", ...extraStyle }}>
      <AstryxBadgeBase {...props} />
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
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxBannerBase {...props} />
    </div>
  );
}
(AstryxBanner as any).craft = { displayName: "AstryxBanner", rules: { canMoveIn: () => false } };

export function AstryxEmptyState(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxEmptyStateBase {...props} />
    </div>
  );
}
(AstryxEmptyState as any).craft = { displayName: "AstryxEmptyState", rules: { canMoveIn: () => false } };

export function AstryxChatMessage(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={extraStyle}>
      <AstryxChatMessageBase {...props} />
    </div>
  );
}
(AstryxChatMessage as any).craft = { displayName: "AstryxChatMessage", rules: { canMoveIn: () => false } };

export function AstryxToken(props: AstryxProps) {
  const { connectRef, extraStyle } = useLeafNode();
  return (
    <div ref={connectRef} style={{ display: "inline-block", ...extraStyle }}>
      <AstryxTokenBase {...props} />
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

export function AstryxSection({ children, direction = "column", gap = 16, padding = 16, align = "stretch", justify = "start", position = "flow", x = 0, y = 0 }: AstryxProps) {
  const { connectRef, id, isEmpty, isAbsolute, containerVisual, onMouseDown } = useContainerNode(position, x, y);
  const isRoot = id === "ROOT";
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
        width: "100%",
        position: "relative",
        boxSizing: "border-box",
        ...(!isRoot ? containerVisual : {}),
        ...(!isRoot ? absPositionStyle(position, x, y) : {}),
        ...(isAbsolute && !isRoot ? { cursor: "grab" } : {}),
      }}
    >
      {!isRoot && isEmpty ? <div style={EMPTY_DROP_STYLE}>drop here</div> : children}
    </div>
  );
}
(AstryxSection as any).craft = { displayName: "AstryxSection", rules: { canMoveIn: () => true } };

export function AstryxStack({ children, gap = 8, align = "stretch", justify = "start", position = "flow", x = 0, y = 0 }: AstryxProps) {
  const { connectRef, isEmpty, isAbsolute, containerVisual, onMouseDown } = useContainerNode(position, x, y);
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
        ...absPositionStyle(position, x, y),
        ...(isAbsolute ? { cursor: "grab" } : {}),
      }}
    >
      {isEmpty ? <div style={EMPTY_DROP_STYLE}>drop here</div> : children}
    </div>
  );
}
(AstryxStack as any).craft = { displayName: "AstryxStack", rules: { canMoveIn: () => true } };

export function AstryxHStack({ children, gap = 8, align = "center", justify = "start", position = "flow", x = 0, y = 0 }: AstryxProps) {
  const { connectRef, isEmpty, isAbsolute, containerVisual, onMouseDown } = useContainerNode(position, x, y);
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
        ...absPositionStyle(position, x, y),
        ...(isAbsolute ? { cursor: "grab" } : {}),
      }}
    >
      {isEmpty ? <div style={{ ...EMPTY_DROP_STYLE, minHeight: 32 }}>drop here</div> : children}
    </div>
  );
}
(AstryxHStack as any).craft = { displayName: "AstryxHStack", rules: { canMoveIn: () => true } };

export function AstryxCard({ children, variant = "elevated", position = "flow", x = 0, y = 0 }: AstryxProps) {
  const { connectRef, isEmpty, selected, isAbsolute, onMouseDown } = useContainerNode(position, x, y);
  return (
    <div
      ref={connectRef}
      onMouseDown={onMouseDown}
      style={{
        position: "relative",
        ...absPositionStyle(position, x, y),
        ...(isAbsolute ? { cursor: "grab" } : {}),
        // Card keeps its own card visual; use an outline ring for selection
        ...(selected ? { outline: "2px solid #3b82f6", outlineOffset: 2, borderRadius: 4 } : {}),
      }}
    >
      <AstryxCardBase variant={variant}>
        {isEmpty
          ? <div style={{ ...EMPTY_DROP_STYLE, minHeight: 48, flex: "unset" as any }}>drop here</div>
          : children}
      </AstryxCardBase>
    </div>
  );
}
(AstryxCard as any).craft = { displayName: "AstryxCard", rules: { canMoveIn: () => true } };

// ─── Artboard ─────────────────────────────────────────────────────────────────
// Named canvas frame — the top-level screen container in the design editor.
// Multiple artboards sit side-by-side inside the ROOT section.

export function AstryxArtboard({ children, label = "Artboard", width = 390, direction = "column", gap = 16, padding = 24, align = "stretch", justify = "start" }: AstryxProps) {
  const { connectors: { connect, drag }, isEmpty, selected } = useNode((node) => ({
    isEmpty: node.data.nodes.length === 0,
    selected: node.events.selected,
  }));
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 500,
        color: selected ? "#3b82f6" : "hsl(var(--muted-foreground))",
        marginBottom: 6,
        paddingLeft: 2,
        userSelect: "none",
        letterSpacing: "0.01em",
        transition: "color 0.15s",
      }}>
        {label}
      </div>
      <div
        ref={(r) => { if (r) connect(drag(r)); }}
        style={{
          display: "flex",
          flexDirection: direction as "row" | "column",
          alignItems: ALIGN_MAP[align] ?? "stretch",
          justifyContent: JUSTIFY_MAP[justify] ?? "flex-start",
          gap,
          padding,
          width,
          minHeight: 480,
          background: "hsl(var(--card))",
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
