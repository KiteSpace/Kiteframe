import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, type ReactNode, Component, type ErrorInfo, createContext, useContext } from "react";
import { Editor, Frame, Element, useEditor } from "@craftjs/core";
import { Trash2, Search, X, Loader2, AlertCircle, ZoomIn, ZoomOut, Maximize2, ArrowUp, Layers, Square, Type, AlignLeft, LayoutTemplate, Minus, ToggleLeft, ChevronRight, ChevronLeft, ChevronDown, StickyNote, ListTree, Sparkles, MessageCirclePlus, Upload, ImagePlus, LayoutGrid, LayoutList } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
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
  validateCraftState,
  CanvasZoomContext,
  SnapGuideContext,
} from "./resolver";
import { ImportDesignModal } from "./ImportDesignModal";
import { skeletonizeCraftState } from "./lib/craftStateSkeleton";
import { applyContrastColors, contrastTextFor } from "./lib/contrastColor";
import { useToast } from "@/hooks/use-toast";
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
  ICON_GLYPHS,
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

interface SaveWatcherProps {
  /** Called by the 800 ms debounce — normal in-session save. */
  onSave: (state: string) => void;
  /**
   * Called only from the `beforeunload` flush.  Use a keepalive/sendBeacon
   * transport here so the request is not cancelled when the page navigates.
   * Falls back to `onSave` when not provided.
   */
  onBeforeUnloadSave?: (state: string) => void;
}

function SaveWatcher({ onSave, onBeforeUnloadSave }: SaveWatcherProps) {
  const { query, store } = useEditor(() => ({}));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedOnce = useRef(false);
  const pendingSave = useRef<string | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onBeforeUnloadSaveRef = useRef(onBeforeUnloadSave);
  onBeforeUnloadSaveRef.current = onBeforeUnloadSave;

  useEffect(() => {
    const unsub = (store as unknown as { subscribe: (cb: () => void) => () => void }).subscribe(() => {
      if (!savedOnce.current) { savedOnce.current = true; return; }
      if (timerRef.current) clearTimeout(timerRef.current);
      let serialized: string | null = null;
      try { serialized = query.serialize(); } catch { /* ignore */ }
      pendingSave.current = serialized;
      if (serialized) {
        timerRef.current = setTimeout(() => {
          if (pendingSave.current) {
            try { onSaveRef.current(pendingSave.current); } catch { /* ignore */ }
            pendingSave.current = null;
          }
        }, 800);
      }
    });

    // Called when the page is about to unload.  Uses the keepalive transport
    // so the request completes even after the browser navigates away.
    const handleBeforeUnload = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingSave.current) {
        const state = pendingSave.current;
        pendingSave.current = null;
        try {
          const flushFn = onBeforeUnloadSaveRef.current ?? onSaveRef.current;
          flushFn(state);
        } catch { /* ignore */ }
      }
    };

    // Called when the component unmounts (tab hidden, editor closed).
    // Prefer the keepalive transport (same as beforeunload) so that a fast
    // navigation — e.g. switching to the home screen before the 800 ms debounce
    // fires — doesn't silently drop a pending craft-state save.
    const flushOnUnmount = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingSave.current) {
        const state = pendingSave.current;
        pendingSave.current = null;
        try {
          const flushFn = onBeforeUnloadSaveRef.current ?? onSaveRef.current;
          flushFn(state);
        } catch { /* ignore */ }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      flushOnUnmount();
      unsub();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [query, store]);

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

// ─── Draggable list-row (used in list view) ────────────────────────────────────

