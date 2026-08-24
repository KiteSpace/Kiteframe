import { beforeEach, describe, expect, it } from 'vitest';
import type { WorkflowPRD } from '@/ai/prdEngine';
import {
  loadWorkflowPRD,
  loadWorkflowPRDHistory,
  saveWorkflowPRD,
} from '@/lib/kiteframe/utils/prdStorage';
import {
  applyWorkflowSpecEdit,
  findWorkflowSpecTarget,
  isWorkflowSpecEditRequest,
  parseWorkflowSpecEditResponse,
} from '../workflowSpecEdits';

const PROJECT = 'local-spec-edit-project';

function spec(workflowId: string, workflowName = 'Workflow 1'): WorkflowPRD {
  return {
    workflowId,
    workflowName,
    version: 1,
    generatedAt: 1,
    manualEditedAt: {},
    sections: [
      { id: 'overview', title: 'Overview', content: 'Existing overview.' },
      { id: 'requirements', title: 'Requirements', content: 'Existing requirements.' },
    ],
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('workflow spec edit intent', () => {
  it('recognizes explicit requests to change a workflow spec without treating general chat as an edit', () => {
    expect(isWorkflowSpecEditRequest('Can you add requirements to the workflow spec 1?')).toBe(true);
    expect(isWorkflowSpecEditRequest('Please revise the PRD with operational risks.')).toBe(true);
    expect(isWorkflowSpecEditRequest('What makes a good workflow?')).toBe(false);
  });

  it('uses the only saved workflow spec and refuses an ambiguous project', () => {
    saveWorkflowPRD(PROJECT, 'wf-1', spec('wf-1'));
    expect(findWorkflowSpecTarget(PROJECT, 'Add operational risks to the workflow spec')?.workflowId).toBe('wf-1');

    saveWorkflowPRD(PROJECT, 'wf-2', spec('wf-2', 'Workflow 2'));
    expect(findWorkflowSpecTarget(PROJECT, 'Add operational risks to the workflow spec')).toBeNull();
    expect(findWorkflowSpecTarget(PROJECT, 'Add operational risks to the workflow spec', 'wf-1')?.workflowId).toBe('wf-1');
    expect(findWorkflowSpecTarget(PROJECT, 'Add operational risks to workflow spec 2')?.workflowId).toBe('wf-2');
  });
});

describe('workflow spec edit responses', () => {
  it('accepts a complete replacement for an existing section only', () => {
    const prd = spec('wf-1');
    expect(parseWorkflowSpecEditResponse(JSON.stringify({
      sectionId: 'requirements',
      content: 'FR-1: The system shall save a reservation.',
      summary: 'Added a reservation requirement.',
    }), prd)).toEqual({
      sectionId: 'requirements',
      content: 'FR-1: The system shall save a reservation.',
      summary: 'Added a reservation requirement.',
    });

    expect(parseWorkflowSpecEditResponse(JSON.stringify({
      sectionId: 'invented-section',
      content: 'This must not be saved.',
    }), prd)).toBeNull();
    expect(parseWorkflowSpecEditResponse('I updated the requirements section.', prd)).toBeNull();
  });

  it('saves an AI update, backup, and restorable previous version', async () => {
    const original = spec('wf-1');
    saveWorkflowPRD(PROJECT, 'wf-1', original);

    await applyWorkflowSpecEdit(
      { projectId: PROJECT, workflowId: 'wf-1', prd: original },
      { sectionId: 'requirements', content: 'FR-1: The system shall save a reservation.' },
    );

    expect(loadWorkflowPRD(PROJECT, 'wf-1')?.sections.find(section => section.id === 'requirements')?.content)
      .toBe('FR-1: The system shall save a reservation.');
    expect(loadWorkflowPRDHistory(PROJECT, 'wf-1')).toHaveLength(1);
    expect(loadWorkflowPRDHistory(PROJECT, 'wf-1')[0].content.sections.find(section => section.id === 'requirements')?.content)
      .toBe('Existing requirements.');
  });
});