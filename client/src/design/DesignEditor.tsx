import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { Editor, Frame, Element, useEditor } from "@craftjs/core";
import { Trash2, MousePointer2, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import {
  resolver,
  AstryxSection,
  AstryxStack,
  AstryxHStack,
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
  createEmptyCraftState,
} from "./resolver";

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
}

interface ToolboxCategory {
  name: string;
  items: ToolboxItem[];
}

const TOOLBOX_CATEGORIES: ToolboxCategory[] = [
  {
    name: "Layout",
    items: [
      { name: "Section",  description: "Flex container",     getElement: () => <AstryxSection direction="column" gap={16} padding={16} /> },
      { name: "Stack",    description: "Vertical stack",     getElement: () => <AstryxStack gap={8} /> },
      { name: "HStack",   description: "Horizontal stack",   getElement: () => <AstryxHStack gap={8} /> },
    ],
  },
  {
    name: "Typography",
    items: [
      { name: "Heading",  description: "Bold heading",       getElement: () => <AstryxHeading size="lg">Heading</AstryxHeading> },
      { name: "Text",     description: "Body copy",          getElement: () => <AstryxText size="md">Text</AstryxText> },
    ],
  },
  {
    name: "Controls",
    items: [
      { name: "Button",    description: "Action button",     getElement: () => <AstryxButton variant="primary" size="md">Button</AstryxButton> },
      { name: "TextInput", description: "Input field",       getElement: () => <AstryxTextInput placeholder="Enter text…" /> },
    ],
  },
  {
    name: "Display",
    items: [
      { name: "Card",        description: "Elevated box",    getElement: () => <AstryxCard variant="elevated" /> },
      { name: "Badge",       description: "Colour label",    getElement: () => <AstryxBadge color="blue">Badge</AstryxBadge> },
      { name: "Avatar",      description: "User avatar",     getElement: () => <AstryxAvatar name="AB" size="md" /> },
      { name: "ProgressBar", description: "Progress bar",    getElement: () => <AstryxProgressBar value={50} color="blue" /> },
      { name: "StatusDot",   description: "Status indicator",getElement: () => <AstryxStatusDot status="online" /> },
      { name: "Skeleton",    description: "Loading skeleton",getElement: () => <AstryxSkeleton width={120} height={16} /> },
    ],
  },
  {
    name: "Feedback",
    items: [
      { name: "Banner",     description: "Alert banner",     getElement: () => <AstryxBanner variant="info">Message</AstryxBanner> },
      { name: "Spinner",    description: "Loading spinner",  getElement: () => <AstryxSpinner size="md" /> },
      { name: "EmptyState", description: "Empty state",      getElement: () => <AstryxEmptyState title="Nothing here" /> },
    ],
  },
  {
    name: "Content",
    items: [
      { name: "Divider",     description: "Horizontal rule", getElement: () => <AstryxDivider /> },
      { name: "ChatMessage", description: "Chat bubble",     getElement: () => <AstryxChatMessage sender="User">Hello!</AstryxChatMessage> },
      { name: "Token",       description: "Tag / chip",      getElement: () => <AstryxToken>Tag</AstryxToken> },
      { name: "Icon",        description: "Icon placeholder",getElement: () => <AstryxIcon size="md" /> },
    ],
  },
];

// ─── Toolbox ──────────────────────────────────────────────────────────────────

function DraggableItem({ item, connectors }: { item: ToolboxItem; connectors: any }) {
  return (
    <div
      ref={(ref) => { if (ref) connectors.create(ref, item.getElement()); }}
      className="flex flex-col px-2.5 py-2 rounded-md border border-border bg-background cursor-grab active:cursor-grabbing hover:border-primary/60 hover:bg-primary/5 transition-colors select-none"
    >
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
    <div className="w-48 shrink-0 border-r border-border bg-muted/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
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
            <div className="flex flex-col gap-1 pt-1">
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
              <div key={cat.name} className="mb-1">
                <button
                  onClick={() => toggleCategory(cat.name)}
                  className="w-full flex items-center justify-between px-1 py-1.5 rounded hover:bg-accent transition-colors group"
                >
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">
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
                  <div className="flex flex-col gap-1 mt-0.5 mb-1">
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
      <PropRow label="Direction"><SelectProp value={props.direction} options={["column","row"]} onChange={(v) => setProp("direction", v)} /></PropRow>
      <PropRow label="Gap (px)"><NumberProp value={props.gap ?? 16} onChange={(v) => setProp("gap", v)} min={0} /></PropRow>
      <PropRow label="Padding (px)"><NumberProp value={props.padding ?? 16} onChange={(v) => setProp("padding", v)} min={0} /></PropRow>
    </>
  );

  if (displayName === "AstryxStack") return (
    <PropRow label="Gap (px)"><NumberProp value={props.gap ?? 8} onChange={(v) => setProp("gap", v)} min={0} /></PropRow>
  );

  if (displayName === "AstryxHStack") return (
    <>
      <PropRow label="Gap (px)"><NumberProp value={props.gap ?? 8} onChange={(v) => setProp("gap", v)} min={0} /></PropRow>
      <PropRow label="Align"><SelectProp value={props.align ?? "center"} options={["start","center","end"]} onChange={(v) => setProp("align", v)} /></PropRow>
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
          </div>
        </>
      )}
    </div>
  );
}

// ─── Canvas drop area ─────────────────────────────────────────────────────────

function CanvasArea({ craftState }: { craftState: string | null }) {
  if (craftState) {
    return <Frame data={craftState} />;
  }
  return (
    <Frame>
      <Element canvas is={AstryxSection} direction="column" gap={16} padding={16}>
        {null}
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
      <div className="flex h-full w-full overflow-hidden">
        {editable && <Toolbox />}
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-6">
          <div
            className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-border min-h-[600px] min-w-[800px] w-full"
            style={{ maxWidth: 1200 }}
          >
            <CanvasArea craftState={craftState} />
          </div>
        </div>
        {editable && <SettingsPanel />}
      </div>
      {editable && onSave && <SaveWatcher onSave={stableSave} />}
    </Editor>
  );
}

export { createEmptyCraftState };
