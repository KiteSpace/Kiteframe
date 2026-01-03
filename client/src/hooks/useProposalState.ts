import { useState, useCallback, useEffect } from 'react';
import type { Node, Edge } from '@/lib/kiteframe/types';
import type { Insight } from '@/lib/kiteframe/utils/insights/types';

export interface ProposedWorkflow {
  insightId: string;
  insightTitle: string;
  affectedNodeIds: string[];
  proposedNodes: Node[];
  proposedEdges: Edge[];
  title: string;
  description: string;
  generatedAt: number;
  snapshotNodes: Node[];
  snapshotEdges: Edge[];
}

export interface ProposalState {
  proposal: ProposedWorkflow | null;
  isGenerating: boolean;
  error: string | null;
}

export interface UseProposalStateReturn {
  proposalState: ProposalState;
  setProposal: (proposal: ProposedWorkflow) => void;
  clearProposal: () => void;
  setGenerating: (isGenerating: boolean) => void;
  setError: (error: string | null) => void;
  hasActiveProposal: boolean;
}

/**
 * useProposalState
 * 
 * Manages the proposal lifecycle for "Propose Solution" feature.
 * 
 * Constraints (Locked):
 * - Client-only state (not persisted)
 * - Only one active proposal at a time
 * - Proposal does not persist across refresh
 * - Cleared entirely on Cancel
 * - Proposal is scoped to a specific Insight
 * - Contains only proposed additions, not full workflow replacement
 */
export function useProposalState(): UseProposalStateReturn {
  const [proposalState, setProposalState] = useState<ProposalState>({
    proposal: null,
    isGenerating: false,
    error: null,
  });

  const setProposal = useCallback((proposal: ProposedWorkflow) => {
    setProposalState({
      proposal,
      isGenerating: false,
      error: null,
    });
  }, []);

  const clearProposal = useCallback(() => {
    setProposalState({
      proposal: null,
      isGenerating: false,
      error: null,
    });
  }, []);

  const setGenerating = useCallback((isGenerating: boolean) => {
    setProposalState(prev => ({
      ...prev,
      isGenerating,
      error: isGenerating ? null : prev.error,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setProposalState(prev => ({
      ...prev,
      error,
      isGenerating: false,
    }));
  }, []);

  useEffect(() => {
    return () => {
    };
  }, []);

  return {
    proposalState,
    setProposal,
    clearProposal,
    setGenerating,
    setError,
    hasActiveProposal: proposalState.proposal !== null,
  };
}

/**
 * Compose preview data for ProposalPreviewContainer
 * 
 * Preview shows: existing origin nodes + proposed additions only
 * NOT the full workflow
 */
export function composePreviewData(proposal: ProposedWorkflow): { nodes: Node[]; edges: Edge[] } {
  const { affectedNodeIds, proposedNodes, proposedEdges, snapshotNodes, snapshotEdges } = proposal;
  
  const existingOriginNodes = snapshotNodes.filter(n => affectedNodeIds.includes(n.id));
  
  const existingRelevantEdges = snapshotEdges.filter(e =>
    affectedNodeIds.includes(e.source) || affectedNodeIds.includes(e.target)
  );
  
  const previewNodes = [...existingOriginNodes, ...proposedNodes];
  const previewEdges = [...existingRelevantEdges, ...proposedEdges];
  
  return { nodes: previewNodes, edges: previewEdges };
}
