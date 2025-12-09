import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { KiteFrameCanvas } from '../lib/kiteframe/components/KiteFrameCanvas';
import { Loader2, AlertCircle, ChevronDown, ChevronUp, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ViewOnlyToolbar } from '@/components/ViewOnlyToolbar';
import { ReadOnlyLayersWidget } from '@/components/layers/ReadOnlyLayersWidget';
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
  
  const [projectDetailsExpanded, setProjectDetailsExpanded] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

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
    if (liveUpdates && shareId) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        setWsConnected(true);
        ws.send(JSON.stringify({
          type: 'subscribe_share',
          shareId: shareId
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'share_update' && message.shareId === shareId) {
            if (message.nodes) setNodes(message.nodes);
            if (message.edges) setEdges(message.edges);
            if (message.canvasObjects) setCanvasObjects(message.canvasObjects);
            if (message.viewport) setViewport(message.viewport);
            if (message.flowSettings) setFlowSettings(message.flowSettings);
          }
        } catch (e) {
          console.error('WebSocket message parse error:', e);
        }
      };
      
      ws.onclose = () => {
        setWsConnected(false);
      };
      
      ws.onerror = () => {
        setWsConnected(false);
      };
      
      return () => {
        ws.close();
        wsRef.current = null;
      };
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setWsConnected(false);
      }
    }
  }, [liveUpdates, shareId]);

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
  const projectDescription = data.projectDescription;

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden" data-testid="view-only-viewer">
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
        
        <div className="absolute top-4 left-4 z-50 flex flex-col gap-3 max-w-sm" data-testid="overlay-container">
          <div className="flex items-center gap-2">
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
              onClick={() => setLiveUpdates(!liveUpdates)}
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
          </div>
          
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            data-testid="project-details-card"
          >
            <button
              onClick={() => setProjectDetailsExpanded(!projectDetailsExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              data-testid="button-toggle-project-details"
            >
              <span className="font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
                {projectName}
              </span>
              {projectDetailsExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
              )}
            </button>
            
            {projectDetailsExpanded && projectDescription && (
              <div className="px-4 pb-3 pt-0 border-t border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap">
                  {projectDescription}
                </p>
              </div>
            )}
          </div>
        </div>

        <ReadOnlyLayersWidget 
          nodes={nodes} 
          edges={edges} 
          canvasObjects={canvasObjects}
        />

        <ViewOnlyToolbar
          onFitView={handleFitView}
          onReset={handleReset}
          onGoHome={handleGoHome}
        />
      </div>
    </div>
  );
}
