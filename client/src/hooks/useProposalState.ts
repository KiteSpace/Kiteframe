import { useState, useCallback, useEffect } from 'react';
import type { Node, Edge } from '@/lib/kiteframe/types';

export interface ProposedWorkflow {
  nodes: Node[];
  edges: Edge[];
  title: string;
  description: string;
  generatedAt: number;
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

  // Cleanup on unmount (defensive)
  useEffect(() => {
    return () => {
      // State is automatically cleared when component unmounts
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
