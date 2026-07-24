import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, AlertCircle, BookmarkPlus, StickyNote, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { DesignEditor } from "./DesignEditor";
import { sanitizeCraftState } from "./resolver";
import type { Design } from "@shared/schema";

// Lazy-load the legacy viewer — only used for old external_entities records
const LegacyViewer = lazy(() => import("@/pages/DesignCanvasViewer"));

// ─── Loading / Error screens ──────────────────────────────────────────────────

function LoadingScreen({ inline }: { inline?: boolean }) {
  return (
    <div className={`${inline ? "h-full w-full" : "h-screen w-screen"} flex items-center justify-center bg-background`}>
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function ErrorScreen({ message, inline }: { message?: string; inline?: boolean }) {
  return (
    <div className={`${inline ? "h-full w-full" : "h-screen w-screen"} flex items-center justify-center bg-background`}>
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-semibold">Design not found</h2>
        <p className="text-muted-foreground text-sm">{message ?? "This design may have been removed or never existed."}</p>
        {!inline && <Button onClick={() => window.location.href = "/"}>Go to Kiteframe</Button>}
      </div>
    </div>
  );
}

// ─── Craft.js design view ─────────────────────────────────────────────────────

function SaveStatusDot({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "saving") return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />;
  if (status === "saved") return <Check className="w-3.5 h-3.5 text-green-500" />;
  if (status === "error") return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
  return null;
}

interface CraftDesignViewProps {
  design: Design;
  currentUserId: string | null;
  inline?: boolean;
  onNavigateToWorkflow?: () => void;
}

function CraftDesignView({ design, currentUserId, inline, onNavigateToWorkflow }: CraftDesignViewProps) {
  const qc = useQueryClient();
  const saveStatusRef = useRef<"idle" | "saving" | "saved" | "error">("idle");
  const [notesOpen, setNotesOpen] = useState(false);

  const isOwner = !!(currentUserId && design.claimedByUserId === currentUserId);
  const isUnclaimed = !design.claimedByUserId;
  const canEdit = isOwner;

  // Keep a stable ref to the design id so the keepalive callback never needs
  // to re-close over a changing prop and is safe to call from beforeunload.
  const designIdRef = useRef(design.id);
  designIdRef.current = design.id;

  // Regular debounced save — normal in-session transport via useMutation.
  const patchMutation = useMutation({
    mutationFn: async (craftState: string) => {
      await apiRequest("PATCH", `/api/designs/${design.id}`, { craftState });
    },
    onSuccess: () => {
      saveStatusRef.current = "saved";
      setTimeout(() => { saveStatusRef.current = "idle"; }, 1500);
    },
    onError: () => {
      saveStatusRef.current = "error";
    },
  });

  const notesMutation = useMutation({
    mutationFn: async (notes: string) => {
      await apiRequest("PATCH", `/api/designs/${design.id}`, { notes });
    },
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/designs/${design.id}/claim`, {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/designs', design.id] });
    },
  });

  // Called by the 800 ms debounce path — uses patchMutation (normal fetch).
  const handleSave = useCallback((state: string) => {
    saveStatusRef.current = "saving";
    patchMutation.mutate(state);
  }, [patchMutation]);

  // Called only from the beforeunload flush in SaveWatcher.
  // Uses fetch({ keepalive: true }) so the browser does NOT cancel the request
  // when the user navigates away (Cmd+R / link click) before it completes.
  // This is the targeted fix for the race condition where reloading within the
  // 800 ms debounce window silently dropped the pending craft-state save.
  // Note: keepalive requests have a ~64 KB body cap; suitable for typical
  // designs but very large ones should warn the user before closing the tab.
  const handleBeforeUnloadSave = useCallback((state: string) => {
    fetch(`/api/designs/${designIdRef.current}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ craftState: state }),
      keepalive: true,
      credentials: "include",
    }).catch(() => { /* fire-and-forget; best-effort on unload */ });
  }, []); // stable — reads design id from ref

  const handleNotesChange = useCallback((notes: string) => {
    notesMutation.mutate(notes);
  }, [notesMutation]);

  // Sanitize before reaching DesignEditor so both editable and view-only
  // paths are protected regardless of how the editor renders the state.
  const rawCraftStateJson = design.craftState
    ? JSON.stringify(design.craftState)
    : null;
  const craftStateJson = rawCraftStateJson
    ? sanitizeCraftState(rawCraftStateJson)
    : null;

  return (
    <div className={`${inline ? "h-full w-full" : "h-screen w-screen"} flex flex-col bg-background overflow-hidden`}>
      {/* Header — only show when inline and generated from a workflow */}
      {inline && design.source === "workflow-bridge" && design.title && (
        <div className="h-10 flex items-center gap-3 px-4 border-b border-border shrink-0">
          <button
            onClick={onNavigateToWorkflow}
            disabled={!onNavigateToWorkflow}
            title={onNavigateToWorkflow ? `Go to workflow: ${design.title}` : design.title}
            className="flex items-center gap-1.5 text-xs font-medium bg-blue-600 text-white px-2.5 py-0.5 rounded-full truncate max-w-xs transition-colors hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-70"
          >
            <Workflow className="w-3 h-3 shrink-0" />
            {design.title}
          </button>
          <div className="flex items-center gap-2">
            {canEdit && <SaveStatusDot status={saveStatusRef.current} />}
            {!canEdit && (
              <>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  View only
                </span>
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
              </>
            )}
            {isUnclaimed && currentUserId && (
              <Button
                size="sm"
                variant="default"
                onClick={() => claimMutation.mutate()}
                disabled={claimMutation.isPending}
              >
                {claimMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</>
                ) : (
                  <><BookmarkPlus className="w-3.5 h-3.5 mr-1.5" />Save to my account</>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
      {/* Standalone header */}
      {!inline && (
        <div className="h-14 flex items-center gap-3 px-4 border-b border-border shrink-0">
          <h1 className="text-sm font-medium truncate flex-1">
            {design.title ?? "Untitled Design"}
          </h1>
          <div className="flex items-center gap-2">
            {canEdit && <SaveStatusDot status={saveStatusRef.current} />}
            {!canEdit && (
              <>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  View only
                </span>
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
              </>
            )}
            {isUnclaimed && currentUserId && (
              <Button
                size="sm"
                variant="default"
                onClick={() => claimMutation.mutate()}
                disabled={claimMutation.isPending}
              >
                {claimMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</>
                ) : (
                  <><BookmarkPlus className="w-3.5 h-3.5 mr-1.5" />Save to my account</>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <DesignEditor
          editable={canEdit}
          craftState={craftStateJson}
          notes={design.notes}
          notesOpen={notesOpen}
          onSetNotesOpen={setNotesOpen}
          onSave={canEdit ? handleSave : undefined}
          onBeforeUnloadSave={canEdit ? handleBeforeUnloadSave : undefined}
          onNotesChange={canEdit ? handleNotesChange : undefined}
        />
      </div>
    </div>
  );
}

// ─── DesignTabView — inline version for use inside WorkflowEditor tabs ─────────

interface DesignTabViewProps {
  designId: string;
  onTitleLoaded?: (title: string) => void;
  onNavigateToWorkflow?: (workflowName: string) => void;
}

export function DesignTabView({ designId, onTitleLoaded, onNavigateToWorkflow }: DesignTabViewProps) {
  const { data: design, isLoading: isDesignLoading, isError } = useQuery<Design>({
    queryKey: ['/api/designs', designId],
    enabled: !!designId,
    retry: false,
  });

  const { data: user, isLoading: isUserLoading } = useQuery<{ id: string } | null>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const isLoading = isDesignLoading || (!!design && isUserLoading);

  // Propagate design title to the parent tab bar once it loads
  const titleRef = useRef<string | null>(null);
  useEffect(() => {
    if (design?.title && design.title !== titleRef.current) {
      titleRef.current = design.title;
      onTitleLoaded?.(design.title);
    }
  }, [design?.title, onTitleLoaded]);

  if (isLoading) {
    return <LoadingScreen inline />;
  }

  if (design) {
    return (
      <CraftDesignView
        design={design}
        currentUserId={user?.id ?? null}
        inline
        onNavigateToWorkflow={
          onNavigateToWorkflow && design.title
            ? () => onNavigateToWorkflow(design.title!)
            : undefined
        }
      />
    );
  }

  if (isError) {
    return (
      <Suspense fallback={<LoadingScreen inline />}>
        <LegacyViewer />
      </Suspense>
    );
  }

  return <ErrorScreen inline />;
}

// ─── DesignPage ───────────────────────────────────────────────────────────────

export default function DesignPage() {
  const { id } = useParams<{ id: string }>();

  // Fetch design and current user in parallel so ownership is resolved before
  // the editor mounts. Without this, the user query would only start after the
  // design loaded, causing a window where canEdit=false and the Editor would
  // initialise in read-only mode before correcting itself.
  const { data: design, isLoading: isDesignLoading, isError } = useQuery<Design>({
    queryKey: ['/api/designs', id],
    enabled: !!id,
    retry: false,
  });

  // Always run in parallel — do NOT gate on !!design.
  const { data: user, isLoading: isUserLoading } = useQuery<{ id: string } | null>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  // Show loading until both are ready (design found path only waits for user
  // when a craft.js design actually exists, to avoid unnecessary delay on the
  // legacy-viewer fallback path).
  const isLoading = isDesignLoading || (!!design && isUserLoading);

  if (isLoading) {
    return <LoadingScreen />;
  }

  // New craft.js design found — both design and user are resolved at this point,
  // so canEdit is stable on first render and the Editor never initialises
  // in the wrong mode.
  if (design) {
    return (
      <CraftDesignView
        design={design}
        currentUserId={user?.id ?? null}
      />
    );
  }

  // Not in new designs table → fall back to legacy flat-JSON viewer
  // (LegacyViewer uses its own useParams and fetches from /api/public/entities/designs/:id)
  if (isError) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <LegacyViewer />
      </Suspense>
    );
  }

  return <ErrorScreen />;
}
