import { describe, it, expect } from 'vitest';
import { 
  analyzeWorkflowDiagnostics, 
  getSuggestedQuickActions,
  captureDiagnosticBaseline,
  computeDiagnosticDelta,
  shouldFlagProposalForNewIssues,
  filterDiagnosticsByMode,
  projectAppliedWorkflow,
  assessProposal,
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

/**
 * A canvas that is already in good shape: it branches, it handles failure,
 * and it terminates. Scores zero diagnostics.
 */
const healthyExistingCanvas: AnalyzableWorkflow = {
  nodes: [
    { id: 'x1', type: 'start', label: 'Start' },
    { id: 'x2', type: 'decision', label: 'Payment authorized?' },
    { id: 'x3', type: 'process', label: 'Ship order' },
    { id: 'x4', type: 'error', label: 'Handle declined payment' },
    { id: 'x5', type: 'end', label: 'Complete' },
  ],
  edges: [
    { id: 'xe1', source: 'x1', target: 'x2' },
    { id: 'xe2', source: 'x2', target: 'x3', label: 'Yes' },
    { id: 'xe3', source: 'x2', target: 'x4', label: 'No' },
    { id: 'xe4', source: 'x3', target: 'x5' },
    { id: 'xe5', source: 'x4', target: 'x5' },
  ],
};

/**
 * A brand-new workflow, first draft: no failure path yet. This is what the AI
 * returns when asked to build something new.
 */
const freshWorkflowWithoutFailurePath: AnalyzableWorkflow = {
  nodes: [
    { id: 'n1', type: 'start', label: 'Receive request' },
    { id: 'n2', type: 'process', label: 'Review request' },
    { id: 'n3', type: 'end', label: 'Done' },
  ],
  edges: [
    { id: 'ne1', source: 'n1', target: 'n2' },
    { id: 'ne2', source: 'n2', target: 'n3' },
  ],
};

describe('projectAppliedWorkflow', () => {
  it('keeps the existing canvas and adds the proposal to it', () => {
    const applied = projectAppliedWorkflow(healthyExistingCanvas, freshWorkflowWithoutFailurePath);

    expect(applied.nodes.map(n => n.id)).toEqual(
      ['x1', 'x2', 'x3', 'x4', 'x5', 'n1', 'n2', 'n3']
    );
    expect(applied.edges).toHaveLength(7);
  });

  it('keeps both nodes when the proposal reuses an existing id', () => {
    // Applying remaps incoming node ids, so a collision in the raw proposal
    // never overwrites what is already on the canvas.
    const collidingProposal: AnalyzableWorkflow = {
      nodes: [{ id: 'x4', type: 'process', label: 'Continue anyway' }],
      edges: [],
    };

    const applied = projectAppliedWorkflow(healthyExistingCanvas, collidingProposal);

    expect(applied.nodes).toHaveLength(6);
    expect(applied.nodes.filter(n => n.type === 'error')).toHaveLength(1);
  });

  it('handles an empty canvas', () => {
    const applied = projectAppliedWorkflow({ nodes: [], edges: [] }, freshWorkflowWithoutFailurePath);

    expect(applied).toEqual(freshWorkflowWithoutFailurePath);
  });
});

describe('captureDiagnosticBaseline snapshots the graph', () => {
  it('keeps the graph it measured so later comparisons are like-for-like', () => {
    const baseline = captureDiagnosticBaseline(healthyExistingCanvas);

    expect(baseline.workflow.nodes.map(n => n.id)).toEqual(['x1', 'x2', 'x3', 'x4', 'x5']);
  });

  it('copies the graph so later canvas edits do not rewrite history', () => {
    const liveCanvas: AnalyzableWorkflow = {
      nodes: [...healthyExistingCanvas.nodes],
      edges: [...healthyExistingCanvas.edges],
    };
    const baseline = captureDiagnosticBaseline(liveCanvas);

    // The user keeps editing while the AI request is in flight.
    liveCanvas.nodes.push({ id: 'x6', type: 'process', label: 'Added mid-flight' });

    expect(baseline.workflow.nodes).toHaveLength(5);
  });
});

describe('assessProposal', () => {
  it('does not treat a brand-new workflow as damage to a healthy canvas', () => {
    // The reported bug: asking for a NEW workflow beside a mature one was
    // rejected because the new workflow, judged alone, has no failure path.
    const baseline = captureDiagnosticBaseline(healthyExistingCanvas);
    expect(baseline.issues).toHaveLength(0);

    const assessment = assessProposal(baseline, freshWorkflowWithoutFailurePath);

    expect(assessment.delta.hasRegressions).toBe(false);
    expect(assessment.delta.newlyIntroducedIssues).toHaveLength(0);
  });

  it('is only safe because the comparison is like-for-like', () => {
    // Guards the actual fix: judging the proposal in isolation (the old
    // behaviour) still reports regressions. If this ever stops being true the
    // test above would pass for the wrong reason.
    const baseline = captureDiagnosticBaseline(healthyExistingCanvas);

    const isolatedDelta = computeDiagnosticDelta(baseline, freshWorkflowWithoutFailurePath);

    expect(isolatedDelta.hasRegressions).toBe(true);
    expect(shouldFlagProposalForNewIssues(isolatedDelta)).toBe(true);
  });

  it('reports the missing failure path as advice, and keeps it actionable', () => {
    const baseline = captureDiagnosticBaseline(healthyExistingCanvas);

    const assessment = assessProposal(baseline, freshWorkflowWithoutFailurePath);

    expect(assessment.advisories.some(i => i.code === 'NO_FAILURE_PATH')).toBe(true);
    expect(assessment.advisories.some(i => i.code === 'LINEAR_ONLY')).toBe(true);
    // The advice must stay actionable — this is what the quick actions hang off.
    expect(
      assessment.advisories.find(i => i.code === 'NO_FAILURE_PATH')?.suggestedQuickActions
    ).toContain('INCLUDE_EDGE_CASES');
  });

  it('cannot report a regression even when the proposal reuses existing ids', () => {
    // Applying remaps ids and only ever adds, so the canvas keeps its error
    // node no matter what the proposal calls its own nodes.
    const baseline = captureDiagnosticBaseline(healthyExistingCanvas);

    const collidingProposal: AnalyzableWorkflow = {
      nodes: [{ id: 'x4', type: 'process', label: 'Continue anyway' }],
      edges: [],
    };

    const assessment = assessProposal(baseline, collidingProposal);

    expect(assessment.delta.hasRegressions).toBe(false);
  });

  it('never calls the first workflow in an empty project a regression', () => {
    // An empty canvas has zero diagnostics, so any finding in a first draft
    // would look "net new" if it were judged as damage.
    const baseline = captureDiagnosticBaseline({ nodes: [], edges: [] });
    expect(baseline.issues).toHaveLength(0);

    const assessment = assessProposal(baseline, freshWorkflowWithoutFailurePath);

    expect(assessment.advisories.some(i => i.code === 'NO_FAILURE_PATH')).toBe(true);
  });

  it('reports nothing at all for a proposal that is already complete', () => {
    const baseline = captureDiagnosticBaseline(healthyExistingCanvas);

    const completeProposal: AnalyzableWorkflow = {
      nodes: [
        { id: 'n1', type: 'start', label: 'Start refund' },
        { id: 'n2', type: 'decision', label: 'Refund eligible? tradeoff: speed vs fraud risk' },
        { id: 'n3', type: 'process', label: 'Issue refund' },
        { id: 'n4', type: 'error', label: 'Reject refund' },
        { id: 'n5', type: 'end', label: 'Complete' },
      ],
      edges: [
        { id: 'ne1', source: 'n1', target: 'n2' },
        { id: 'ne2', source: 'n2', target: 'n3', label: 'Yes' },
        { id: 'ne3', source: 'n2', target: 'n4', label: 'No' },
        { id: 'ne4', source: 'n3', target: 'n5' },
        { id: 'ne5', source: 'n4', target: 'n5' },
      ],
    };

    const assessment = assessProposal(baseline, completeProposal);

    expect(assessment.advisories).toHaveLength(0);
    expect(assessment.delta.hasRegressions).toBe(false);
  });
});
