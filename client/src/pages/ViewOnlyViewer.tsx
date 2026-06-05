import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { KiteFrameCanvas } from '../lib/kiteframe/components/KiteFrameCanvas';
import { Loader2, AlertCircle, Radio, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ViewOnlyToolbar } from '@/components/ViewOnlyToolbar';
import { ProjectPanel } from '@/components/panels/ProjectPanel/ProjectPanel';
import { CommentsOverlay } from '@/components/comments/CommentsOverlay';
import { useAuth } from '@/hooks/useAuth';
import { SharedViewHeader } from '@/components/SharedViewHeader';
import { AiProvider } from '../ai/AiProvider';
import { OpenAICompatClient } from '../ai/OpenAICompatClient';
import type { Node, Edge, CanvasObject } from '../lib/kiteframe/types';
import type { FlowSettingsMap } from '../lib/kiteframe/utils/FlowDetection';
import type { ProjectPRD, WorkflowPRD } from '../ai/prdEngine';
import { saveWorkflowPRD, listWorkflowPRDs, deleteWorkflowPRD } from '../lib/kiteframe/utils/prdStorage';
import { prdGenerationBus } from '../stores/prdGenerationBus';
import '../lib/kiteframe/styles/kiteframe.css';

interface SharedProjectData {
  shareUuid: string;
  locked?: boolean;
  projectName?: string;
  projectDescription?: string;
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  viewport?: { x: number; y: number; zoom: number };
  flowSettings?: FlowSettingsMap;
  isOwner?: boolean;
  redirect?: string;
  projectUuid?: string;
  prdData?: ProjectPRD | null;
  workflowPRDs?: WorkflowPRD[] | null;
  notesData?: string | null;
  detailsData?: string | null;
}

interface ShareUpdateMessage {
  type: 'share_update';
  shareId: string;
  nodes?: Node[];
  edges?: Edge[];
  canvasObjects?: CanvasObject[];
  viewport?: { x: number; y: number; zoom: number };
  flowSettings?: FlowSettingsMap;
  prdData?: ProjectPRD | null;
  workflowPRDs?: WorkflowPRD[] | null;
  notesData?: string | null;
  detailsData?: string | null;
}

interface ShareSubscribedMessage {
  type: 'share_subscribed';
  shareId: string;
}

type WsMessage = ShareUpdateMessage | ShareSubscribedMessage | { type: string };

