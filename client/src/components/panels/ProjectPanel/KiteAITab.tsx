import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import { KiteAIChatPanel, KiteAIDiscussionPanel } from '@/components/KiteAIChat';

interface KiteAITabProps {
  projectId: string;
  nodes: Node[];
  edges: Edge[];
  canvasObjects: CanvasObject[];
  onApplyWorkflow?: (workflow: { nodes: Node[]; edges: Edge[]; canvasObjects?: CanvasObject[] }) => void;
  onPreviewWorkflow?: (workflow: { nodes: Node[]; edges: Edge[] } | null) => void;
  isReadOnly?: boolean;
}

export function KiteAITab({ 
  projectId, 
  nodes, 
  edges, 
  canvasObjects,
  onApplyWorkflow,
  onPreviewWorkflow,
  isReadOnly = false
}: KiteAITabProps) {
  if (isReadOnly) {
    return (
      <div className="flex h-full w-full" data-testid="tab-content-kiteai-readonly">
        <KiteAIDiscussionPanel
          projectId={projectId}
          nodes={nodes}
          edges={edges}
          canvasObjects={canvasObjects}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full" data-testid="tab-content-kiteai">
      <KiteAIChatPanel
        projectId={projectId}
        nodes={nodes}
        edges={edges}
        canvasObjects={canvasObjects}
        onApplyWorkflow={onApplyWorkflow}
        onPreviewWorkflow={onPreviewWorkflow}
      />
    </div>
  );
}
