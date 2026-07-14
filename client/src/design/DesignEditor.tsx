import { useState, useEffect, useCallback, useRef, type ReactNode, Component, type ErrorInfo } from "react";
import { Editor, Frame, Element, useEditor } from "@craftjs/core";
import { Trash2, MousePointer2, ChevronDown, ChevronRight, Search, X, Sparkles, Loader2, Check, AlertCircle, ZoomIn, ZoomOut, Maximize2, Plus } from "lucide-react";
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
        className="w-full h-10 overflow-hidden flex items-center justify-center bg-muted/30 rounded-sm mb-1.5"
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

// ─── Toolbox ──────────────────────────────────────────────────────────────────

function DraggableItem({ item, connectors }: { item: ToolboxItem; connectors: any }) {
  return (
    <div
      ref={(ref) => { if (ref) connectors.create(ref, item.getElement()); }}
      className="flex flex-col px-2 pt-2 pb-1.5 rounded-md border border-border bg-background cursor-grab active:cursor-grabbing hover:border-primary/60 hover:bg-primary/5 transition-colors select-none"
    >
      <PreviewThumbnail name={item.name}>
        {item.preview}
      </PreviewThumbnail>
      <span className="font-medium text-foreground text-[11px] leading-tight">{item.name}</span>
      <span className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{item.description}</span>
    </div>
  );
}

