import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { KiteFrameCanvas } from '../lib/kiteframe/components/KiteFrameCanvas';
import { Loader2, AlertCircle, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ViewOnlyToolbar } from '@/components/ViewOnlyToolbar';
import { ProjectPanel } from '@/components/panels/ProjectPanel/ProjectPanel';
import { AiProvider } from '../ai/AiProvider';
import { OpenAICompatClient } from '../ai/OpenAICompatClient';
import type { Node, Edge, CanvasObject } from '../lib/kiteframe/types';
import type { FlowSettingsMap } from '../lib/kiteframe/utils/FlowDetection';
import '../lib/kiteframe/styles/kiteframe.css';

interface SharedProjectData {
  shareUuid: string;
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
}

export default function ViewOnlyViewer() {
  const { shareId } = useParams<{ shareId: string }>();
  const [, setLocation] = useLocation();
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
  const [liveUpdates, setLiveUpdates] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [hasPendingUpdates, setHasPendingUpdates] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const liveUpdatesRef = useRef(liveUpdates);
  
  const createAiClient = useCallback(() => {
    const savedSettings = localStorage.getItem('ai_settings');
    let baseURL = 'https://api.openai.com/v1';
    let defaultModel = 'gpt-4o';

    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.baseURL) baseURL = settings.baseURL;
        if (settings.model) defaultModel = settings.model;
      } catch {
        // Ignore parse errors
      }
    }

    return new OpenAICompatClient({
      baseURL,
      apiKey: localStorage.getItem('openai_api_key') || '',
      defaultModel
    });
  }, []);
  const [aiClient] = useState<OpenAICompatClient>(createAiClient);

  const { data, isLoading, error, refetch } = useQuery<SharedProjectData>({
    queryKey: ['/api/view', shareId],
    enabled: !!shareId,
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
      setDataLoaded(true);
    }
  }, [data]);

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
        const message = JSON.parse(event.data);
        console.log(`📡 [VIEWER WS] Received message:`, message.type, message.shareId);
        if (message.type === 'share_update' && message.shareId === shareId) {
          const nodeCount = message.nodes?.length || 0;
          const edgeCount = message.edges?.length || 0;
          
          if (liveUpdatesRef.current) {
            console.log(`📡 [VIEWER WS] Applying update - ${nodeCount} nodes, ${edgeCount} edges`);
            if (message.nodes) setNodes(message.nodes);
            if (message.edges) setEdges(message.edges);
            if (message.canvasObjects) setCanvasObjects(message.canvasObjects);
            if (message.viewport) setViewport(message.viewport);
            if (message.flowSettings) setFlowSettings(message.flowSettings);
          } else {
            console.log(`📡 [VIEWER WS] Live updates OFF - marking pending updates`);
            setHasPendingUpdates(true);
          }
        } else if (message.type === 'share_subscribed') {
          console.log(`📡 [VIEWER WS] Successfully subscribed to shareId: ${message.shareId}`);
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
        {/* Main Content - flex row with canvas and docked panel */}
        <div className="flex-1 flex overflow-hidden">
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
          </div>

          {/* Project Panel - docked right side */}
          <ProjectPanel
            nodes={nodes}
            edges={edges}
            canvasObjects={canvasObjects}
            projectId={shareId}
            projectName={projectName}
            isReadOnly={true}
          />
        </div>
      </div>
    </AiProvider>
  );
}
