import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";

/**
 * Lets a deeply nested component open a design without knowing whether it is
 * running inside a host that has tabs.
 *
 * The workflow editor owns the tab list, and the chat that wants to open a
 * design sits many levels below it, behind panels that are also rendered on
 * surfaces with no tabs at all — notably the read-only shared-link view. A
 * context keeps those surfaces working: where a host provides one, the design
 * opens as a tab in place; where none does, it falls back to the standalone
 * route, which is the only thing that makes sense without a tab bar.
 */
export interface DesignTabHost {
  /** Focus the tab for this design, opening one if it is not already there. */
  openDesign: (designId: string, title?: string) => void;
}

const DesignTabHostContext = createContext<DesignTabHost | null>(null);

export function DesignTabHostProvider({ host, children }: { host: DesignTabHost; children: ReactNode }) {
  // Callers build the host inline, so memoize on the callback it carries rather
  // than on the object identity, which would change on every render.
  const value = useMemo(() => host, [host.openDesign]);
  return <DesignTabHostContext.Provider value={value}>{children}</DesignTabHostContext.Provider>;
}

/**
 * Returns a function that opens a design the best way the current surface can.
 * Safe to call anywhere — with no host it navigates to the design's own page.
 */
export function useOpenDesign(): (designId: string, title?: string) => void {
  const host = useContext(DesignTabHostContext);
  const [, navigate] = useLocation();
  return useCallback(
    (designId: string, title?: string) => {
      if (host) {
        host.openDesign(designId, title);
        return;
      }
      navigate(`/designs/${designId}`);
    },
    [host, navigate],
  );
}

/** Whether an in-app tab host is available, for callers that adjust their wording. */
export function useHasDesignTabHost(): boolean {
  return useContext(DesignTabHostContext) !== null;
}