function Toolbox() {
  const { connectors } = useEditor(() => ({}));
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCategory = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const trimmed = query.trim().toLowerCase();

  // Filtered flat list for search mode
  const searchResults: ToolboxItem[] = trimmed
    ? TOOLBOX_CATEGORIES.flatMap((cat) =>
        cat.items.filter(
          (item) =>
            item.name.toLowerCase().includes(trimmed) ||
            item.description.toLowerCase().includes(trimmed),
        ),
      )
    : [];

  return (
    <div className="w-56 shrink-0 border-r border-border bg-muted/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <p className="text-xs font-bold text-foreground tracking-wide mb-2">
          Components
        </p>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full pl-6 pr-6 py-1 text-[11px] rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto pb-3 px-2">
        {trimmed ? (
          // ── Search results ───────────────────────────────────────────────
          searchResults.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-6">No matches</p>
          ) : (
            <div className="grid grid-cols-2 gap-1 pt-1">
              {searchResults.map((item) => (
                <DraggableItem key={item.name} item={item} connectors={connectors} />
              ))}
            </div>
          )
        ) : (
          // ── Category list ────────────────────────────────────────────────
          TOOLBOX_CATEGORIES.map((cat) => {
            const isOpen = !collapsed.has(cat.name);
            return (
              <div key={cat.name} className="mb-2">
                <button
                  onClick={() => toggleCategory(cat.name)}
                  className="w-full flex items-center justify-between px-1 py-1.5 rounded hover:bg-accent transition-colors group"
                >
                  <span className="text-[11px] font-bold text-foreground/80 uppercase tracking-wider group-hover:text-foreground transition-colors">
                    {cat.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                      {cat.items.length}
                    </span>
                    {isOpen
                      ? <ChevronDown className="w-3 h-3 text-muted-foreground/60" />
                      : <ChevronRight className="w-3 h-3 text-muted-foreground/60" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="grid grid-cols-2 gap-1 mt-0.5 mb-1">
                    {cat.items.map((item) => (
                      <DraggableItem key={item.name} item={item} connectors={connectors} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Settings panel helpers ───────────────────────────────────────────────────

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

function ComponentProps({ displayName, props, setProp }: { displayName: string; props: Record<string, any>; setProp: (k: string, v: any) => void }) {
  // ── Layout ──────────────────────────────────────────────────────────────
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

  // ── Typography ────────────────────────────────────────────────────────────
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

  // ── Controls ──────────────────────────────────────────────────────────────
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

  // ── Display ───────────────────────────────────────────────────────────────
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

  // ── Feedback ──────────────────────────────────────────────────────────────
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

  // ── Content ───────────────────────────────────────────────────────────────
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

  // ── Form Controls ─────────────────────────────────────────────────────────
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

  // ── Data Display ──────────────────────────────────────────────────────────
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

// ─── Settings panel ───────────────────────────────────────────────────────────

function SettingsPanel() {
  const { selected, actions } = useEditor((state) => {
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
      },
    };
  });

  const setProp = useCallback(
    (key: string, value: any) => {
      if (!selected) return;
      actions.setProp(selected.id, (p: any) => { p[key] = value; });
    },
    [selected, actions],
  );

  return (
    <div className="w-52 shrink-0 border-l border-border bg-muted/30 flex flex-col overflow-y-auto">
      {!selected ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 px-4 py-8 text-center">
          <MousePointer2 className="w-5 h-5 text-muted-foreground/50" />
          <p className="text-[11px] text-muted-foreground leading-tight">Click a component to edit its properties</p>
        </div>
      ) : (
        <>
          <div className="px-3 pt-3 pb-2 flex items-center justify-between border-b border-border shrink-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest truncate">
              {selected.displayName.replace("Astryx", "")}
            </p>
            {!selected.isRoot && (
              <button
                title="Delete"
                onClick={() => actions.delete(selected.id)}
                className="text-destructive/70 hover:text-destructive transition-colors ml-2 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3 px-3 py-3">
            <ComponentProps
              displayName={selected.displayName}
              props={selected.props}
              setProp={setProp}
            />
            {!selected.isRoot && selected.displayName !== "AstryxArtboard" && (
              <>
                <div className="h-px bg-border my-1" />
                <PropRow label="Position">
                  <SelectProp
                    value={selected.props.position ?? "flow"}
                    options={["flow", "absolute"]}
                    onChange={(v) => setProp("position", v)}
                  />
                </PropRow>
                {selected.props.position === "absolute" && (
                  <>
                    <PropRow label="X (px)"><NumberProp value={selected.props.x ?? 0} onChange={(v) => setProp("x", v)} /></PropRow>
                    <PropRow label="Y (px)"><NumberProp value={selected.props.y ?? 0} onChange={(v) => setProp("y", v)} /></PropRow>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Canvas toolbar ───────────────────────────────────────────────────────────

function CanvasToolbar() {
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
    <div className="shrink-0 border-b border-border bg-background/80 px-2 py-1 flex items-center gap-1">
      <button
        onClick={addArtboard}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Add artboard"
      >
        <Plus className="w-3.5 h-3.5" />
        Add artboard
      </button>
    </div>
  );
}

// ─── Infinite canvas (pan + zoom) ────────────────────────────────────────────

function InfiniteCanvas({ children }: { children: ReactNode }) {
  const [pan, setPan] = useState({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(1);
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
      // Ctrl+scroll or pinch-to-zoom → zoom
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom((z) => Math.min(2, Math.max(0.25, z * factor)));
    } else {
      // Two-finger trackpad scroll → pan
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Left-click on the canvas background (not artboard content), middle-click, or space+drag all pan
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

  const resetView = () => { setPan({ x: 80, y: 80 }); setZoom(1); };

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
      {/* Infinite canvas — craft.js Frame renders directly on the grid */}
      <div
        style={{
          position: "absolute",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-0.5 bg-background/90 backdrop-blur-sm border border-border rounded-lg shadow-sm overflow-hidden z-10">
        <button
          onClick={() => setZoom((z) => Math.min(2, z * 1.15))}
          className="px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={resetView}
          className="px-2 py-1 text-[11px] tabular-nums text-muted-foreground hover:text-foreground hover:bg-accent transition-colors min-w-[44px] text-center"
          title="Reset view"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.15, z / 1.15))}
          className="px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={resetView}
          className="px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border-l border-border"
          title="Fit to view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Pan hint */}
      <div className="absolute bottom-3 left-3 text-[10px] text-muted-foreground/40 pointer-events-none select-none z-10">
        Two-finger scroll to pan · Ctrl+scroll or pinch to zoom · Space+drag to pan
      </div>
    </div>
  );
}

// ─── Design AI panel ──────────────────────────────────────────────────────────

function DesignAIPanel() {
  const { actions } = useEditor(() => ({}));
  const [isOpen, setIsOpen] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "applied" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || status === "loading") return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/ai/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Generation failed");
      const sanitized = sanitizeCraftState(data.craftState);
      actions.deserialize(sanitized);
      setStatus("applied");
      setPrompt("");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e.message || "Unknown error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  if (!isOpen) {
    return (
      <div className="shrink-0 border-t border-border bg-background/95 px-3 py-1.5 flex items-center gap-1.5">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Generate</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-border bg-background/95 px-3 py-2 flex items-center gap-2">
      <button
        onClick={() => setIsOpen(false)}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title="Collapse AI panel"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      <Sparkles className="w-3.5 h-3.5 text-primary/60 shrink-0" />
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleGenerate(); }}
        placeholder="Describe a UI to generate…"
        disabled={status === "loading"}
        className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/40 disabled:opacity-50"
      />
      {status === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />}
      {status === "applied" && (
        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 shrink-0">
          <Check className="w-3 h-3" /> Design applied ✓
        </span>
      )}
      {status === "error" && (
        <span className="flex items-center gap-1 text-xs text-destructive shrink-0" title={errorMsg}>
          <AlertCircle className="w-3 h-3" /> {errorMsg ? errorMsg.slice(0, 40) : "Error"}
        </span>
      )}
      <button
        onClick={handleGenerate}
        disabled={!prompt.trim() || status === "loading"}
        className="shrink-0 text-xs px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
      >
        Generate
      </button>
    </div>
  );
}

// ─── Canvas drop area ─────────────────────────────────────────────────────────
// sanitizeCraftState is called here for ALL renders — editable (enabled=true)
// AND view-only (enabled=false) — so unknown component names never produce a
// blank canvas in either mode.  DesignPage.tsx also sanitizes upstream as a
// belt-and-suspenders measure.

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
  const stableSave = useCallback(
    (state: string) => { onSave?.(state); },
    [onSave],
  );

  return (
    <Editor resolver={resolver} enabled={editable}>
      {/* overflow: clip clips visually without creating a scroll container,
          so craft.js pointer events are not blocked by the layout boundary */}
      <div className="flex h-full w-full" style={{ overflow: "clip" }}>
        {editable && <Toolbox />}
        <div className="flex flex-col flex-1 min-w-0">
          {editable && <CanvasToolbar />}
          <InfiniteCanvas>
            <CanvasArea craftState={craftState} />
          </InfiniteCanvas>
          {editable && <DesignAIPanel />}
        </div>
        {editable && <SettingsPanel />}
      </div>
      {editable && onSave && <SaveWatcher onSave={stableSave} />}
    </Editor>
  );
}

export { createEmptyCraftState };
