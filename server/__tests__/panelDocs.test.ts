/**
 * Unit tests for the shared panel-docs contract used by share/view, project
 * PUT merges, and snapshot mirrors.
 */
import { describe, it, expect } from 'vitest';
import {
  extractSharePanelDocs,
  mergeWorkflowDataPreservingPanelDocs,
  pickPresentPanelDocs,
} from '@shared/panelDocs';

describe('extractSharePanelDocs', () => {
  it('reads flat documentation keys', () => {
    const docs = extractSharePanelDocs({
      prdData: { projectName: 'A', sections: [] },
      workflowPRDs: [{ workflowId: 'wf-1', sections: [] }],
      notesData: '{"notes":[]}',
      detailsData: '{"name":"A","description":"d"}',
      nodes: [{ id: 'n1' }],
    });
    expect(docs.prdData?.projectName).toBe('A');
    expect(docs.workflowPRDs).toHaveLength(1);
    expect(docs.notesData).toContain('notes');
    expect(docs.detailsData).toContain('"name":"A"');
  });

  it('falls back to nested .kiteframe documentation for PRDs, notes, and overview', () => {
    const docs = extractSharePanelDocs({
      documentation: {
        projectPRD: { projectName: 'Nested', sections: [] },
        workflowPRDs: [{ workflowId: 'wf-9', sections: [] }],
        notes: { notes: [{ id: 'n1', content: 'hello' }] },
        projectOverview: { name: 'Nested', description: 'from import', categories: ['x'] },
      },
    });
    expect(docs.prdData?.projectName).toBe('Nested');
    expect(docs.workflowPRDs?.[0]?.workflowId).toBe('wf-9');
    expect(docs.notesData).toContain('hello');
    expect(JSON.parse(docs.detailsData!).categories).toEqual(['x']);
  });
});

describe('mergeWorkflowDataPreservingPanelDocs', () => {
  it('preserves existing docs when a canvas save omits them', () => {
    const existing = {
      nodes: [{ id: 'old' }],
      prdData: { projectName: 'Keep me', sections: [] },
      notesData: '{"notes":[{"id":"1"}]}',
      detailsData: '{"name":"Keep"}',
      workflowPRDs: [{ workflowId: 'wf-1' }],
    };
    const incoming = {
      nodes: [{ id: 'new' }],
      edges: [],
    };
    const merged = mergeWorkflowDataPreservingPanelDocs(existing, incoming);
    expect(merged.nodes).toEqual([{ id: 'new' }]);
    expect(merged.prdData?.projectName).toBe('Keep me');
    expect(merged.notesData).toContain('"id":"1"');
    expect(merged.detailsData).toContain('Keep');
    expect(merged.workflowPRDs).toHaveLength(1);
  });

  it('preserves docs when incoming explicitly sets them to undefined via spread holes', () => {
    const existing = { prdData: { projectName: 'A' }, notesData: 'n' };
    const incoming = { nodes: [], prdData: undefined };
    const merged = mergeWorkflowDataPreservingPanelDocs(existing, incoming);
    expect(merged.prdData?.projectName).toBe('A');
    expect(merged.notesData).toBe('n');
  });

  it('allows explicit null clears (document/panel-docs delete path)', () => {
    const existing = { prdData: { projectName: 'A' }, notesData: 'n' };
    const incoming = { prdData: null, notesData: null };
    const merged = mergeWorkflowDataPreservingPanelDocs(existing, incoming);
    expect(merged.prdData).toBeNull();
    expect(merged.notesData).toBeNull();
  });

  it('takes present incoming docs over existing', () => {
    const existing = { detailsData: '{"name":"old"}' };
    const incoming = { detailsData: '{"name":"new"}', nodes: [] };
    const merged = mergeWorkflowDataPreservingPanelDocs(existing, incoming);
    expect(merged.detailsData).toContain('new');
  });
});

describe('pickPresentPanelDocs', () => {
  it('omits null/empty values so merges can preserve server docs', () => {
    expect(
      pickPresentPanelDocs({
        prdData: null,
        workflowPRDs: [],
        notesData: '',
        detailsData: '{"name":"x"}',
      }),
    ).toEqual({ detailsData: '{"name":"x"}' });
  });
});
