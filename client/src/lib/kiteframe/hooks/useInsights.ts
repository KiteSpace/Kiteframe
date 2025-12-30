import { useState, useCallback } from 'react';
import type { Node, Edge } from '../types';
import type { Insight } from '../utils/insights/types';
import { diagnosticsEngine } from '../utils/diagnostics/DiagnosticsEngine';
import { convertDiagnosticsToInsights } from '../utils/insights/insightConverter';

interface UseInsightsOptions {
  projectId: string;
  workflowId?: string;
  minEdges?: number;
}

const DEFAULT_MIN_EDGES = 3;

interface UseInsightsResult {
  insights: Insight[];
  newInsights: Insight[];
  viewedInsights: Insight[];
  promotedInsights: Insight[];
  runTestFlight: () => void;
  markViewed: (insightId: string) => void;
  markExplored: (insightId: string) => void;
  defer: (insightId: string) => void;
  promote: (insightId: string) => void;
  dismiss: (insightId: string) => void;
  dismissAll: () => void;
  isRunning: boolean;
  lastRunAt: number | null;
  getPromotedInsights: () => Insight[];
}

export function useInsights(
  nodes: Node[],
  edges: Edge[],
  options: UseInsightsOptions
): UseInsightsResult {
  const { projectId, workflowId, minEdges = DEFAULT_MIN_EDGES } = options;
  
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  
  const meetsEdgeThreshold = edges.length >= minEdges;
  
  const runTestFlight = useCallback(() => {
    if (!projectId || !meetsEdgeThreshold) {
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
      
      setInsights(newInsights);
      setLastRunAt(Date.now());
    } catch (e) {
      console.error('[useInsights] Test flight failed:', e);
    } finally {
      setIsRunning(false);
    }
  }, [nodes, edges, projectId, workflowId, meetsEdgeThreshold]);
  
  const markViewed = useCallback((insightId: string) => {
    setInsights(prev => prev.map(insight => 
      insight.id === insightId 
        ? { ...insight, status: 'viewed' as const, viewedAt: Date.now() }
        : insight
    ));
  }, []);
  
  const markExplored = useCallback((insightId: string) => {
    setInsights(prev => prev.map(insight =>
      insight.id === insightId
        ? { ...insight, status: 'explored' as const, exploredAt: Date.now() }
        : insight
    ));
  }, []);
  
  const dismiss = useCallback((insightId: string) => {
    setInsights(prev => prev.map(insight =>
      insight.id === insightId
        ? { ...insight, status: 'dismissed' as const, dismissedAt: Date.now() }
        : insight
    ));
  }, []);
  
  const dismissAll = useCallback(() => {
    const now = Date.now();
    setInsights(prev => prev.map(insight => ({
      ...insight,
      status: 'dismissed' as const,
      dismissedAt: now,
    })));
  }, []);
  
  const defer = useCallback((insightId: string) => {
    setInsights(prev => prev.map(insight =>
      insight.id === insightId
        ? { ...insight, status: 'deferred' as const, deferredAt: Date.now() }
        : insight
    ));
  }, []);
  
  const promote = useCallback((insightId: string) => {
    setInsights(prev => prev.map(insight =>
      insight.id === insightId
        ? { ...insight, status: 'promoted' as const, promotedAt: Date.now() }
        : insight
    ));
  }, []);
  
  const getPromotedInsights = useCallback(() => {
    return insights.filter(i => i.status === 'promoted');
  }, [insights]);
  
  const newInsights = insights.filter(i => i.status === 'new');
  const viewedInsights = insights.filter(i => i.status === 'viewed');
  const promotedInsights = insights.filter(i => i.status === 'promoted');
  
  return {
    insights,
    newInsights,
    viewedInsights,
    promotedInsights,
    runTestFlight,
    markViewed,
    markExplored,
    defer,
    promote,
    dismiss,
    dismissAll,
    isRunning,
    lastRunAt,
    getPromotedInsights,
  };
}
