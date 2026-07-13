import { useEffect, useCallback, useRef } from "react";
import { Editor, Frame, Element, useEditor } from "@craftjs/core";
import { Trash2, MousePointer2 } from "lucide-react";
import {
  resolver,
  AstryxButton,
  AstryxCard,
  AstryxText,
  AstryxTextInput,
  AstryxSection,
  createEmptyCraftState,
} from "./resolver";

// ─── SaveWatcher ─────────────────────────────────────────────────────────────

function SaveWatcher({ onSave }: { onSave: (state: string) => void }) {
  const { query, subscribe } = useEditor(() => ({}));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedOnce = useRef(false);

  useEffect(() => {
    const unsub = subscribe(() => {
      if (!savedOnce.current) { savedOnce.current = true; return; }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try { onSave(query.serialize()); } catch { /* ignore hydration edge cases */ }
      }, 800);
    });
    return () => { unsub(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, subscribe, onSave]);

  return null;
}

// ─── Toolbox ──────────────────────────────────────────────────────────────────

const TOOLBOX_ITEMS = [
  { name: "Section",   description: "Flex container", getElement: () => <AstryxSection direction="column" gap={16} padding={16} /> },
  { name: "Card",      description: "Elevated box",   getElement: () => <AstryxCard variant="elevated" /> },
  { name: "Button",    description: "Action button",  getElement: () => <AstryxButton variant="primary" size="md">Button</AstryxButton> },
  { name: "Text",      description: "Body copy",      getElement: () => <AstryxText size="md">Text</AstryxText> },
  { name: "TextInput", description: "Input field",    getElement: () => <AstryxTextInput placeholder="Enter text…" /> },
];

function Toolbox() {
  const { connectors } = useEditor(() => ({}));
  return (
    <div className="w-44 shrink-0 border-r border-border bg-muted/30 flex flex-col overflow-y-auto">
      <div className="px-3 pt-3 pb-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Components</p>
      </div>
      <div className="flex flex-col gap-1 px-2 pb-3">
        {TOOLBOX_ITEMS.map((item) => (
          <div
            key={item.name}
            ref={(ref) => { if (ref) connectors.create(ref, item.getElement()); }}
            className="flex flex-col px-3 py-2.5 rounded-md border border-border bg-background text-sm cursor-grab active:cursor-grabbing hover:border-primary/60 hover:bg-primary/5 transition-colors select-none"
          >
            <span className="font-medium text-foreground text-xs">{item.name}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{item.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings panel helpers ────────────────────────────────────────────────────

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
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

function NumberProp({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
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
  if (displayName === "AstryxButton") return (
    <>
      <PropRow label="Label"><TextProp value={props.children ?? "Button"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Variant"><SelectProp value={props.variant} options={["primary","secondary","outline","ghost"]} onChange={(v) => setProp("variant", v)} /></PropRow>
      <PropRow label="Size"><SelectProp value={props.size} options={["sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
      <PropRow label="Disabled">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.disabled} onChange={(v) => setProp("disabled", v)} />
          <span className="text-xs text-muted-foreground">{props.disabled ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxText") return (
    <>
      <PropRow label="Content"><TextProp value={props.children ?? "Text"} onChange={(v) => setProp("children", v)} /></PropRow>
      <PropRow label="Size"><SelectProp value={props.size} options={["xs","sm","md","lg"]} onChange={(v) => setProp("size", v)} /></PropRow>
      <PropRow label="Muted">
        <div className="flex items-center gap-2">
          <ToggleProp value={!!props.muted} onChange={(v) => setProp("muted", v)} />
          <span className="text-xs text-muted-foreground">{props.muted ? "Yes" : "No"}</span>
        </div>
      </PropRow>
    </>
  );

  if (displayName === "AstryxCard") return (
    <PropRow label="Variant"><SelectProp value={props.variant} options={["elevated","outlined","ghost"]} onChange={(v) => setProp("variant", v)} /></PropRow>
  );

  if (displayName === "AstryxTextInput") return (
    <>
      <PropRow label="Label"><TextProp value={props.label ?? ""} onChange={(v) => setProp("label", v)} /></PropRow>
      <PropRow label="Placeholder"><TextProp value={props.placeholder ?? ""} onChange={(v) => setProp("placeholder", v)} /></PropRow>
    </>
  );

  if (displayName === "AstryxSection") return (
    <>
      <PropRow label="Direction"><SelectProp value={props.direction} options={["column","row"]} onChange={(v) => setProp("direction", v)} /></PropRow>
      <PropRow label="Gap (px)"><NumberProp value={props.gap ?? 16} onChange={(v) => setProp("gap", v)} /></PropRow>
      <PropRow label="Padding (px)"><NumberProp value={props.padding ?? 16} onChange={(v) => setProp("padding", v)} /></PropRow>
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
          <div className="px-3 pt-3 pb-2 flex items-center justify-between border-b border-border">
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
