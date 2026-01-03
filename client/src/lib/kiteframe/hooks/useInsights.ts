import { useState, useCallback, useMemo, useRef } from 'react';
import type { Node, Edge } from '../types';
import type { Insight } from '../utils/insights/types';
import { diagnosticsEngine } from '../utils/diagnostics/DiagnosticsEngine';
import { convertDiagnosticsToInsights } from '../utils/insights/insightConverter';
import { apiRequest } from '@/lib/queryClient';

interface UseInsightsOptions {
  projectId: string;
  workflowId?: string;
  minEdges?: number;
}

async function persistInsightAction(
  insight: Insight,
  projectId: string,
  workflowId?: string
): Promise<void> {
  try {
    await apiRequest('POST', '/api/insights/history', {
      originalInsightId: insight.id,
      projectId,
      workflowId,
      title: insight.title,
      description: insight.description,
      category: insight.category,
      status: insight.status,
      relatedNodeIds: insight.relatedNodeIds,
      relatedEdgeIds: insight.relatedEdgeIds,
      explorationContext: insight.explorationContext,
      actedAt: new Date().toISOString(),
      viewedAt: insight.viewedAt ? new Date(insight.viewedAt).toISOString() : undefined,
      exploredAt: insight.exploredAt ? new Date(insight.exploredAt).toISOString() : undefined,
      dismissedAt: insight.dismissedAt ? new Date(insight.dismissedAt).toISOString() : undefined,
      deferredAt: insight.deferredAt ? new Date(insight.deferredAt).toISOString() : undefined,
      promotedAt: insight.promotedAt ? new Date(insight.promotedAt).toISOString() : undefined,
      resolvedAt: insight.resolvedAt ? new Date(insight.resolvedAt).toISOString() : undefined,
    });
  } catch (error) {
    console.error('[useInsights] Failed to persist insight action:', error);
  }
}

const DEFAULT_MIN_EDGES = 2;

interface WorkflowInsightState {
  insights: Insight[];
  lastRunAt: number | null;
}

interface InsightsStore {
  [key: string]: WorkflowInsightState;
}

interface UseInsightsResult {
  insights: Insight[];
  newInsights: Insight[];
  viewedInsights: Insight[];
  promotedInsights: Insight[];
  resolvedInsights: Insight[];
  runTestFlight: () => void;
  markViewed: (insightId: string) => void;
  markExplored: (insightId: string) => void;
  markResolved: (insightId: string) => void;
  defer: (insightId: string) => void;
  promote: (insightId: string) => void;
  dismiss: (insightId: string) => void;
  dismissAll: () => void;
  isRunning: boolean;
  lastRunAt: number | null;
  getPromotedInsights: () => Insight[];
}

const getWorkflowKey = (projectId: string, workflowId?: string): string => {
  return workflowId ? `${projectId}:${workflowId}` : projectId;
};

