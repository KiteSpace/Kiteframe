import { beforeEach, describe, expect, it } from 'vitest';
import { collectWorkflowInterfaceContext, workflowToPlanningInput } from '../workflowInterfacePlan';
import { saveProjectPRD, saveWorkflowPRD } from '../kiteframe/utils/prdStorage';
import { MAX_INTERFACE_CONTEXT_CHARS } from '@shared/interfacePlan';

describe('workflow planning context', () => {
  beforeEach(() => localStorage.clear());
  it('includes Specs for disconnected groups stored under the source project identity', () => {
    saveProjectPRD('project', {
      projectId: 'project', projectName: 'Billing', sections: [{ id: 'overview', title: 'Overview', content: 'Membership and invoices.' }],
      manualEditedAt: {}, generatedAt: 1, version: 1,
    });
    saveWorkflowPRD('project', 'invoices-group', {
      workflowId: 'invoices-group', workflowName: 'Invoices',
      sections: [{ id: 'invoice-fields', title: 'Fields', content: 'Invoice number, due date, amount.' }],
      manualEditedAt: {}, generatedAt: 1, version: 1,
    });
    const context = collectWorkflowInterfaceContext({ id: 'browser-tab', name: 'Billing', projectUuid: 'project' });
    expect(context).toContain('Invoice number');
    expect(context).toContain('Membership and invoices');
    expect(context).not.toContain('generatedAt');
  });
  it('marks oversized Specs as an excerpt rather than silently dropping text', () => {
    saveProjectPRD('project', {
      projectId: 'project', projectName: 'Large Specs', sections: [{ id: 'large', title: 'Large', content: 'x'.repeat(20000) }],
      manualEditedAt: {}, generatedAt: 1, version: 1,
    });
    const context = collectWorkflowInterfaceContext({ id: 'tab', name: 'Workflow', projectUuid: 'project' });
    expect(context.length).toBeLessThanOrEqual(MAX_INTERFACE_CONTEXT_CHARS);
    expect(context).toMatch(/^\[CONTEXT EXCERPT/);
  });
  it('never silently clips a source step description', () => {
    expect(() => workflowToPlanningInput([{
      id: 'node', position: { x: 0, y: 0 },
      data: { label: 'Review', description: 'x'.repeat(2000) },
    }], [], 'Review')).toThrow();
  });
});
