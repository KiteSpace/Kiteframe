import { useEffect, useCallback, useRef } from "react";
import { Editor, Frame, Element, useEditor } from "@craftjs/core";
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
// Inner component (must be inside Editor context) that debounces and fires onSave.

function SaveWatcher({ onSave }: { onSave: (state: string) => void }) {
  const { query, subscribe } = useEditor(() => ({}));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedOnce = useRef(false);

  useEffect(() => {
    const unsub = subscribe(() => {
      // Skip the very first render (initial hydration — no user change yet)
      if (!savedOnce.current) {
        savedOnce.current = true;
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          const json = query.serialize();
          onSave(json);
        } catch {
          // Serialization can fail during hydration edge cases — safe to ignore
        }
      }, 800);
    });
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, subscribe, onSave]);

  return null;
}

// ─── Toolbox ──────────────────────────────────────────────────────────────────
// Drag sources for the 5 starter components.

const TOOLBOX_ITEMS = [
  {
    name: "Section",
    description: "Flex container",
    getElement: () => <AstryxSection direction="column" gap={16} padding={16} />,
  },
  {
    name: "Card",
    description: "Elevated box",
    getElement: () => <AstryxCard variant="elevated" />,
  },
  {
    name: "Button",
    description: "Action button",
    getElement: () => <AstryxButton variant="primary" size="md">Button</AstryxButton>,
  },
  {
    name: "Text",
    description: "Body copy",
    getElement: () => <AstryxText size="md">Text</AstryxText>,
  },
  {
    name: "TextInput",
    description: "Input field",
    getElement: () => <AstryxTextInput placeholder="Enter text…" />,
  },
];

function Toolbox() {
  const { connectors } = useEditor(() => ({}));

  return (
    <div className="w-44 shrink-0 border-r border-border bg-muted/30 flex flex-col overflow-y-auto">
      <div className="px-3 pt-3 pb-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          Components
        </p>
      </div>
      <div className="flex flex-col gap-1 px-2 pb-3">
        {TOOLBOX_ITEMS.map((item) => (
          <div
            key={item.name}
            ref={(ref) => {
              if (ref) connectors.create(ref, item.getElement());
            }}
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

// ─── Canvas drop area ─────────────────────────────────────────────────────────

function CanvasArea({ craftState }: { craftState: string | null }) {
  if (craftState) {
    return (
      <Frame data={craftState}>
        <div />
      </Frame>
    );
  }
  return (
    <Frame>
      <Element canvas is={AstryxSection} direction="column" gap={16} padding={16} />
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
    (state: string) => {
      onSave?.(state);
    },
    [onSave],
  );

  return (
    <Editor resolver={resolver} enabled={editable}>
      <div className="flex h-full w-full overflow-hidden">
        {editable && <Toolbox />}
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-6">
          <div
            className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-border min-h-[600px] min-w-[800px] w-full`}
            style={{ maxWidth: 1200 }}
          >
            <CanvasArea craftState={craftState} />
          </div>
        </div>
      </div>
      {editable && onSave && <SaveWatcher onSave={stableSave} />}
    </Editor>
  );
}

export { createEmptyCraftState };
