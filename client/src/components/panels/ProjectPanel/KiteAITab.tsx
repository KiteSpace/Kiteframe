import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import { KiteAIChatPanel, KiteAIDiscussionPanel } from '@/components/KiteAIChat';
import type { ApplyWorkflowPayload, ReplaceWorkflowPayload } from '@/components/KiteAIChat';

interface KiteAITabProps {
  projectId: string;
  nodes: Node[];
  edges: Edge[];
  canvasObjects: CanvasObject[];
  onApplyWorkflow?: (workflow: ApplyWorkflowPayload) => void;
  onReplaceWorkflow?: (workflow: ReplaceWorkflowPayload) => void;
  onPreviewWorkflow?: (workflow: { nodes: Node[]; edges: Edge[] } | null) => void;
  isReadOnly?: boolean;
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
}

export function KiteAITab({ 
  projectId, 
  nodes, 
  edges, 
  canvasObjects,
  onApplyWorkflow,
  onReplaceWorkflow,
  onPreviewWorkflow,
  isReadOnly = false,
  initialPrompt,
  onInitialPromptConsumed
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
        onReplaceWorkflow={onReplaceWorkflow}
        onPreviewWorkflow={onPreviewWorkflow}
        initialPrompt={initialPrompt}
        onInitialPromptConsumed={onInitialPromptConsumed}
      />
    </div>
  );
}