export default function ViewOnlyViewer() {
  const { shareId } = useParams<{ shareId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [canvasObjects, setCanvasObjects] = useState<CanvasObject[]>([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [flowSettings, setFlowSettings] = useState<FlowSettingsMap>({});
  
  const [originalNodes, setOriginalNodes] = useState<Node[]>([]);
  const [originalEdges, setOriginalEdges] = useState<Edge[]>([]);
  const [originalCanvasObjects, setOriginalCanvasObjects] = useState<CanvasObject[]>([]);
  const [originalViewport, setOriginalViewport] = useState({ x: 0, y: 0, zoom: 1 });
  
  const [dataLoaded, setDataLoaded] = useState(false);
  const [panelStorageSeeded, setPanelStorageSeeded] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [hasPendingUpdates, setHasPendingUpdates] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const liveUpdatesRef = useRef(liveUpdates);
  
  const createAiClient = useCallback(() => {
    const savedSettings = localStorage.getItem('ai_settings');
    let baseURL = '/api/ai';
    let defaultModel = 'claude-sonnet-4-5-20250929';

    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.provider === 'custom' && settings.customEndpoint) baseURL = settings.customEndpoint;
        if (settings.model && settings.model !== 'custom') defaultModel = settings.model;
      } catch {
        // Ignore parse errors
      }
    }

    return new OpenAICompatClient({
      baseURL,
      apiKey: '',
      defaultModel
    });
  }, []);
  const [aiClient] = useState<OpenAICompatClient>(createAiClient);

  const { data, isLoading, error, refetch } = useQuery<SharedProjectData>({
    queryKey: ['/api/view', shareId],
    enabled: !!shareId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (data?.isOwner && data?.redirect) {
      setLocation(data.redirect);
    }
  }, [data, setLocation]);

  useEffect(() => {
    if (data) {
      const loadedNodes = data.nodes || [];
      const loadedEdges = data.edges || [];
      const loadedCanvasObjects = data.canvasObjects || [];
      const loadedViewport = data.viewport || { x: 0, y: 0, zoom: 1 };
      const loadedFlowSettings = data.flowSettings || {};
      
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setCanvasObjects(loadedCanvasObjects);
      setViewport(loadedViewport);
      setFlowSettings(loadedFlowSettings);
      
      setOriginalNodes(JSON.parse(JSON.stringify(loadedNodes)));
      setOriginalEdges(JSON.parse(JSON.stringify(loadedEdges)));
      setOriginalCanvasObjects(JSON.parse(JSON.stringify(loadedCanvasObjects)));
      setOriginalViewport({ ...loadedViewport });

      // Seed (or clear) localStorage with the author's PRD/notes/details before ProjectPanel mounts.
      // We always write or remove each key so stale data from a previous share load is never shown.
      // panelStorageSeeded gates ProjectPanel rendering so child tabs read the correct data on mount.
      //
      // Documentation sources (either may be present depending on how the project was saved):
      //   • prdData      — project-level PRD (flat key, written by SavedProjectsDrawer)
      //   • workflowPRDs — per-workflow PRDs (array, written when a .kiteframe file was imported/saved)
      //   • notesData    — free-form notes string
      //   • detailsData  — project details/context string
      if (shareId) {
        try {
          if (data.prdData) {
            localStorage.setItem(`prd-project-${shareId}`, JSON.stringify(data.prdData));
          } else {
            localStorage.removeItem(`prd-project-${shareId}`);
          }
          if (data.workflowPRDs && data.workflowPRDs.length > 0) {
            for (const wPRD of data.workflowPRDs) {
              if (wPRD.workflowId) {
                saveWorkflowPRD(shareId, wPRD.workflowId, wPRD);
              }
            }
          }
          if (data.notesData) {
            localStorage.setItem(`kiteframe-notes-${shareId}`, data.notesData);
          } else {
            localStorage.removeItem(`kiteframe-notes-${shareId}`);
          }
          if (data.detailsData) {
            localStorage.setItem(`kiteframe-details-${shareId}`, data.detailsData);
          } else {
            localStorage.removeItem(`kiteframe-details-${shareId}`);
          }
        } catch (e) {
          // Ignore storage errors
        }
      }

      setPanelStorageSeeded(true);
      setDataLoaded(true);
    }
  }, [data, shareId]);

  useEffect(() => {
    liveUpdatesRef.current = liveUpdates;
  }, [liveUpdates]);

  useEffect(() => {
    if (!shareId) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log(`📡 [VIEWER WS] Connected! Subscribing to shareId: ${shareId}`);
      setWsConnected(true);
      ws.send(JSON.stringify({
        type: 'subscribe_share',
        shareId: shareId
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WsMessage;
        console.log(`📡 [VIEWER WS] Received message:`, message.type, (message as ShareUpdateMessage).shareId);
        if (message.type === 'share_revoked' && (message as ShareUpdateMessage).shareId === shareId) {
          // The author locked down or disabled this share. Re-fetch so the
          // viewer flips to the access-denied / not-found screen immediately.
          console.log('📡 [VIEWER WS] Share revoked by author — refetching');
          refetch();
          return;
        }
        if (message.type === 'share_update' && (message as ShareUpdateMessage).shareId === shareId) {
          const msg = message as ShareUpdateMessage;
          const nodeCount = msg.nodes?.length || 0;
          const edgeCount = msg.edges?.length || 0;
          
          if (liveUpdatesRef.current) {
            console.log(`📡 [VIEWER WS] Applying update - ${nodeCount} nodes, ${edgeCount} edges`);
            if (msg.nodes) setNodes(msg.nodes);
            if (msg.edges) setEdges(msg.edges);
            if (msg.canvasObjects) setCanvasObjects(msg.canvasObjects);
            if (msg.viewport) setViewport(msg.viewport);
            if (msg.flowSettings) setFlowSettings(msg.flowSettings);
          } else {
            console.log(`📡 [VIEWER WS] Live updates OFF - marking pending updates`);
            setHasPendingUpdates(true);
          }

          // Re-seed localStorage from panel data fields sent directly in the WS message.
          // No HTTP round-trip needed — viewers see changes the moment the author saves.
          if (shareId && ('prdData' in msg || 'workflowPRDs' in msg || 'notesData' in msg || 'detailsData' in msg)) {
            try {
              if (msg.prdData) {
                localStorage.setItem(`prd-project-${shareId}`, JSON.stringify(msg.prdData));
              } else if ('prdData' in msg) {
                localStorage.removeItem(`prd-project-${shareId}`);
              }
              // Only clean up stale workflow PRD keys when the server explicitly sent the field.
              if ('workflowPRDs' in msg) {
                const freshWorkflowIds = new Set<string>(
                  (msg.workflowPRDs ?? []).map((w: WorkflowPRD) => w.workflowId).filter(Boolean) as string[]
                );
                for (const existingId of listWorkflowPRDs(shareId)) {
                  if (!freshWorkflowIds.has(existingId)) {
                    deleteWorkflowPRD(shareId, existingId);
                  }
                }
                for (const wPRD of msg.workflowPRDs ?? []) {
                  if (wPRD.workflowId) saveWorkflowPRD(shareId, wPRD.workflowId, wPRD);
                }
              }
              if (msg.notesData) {
                localStorage.setItem(`kiteframe-notes-${shareId}`, msg.notesData);
              } else if ('notesData' in msg) {
                localStorage.removeItem(`kiteframe-notes-${shareId}`);
              }
              if (msg.detailsData) {
                localStorage.setItem(`kiteframe-details-${shareId}`, msg.detailsData);
              } else if ('detailsData' in msg) {
                localStorage.removeItem(`kiteframe-details-${shareId}`);
              }
              prdGenerationBus.notifyProjectDetailsUpdated(shareId);
              prdGenerationBus.notifyPRDUpdated(shareId);
              window.dispatchEvent(new CustomEvent('kiteframe:panelDataRefresh', { detail: { projectId: shareId } }));
            } catch (e) {
              console.warn(`📡 [VIEWER WS] Panel localStorage seed failed:`, e);
            }
          }
        } else if (message.type === 'share_subscribed') {
          console.log(`📡 [VIEWER WS] Successfully subscribed to shareId: ${(message as ShareSubscribedMessage).shareId}`);
        }
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };
    
    ws.onclose = () => {
      console.log(`📡 [VIEWER WS] Connection closed`);
      setWsConnected(false);
    };
    
    ws.onerror = (err) => {
      console.error(`📡 [VIEWER WS] Error:`, err);
      setWsConnected(false);
    };
    
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [shareId]);

  const noopEdgesChange = useCallback(() => {}, []);
  const noopCanvasObjectsChange = useCallback(() => {}, []);
  const noopConnect = useCallback(() => {}, []);

  const handleNodesChange = useCallback((newNodes: Node[]) => {
    if (!liveUpdates) {
      setNodes(newNodes);
    }
  }, [liveUpdates]);

  const handleReset = useCallback(() => {
    setNodes(JSON.parse(JSON.stringify(originalNodes)));
    setEdges(JSON.parse(JSON.stringify(originalEdges)));
    setCanvasObjects(JSON.parse(JSON.stringify(originalCanvasObjects)));
    setViewport({ ...originalViewport });
  }, [originalNodes, originalEdges, originalCanvasObjects, originalViewport]);

  const handleFitView = useCallback(() => {
    if (nodes.length === 0) return;
    
    const containerRect = canvasContainerRef.current?.getBoundingClientRect();
    const containerWidth = containerRect?.width || window.innerWidth;
    const containerHeight = containerRect?.height || window.innerHeight;
    
    const padding = 80;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
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
    
    const x = containerWidth / 2 - centerX * zoom;
    const y = containerHeight / 2 - centerY * zoom;
    
    setViewport({ x, y, zoom });
  }, [nodes]);

  useEffect(() => {
    if (dataLoaded && nodes.length > 0) {
      const timer = setTimeout(() => {
        handleFitView();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [dataLoaded, nodes.length, handleFitView]);

  const handleGoHome = useCallback(() => {
    setLocation('/');
  }, [setLocation]);

  const handleToggleLiveUpdates = useCallback(async () => {
    const newValue = !liveUpdates;
    liveUpdatesRef.current = newValue;
    setLiveUpdates(newValue);
    
    if (newValue) {
      console.log(`📡 [VIEWER] Enabling live updates - refetching latest data`);
      setHasPendingUpdates(false);
      await refetch();
    }
  }, [liveUpdates, refetch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement;
        const isTextEditable = 
          target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' || 
          target.contentEditable === 'true';
        
        if (!isTextEditable) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background" data-testid="loading-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading shared workflow...</p>
        </div>
      </div>
    );
  }

  if (data?.locked) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background" data-testid="locked-screen">
        <div className="flex flex-col items-center gap-4 text-center max-w-md px-6">
          <Lock className="w-12 h-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Project cannot be accessed</h2>
          <p className="text-muted-foreground">
            The author has disabled access to this project. Access can only be
            restored by the author from the original project.
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background" data-testid="error-screen">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-xl font-semibold">Workflow Not Found</h2>
          <p className="text-muted-foreground">
            This share link may have expired or the workflow no longer exists.
          </p>
          <Button onClick={handleGoHome} data-testid="button-go-home">
            Go to Editor
          </Button>
        </div>
      </div>
    );
  }

  const projectName = data.projectName || 'Shared Workflow';

  return (
    <AiProvider client={aiClient}>
      <div className="h-screen w-screen flex flex-col bg-background overflow-hidden" data-testid="view-only-viewer">
        <SharedViewHeader projectName={projectName} />
        {/* Main Content - flex row with canvas and docked panel */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Canvas Container */}
          <div 
            ref={canvasContainerRef}
            className="flex-1 relative overflow-hidden"
          >
            <KiteFrameCanvas
              nodes={nodes}
              edges={edges}
              canvasObjects={canvasObjects}
              onNodesChange={handleNodesChange}
              onEdgesChange={noopEdgesChange}
              onCanvasObjectsChange={noopCanvasObjectsChange}
              onConnect={noopConnect}
              viewport={viewport}
              onViewportChange={setViewport}
              minZoom={0.1}
              maxZoom={3}
              enablePlugins={false}
              readOnly={true}
              flowSettings={flowSettings}
              className="w-full h-full"
              data-testid="view-only-canvas"
            />
            
            {/* Status badges - positioned over canvas */}
            <div className="absolute top-4 left-4 z-50 flex items-center gap-2" data-testid="status-badges">
            <div 
              className="bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-full shadow-md inline-flex items-center gap-1.5"
              data-testid="read-only-badge"
            >
              <svg 
                className="w-3.5 h-3.5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
                />
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" 
                />
              </svg>
              Read Only
            </div>
            
            <div 
              className={`text-sm font-medium px-3 py-1.5 rounded-full shadow-md inline-flex items-center gap-2 cursor-pointer transition-colors ${
                liveUpdates 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
              }`}
              onClick={handleToggleLiveUpdates}
              data-testid="live-updates-toggle"
            >
              <Radio 
                className={`w-3.5 h-3.5 ${liveUpdates && wsConnected ? 'animate-pulse' : ''}`}
              />
              Live Updates
              {liveUpdates && (
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-white' : 'bg-yellow-300'}`} />
              )}
            </div>
            
            {!liveUpdates && hasPendingUpdates && (
              <div 
                className="bg-amber-500 text-white text-xs font-medium px-2.5 py-1 rounded-full shadow-md inline-flex items-center gap-1.5 animate-pulse cursor-pointer"
                onClick={handleToggleLiveUpdates}
                data-testid="pending-updates-badge"
              >
                <svg 
                  className="w-3 h-3" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                  />
                </svg>
                Pending updates
              </div>
            )}
            </div>

            <ViewOnlyToolbar
              onFitView={handleFitView}
              onReset={handleReset}
              onGoHome={handleGoHome}
            />

            <CommentsOverlay
              workflowId={data?.projectUuid}
              shareId={shareId}
              isAuthenticated={!!user}
              viewport={viewport}
              onViewportChange={setViewport}
              containerRef={canvasContainerRef}
            />
          </div>

          {/* Project Panel - docked right side. Only mount after localStorage is seeded
              so NotesTab/ProjectDocTab read the correct PRD/notes data on first render. */}
          {panelStorageSeeded && (
            <ProjectPanel
              nodes={nodes}
              edges={edges}
              canvasObjects={canvasObjects}
              projectId={shareId}
              projectName={projectName}
              isReadOnly={true}
              commentWorkflowId={data?.projectUuid}
              commentShareId={shareId}
            />
          )}
        </div>
      </div>
    </AiProvider>
  );
}
