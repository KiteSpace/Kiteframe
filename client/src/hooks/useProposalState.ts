import { useState, useCallback, useEffect } from 'react';
import type { Node, Edge } from '@/lib/kiteframe/types';
import type { ModelProvenance } from '@/ai/explainability/types';

export interface ProposalVariant {
  nodes: Node[];
  edges: Edge[];
  title: string;
  description: string;
}

export interface ProposedWorkflow {
  insightId: string;
  insightTitle: string;
  affectedNodeIds: string[];
  proposed: ProposalVariant;
  alternative: ProposalVariant;
  activeVariant: 'proposed' | 'alternative';
  generatedAt: number;
  snapshotNodes: Node[];
  snapshotEdges: Edge[];
  modelProvenance?: ModelProvenance;
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
  setActiveVariant: (variant: 'proposed' | 'alternative') => void;
  hasActiveProposal: boolean;
}

/**
 * useProposalState
 * 
 * Manages the proposal lifecycle for "Propose Solution" feature.
 * 
 * Phase 2 Constraints:
 * - Client-only state (not persisted)
 * - Only one active proposal at a time
 * - Proposal does not persist across refresh
 * - Cleared entirely on Cancel
 * - Proposal is scoped to a specific Insight
 * - Contains both proposed and alternative variants
 * - activeVariant controls which variant is shown in preview
 * - Switching variants never triggers regeneration
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

  const setActiveVariant = useCallback((variant: 'proposed' | 'alternative') => {
    setProposalState(prev => {
      if (!prev.proposal) return prev;
      return {
        ...prev,
        proposal: {
          ...prev.proposal,
          activeVariant: variant,
        },
      };
    });
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
    setActiveVariant,
    hasActiveProposal: proposalState.proposal !== null,
  };
}

/**
 * Compose preview data for ProposalPreviewContainer
 * 
 * Phase 2: Variant-aware preview composition
 * - Always includes origin node(s) from affected nodes
 * - Includes only additions from the active variant
 * - Never includes full workflow
 * - Never includes both variants simultaneously
 */
export function composePreviewData(proposal: ProposedWorkflow): { nodes: Node[]; edges: Edge[] } {
  const { affectedNodeIds, activeVariant, proposed, alternative, snapshotNodes, snapshotEdges } = proposal;
  
  const variant = activeVariant === 'proposed' ? proposed : alternative;
  
  const existingOriginNodes = snapshotNodes.filter(n => affectedNodeIds.includes(n.id));
  
  const existingRelevantEdges = snapshotEdges.filter(e =>
    affectedNodeIds.includes(e.source) || affectedNodeIds.includes(e.target)
  );
  
  const previewNodes = [...existingOriginNodes, ...variant.nodes];
  const previewEdges = [...existingRelevantEdges, ...variant.edges];
  
  return { nodes: previewNodes, edges: previewEdges };
}
