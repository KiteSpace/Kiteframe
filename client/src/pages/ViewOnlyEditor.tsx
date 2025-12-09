import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { KiteFrameCanvas, PluginProvider, kiteFrameCore } from '@/lib/kiteframe';
import { Loader2, Eye, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery<SharedProjectData>({
    queryKey: ['/api/shared-project', shareId],
    enabled: !!shareId,
  });

  useEffect(() => {
    if (data) {
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      setCanvasObjects(data.canvasObjects || []);
      if (data.viewport) {
        setViewport(data.viewport);
      }
      if (data.projectMetadata?.name) {
        setProjectName(data.projectMetadata.name);
      }
    }
  }, [data]);

  const handleNoChange = useCallback(() => {}, []);

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

        <div ref={containerRef} className="flex-1 relative">
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
          />
        </div>
      </div>
    </PluginProvider>
  );
}
