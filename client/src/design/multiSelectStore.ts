/**
 * Module-level multi-selection store shared between the design editor's
 * keyboard handlers / inspector (DesignEditor.tsx) and the component
 * renderers (resolver.tsx — e.g. multi-artboard group drag).
 *
 * Craft's native multi-selection (Shift+Click) is the single source of truth;
 * MultiSelectHandler in DesignEditor mirrors `state.events.selected` into this
 * ref so module-level handlers can read the full id list synchronously.
 */
import { useState, useEffect } from "react";

/** Set of node IDs currently held in the multi-selection (mirrors craft state). */
export const _multiSelRef = { current: new Set<string>() };

/** Subscribers for UI that must react to the full selection set rather than Craft's anchor node. */
const _multiSelListeners = new Set<(ids: string[]) => void>();

export function publishMultiSelection(ids: Set<string>) {
  const next = Array.from(ids);
  _multiSelListeners.forEach((listener) => listener(next));
}

export function useMultiSelectionIds(): string[] {
  const [ids, setIds] = useState(() => Array.from(_multiSelRef.current));
  useEffect(() => {
    _multiSelListeners.add(setIds);
    return () => { _multiSelListeners.delete(setIds); };
  }, []);
  return ids;
}

/** Synchronous snapshot of the current multi-selection set. */
export function getMultiSelectionIds(): Set<string> {
  return _multiSelRef.current;
}
