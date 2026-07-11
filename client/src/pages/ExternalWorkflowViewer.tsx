import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { KiteFrameCanvas } from '../lib/kiteframe/components/KiteFrameCanvas';
import { Loader2, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Node, Edge } from '../lib/kiteframe/types';
import '../lib/kiteframe/styles/kiteframe.css';

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
            <a href="/" className="underline underline-offset-2 font-medium hover:text-amber-900 dark:hover:text-amber-200">
              Sign in to save it permanently.
            </a>
          </span>
        </div>
      )}
      <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
        <h1 className="text-sm font-medium truncate">{data.title || 'Workflow'}</h1>
        <span className="ml-3 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Read Only</span>
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
