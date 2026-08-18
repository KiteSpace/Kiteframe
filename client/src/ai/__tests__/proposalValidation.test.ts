import { describe, it, expect } from 'vitest';
import {
  createFixScope,
  validateFixScope,
  validateProposalSchema,
  validateEditFirstHeuristic,
  validateProposal,
  type ProposalResponse,
  type FixScope,
} from '../proposalValidation';
import type { AnalyzableWorkflow } from '../../utils/workflowDiagnostics';

describe('Proposal Validation (Parts 2-4)', () => {
  describe('Part 2: Fix-Scope Locking', () => {
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

    it('createFixScope captures baseline node types and forbids new decision nodes', () => {
      const scope = createFixScope(linearWorkflow, 'LINEAR_ONLY');
      
      expect(scope.allowedNodeTypes).toContain('start');
      expect(scope.allowedNodeTypes).toContain('process');
      expect(scope.allowedNodeTypes).toContain('end');
      expect(scope.forbidNewDecisionNodes).toBe(true);
      expect(scope.forbidNewFailurePaths).toBe(true);
    });

    it('validateFixScope rejects proposals that add decision nodes when none existed', () => {
      const scope = createFixScope(linearWorkflow);
      
      const proposedWithDecision: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Process' },
          { id: 'new-decision', type: 'decision', label: 'Check something' },
          { id: '3', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: 'new-decision' },
          { id: 'e3', source: 'new-decision', target: '3' }
        ]
      };
      
      const result = validateFixScope(scope, linearWorkflow, proposedWithDecision);
      
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toBe('new_decision_forbidden');
    });

    it('validateFixScope allows proposals that modify existing nodes without adding new types', () => {
      const scope = createFixScope(linearWorkflow);
      
      const proposedWithMoreProcess: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Process Step 1' },
          { id: '3', type: 'process', label: 'Process Step 2' },
          { id: '4', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' },
          { id: 'e3', source: '3', target: '4' }
        ]
      };
      
      const result = validateFixScope(scope, linearWorkflow, proposedWithMoreProcess);
      
      expect(result.valid).toBe(true);
    });

    it('validateFixScope rejects when existing node TYPE is converted to decision', () => {
      const scope = createFixScope(linearWorkflow);
      
      const proposedWithConvertedNode: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'decision', label: 'Now a decision' },
          { id: '3', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' }
        ]
      };
      
      const result = validateFixScope(scope, linearWorkflow, proposedWithConvertedNode);
      
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toBe('new_decision_forbidden');
      expect(result.details).toContain('converts');
    });

    it('validateFixScope rejects when existing node TYPE is converted to failure', () => {
      const scope = createFixScope(linearWorkflow);
      
      const proposedWithConvertedFailure: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'error', label: 'Now an error handler' },
          { id: '3', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' }
        ]
      };
      
      const result = validateFixScope(scope, linearWorkflow, proposedWithConvertedFailure);
      
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toBe('scope_violation');
      expect(result.details).toContain('converts');
    });

    it('validateFixScope enforces edge type constraints', () => {
      const workflowWithDefaultEdges: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Process' },
          { id: '3', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2', type: 'default' },
          { id: 'e2', source: '2', target: '3', type: 'default' }
        ]
      };
      
      const scope = createFixScope(workflowWithDefaultEdges);
      
      const proposedWithNewEdgeType: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Process' },
          { id: '3', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2', type: 'default' },
          { id: 'e2', source: '2', target: '3', type: 'default' },
          { id: 'new-edge', source: '2', target: '3', type: 'conditional' }
        ]
      };
      
      const result = validateFixScope(scope, workflowWithDefaultEdges, proposedWithNewEdgeType);
      
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toBe('scope_violation');
      expect(result.details).toContain('edge types');
    });
  });

  describe('Part 3: Proposal Schema Validation', () => {
    it('rejects proposals with missing required fields', () => {
      const incomplete: Partial<ProposalResponse> = {
        summary: 'Add error handling',
      };
      
      const result = validateProposalSchema(incomplete);
      
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toBe('incomplete_schema');
      expect(result.details).toContain('rootCause');
    });

    it('accepts complete proposals', () => {
      const complete: ProposalResponse = {
        summary: 'Add error handling',
        rootCause: 'No error handling exists',
        changes: {
          nodesAdded: 1,
          nodesModified: 0,
          edgesAdded: 1,
          edgesRemoved: 0,
        },
        whyThisResolvesIt: 'Adds explicit error path',
        risksIntroduced: [],
      };
      
      const result = validateProposalSchema(complete);
      
      expect(result.valid).toBe(true);
    });

    it('rejects proposals with empty strings for required fields', () => {
      const emptyStrings: Partial<ProposalResponse> = {
        summary: '',
        rootCause: 'Some cause',
        changes: {
          nodesAdded: 1,
          nodesModified: 0,
          edgesAdded: 1,
          edgesRemoved: 0,
        },
        whyThisResolvesIt: 'Reason',
        risksIntroduced: [],
      };
      
      const result = validateProposalSchema(emptyStrings);
      
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toBe('incomplete_schema');
    });
  });

  describe('Part 4: Edit-First Heuristic', () => {
    it('rejects proposals with excessive node creation (nodesAdded > nodesModified * 2)', () => {
      const overConstruction = {
        nodesAdded: 10,
        nodesModified: 2,
        edgesAdded: 5,
        edgesRemoved: 0,
      };
      
      const result = validateEditFirstHeuristic(overConstruction);
      
      expect(result.valid).toBe(false);
      expect(result.rejectionReason).toBe('over_construction');
    });

    it('accepts proposals with balanced modifications', () => {
      const balanced = {
        nodesAdded: 2,
        nodesModified: 3,
        edgesAdded: 2,
        edgesRemoved: 0,
      };
      
      const result = validateEditFirstHeuristic(balanced);
      
      expect(result.valid).toBe(true);
    });

    it('allows pure additions when no modifications are possible', () => {
      const pureAddition = {
        nodesAdded: 5,
        nodesModified: 0,
        edgesAdded: 4,
        edgesRemoved: 0,
      };
      
      const result = validateEditFirstHeuristic(pureAddition);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('Combined Validation', () => {
    it('runs all guardrails in sequence', () => {
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
      
      const scope = createFixScope(linearWorkflow);
      
      const response: ProposalResponse = {
        summary: 'Add more processing',
        rootCause: 'Workflow too simple',
        changes: {
          nodesAdded: 1,
          nodesModified: 1,
          edgesAdded: 1,
          edgesRemoved: 0,
        },
        whyThisResolvesIt: 'Adds more steps',
        risksIntroduced: [],
      };
      
      const proposedWorkflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Process 1' },
          { id: '3', type: 'process', label: 'Process 2' },
          { id: '4', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' },
          { id: 'e3', source: '3', target: '4' }
        ]
      };
      
      const result = validateProposal(response, scope, linearWorkflow, proposedWorkflow);
      
      expect(result.valid).toBe(true);
    });
  });
});
