import { describe, expect, it } from 'vitest';
import { isWorkflowImportRequest } from '../workflowImportIntent';

describe('workflow import intent', () => {
  it('recognizes the welcome prompt and natural import requests', () => {
    expect(isWorkflowImportRequest('Import a workflow from an image or .kiteframe file.')).toBe(true);
    expect(isWorkflowImportRequest('Can you upload this workflow screenshot?')).toBe(true);
    expect(isWorkflowImportRequest('Please bring in my .kiteframe file.')).toBe(true);
  });

  it('does not intercept ordinary chat or image analysis', () => {
    expect(isWorkflowImportRequest('How should I improve this workflow?')).toBe(false);
    expect(isWorkflowImportRequest('Analyze this workflow image and suggest improvements.')).toBe(false);
    expect(isWorkflowImportRequest('What is a kiteframe file?')).toBe(false);
  });
});