import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import { KiteAIChatPanel } from '@/components/KiteAIChat';

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
      <div className="flex h-full w-full items-center justify-center" data-testid="tab-content-kiteai-readonly">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">View Only Mode</h3>
          <p className="text-sm text-muted-foreground">
            This is a read-only view of the project. AI chat and workflow generation are not available in shared view mode.
          </p>
        </div>
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
