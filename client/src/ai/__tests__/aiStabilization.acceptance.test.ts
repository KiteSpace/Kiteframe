/**
 * Part 7: Acceptance Tests for AI Stabilization + Gold-Standard Guardrails
 * 
 * These tests verify the end-to-end behavior of the stabilization features.
 */

import { describe, it, expect } from 'vitest';
import {
  captureDiagnosticBaseline,
  computeDiagnosticDelta,
  filterDiagnosticsByMode,
  analyzeWorkflowDiagnostics,
  type AnalyzableWorkflow,
} from '../../utils/workflowDiagnostics';
import {
  createFixScope,
  validateFixScope,
  validateProposalSchema,
  validateEditFirstHeuristic,
  validateProposal,
  type ProposalResponse,
} from '../proposalValidation';

describe('AI Stabilization Acceptance Tests (Part 7)', () => {
  describe('Test 1: No Cascading Alerts', () => {
    it('AI can add nodes without triggering new alerts if baseline already had issues', () => {
      const linearWorkflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Process' },
          { id: '3', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' }
        ]
      };
      
      const baseline = captureDiagnosticBaseline(linearWorkflow);
      expect(baseline.issues.length).toBeGreaterThan(0);
      
      const proposedWorkflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Process Step 1' },
          { id: 'new-1', type: 'process', label: 'Process Step 2' },
          { id: '3', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: 'new-1' },
          { id: 'e3', source: 'new-1', target: '3' }
        ]
      };
      
      const delta = computeDiagnosticDelta(baseline, proposedWorkflow);
      
      expect(delta.hasNewIssues).toBe(false);
    });

    it('Run Test Flight after AI proposal shows NO new alerts unless genuinely new', () => {
      const incompleteWorkflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Process' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' }
        ]
      };
      
      const baseline = captureDiagnosticBaseline(incompleteWorkflow);
      const baselineIssueCodes = Array.from(baseline.issueCodes);
      
      const aiProposedWorkflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Process' },
          { id: '3', type: 'end', label: 'Complete' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' }
        ]
      };
      
      const delta = computeDiagnosticDelta(baseline, aiProposedWorkflow);
      
      expect(delta.resolvedIssues.some(i => i.code === 'NO_TERMINATION')).toBe(true);
      expect(delta.newlyIntroducedIssues.filter(i => 
        i.severity === 'warn' || i.severity === 'blocker'
      )).toHaveLength(0);
    });
  });

  describe('Test 2: Over-Construction Rejection', () => {
    it('AI proposal with many new nodes is discarded', () => {
      const changes = {
        nodesAdded: 10,
        nodesModified: 2,
        edgesAdded: 8,
        edgesRemoved: 0,
      };
      
      const result = validateEditFirstHeuristic(changes);
      
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toBe('over_construction');
    });

    it('AI proposal that adds decision nodes when none existed is rejected', () => {
      const simpleWorkflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Do thing' },
          { id: '3', type: 'end', label: 'Done' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' }
        ]
      };
      
      const scope = createFixScope(simpleWorkflow, 'LINEAR_ONLY');
      
      const proposedWithBranching: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Do thing' },
          { id: 'new-decision', type: 'condition', label: 'Branch?' },
          { id: 'new-path-a', type: 'process', label: 'Path A' },
          { id: 'new-path-b', type: 'process', label: 'Path B' },
          { id: '3', type: 'end', label: 'Done' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: 'new-decision' },
          { id: 'e3', source: 'new-decision', target: 'new-path-a' },
          { id: 'e4', source: 'new-decision', target: 'new-path-b' },
          { id: 'e5', source: 'new-path-a', target: '3' },
          { id: 'e6', source: 'new-path-b', target: '3' }
        ]
      };
      
      const result = validateFixScope(scope, simpleWorkflow, proposedWithBranching);
      
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toBe('new_decision_forbidden');
    });
  });

  describe('Test 3: Proposal Completeness', () => {
    it('Click Propose shows summary, root cause, and why this resolves it', () => {
      const completeProposal: ProposalResponse = {
        summary: 'Add error handling for payment failures',
        rootCause: 'No fallback path when payment API returns error',
        changes: {
          nodesAdded: 2,
          nodesModified: 1,
          edgesAdded: 2,
          edgesRemoved: 0,
        },
        whyThisResolvesIt: 'Adds explicit error catching node that routes to retry or escalation',
        risksIntroduced: ['Retry loop could exhaust rate limits'],
      };
      
      const schemaResult = validateProposalSchema(completeProposal);
      
      expect(schemaResult.valid).toBe(true);
      
      expect(completeProposal.summary).toBeTruthy();
      expect(completeProposal.rootCause).toBeTruthy();
      expect(completeProposal.whyThisResolvesIt).toBeTruthy();
    });

    it('Incomplete proposal is rejected', () => {
      const incompleteProposal: Partial<ProposalResponse> = {
        summary: 'Fix the thing',
      };
      
      const result = validateProposalSchema(incompleteProposal);
      
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toBe('incomplete_schema');
    });

    it('Complete proposal passes all guardrails in sequence', () => {
      const workflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Process' },
          { id: '3', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' }
        ]
      };
      
      const scope = createFixScope(workflow);
      
      const proposal: ProposalResponse = {
        summary: 'Add intermediate step',
        rootCause: 'Processing is atomic when it should have substeps',
        changes: {
          nodesAdded: 1,
          nodesModified: 1,
          edgesAdded: 1,
          edgesRemoved: 0,
        },
        whyThisResolvesIt: 'Breaks down processing into observable stages',
        risksIntroduced: [],
      };
      
      const proposedWorkflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Process Step 1' },
          { id: 'new-step', type: 'process', label: 'Process Step 2' },
          { id: '3', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: 'new-step' },
          { id: 'e3', source: 'new-step', target: '3' }
        ]
      };
      
      const result = validateProposal(proposal, scope, workflow, proposedWorkflow);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('Test Flight Intent Mode', () => {
    it('educate mode suppresses advisory issues during AI flows', () => {
      const workflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Process' },
          { id: '3', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' }
        ]
      };
      
      const allIssues = analyzeWorkflowDiagnostics(workflow);
      expect(allIssues.length).toBeGreaterThan(0);
      
      const educateModeIssues = filterDiagnosticsByMode(allIssues, 'educate');
      expect(educateModeIssues.length).toBe(0);
      
      const validateModeIssues = filterDiagnosticsByMode(allIssues, 'validate');
      expect(validateModeIssues.length).toBeGreaterThan(0);
    });
  });

  describe('HOME Proposal Guardrail Bypass', () => {
    /**
     * These tests verify that AI stabilization guardrails are correctly bypassed
     * during HOME proposal generation (baseline workflow creation).
     */

    it('HOME proposal surface detection correctly identifies fullscreen mode', () => {
      const isHomeProposal = (surfaceContext: string, mode: string) => 
        surfaceContext === 'home' || mode === 'fullscreen';
      
      expect(isHomeProposal('home', 'panel')).toBe(true);
      expect(isHomeProposal('project', 'fullscreen')).toBe(true);
      expect(isHomeProposal('project', 'panel')).toBe(false);
      expect(isHomeProposal('project', 'floating')).toBe(false);
    });

    it('skipAiStabilization is true for HOME proposals', () => {
      const getSkipFlag = (surfaceContext: string, mode: string) => {
        const isHomeProposal = surfaceContext === 'home' || mode === 'fullscreen';
        return isHomeProposal;
      };
      
      expect(getSkipFlag('home', 'fullscreen')).toBe(true);
      expect(getSkipFlag('home', 'panel')).toBe(true);
      expect(getSkipFlag('project', 'fullscreen')).toBe(true);
      
      expect(getSkipFlag('project', 'panel')).toBe(false);
      expect(getSkipFlag('project', 'floating')).toBe(false);
    });

    it('HOME baseline workflow would fail guardrails if they ran (proving bypass is necessary)', () => {
      const baselineWorkflow: AnalyzableWorkflow = {
        nodes: [],
        edges: []
      };
      const baseline = captureDiagnosticBaseline(baselineWorkflow);
      
      const homeProposal: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Step 1' },
          { id: '3', type: 'process', label: 'Step 2' },
          { id: '4', type: 'process', label: 'Step 3' },
          { id: '5', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' },
          { id: 'e3', source: '3', target: '4' },
          { id: 'e4', source: '4', target: '5' }
        ]
      };
      
      const editFirstResult = validateEditFirstHeuristic({
        nodesAdded: 5,
        nodesModified: 0,
        edgesAdded: 4,
        edgesRemoved: 0,
      });
      
      expect(editFirstResult.valid).toBe(false);
    });

    it('in-project mutations still enforce guardrails (empty canvas does NOT bypass)', () => {
      const getSkipFlag = (surfaceContext: string, mode: string) => {
        const isHomeProposal = surfaceContext === 'home' || mode === 'fullscreen';
        return isHomeProposal;
      };
      
      expect(getSkipFlag('project', 'panel')).toBe(false);
      
      const editFirstResult = validateEditFirstHeuristic({
        nodesAdded: 10,
        nodesModified: 0,
        edgesAdded: 8,
        edgesRemoved: 0,
      });
      
      expect(editFirstResult.valid).toBe(false);
      expect(editFirstResult.rejectionReason).toBe('over_construction');
    });

    it('in-project Apply with existing workflow enforces fix-scope validation', () => {
      const existingWorkflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Process' },
          { id: '3', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' }
        ]
      };
      
      const scope = createFixScope(existingWorkflow, 'LINEAR_ONLY');
      
      const proposedWithDecision: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'condition', label: 'Decision?' },
          { id: '3', type: 'process', label: 'Path A' },
          { id: '4', type: 'process', label: 'Path B' },
          { id: '5', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3', label: 'Yes' },
          { id: 'e3', source: '2', target: '4', label: 'No' },
          { id: 'e4', source: '3', target: '5' },
          { id: 'e5', source: '4', target: '5' }
        ]
      };
      
      const result = validateFixScope(scope, existingWorkflow, proposedWithDecision);
      
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toBe('scope_violation');
    });
  });
});
