import { useCallback, useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, AlertCircle, Clock, AlertTriangle, BookmarkPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import {
  COMPONENT_REGISTRY,
  AstryxUnknown,
} from '@/components/astryx';

type AstryxProps = Record<string, any>;

interface DesignComponent {
  id: string;
  astryxComponent: string;
  x: number;
  y: number;
  props?: Record<string, any>;
}

interface DesignEntityResponse {
  id: string;
  entity_type: string;
  data: {
    title?: string | null;
    components?: DesignComponent[];
  };
  expires_at?: string | null;
}

const DESIGN_MAX = 150;
const DESIGN_WARN = 120;

const CLAIM_RETURN_KEY = 'kiteframe-claim-return-url';
const CLAIM_ID_KEY = 'kiteframe-claim-workflow-id';

interface ClaimResponse {
  id: string;
  projectUuid: string;
  editUrl: string;
}

function useExpiryCountdown(expiresAt: string | null | undefined) {
  const [msLeft, setMsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => setMsLeft(new Date(expiresAt).getTime() - Date.now());
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return msLeft;
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "expired";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}

function ComponentCountBadge({ count }: { count: number }) {
  if (count < DESIGN_WARN) {
    return (
      <div className="fixed bottom-4 right-4 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 shadow-sm select-none" data-testid="component-count-badge">
        {count}/{DESIGN_MAX} components
      </div>
    );
  }
  if (count < DESIGN_MAX) {
    return (
      <div className="fixed bottom-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 shadow-sm select-none" data-testid="component-count-badge">
        <AlertTriangle className="w-3 h-3" />
        {count}/{DESIGN_MAX} components — approaching limit
      </div>
    );
  }
  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 shadow-sm select-none" data-testid="component-count-badge">
      <AlertTriangle className="w-3 h-3" />
      Limit reached ({DESIGN_MAX}/{DESIGN_MAX})
    </div>
  );
}

export default function DesignCanvasViewer() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<DesignEntityResponse>({
    queryKey: ["/api/public/entities/designs", id],
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

  const msLeft = useExpiryCountdown(data?.expires_at);

  const claimMutation = useMutation<ClaimResponse, Error, string>({
    mutationFn: async (externalWorkflowId: string) => {
      const res = await apiRequest('POST', '/api/workflows/claim', { externalWorkflowId });
      return res.json();
    },
    onSuccess: (result) => {
      localStorage.removeItem(CLAIM_RETURN_KEY);
      localStorage.removeItem(CLAIM_ID_KEY);
      setLocation(result.editUrl);
    },
  });

  useEffect(() => {
    if (!id) return;
    const pendingId = localStorage.getItem(CLAIM_ID_KEY);
    if (pendingId === id) {
      const timer = setTimeout(() => {
        claimMutation.mutate(id);
      }, 300);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleClaim = useCallback(() => {
    if (!id) return;
    fetch('/api/auth/user', { credentials: 'include' })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          localStorage.setItem(CLAIM_RETURN_KEY, window.location.href);
          localStorage.setItem(CLAIM_ID_KEY, id);
          window.location.href = '/api/login';
        } else {
          claimMutation.mutate(id);
        }
      })
      .catch(() => {
        claimMutation.mutate(id);
      });
  }, [id, claimMutation]);

  const components = data?.data?.components ?? [];
  const componentCount = components.length;

  const canvasWidth = Math.max(1200, ...components.map((c) => c.x + 400));
  const canvasHeight = Math.max(900, ...components.map((c) => c.y + 200));

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background" data-testid="loading-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading design…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    const is404 = error && (error as any)?.message?.includes("404");
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background" data-testid="error-screen">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-xl font-semibold">
            {is404 ? "This design has expired" : "Design not found"}
          </h2>
          <p className="text-muted-foreground">
            {is404
              ? "External designs expire after 24 hours and are automatically deleted."
              : "This design may not exist or may have been removed."}
          </p>
          <Button onClick={() => setLocation("/")} data-testid="button-go-home">
            Go to Kiteframe
          </Button>
        </div>
      </div>
    );
  }

  const showExpiryBanner = msLeft !== null && msLeft > 0;
  const isClaiming = claimMutation.isPending;
  const claimError = claimMutation.error;
  const title = data.data?.title || "Design Canvas";

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden" data-testid="design-canvas-viewer">
      {showExpiryBanner && (
        <div
          className="shrink-0 flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-2 text-sm"
          data-testid="expiry-banner"
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            This design expires in <strong>{formatTimeLeft(msLeft)}</strong>. Save it to your account to keep it permanently.
          </span>
        </div>
      )}
      {claimError && (
        <div
          className="shrink-0 flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 text-sm"
          data-testid="claim-error-banner"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{claimError.message || 'Failed to save design. Please try again.'}</span>
        </div>
      )}

      <div className="h-14 flex items-center px-4 border-b border-border shrink-0 gap-3">
        <h1 className="text-sm font-medium truncate flex-1">{title}</h1>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
          Design Canvas · Read Only
        </span>
        <Button
          size="sm"
          variant="default"
          onClick={handleClaim}
          disabled={isClaiming}
          data-testid="button-save-to-account"
          className="shrink-0"
        >
          {isClaiming ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <BookmarkPlus className="w-3.5 h-3.5 mr-1.5" />
              Save to my account
            </>
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        <div
          className="relative"
          style={{ width: canvasWidth, height: canvasHeight }}
          data-testid="design-canvas"
        >
          {components.map((comp) => {
            const Renderer = COMPONENT_REGISTRY[comp.astryxComponent];
            return (
              <div
                key={comp.id}
                className="absolute"
                style={{ left: comp.x, top: comp.y }}
                data-testid={`design-component-${comp.id}`}
              >
                {Renderer ? (
                  <Renderer {...(comp.props ?? {})} />
                ) : (
                  <AstryxUnknown astryxComponent={comp.astryxComponent} />
                )}
              </div>
            );
          })}

          {componentCount === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-gray-400">No components in this design.</p>
            </div>
          )}
        </div>
      </div>

      <ComponentCountBadge count={componentCount} />
    </div>
  );
}
