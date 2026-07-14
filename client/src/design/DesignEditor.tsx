import { useState, useEffect, useCallback, useRef, type ReactNode, Component, type ErrorInfo } from "react";
import { Editor, Frame, Element, useEditor } from "@craftjs/core";
import { Trash2, Search, X, Sparkles, Loader2, AlertCircle, ZoomIn, ZoomOut, Maximize2, ArrowUp } from "lucide-react";
import {
  resolver,
  AstryxSection,
  AstryxStack,
  AstryxHStack,
  AstryxArtboard,
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
  createEmptyCraftState,
  sanitizeCraftState,
  CanvasZoomContext,
} from "./resolver";
import {
  AstryxButton as AstryxButtonBase,
  AstryxCard as AstryxCardBase,
  AstryxText as AstryxTextBase,
  AstryxHeading as AstryxHeadingBase,
  AstryxTextInput as AstryxTextInputBase,
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
  AstryxIcon as AstryxIconBase,
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

// ─── Preview error boundary ────────────────────────────────────────────────────

class PreviewErrorBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_e: Error, _i: ErrorInfo) { /* silent */ }
  render() {
    if (this.state.failed) {
      return (
        <span className="text-[9px] text-muted-foreground/60 italic">{this.props.name}</span>
      );
    }
    return this.props.children;
  }
}

// ─── Preview thumbnail wrapper ────────────────────────────────────────────────

function PreviewThumbnail({ name, children }: { name: string; children: ReactNode }) {
  return (
    <PreviewErrorBoundary name={name}>
      <div
        className="w-full h-[52px] overflow-hidden flex items-center justify-center"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div style={{ transform: "scale(0.65)", transformOrigin: "center center", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {children}
        </div>
      </div>
    </PreviewErrorBoundary>
  );
}

// ─── SaveWatcher ──────────────────────────────────────────────────────────────

function SaveWatcher({ onSave }: { onSave: (state: string) => void }) {
  const { query, store } = useEditor(() => ({}));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedOnce = useRef(false);

  useEffect(() => {
    const unsub = (store as unknown as { subscribe: (cb: () => void) => () => void }).subscribe(() => {
      if (!savedOnce.current) { savedOnce.current = true; return; }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try { onSave(query.serialize()); } catch { /* ignore hydration edge cases */ }
      }, 800);
    });
    return () => { unsub(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, store, onSave]);

  return null;
}

// ─── Toolbox data ─────────────────────────────────────────────────────────────

interface ToolboxItem {
  name: string;
  description: string;
  getElement: () => JSX.Element;
  preview: JSX.Element;
}

interface ToolboxCategory {
  name: string;
  items: ToolboxItem[];
}

const TOOLBOX_CATEGORIES: ToolboxCategory[] = [
  {
    name: "Layout",
    items: [
      {
        name: "Section",  description: "Flex container",
        getElement: () => <Element canvas is={AstryxSection} direction="column" gap={16} padding={16} />,
        preview: (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 110, padding: 6, border: "1px dashed hsl(var(--border))", borderRadius: 6, background: "hsl(var(--muted))" }}>
            <div style={{ height: 8, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ height: 8, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ height: 8, background: "hsl(var(--border))", borderRadius: 3 }} />
          </div>
        ),
      },
      {
        name: "Stack",    description: "Vertical stack",
        getElement: () => <Element canvas is={AstryxStack} gap={8} />,
        preview: (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 80 }}>
            <div style={{ height: 9, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ height: 9, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ height: 9, background: "hsl(var(--border))", borderRadius: 3 }} />
          </div>
        ),
      },
      {
        name: "HStack",   description: "Horizontal stack",
        getElement: () => <Element canvas is={AstryxHStack} gap={8} />,
        preview: (
          <div style={{ display: "flex", flexDirection: "row", gap: 4, alignItems: "center" }}>
            <div style={{ width: 28, height: 12, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ width: 28, height: 12, background: "hsl(var(--border))", borderRadius: 3 }} />
            <div style={{ width: 28, height: 12, background: "hsl(var(--border))", borderRadius: 3 }} />
          </div>
        ),
      },
      {
        name: "Resizable", description: "Split panels",
        getElement: () => <AstryxResizable direction="horizontal" />,
        preview: <AstryxResizableBase direction="horizontal" />,
      },
    ],
  },
  {
    name: "Typography",
    items: [
      {
        name: "Heading",  description: "Bold heading",
        getElement: () => <AstryxHeading size="lg">Heading</AstryxHeading>,
        preview: <AstryxHeadingBase size="lg">Heading</AstryxHeadingBase>,
      },
      {
        name: "Text",     description: "Body copy",
        getElement: () => <AstryxText size="md">Text</AstryxText>,
        preview: <AstryxTextBase size="md">Sample text</AstryxTextBase>,
      },
    ],
  },
  {
    name: "Controls",
    items: [
      {
        name: "Button",     description: "Action button",
        getElement: () => <AstryxButton variant="primary" size="md">Button</AstryxButton>,
        preview: <AstryxButtonBase variant="primary" size="md">Button</AstryxButtonBase>,
      },
      {
        name: "TextInput",  description: "Input field",
        getElement: () => <AstryxTextInput placeholder="Enter text…" />,
        preview: <AstryxTextInputBase placeholder="Enter text…" />,
      },
      {
        name: "Select",     description: "Dropdown",
        getElement: () => <AstryxSelect placeholder="Select…" />,
        preview: <AstryxSelectBase placeholder="Select…" />,
      },
      {
        name: "Checkbox",   description: "Checkbox",
        getElement: () => <AstryxCheckbox label="Option" />,
        preview: <AstryxCheckboxBase label="Option" />,
      },
      {
        name: "RadioGroup", description: "Radio buttons",
        getElement: () => <AstryxRadioGroup options="A,B,C" selected="A" />,
        preview: <AstryxRadioGroupBase options="A,B" selected="A" />,
      },
      {
        name: "Slider",     description: "Range slider",
        getElement: () => <AstryxSlider value={50} />,
        preview: <AstryxSliderBase value={50} />,
      },
    ],
  },
  {
    name: "Data",
    items: [
      {
        name: "Table",     description: "Data table",
        getElement: () => <AstryxTable rows={3} columns={3} />,
        preview: <AstryxTableBase rows={2} columns={3} />,
      },
      {
        name: "Tabs",      description: "Tab bar",
        getElement: () => <AstryxTabs tabs="Tab 1,Tab 2,Tab 3" active="Tab 1" />,
        preview: <AstryxTabsBase tabs="Tab 1,Tab 2" active="Tab 1" />,
      },
      {
        name: "Accordion", description: "Collapsible",
        getElement: () => <AstryxAccordion items="Section 1,Section 2,Section 3" open="Section 1" />,
        preview: <AstryxAccordionBase items="Section 1,Section 2" open="Section 1" />,
      },
      {
        name: "Calendar",  description: "Date picker",
        getElement: () => <AstryxCalendar month="July 2026" />,
        preview: <AstryxCalendarBase month="July 2026" />,
      },
      {
        name: "Command",   description: "Search palette",
        getElement: () => <AstryxCommand placeholder="Search commands…" />,
        preview: <AstryxCommandBase placeholder="Search…" />,
      },
      {
        name: "Carousel",  description: "Slide viewer",
        getElement: () => <AstryxCarousel slides="Slide 1,Slide 2,Slide 3" />,
        preview: <AstryxCarouselBase slides="Slide 1,Slide 2" />,
      },
    ],
  },
  {
    name: "Display",
    items: [
      {
        name: "Card",        description: "Elevated box",
        getElement: () => <Element canvas is={AstryxCard} variant="elevated" />,
        preview: (
          <div style={{ width: 100, padding: "8px 10px", background: "hsl(var(--card))", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.12)", border: "1px solid hsl(var(--border))" }}>
            <div style={{ height: 7, width: "70%", background: "hsl(var(--border))", borderRadius: 3, marginBottom: 5 }} />
            <div style={{ height: 5, width: "90%", background: "hsl(var(--muted))", borderRadius: 3 }} />
          </div>
        ),
      },
      {
        name: "Badge",       description: "Colour label",
        getElement: () => <AstryxBadge color="blue">Badge</AstryxBadge>,
        preview: <AstryxBadgeBase color="blue">Badge</AstryxBadgeBase>,
      },
      {
        name: "Avatar",      description: "User avatar",
        getElement: () => <AstryxAvatar name="AB" size="md" />,
        preview: <AstryxAvatarBase name="AB" size="md" />,
      },
      {
        name: "ProgressBar", description: "Progress bar",
        getElement: () => <AstryxProgressBar value={50} color="blue" />,
        preview: <AstryxProgressBarBase value={60} color="blue" />,
      },
      {
        name: "StatusDot",   description: "Status indicator",
        getElement: () => <AstryxStatusDot status="online" />,
        preview: (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <AstryxStatusDotBase status="online" />
            <span style={{ fontSize: 11, color: "#6b7280" }}>Online</span>
          </div>
        ),
      },
      {
        name: "Skeleton",    description: "Loading skeleton",
        getElement: () => <AstryxSkeleton width={120} height={16} />,
        preview: (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <AstryxSkeletonBase width={90} height={10} />
            <AstryxSkeletonBase width={60} height={10} />
          </div>
        ),
      },
    ],
  },
  {
    name: "Feedback",
    items: [
      {
        name: "Banner",     description: "Alert banner",
        getElement: () => <AstryxBanner variant="info">Message</AstryxBanner>,
        preview: <AstryxBannerBase variant="info">Info banner</AstryxBannerBase>,
      },
      {
        name: "Spinner",    description: "Loading spinner",
        getElement: () => <AstryxSpinner size="md" />,
        preview: <AstryxSpinnerBase size="md" />,
      },
      {
        name: "EmptyState", description: "Empty state",
        getElement: () => <AstryxEmptyState title="Nothing here" />,
        preview: <AstryxEmptyStateBase title="Nothing here" />,
      },
    ],
  },
  {
    name: "Content",
    items: [
      {
        name: "Divider",     description: "Horizontal rule",
        getElement: () => <AstryxDivider />,
        preview: <AstryxDividerBase />,
      },
      {
        name: "ChatMessage", description: "Chat bubble",
        getElement: () => <AstryxChatMessage sender="User">Hello!</AstryxChatMessage>,
        preview: <AstryxChatMessageBase sender="User">Hello!</AstryxChatMessageBase>,
      },
      {
        name: "Token",       description: "Tag / chip",
        getElement: () => <AstryxToken>Tag</AstryxToken>,
        preview: <AstryxTokenBase>Tag</AstryxTokenBase>,
      },
      {
        name: "Icon",        description: "Icon placeholder",
        getElement: () => <AstryxIcon size="md" />,
        preview: <AstryxIconBase size="md" />,
      },
    ],
  },
];

