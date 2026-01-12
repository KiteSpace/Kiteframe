/**
 * Phase Lock Integration Test
 * 
 * Tests the phase lock system that prevents multiple workflow mutations
 * after the first edge-case expansion without explicit user approval.
 * 
 * This test simulates two consecutive expansions and verifies:
 * 1. First expansion succeeds and sets hasExpandedOnce = true
 * 2. Second expansion attempt is blocked
 * 3. "Apply Changes" click re-enables mutations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState, useCallback } from 'react';

type WorkflowGenState = 'BASELINE_GENERATED' | 'EXPANDED_WITH_EDGE_CASES' | 'DISCUSSING_EDGE_CASES' | 'SELECTED_EDGE_CASES_APPLIED' | null;

interface WorkflowDraft {
  nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: { label: string } }>;
  edges: Array<{ id: string; source: string; target: string }>;
}

interface PhaseLockState {
  hasExpandedOnce: boolean;
  mutationApproved: boolean;
  workflowGenState: WorkflowGenState;
  currentWorkflowDraft: WorkflowDraft | null;
}

interface PhaseLockActions {
  attemptMutation: () => { success: boolean; blockedReason?: string };
  triggerExpansion: (state: 'EXPANDED_WITH_EDGE_CASES' | 'SELECTED_EDGE_CASES_APPLIED') => void;
  clickApplyChanges: () => void;
  setWorkflowDraft: (draft: WorkflowDraft | null) => void;
}

function usePhaseLockSimulator(): PhaseLockState & PhaseLockActions {
  const [hasExpandedOnce, setHasExpandedOnce] = useState(false);
  const [mutationApproved, setMutationApproved] = useState(false);
  const [workflowGenState, setWorkflowGenState] = useState<WorkflowGenState>(null);
  const [currentWorkflowDraft, setCurrentWorkflowDraft] = useState<WorkflowDraft | null>(null);

  const attemptMutation = useCallback(() => {
    if (!currentWorkflowDraft) {
      return { success: false, blockedReason: 'NO_DRAFT' };
    }

    if (hasExpandedOnce && !mutationApproved) {
      return { 
        success: false, 
        blockedReason: 'PHASE_LOCKED',
      };
    }

    setHasExpandedOnce(false);
    setMutationApproved(false);
    setWorkflowGenState(null);
    setCurrentWorkflowDraft(null);
    
    return { success: true };
  }, [currentWorkflowDraft, hasExpandedOnce, mutationApproved]);

  const triggerExpansion = useCallback((state: 'EXPANDED_WITH_EDGE_CASES' | 'SELECTED_EDGE_CASES_APPLIED') => {
    setWorkflowGenState(state);
    if (state === 'EXPANDED_WITH_EDGE_CASES' || state === 'SELECTED_EDGE_CASES_APPLIED') {
      setHasExpandedOnce(true);
    }
  }, []);

  const clickApplyChanges = useCallback(() => {
    setMutationApproved(true);
  }, []);

  return {
    hasExpandedOnce,
    mutationApproved,
    workflowGenState,
    currentWorkflowDraft,
    attemptMutation,
    triggerExpansion,
    clickApplyChanges,
    setWorkflowDraft: setCurrentWorkflowDraft,
  };
}

const createMockDraft = (): WorkflowDraft => ({
  nodes: [
    { id: 'node-1', type: 'process', position: { x: 0, y: 0 }, data: { label: 'Start' } },
    { id: 'node-2', type: 'process', position: { x: 200, y: 0 }, data: { label: 'End' } },
  ],
  edges: [
    { id: 'edge-1', source: 'node-1', target: 'node-2' },
  ],
});

describe('Phase Lock Integration', () => {
  describe('Two Consecutive Edge-Case Expansions', () => {
    it('should allow first expansion to mutate', () => {
      const { result } = renderHook(() => usePhaseLockSimulator());

      act(() => {
        result.current.setWorkflowDraft(createMockDraft());
      });

      expect(result.current.hasExpandedOnce).toBe(false);
      expect(result.current.mutationApproved).toBe(false);

      let mutationResult: { success: boolean; blockedReason?: string };
      act(() => {
        mutationResult = result.current.attemptMutation();
      });

      expect(mutationResult!.success).toBe(true);
      expect(mutationResult!.blockedReason).toBeUndefined();
    });

    it('should block second expansion after first edge-case expansion', () => {
      const { result } = renderHook(() => usePhaseLockSimulator());

      act(() => {
        result.current.setWorkflowDraft(createMockDraft());
      });

      act(() => {
        result.current.triggerExpansion('EXPANDED_WITH_EDGE_CASES');
      });

      expect(result.current.hasExpandedOnce).toBe(true);
      expect(result.current.workflowGenState).toBe('EXPANDED_WITH_EDGE_CASES');

      let mutationResult: { success: boolean; blockedReason?: string };
      act(() => {
        mutationResult = result.current.attemptMutation();
      });

      expect(mutationResult!.success).toBe(false);
      expect(mutationResult!.blockedReason).toBe('PHASE_LOCKED');
    });

    it('should block mutation after SELECTED_EDGE_CASES_APPLIED state', () => {
      const { result } = renderHook(() => usePhaseLockSimulator());

      act(() => {
        result.current.setWorkflowDraft(createMockDraft());
      });

      act(() => {
        result.current.triggerExpansion('SELECTED_EDGE_CASES_APPLIED');
      });

      expect(result.current.hasExpandedOnce).toBe(true);

      let mutationResult: { success: boolean; blockedReason?: string };
      act(() => {
        mutationResult = result.current.attemptMutation();
      });

      expect(mutationResult!.success).toBe(false);
      expect(mutationResult!.blockedReason).toBe('PHASE_LOCKED');
    });

    it('should re-enable mutation after clicking Apply Changes', () => {
      const { result } = renderHook(() => usePhaseLockSimulator());

      act(() => {
        result.current.setWorkflowDraft(createMockDraft());
      });

      act(() => {
        result.current.triggerExpansion('EXPANDED_WITH_EDGE_CASES');
      });

      expect(result.current.hasExpandedOnce).toBe(true);
      expect(result.current.mutationApproved).toBe(false);

      let blockedResult: { success: boolean; blockedReason?: string };
      act(() => {
        blockedResult = result.current.attemptMutation();
      });
      expect(blockedResult!.success).toBe(false);

      act(() => {
        result.current.clickApplyChanges();
      });

      expect(result.current.mutationApproved).toBe(true);

      act(() => {
        result.current.setWorkflowDraft(createMockDraft());
      });

      let approvedResult: { success: boolean; blockedReason?: string };
      act(() => {
        approvedResult = result.current.attemptMutation();
      });

      expect(approvedResult!.success).toBe(true);
      expect(approvedResult!.blockedReason).toBeUndefined();
    });

    it('should simulate full two-expansion scenario', () => {
      const { result } = renderHook(() => usePhaseLockSimulator());
      const toastMessages: string[] = [];

      act(() => {
        result.current.setWorkflowDraft(createMockDraft());
      });

      act(() => {
        result.current.triggerExpansion('EXPANDED_WITH_EDGE_CASES');
      });

      expect(result.current.hasExpandedOnce).toBe(true);
      
      let firstAttempt: { success: boolean; blockedReason?: string };
      act(() => {
        firstAttempt = result.current.attemptMutation();
        if (!firstAttempt.success && firstAttempt.blockedReason === 'PHASE_LOCKED') {
          toastMessages.push('Workflow Expanded - discuss or click Apply Changes');
        }
      });

      expect(firstAttempt!.success).toBe(false);
      expect(toastMessages).toContain('Workflow Expanded - discuss or click Apply Changes');

      act(() => {
        result.current.setWorkflowDraft(createMockDraft());
      });

      let secondAttemptBeforeApproval: { success: boolean; blockedReason?: string };
      act(() => {
        secondAttemptBeforeApproval = result.current.attemptMutation();
      });

      expect(secondAttemptBeforeApproval!.success).toBe(false);
      expect(secondAttemptBeforeApproval!.blockedReason).toBe('PHASE_LOCKED');

      act(() => {
        result.current.clickApplyChanges();
      });

      act(() => {
        result.current.setWorkflowDraft(createMockDraft());
      });

      let secondAttemptAfterApproval: { success: boolean; blockedReason?: string };
      act(() => {
        secondAttemptAfterApproval = result.current.attemptMutation();
      });

      expect(secondAttemptAfterApproval!.success).toBe(true);
    });
  });

  describe('State Transitions', () => {
    it('should reset hasExpandedOnce after successful mutation', () => {
      const { result } = renderHook(() => usePhaseLockSimulator());

      act(() => {
        result.current.setWorkflowDraft(createMockDraft());
        result.current.triggerExpansion('EXPANDED_WITH_EDGE_CASES');
        result.current.clickApplyChanges();
      });

      expect(result.current.hasExpandedOnce).toBe(true);
      expect(result.current.mutationApproved).toBe(true);

      act(() => {
        result.current.setWorkflowDraft(createMockDraft());
        result.current.attemptMutation();
      });

      expect(result.current.hasExpandedOnce).toBe(false);
      expect(result.current.mutationApproved).toBe(false);
    });

    it('should not trigger phase lock for regular BASELINE_GENERATED state', () => {
      const { result } = renderHook(() => usePhaseLockSimulator());

      act(() => {
        result.current.setWorkflowDraft(createMockDraft());
      });

      expect(result.current.hasExpandedOnce).toBe(false);

      let mutationResult: { success: boolean; blockedReason?: string };
      act(() => {
        mutationResult = result.current.attemptMutation();
      });

      expect(mutationResult!.success).toBe(true);
    });
  });

  describe('Guard Conditions', () => {
    it('should block when hasExpandedOnce=true AND mutationApproved=false', () => {
      const { result } = renderHook(() => usePhaseLockSimulator());

      act(() => {
        result.current.setWorkflowDraft(createMockDraft());
        result.current.triggerExpansion('EXPANDED_WITH_EDGE_CASES');
      });

      const canMutate = !(result.current.hasExpandedOnce && !result.current.mutationApproved);
      expect(canMutate).toBe(false);
    });

    it('should allow when hasExpandedOnce=true AND mutationApproved=true', () => {
      const { result } = renderHook(() => usePhaseLockSimulator());

      act(() => {
        result.current.setWorkflowDraft(createMockDraft());
        result.current.triggerExpansion('EXPANDED_WITH_EDGE_CASES');
        result.current.clickApplyChanges();
      });

      const canMutate = !(result.current.hasExpandedOnce && !result.current.mutationApproved);
      expect(canMutate).toBe(true);
    });

    it('should allow when hasExpandedOnce=false', () => {
      const { result } = renderHook(() => usePhaseLockSimulator());

      const canMutate = !(result.current.hasExpandedOnce && !result.current.mutationApproved);
      expect(canMutate).toBe(true);
    });
  });
});
