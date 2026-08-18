import type { DiagnosticIssue, DiagnosticSeverity } from '../diagnostics/types';
import type { Insight, InsightCategory } from './types';

const SEVERITY_TO_CATEGORY: Record<DiagnosticSeverity, InsightCategory> = {
  critical: 'observation',
  risk: 'observation',
  warn: 'suggestion',
  info: 'note',
};

const MODE_MAP: Record<string, 'whatif' | 'enhancement' | 'open_exploration'> = {
  whatif: 'whatif',
  enhancement: 'enhancement',
  open_exploration: 'open_exploration',
};

export function convertDiagnosticToInsight(issue: DiagnosticIssue): Insight {
  const relatedNodeIds: string[] = [];
  const relatedEdgeIds: string[] = [];
  
  if (issue.nodeId) {
    relatedNodeIds.push(issue.nodeId);
  }
  if (issue.edgeId) {
    relatedEdgeIds.push(issue.edgeId);
  }
  
  let explorationContext: Insight['explorationContext'];
  if (issue.recommendedAction?.kind === 'create-experiment' && issue.recommendedAction.experimentMode) {
    explorationContext = {
      suggestedMode: MODE_MAP[issue.recommendedAction.experimentMode] || 'open_exploration',
      anchorNodeId: issue.nodeId,
      prefilledPrompt: generatePrefilledPrompt(issue),
    };
  }
  
  return {
    id: issue.fingerprint,
    projectId: issue.projectId,
    workflowId: issue.workflowId,
    title: issue.title,
    description: issue.description,
    category: SEVERITY_TO_CATEGORY[issue.severity],
    status: 'new',
    source: 'test-flight',
    relatedNodeIds,
    relatedEdgeIds,
    createdAt: issue.createdAt,
    explorationContext,
  };
}

function generatePrefilledPrompt(issue: DiagnosticIssue): string {
  switch (issue.type) {
    case 'missing-end-state':
      return 'What happens after this step completes? Explore possible outcomes and endings.';
    case 'dead-end-node':
      return 'This step leads nowhere. What should happen next?';
    case 'disconnected-subgraph':
      return 'This group of steps is disconnected from the main flow. How should it connect?';
    case 'orphan-decision':
      return 'This decision point has incomplete paths. What are the missing outcomes?';
    case 'loop-without-exit':
      return 'This loop has no exit condition. When should it end?';
    default:
      return 'Explore alternatives for this part of the workflow.';
  }
}

export function convertDiagnosticsToInsights(issues: DiagnosticIssue[]): Insight[] {
  return issues.map(convertDiagnosticToInsight);
}
