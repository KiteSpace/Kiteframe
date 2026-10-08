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
    expect(isWorkflowImportRequest('Create a workflow where customers upload an image file and staff review it.')).toBe(false);
    expect(isWorkflowImportRequest('The workflow must import the file, validate it, then notify the reviewer.')).toBe(false);
    expect(isWorkflowImportRequest('Upload a file and build a workflow for handling customer requests.')).toBe(false);
    expect(isWorkflowImportRequest(`Import files as part of the workflow.\n${'Review the uploaded image and notify staff. '.repeat(50)}`)).toBe(false);
    expect(isWorkflowImportRequest(`Import a workflow from a file. ${'Customer requests must be reviewed. '.repeat(50)}`)).toBe(false);
  });
});