import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { WorkflowEditorContent } from './workflow-editor';
import { PluginProvider, kiteFrameCore } from '@/lib/kiteframe';
import { AiProvider } from '../ai/AiProvider';
import { OpenAICompatClient } from '../ai/OpenAICompatClient';
import { Loader2, AlertCircle } from 'lucide-react';
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
  
  const [originalNodes, setOriginalNodes] = useState<Node[]>([]);
  const [originalEdges, setOriginalEdges] = useState<Edge[]>([]);
  const [originalCanvasObjects, setOriginalCanvasObjects] = useState<CanvasObject[]>([]);
  const [originalViewport, setOriginalViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [resetKey, setResetKey] = useState(0);

  const { data, isLoading, error } = useQuery<SharedProjectData>({
    queryKey: ['/api/shared-project', shareId],
    enabled: !!shareId,
  });

  useEffect(() => {
    if (data) {
      setOriginalNodes(data.nodes || []);
      setOriginalEdges(data.edges || []);
      setOriginalCanvasObjects(data.canvasObjects || []);
      setOriginalViewport(data.viewport || { x: 0, y: 0, zoom: 1 });
    }
  }, [data]);

  const handleReset = useCallback(() => {
    setResetKey(prev => prev + 1);
  }, []);

  const createAiClient = useCallback(() => {
    return new OpenAICompatClient({
      baseURL: 'https://api.openai.com/v1',
      apiKey: '',
      defaultModel: 'gpt-4o'
    });
  }, []);

  const [aiClient] = useState<OpenAICompatClient>(createAiClient);

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
    <AiProvider client={aiClient}>
      <PluginProvider core={kiteFrameCore}>
        <WorkflowEditorContent
          key={resetKey}
          mode="view"
          initialNodes={originalNodes}
          initialEdges={originalEdges}
          initialCanvasObjects={originalCanvasObjects}
          initialViewport={originalViewport}
          initialProjectName={data.projectMetadata?.name || 'Shared Workflow'}
          initialProjectDescription={data.projectMetadata?.description}
          onReset={handleReset}
        />
      </PluginProvider>
    </AiProvider>
  );
}
