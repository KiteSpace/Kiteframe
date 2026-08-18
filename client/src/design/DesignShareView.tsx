import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DesignEditor } from "./DesignEditor";
import { sanitizeCraftState, pruneUnreachableCraftNodes, detectDisconnectedArtboards, repairCraftStateJson } from "./resolver";

/**
 * Payload from `GET /api/design-view/:shareUuid`, and from the live
 * `design_share_update` websocket message. Deliberately narrower than
 * `Design`: the public endpoint withholds ownership and provenance fields, so
 * this view must not depend on them.
 */
interface SharedDesign {
  id: string;
  title: string | null;
  notes: string | null;
  craftState: unknown;
  updatedAt: string | null;
}

interface ShareSocketMessage {
  type: string;
  shareId?: string;
  design?: SharedDesign;
}

const parsedTime = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);

/**
 * Public read-only view of a shared Interface.
 *
 * Intentionally does NOT reuse CraftDesignView: that component derives edit and
 * claim rights from `claimedByUserId`, which the public payload omits, so an
 * absent owner would read as "unclaimed" and offer a Save-to-my-account button
 * on someone else's Interface. This renders the editor in read-only mode only.
 *
 * Holds a websocket subscription to the share link so the owner's edits arrive
 * without a refresh, and so revoking the link ejects the viewer immediately
 * rather than leaving them looking at content they should no longer have.
 */
export default function DesignShareView() {
  const { shareUuid } = useParams<{ shareUuid: string }>();
  const [notesOpen, setNotesOpen] = useState(false);
  const [liveDesign, setLiveDesign] = useState<SharedDesign | null>(null);
  const [revoked, setRevoked] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<SharedDesign>({
    queryKey: ["/api/design-view", shareUuid],
    enabled: !!shareUuid,
    retry: false,
  });

  // refetch identity is not guaranteed stable across renders; hold it in a ref
  // so resubscribing never tears down and rebuilds the socket.
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!shareUuid) return;

    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

      socket.onopen = () => {
        attempts = 0;
        socket?.send(JSON.stringify({ type: "subscribe_share", shareId: shareUuid }));
        // An edit may have landed while the socket was down, so resynchronize
        // rather than trusting whatever was on screen when it dropped.
        refetchRef.current?.();
      };

      socket.onmessage = (event) => {
        let message: ShareSocketMessage;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.shareId !== shareUuid) return;

        if (message.type === "design_share_update" && message.design) {
          setLiveDesign(message.design);
          return;
        }
        if (message.type === "share_revoked") {
          // The owner turned sharing off. Stop showing the content now.
          setRevoked(true);
          return;
        }
        if (message.type === "share_subscribe_rejected") {
          // Could be a genuine revoke or a transient server-side lookup
          // failure, so let the REST endpoint be the judge instead of
          // blanking the screen on an ambiguous signal.
          refetchRef.current?.();
        }
      };

      socket.onerror = () => {
        try { socket?.close(); } catch { /* already closing */ }
      };

      socket.onclose = () => {
        if (disposed) return;
        attempts += 1;
        // Back off so a server restart doesn't get hammered, but stay
        // responsive for the common case of a brief blip.
        const delay = Math.min(30000, 1000 * 2 ** (attempts - 1));
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      try { socket?.close(); } catch { /* nothing to close */ }
    };
  }, [shareUuid]);

  // A reconnect refetch and a live message can disagree about which is newer,
  // so settle it by timestamp rather than by arrival order.
  const design = useMemo(() => {
    if (!liveDesign) return data ?? null;
    if (!data) return liveDesign;
    return parsedTime(data.updatedAt) > parsedTime(liveDesign.updatedAt) ? data : liveDesign;
  }, [liveDesign, data]);

  // Mirror the owner view's hydration pipeline so a shared link renders exactly
  // what the owner sees, including repair of legacy ghost artboards. Keyed on
  // the craft state itself so a live update re-hydrates; the object identity
  // only changes when a new payload actually arrives.
  const craftState = design?.craftState;
  const craftStateJson = useMemo(() => {
    if (!craftState) return null;
    const sanitized = repairCraftStateJson(sanitizeCraftState(JSON.stringify(craftState)));
    return detectDisconnectedArtboards(sanitized).length > 0
      ? pruneUnreachableCraftNodes(sanitized)
      : sanitized;
  }, [craftState]);

  if (isLoading && !design) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (revoked || isError || !design) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-md px-6">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-xl font-semibold">This link isn't active</h2>
          <p className="text-muted-foreground text-sm">
            The owner may have turned off sharing, or the link may be incorrect.
          </p>
          <Button onClick={() => (window.location.href = "/")}>Go to Kiteframe</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border shrink-0">
        <h1 className="text-sm font-medium truncate flex-1">
          {design.title ?? "Untitled Design"}
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            View only
          </span>
          {design.notes && (
            <button
              onClick={() => setNotesOpen((v) => !v)}
              className={`flex items-center gap-1 text-[10px] rounded-lg px-2 py-1 transition-colors border ${
                notesOpen
                  ? "text-primary bg-primary/10 border-primary/20"
                  : "text-muted-foreground border-border hover:bg-accent"
              }`}
              title="Toggle notes"
            >
              <StickyNote className="w-3 h-3" />
              Notes
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <DesignEditor
          editable={false}
          craftState={craftStateJson}
          notes={design.notes}
          notesOpen={notesOpen}
          onSetNotesOpen={setNotesOpen}
          designId={design.id}
          currentUserId={null}
        />
      </div>
    </div>
  );
}