function DraggableListItem({ item, connectors }: { item: ToolboxItem; connectors: any }) {
  return (
    <div
      ref={(ref) => { if (ref) connectors.create(ref, item.getElement()); }}
      title={item.description}
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-primary/5 border border-transparent hover:border-primary/20 cursor-grab active:cursor-grabbing transition-all group select-none"
    >
      {/* Miniature preview thumbnail */}
      <div className="w-10 h-7 shrink-0 rounded border border-border/60 bg-muted/30 overflow-hidden flex items-center justify-center" style={{ pointerEvents: "none" }}>
        <PreviewErrorBoundary name={item.name}>
          <div style={{ transform: "scale(0.38)", transformOrigin: "center center", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", userSelect: "none" }}>
            {item.preview}
          </div>
        </PreviewErrorBoundary>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10.5px] font-medium text-foreground group-hover:text-primary leading-tight truncate">{item.name}</div>
        <div className="text-[9px] text-muted-foreground/70 leading-tight truncate">{item.description}</div>
      </div>
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

function TextProp({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      value={value ?? ""}
      placeholder={placeholder}
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

const ICON_ENTRIES = Object.entries(ICON_GLYPHS);

function IconPickerProp({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const currentGlyph = ICON_GLYPHS[value.toLowerCase().trim()] ?? (value.charAt(0).toUpperCase() || "⬡");
  const filtered = search.trim()
    ? ICON_ENTRIES.filter(([name]) => name.includes(search.toLowerCase()))
    : ICON_ENTRIES;
  return (
    <div className="flex items-center gap-2 w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-1.5 rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted transition-colors"
            title="Browse icons"
          >
            <span className="text-base leading-none">{currentGlyph}</span>
            <span className="text-muted-foreground">{value || "star"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <input
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Search icons…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="grid grid-cols-6 gap-1 max-h-40 overflow-y-auto">
            {filtered.map(([name, glyph]) => (
              <button
                key={name}
                title={name}
                onClick={() => { onChange(name); setOpen(false); setSearch(""); }}
                className={`flex flex-col items-center justify-center rounded p-1.5 text-center hover:bg-muted transition-colors ${value === name ? "bg-primary/10 ring-1 ring-primary" : ""}`}
              >
                <span className="text-base leading-none">{glyph}</span>
                <span className="text-[8px] text-muted-foreground truncate w-full text-center mt-0.5">{name}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <input
        className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        value={value}
        placeholder="custom name"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── Component-specific props ─────────────────────────────────────────────────

const BG_SWATCHES = ["#ffffff","#f8fafc","#1e293b","#0f172a","#000000","#3b82f6","#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899"];

function ArtboardBackgroundPicker({ props, setProp }: { props: Record<string, any>; setProp: (k: string, v: any) => void }) {
  const activeType: "color" | "gradient" | "image" = props.backgroundType ?? "color";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState<string>(props.backgroundImageUrl ?? "");

  const grad1 = props._gradStop1 ?? "#3b82f6";
  const grad2 = props._gradStop2 ?? "#8b5cf6";
  const gradAngle = props._gradAngle ?? 135;
  const updateGradient = (stop1: string, stop2: string, angle: number) => {
    setProp("_gradStop1", stop1);
    setProp("_gradStop2", stop2);
    setProp("_gradAngle", angle);
    setProp("backgroundGradient", `linear-gradient(${angle}deg, ${stop1}, ${stop2})`);
  };

  const switchType = (t: "color" | "gradient" | "image") => {
    setProp("backgroundType", t);
    if (t === "gradient") {
      updateGradient(grad1, grad2, gradAngle);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (url) { setProp("backgroundImageUrl", url); setUrlInput(""); }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const applyUrl = () => {
    const trimmed = urlInput.trim();
    if (trimmed) { setProp("backgroundImageUrl", trimmed); }
  };

  const pill = (t: "color" | "gradient" | "image", label: string) => (
    <button
      onClick={() => switchType(t)}
      className={`flex-1 py-0.5 text-[10px] font-medium rounded transition-colors ${
        activeType === t
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <PropRow label="Background">
      <div className="flex gap-0.5 rounded-md border border-border p-0.5 mb-2">
        {pill("color", "Color")}
        {pill("gradient", "Gradient")}
        {pill("image", "Image")}
      </div>

      {activeType === "color" && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setProp("backgroundColor", undefined)}
            title="Default"
            style={{
              backgroundImage: "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)",
              backgroundSize: "6px 6px",
              backgroundPosition: "0 0,0 3px,3px -3px,-3px 0px",
              backgroundColor: "#fff",
              boxShadow: !props.backgroundColor
                ? "0 0 0 2px hsl(var(--background)), 0 0 0 3.5px #3b82f6"
                : undefined,
            }}
            className="w-5 h-5 rounded-md border border-black/10 transition-all hover:scale-110 flex-shrink-0"
          />
          {BG_SWATCHES.map((hex) => (
            <button
              key={hex}
              onClick={() => setProp("backgroundColor", hex)}
              title={hex}
              style={{
                background: hex,
                boxShadow: props.backgroundColor === hex
                  ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${hex}`
                  : undefined,
              }}
              className="w-5 h-5 rounded-md border border-black/10 transition-all hover:scale-110 flex-shrink-0"
            />
          ))}
          <input
            type="color"
            value={props.backgroundColor && props.backgroundColor !== "transparent" ? props.backgroundColor : "#ffffff"}
            onChange={(e) => setProp("backgroundColor", e.target.value)}
            title="Custom color"
            className="w-5 h-5 rounded-md border border-black/10 cursor-pointer flex-shrink-0 p-0"
            style={{ appearance: "none", padding: 0 }}
          />
        </div>
      )}

      {activeType === "gradient" && (
        <div className="flex flex-col gap-2">
          <div
            className="w-full h-8 rounded-md border border-border"
            style={{ background: `linear-gradient(${gradAngle}deg, ${grad1}, ${grad2})` }}
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-10 flex-shrink-0">Stop 1</span>
            <input type="color" value={grad1} onChange={(e) => updateGradient(e.target.value, grad2, gradAngle)}
              className="w-6 h-5 rounded border border-black/10 cursor-pointer flex-shrink-0 p-0" />
            <span className="text-[10px] font-mono text-muted-foreground">{grad1}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-10 flex-shrink-0">Stop 2</span>
            <input type="color" value={grad2} onChange={(e) => updateGradient(grad1, e.target.value, gradAngle)}
              className="w-6 h-5 rounded border border-black/10 cursor-pointer flex-shrink-0 p-0" />
            <span className="text-[10px] font-mono text-muted-foreground">{grad2}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-10 flex-shrink-0">Angle</span>
            <input
              type="range" min={0} max={360} value={gradAngle}
              onChange={(e) => updateGradient(grad1, grad2, Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{gradAngle}°</span>
          </div>
        </div>
      )}

      {activeType === "image" && (
        <div className="flex flex-col gap-2">
          {props.backgroundImageUrl ? (
            <>
              <div className="relative w-full h-16 rounded-md border border-border overflow-hidden">
                <img src={props.backgroundImageUrl} alt="bg" className="w-full h-full object-cover" />
                <button
                  onClick={() => { setProp("backgroundImageUrl", undefined); setUrlInput(""); }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[11px] flex items-center justify-center hover:bg-black/80 transition-colors"
                  title="Remove image"
                >×</button>
              </div>
            </>
          ) : (
            <>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 text-[10px] rounded-md border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                ↑ Upload image
              </button>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyUrl(); }}
                  placeholder="Paste image URL…"
                  className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={applyUrl}
                  className="px-2 py-1 text-[10px] rounded border border-border bg-muted hover:bg-accent transition-colors flex-shrink-0"
                >Use</button>
              </div>
            </>
          )}
        </div>
      )}
    </PropRow>
  );
}

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
      <PropRow label="Icon">
        <IconPickerProp value={String(props.name ?? "star")} onChange={(v) => setProp("name", v)} />
      </PropRow>
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

  if (displayName === "AstryxTable") {
    const handleRowsChange = (v: number) => {
      const nR = Math.min(Math.max(1, v), 10);
      const nC = Math.min(Math.max(1, Number(props.columns ?? 3)), 6);
      const existing = (props.cellData as string[][] | undefined) ?? [];
      const newCellData: string[][] = Array.from({ length: nR }, (_, r) =>
        Array.from({ length: nC }, (_, c) => existing[r]?.[c] ?? "—")
      );
      setProp("rows", nR);
      setProp("cellData", newCellData);
    };
    const handleColsChange = (v: number) => {
      const nR = Math.min(Math.max(1, Number(props.rows ?? 3)), 10);
      const nC = Math.min(Math.max(1, v), 6);
      const existingCells = (props.cellData as string[][] | undefined) ?? [];
      const existingHeaders = (props.headers as string[] | undefined) ?? [];
      const existingColWidths = (props.colWidths as string[] | undefined) ?? [];
      const newCellData: string[][] = Array.from({ length: nR }, (_, r) =>
        Array.from({ length: nC }, (_, c) => existingCells[r]?.[c] ?? "—")
      );
      const newHeaders: string[] = Array.from({ length: nC }, (_, i) =>
        existingHeaders[i] ?? `Col ${i + 1}`
      );
      const newColWidths: string[] = Array.from({ length: nC }, (_, i) =>
        existingColWidths[i] ?? ""
      );
      setProp("columns", nC);
      setProp("cellData", newCellData);
      setProp("headers", newHeaders);
      setProp("colWidths", newColWidths);
    };
    const handleReset = () => {
      const nR = Math.min(Math.max(1, Number(props.rows ?? 3)), 10);
      const nC = Math.min(Math.max(1, Number(props.columns ?? 3)), 6);
      setProp("cellData", Array.from({ length: nR }, () => Array.from({ length: nC }, () => "—")));
      setProp("headers", Array.from({ length: nC }, (_, i) => `Col ${i + 1}`));
    };
    const handleColWidthsChange = (raw: string) => {
      const nC = Math.min(Math.max(1, Number(props.columns ?? 3)), 6);
      const parts = raw.split(",").map((s) => s.trim());
      const widths: string[] = Array.from({ length: nC }, (_, i) => parts[i] ?? "");
      setProp("colWidths", widths);
    };
    const colWidthsValue = ((props.colWidths as string[] | undefined) ?? []).join(", ");
    return (
      <>
        <PropRow label="Rows"><NumberProp value={props.rows ?? 3} onChange={handleRowsChange} min={1} max={10} /></PropRow>
        <PropRow label="Columns"><NumberProp value={props.columns ?? 3} onChange={handleColsChange} min={1} max={6} /></PropRow>
        <PropRow label="Col widths">
          <TextProp
            value={colWidthsValue}
            onChange={handleColWidthsChange}
            placeholder="e.g. 80px, 200px, 120px"
          />
        </PropRow>
        <PropRow label="Cells">
          <button
            onClick={handleReset}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Reset to "—"
          </button>
        </PropRow>
      </>
    );
  }

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
      <PropRow label="Width (px)">
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {(props.width != null && props.width !== "auto") && (
            <NumberProp value={Number(props.width)} onChange={(v) => setProp("width", v)} min={100} />
          )}
          <button
            onClick={() => setProp("width", (props.width == null || props.width === "auto") ? 390 : undefined)}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors flex-shrink-0 ${
              props.width == null || props.width === "auto"
                ? "border-blue-400 text-blue-500 bg-blue-50 dark:bg-blue-950 dark:text-blue-400"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
            }`}
          >
            Auto
          </button>
        </div>
      </PropRow>
      <PropRow label="Height (px)">
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {props.height != null && (
            <NumberProp value={props.height} onChange={(v) => setProp("height", v)} min={100} />
          )}
          <button
            onClick={() => setProp("height", props.height != null ? undefined : 480)}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors flex-shrink-0 ${
              props.height == null
                ? "border-blue-400 text-blue-500 bg-blue-50 dark:bg-blue-950 dark:text-blue-400"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
            }`}
          >
            Auto
          </button>
        </div>
      </PropRow>
      <PropRow label="X (px)"><NumberProp value={props.x ?? 64} onChange={(v) => setProp("x", v)} min={0} /></PropRow>
      <PropRow label="Y (px)"><NumberProp value={props.y ?? 64} onChange={(v) => setProp("y", v)} min={0} /></PropRow>
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
const HAS_SIZE_PROP = new Set(["AstryxButton","AstryxBadge","AstryxAvatar","AstryxText","AstryxHeading","AstryxSpinner","AstryxStatusDot","AstryxIcon","AstryxToken","AstryxSelect"]);
const IS_CONTAINER = new Set(["AstryxSection","AstryxStack","AstryxHStack","AstryxArtboard"]);
const NO_RADIUS = new Set(["AstryxBadge","AstryxAvatar","AstryxSkeleton","AstryxSpinner"]);
const HAS_TYPOGRAPHY = new Set(["AstryxText","AstryxHeading","AstryxButton"]);

function InspectPanel({ selected, actions }: { selected: SelectedNode; actions: any }) {
  const { query } = useEditor(() => ({}));

  const setProp = useCallback(
    (key: string, value: any) => {
      actions.setProp(selected.id, (p: any) => {
        p[key] = value;
        // When the user manually sets a text color, mark it as user-owned so
        // auto-contrast won't overwrite it on future background changes.
        if (key === "color") p._autoColor = false;
      });

      // Auto-apply contrast whenever backgroundColor changes on a container.
      // Uses history.ignore() so auto-contrast changes don't pollute the undo stack.
      if (key === "backgroundColor" && typeof value === "string" && value !== "transparent") {
        const isContainerNode = IS_CONTAINER.has(selected.displayName) || selected.displayName === "AstryxCard";
        if (isContainerNode) {
          try {
            // Build a patched snapshot of the canvas with the new backgroundColor applied,
            // then run applyContrastColors on the full subtree so nested containers are
            // respected — each text leaf derives its color from its nearest ancestor's BG.
            const allNodes = JSON.parse(query.serialize()) as Record<string, any>;
            allNodes[selected.id] = {
              ...allNodes[selected.id],
              props: { ...(allNodes[selected.id]?.props ?? {}), backgroundColor: value },
            };

            // Collect subtree node IDs (selected + all descendants)
            const subtreeIds = new Set<string>();
            const queue: string[] = [selected.id];
            while (queue.length > 0) {
              const nId = queue.shift()!;
              subtreeIds.add(nId);
              const n = allNodes[nId];
              if (Array.isArray(n?.nodes)) queue.push(...n.nodes);
            }
            const subtree: Record<string, any> = {};
            for (const id of Array.from(subtreeIds)) subtree[id] = allNodes[id];

            // applyContrastColors correctly walks parent chains, so each leaf text
            // node gets the contrast of its nearest background-owning ancestor.
            const updated = applyContrastColors(subtree);

            // Apply only the changed props via history.ignore()
            for (const [nodeId, updatedNode] of Object.entries(updated)) {
              const origNode = subtree[nodeId];
              const uProps = (updatedNode as any).props ?? {};
              const oProps = origNode?.props ?? {};
              if (uProps.textColor !== oProps.textColor) {
                const tc = uProps.textColor;
                actions.history.ignore().setProp(nodeId, (p: any) => { p.textColor = tc; });
              }
              if (uProps.color !== oProps.color) {
                const c = uProps.color;
                const ac = uProps._autoColor;
                actions.history.ignore().setProp(nodeId, (p: any) => { p.color = c; p._autoColor = ac; });
              }
            }
          } catch { /* ignore — canvas state may not be serializable during initial load */ }
        }
      }
    },
    [selected.id, selected.displayName, actions, query],
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
      {dn !== "AstryxArtboard" && <section className="px-3 py-3 border-b border-border">
        <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Color</div>

        {/* Background swatches — universal */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-muted-foreground w-6 flex-shrink-0 font-medium">BG</span>
          <div className="flex gap-1.5 flex-wrap">
            {/* Transparent tile */}
            <button
              key="transparent"
              onClick={() => setProp("backgroundColor", "transparent")}
              title="Transparent"
              style={{
                backgroundImage: "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)",
                backgroundSize: "6px 6px",
                backgroundPosition: "0 0,0 3px,3px -3px,-3px 0px",
                backgroundColor: "#fff",
                boxShadow: (!selected.props.backgroundColor || selected.props.backgroundColor === "transparent")
                  ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px #3b82f6`
                  : undefined,
              }}
              className="w-5 h-5 rounded-md border border-black/10 transition-all hover:scale-110 flex-shrink-0"
            />
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
        {(() => {
          const isTextNode = dn === "AstryxText" || dn === "AstryxHeading";
          const activeTextColor = isTextNode
            ? (selected.props.color ?? selected.props.textColor)
            : selected.props.textColor;
          const setTextColor = (hex: string) => {
            if (isTextNode) setProp("color", hex);
            else setProp("textColor", hex);
          };
          const clearTextColor = () => {
            if (isTextNode) { setProp("color", undefined); setProp("textColor", undefined); }
            else setProp("textColor", undefined);
          };
          return (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-6 flex-shrink-0 font-medium">Text</span>
              <div className="flex gap-1.5 flex-wrap">
                {/* Clear/reset tile */}
                <button
                  key="clear"
                  onClick={clearTextColor}
                  title="Default (clear)"
                  style={{
                    backgroundImage: "linear-gradient(to top right, transparent calc(50% - 0.5px), #ef4444 calc(50% - 0.5px), #ef4444 calc(50% + 0.5px), transparent calc(50% + 0.5px))",
                    backgroundColor: "#fff",
                    boxShadow: !activeTextColor
                      ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px #3b82f6`
                      : undefined,
                  }}
                  className="w-5 h-5 rounded-md border border-black/10 transition-all hover:scale-110 flex-shrink-0"
                />
                {["#000000","#1e293b","#64748b","#ffffff","#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6"].map((hex) => (
                  <button
                    key={hex}
                    onClick={() => setTextColor(hex)}
                    title={hex}
                    style={{
                      background: hex,
                      boxShadow: activeTextColor === hex
                        ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${hex}`
                        : undefined,
                    }}
                    className="w-5 h-5 rounded-md border border-black/10 transition-all hover:scale-110 flex-shrink-0"
                  />
                ))}
              </div>
            </div>
          );
        })()}

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
      </section>}

      {/* ── Background (artboard only) ───────────────────────────── */}
      {dn === "AstryxArtboard" && (
        <section className="px-3 py-3 border-b border-border">
          <div className="text-[9.5px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">Background</div>
          <ArtboardBackgroundPicker props={selected.props} setProp={setProp} />
        </section>
      )}

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

        {/* Border radius token row — hidden for fixed-shape components */}
        {!NO_RADIUS.has(dn) && (
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
        )}
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
                onBlur={(e) => {
                  if (e.target.value === "") setProp(key as string, "auto");
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

// ─── Node type → display icon mapping ────────────────────────────────────────

function layerIcon(displayName: string) {
  if (displayName === "AstryxArtboard") return <LayoutTemplate className="w-3 h-3 text-blue-500 shrink-0" />;
  if (displayName === "AstryxSection")  return <Square className="w-3 h-3 text-purple-400 shrink-0" />;
  if (displayName === "AstryxStack")    return <AlignLeft className="w-3 h-3 text-purple-400 shrink-0" />;
  if (displayName === "AstryxHStack")   return <AlignLeft className="w-3 h-3 text-purple-400 shrink-0" style={{ transform: "rotate(90deg)" }} />;
  if (displayName === "AstryxCard")     return <Square className="w-3 h-3 text-amber-400 shrink-0" />;
  if (displayName === "AstryxText" || displayName === "AstryxHeading") return <Type className="w-3 h-3 text-green-500 shrink-0" />;
  if (displayName === "AstryxButton")   return <ToggleLeft className="w-3 h-3 text-orange-400 shrink-0" />;
  if (displayName === "AstryxDivider")  return <Minus className="w-3 h-3 text-gray-400 shrink-0" />;
  return <Square className="w-3 h-3 text-muted-foreground shrink-0" />;
}

function layerLabel(displayName: string, props: Record<string, any>): string {
  if (props?.label) return props.label as string;
  if (props?.text) return String(props.text).slice(0, 24);
  if (props?.content) return String(props.content).slice(0, 24);
  return displayName.replace(/^Astryx/, "");
}

// ─── Layers tree view ─────────────────────────────────────────────────────────

function LayersView() {
  const { nodes, selectedIds, actions } = useEditor((state) => ({
    nodes: state.nodes,
    selectedIds: state.events.selected,
  }));
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["ROOT"]));

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectNode = (id: string) => {
    actions.selectNode(id);
  };

  function renderNode(id: string, depth: number): ReactNode {
    const node = nodes[id];
    if (!node) return null;
    const dn = node.data.displayName as string;
    const props = (node.data.props ?? {}) as Record<string, any>;
    const childIds: string[] = node.data.nodes ?? [];
    const isSelected = selectedIds?.has(id) ?? false;
    const hasChildren = childIds.length > 0;
    const isExpanded = expanded.has(id);

    return (
      <div key={id}>
        <button
          onClick={() => selectNode(id)}
          className={`w-full flex items-center gap-1 text-left rounded-md px-1 py-[3px] transition-colors group
            ${isSelected
              ? "bg-primary/15 text-primary"
              : "hover:bg-accent text-foreground"
            }`}
          style={{ paddingLeft: depth * 12 + 4 }}
        >
          <span
            className="w-4 h-4 flex items-center justify-center shrink-0"
            onClick={hasChildren ? (e) => toggleExpand(id, e) : undefined}
          >
            {hasChildren
              ? (isExpanded
                  ? <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
                  : <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />)
              : null}
          </span>
          {layerIcon(dn)}
          <span className="text-[10.5px] truncate leading-none ml-0.5 flex-1 min-w-0">
            {layerLabel(dn, props)}
          </span>
        </button>
        {hasChildren && isExpanded && childIds.map((cid) => renderNode(cid, depth + 1))}
      </div>
    );
  }

  const rootNode = nodes["ROOT"];
  if (!rootNode) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[11px] text-muted-foreground text-center px-4">No elements yet. Add an artboard to get started.</p>
      </div>
    );
  }

  const topLevel: string[] = rootNode.data.nodes ?? [];

  if (topLevel.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[11px] text-muted-foreground text-center px-4">Canvas is empty</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-0.5 flex flex-col justify-start">
      {topLevel.map((id) => renderNode(id, 0))}
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
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

  const panelTitle = showInspect ? "Inspect" : "Components";

  return (
    <div
      className="w-[296px] shrink-0 flex flex-col border-r border-border bg-background overflow-hidden"
      style={{ boxShadow: "1px 0 0 hsl(var(--border))" }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold text-foreground">{panelTitle}</span>
          {showInspect ? (
            <button
              onClick={() => setForceComponents(true)}
              className="flex items-center gap-1 text-[9.5px] text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 rounded-lg px-2 py-1 transition-colors"
            >
              ← Back
            </button>
          ) : (
            <button
              onClick={() => setViewMode((v) => v === "grid" ? "list" : "grid")}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground transition-colors"
              title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
            >
              {viewMode === "grid"
                ? <LayoutList className="w-3.5 h-3.5" />
                : <LayoutGrid className="w-3.5 h-3.5" />}
            </button>
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
      <div className="flex-1 overflow-y-auto flex flex-col">
        {showInspect ? (
          <InspectPanel selected={selected!} actions={actions} />
        ) : trimmed ? (
          // Search results — grid or list
          searchResults.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-8">No matches</p>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-1.5 p-2.5 pt-2">
              {searchResults.map((item) => (
                <DraggableItem key={item.name} item={item} connectors={connectors} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 p-2">
              {searchResults.map((item) => (
                <DraggableListItem key={item.name} item={item} connectors={connectors} />
              ))}
            </div>
          )
        ) : viewMode === "grid" ? (
          // Grid view — 2-col tiles grouped by category
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
        ) : (
          // List view — accordions by category, each item as a compact draggable row
          <div className="p-2 space-y-1">
            {TOOLBOX_CATEGORIES.map((cat) => {
              const isOpen = !collapsed.has(cat.name);
              return (
                <div key={cat.name} className="rounded-xl border border-border/60 overflow-hidden">
                  <button
                    onClick={() => toggleCategory(cat.name)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/60 transition-colors"
                  >
                    <span className="text-[10px] font-semibold text-foreground flex-1 text-left">{cat.name}</span>
                    <span className="text-[9px] text-muted-foreground/50">{cat.items.length}</span>
                    {isOpen
                      ? <ChevronDown className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                      : <ChevronRight className="w-3 h-3 text-muted-foreground/60 shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="flex flex-col gap-0 divide-y divide-border/40">
                      {cat.items.map((item) => (
                        <DraggableListItem key={item.name} item={item} connectors={connectors} />
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

// ─── Notes context ────────────────────────────────────────────────────────────

interface NotesContextValue {
  notesOpen: boolean;
  setNotesOpen: (open: boolean) => void;
}
const NotesContext = createContext<NotesContextValue>({ notesOpen: false, setNotesOpen: () => {} });

// ─── Pinned element context ────────────────────────────────────────────────────
// Shared between SelectionPinButton (canvas) and DesignPanel (chat) so the
// user can pin any selected element and the AI receives its full prop snapshot.

interface PinnedElement {
  displayName: string;
  props: Record<string, any>;
  label: string;
  nodeId: string;
}

interface PinnedElementContextValue {
  pinned: PinnedElement | null;
  setPinned: (el: PinnedElement | null) => void;
}

const PinnedElementContext = createContext<PinnedElementContextValue>({
  pinned: null,
  setPinned: () => {},
});

// ─── History context ───────────────────────────────────────────────────────────
// Craft.js 0.2.x does not expose canUndo/canRedo on query or actions.
// We track history availability ourselves by watching for changes in the
// serialised node tree and gating undo/redo operations through shared handlers.
interface HistoryCtxValue {
  canUndo: boolean;
  canRedo: boolean;
  doUndo: () => void;
  doRedo: () => void;
}
const HistoryCtx = createContext<HistoryCtxValue>({
  canUndo: false, canRedo: false, doUndo: () => {}, doRedo: () => {},
});

// Must be rendered inside <Editor> so it can call useEditor.
function HistoryProvider({ children }: { children: ReactNode }) {
  const { actions } = useEditor(() => ({}));

  // Fingerprint covers both props and structure (child order, reparenting).
  // Sorting by id first so insertion order doesn't cause false positives.
  const { fingerprint } = useEditor((state) => ({
    fingerprint: Object.entries(state.nodes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, n]) =>
        `${id}:${JSON.stringify(n.data.props)}:[${(n.data.nodes ?? []).join(",")}]`
      )
      .join("|"),
  }));

  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  // Flag set synchronously before calling undo/redo so the resulting snapshot
  // change is not counted as a new "real" edit.
  const isUndoRedoRef = useRef(false);
  const prevFpRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevFpRef.current === null) {
      prevFpRef.current = fingerprint;
      return;
    }
    if (fingerprint !== prevFpRef.current) {
      prevFpRef.current = fingerprint;
      if (!isUndoRedoRef.current) {
        // A real user edit — push onto history, clear redo stack.
        setUndoDepth(d => d + 1);
        setRedoDepth(0);
      }
      isUndoRedoRef.current = false;
    }
  }, [fingerprint]);

  // Use refs so the callbacks below don't need to be recreated when depth changes.
  const undoDepthRef = useRef(undoDepth);
  const redoDepthRef = useRef(redoDepth);
  undoDepthRef.current = undoDepth;
  redoDepthRef.current = redoDepth;

  const doUndo = useCallback(() => {
    if (undoDepthRef.current <= 0) return; // nothing to undo — leave isUndoRedoRef clean
    isUndoRedoRef.current = true;
    (actions as any).history?.undo?.();
    setUndoDepth(d => Math.max(0, d - 1));
    setRedoDepth(d => d + 1);
  }, [actions]);

  const doRedo = useCallback(() => {
    if (redoDepthRef.current <= 0) return; // nothing to redo — leave isUndoRedoRef clean
    isUndoRedoRef.current = true;
    (actions as any).history?.redo?.();
    setUndoDepth(d => d + 1);
    setRedoDepth(d => Math.max(0, d - 1));
  }, [actions]);

  const value = useMemo(() => ({
    canUndo: undoDepth > 0,
    canRedo: redoDepth > 0,
    doUndo,
    doRedo,
  }), [undoDepth, redoDepth, doUndo, doRedo]);

  return <HistoryCtx.Provider value={value}>{children}</HistoryCtx.Provider>;
}

// ─── Notes panel ─────────────────────────────────────────────────────────────

interface NotesPanelProps {
  notes: string;
  editable: boolean;
  onNotesChange?: (notes: string) => void;
}

function NotesPanel({ notes, editable, onNotesChange }: NotesPanelProps) {
  const { notesOpen, setNotesOpen } = useContext(NotesContext);
  const [localNotes, setLocalNotes] = useState(notes);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync when the prop changes (e.g. on initial load)
  useEffect(() => { setLocalNotes(notes); }, [notes]);

  const handleChange = (value: string) => {
    setLocalNotes(value);
    if (!onNotesChange) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { onNotesChange(value); }, 600);
  };

  if (!notesOpen) return null;

  return (
    <div className="absolute inset-y-0 right-0 w-[300px] z-30 flex flex-col bg-background border-l border-border shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <StickyNote className="w-3.5 h-3.5 text-primary" />
        <span className="text-[12px] font-semibold text-foreground flex-1">Notes</span>
        <button
          onClick={() => setNotesOpen(false)}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Close notes"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col p-3 min-h-0">
        {editable ? (
          <textarea
            value={localNotes}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Add design notes, decisions, or handoff context here…"
            className="flex-1 w-full text-[12px] leading-relaxed bg-transparent resize-none border-none outline-none text-foreground placeholder:text-muted-foreground/50"
            spellCheck
          />
        ) : (
          <div className="flex-1 overflow-y-auto">
            {localNotes ? (
              <p className="text-[12px] leading-relaxed text-foreground whitespace-pre-wrap">{localNotes}</p>
            ) : (
              <p className="text-[12px] text-muted-foreground/50 italic">No notes have been added to this design.</p>
            )}
          </div>
        )}
      </div>

      {editable && (
        <div className="px-3 py-2 border-t border-border shrink-0">
          <p className="text-[10px] text-muted-foreground/50">Notes save automatically as you type.</p>
        </div>
      )}
    </div>
  );
}

// ─── Canvas toolbar ───────────────────────────────────────────────────────────

function CanvasToolbar({ zoom, onZoomIn, onZoomOut, onFitView }: { zoom: number; onZoomIn: () => void; onZoomOut: () => void; onFitView: () => void }) {
  const { actions, query } = useEditor(() => ({}));
  const { canUndo, canRedo, doUndo, doRedo } = useContext(HistoryCtx);
  const { toast } = useToast();

  const { selectedArtboardId } = useEditor((state) => {
    const sel = state.events.selected;
    const id = sel && sel.size > 0 ? Array.from(sel)[0] : null;
    if (!id) return { selectedArtboardId: null };
    const node = state.nodes[id];
    const isArtboard = node?.data?.displayName === "AstryxArtboard";
    return { selectedArtboardId: isArtboard ? id : null };
  });

  const addArtboard = useCallback(() => {
    try {
      const serialized = query.serialize();
      const state: Record<string, any> = serialized ? JSON.parse(serialized) : {};

      if (!state["ROOT"]) {
        console.warn("[addArtboard] ROOT not found in serialized state");
        return;
      }

      const artboards = Object.values(state).filter(
        (n: any) => n?.type?.resolvedName === "AstryxArtboard"
      ) as any[];

      let newX = 64;
      let newY = 64;
      if (artboards.length > 0) {
        let maxRight = 0;
        let yAtMax = 64;
        for (const ab of artboards) {
          const abX = Number(ab.props?.x) || 64;
          const abW = Number(ab.props?.width) || 390;
          const edge = abX + abW;
          if (edge > maxRight) {
            maxRight = edge;
            yAtMax = Number(ab.props?.y) || 64;
          }
        }
        newX = maxRight + 80;
        newY = yAtMax;
      }

      const count = artboards.length + 1;
      const newId = `artboard-${Date.now()}`;

      state[newId] = {
        type: { resolvedName: "AstryxArtboard" },
        isCanvas: true,
        props: {
          label: `Screen ${count}`,
          width: 390,
          direction: "column",
          gap: 16,
          padding: 24,
          x: newX,
          y: newY,
        },
        displayName: "AstryxArtboard",
        custom: {},
        parent: "ROOT",
        hidden: false,
        nodes: [],
        linkedNodes: {},
      };

      const rootNodes = Array.isArray(state["ROOT"].nodes) ? [...state["ROOT"].nodes] : [];
      state["ROOT"] = { ...state["ROOT"], nodes: [...rootNodes, newId] };

      actions.deserialize(JSON.stringify(state));
    } catch (err) {
      console.error("[addArtboard] Failed:", err);
    }
    setTimeout(onFitView, 50);
  }, [actions, query, onFitView]);

  const duplicateArtboard = useCallback(() => {
    if (!selectedArtboardId) return;
    try {
      const serialized = query.serialize();
      const state: Record<string, any> = serialized ? JSON.parse(serialized) : {};
      const result = cloneSubtreeInState(state, selectedArtboardId);
      if (!result) return;
      actions.deserialize(JSON.stringify(result.newState));
    } catch (err) {
      console.error("[duplicateArtboard] Failed:", err);
    }
  }, [actions, query, selectedArtboardId]);

  const [importOpen, setImportOpen] = useState(false);
  const handleImportResult = useCallback((craftStateStr: string) => {
    try {
      const parsed = applyContrastColors(JSON.parse(craftStateStr));
      const validation = validateCraftState(parsed);
      if (!validation.valid) {
        const hint = describeValidationError(validation.errors);
        console.error("[ImportDesign] Invalid craft state — canvas unchanged:", hint);
        toast({ title: "Import failed", description: `Couldn't import that design — ${hint} Try a different file or image.`, variant: "destructive" });
        setImportOpen(false);
        return;
      }
      let fullExisting: Record<string, unknown> = {};
      try { fullExisting = JSON.parse(query.serialize()); } catch {}
      const merged = mergeIntoCanvas(fullExisting, parsed);
      const spread = spreadArtboardsInState(merged, fullExisting);
      actions.deserialize(sanitizeCraftState(JSON.stringify(spread)));
    } catch (err) {
      console.error("[ImportDesign] Failed to apply:", err);
    }
    setImportOpen(false);
    setTimeout(onFitView, 80);
  }, [actions, query, onFitView]);

  return (
    <div className="h-9 shrink-0 border-b border-border bg-background flex items-center px-3 gap-1.5 z-10">
      <button
        onClick={addArtboard}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg px-2 py-1 transition-colors border border-transparent hover:border-border"
        title="Add artboard"
      >
        + Artboard
      </button>
      {selectedArtboardId && (
        <button
          onClick={duplicateArtboard}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg px-2 py-1 transition-colors border border-transparent hover:border-border"
          title="Duplicate artboard (Ctrl+D)"
        >
          ⧉ Duplicate
        </button>
      )}
      <button
        onClick={() => setImportOpen(true)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg px-2 py-1 transition-colors border border-transparent hover:border-border"
        title="Import design from screenshot or Figma"
      >
        <Upload size={10} />
        Import
      </button>
      <ImportDesignModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImportResult}
        currentCraftState={(() => { try { return skeletonizeCraftState(query.serialize() ?? '') ?? undefined; } catch { return undefined; } })()}
      />
      <div className="flex-1" />
      <div className="flex items-center gap-0.5 mr-1.5">
        <button
          onClick={doUndo}
          disabled={!canUndo}
          className="w-6 h-6 flex items-center justify-center text-[11px] rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          onClick={doRedo}
          disabled={!canRedo}
          className="w-6 h-6 flex items-center justify-center text-[11px] rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↪
        </button>
      </div>
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

// ─── Delete key handler ───────────────────────────────────────────────────────

function KeyboardHandler() {
  const { actions, query, selectedId, selectedIsArtboard } = useEditor((state) => {
    const sel = state.events.selected;
    const id = sel && sel.size > 0 ? Array.from(sel)[0] : null;
    const node = id ? state.nodes[id] : null;
    return {
      selectedId: id,
      selectedIsArtboard: node?.data?.displayName === "AstryxArtboard",
    };
  });
  const { doUndo, doRedo } = useContext(HistoryCtx);
  const doUndoRef = useRef(doUndo);
  const doRedoRef = useRef(doRedo);
  doUndoRef.current = doUndo;
  doRedoRef.current = doRedo;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const inInput = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || !!el?.isContentEditable;

      if ((e.key === "Delete" || e.key === "Backspace") && !inInput) {
        if (!selectedId || selectedId === "ROOT") return;
        e.preventDefault();
        actions.delete(selectedId);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !inInput) {
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) {
          e.preventDefault();
          doUndoRef.current();
          return;
        }
        if ((k === "z" && e.shiftKey) || k === "y") {
          e.preventDefault();
          doRedoRef.current();
          return;
        }
        if (k === "d" && selectedIsArtboard && selectedId) {
          e.preventDefault();
          try {
            const serialized = query.serialize();
            const state: Record<string, any> = serialized ? JSON.parse(serialized) : {};
            const result = cloneSubtreeInState(state, selectedId);
            if (result) actions.deserialize(JSON.stringify(result.newState));
          } catch (err) {
            console.error("[duplicateArtboard] Ctrl+D failed:", err);
          }
          return;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, selectedIsArtboard, actions, query]);

  return null;
}

// ─── Canvas selection hints (shown over the canvas) ──────────────────────────

function CanvasHints() {
  return null;
}

// ─── Selection pin button ─────────────────────────────────────────────────────
// Floats above the selected element (fixed-position, outside the canvas
// transform) so the user can pin the element to the AI chat for precise edits.

function SelectionPinButton() {
  const { setPinned } = useContext(PinnedElementContext);

  // Keep a live ref to the craft query so the rAF loop can always fetch the
  // latest DOM ref without re-running the effect on every re-render.
  const craftQueryRef = useRef<any>(null);

  const { selectedInfo } = useEditor((state, query) => {
    craftQueryRef.current = query;
    const sel = state.events.selected;
    const id = sel && sel.size > 0 ? Array.from(sel)[0] : null;
    if (!id || id === "ROOT") return { selectedInfo: null };
    const node = state.nodes[id];
    if (!node) return { selectedInfo: null };
    const dn = node.data.displayName as string;
    if (dn === "AstryxArtboard") return { selectedInfo: null };
    return {
      selectedInfo: {
        id,
        displayName: dn,
        props: { ...node.data.props } as Record<string, any>,
      },
    };
  });

  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const rafRef = useRef<number>(0);

  useLayoutEffect(() => {
    const id = selectedInfo?.id;
    if (!id) { setPos(null); return; }

    // Some nested elements (e.g. text inside a card inside an artboard) have a
    // null .dom ref at the moment the selection event fires because the element
    // hasn't finished mounting.  Poll via rAF until the ref is populated before
    // starting to track position, so the button always appears eventually.
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const node = craftQueryRef.current?.node(id).get?.();
      const dom: HTMLElement | null = node ? (node as any).dom : null;
      if (!dom) {
        // Not mounted yet – try again next frame.
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const rect = dom.getBoundingClientRect();
      setPos({ top: rect.top, right: window.innerWidth - rect.right });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(rafRef.current); };
  // Re-run only when the selected node ID changes, not on every re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInfo?.id]);

  if (!selectedInfo || !pos) return null;

  const rawLabel = selectedInfo.props.children
    ?? selectedInfo.props.label
    ?? selectedInfo.props.placeholder
    ?? selectedInfo.props.title
    ?? selectedInfo.displayName;
  const label = String(rawLabel ?? selectedInfo.displayName);

  return (
    <div
      style={{
        position: "fixed",
        top: Math.max(4, pos.top - 34),
        right: Math.max(4, pos.right - 4),
        zIndex: 1000,
      }}
    >
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setPinned({ displayName: selectedInfo.displayName, props: selectedInfo.props, label, nodeId: selectedInfo.id })}
        className="flex items-center gap-1 bg-primary text-primary-foreground rounded-lg px-2 py-1 shadow-lg hover:bg-primary/90 active:scale-95 transition-all text-[10px] font-semibold"
        title="Pin this element to the AI chat"
      >
        <MessageCirclePlus className="w-3 h-3" />
        Ask AI
      </button>
    </div>
  );
}

// ─── Snap guide overlay ───────────────────────────────────────────────────────
// Rendered inside the canvas transformed div (canvas coordinate space).
// Updated imperatively via a module-level ref to avoid re-rendering the canvas.

const _snapGuideCallback = { current: null as ((h: number | null, v: number | null) => void) | null };
const _setSnapGuides = (h: number | null, v: number | null) => _snapGuideCallback.current?.(h, v);

function SnapGuideOverlay() {
  const hRef = useRef<HTMLDivElement>(null);
  const vRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    _snapGuideCallback.current = (h, v) => {
      if (hRef.current) {
        hRef.current.style.display = h !== null ? "block" : "none";
        if (h !== null) hRef.current.style.top = `${h}px`;
      }
      if (vRef.current) {
        vRef.current.style.display = v !== null ? "block" : "none";
        if (v !== null) vRef.current.style.left = `${v}px`;
      }
    };
    return () => { _snapGuideCallback.current = null; };
  }, []);

  return (
    <>
      <div
        ref={hRef}
        style={{
          display: "none",
          position: "absolute",
          top: 0,
          left: -9999,
          right: -9999,
          height: 1,
          background: "#93c5fd",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      />
      <div
        ref={vRef}
        style={{
          display: "none",
          position: "absolute",
          left: 0,
          top: -9999,
          bottom: -9999,
          width: 1,
          background: "#93c5fd",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      />
    </>
  );
}

// ─── Infinite canvas (pan + zoom) ────────────────────────────────────────────

function InfiniteCanvas({ children, zoom, onZoom, fitTrigger }: { children: ReactNode; zoom: number; onZoom: (updater: (z: number) => number) => void; fitTrigger?: number }) {
  const [pan, setPan] = useState({ x: 80, y: 80 });
  const containerRef = useRef<HTMLDivElement>(null);
  const transformDivRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const spaceDown = useRef(false);
  const hasFitOnMount = useRef(false);

  const { actions: editorActions } = useEditor(() => ({}));
  const editorActionsRef = useRef(editorActions);
  editorActionsRef.current = editorActions;

  // Refs that mirror state/prop for use inside native event handlers (avoid stale closures).
  const panRef = useRef({ x: 80, y: 80 });
  const zoomRef = useRef(zoom);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Touch tracking refs for pointer-based pan / pinch-zoom.
  const touchPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const touchPinchStartRef = useRef<{
    dist: number; midX: number; midY: number;
    panX: number; panY: number; zoom: number;
  } | null>(null);
  const touchPanStartRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  // Access craft.js query to read artboard node positions from serialized state.
  const { query } = useEditor();

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

  // Native wheel handler — cursor-anchored zoom for all scroll/pinch events,
  // matching the workflow canvas behaviour exactly.
  // Uses the same exponential scaling as KiteFrameCanvas: exp(-deltaY * 0.00225 * 0.2).
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;

    const factor = Math.exp(-e.deltaY * 0.00045);
    const newZoom = Math.min(2, Math.max(0.25, currentZoom * factor));
    // Compute world-space point under the cursor and keep it fixed after zoom.
    const worldX = (e.clientX - rect.left - currentPan.x) / currentZoom;
    const worldY = (e.clientY - rect.top - currentPan.y) / currentZoom;
    const newPanX = e.clientX - rect.left - worldX * newZoom;
    const newPanY = e.clientY - rect.top - worldY * newZoom;

    // Update ref immediately so back-to-back wheel events see the latest values.
    panRef.current = { x: newPanX, y: newPanY };
    setPan({ x: newPanX, y: newPanY });
    onZoom(() => newZoom);
  }, [onZoom]); // panRef / zoomRef are refs — intentionally omitted from deps

  // Attach the wheel listener as non-passive so preventDefault() is honoured.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Prevent Safari's native pinch-zoom/rotate gestures conflicting with our handler.
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', prevent, { passive: false });
    document.addEventListener('gesturechange', prevent, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', prevent);
      document.removeEventListener('gesturechange', prevent);
    };
  }, []);

  // ── Touch pointer handlers ──────────────────────────────────────────────────
  // Single-finger → pan.  Two-finger → pinch-zoom (midpoint-anchored).
  // Pen events are intentionally ignored so stylus work is unaffected.

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch (_) {}
    touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const fingers = Array.from(touchPointersRef.current.values());
    if (fingers.length >= 2) {
      // Second finger down — switch to pinch mode.
      touchPanStartRef.current = null;
      const dist = Math.hypot(fingers[1].x - fingers[0].x, fingers[1].y - fingers[0].y);
      touchPinchStartRef.current = {
        dist: Math.max(dist, 1),
        midX: (fingers[0].x + fingers[1].x) / 2,
        midY: (fingers[0].y + fingers[1].y) / 2,
        panX: panRef.current.x,
        panY: panRef.current.y,
        zoom: zoomRef.current,
      };
      return;
    }

    // Single finger — prepare for pan.
    touchPinchStartRef.current = null;
    touchPanStartRef.current = {
      offsetX: e.clientX - panRef.current.x,
      offsetY: e.clientY - panRef.current.y,
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const fingers = Array.from(touchPointersRef.current.values());

    // Pinch zoom (two fingers, midpoint-anchored).
    if (touchPinchStartRef.current && fingers.length >= 2) {
      if (!containerRef.current) return;
      const pinch = touchPinchStartRef.current;
      const dist = Math.hypot(fingers[1].x - fingers[0].x, fingers[1].y - fingers[0].y);
      const midX = (fingers[0].x + fingers[1].x) / 2;
      const midY = (fingers[0].y + fingers[1].y) / 2;
      const rect = containerRef.current.getBoundingClientRect();
      const newZoom = Math.min(2, Math.max(0.25, pinch.zoom * dist / pinch.dist));
      // Keep the world-space point that was under the initial pinch midpoint fixed.
      const midWorldX = (pinch.midX - rect.left - pinch.panX) / pinch.zoom;
      const midWorldY = (pinch.midY - rect.top - pinch.panY) / pinch.zoom;
      const newPanX = midX - rect.left - midWorldX * newZoom;
      const newPanY = midY - rect.top - midWorldY * newZoom;
      panRef.current = { x: newPanX, y: newPanY };
      setPan({ x: newPanX, y: newPanY });
      onZoom(() => newZoom);
      return;
    }

    // Single-finger pan.
    if (touchPanStartRef.current) {
      const newPan = {
        x: e.clientX - touchPanStartRef.current.offsetX,
        y: e.clientY - touchPanStartRef.current.offsetY,
      };
      panRef.current = newPan;
      setPan(newPan);
    }
  }, [onZoom]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    touchPointersRef.current.delete(e.pointerId);
    const remaining = touchPointersRef.current.size;
    if (remaining < 2) touchPinchStartRef.current = null;
    if (remaining === 0) touchPanStartRef.current = null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Background = outer container itself, the transform wrapper div (empty canvas space
    // between artboards), OR the ROOT section's own div (empty space below/right of
    // artboards). Artboards/components always bubble from a deeper target.
    const clickedBackground =
      e.target === e.currentTarget ||
      e.target === transformDivRef.current ||
      (e.target instanceof HTMLElement && e.target.dataset.canvasRoot === "true");
    if (e.button === 0 && clickedBackground) {
      // Deselect any selected node when the user clicks empty canvas space.
      editorActionsRef.current.selectNode(undefined as any);
    }
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

  // Parse all AstryxArtboard bounding boxes (canvas-unit coordinates) from the
  // current craft.js serialized state. Returns null when no artboards exist.
  const getArtboardBounds = useCallback((): { minX: number; minY: number; maxX: number; maxY: number } | null => {
    try {
      const serialized = query.serialize();
      if (!serialized) return null;
      const state = JSON.parse(serialized) as Record<string, any>;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let found = false;
      for (const node of Object.values(state)) {
        if (node?.type?.resolvedName === "AstryxArtboard") {
          const x = Number(node.props?.x) || 64;
          const y = Number(node.props?.y) || 64;
          const w = Number(node.props?.width) || 390;
          // Use explicit height prop when set; otherwise assume a typical mobile
          // screen aspect ratio (≈ 2:1 h/w) as a best-effort estimate so the
          // fit is approximately correct even for content-sized artboards.
          const h = node.props?.height != null ? Number(node.props.height) : Math.round(w * 1.9);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + w);
          maxY = Math.max(maxY, y + h);
          found = true;
        }
      }
      return found ? { minX, minY, maxX, maxY } : null;
    } catch {
      return null;
    }
  }, [query]);

  // Centre all artboards in the visible canvas viewport at the largest zoom
  // level that fits them with 60 px padding on all sides.
  const fitToContent = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const bounds = getArtboardBounds();
    if (!bounds) {
      // No artboards yet — fall back to a sensible default position.
      setPan({ x: 80, y: 80 });
      onZoom(() => 0.75);
      return;
    }
    const { minX, minY, maxX, maxY } = bounds;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const { width: vpW, height: vpH } = container.getBoundingClientRect();
    if (vpW === 0 || vpH === 0) return; // container not yet laid out
    const pad = 60;
    const zoomFit = Math.min(
      (vpW - pad * 2) / contentW,
      (vpH - pad * 2) / contentH,
      1.5  // never zoom in further than 150 % to avoid jarring initial view
    );
    const clampedZoom = Math.max(0.25, Math.min(2, zoomFit));
    // Pan so the content bounding-box centre aligns with the viewport centre.
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    onZoom(() => clampedZoom);
    setPan({ x: vpW / 2 - centerX * clampedZoom, y: vpH / 2 - centerY * clampedZoom });
  }, [getArtboardBounds, onZoom]);

  // Auto-fit once after craft.js has hydrated the Frame on initial mount.
  // A 200 ms delay lets the Frame deserialise the craft state before we measure.
  useEffect(() => {
    if (hasFitOnMount.current) return;
    const timer = setTimeout(() => {
      hasFitOnMount.current = true;
      fitToContent();
    }, 200);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fit whenever the toolbar "Fit View" button fires or a new artboard is added.
  useEffect(() => {
    if (fitTrigger && fitTrigger > 0) fitToContent();
  }, [fitTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative overflow-hidden"
      style={{
        backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--foreground) 15%, transparent) 1.5px, transparent 1.5px)",
        backgroundSize: "20px 20px",
        backgroundColor: "var(--muted)",
        // Disable native browser pan/zoom on touch so our pointer handlers take full control.
        touchAction: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        ref={transformDivRef}
        style={{
          position: "absolute",
          // minHeight (not height) ensures craft.js Frame has a measurable
          // container on first render, while still letting the div grow taller
          // than the viewport when artboards extend downward.
          minHeight: "100%",
          minWidth: "100%",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          // No pointer-events override here. Background-click detection is done
          // by checking e.target === transformDivRef.current in handleMouseDown.
        }}
      >
        <CanvasZoomContext.Provider value={zoom}>
          {children}
          <SnapGuideOverlay />
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
          onClick={fitToContent}
          className="w-7 h-7 bg-background border border-border rounded-xl shadow-sm flex items-center justify-center text-muted-foreground hover:bg-accent hover:shadow-md transition-all"
          title="Fit view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Pan hint */}
      <div className="absolute bottom-4 left-4 text-[10px] text-muted-foreground/40 pointer-events-none select-none z-10">
        Scroll to zoom · Space+drag or drag background to pan · Pinch to zoom on touch
      </div>
    </div>
  );
}

// ─── AI drawer (right rail, collapsible) ─────────────────────────────────────

interface AIMessage { role: "ai" | "user"; text: string; pinnedElement?: PinnedElement | null; imagePreview?: string; }

/**
 * Graph-aware merge for craft.js node maps.
 * After a shallow merge, walks every node's children array and removes
 * references to IDs that no longer exist in the merged map, preventing
 * orphan-reference errors when the AI patch doesn't include all siblings.
 */
function mergeGraphAware(
  existingState: Record<string, unknown>,
  patchNodes: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existingState, ...patchNodes };
  const nodeIds = new Set(Object.keys(merged));

  for (const [nodeId, node] of Object.entries(merged)) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    if (!Array.isArray(n.nodes)) continue;

    const before = n.nodes as string[];
    const after = before.filter((childId) => {
      if (!nodeIds.has(childId)) {
        console.warn(`[mergeGraphAware] Removing orphan child ref "${childId}" from node "${nodeId}"`);
        return false;
      }
      return true;
    });

    if (after.length !== before.length) {
      merged[nodeId] = { ...n, nodes: after };
    }
  }

  return merged;
}

/**
 * Additively merges an incoming full craft.js state (e.g. from image import or
 * an AI full-state response) into the existing canvas so that artboards the user
 * already built are preserved alongside the new ones.
 *
 * Key difference from mergeGraphAware (which is for PATCH responses):
 * - Both existing and incoming states include a ROOT node. A plain object spread
 *   would overwrite ROOT with the incoming ROOT whose `nodes` array only references
 *   the new artboard, making existing artboards unreachable from ROOT.
 * - Here we union ROOT.nodes instead of overwriting it.
 * - All other nodes: incoming wins for shared IDs (correct for modifications —
 *   e.g. AI regenerates an artboard with the same ID, it should replace it).
 */
/**
 * Re-assign every node ID in an incoming craft state to a fresh random ID so
 * it cannot collide with IDs that already exist on the canvas. ROOT is the
 * fixed craft.js canvas root and is intentionally left unchanged.
 *
 * Remaps ALL node ID references consistently:
 *   - Object keys (the node IDs themselves)
 *   - `nodes[]` child-reference arrays
 *   - `parent` field
 *   - `linkedNodes` value map
 *
 * Without this, uploading a second image would overwrite the first screen:
 * the AI always generates the same fixed IDs ("artboard-1", "container-1",
 * …), so `{ ...existingState, ...incoming }` silently replaces the first
 * import's nodes, and Set-deduplication on ROOT.nodes collapses the two
 * artboard references back to one.
 */
function reIdIncomingNodes(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const ts = Date.now();

  // Build old-id → new-id map for every key except ROOT
  const idMap: Record<string, string> = {};
  let i = 0;
  for (const key of Object.keys(state)) {
    if (key === "ROOT") continue;
    idMap[key] =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `node-${ts}-${i++}`;
  }

  const remapped: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(state)) {
    const newKey = key === "ROOT" ? "ROOT" : (idMap[key] ?? key);

    if (!value || typeof value !== "object") {
      remapped[newKey] = value;
      continue;
    }

    // Deep-clone so we don't mutate the original parsedRaw
    const node = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

    // Remap nodes[] child references
    if (Array.isArray(node.nodes)) {
      node.nodes = (node.nodes as string[]).map((c) => idMap[c] ?? c);
    }

    // Remap parent (ROOT stays "ROOT" since ROOT is excluded from idMap)
    if (typeof node.parent === "string") {
      node.parent = idMap[node.parent] ?? node.parent;
    }

    // Remap linkedNodes value map
    if (node.linkedNodes && typeof node.linkedNodes === "object") {
      const ln = node.linkedNodes as Record<string, string>;
      const remappedLn: Record<string, string> = {};
      for (const [slot, linkedId] of Object.entries(ln)) {
        remappedLn[slot] = idMap[linkedId] ?? linkedId;
      }
      node.linkedNodes = remappedLn;
    }

    remapped[newKey] = node;
  }

  return remapped;
}

function mergeIntoCanvas(
  existingState: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existingState, ...incoming };

  const existingRoot = existingState["ROOT"] as Record<string, unknown> | undefined;
  const incomingRoot = incoming["ROOT"] as Record<string, unknown> | undefined;
  if (existingRoot && incomingRoot) {
    const existingRootNodes = Array.isArray(existingRoot.nodes) ? (existingRoot.nodes as string[]) : [];
    const incomingRootNodes = Array.isArray(incomingRoot.nodes) ? (incomingRoot.nodes as string[]) : [];
    const combined = Array.from(new Set([...existingRootNodes, ...incomingRootNodes]));
    merged["ROOT"] = { ...incomingRoot, nodes: combined };
  }

  const nodeIds = new Set(Object.keys(merged));
  for (const [nodeId, node] of Object.entries(merged)) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    if (!Array.isArray(n.nodes)) continue;
    const before = n.nodes as string[];
    const after = before.filter((childId) => {
      if (!nodeIds.has(childId)) {
        console.warn(`[mergeIntoCanvas] Removing orphan child ref "${childId}" from node "${nodeId}"`);
        return false;
      }
      return true;
    });
    if (after.length !== before.length) {
      merged[nodeId] = { ...n, nodes: after };
    }
  }

  return merged;
}

/**
 * After an AI rewrite, carry forward user-typed `cellData` and `headers` for
 * every AstryxTable node that appears (by the same ID) in both the old and new
 * state — protecting data that the user typed manually from being silently
 * erased by an unrelated layout change.
 *
 * Pass `targetNodeId` when the user explicitly asked the AI to edit a specific
 * node (e.g. via "Ask AI" with a pinned selection). That node is excluded from
 * preservation so the AI's new values take effect; all other tables are still
 * protected.
 */
function preserveTableCellData(
  existingState: Record<string, unknown>,
  newState: Record<string, unknown>,
  targetNodeId?: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...newState };
  for (const [nodeId, node] of Object.entries(result)) {
    if (!node || typeof node !== "object") continue;
    const n = node as Record<string, unknown>;
    if ((n.type as any)?.resolvedName !== "AstryxTable") continue;

    // Skip preservation for the node the user explicitly targeted — the AI's
    // new headers/cellData values should win.
    if (targetNodeId && nodeId === targetNodeId) continue;

    const existing = existingState[nodeId];
    if (!existing || typeof existing !== "object") continue;
    const e = existing as Record<string, unknown>;
    if ((e.type as any)?.resolvedName !== "AstryxTable") continue;

    const existingProps = e.props as Record<string, unknown> | undefined;
    if (!existingProps) continue;

    const existingCellData = existingProps.cellData;
    const existingHeaders = existingProps.headers;
    if (existingCellData === undefined && existingHeaders === undefined) continue;

    const newProps = (n.props as Record<string, unknown> | undefined) ?? {};

    // Warn when preservation is actually overwriting AI-generated values so
    // the override is visible in the browser console even without server logs.
    const aiCellData = newProps.cellData;
    const aiHeaders = newProps.headers;
    const overwritingCellData = existingCellData !== undefined && aiCellData !== undefined && JSON.stringify(aiCellData) !== JSON.stringify(existingCellData);
    const overwritingHeaders = existingHeaders !== undefined && aiHeaders !== undefined && JSON.stringify(aiHeaders) !== JSON.stringify(existingHeaders);
    if (overwritingCellData || overwritingHeaders) {
      // logging disabled
    }

    const updated: Record<string, unknown> = { ...newProps };
    if (existingCellData !== undefined) updated.cellData = existingCellData;
    if (existingHeaders !== undefined) updated.headers = existingHeaders;

    result[nodeId] = { ...n, props: updated };
  }
  return result;
}

/**
 * Clones an artboard subtree with fresh node IDs.
 * Returns { newState, newArtboardId } where newState is the updated craft.js
 * node map with all cloned nodes inserted and ROOT.nodes updated.
 * Positions the clone to the right of all existing artboards.
 */
function cloneSubtreeInState(
  state: Record<string, any>,
  artboardId: string,
): { newState: Record<string, any>; newArtboardId: string } | null {
  const artboard = state[artboardId];
  if (!artboard || artboard?.type?.resolvedName !== "AstryxArtboard") return null;

  // Collect all descendant node IDs (BFS)
  const allIds: string[] = [];
  const queue: string[] = [artboardId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    allIds.push(id);
    const node = state[id];
    if (!node) continue;
    for (const childId of (node.nodes ?? [])) queue.push(childId);
    for (const linkedId of Object.values(node.linkedNodes ?? {})) queue.push(linkedId as string);
  }

  // Build ID remap
  const ts = Date.now();
  const idMap: Record<string, string> = {};
  allIds.forEach((id, i) => {
    idMap[id] = id === artboardId ? `artboard-${ts}` : `node-${ts}-${i}`;
  });
  const newArtboardId = idMap[artboardId];

  // Deep-clone each node with remapped IDs
  const clonedNodes: Record<string, any> = {};
  for (const id of allIds) {
    const node = JSON.parse(JSON.stringify(state[id]));
    node.parent = id === artboardId ? "ROOT" : (idMap[node.parent] ?? node.parent);
    if (Array.isArray(node.nodes)) node.nodes = node.nodes.map((c: string) => idMap[c] ?? c);
    if (node.linkedNodes && typeof node.linkedNodes === "object") {
      const remapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(node.linkedNodes)) remapped[k] = idMap[v as string] ?? (v as string);
      node.linkedNodes = remapped;
    }
    clonedNodes[idMap[id]] = node;
  }

  // Position clone to the right of all artboards
  const allArtboards = Object.values(state).filter((n: any) => n?.type?.resolvedName === "AstryxArtboard") as any[];
  let maxRight = 64;
  for (const ab of allArtboards) {
    const edge = (Number(ab.props?.x) || 64) + (Number(ab.props?.width) || 390);
    if (edge > maxRight) maxRight = edge;
  }
  const srcLabel: string = artboard.props?.label ?? "Artboard";
  clonedNodes[newArtboardId].props = {
    ...clonedNodes[newArtboardId].props,
    x: maxRight + 80,
    y: Number(artboard.props?.y) || 64,
    label: `${srcLabel} Copy`,
  };

  const rootNodes = Array.isArray(state["ROOT"]?.nodes) ? state["ROOT"].nodes : [];
  const newState = {
    ...state,
    ...clonedNodes,
    ROOT: { ...state["ROOT"], nodes: [...rootNodes, newArtboardId] },
  };
  return { newState, newArtboardId };
}

/**
 * Diffs two craft.js node maps and returns which nodes were added, modified
 * (props changed), or removed. Used for `[design_ai_applied]` console logging.
 * Logs component types and node IDs only — never logs prop content.
 */
function diffCraftStates(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): {
  added: Array<{ nodeId: string; resolvedName: string }>;
  modified: Array<{ nodeId: string; resolvedName: string }>;
  removed: Array<{ nodeId: string; resolvedName: string }>;
} {
  const getResolvedName = (node: unknown): string =>
    (node && typeof node === "object" ? ((node as any).type?.resolvedName as string) : undefined) ?? "unknown";

  const added: Array<{ nodeId: string; resolvedName: string }> = [];
  const modified: Array<{ nodeId: string; resolvedName: string }> = [];
  const removed: Array<{ nodeId: string; resolvedName: string }> = [];

  for (const [nodeId, node] of Object.entries(after)) {
    const resolvedName = getResolvedName(node);
    if (!(nodeId in before)) {
      added.push({ nodeId, resolvedName });
    } else {
      const beforeProps = (before[nodeId] as any)?.props;
      const afterProps = (node as any)?.props;
      if (JSON.stringify(beforeProps) !== JSON.stringify(afterProps)) {
        modified.push({ nodeId, resolvedName });
      }
    }
  }
  for (const [nodeId, node] of Object.entries(before)) {
    if (!(nodeId in after)) {
      removed.push({ nodeId, resolvedName: getResolvedName(node) });
    }
  }
  return { added, modified, removed };
}

function spreadArtboardsInState(
  state: Record<string, any>,
  existingState?: Record<string, any>,
): Record<string, any> {
  const artboardEntries = Object.entries(state).filter(
    ([, n]: [string, any]) => n?.type?.resolvedName === "AstryxArtboard"
  );

  if (existingState) {
    // Patch mode: only position new artboards; preserve user-moved positions of existing ones.
    const existingArtboardIds = new Set(
      Object.keys(existingState).filter(
        (id) => (existingState[id] as any)?.type?.resolvedName === "AstryxArtboard"
      )
    );
    const newArtboards = artboardEntries.filter(([id]) => !existingArtboardIds.has(id));
    if (newArtboards.length === 0) return state;

    // Find rightmost edge & baseline Y from existing artboards in the merged state.
    const existingInMerged = artboardEntries.filter(([id]) => existingArtboardIds.has(id));
    let maxRight = 64;
    let baseY = 64;
    if (existingInMerged.length > 0) {
      // Use the leftmost existing artboard's Y as the row baseline.
      const leftmost = existingInMerged.reduce((best, cur) =>
        (Number((cur[1] as any).props?.x) || 0) < (Number((best[1] as any).props?.x) || 0) ? cur : best
      );
      baseY = Number((leftmost[1] as any).props?.y) || 64;
      for (const [, node] of existingInMerged) {
        const x = Number((node as any).props?.x) || 0;
        const w = Number((node as any).props?.width) || 390;
        maxRight = Math.max(maxRight, x + w);
      }
    }

    const result = { ...state };
    let curX = maxRight + 80;
    for (const [id, node] of newArtboards) {
      const width = Number((node as any).props?.width) || 390;
      result[id] = { ...(node as any), props: { ...(node as any).props, x: curX, y: baseY } };
      curX += width + 80;
    }
    return result;
  } else {
    // Full replace mode: lay all artboards out left-to-right from x=64.
    if (artboardEntries.length < 2) return state;
    artboardEntries.sort(([, a]: [string, any], [, b]: [string, any]) =>
      (Number(a.props?.x) || 0) - (Number(b.props?.x) || 0)
    );
    const result = { ...state };
    let curX = 64;
    const baseY = Number(artboardEntries[0][1].props?.y) || 64;
    for (const [id, node] of artboardEntries) {
      const width = Number(node.props?.width) || 390;
      result[id] = { ...node, props: { ...node.props, x: curX, y: baseY } };
      curX += width + 80;
    }
    return result;
  }
}

function describeValidationError(errors: string[]): string {
  if (!errors || errors.length === 0) return "unknown structural issue.";
  const first = errors[0];
  if (first.includes("non-existent parent")) return "it referenced a node that doesn't exist on your canvas.";
  if (first.includes("non-existent child")) return "it produced an inconsistent node tree.";
  if (first.includes("ROOT")) return "the generated design was missing its root structure.";
  if (first.includes("resolvedName")) return "it used an unrecognised component type.";
  return first.slice(0, 120) + ".";
}

const INITIAL_MESSAGES: AIMessage[] = [
  {
    role: "ai",
    text: "Hi! I can add components to your artboards or modify existing ones — just describe what you want. If you ask for something outside the Astryx component library I'll let you know and suggest an alternative.",
  },
];

// ─── Design panel (unified right rail: KiteAI · Layers · Notes) ──────────────

type DesignPanelTab = "kite-ai" | "layers";

const DESIGN_PANEL_COLLAPSED_KEY = "kiteframe-design-panel-collapsed";
const DESIGN_PANEL_ACTIVE_TAB_KEY = "kiteframe-design-panel-active-tab";
const DESIGN_PANEL_WIDTH_KEY = "kiteframe-design-panel-width";

interface DesignPanelProps {
  notes: string;
  editable: boolean;
  onNotesChange?: (notes: string) => void;
}

function DesignPanel({ notes, editable, onNotesChange }: DesignPanelProps) {
  const { actions, query, selectedNodeId } = useEditor((state) => ({
    selectedNodeId: state.events.selected ? Array.from(state.events.selected)[0] : undefined,
  }));

  const { pinned, setPinned } = useContext(PinnedElementContext);

  const [activeTab, setActiveTab] = useState<DesignPanelTab>(() => {
    try {
      const s = localStorage.getItem(DESIGN_PANEL_ACTIVE_TAB_KEY);
      return (s === "kite-ai" || s === "layers") ? s : "kite-ai";
    } catch { return "kite-ai"; }
  });
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return localStorage.getItem(DESIGN_PANEL_COLLAPSED_KEY) === "true"; } catch { return false; }
  });
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const s = localStorage.getItem(DESIGN_PANEL_WIDTH_KEY);
      return Math.max(280, Math.min(600, s ? parseInt(s) : 320));
    } catch { return 320; }
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<AIMessage[]>(INITIAL_MESSAGES);
  const [prompt, setPrompt] = useState("");
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "error">("idle");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [attachedImage, setAttachedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const handleImageAttach = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setAttachedImage({ base64: dataUrl.split(",")[1], mimeType: file.type || "image/png", preview: dataUrl });
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => { try { localStorage.setItem(DESIGN_PANEL_COLLAPSED_KEY, String(isCollapsed)); } catch {} }, [isCollapsed]);
  useEffect(() => { try { localStorage.setItem(DESIGN_PANEL_ACTIVE_TAB_KEY, activeTab); } catch {} }, [activeTab]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Auto-switch to KiteAI tab when something is pinned so the chip is visible.
  useEffect(() => { if (pinned) { setActiveTab("kite-ai"); setIsCollapsed(false); } }, [pinned]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      if (!panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      const clamped = Math.max(280, Math.min(600, rect.left + rect.width - e.clientX));
      setPanelWidth(clamped);
      try { localStorage.setItem(DESIGN_PANEL_WIDTH_KEY, String(clamped)); } catch {}
    };
    const onUp = () => setIsResizing(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, [isResizing]);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (aiStatus === "loading") return;

    // ── Image attach path: import OR reference-edit based on prompt intent ───
    if (attachedImage) {
      const imageToSend = attachedImage;
      // A meaningful instruction (>10 chars) signals "use as reference to edit the canvas".
      // A short label or no text signals "import as a new screen" (original behaviour).
      const isReferenceEdit = trimmed.length > 10;
      setAttachedImage(null);
      setMessages((prev) => [
        ...prev,
        { role: "user", text: trimmed || "Import this design", imagePreview: imageToSend.preview },
      ]);
      setPrompt("");
      setAiStatus("loading");

      if (!isReferenceEdit) {
        // ── Original import path ─────────────────────────────────────────────
        try {
          let currentCraftState: string | undefined;
          try { currentCraftState = skeletonizeCraftState(query.serialize() ?? ''); } catch {}
          const res = await fetch("/api/ai/design-from-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: imageToSend.base64,
              mimeType: imageToSend.mimeType,
              frameLabel: trimmed || "Screen 1",
              currentCraftState,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Import failed");
          if (data.type === "message") {
            setMessages((prev) => [...prev, { role: "ai", text: data.text }]);
          } else {
            const parsedRaw = (() => { try { return applyContrastColors(JSON.parse(data.craftState)); } catch { return null; } })();
            if (parsedRaw) {
              const validation = validateCraftState(parsedRaw);
              if (!validation.valid) {
                const hint = describeValidationError(validation.errors);
                setMessages((prev) => [...prev, { role: "ai", text: `I couldn't apply that image design — ${hint} Try rephrasing your request or using a clearer image.` }]);
              } else {
                let fullExisting: Record<string, unknown> = {};
                try { fullExisting = JSON.parse(query.serialize()); } catch {}
                // Re-ID all nodes in the incoming state so they never collide
                // with IDs already on the canvas. Without this, every image
                // import uses the same AI-generated IDs ("artboard-1", etc.),
                // causing the second upload to silently overwrite the first.
                const reId = reIdIncomingNodes(parsedRaw);
                const merged = mergeIntoCanvas(fullExisting, reId);
                const spread = spreadArtboardsInState(merged, fullExisting);
                // Validate the final merged+spread state before deserializing.
                // reIdIncomingNodes remaps all ID references (nodes[], parent,
                // linkedNodes) but a broken AI response could still produce
                // an invalid state — catch it here rather than loading corrupt
                // data into the canvas.
                const postMergeValidation = validateCraftState(spread as Record<string, unknown>);
                if (!postMergeValidation.valid) {
                  const hint = describeValidationError(postMergeValidation.errors);
                  setMessages((prev) => [...prev, { role: "ai", text: `I couldn't apply that image design — ${hint} Try rephrasing your request or using a clearer image.` }]);
                } else {
                  actions.deserialize(sanitizeCraftState(JSON.stringify(spread)));
                  setMessages((prev) => [...prev, { role: "ai", text: (data.message ?? "Design imported from image.") + " ✓" }]);
                }
              }
            } else {
              setMessages((prev) => [...prev, { role: "ai", text: "I couldn't parse the image response. Try again or use a different image." }]);
            }
          }
          setAiStatus("idle");
        } catch (e: any) {
          setAiStatus("error");
          setMessages((prev) => [...prev, { role: "ai", text: `Import failed: ${e.message?.slice(0, 120) ?? "Unknown error"}` }]);
          setTimeout(() => setAiStatus("idle"), 3000);
        }
        return;
      }

      // ── Reference-edit path: image guides changes to existing canvas ─────
      try {
        let currentCraftState: string | undefined;
        let targetArtboardLabel: string | undefined;
        try {
          const serialized = query.serialize();
          if (serialized && serialized.length > 10) {
            currentCraftState = skeletonizeCraftState(serialized);
            const state = JSON.parse(serialized) as Record<string, unknown>;
            const artboardLabels = Object.values(state)
              .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
              .filter((n) => (n.type as any)?.resolvedName === "AstryxArtboard")
              .map((n) => (n.props as any)?.label as string | undefined)
              .filter((l): l is string => typeof l === "string" && l.length > 0);
            const lowerPrompt = trimmed.toLowerCase();
            const matched = artboardLabels.find((label) => lowerPrompt.includes(label.toLowerCase()));
            if (matched) {
              targetArtboardLabel = matched;
            } else if (artboardLabels.length === 1) {
              targetArtboardLabel = artboardLabels[0];
            } else if (selectedNodeId && artboardLabels.length > 1) {
              const findArtboardLabel = (nodeId: string): string | undefined => {
                const node = state[nodeId] as Record<string, unknown> | undefined;
                if (!node) return undefined;
                if ((node.type as any)?.resolvedName === "AstryxArtboard") {
                  return (node.props as any)?.label as string | undefined;
                }
                const parentId = node.parent as string | undefined;
                if (!parentId || parentId === nodeId) return undefined;
                return findArtboardLabel(parentId);
              };
              targetArtboardLabel = findArtboardLabel(selectedNodeId);
            }
          }
        } catch { /* ignore */ }

        const res = await fetch("/api/ai/design-edit-from-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: imageToSend.base64,
            mimeType: imageToSend.mimeType,
            prompt: trimmed,
            currentCraftState,
            targetArtboardLabel,
            selectedElement: pinned
              ? { displayName: pinned.displayName, props: pinned.props, nodeId: pinned.nodeId }
              : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Reference edit failed");

        setPinned(null);

        if (data.type === "message") {
          setMessages((prev) => [...prev, { role: "ai", text: data.text }]);
        } else if (data.type === "patch") {
          const patchNodes: Record<string, unknown> = JSON.parse(data.nodes);
          let existingState: Record<string, unknown> = {};
          try { existingState = JSON.parse(query.serialize()); } catch {}
          const mergedRaw = mergeGraphAware(existingState, patchNodes);
          const merged = applyContrastColors(preserveTableCellData(existingState, mergedRaw, pinned?.nodeId));
          const validation = validateCraftState(merged);
          if (!validation.valid) {
            const hint = describeValidationError(validation.errors);
            setMessages((prev) => [...prev, { role: "ai", text: `${data.message ?? "I tried to update your design"} — but the result had an issue: ${hint} Try rephrasing your request.` }]);
          } else {
            const spread = spreadArtboardsInState(merged, existingState);
            actions.deserialize(sanitizeCraftState(JSON.stringify(spread)));
            setMessages((prev) => [...prev, { role: "ai", text: (data.message ?? "Done! I've updated your canvas.") + " ✓" }]);
          }
        } else {
          const craftStateStr = data.craftState ?? data;
          const stateJson = typeof craftStateStr === "string" ? craftStateStr : JSON.stringify(craftStateStr);
          const parsedRaw = (() => { try { return applyContrastColors(JSON.parse(stateJson)); } catch { return null; } })();
          let fullExisting: Record<string, unknown> = {};
          try { fullExisting = JSON.parse(query.serialize()); } catch {}
          const parsedForValidation = parsedRaw ? preserveTableCellData(fullExisting, parsedRaw, pinned?.nodeId) : null;
          const validation = parsedForValidation ? validateCraftState(parsedForValidation) : { valid: false, errors: ["Failed to parse"] };
          if (!validation.valid) {
            const hint = describeValidationError(validation.errors);
            setMessages((prev) => [...prev, { role: "ai", text: `I couldn't apply that change — ${hint} Try rephrasing or using a different reference.` }]);
          } else {
            const mergedForApply = mergeIntoCanvas(fullExisting, parsedForValidation!);
            const spread = spreadArtboardsInState(mergedForApply, fullExisting);
            actions.deserialize(sanitizeCraftState(JSON.stringify(spread)));
            setMessages((prev) => [...prev, { role: "ai", text: (data.message ?? "Done! I've updated your canvas to match the reference.") + " ✓" }]);
          }
        }
        setAiStatus("idle");
      } catch (e: any) {
        setAiStatus("error");
        setMessages((prev) => [...prev, { role: "ai", text: `Reference edit failed: ${e.message?.slice(0, 120) ?? "Unknown error"}` }]);
        setTimeout(() => setAiStatus("idle"), 3000);
      }
      return;
    }

    if (!trimmed) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed, pinnedElement: pinned }]);
    setPrompt("");
    setAiStatus("loading");
    const aiStartMs = Date.now();
    try {
      let currentCraftState: string | undefined;
      let targetArtboardLabel: string | undefined;
      try {
        const serialized = query.serialize();
        if (serialized && serialized.length > 10) {
          currentCraftState = skeletonizeCraftState(serialized);
          // Find artboard labels in the canvas and match them against the prompt
          // so the AI knows which screen to patch (e.g. "add a table to Screen 1")
          const state = JSON.parse(serialized) as Record<string, unknown>;
          const artboardLabels = Object.values(state)
            .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
            .filter((n) => (n.type as any)?.resolvedName === "AstryxArtboard")
            .map((n) => (n.props as any)?.label as string | undefined)
            .filter((l): l is string => typeof l === "string" && l.length > 0);
          const lowerPrompt = trimmed.toLowerCase();
          const matched = artboardLabels.find((label) => lowerPrompt.includes(label.toLowerCase()));
          if (matched) {
            targetArtboardLabel = matched;
          } else if (artboardLabels.length === 1) {
            // Only one artboard on the canvas — it must be the target
            targetArtboardLabel = artboardLabels[0];
          } else if (selectedNodeId && artboardLabels.length > 1) {
            // Walk up the parent chain of the selected node to find the nearest AstryxArtboard
            const findArtboardLabel = (nodeId: string): string | undefined => {
              const node = state[nodeId] as Record<string, unknown> | undefined;
              if (!node) return undefined;
              if ((node.type as any)?.resolvedName === "AstryxArtboard") {
                return (node.props as any)?.label as string | undefined;
              }
              const parentId = node.parent as string | undefined;
              if (!parentId || parentId === nodeId) return undefined;
              return findArtboardLabel(parentId);
            };
            targetArtboardLabel = findArtboardLabel(selectedNodeId);
          }
        }
      } catch { /* ignore */ }
      // Include prior conversation turns so the AI can reference previous context.
      // `messages` still reflects state before the current user turn was appended.
      const INITIAL_MSG_COUNT = INITIAL_MESSAGES.length;
      const conversationHistory = messages
        .slice(INITIAL_MSG_COUNT)
        .slice(-12)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch("/api/ai/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          currentCraftState,
          targetArtboardLabel,
          conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
          selectedElement: pinned
            ? { displayName: pinned.displayName, props: pinned.props, nodeId: pinned.nodeId }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Generation failed");

      setPinned(null);

      if (data.type === "message") {
        setMessages((prev) => [...prev, { role: "ai", text: data.text }]);
      } else if (data.type === "patch") {
        const patchNodes: Record<string, unknown> = JSON.parse(data.nodes);
        let existingState: Record<string, unknown> = {};
        try { existingState = JSON.parse(query.serialize()); } catch {}
        const mergedRaw = mergeGraphAware(existingState, patchNodes);
        const merged = applyContrastColors(preserveTableCellData(existingState, mergedRaw, pinned?.nodeId));
        const validation = validateCraftState(merged);
        if (!validation.valid) {
          const hint = describeValidationError(validation.errors);
          setMessages((prev) => [...prev, { role: "ai", text: `${data.message ?? "I tried to update your design"} — but the result had an issue: ${hint} Try rephrasing your request.` }]);
        } else {
          const spread = spreadArtboardsInState(merged, existingState);
          actions.deserialize(sanitizeCraftState(JSON.stringify(spread)));
          const diff = diffCraftStates(existingState, merged);
          const totalChanges = diff.added.length + diff.modified.length + diff.removed.length;
          void diff; void totalChanges;
          setMessages((prev) => [...prev, { role: "ai", text: (data.message ?? "Done! I've updated your canvas.") + " ✓" }]);
        }
      } else {
        const craftStateStr = data.craftState ?? data;
        const stateJson = typeof craftStateStr === "string" ? craftStateStr : JSON.stringify(craftStateStr);
        const parsedRaw = (() => { try { return applyContrastColors(JSON.parse(stateJson)); } catch { return null; } })();
        let fullExistingForReplace: Record<string, unknown> = {};
        try { fullExistingForReplace = JSON.parse(query.serialize()); } catch {}
        const parsedForValidation = parsedRaw ? preserveTableCellData(fullExistingForReplace, parsedRaw, pinned?.nodeId) : null;
        const validation = parsedForValidation ? validateCraftState(parsedForValidation) : { valid: false, errors: ["Failed to parse"] };
        if (!validation.valid) {
          const hint = describeValidationError(validation.errors);
          setMessages((prev) => [...prev, { role: "ai", text: `I couldn't apply that design — ${hint} Try rephrasing or ask me to simplify.` }]);
        } else {
          const mergedForApply = mergeIntoCanvas(fullExistingForReplace, parsedForValidation!);
          const spread = spreadArtboardsInState(mergedForApply, fullExistingForReplace);
          actions.deserialize(sanitizeCraftState(JSON.stringify(spread)));
          const diff = diffCraftStates(fullExistingForReplace, parsedForValidation!);
          const totalChanges = diff.added.length + diff.modified.length + diff.removed.length;
          void diff; void totalChanges;
          setMessages((prev) => [...prev, { role: "ai", text: (data.message ?? "Design created! I've built the layout on your canvas.") + " ✓" }]);
        }
      }
      setAiStatus("idle");
    } catch (e: any) {
      setAiStatus("error");
      setMessages((prev) => [...prev, { role: "ai", text: `Something went wrong: ${e.message?.slice(0, 120) ?? "Unknown error"}` }]);
      setTimeout(() => setAiStatus("idle"), 3000);
    }
  };


  if (isCollapsed) {
    return (
      <div className="h-full w-12 border-l border-border bg-card flex flex-col flex-shrink-0">
        <TooltipProvider delayDuration={100}>
          <div className="flex flex-col items-center pt-2 gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsCollapsed(false)}>
                  <ChevronLeft size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Expand Panel</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex flex-col items-center gap-1 mt-2 border-t border-border pt-2">
            {([
              { id: "kite-ai" as const, icon: Sparkles, label: "KiteAI", cls: "text-purple-500" },
              { id: "layers"  as const, icon: ListTree, label: "Layers",  cls: "" },
            ] as const).map(({ id, icon: Icon, label, cls }) => (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTab === id ? "secondary" : "ghost"}
                    size="icon"
                    className={`h-8 w-8 ${cls}`}
                    onClick={() => { setActiveTab(id); setIsCollapsed(false); }}
                  >
                    <Icon size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="h-full border-l border-border bg-card flex flex-col flex-shrink-0 relative"
      style={{ width: `${panelWidth}px` }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={() => setIsResizing(true)}
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize group z-10"
        title="Drag to resize"
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-border group-hover:bg-primary transition-colors" />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DesignPanelTab)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Tab bar */}
        <div className="border-b border-border flex items-center">
          <Button variant="ghost" size="icon" className="h-10 w-8 flex-shrink-0" onClick={() => setIsCollapsed(true)}>
            <ChevronRight size={16} />
          </Button>
          <ScrollArea className="flex-1">
            <TabsList className="inline-flex h-10 w-max min-w-full p-1 gap-1 bg-transparent">
              <TabsTrigger value="kite-ai" className="text-xs px-3 gap-1.5 data-[state=active]:bg-background data-[state=active]:text-purple-500">
                <Sparkles size={14} className="text-purple-500" />KiteAI
              </TabsTrigger>
              <TabsTrigger value="layers" className="text-xs px-3 gap-1.5 data-[state=active]:bg-background">
                <ListTree size={14} />Layers
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="h-1.5" />
          </ScrollArea>
        </div>

        {/* KiteAI tab */}
        <TabsContent value="kite-ai" className="flex-1 m-0 overflow-hidden flex flex-col min-h-0 data-[state=inactive]:hidden">
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-0">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-1.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "ai" && (
                  <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary to-violet-600 flex-shrink-0 mt-0.5 shadow-sm" />
                )}
                <div className={`max-w-[85%] px-3 py-2 text-sm leading-snug rounded-2xl ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}>
                  {m.imagePreview && (
                    <button
                      onClick={() => setLightboxSrc(m.imagePreview!)}
                      className="block mb-1.5 rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-white/50 group relative"
                      title="Click to view full image"
                    >
                      <img src={m.imagePreview} alt="Attached" className="max-h-28 max-w-full object-cover" />
                      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                      </span>
                    </button>
                  )}
                  {m.text}
                  {m.role === "user" && m.pinnedElement && (
                    <div className="flex items-center gap-1 mt-1.5 bg-white/15 rounded-md px-1.5 py-0.5">
                      <span className="text-[10px] leading-none">📌</span>
                      <span className="text-[10px] text-primary-foreground/80 font-medium truncate">
                        {m.pinnedElement.displayName}
                        {m.pinnedElement.label && m.pinnedElement.label !== m.pinnedElement.displayName
                          ? ` · "${m.pinnedElement.label.slice(0, 24)}"`
                          : ""}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {aiStatus === "loading" && (
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
          <div className="px-2.5 py-2.5 border-t border-border shrink-0">
            {pinned && (
              <div className="flex items-center gap-1.5 mb-1.5 bg-primary/10 border border-primary/20 rounded-lg px-2 py-1">
                <MessageCirclePlus className="w-3 h-3 text-primary shrink-0" />
                <span className="text-[10px] text-primary font-medium truncate flex-1 min-w-0">
                  {pinned.displayName}
                  {pinned.label && pinned.label !== pinned.displayName ? ` · "${pinned.label.slice(0, 24)}"` : ""}
                </span>
                <button
                  onClick={() => setPinned(null)}
                  className="text-primary/60 hover:text-primary transition-colors"
                  title="Remove pin"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {attachedImage && (
              <div className="flex items-center gap-2 mb-1.5 bg-muted/60 border border-border rounded-lg px-2 py-1.5">
                <img src={attachedImage.preview} alt="Attached" className="w-8 h-8 object-cover rounded flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground flex-1 min-w-0 truncate">
                  {prompt.trim().length > 10 ? "Reference ready · changes will be applied to canvas" : "Image ready · will be imported as new screen"}
                </span>
                <button onClick={() => setAttachedImage(null)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div
              className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-xl px-2.5 py-1.5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all"
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleImageAttach(f); }}
            >
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                onPaste={(e) => {
                  const items = Array.from(e.clipboardData?.items || []);
                  const imageItem = items.find((item) => item.type.startsWith("image/"));
                  if (imageItem) { e.preventDefault(); const f = imageItem.getAsFile(); if (f) handleImageAttach(f); }
                }}
                placeholder={attachedImage ? "Optional: name this screen…" : "Ask KiteAI or drop a screenshot to import…"}
                disabled={aiStatus === "loading"}
                className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 disabled:opacity-50 min-w-0"
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageAttach(f); e.target.value = ""; }}
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={aiStatus === "loading"}
                className="w-5 h-5 rounded hover:bg-muted border border-transparent hover:border-border text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-40"
                title="Attach image to import as design"
              >
                <ImagePlus className="w-3 h-3" />
              </button>
              {aiStatus === "loading" && <Loader2 className="w-3 h-3 animate-spin text-primary flex-shrink-0" />}
              {aiStatus === "error"   && <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />}
              <button
                onClick={handleGenerate}
                disabled={(!prompt.trim() && !attachedImage) || aiStatus === "loading"}
                className="w-6 h-6 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground flex items-center justify-center transition-colors flex-shrink-0"
                title="Send"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
            </div>
          </div>
        </TabsContent>

        {/* Layers tab */}
        <TabsContent value="layers" className="flex-1 m-0 overflow-hidden flex flex-col min-h-0 data-[state=inactive]:hidden">
          <LayersView />
        </TabsContent>

      </Tabs>
      {/* Lightbox for chat image previews — rendered here so it is in the same
          scope as the lightboxSrc state declared in DesignPanel. fixed positioning
          means it overlays the full viewport regardless of DOM location. */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-1"
            onClick={() => setLightboxSrc(null)}
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxSrc}
            alt="Uploaded reference"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Canvas drop area ─────────────────────────────────────────────────────────

/**
 * If all artboards in `state` share the same x position (within `tol` px),
 * spread them left-to-right from x=64 with 80 px gaps — matching
 * spreadArtboardsInState's full-replace behaviour.
 * Returns the same object reference unchanged when no spreading is needed.
 */
function destackArtboards(state: Record<string, any>): Record<string, any> {
  const artboardEntries = Object.entries(state).filter(
    ([, n]: [string, any]) => n?.type?.resolvedName === "AstryxArtboard"
  );
  if (artboardEntries.length < 2) return state;

  const xs = artboardEntries.map(([, n]: [string, any]) => Number(n.props?.x) || 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  // Only spread when artboards appear stacked (within 10 px of each other)
  if (maxX - minX > 10) return state;

  // Sort by existing x so relative order is preserved
  artboardEntries.sort(([, a]: [string, any], [, b]: [string, any]) =>
    (Number(a.props?.x) || 0) - (Number(b.props?.x) || 0)
  );
  const result = { ...state };
  let curX = 64;
  const baseY = Number(artboardEntries[0][1].props?.y) || 64;
  for (const [id, node] of artboardEntries) {
    const width = Number(node.props?.width) || 390;
    result[id] = { ...node, props: { ...node.props, x: curX, y: baseY } };
    curX += width + 80;
  }
  return result;
}

function CanvasArea({ craftState }: { craftState: string | null }) {
  // Validate before handing to craft.js — a malformed/truncated string would
  // produce a blank canvas with no error indicator rather than falling back to
  // the default artboard. If parsing fails, treat it as absent and render the
  // safe default.
  const validState = craftState
    ? (() => {
        try {
          const parsed = JSON.parse(craftState);
          const destacked = destackArtboards(parsed);
          // Only re-stringify if destacking actually changed something
          return destacked === parsed ? craftState : JSON.stringify(destacked);
        } catch { return null; }
      })()
    : null;

  if (validState) {
    return <Frame data={sanitizeCraftState(validState)} />;
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
  notes?: string | null;
  notesOpen?: boolean;
  onSetNotesOpen?: (open: boolean) => void;
  onSave?: (state: string) => void;
  /** Keepalive transport for the beforeunload flush — see SaveWatcher. */
  onBeforeUnloadSave?: (state: string) => void;
  onNotesChange?: (notes: string) => void;
}

export function DesignEditor({ editable, craftState, notes, notesOpen: notesOpenProp, onSetNotesOpen, onSave, onBeforeUnloadSave, onNotesChange }: DesignEditorProps) {
  const [zoom, setZoom] = useState(1);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [notesOpenInternal, setNotesOpenInternal] = useState(false);
  const [pinned, setPinned] = useState<PinnedElement | null>(null);

  const notesOpen = notesOpenProp !== undefined ? notesOpenProp : notesOpenInternal;
  const setNotesOpen = onSetNotesOpen ?? setNotesOpenInternal;

  const zoomIn = useCallback(() => setZoom((z) => Math.min(2, z * 1.15)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.15, z / 1.15)), []);
  const fitView = useCallback(() => setFitTrigger((t) => t + 1), []);

  const stableSave = useCallback(
    (state: string) => { onSave?.(state); },
    [onSave],
  );
  const stableBeforeUnloadSave = useCallback(
    (state: string) => { onBeforeUnloadSave?.(state); },
    [onBeforeUnloadSave],
  );

  return (
    <PinnedElementContext.Provider value={{ pinned, setPinned }}>
    <NotesContext.Provider value={{ notesOpen, setNotesOpen }}>
      <Editor resolver={resolver} enabled={editable}>
        <SnapGuideContext.Provider value={_setSnapGuides}>
        <HistoryProvider>
        <div className="flex h-full w-full" style={{ overflow: "clip" }}>
          {editable && <LeftRail />}
          <div className="flex flex-col flex-1 min-w-0">
            {editable && <CanvasToolbar zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onFitView={fitView} />}
            <div className="relative flex-1 min-h-0">
              <InfiniteCanvas zoom={zoom} onZoom={setZoom} fitTrigger={fitTrigger}>
                <CanvasArea craftState={craftState} />
              </InfiniteCanvas>
              {/* View-only notes overlay (editable users have Notes tab in DesignPanel) */}
              {!editable && (
                <NotesPanel
                  notes={notes ?? ""}
                  editable={false}
                  onNotesChange={undefined}
                />
              )}
            </div>
          </div>
          {editable && (
            <DesignPanel
              notes={notes ?? ""}
              editable={editable}
              onNotesChange={onNotesChange}
            />
          )}
        </div>
        {editable && onSave && (
          <SaveWatcher
            onSave={stableSave}
            onBeforeUnloadSave={onBeforeUnloadSave ? stableBeforeUnloadSave : undefined}
          />
        )}
        {editable && <KeyboardHandler />}
        {editable && <SelectionPinButton />}
        </HistoryProvider>
        </SnapGuideContext.Provider>
      </Editor>
    </NotesContext.Provider>
    </PinnedElementContext.Provider>
  );
}

export { createEmptyCraftState };
