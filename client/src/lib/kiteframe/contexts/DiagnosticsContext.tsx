import { createContext, useContext, useMemo, useCallback } from 'react';
import type { Node, Edge } from '../types';
import type { DiagnosticIssue } from '../utils/diagnostics/types';
import { useDiagnostics } from '../hooks/useDiagnostics';

interface DiagnosticsContextValue {
  issues: DiagnosticIssue[];
  activeIssues: DiagnosticIssue[];
  newIssues: DiagnosticIssue[];
  getIssuesForNode: (nodeId: string) => DiagnosticIssue[];
  acknowledge: (fingerprint: string) => void;
  unacknowledge: (fingerprint: string) => void;
  acknowledgeAll: () => void;
  refresh: () => void;
  isLoading: boolean;
  openPanel: () => void;
  focusedIssueFingerprint: string | null;
  setFocusedIssue: (fingerprint: string | null) => void;
}

const DiagnosticsContext = createContext<DiagnosticsContextValue | null>(null);

interface DiagnosticsProviderProps {
  nodes: Node[];
  edges: Edge[];
  projectId: string;
  workflowId?: string;
  enabled?: boolean;
  children: React.ReactNode;
  onOpenPanel?: () => void;
  focusedIssueFingerprint?: string | null;
  onFocusIssue?: (fingerprint: string | null) => void;
}

export function DiagnosticsProvider({
  nodes,
  edges,
  projectId,
  workflowId,
  enabled = true,
  children,
  onOpenPanel,
  focusedIssueFingerprint = null,
  onFocusIssue,
}: DiagnosticsProviderProps) {
  const diagnostics = useDiagnostics(nodes, edges, {
    projectId,
    workflowId,
    enabled,
  });

  const openPanel = useCallback(() => {
    onOpenPanel?.();
  }, [onOpenPanel]);

  const setFocusedIssue = useCallback((fingerprint: string | null) => {
    onFocusIssue?.(fingerprint);
  }, [onFocusIssue]);

  const value = useMemo((): DiagnosticsContextValue => ({
    ...diagnostics,
    openPanel,
    focusedIssueFingerprint,
    setFocusedIssue,
  }), [diagnostics, openPanel, focusedIssueFingerprint, setFocusedIssue]);

  return (
    <DiagnosticsContext.Provider value={value}>
      {children}
    </DiagnosticsContext.Provider>
  );
}

export function useDiagnosticsContext(): DiagnosticsContextValue | null {
  return useContext(DiagnosticsContext);
}

export function useNodeDiagnostics(nodeId: string): {
  issues: DiagnosticIssue[];
  acknowledge: (fingerprint: string) => void;
  unacknowledge: (fingerprint: string) => void;
  onCreateExperiment: (issue: DiagnosticIssue) => void;
  onViewInPanel: (issue: DiagnosticIssue) => void;
} {
  const ctx = useDiagnosticsContext();
  
  const issues = useMemo(() => {
    if (!ctx) return [];
    return ctx.getIssuesForNode(nodeId);
  }, [ctx, nodeId]);

  const acknowledge = useCallback((fingerprint: string) => {
    ctx?.acknowledge(fingerprint);
  }, [ctx]);

  const unacknowledge = useCallback((fingerprint: string) => {
    ctx?.unacknowledge(fingerprint);
  }, [ctx]);

  const onCreateExperiment = useCallback((issue: DiagnosticIssue) => {
    console.log('[DiagnosticsContext] Create experiment for issue:', issue.fingerprint);
  }, []);

  const onViewInPanel = useCallback((issue: DiagnosticIssue) => {
    ctx?.setFocusedIssue(issue.fingerprint);
    ctx?.openPanel();
  }, [ctx]);

  return { issues, acknowledge, unacknowledge, onCreateExperiment, onViewInPanel };
}
