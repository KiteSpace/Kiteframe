import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Check, XCircle, Loader2 } from 'lucide-react';
import { QuickActions, DiscussionQuickActions } from '@/components/QuickActions';
import { EdgeCaseSelector, type EdgeCase } from '@/components/EdgeCaseSelector';
import { isWorkflowValidForCreation, type QuickActionType } from '@/utils/workflowDiagnostics';
import type { Node, Edge } from '@/lib/kiteframe/types';

// Workflow generation state machine
export type WorkflowGenState = 
  | 'IDLE'
  | 'BASELINE_GENERATED'
  | 'DISCUSSING_EDGE_CASES'
  | 'EXPANDED';

export interface WorkflowDraft {
  nodes: Node[];
  edges: Edge[];
  originPrompt: string;
  status: 'baseline' | 'expanded';
}

interface WorkflowDraftActionsProps {
  draft: WorkflowDraft;
  genState: WorkflowGenState;
  pendingQuickActions: QuickActionType[];
  discussedEdgeCases: EdgeCase[];
  showEdgeCaseSelector: boolean;
  showPreview: boolean;
  isLoading: boolean;
  onPreview: () => void;
  onAccept: () => void;
  onReject: () => void;
  onQuickAction: (action: QuickActionType) => void;
  onToggleEdgeCaseSelector: (show: boolean) => void;
  onEdgeCaseSelection: (selectedIds: string[]) => void;
}

export function WorkflowDraftActions({
  draft,
  genState,
  pendingQuickActions,
  discussedEdgeCases,
  showEdgeCaseSelector,
  showPreview,
  isLoading,
  onPreview,
  onAccept,
  onReject,
  onQuickAction,
  onToggleEdgeCaseSelector,
  onEdgeCaseSelection
}: WorkflowDraftActionsProps) {
  const isValid = isWorkflowValidForCreation({
    nodes: draft.nodes.map(n => ({
      id: n.id,
      type: n.type || 'process',
      label: (n.data as any)?.label
    })),
    edges: draft.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: (e.data as any)?.label
    }))
  });

  return (
    <div className="p-3 border-t border-border bg-muted/30 space-y-3">
      {/* Draft status badge */}
      <div className="flex items-center justify-between">
        <Badge 
          variant={draft.status === 'expanded' ? 'default' : 'secondary'} 
          className="text-xs"
        >
          {draft.status === 'expanded' ? '✓ Expanded' : 'Draft'}: {draft.nodes.length} nodes, {draft.edges.length} edges
        </Badge>
        {showPreview && (
          <span className="text-xs text-muted-foreground">Preview active</span>
        )}
      </div>
      
      {/* Preview/Create/Reject buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onPreview}
          className="flex-1 h-8 text-xs"
          data-testid="button-preview-workflow-draft"
          disabled={isLoading}
        >
          <Eye className="w-3 h-3 mr-1" />
          {showPreview ? 'Hide Preview' : 'Preview'}
        </Button>
        <Button
          size="sm"
          variant="default"
          onClick={onAccept}
          className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700"
          data-testid="button-create-workflow-draft"
          disabled={!isValid || isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Check className="w-3 h-3 mr-1" />
          )}
          Create Workflow
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onReject}
          className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
          data-testid="button-reject-workflow-draft"
          disabled={isLoading}
        >
          <XCircle className="w-3 h-3" />
        </Button>
      </div>
      
      {/* Quick Actions for workflow expansion */}
      {genState === 'BASELINE_GENERATED' && pendingQuickActions.length > 0 && (
        <QuickActions
          actions={pendingQuickActions}
          onAction={onQuickAction}
          disabled={isLoading}
        />
      )}
      
      {/* Discussion mode quick actions */}
      {genState === 'DISCUSSING_EDGE_CASES' && (
        <DiscussionQuickActions
          onStickWithHappyPath={() => onQuickAction('HAPPY_PATH_ONLY')}
          onMapAllEdgeCases={() => onQuickAction('INCLUDE_EDGE_CASES')}
          onSelectEdgeCases={() => onToggleEdgeCaseSelector(true)}
          disabled={isLoading}
        />
      )}
      
      {/* Edge case selector */}
      {showEdgeCaseSelector && discussedEdgeCases.length > 0 && (
        <EdgeCaseSelector
          edgeCases={discussedEdgeCases}
          onSubmit={onEdgeCaseSelection}
          onCancel={() => onToggleEdgeCaseSelector(false)}
          disabled={isLoading}
        />
      )}
    </div>
  );
}
