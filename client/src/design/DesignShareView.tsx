import { useMemo, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DesignEditor } from "./DesignEditor";
import { sanitizeCraftState, pruneUnreachableCraftNodes, detectDisconnectedArtboards, repairCraftStateJson } from "./resolver";

/**
 * Payload from `GET /api/design-view/:shareUuid`. Deliberately narrower than
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

/**
 * Public read-only view of a shared Interface.
 *
 * Intentionally does NOT reuse CraftDesignView: that component derives edit and
 * claim rights from `claimedByUserId`, which the public payload omits, so an
 * absent owner would read as "unclaimed" and offer a Save-to-my-account button
 * on someone else's Interface. This renders the editor in read-only mode only.
 */
export default function DesignShareView() {
  const { shareUuid } = useParams<{ shareUuid: string }>();
  const [notesOpen, setNotesOpen] = useState(false);

  const { data, isLoading, isError } = useQuery<SharedDesign>({
    queryKey: ["/api/design-view", shareUuid],
    enabled: !!shareUuid,
    retry: false,
  });

  // Mirror the owner view's hydration pipeline so a shared link renders exactly
  // what the owner sees, including repair of legacy ghost artboards.
  const craftStateJson = useMemo(() => {
    if (!data?.craftState) return null;
    const sanitized = repairCraftStateJson(sanitizeCraftState(JSON.stringify(data.craftState)));
    return detectDisconnectedArtboards(sanitized).length > 0
      ? pruneUnreachableCraftNodes(sanitized)
      : sanitized;
  }, [data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
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
          {data.title ?? "Untitled Design"}
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            View only
          </span>
          {data.notes && (
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
          notes={data.notes}
          notesOpen={notesOpen}
          onSetNotesOpen={setNotesOpen}
          designId={data.id}
          currentUserId={null}
        />
      </div>
    </div>
  );
}
