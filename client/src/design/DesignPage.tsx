import { lazy, Suspense, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, AlertCircle, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { DesignEditor } from "./DesignEditor";
import type { Design } from "@shared/schema";

// Lazy-load the legacy viewer — only used for old external_entities records
const LegacyViewer = lazy(() => import("@/pages/DesignCanvasViewer"));

// ─── Loading / Error screens ──────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function ErrorScreen({ message }: { message?: string }) {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-semibold">Design not found</h2>
        <p className="text-muted-foreground text-sm">{message ?? "This design may have been removed or never existed."}</p>
        <Button onClick={() => window.location.href = "/"}>Go to Kiteframe</Button>
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
}

function CraftDesignView({ design, currentUserId }: CraftDesignViewProps) {
  const qc = useQueryClient();
  const saveStatusRef = useRef<"idle" | "saving" | "saved" | "error">("idle");

  const isOwner = !!(currentUserId && design.claimedByUserId === currentUserId);
  const isUnclaimed = !design.claimedByUserId;
  const canEdit = isOwner;

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

  const claimMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/designs/${design.id}/claim`, {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/designs', design.id] });
    },
  });

  const handleSave = useCallback((state: string) => {
    saveStatusRef.current = "saving";
    patchMutation.mutate(state);
  }, [patchMutation]);

  const craftStateJson = design.craftState
    ? JSON.stringify(design.craftState)
    : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border shrink-0">
        <h1 className="text-sm font-medium truncate flex-1">
          {design.title ?? "Untitled Design"}
        </h1>
        <div className="flex items-center gap-2">
          {canEdit && <SaveStatusDot status={saveStatusRef.current} />}
          {!canEdit && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              View only
            </span>
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

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <DesignEditor
          editable={canEdit}
          craftState={craftStateJson}
          onSave={canEdit ? handleSave : undefined}
        />
      </div>
    </div>
  );
}

// ─── DesignPage ───────────────────────────────────────────────────────────────

export default function DesignPage() {
  const { id } = useParams<{ id: string }>();

  // Try new designs table first
  const { data: design, isLoading, isError } = useQuery<Design>({
    queryKey: ['/api/designs', id],
    enabled: !!id,
    retry: false,
  });

  // Get current user (for ownership check)
  const { data: user } = useQuery<{ id: string } | null>({
    queryKey: ['/api/auth/user'],
    retry: false,
    enabled: !!design,
  });

  if (isLoading) {
    return <LoadingScreen />;
  }

  // New craft.js design found
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
