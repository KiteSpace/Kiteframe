import { describe, it, expect } from 'vitest';
import { 
  analyzeWorkflowDiagnostics, 
  getSuggestedQuickActions,
  captureDiagnosticBaseline,
  computeDiagnosticDelta,
  shouldFlagProposalForNewIssues,
  filterDiagnosticsByMode,
  type AnalyzableWorkflow,
  type WorkflowDiagnosticIssue
} from '../workflowDiagnostics';

describe('getSuggestedQuickActions', () => {
  describe('HOME_PROPOSAL context', () => {
    it('always includes edge/fail actions regardless of diagnostics', () => {
      const emptyIssues: WorkflowDiagnosticIssue[] = [];
      
      const actions = getSuggestedQuickActions(emptyIssues, 'HOME_PROPOSAL');
      
      expect(actions).toContain('HAPPY_PATH_ONLY');
      expect(actions).toContain('INCLUDE_EDGE_CASES');
      expect(actions).toContain('DISCUSS_EDGE_CASES');
    });

    it('includes edge/fail actions even when workflow has decision nodes and failure paths', () => {
      const workflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'decision', label: 'Check condition' },
          { id: '3', type: 'process', label: 'Success path' },
          { id: '4', type: 'error', label: 'Failure handling' },
          { id: '5', type: 'end', label: 'Complete' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3', label: 'Yes' },
          { id: 'e3', source: '2', target: '4', label: 'No' },
          { id: 'e4', source: '3', target: '5' },
          { id: 'e5', source: '4', target: '5' }
        ]
      };
      
      const diagnostics = analyzeWorkflowDiagnostics(workflow);
      expect(diagnostics).toHaveLength(0);
      
      const actions = getSuggestedQuickActions(diagnostics, 'HOME_PROPOSAL');
      
      expect(actions).toContain('HAPPY_PATH_ONLY');
      expect(actions).toContain('INCLUDE_EDGE_CASES');
      expect(actions).toContain('DISCUSS_EDGE_CASES');
    });
  });

  describe('IN_PROJECT context (default)', () => {
    it('returns empty actions when diagnostics is empty', () => {
      const emptyIssues: WorkflowDiagnosticIssue[] = [];
      
      const actions = getSuggestedQuickActions(emptyIssues, 'IN_PROJECT');
      
      expect(actions).toHaveLength(0);
    });

    it('returns empty actions when no context provided and diagnostics is empty', () => {
      const emptyIssues: WorkflowDiagnosticIssue[] = [];
      
      const actions = getSuggestedQuickActions(emptyIssues);
      
      expect(actions).toHaveLength(0);
    });

    it('returns actions from diagnostics when issues exist', () => {
      const issues: WorkflowDiagnosticIssue[] = [
        {
          code: 'LINEAR_ONLY',
          message: 'Linear workflow detected',
          severity: 'warn',
          suggestedQuickActions: ['HAPPY_PATH_ONLY', 'INCLUDE_EDGE_CASES', 'DISCUSS_EDGE_CASES']
        }
      ];
      
      const actions = getSuggestedQuickActions(issues, 'IN_PROJECT');
      
      expect(actions).toContain('HAPPY_PATH_ONLY');
      expect(actions).toContain('INCLUDE_EDGE_CASES');
      expect(actions).toContain('DISCUSS_EDGE_CASES');
    });
  });

  describe('analyzeWorkflowDiagnostics', () => {
    it('returns LINEAR_ONLY for workflow without decision nodes', () => {
      const workflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Do something' },
          { id: '3', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' }
        ]
      };
      
      const issues = analyzeWorkflowDiagnostics(workflow);
      
      expect(issues.some(i => i.code === 'LINEAR_ONLY')).toBe(true);
    });

    it('returns NO_FAILURE_PATH when no failure nodes exist', () => {
      const workflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Do something' },
          { id: '3', type: 'end', label: 'End' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' }
        ]
      };
      
      const issues = analyzeWorkflowDiagnostics(workflow);
      
      expect(issues.some(i => i.code === 'NO_FAILURE_PATH')).toBe(true);
    });

    it('returns empty array for complete workflow with decisions and failure paths', () => {
      const workflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'decision', label: 'Check condition' },
          { id: '3', type: 'process', label: 'Success' },
          { id: '4', type: 'error', label: 'Handle failure' },
          { id: '5', type: 'end', label: 'Complete' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3', label: 'Yes' },
          { id: 'e3', source: '2', target: '4', label: 'No' },
          { id: 'e4', source: '3', target: '5' },
          { id: 'e5', source: '4', target: '5' }
        ]
      };
      
      const issues = analyzeWorkflowDiagnostics(workflow);
      
      expect(issues).toHaveLength(0);
    });
  });

  describe('Diagnostic Delta Gating (Part 1)', () => {
    it('captureDiagnosticBaseline captures issue codes for comparison', () => {
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
      
      expect(baseline.issueCodes.has('LINEAR_ONLY')).toBe(true);
      expect(baseline.issueCodes.has('NO_FAILURE_PATH')).toBe(true);
      expect(baseline.nodeCount).toBe(3);
      expect(baseline.edgeCount).toBe(2);
    });

    it('computeDiagnosticDelta returns only NET NEW issues (ignores pre-existing)', () => {
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
      expect(baseline.issueCodes.has('LINEAR_ONLY')).toBe(true);
      expect(baseline.issueCodes.has('NO_FAILURE_PATH')).toBe(true);
      
      const proposedWorkflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'decision', label: 'Check tradeoff: speed vs accuracy' },
          { id: '3', type: 'process', label: 'Process' },
          { id: '4', type: 'error', label: 'Handle failure' },
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
      
      const delta = computeDiagnosticDelta(baseline, proposedWorkflow);
      
      expect(delta.newlyIntroducedIssues).toHaveLength(0);
      expect(delta.resolvedIssues.some(i => i.code === 'LINEAR_ONLY')).toBe(true);
      expect(delta.resolvedIssues.some(i => i.code === 'NO_FAILURE_PATH')).toBe(true);
      expect(delta.hasNewIssues).toBe(false);
    });

    it('computeDiagnosticDelta detects genuinely NEW issue classes', () => {
      const completeWorkflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'decision', label: 'Check' },
          { id: '3', type: 'process', label: 'Success' },
          { id: '4', type: 'error', label: 'Fail' },
          { id: '5', type: 'end', label: 'Done' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3', label: 'Yes' },
          { id: 'e3', source: '2', target: '4', label: 'No' },
          { id: 'e4', source: '3', target: '5' },
          { id: 'e5', source: '4', target: '5' }
        ]
      };
      
      const baseline = captureDiagnosticBaseline(completeWorkflow);
      expect(baseline.issues).toHaveLength(0);
      
      const degradedWorkflow: AnalyzableWorkflow = {
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
      
      const delta = computeDiagnosticDelta(baseline, degradedWorkflow);
      
      expect(delta.hasNewIssues).toBe(true);
      expect(delta.newlyIntroducedIssues.some(i => i.code === 'LINEAR_ONLY')).toBe(true);
      expect(delta.newlyIntroducedIssues.some(i => i.code === 'NO_FAILURE_PATH')).toBe(true);
    });

    it('shouldFlagProposalForNewIssues returns true only for warn/blocker regressions', () => {
      const workflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'decision', label: 'Check' },
          { id: '3', type: 'end', label: 'Done' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' },
          { id: 'e2', source: '2', target: '3' }
        ]
      };
      
      const baseline = captureDiagnosticBaseline(workflow);
      
      const degradedWorkflow: AnalyzableWorkflow = {
        nodes: [
          { id: '1', type: 'start', label: 'Start' },
          { id: '2', type: 'process', label: 'Process' }
        ],
        edges: [
          { id: 'e1', source: '1', target: '2' }
        ]
      };
      
      const delta = computeDiagnosticDelta(baseline, degradedWorkflow);
      
      expect(shouldFlagProposalForNewIssues(delta)).toBe(true);
    });
  });

  describe('Part 5: Test Flight Intent Awareness', () => {
    it('filterDiagnosticsByMode returns all issues in validate mode', () => {
      const issues: WorkflowDiagnosticIssue[] = [
        { code: 'LINEAR_ONLY', message: 'Linear', severity: 'warn' },
        { code: 'NO_FAILURE_PATH', message: 'No failure', severity: 'warn' },
        { code: 'NO_TERMINATION', message: 'No termination', severity: 'info' },
      ];
      
      const filtered = filterDiagnosticsByMode(issues, 'validate');
      
      expect(filtered).toHaveLength(3);
    });

    it('filterDiagnosticsByMode returns only blockers in educate mode', () => {
      const issues: WorkflowDiagnosticIssue[] = [
        { code: 'LINEAR_ONLY', message: 'Linear', severity: 'warn' },
        { code: 'NO_FAILURE_PATH', message: 'No failure', severity: 'blocker' },
        { code: 'NO_TERMINATION', message: 'No termination', severity: 'info' },
      ];
      
      const filtered = filterDiagnosticsByMode(issues, 'educate');
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].code).toBe('NO_FAILURE_PATH');
    });

    it('filterDiagnosticsByMode returns empty array when no blockers in educate mode', () => {
      const issues: WorkflowDiagnosticIssue[] = [
        { code: 'LINEAR_ONLY', message: 'Linear', severity: 'warn' },
        { code: 'NO_TERMINATION', message: 'No termination', severity: 'info' },
      ];
      
      const filtered = filterDiagnosticsByMode(issues, 'educate');
      
      expect(filtered).toHaveLength(0);
    });
  });
});
