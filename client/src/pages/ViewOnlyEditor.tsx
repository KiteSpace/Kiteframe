import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { KiteFrameCanvas, PluginProvider, kiteFrameCore } from '@/lib/kiteframe';
import { Loader2, Eye, AlertCircle, Maximize2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Node, Edge, CanvasObject } from '../lib/kiteframe/types';
import '../lib/kiteframe/styles/kiteframe.css';

interface SharedProjectData {
  id: string;
  shareId: string;
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  viewport?: { x: number; y: number; zoom: number };
  projectMetadata?: { name?: string; description?: string };
}

export default function ViewOnlyEditor() {
  const { shareId } = useParams<{ shareId: string }>();
  const [, setLocation] = useLocation();
  
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [canvasObjects, setCanvasObjects] = useState<CanvasObject[]>([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [projectName, setProjectName] = useState('Shared Workflow');
  const [projectDescription, setProjectDescription] = useState('');
  const [originalNodes, setOriginalNodes] = useState<Node[]>([]);
  const [originalViewport, setOriginalViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<any>(null);

  const { data, isLoading, error } = useQuery<SharedProjectData>({
    queryKey: ['/api/shared-project', shareId],
    enabled: !!shareId,
  });

  useEffect(() => {
    if (data) {
      const loadedNodes = data.nodes || [];
      const loadedViewport = data.viewport || { x: 0, y: 0, zoom: 1 };
      
      setNodes(loadedNodes);
      setOriginalNodes(loadedNodes);
      setEdges(data.edges || []);
      setCanvasObjects(data.canvasObjects || []);
      setViewport(loadedViewport);
      setOriginalViewport(loadedViewport);
      
      if (data.projectMetadata?.name) {
        setProjectName(data.projectMetadata.name);
      }
      if (data.projectMetadata?.description) {
        setProjectDescription(data.projectMetadata.description);
      }
    }
  }, [data]);

  const handleNoChange = useCallback(() => {}, []);

  const handleFitToView = useCallback(() => {
    if (nodes.length === 0) return;
    
    // Calculate bounds of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
      const x = node.position?.x ?? 0;
      const y = node.position?.y ?? 0;
      const width = node.width ?? 200;
      const height = node.height ?? 100;
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });
    
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return;
    
    const padding = 50;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    
    const scale = Math.min(
      containerRef.current?.clientWidth ?? 800,
      containerRef.current?.clientHeight ?? 600
    );
    
    const zoom = Math.min(scale / Math.max(width, height), 2);
    const x = -(minX - padding) * zoom + (containerRef.current?.clientWidth ?? 800) / 2 - (width / 2) * zoom;
    const y = -(minY - padding) * zoom + (containerRef.current?.clientHeight ?? 600) / 2 - (height / 2) * zoom;
    
    setViewport({ x, y, zoom });
  }, [nodes]);

  const handleResetLayout = useCallback(() => {
    setNodes(originalNodes);
    setViewport(originalViewport);
  }, [originalNodes, originalViewport]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading shared workflow...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <h2 className="text-xl font-semibold">Workflow Not Found</h2>
          <p className="text-muted-foreground">
            This share link may have expired or the workflow no longer exists.
          </p>
          <Button onClick={() => setLocation('/')} data-testid="button-go-home">
            Go to Editor
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PluginProvider core={kiteFrameCore}>
      <div className="h-screen w-screen flex flex-col overflow-hidden">
        <div className="bg-blue-500/90 text-white px-4 py-2 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">
              View Only: {projectName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-80">
              This is a read-only view
            </span>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={() => setLocation('/')}
              data-testid="button-create-own"
            >
              Create Your Own
            </Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden gap-2 p-2 bg-background">
          <div ref={containerRef} className="flex-1 relative border rounded-lg overflow-hidden">
            <KiteFrameCanvas
              nodes={nodes}
              edges={edges}
              canvasObjects={canvasObjects}
              viewport={viewport}
              onViewportChange={setViewport}
              onNodesChange={handleNoChange}
              onEdgesChange={handleNoChange}
              onCanvasObjectsChange={handleNoChange}
              enablePlugins={false}
              disablePan={false}
              showMiniMap={false}
              readOnly={true}
            />
          </div>

          <div className="w-64 flex flex-col gap-2">
            <Card className="flex-shrink-0">
              <div className="p-4">
                <button
                  onClick={() => setIsDetailsCollapsed(!isDetailsCollapsed)}
                  className="w-full flex items-center justify-between text-sm font-semibold mb-2"
                  data-testid="button-toggle-details"
                >
                  <span>Project Details</span>
                  {isDetailsCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {!isDetailsCollapsed && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Name</p>
                      <p className="text-sm break-words">{projectName}</p>
                    </div>
                    {projectDescription && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Description</p>
                        <p className="text-sm break-words">{projectDescription}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            <div className="flex flex-col gap-2">
              <Button
                onClick={handleFitToView}
                size="sm"
                variant="outline"
                className="w-full justify-center"
                data-testid="button-fit-to-view"
              >
                <Maximize2 className="w-4 h-4 mr-2" />
                Fit to View
              </Button>
              <Button
                onClick={handleResetLayout}
                size="sm"
                variant="outline"
                className="w-full justify-center"
                data-testid="button-reset-layout"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Layout
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PluginProvider>
  );
}
