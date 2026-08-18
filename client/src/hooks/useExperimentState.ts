import { useState, useCallback, useRef } from 'react';
import type { Node, Edge } from '@/lib/kiteframe/types';
import type { ModelProvenance } from '@/ai/explainability/types';

/**
 * Experiment
 * 
 * A hypothetical modification to test assumptions, reveal risks, or explore
 * opportunities. Experiments are provocations, not solutions.
 */
export interface Experiment {
  id: string;
  insightId: string;
  affectedNodeIds: string[];
  title: string;
  description: string;
  variant: {
    nodes: Node[];
    edges: Edge[];
  };
}

/**
 * ExperimentSession
 * 
 * The complete experiment session data, including:
 * - All 4 experiments (generated together, cached)
 * - The currently active experiment
 * - Snapshot of workflow at generation time
 */
export interface ExperimentSession {
  insightId: string;
  insightTitle: string;
  affectedNodeIds: string[];
  experiments: Experiment[]; // exactly 4
  activeExperimentId: string | null;
  generatedAt: number;
  snapshotNodes: Node[];
  snapshotEdges: Edge[];
  modelProvenance?: ModelProvenance;
}

export interface ExperimentState {
  session: ExperimentSession | null;
  isGenerating: boolean;
  error: string | null;
}

export interface UseExperimentStateReturn {
  experimentState: ExperimentState;
  experimentStateRef: React.RefObject<ExperimentState>;
  setSession: (session: ExperimentSession) => void;
  clearSession: () => void;
  setGenerating: (isGenerating: boolean) => void;
  setError: (error: string | null) => void;
  setActiveExperiment: (experimentId: string | null) => void;
  hasActiveSession: boolean;
}

/**
 * useExperimentState
 * 
 * Manages the experiment session lifecycle.
 * 
 * Phase 3 Constraints:
 * - Client-only state (not persisted)
 * - Exactly 4 experiments per session
 * - Only one active experiment at a time
 * - All experiments generated together, cached for session
 * - Session does not persist across refresh
 * - Cleared entirely on Cancel
 * - Experiments are Insight-scoped
 * - Selecting an experiment never triggers regeneration
 */
export function useExperimentState(): UseExperimentStateReturn {
  const [experimentState, setExperimentState] = useState<ExperimentState>({
    session: null,
    isGenerating: false,
    error: null,
  });

  const experimentStateRef = useRef(experimentState);
  experimentStateRef.current = experimentState;

  const setSession = useCallback((session: ExperimentSession) => {
    setExperimentState({
      session,
      isGenerating: false,
      error: null,
    });
  }, []);

  const clearSession = useCallback(() => {
    setExperimentState({
      session: null,
      isGenerating: false,
      error: null,
    });
  }, []);

  const setGenerating = useCallback((isGenerating: boolean) => {
    setExperimentState(prev => ({
      ...prev,
      isGenerating,
      error: isGenerating ? null : prev.error,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setExperimentState(prev => ({
      ...prev,
      error,
      isGenerating: false,
    }));
  }, []);

  const setActiveExperiment = useCallback((experimentId: string | null) => {
    setExperimentState(prev => {
      if (!prev.session) return prev;
      return {
        ...prev,
        session: {
          ...prev.session,
          activeExperimentId: experimentId,
        },
      };
    });
  }, []);

  return {
    experimentState,
    experimentStateRef,
    setSession,
    clearSession,
    setGenerating,
    setError,
    setActiveExperiment,
    hasActiveSession: experimentState.session !== null,
  };
}

/**
 * Compose preview data for ExperimentPreviewContainer
 * 
 * Phase 3: Shows origin nodes + active experiment additions only
 * - Origin nodes from affectedNodeIds
 * - Only one experiment visible at a time
 * - Full workflow is never rendered
 */
export function composeExperimentPreviewData(
  session: ExperimentSession
): { nodes: Node[]; edges: Edge[] } | null {
  const { activeExperimentId, experiments, affectedNodeIds, snapshotNodes, snapshotEdges } = session;
  
  if (!activeExperimentId) {
    return null;
  }
  
  const activeExperiment = experiments.find(e => e.id === activeExperimentId);
  if (!activeExperiment) {
    return null;
  }
  
  // Origin nodes from the affected nodes
  const originNodes = snapshotNodes.filter(n => affectedNodeIds.includes(n.id));
  
  // Origin edges between affected nodes
  const originEdges = snapshotEdges.filter(e =>
    affectedNodeIds.includes(e.source) || affectedNodeIds.includes(e.target)
  );
  
  // Combine origin + experiment additions
  const previewNodes = [...originNodes, ...activeExperiment.variant.nodes];
  const previewEdges = [...originEdges, ...activeExperiment.variant.edges];
  
  return { nodes: previewNodes, edges: previewEdges };
}