export function useInsights(
  nodes: Node[],
  edges: Edge[],
  options: UseInsightsOptions
): UseInsightsResult {
  const { projectId, workflowId, minEdges = DEFAULT_MIN_EDGES } = options;
  
  const insightsStoreRef = useRef<InsightsStore>({});
  const [, forceUpdate] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  
  const workflowKey = getWorkflowKey(projectId, workflowId);
  
  const getCurrentState = useCallback((): WorkflowInsightState => {
    return insightsStoreRef.current[workflowKey] || { insights: [], lastRunAt: null };
  }, [workflowKey]);
  
  const setCurrentInsights = useCallback((updater: (prev: Insight[]) => Insight[]) => {
    const currentState = insightsStoreRef.current[workflowKey] || { insights: [], lastRunAt: null };
    const newInsights = updater(currentState.insights);
    insightsStoreRef.current[workflowKey] = {
      ...currentState,
      insights: newInsights,
    };
    forceUpdate({});
  }, [workflowKey]);
  
  const meetsEdgeThreshold = edges.length >= minEdges;
  
  const runTestFlight = useCallback(() => {
    if (!projectId) {
      console.warn('[useInsights] Cannot run Test Flight: projectId is missing');
      return;
    }
    if (!meetsEdgeThreshold) {
      console.warn('[useInsights] Cannot run Test Flight: insufficient edges', { edgeCount: edges.length, required: minEdges });
      return;
    }
    
    setIsRunning(true);
    
    try {
      const diagnosticIssues = diagnosticsEngine.analyze({
        nodes,
        edges,
        projectId,
        workflowId,
      });
      
      const newInsights = convertDiagnosticsToInsights(diagnosticIssues);
      
      insightsStoreRef.current[workflowKey] = {
        insights: newInsights,
        lastRunAt: Date.now(),
      };
      forceUpdate({});
    } catch (e) {
      console.error('[useInsights] Test flight failed:', e);
    } finally {
      setIsRunning(false);
    }
  }, [nodes, edges, projectId, workflowId, workflowKey, meetsEdgeThreshold, minEdges]);
  
  const markViewed = useCallback((insightId: string) => {
    setCurrentInsights(prev => {
      const updated = prev.map(insight => 
        insight.id === insightId 
          ? { ...insight, status: 'viewed' as const, viewedAt: Date.now() }
          : insight
      );
      const viewedInsight = updated.find(i => i.id === insightId);
      if (viewedInsight) {
        persistInsightAction(viewedInsight, projectId, workflowId);
      }
      return updated;
    });
  }, [projectId, workflowId, setCurrentInsights]);
  
  const markExplored = useCallback((insightId: string) => {
    setCurrentInsights(prev => {
      const updated = prev.map(insight =>
        insight.id === insightId
          ? { ...insight, status: 'explored' as const, exploredAt: Date.now() }
          : insight
      );
      const exploredInsight = updated.find(i => i.id === insightId);
      if (exploredInsight) {
        persistInsightAction(exploredInsight, projectId, workflowId);
      }
      return updated;
    });
  }, [projectId, workflowId, setCurrentInsights]);
  
  const dismiss = useCallback((insightId: string) => {
    setCurrentInsights(prev => {
      const updated = prev.map(insight =>
        insight.id === insightId
          ? { ...insight, status: 'dismissed' as const, dismissedAt: Date.now() }
          : insight
      );
      const dismissedInsight = updated.find(i => i.id === insightId);
      if (dismissedInsight) {
        persistInsightAction(dismissedInsight, projectId, workflowId);
      }
      return updated;
    });
  }, [projectId, workflowId, setCurrentInsights]);
  
  const dismissAll = useCallback(() => {
    const now = Date.now();
    setCurrentInsights(prev => {
      const updated = prev.map(insight => ({
        ...insight,
        status: 'dismissed' as const,
        dismissedAt: now,
      }));
      updated.forEach(insight => {
        persistInsightAction(insight, projectId, workflowId);
      });
      return updated;
    });
  }, [projectId, workflowId, setCurrentInsights]);
  
  const defer = useCallback((insightId: string) => {
    setCurrentInsights(prev => {
      const updated = prev.map(insight =>
        insight.id === insightId
          ? { ...insight, status: 'deferred' as const, deferredAt: Date.now() }
          : insight
      );
      const deferredInsight = updated.find(i => i.id === insightId);
      if (deferredInsight) {
        persistInsightAction(deferredInsight, projectId, workflowId);
      }
      return updated;
    });
  }, [projectId, workflowId, setCurrentInsights]);
  
  const promote = useCallback((insightId: string) => {
    setCurrentInsights(prev => {
      const updated = prev.map(insight =>
        insight.id === insightId
          ? { ...insight, status: 'promoted' as const, promotedAt: Date.now() }
          : insight
      );
      const promotedInsight = updated.find(i => i.id === insightId);
      if (promotedInsight) {
        persistInsightAction(promotedInsight, projectId, workflowId);
      }
      return updated;
    });
  }, [projectId, workflowId, setCurrentInsights]);
  
  const markResolved = useCallback((insightId: string) => {
    setCurrentInsights(prev => {
      const updated = prev.map(insight =>
        insight.id === insightId
          ? { ...insight, status: 'resolved' as const, resolvedAt: Date.now() }
          : insight
      );
      const resolvedInsight = updated.find(i => i.id === insightId);
      if (resolvedInsight) {
        persistInsightAction(resolvedInsight, projectId, workflowId);
      }
      return updated;
    });
  }, [projectId, workflowId, setCurrentInsights]);
  
  const currentState = getCurrentState();
  const insights = currentState.insights;
  const lastRunAt = currentState.lastRunAt;
  
  const getPromotedInsights = useCallback(() => {
    return insights.filter(i => i.status === 'promoted');
  }, [insights]);
  
  const newInsights = useMemo(() => insights.filter(i => i.status === 'new'), [insights]);
  const viewedInsights = useMemo(() => insights.filter(i => i.status === 'viewed'), [insights]);
  const promotedInsights = useMemo(() => insights.filter(i => i.status === 'promoted'), [insights]);
  const resolvedInsights = useMemo(() => insights.filter(i => i.status === 'resolved'), [insights]);
  
  return {
    insights,
    newInsights,
    viewedInsights,
    promotedInsights,
    resolvedInsights,
    runTestFlight,
    markViewed,
    markExplored,
    markResolved,
    defer,
    promote,
    dismiss,
    dismissAll,
    isRunning,
    lastRunAt,
    getPromotedInsights,
  };
}
