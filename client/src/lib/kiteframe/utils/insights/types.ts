export type InsightCategory = 'observation' | 'suggestion' | 'note';

export type InsightStatus = 'new' | 'viewed' | 'explored' | 'dismissed';

export type InsightSource = 'test-flight' | 'user';

export interface Insight {
  id: string;
  projectId: string;
  workflowId?: string;
  
  title: string;
  description: string;
  category: InsightCategory;
  status: InsightStatus;
  source: InsightSource;
  
  relatedNodeIds: string[];
  relatedEdgeIds: string[];
  
  createdAt: number;
  viewedAt?: number;
  exploredAt?: number;
  dismissedAt?: number;
  
  explorationContext?: {
    suggestedMode: 'whatif' | 'enhancement' | 'open_exploration';
    prefilledPrompt?: string;
    anchorNodeId?: string;
  };
}

export const CATEGORY_CONFIG: Record<InsightCategory, { label: string; priority: number }> = {
  observation: { label: 'Observation', priority: 2 },
  suggestion: { label: 'Suggestion', priority: 1 },
  note: { label: 'Note', priority: 0 },
};

export function getCategoryPriority(category: InsightCategory): number {
  return CATEGORY_CONFIG[category].priority;
}
