import { useState, useCallback, useEffect, useRef } from 'react';
import type { Node, Edge } from '../types';
import type { DiagnosticIssue } from '../utils/diagnostics/types';
import { diagnosticsEngine } from '../utils/diagnostics/DiagnosticsEngine';
import { diagnosticsStore } from '../utils/diagnostics/DiagnosticsStore';

interface UseDiagnosticsOptions {
  projectId: string;
  workflowId?: string;
  enabled?: boolean;
  debounceMs?: number;
  minEdges?: number;
}

const DEFAULT_MIN_EDGES = 3;

interface UseDiagnosticsResult {
  issues: DiagnosticIssue[];
  activeIssues: DiagnosticIssue[];
  newIssues: DiagnosticIssue[];
  resolvedIssues: DiagnosticIssue[];
  getIssuesForNode: (nodeId: string) => DiagnosticIssue[];
  acknowledge: (issueId: string) => void;
  unacknowledge: (issueId: string) => void;
  acknowledgeAll: () => void;
  refresh: () => void;
  isLoading: boolean;
}

export function useDiagnostics(
  nodes: Node[],
  edges: Edge[],
  options: UseDiagnosticsOptions
): UseDiagnosticsResult {
  const { projectId, workflowId, enabled = true, debounceMs = 300, minEdges = DEFAULT_MIN_EDGES } = options;
  
  const meetsEdgeThreshold = edges.length >= minEdges;
  
  const [issues, setIssues] = useState<DiagnosticIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNodesRef = useRef<string>('');
  const lastEdgesRef = useRef<string>('');
  
  const runDetection = useCallback(() => {
    if (!enabled || !projectId || !meetsEdgeThreshold) {
      setIssues([]);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const freshIssues = diagnosticsEngine.analyze({
        nodes,
        edges,
        projectId,
        workflowId,
      });
      
      const storedIssues = diagnosticsStore.load(projectId);
      const mergedIssues = diagnosticsStore.merge(storedIssues, freshIssues);
      
      diagnosticsStore.save(projectId, mergedIssues);
      setIssues(mergedIssues);
    } catch (e) {
      console.error('[useDiagnostics] Detection failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, [nodes, edges, projectId, workflowId, enabled, meetsEdgeThreshold]);
  
  useEffect(() => {
    if (!enabled) {
      setIssues([]);
      return;
    }
    
    const nodesKey = JSON.stringify(nodes.map(n => ({ id: n.id, type: n.type })));
    const edgesKey = JSON.stringify(edges.map(e => ({ source: e.source, target: e.target })));
    
    if (nodesKey === lastNodesRef.current && edgesKey === lastEdgesRef.current) {
      return;
    }
    
    lastNodesRef.current = nodesKey;
    lastEdgesRef.current = edgesKey;
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(runDetection, debounceMs);
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [nodes, edges, enabled, debounceMs, runDetection]);
  
  useEffect(() => {
    if (enabled && projectId && meetsEdgeThreshold) {
      const stored = diagnosticsStore.load(projectId);
      if (stored.length > 0) {
        setIssues(stored);
      }
    } else if (!meetsEdgeThreshold) {
      setIssues([]);
    }
  }, [projectId, enabled, meetsEdgeThreshold]);
  
  const acknowledge = useCallback((fingerprint: string) => {
    diagnosticsStore.acknowledge(projectId, fingerprint);
    setIssues(diagnosticsStore.load(projectId));
  }, [projectId]);
  
  const unacknowledge = useCallback((fingerprint: string) => {
    diagnosticsStore.unacknowledge(projectId, fingerprint);
    setIssues(diagnosticsStore.load(projectId));
  }, [projectId]);
  
  const acknowledgeAll = useCallback(() => {
    diagnosticsStore.acknowledgeAll(projectId);
    setIssues(diagnosticsStore.load(projectId));
  }, [projectId]);
  
  const getIssuesForNode = useCallback((nodeId: string) => {
    return issues.filter(i => i.nodeId === nodeId && i.status !== 'resolved');
  }, [issues]);
  
  const refresh = useCallback(() => {
    runDetection();
  }, [runDetection]);
  
  const activeIssues = issues.filter(i => i.status !== 'resolved');
  const newIssues = issues.filter(i => i.status === 'new');
  const resolvedIssues = issues.filter(i => i.status === 'resolved');
  
  return {
    issues,
    activeIssues,
    newIssues,
    resolvedIssues,
    getIssuesForNode,
    acknowledge,
    unacknowledge,
    acknowledgeAll,
    refresh,
    isLoading,
  };
}