// ─── Draggable tile ───────────────────────────────────────────────────────────

function DraggableItem({ item, connectors }: { item: ToolboxItem; connectors: any }) {
  return (
    <div
      ref={(ref) => { if (ref) connectors.create(ref, item.getElement()); }}
      title={item.description}
      className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-background hover:bg-primary/5 border border-border hover:border-primary/30 cursor-grab active:cursor-grabbing transition-all group shadow-sm hover:shadow-md select-none"
    >
      <div className="w-full rounded-lg border border-border group-hover:border-primary/20 overflow-hidden bg-muted/20">
        <PreviewThumbnail name={item.name}>
          {item.preview}
        </PreviewThumbnail>
      </div>
      <span className="text-[9.5px] text-muted-foreground group-hover:text-primary font-medium leading-none">{item.name}</span>
    </div>
  );
}

// ─── Prop helpers ─────────────────────────────────────────────────────────────

function PropRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function TextProp({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function NumberProp({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      value={value ?? 0}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function SelectProp({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      value={value ?? options[0]}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function ToggleProp({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-8 h-4 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted-foreground/30"} relative`}
    >
      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

// ─── Component-specific props ─────────────────────────────────────────────────

function ComponentProps({ displayName, props, setProp }: { displayName: string; props: Record<string, any>; setProp: (k: string, v: any) => void }) {
  if (displayName === "AstryxSection") return (
    <>
      <PropRow label="Direction"><SelectProp value={props.direction ?? "column"} options={["column","row"]} onChange={(v) => setProp("direction", v)} /></PropRow>
      <PropRow label="Align items"><SelectProp value={props.align ?? "stretch"} options={["start","center","end","stretch"]} onChange={(v) => setProp("align", v)} /></PropRow>
      <PropRow label="Justify"><SelectProp value={props.justify ?? "start"} options={["start","center","end","between","around"]} onChange={(v) => setProp("justify", v)} /></PropRow>
      <PropRow label="Gap (px)"><NumberProp value={props.gap ?? 16} onChange={(v) => setProp("gap", v)} min={0} /></PropRow>
      <PropRow label="Padding (px)"><NumberProp value={props.padding ?? 16} onChange={(v) => setProp("padding", v)} min={0} /></PropRow>
    </>
  );

  if (displayName === "AstryxStack") return (
    <>
      <PropRow label="Align items"><SelectProp value={props.align ?? "stretch"} options={["start","center","end","stretch"]} onChange={(v) => setProp("align", v)} /></PropRow>
      <PropRow label="Justify"><SelectProp value={props.justify ?? "start"} options={["start","center","end","between","around"]} onChange={(v) => setProp("justify", v)} /></PropRow>
      <PropRow label="Gap (px)"><NumberProp value={props.gap ?? 8} onChange={(v) => setProp("gap", v)} min={0} /></PropRow>
    </>
  );

  if (displayName === "AstryxHStack") return (
    <>
      <PropRow label="Align items"><SelectProp value={props.align ?? "center"} options={["start","center","end","stretch"]} onChange={(v) => setProp("align", v)} /></PropRow>
      <PropRow label="Justify"><SelectProp value={props.justify ?? "start"} options={["start","center","end","between","around"]} onChange={(v) => setProp("justify", v)} /></PropRow>
      <PropRow label="Gap (px)"><NumberProp value={props.gap ?? 8} onChange={(v) => setProp("gap", v)} min={0} /></PropRow>
    </>
  );

  if (displayName === "AstryxHeading") return (
    <>
      <PropRow label="Content"><TextProp value={props.children ?? "Heading"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Size"><SelectProp value={props.size ?? "lg"} options={["sm","md","lg","xl","2xl"]} onChange={(v) => setProp("size", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxText") return (
    <>
      <PropRow label="Content"><TextProp value={props.children ?? "Text"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Size"><SelectProp value={props.size ?? "md"} options={["xs","sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
      <PropRow label="Muted">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.muted} onChange={(v) => setProp("muted", v)} />
          <span className="text-xs text-muted-foreground">{props.muted ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxButton") return (
    <>
      <PropRow label="Label"><TextProp value={props.children ?? "Button"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Variant"><SelectProp value={props.variant ?? "primary"} options={["primary","secondary","outline","ghost"]} onChange={(v) => setProp("variant", v)} /></PropRow>
      <PropRow label="Size"><SelectProp value={props.size ?? "md"} options={["sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
      <PropRow label="Disabled">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.disabled} onChange={(v) => setProp("disabled", v)} />
          <span className="text-xs text-muted-foreground">{props.disabled ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxTextInput") return (
    <>
      <PropRow label="Label"><TextProp value={props.label ?? ""} onChange={(v) => setProp("label", v)} /></PropRow>
      <PropRow label="Placeholder"><TextProp value={props.placeholder ?? ""} onChange={(v) => setProp("placeholder", v)} /></PropRow>
      <PropRow label="Disabled">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.disabled} onChange={(v) => setProp("disabled", v)} />
          <span className="text-xs text-muted-foreground">{props.disabled ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxCard") return (
    <PropRow label="Variant"><SelectProp value={props.variant ?? "elevated"} options={["elevated","outlined","ghost"]} onChange={(v) => setProp("variant", v)} /></PropRow>
  );

  if (displayName === "AstryxBadge") return (
    <>
      <PropRow label="Label"><TextProp value={props.children ?? "Badge"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Color"><SelectProp value={props.color ?? "blue"} options={["blue","green","amber","red","gray"]} onChange={(v) => setProp("color", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxAvatar") return (
    <>
      <PropRow label="Name"><TextProp value={props.name ?? "?"} onChange={(v) => setProp("name", v)} /></PropRow>
      <PropRow label="Size"><SelectProp value={props.size ?? "md"} options={["xs","sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxProgressBar") return (
    <>
      <PropRow label="Value (0–100)"><NumberProp value={props.value ?? 50} onChange={(v) => setProp("value", v)} min={0} max={100} /></PropRow>
      <PropRow label="Color"><SelectProp value={props.color ?? "blue"} options={["blue","green","amber","red"]} onChange={(v) => setProp("color", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxStatusDot") return (
    <PropRow label="Status"><SelectProp value={props.status ?? "online"} options={["online","offline","busy","away"]} onChange={(v) => setProp("status", v)} /></PropRow>
  );

  if (displayName === "AstryxSkeleton") return (
    <>
      <PropRow label="Width (px)"><NumberProp value={props.width ?? 120} onChange={(v) => setProp("width", v)} min={8} /></PropRow>
      <PropRow label="Height (px)"><NumberProp value={props.height ?? 16} onChange={(v) => setProp("height", v)} min={4} /></PropRow>
    </>
  );

  if (displayName === "AstryxBanner") return (
    <>
      <PropRow label="Message"><TextProp value={props.children ?? "Banner message"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Variant"><SelectProp value={props.variant ?? "info"} options={["info","success","warning","error"]} onChange={(v) => setProp("variant", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxSpinner") return (
    <PropRow label="Size"><SelectProp value={props.size ?? "md"} options={["sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
  );

  if (displayName === "AstryxEmptyState") return (
    <>
      <PropRow label="Title"><TextProp value={props.title ?? "Nothing here"} onChange={(v) => setProp("title", v)} /></PropRow>
      <PropRow label="Description"><TextProp value={props.description ?? ""} onChange={(v) => setProp("description", v)} /></PropRow>
      <PropRow label="Action label"><TextProp value={props.action ?? ""} onChange={(v) => setProp("action", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxDivider") return (
    <PropRow label="Label"><TextProp value={props.label ?? ""} onChange={(v) => setProp("label", v)} /></PropRow>
  );

  if (displayName === "AstryxChatMessage") return (
    <>
      <PropRow label="Message"><TextProp value={props.children ?? "Hello!"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Sender"><TextProp value={props.sender ?? "User"} onChange={(v) => setProp("sender", v)} /></PropRow>
      <PropRow label="Own message">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.isOwn} onChange={(v) => setProp("isOwn", v)} />
          <span className="text-xs text-muted-foreground">{props.isOwn ? "Yes" : "No"}</span>
        </div>
      </PropRow>
      <PropRow label="Timestamp"><TextProp value={props.timestamp ?? ""} onChange={(v) => setProp("timestamp", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxToken") return (
    <PropRow label="Label"><TextProp value={props.children ?? "Tag"} onChange={(v) => setProp("children", v)} /></PropRow>
  );

  if (displayName === "AstryxIcon") return (
    <>
      <PropRow label="Symbol"><TextProp value={props.name ?? "★"} onChange={(v) => setProp("name", v)} /></PropRow>
      <PropRow label="Size"><SelectProp value={props.size ?? "md"} options={["sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxSelect") return (
    <>
      <PropRow label="Placeholder"><TextProp value={props.placeholder ?? "Select…"} onChange={(v) => setProp("placeholder", v)} /></PropRow>
      <PropRow label="Options (comma-sep)"><TextProp value={props.options ?? "Option A,Option B"} onChange={(v) => setProp("options", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxCheckbox") return (
    <>
      <PropRow label="Label"><TextProp value={props.label ?? "Checkbox"} onChange={(v) => setProp("label", v)} /></PropRow>
      <PropRow label="Checked">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.checked} onChange={(v) => setProp("checked", v)} />
          <span className="text-xs text-muted-foreground">{props.checked ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxRadioGroup") return (
    <>
      <PropRow label="Options (comma-sep)"><TextProp value={props.options ?? "Option A,Option B"} onChange={(v) => setProp("options", v)} /></PropRow>
      <PropRow label="Selected"><TextProp value={props.selected ?? ""} onChange={(v) => setProp("selected", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxSlider") return (
    <>
      <PropRow label="Value"><NumberProp value={props.value ?? 50} onChange={(v) => setProp("value", v)} min={0} max={100} /></PropRow>
      <PropRow label="Min"><NumberProp value={props.min ?? 0} onChange={(v) => setProp("min", v)} min={0} /></PropRow>
      <PropRow label="Max"><NumberProp value={props.max ?? 100} onChange={(v) => setProp("max", v)} min={1} /></PropRow>
    </>
  );

  if (displayName === "AstryxTable") return (
    <>
      <PropRow label="Rows"><NumberProp value={props.rows ?? 3} onChange={(v) => setProp("rows", v)} min={1} max={10} /></PropRow>
      <PropRow label="Columns"><NumberProp value={props.columns ?? 3} onChange={(v) => setProp("columns", v)} min={1} max={6} /></PropRow>
    </>
  );

  if (displayName === "AstryxTabs") return (
    <>
      <PropRow label="Tabs (comma-sep)"><TextProp value={props.tabs ?? "Tab 1,Tab 2,Tab 3"} onChange={(v) => setProp("tabs", v)} /></PropRow>
      <PropRow label="Active tab"><TextProp value={props.active ?? "Tab 1"} onChange={(v) => setProp("active", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxAccordion") return (
    <>
      <PropRow label="Items (comma-sep)"><TextProp value={props.items ?? "Section A,Section B"} onChange={(v) => setProp("items", v)} /></PropRow>
      <PropRow label="Open item"><TextProp value={props.open ?? "Section A"} onChange={(v) => setProp("open", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxCalendar") return (
    <PropRow label="Month"><TextProp value={props.month ?? "July 2026"} onChange={(v) => setProp("month", v)} /></PropRow>
  );

  if (displayName === "AstryxCommand") return (
    <PropRow label="Placeholder"><TextProp value={props.placeholder ?? "Search…"} onChange={(v) => setProp("placeholder", v)} /></PropRow>
  );

  if (displayName === "AstryxCarousel") return (
    <PropRow label="Slides (comma-sep)"><TextProp value={props.slides ?? "Slide 1,Slide 2,Slide 3"} onChange={(v) => setProp("slides", v)} /></PropRow>
  );

  if (displayName === "AstryxResizable") return (
    <PropRow label="Direction"><SelectProp value={props.direction ?? "horizontal"} options={["horizontal","vertical"]} onChange={(v) => setProp("direction", v)} /></PropRow>
  );

  if (displayName === "AstryxArtboard") return (
    <>
      <PropRow label="Label"><TextProp value={props.label ?? "Artboard"} onChange={(v) => setProp("label", v)} /></PropRow>
      <PropRow label="Width (px)"><NumberProp value={props.width ?? 390} onChange={(v) => setProp("width", v)} min={100} /></PropRow>
      <PropRow label="Direction"><SelectProp value={props.direction ?? "column"} options={["column","row"]} onChange={(v) => setProp("direction", v)} /></PropRow>
      <PropRow label="Align items"><SelectProp value={props.align ?? "stretch"} options={["start","center","end","stretch"]} onChange={(v) => setProp("align", v)} /></PropRow>
      <PropRow label="Justify"><SelectProp value={props.justify ?? "start"} options={["start","center","end","between","around"]} onChange={(v) => setProp("justify", v)} /></PropRow>
      <PropRow label="Gap (px)"><NumberProp value={props.gap ?? 16} onChange={(v) => setProp("gap", v)} min={0} /></PropRow>
      <PropRow label="Padding (px)"><NumberProp value={props.padding ?? 24} onChange={(v) => setProp("padding", v)} min={0} /></PropRow>
    </>
  );

  return <p className="text-xs text-muted-foreground">No editable properties.</p>;
}

// ─── Inspect panel (rendered inside left rail when element is selected) ────────

interface SelectedNode {
  id: string;
  displayName: string;
  props: Record<string, any>;
  isRoot: boolean;
}

const COLOR_SWATCHES_MAP: Record<string, string> = {
  blue: "#3b82f6", green: "#10b981", amber: "#f59e0b",
  red: "#ef4444", purple: "#8b5cf6", gray: "#6b7280",
};

const SPACING_PRESETS = [
  { label: "Compact",     sub: "gap 4 · pad 8",   gap: 4,  padding: 8  },
  { label: "Default",     sub: "gap 8 · pad 12",  gap: 8,  padding: 12 },
  { label: "Comfortable", sub: "gap 12 · pad 16", gap: 12, padding: 16 },
  { label: "Spacious",    sub: "gap 20 · pad 24", gap: 20, padding: 24 },
];

const HAS_COLOR_PROP = new Set(["AstryxBadge","AstryxProgressBar"]);
const HAS_VARIANT_DISPLAY = new Set(["AstryxButton","AstryxBanner"]);
const HAS_SIZE_PROP = new Set(["AstryxButton","AstryxBadge","AstryxAvatar","AstryxText","AstryxHeading","AstryxSpinner","AstryxStatusDot","AstryxIcon","AstryxToken","AstryxSelect","AstryxSkeleton"]);
const IS_CONTAINER = new Set(["AstryxSection","AstryxStack","AstryxHStack","AstryxArtboard"]);
const HAS_TYPOGRAPHY = new Set(["AstryxText","AstryxHeading","AstryxButton"]);

function InspectPanel({ selected, actions }: { selected: SelectedNode; actions: any }) {
  const setProp = useCallback(
    (key: string, value: any) => {
      actions.setProp(selected.id, (p: any) => { p[key] = value; });
    },
    [selected.id, actions],
  );

  const dn = selected.displayName;
  const shortName = dn.replace("Astryx", "");
  const isContainer = IS_CONTAINER.has(dn);
  const hasSizeProp = HAS_SIZE_PROP.has(dn);
  const hasTypography = HAS_TYPOGRAPHY.has(dn);

  // Determine active spacing preset for containers
  const activeSpacing = SPACING_PRESETS.find(
    (p) => p.gap === (selected.props.gap ?? 8) && p.padding === (selected.props.padding ?? 12),
  );

  return (
    <div className="flex flex-col overflow-y-auto h-full">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="sticky top-0 bg-background z-10 flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
          <span className="text-[11.5px] font-semibold text-foreground truncate">{shortName}</span>
          <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-medium flex-shrink-0">
            {selected.isRoot ? "root" : "element"}
          </span>
        </div>
        <button
          title="Close inspect panel"
          onClick={() => actions.selectNode(undefined as any)}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 ml-1 text-base leading-none"
        >
          ×
        </button>
      </div>

      {/* ── Color ────────────────────────────────────────────────── */}
      <section className="px-3 py-3 border-b border-border">
        <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Color</div>

        {/* Background swatches — universal */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-muted-foreground w-6 flex-shrink-0 font-medium">BG</span>
          <div className="flex gap-1.5 flex-wrap">
            {["#ffffff","#f8fafc","#1e293b","#000000","#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6"].map((hex) => (
              <button
                key={hex}
                onClick={() => setProp("backgroundColor", hex)}
                title={hex}
                style={{
                  background: hex,
                  boxShadow: selected.props.backgroundColor === hex
                    ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${hex}`
                    : undefined,
                }}
                className="w-5 h-5 rounded-md border border-black/10 transition-all hover:scale-110 flex-shrink-0"
              />
            ))}
          </div>
        </div>

        {/* Text swatches — universal */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-6 flex-shrink-0 font-medium">Text</span>
          <div className="flex gap-1.5 flex-wrap">
            {["#000000","#1e293b","#64748b","#ffffff","#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6"].map((hex) => (
              <button
                key={hex}
                onClick={() => setProp("textColor", hex)}
                title={hex}
                style={{
                  background: hex,
                  boxShadow: selected.props.textColor === hex
                    ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${hex}`
                    : undefined,
                }}
                className="w-5 h-5 rounded-md border border-black/10 transition-all hover:scale-110 flex-shrink-0"
              />
            ))}
          </div>
        </div>

        {/* Component-specific: `color` token (Badge, ProgressBar) */}
        {HAS_COLOR_PROP.has(dn) && (
          <div className="flex gap-1.5 flex-wrap mt-2.5 pt-2.5 border-t border-border">
            {Object.entries(COLOR_SWATCHES_MAP).map(([name, hex]) => (
              <button
                key={name}
                onClick={() => setProp("color", name)}
                title={name}
                style={{
                  background: hex,
                  boxShadow: selected.props.color === name
                    ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${hex}`
                    : undefined,
                }}
                className="w-6 h-6 rounded-lg border border-black/10 transition-all hover:scale-110"
              />
            ))}
          </div>
        )}

        {/* Component-specific: `variant` color (Button, Banner) */}
        {HAS_VARIANT_DISPLAY.has(dn) && dn === "AstryxButton" && (
          <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2.5 border-t border-border">
            {["primary","secondary","outline","ghost"].map((v) => (
              <button
                key={v}
                onClick={() => setProp("variant", v)}
                className={`py-1.5 px-2 rounded-lg border text-[10px] font-medium text-left capitalize transition-all ${
                  selected.props.variant === v
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground bg-background"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
        {HAS_VARIANT_DISPLAY.has(dn) && dn === "AstryxBanner" && (
          <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2.5 border-t border-border">
            {["info","success","warning","error"].map((v) => (
              <button
                key={v}
                onClick={() => setProp("variant", v)}
                className={`py-1.5 px-2 rounded-lg border text-[10px] font-medium text-left capitalize transition-all ${
                  selected.props.variant === v
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground bg-background"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Size & Shape ─────────────────────────────────────────── */}
      <section className="px-3 py-3 border-b border-border">
        <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Size & Shape</div>

        {/* Size token row — for components that have a `size` prop */}
        {hasSizeProp && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-muted-foreground w-8 flex-shrink-0">Size</span>
            <div className="flex gap-1 flex-wrap">
              {(dn === "AstryxText" ? ["xs","sm","md","lg"] :
                dn === "AstryxHeading" ? ["sm","md","lg","xl","2xl"] :
                ["xs","sm","md","lg","xl"]
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => setProp("size", s)}
                  className={`min-w-[28px] h-6 px-1.5 text-[9.5px] rounded-md border font-medium transition-all ${
                    selected.props.size === s
                      ? "bg-foreground border-foreground text-background shadow-sm"
                      : "border-border text-muted-foreground hover:border-muted-foreground bg-background"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Border radius token row — universal */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-8 flex-shrink-0">Radius</span>
          <div className="flex gap-1 flex-wrap">
            {(["None","S","M","L","Full"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setProp("borderRadius", r)}
                className={`min-w-[28px] h-6 px-1.5 text-[9.5px] rounded-md border font-medium transition-all ${
                  (selected.props.borderRadius ?? "M") === r
                    ? "bg-foreground border-foreground text-background shadow-sm"
                    : "border-border text-muted-foreground hover:border-muted-foreground bg-background"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Spacing (containers only) ────────────────────────────── */}
      {isContainer && (
        <section className="px-3 py-3 border-b border-border">
          <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Spacing</div>
          <div className="grid grid-cols-2 gap-1.5">
            {SPACING_PRESETS.map((p) => {
              const isActive = activeSpacing?.label === p.label;
              return (
                <button
                  key={p.label}
                  onClick={() => { setProp("gap", p.gap); setProp("padding", p.padding); }}
                  className={`py-2 px-2 rounded-lg border text-left transition-all ${
                    isActive
                      ? "bg-foreground border-foreground shadow-sm"
                      : "border-border hover:border-muted-foreground hover:bg-accent bg-background"
                  }`}
                >
                  <div className={`text-[10px] font-semibold mb-0.5 ${isActive ? "text-background" : "text-foreground"}`}>{p.label}</div>
                  <div className={`text-[9px] ${isActive ? "text-background/60" : "text-muted-foreground"}`}>{p.sub}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Layout ───────────────────────────────────────────────── */}
      <section className="px-3 py-3 border-b border-border">
        <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Layout</div>

        {/* W / H — always exposed */}
        <div className="grid grid-cols-2 gap-1.5 mb-2.5">
          {[
            ["W", "width",  dn === "AstryxArtboard" ? 390 : dn === "AstryxSkeleton" ? 120 : "auto"],
            ["H", "height", dn === "AstryxSkeleton" ? 16 : "auto"],
          ].map(([label, key, def]) => (
            <div key={label as string} className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg px-2 py-1.5">
              <span className="text-[9.5px] text-muted-foreground font-medium w-3">{label}</span>
              <input
                type={def === "auto" ? "text" : "number"}
                value={selected.props[key as string] ?? def}
                onChange={(e) => {
                  const v = e.target.value;
                  setProp(key as string, v === "auto" || v === "" ? "auto" : Number(v));
                }}
                placeholder="auto"
                className="flex-1 text-[10px] font-mono bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40"
              />
            </div>
          ))}
        </div>

        {/* X / Y + position mode */}
        {!selected.isRoot && dn !== "AstryxArtboard" && (
          <>
            <div className="mb-2">
              <PropRow label="Position">
                <SelectProp
                  value={selected.props.position ?? "flow"}
                  options={["flow","absolute"]}
                  onChange={(v) => setProp("position", v)}
                />
              </PropRow>
            </div>
            <div className="grid grid-cols-2 gap-1.5 mb-2.5">
              {[["X","x",0],["Y","y",0]].map(([label, key, def]) => (
                <div key={label as string} className={`flex items-center gap-1.5 bg-muted/50 border rounded-lg px-2 py-1.5 transition-opacity ${selected.props.position !== "absolute" ? "opacity-40 border-border" : "border-border"}`}>
                  <span className="text-[9.5px] text-muted-foreground font-medium w-3">{label}</span>
                  <input
                    type="number"
                    value={selected.props[key as string] ?? def}
                    onChange={(e) => setProp(key as string, Number(e.target.value))}
                    disabled={selected.props.position !== "absolute"}
                    className="flex-1 text-[10px] font-mono bg-transparent border-none outline-none text-foreground disabled:opacity-50"
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Flex alignment buttons for containers */}
        {isContainer && (
          <div>
            <span className="text-[10px] text-muted-foreground block mb-1.5">Align items</span>
            <div className="flex gap-1">
              {[["⇤","start"],["⇔","center"],["⇥","end"],["↕","stretch"]].map(([icon, a]) => (
                <button
                  key={a}
                  onClick={() => setProp("align", a)}
                  className={`flex-1 h-6 text-[11px] rounded-lg border transition-all ${
                    selected.props.align === a
                      ? "bg-foreground border-foreground text-background"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Typography ───────────────────────────────────────────── */}
      {hasTypography && (
        <section className="px-3 py-3 border-b border-border">
          <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Typography</div>

          {/* Content editable */}
          {(dn === "AstryxText" || dn === "AstryxHeading" || dn === "AstryxButton") && (
            <div className="mb-2.5">
              <PropRow label="Content">
                <TextProp value={selected.props.children ?? ""} onChange={(v) => setProp("children", v)} />
              </PropRow>
            </div>
          )}

          {/* Size token row for text/heading */}
          {(dn === "AstryxText" || dn === "AstryxHeading") && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-muted-foreground w-8 flex-shrink-0">Size</span>
              <div className="flex gap-1">
                {(dn === "AstryxText" ? ["xs","sm","md","lg"] : ["sm","md","lg","xl","2xl"]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setProp("size", s)}
                    className={`min-w-[28px] h-6 px-1.5 text-[9.5px] rounded-md border font-medium transition-all ${
                      selected.props.size === s
                        ? "bg-foreground border-foreground text-background shadow-sm"
                        : "border-border text-muted-foreground hover:border-muted-foreground bg-background"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Font + B/I/U */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center gap-1.5 bg-muted/50 border border-border rounded-lg px-2 py-1.5">
              <span className="text-[10px] text-muted-foreground">Inter</span>
              <span className="text-muted-foreground/40 text-[10px]">▾</span>
            </div>
            <div className="flex gap-0.5">
              {[["B","font-bold"],["I","italic"],["U","underline"]].map(([l, c]) => (
                <button
                  key={l}
                  className={`w-6 h-7 text-[10px] ${c} border border-border rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Properties (component-specific catch-all) ─────────────── */}
      <section className="px-3 py-3">
        <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Properties</div>
        <div className="flex flex-col gap-3">
          <ComponentProps displayName={dn} props={selected.props} setProp={setProp} />
        </div>
      </section>
    </div>
  );
}

// ─── Left rail: Components + Inspect swap ─────────────────────────────────────

function LeftRail() {
  const { connectors, actions, selected } = useEditor((state) => {
    const selectedIds = state.events.selected;
    if (!selectedIds || selectedIds.size === 0) return { selected: null };
    const [nodeId] = Array.from(selectedIds);
    const node = state.nodes[nodeId];
    if (!node) return { selected: null };
    return {
      selected: {
        id: nodeId,
        displayName: node.data.displayName as string,
        props: { ...node.data.props } as Record<string, any>,
        isRoot: nodeId === "ROOT",
      } as SelectedNode,
    };
  });

  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // When user explicitly hits "← Back", force components view even if selection is active
  const [forceComponents, setForceComponents] = useState(false);

  // Auto-show inspect panel whenever a new element is selected
  useEffect(() => {
    if (selected) setForceComponents(false);
  }, [selected?.id]);

  const showInspect = !!selected && !forceComponents;

  const toggleCategory = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const trimmed = query.trim().toLowerCase();
  const searchResults = trimmed
    ? TOOLBOX_CATEGORIES.flatMap((cat) =>
        cat.items.filter(
          (item) =>
            item.name.toLowerCase().includes(trimmed) ||
            item.description.toLowerCase().includes(trimmed),
        ),
      )
    : [];

  return (
    <div
      className="w-[296px] shrink-0 flex flex-col border-r border-border bg-background overflow-hidden"
      style={{ boxShadow: "1px 0 0 hsl(var(--border))" }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold text-foreground">
            {showInspect ? "Inspect" : "Components"}
          </span>
          {showInspect ? (
            <button
              onClick={() => setForceComponents(true)}
              className="flex items-center gap-1 text-[9.5px] text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 rounded-lg px-2 py-1 transition-colors"
            >
              ← Back
            </button>
          ) : (
            <button className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground text-sm" title="Grid view">⊞</button>
          )}
        </div>
        {!showInspect && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full pl-7 pr-6 py-1.5 text-[10px] rounded-xl border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {showInspect ? (
          <InspectPanel selected={selected!} actions={actions} />
        ) : trimmed ? (
          // Search results
          searchResults.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-8">No matches</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 p-2.5 pt-2">
              {searchResults.map((item) => (
                <DraggableItem key={item.name} item={item} connectors={connectors} />
              ))}
            </div>
          )
        ) : (
          // Category list
          <div className="p-2.5 space-y-3.5">
            {TOOLBOX_CATEGORIES.map((cat) => {
              const isOpen = !collapsed.has(cat.name);
              return (
                <div key={cat.name}>
                  <button
                    onClick={() => toggleCategory(cat.name)}
                    className="w-full flex items-center gap-2 mb-1.5 px-0.5 hover:opacity-70 transition-opacity"
                  >
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{cat.name}</span>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[8px] text-muted-foreground/50">{isOpen ? "▴" : "▾"}</span>
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {cat.items.map((item) => (
                        <DraggableItem key={item.name} item={item} connectors={connectors} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Canvas toolbar ───────────────────────────────────────────────────────────

function CanvasToolbar({ zoom, onZoomIn, onZoomOut }: { zoom: number; onZoomIn: () => void; onZoomOut: () => void }) {
  const { actions, query } = useEditor(() => ({}));

  const addArtboard = useCallback(() => {
    const rootNode = query.node("ROOT").get();
    const count = (rootNode?.data?.nodes?.length ?? 0) + 1;
    const nodeTree = query.parseReactElement(
      <Element canvas is={AstryxArtboard} label={`Screen ${count}`} width={390} direction="column" gap={16} padding={24} />
    ).toNodeTree();
    actions.addNodeTree(nodeTree, "ROOT");
  }, [actions, query]);

  return (
    <div className="h-9 shrink-0 border-b border-border bg-background flex items-center px-3 gap-1.5 z-10">
      <button
        onClick={addArtboard}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg px-2 py-1 transition-colors border border-transparent hover:border-border"
        title="Add artboard"
      >
        + Artboard
      </button>
      <div className="w-px h-4 bg-border mx-0.5" />
      {["Layers", "Notes"].map((tab) => (
        <button
          key={tab}
          className="text-[10px] text-muted-foreground/60 hover:text-foreground hover:bg-accent rounded-lg px-2 py-1 transition-colors"
        >
          {tab}
        </button>
      ))}
      <div className="flex-1" />
      <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground border border-border rounded-lg px-1 bg-background">
        <button
          onClick={onZoomOut}
          className="w-5 h-6 flex items-center justify-center hover:text-foreground transition-colors"
          title="Zoom out"
        >
          −
        </button>
        <span className="w-10 text-center font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
        <button
          onClick={onZoomIn}
          className="w-5 h-6 flex items-center justify-center hover:text-foreground transition-colors"
          title="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Canvas selection hints (shown over the canvas) ──────────────────────────

function CanvasHints() {
  const { hasSelection } = useEditor((state) => {
    const sel = state.events.selected;
    return { hasSelection: !!(sel && sel.size > 0) };
  });

  if (hasSelection) {
    return (
      <div className="absolute bottom-14 left-4 z-10 pointer-events-none">
        <div className="flex items-center gap-2 bg-primary text-primary-foreground text-[9.5px] px-3 py-1.5 rounded-full shadow-lg shadow-primary/20 font-medium">
          <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/60 animate-pulse" />
          Properties visible in left panel
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 whitespace-nowrap z-10 pointer-events-none">
      <div className="bg-foreground/80 backdrop-blur-sm text-background text-[10px] px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
        <span>👆</span> Click any element on the canvas to inspect it
      </div>
    </div>
  );
}

// ─── Infinite canvas (pan + zoom) ────────────────────────────────────────────

function InfiniteCanvas({ children, zoom, onZoom }: { children: ReactNode; zoom: number; onZoom: (updater: (z: number) => number) => void }) {
  const [pan, setPan] = useState({ x: 80, y: 80 });
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const spaceDown = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !e.repeat &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        spaceDown.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey) {
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      onZoom((z) => Math.min(2, Math.max(0.25, z * factor)));
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, [onZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const clickedBackground = e.target === e.currentTarget;
    if (e.button === 1 || spaceDown.current || (e.button === 0 && clickedBackground)) {
      e.preventDefault();
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  const resetView = () => { setPan({ x: 80, y: 80 }); onZoom(() => 1); };

  return (
    <div
      className="flex-1 relative overflow-hidden"
      style={{
        backgroundImage: "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        backgroundColor: "hsl(var(--muted) / 0.4)",
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        style={{
          position: "absolute",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <CanvasZoomContext.Provider value={zoom}>
          {children}
        </CanvasZoomContext.Provider>
      </div>

      {/* Canvas selection hints */}
      <CanvasHints />

      {/* Stacked zoom FABs */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={() => onZoom((z) => Math.min(2, z * 1.15))}
          className="w-7 h-7 bg-background border border-border rounded-xl shadow-sm flex items-center justify-center text-muted-foreground hover:bg-accent hover:shadow-md transition-all"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onZoom((z) => Math.max(0.15, z / 1.15))}
          className="w-7 h-7 bg-background border border-border rounded-xl shadow-sm flex items-center justify-center text-muted-foreground hover:bg-accent hover:shadow-md transition-all"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={resetView}
          className="w-7 h-7 bg-background border border-border rounded-xl shadow-sm flex items-center justify-center text-muted-foreground hover:bg-accent hover:shadow-md transition-all"
          title="Fit view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={resetView}
          className="w-7 h-7 bg-background border border-border rounded-xl shadow-sm flex items-center justify-center text-muted-foreground hover:bg-accent hover:shadow-md transition-all text-xs"
          title="Reset view"
        >
          ⤢
        </button>
      </div>

      {/* Pan hint */}
      <div className="absolute bottom-4 left-4 text-[10px] text-muted-foreground/40 pointer-events-none select-none z-10">
        Two-finger scroll to pan · Ctrl+scroll to zoom · Space+drag to pan
      </div>
    </div>
  );
}

// ─── AI drawer (right rail, collapsible) ─────────────────────────────────────

interface AIMessage { role: "ai" | "user"; text: string; }

const INITIAL_MESSAGES: AIMessage[] = [
  {
    role: "ai",
    text: "Hi! I can add components to your artboards or modify existing ones — just describe what you want. If you ask for something outside the Astryx component library I'll let you know and suggest an alternative.",
  },
];

function AIDrawer() {
  const { actions, query } = useEditor(() => ({}));

  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem("design-ai-drawer-open") !== "false"; } catch { return true; }
  });
  const [messages, setMessages] = useState<AIMessage[]>(INITIAL_MESSAGES);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v;
      try { localStorage.setItem("design-ai-drawer-open", String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || status === "loading") return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setPrompt("");
    setStatus("loading");
    try {
      // Capture the current canvas state so KiteAI can patch rather than replace
      let currentCraftState: string | undefined;
      try {
        const serialized = query.serialize();
        // Only send if there's meaningful content (more than an empty object)
        if (serialized && serialized.length > 10) currentCraftState = serialized;
      } catch { /* ignore if serialize fails */ }

      const res = await fetch("/api/ai/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, currentCraftState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Generation failed");

      if (data.type === "message") {
        // KiteAI replied with a conversational message — no canvas change
        setMessages((prev) => [...prev, { role: "ai", text: data.text }]);
      } else if (data.type === "patch") {
        // Additive patch: merge new/changed nodes into the existing canvas state
        const patchNodes: Record<string, unknown> = JSON.parse(data.nodes);
        let existingState: Record<string, unknown> = {};
        try {
          existingState = JSON.parse(query.serialize());
        } catch { /* start from empty if serialize fails */ }
        const merged = { ...existingState, ...patchNodes };
        const sanitized = sanitizeCraftState(JSON.stringify(merged));
        actions.deserialize(sanitized);
        const addedCount = Object.keys(patchNodes).length;
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: `Done! Added ${addedCount} element${addedCount !== 1 ? "s" : ""} to your canvas.` },
        ]);
      } else {
        // Full state replacement (type === "state" or legacy response without type)
        const craftStateStr = data.craftState ?? data;
        const sanitized = sanitizeCraftState(
          typeof craftStateStr === "string" ? craftStateStr : JSON.stringify(craftStateStr)
        );
        actions.deserialize(sanitized);
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: "Design created! I've built the layout on your canvas." },
        ]);
      }
      setStatus("idle");
    } catch (e: any) {
      setStatus("error");
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: `Something went wrong: ${e.message?.slice(0, 120) ?? "Unknown error"}` },
      ]);
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <div
      className={`relative flex-shrink-0 border-l border-border bg-background flex flex-col transition-all duration-200 ease-in-out ${open ? "w-[252px]" : "w-12"}`}
    >
      {/* Toggle tab on left edge */}
      <button
        onClick={toggleOpen}
        className="absolute -left-3.5 top-16 w-7 h-9 bg-background border border-border rounded-l-xl flex items-center justify-center shadow-sm hover:bg-primary/5 hover:border-primary/40 hover:text-primary text-muted-foreground z-20 transition-all text-xs font-bold"
        title={open ? "Collapse AI panel" : "Open AI panel"}
      >
        {open ? "›" : "‹"}
      </button>

      {!open ? (
        // Collapsed icon strip
        <div className="flex flex-col items-center pt-4 gap-3 px-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white text-[9px] font-bold shadow-md">
            AI
          </div>
          <div className="w-2 h-2 rounded-full bg-green-400 shadow-sm" />
          <Sparkles className="w-4 h-4 text-muted-foreground/40 mt-1" />
        </div>
      ) : (
        <div className="flex flex-col h-full min-h-0">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
            <div className="w-6 h-6 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white text-[9px] font-bold shadow-sm">
              AI
            </div>
            <div>
              <div className="text-[11px] font-semibold text-foreground leading-none">KiteAI</div>
              <div className="text-[9px] text-green-500 font-medium leading-none mt-0.5">● Active</div>
            </div>
            <div className="flex-1" />
            {status === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
            {status === "error" && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-0">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-1.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "ai" && (
                  <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary to-violet-600 flex-shrink-0 mt-0.5 shadow-sm" />
                )}
                <div className={`max-w-[85%] px-2.5 py-2 text-[10px] leading-snug rounded-2xl ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {status === "loading" && (
              <div className="flex gap-1.5 justify-start">
                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary to-violet-600 flex-shrink-0 mt-0.5 opacity-50" />
                <div className="bg-muted px-3 py-2 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="px-2.5 py-2.5 border-t border-border shrink-0">
            <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-xl px-2.5 py-1.5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                placeholder="Ask KiteAI to add or change something…"
                disabled={status === "loading"}
                className="flex-1 text-[10px] bg-transparent border-none outline-none placeholder:text-muted-foreground/50 disabled:opacity-50 min-w-0"
              />
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || status === "loading"}
                className="w-6 h-6 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground flex items-center justify-center transition-colors flex-shrink-0"
                title="Send"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Canvas drop area ─────────────────────────────────────────────────────────

function CanvasArea({ craftState }: { craftState: string | null }) {
  if (craftState) {
    return <Frame data={sanitizeCraftState(craftState)} />;
  }
  return (
    <Frame>
      <Element canvas is={AstryxSection} direction="row" gap={80} padding={40} align="start" justify="start">
        <Element canvas is={AstryxArtboard} label="Screen 1" width={390} direction="column" gap={16} padding={24}>
          {null}
        </Element>
      </Element>
    </Frame>
  );
}

// ─── DesignEditor ─────────────────────────────────────────────────────────────

export interface DesignEditorProps {
  editable: boolean;
  craftState: string | null;
  onSave?: (state: string) => void;
}

export function DesignEditor({ editable, craftState, onSave }: DesignEditorProps) {
  const [zoom, setZoom] = useState(1);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(2, z * 1.15)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.15, z / 1.15)), []);

  const stableSave = useCallback(
    (state: string) => { onSave?.(state); },
    [onSave],
  );

  return (
    <Editor resolver={resolver} enabled={editable}>
      <div className="flex h-full w-full" style={{ overflow: "clip" }}>
        {editable && <LeftRail />}
        <div className="flex flex-col flex-1 min-w-0">
          {editable && <CanvasToolbar zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} />}
          <InfiniteCanvas zoom={zoom} onZoom={setZoom}>
            <CanvasArea craftState={craftState} />
          </InfiniteCanvas>
        </div>
        {editable && <AIDrawer />}
      </div>
      {editable && onSave && <SaveWatcher onSave={stableSave} />}
    </Editor>
  );
}

export { createEmptyCraftState };
