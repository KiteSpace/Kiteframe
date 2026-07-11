import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { KiteFrameCanvas } from '../lib/kiteframe/components/KiteFrameCanvas';
import { Loader2, AlertCircle, Clock, BookmarkPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Node, Edge } from '../lib/kiteframe/types';
import { apiRequest } from '@/lib/queryClient';
import '../lib/kiteframe/styles/kiteframe.css';

const CLAIM_RETURN_KEY = 'kiteframe-claim-return-url';
const CLAIM_ID_KEY = 'kiteframe-claim-workflow-id';

// Lightweight read-only render page for workflows submitted via the external
// API (/api/external/workflows). Intentionally not a reuse of ViewOnlyViewer:
// that component is coupled to shareUuid/PRD-notes-seeding/localStorage that
// don't apply to externally-submitted workflows, which have no owning user,
// PRD, or notes data — just nodes/edges to render.
interface ExternalWorkflowData {
  id: string;
  title?: string | null;
  nodes: Node[];
  edges: Edge[];
  expires_at?: string | null;
}

interface ClaimResponse {
  id: string;
  projectUuid: string;
  editUrl: string;
}

function useExpiryCountdown(expiresAt: string | null | undefined) {
  const [msLeft, setMsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;

    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      setMsLeft(diff);
    };

    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return msLeft;
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'expired';
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export default function ExternalWorkflowViewer() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  const { data, isLoading, error } = useQuery<ExternalWorkflowData>({
    queryKey: ['/api/public/workflows', id],
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

  const msLeft = useExpiryCountdown(data?.expires_at);

  const nodes = data?.nodes || [];
  const edges = data?.edges || [];

  const noopChange = useCallback(() => {}, []);

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

  // On mount: if returning from login with a pending claim for this workflow, auto-trigger it
  useEffect(() => {
    if (!id) return;
    const pendingId = localStorage.getItem(CLAIM_ID_KEY);
    if (pendingId === id) {
      // Small delay to let auth session settle after redirect back
      const timer = setTimeout(() => {
        claimMutation.mutate(id);
      }, 300);
      return () => clearTimeout(timer);
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleClaim = useCallback(() => {
    if (!id) return;

    // Check if user is authenticated by trying the claim; if 401, redirect to login
    // We detect auth state by whether /api/auth/user is in the query cache, but it's
    // simpler to just attempt the mutation and redirect on 401. However, to give instant
    // feedback for unauthenticated users, we check the session first.
    fetch('/api/auth/user', { credentials: 'include' })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          // Not logged in — save intent and redirect to login
          localStorage.setItem(CLAIM_RETURN_KEY, window.location.href);
          localStorage.setItem(CLAIM_ID_KEY, id);
          window.location.href = '/api/login';
        } else {
          claimMutation.mutate(id);
        }
      })
      .catch(() => {
        // Network error — attempt the claim and let the mutation surface the error
        claimMutation.mutate(id);
      });
  }, [id, claimMutation]);

  const handleFitView = useCallback(() => {
    if (nodes.length === 0) return;

    const containerRect = canvasContainerRef.current?.getBoundingClientRect();
    const containerWidth = containerRect?.width || window.innerWidth;
    const containerHeight = containerRect?.height || window.innerHeight;

    const padding = 80;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach((node) => {
      const { x, y } = node.position;
      const width = node.width || 200;
      const height = node.height || 100;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    const contentWidth = Math.max(maxX - minX, 100);
    const contentHeight = Math.max(maxY - minY, 100);

    const zoomX = (containerWidth - 2 * padding) / contentWidth;
    const zoomY = (containerHeight - 2 * padding) / contentHeight;
    const fitZoom = Math.min(zoomX, zoomY);
    const zoom = Math.max(0.1, Math.min(fitZoom, 2));

    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;

    setViewport({
      x: containerWidth / 2 - centerX * zoom,
      y: containerHeight / 2 - centerY * zoom,
      zoom,
    });
  }, [nodes]);

  useEffect(() => {
    if (data && nodes.length > 0) {
      const timer = setTimeout(handleFitView, 150);
      return () => clearTimeout(timer);
    }
  }, [data, nodes.length, handleFitView]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background" data-testid="loading-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    // Distinguish a 404 (expired / not found) from other errors
    const is404 = error && (error as any)?.message?.includes('404');
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background" data-testid="error-screen">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-xl font-semibold">
            {is404 ? 'Workflow Expired' : 'Workflow Not Found'}
          </h2>
          <p className="text-muted-foreground">
            {is404
              ? 'This workflow was created anonymously and has expired. Sign in to Kiteframe to save workflows permanently.'
              : 'This workflow may not exist or may have been removed.'}
          </p>
          <Button onClick={() => setLocation('/')} data-testid="button-go-home">
            Go to Kiteframe
          </Button>
        </div>
      </div>
    );
  }

  // Show expiry banner when the workflow expires within 24 h and hasn't expired yet
  const showExpiryBanner = msLeft !== null && msLeft > 0;
  const isClaiming = claimMutation.isPending;
  const claimError = claimMutation.error;

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden" data-testid="external-workflow-viewer">
      {showExpiryBanner && (
        <div
          className="shrink-0 flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-2 text-sm"
          data-testid="expiry-banner"
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            This workflow was created anonymously and expires in{' '}
            <strong>{formatTimeLeft(msLeft)}</strong>.{' '}
            Save it to your account to keep it permanently.
          </span>
        </div>
      )}
      {claimError && (
        <div
          className="shrink-0 flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2 text-sm"
          data-testid="claim-error-banner"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{claimError.message || 'Failed to save workflow. Please try again.'}</span>
        </div>
      )}
      <div className="h-14 flex items-center px-4 border-b border-border shrink-0 gap-3">
        <h1 className="text-sm font-medium truncate flex-1">{data.title || 'Workflow'}</h1>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">Read Only</span>
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
      <div ref={canvasContainerRef} className="flex-1 relative overflow-hidden">
        <KiteFrameCanvas
          nodes={nodes}
          edges={edges}
          canvasObjects={[]}
          onNodesChange={noopChange}
          onEdgesChange={noopChange}
          onCanvasObjectsChange={noopChange}
          onConnect={noopChange}
          viewport={viewport}
          onViewportChange={setViewport}
          minZoom={0.1}
          maxZoom={3}
          enablePlugins={false}
          readOnly={true}
          className="w-full h-full"
          data-testid="external-workflow-canvas"
        />
      </div>
    </div>
  );
}
