import { useEffect, useMemo, useState } from "react";
import { Editor, Frame } from "@craftjs/core";
import { Paintbrush } from "lucide-react";
import { resolver, sanitizeCraftState } from "@/design/resolver";

interface DesignProjectThumbnailProps {
  designId: string;
  name: string;
}

function getFirstArtboardState(craftState: unknown): string | null {
  if (!craftState || typeof craftState !== "object") return null;
  const state = craftState as Record<string, any>;
  const root = state.ROOT;
  const firstArtboardId = (root?.nodes ?? []).find(
    (id: string) => state[id]?.displayName === "AstryxArtboard",
  );
  if (!firstArtboardId) return null;

  const included = new Set<string>(["ROOT"]);
  const visit = (id: string) => {
    if (included.has(id) && id !== firstArtboardId) return;
    included.add(id);
    const node = state[id];
    for (const childId of node?.nodes ?? []) visit(childId);
    for (const childId of Object.values(node?.linkedNodes ?? {})) visit(childId as string);
  };
  visit(firstArtboardId);

  const preview: Record<string, any> = {};
  for (const id of Array.from(included)) {
    if (!state[id]) continue;
    preview[id] = id === "ROOT"
      ? { ...state[id], nodes: [firstArtboardId], linkedNodes: {} }
      : state[id];
  }
  return JSON.stringify(preview);
}

export function DesignProjectThumbnail({ designId, name }: DesignProjectThumbnailProps) {
  const [craftState, setCraftState] = useState<unknown>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setCraftState(null);
    setFailed(false);
    fetch(`/api/designs/${designId}`, { credentials: "include", signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Preview unavailable")))
      .then((design) => setCraftState(design.craftState))
      .catch((error) => {
        if (error.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, [designId]);

  const previewState = useMemo(() => getFirstArtboardState(craftState), [craftState]);
  if (!previewState || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Paintbrush size={32} className="text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-muted pointer-events-none select-none" aria-label={`${name} design preview`}>
      <div
        className="absolute left-1/2 top-1/2 w-[390px] origin-center"
        style={{ transform: "translate(-50%, -50%) scale(0.38)" }}
      >
        <Editor resolver={resolver} enabled={false}>
          <Frame data={sanitizeCraftState(previewState)} />
        </Editor>
      </div>
    </div>
  );
}