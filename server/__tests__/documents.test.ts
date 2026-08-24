import { describe, it, expect } from 'vitest';
import {
  buildDocId,
  buildDocumentPayload,
  isSameDocumentContent,
  listDocuments,
  parseDocId,
  readDocumentContent,
  resolveDocumentUpdatedAt,
  stampUpdatedAt,
  writeDocumentContent,
} from '@shared/documents';

const section = (id: string, content = 'body') => ({ id, title: id, content });

const projectPrd = (over: Record<string, any> = {}) => ({
  projectId: 'p1',
  projectName: 'Acme',
  sections: [section('overview')],
  manualEditedAt: {},
  version: 1,
  generatedAt: 1_700_000_000_000,
  ...over,
});

const workflowPrd = (workflowId: string, over: Record<string, any> = {}) => ({
  workflowId,
  workflowName: `WF ${workflowId}`,
  sections: [section('goals')],
  manualEditedAt: {},
  version: 1,
  generatedAt: 1_700_000_000_000,
  ...over,
});

describe('document ids', () => {
  it('round-trips both kinds', () => {
    expect(parseDocId(buildDocId('project-prd'))).toEqual({ docKind: 'project-prd' });
    expect(parseDocId(buildDocId('workflow-prd', 'wf-1'))).toEqual({
      docKind: 'workflow-prd',
      workflowId: 'wf-1',
    });
  });

  it('keeps a workflow id that itself contains the separator intact', () => {
    // Workflow ids are not guaranteed to be separator-free; splitting on every
    // ':' would silently address a different (or non-existent) document.
    const id = buildDocId('workflow-prd', 'wf:with:colons');
    expect(parseDocId(id)).toEqual({ docKind: 'workflow-prd', workflowId: 'wf:with:colons' });
  });

  it('rejects unknown, empty and workflow-less ids rather than guessing', () => {
    expect(parseDocId('')).toBeNull();
    expect(parseDocId('notes')).toBeNull();
    expect(parseDocId('workflow-prd')).toBeNull();
    expect(parseDocId('workflow-prd:')).toBeNull();
  });

  it('refuses to build a workflow id without a workflow', () => {
    expect(() => buildDocId('workflow-prd')).toThrow();
  });
});

describe('reading documents out of workflowData', () => {
  it('reads the flat shape', () => {
    const wd = { prdData: projectPrd(), workflowPRDs: [workflowPrd('wf-1')] };
    expect(readDocumentContent(wd, 'project-prd')?.projectName).toBe('Acme');
    expect(readDocumentContent(wd, 'workflow-prd', 'wf-1')?.workflowId).toBe('wf-1');
  });

  it('falls back to the nested .kiteframe documentation shape', () => {
    const wd = {
      documentation: { projectPRD: projectPrd(), workflowPRDs: [workflowPrd('wf-9')] },
    };
    expect(readDocumentContent(wd, 'project-prd')?.projectName).toBe('Acme');
    expect(readDocumentContent(wd, 'workflow-prd', 'wf-9')?.workflowId).toBe('wf-9');
  });

  it('degrades to null on malformed blobs instead of throwing', () => {
    for (const wd of [null, undefined, 'nonsense', 42, { workflowPRDs: 'not-an-array' }]) {
      expect(readDocumentContent(wd, 'project-prd')).toBeNull();
      expect(readDocumentContent(wd, 'workflow-prd', 'wf-1')).toBeNull();
    }
  });

  it('returns null for a workflow document with no workflow id', () => {
    const wd = { workflowPRDs: [workflowPrd('wf-1')] };
    expect(readDocumentContent(wd, 'workflow-prd', undefined)).toBeNull();
  });
});

describe('writing a document preserves the rest of the project', () => {
  it('never touches canvas, notes or details', () => {
    const wd = {
      nodes: [{ id: 'n1' }],
      edges: [{ id: 'e1' }],
      canvasObjects: [{ id: 'c1' }],
      notesData: { a: 'note' },
      detailsData: { b: 'detail' },
      viewport: { x: 1, y: 2, zoom: 3 },
    };
    const next = writeDocumentContent(wd, 'project-prd', undefined, projectPrd());

    expect(next.nodes).toEqual(wd.nodes);
    expect(next.edges).toEqual(wd.edges);
    expect(next.canvasObjects).toEqual(wd.canvasObjects);
    expect(next.notesData).toEqual(wd.notesData);
    expect(next.detailsData).toEqual(wd.detailsData);
    expect(next.viewport).toEqual(wd.viewport);
    expect(next.prdData.projectName).toBe('Acme');
  });

  it('does not mutate the input blob', () => {
    const wd = { prdData: projectPrd({ projectName: 'Original' }) };
    writeDocumentContent(wd, 'project-prd', undefined, projectPrd({ projectName: 'Changed' }));
    expect(wd.prdData.projectName).toBe('Original');
  });

  it('replaces only the addressed workflow document', () => {
    const wd = { workflowPRDs: [workflowPrd('wf-1'), workflowPrd('wf-2')] };
    const next = writeDocumentContent(
      wd,
      'workflow-prd',
      'wf-2',
      workflowPrd('wf-2', { workflowName: 'Renamed' }),
    );

    expect(next.workflowPRDs).toHaveLength(2);
    expect(next.workflowPRDs.find((p: any) => p.workflowId === 'wf-1').workflowName).toBe('WF wf-1');
    expect(next.workflowPRDs.find((p: any) => p.workflowId === 'wf-2').workflowName).toBe('Renamed');
  });

  it('adds a workflow document without disturbing the project document', () => {
    const wd = { prdData: projectPrd(), workflowPRDs: [workflowPrd('wf-1')] };
    const next = writeDocumentContent(wd, 'workflow-prd', 'wf-2', workflowPrd('wf-2'));

    expect(next.prdData.projectName).toBe('Acme');
    expect(next.workflowPRDs.map((p: any) => p.workflowId)).toEqual(['wf-1', 'wf-2']);
  });

  it('orders workflow documents canonically so a save cannot fake a content change', () => {
    // The client folds workflowPRDs into its cloud-sync signature; an unstable
    // order reads as an edit and causes save ping-pong between devices.
    const wd = { workflowPRDs: [workflowPrd('wf-c'), workflowPrd('wf-a')] };
    const next = writeDocumentContent(wd, 'workflow-prd', 'wf-b', workflowPrd('wf-b'));
    expect(next.workflowPRDs.map((p: any) => p.workflowId)).toEqual(['wf-a', 'wf-b', 'wf-c']);
  });

  it('forces the stored workflowId to match the address', () => {
    const next = writeDocumentContent(
      {},
      'workflow-prd',
      'wf-real',
      workflowPrd('wf-claimed-by-body'),
    );
    expect(next.workflowPRDs).toHaveLength(1);
    expect(next.workflowPRDs[0].workflowId).toBe('wf-real');
  });

  it('upgrades a legacy nested blob to the flat shape on first write', () => {
    const wd = { documentation: { projectPRD: projectPrd(), workflowPRDs: [workflowPrd('wf-1')] } };
    const next = writeDocumentContent(wd, 'workflow-prd', 'wf-1', workflowPrd('wf-1', { version: 2 }));

    expect(next.workflowPRDs).toHaveLength(1);
    expect(next.workflowPRDs[0].version).toBe(2);
    // The nested copy stays put so an older client still reads something.
    expect(next.documentation.projectPRD).toBeTruthy();
  });

  it('handles a null or non-object starting blob', () => {
    expect(writeDocumentContent(null, 'project-prd', undefined, projectPrd()).prdData).toBeTruthy();
    expect(writeDocumentContent('junk', 'project-prd', undefined, projectPrd()).prdData).toBeTruthy();
  });
});

describe('updatedAt resolution', () => {
  it('prefers the explicit stamp', () => {
    const iso = '2026-01-02T03:04:05.000Z';
    expect(resolveDocumentUpdatedAt(projectPrd({ updatedAt: iso }), undefined)).toBe(iso);
  });

  it('falls back to the newest manual section edit', () => {
    const newest = 1_800_000_000_000;
    const content = projectPrd({ manualEditedAt: { a: 1_700_000_000_000, b: newest } });
    expect(resolveDocumentUpdatedAt(content, undefined)).toBe(new Date(newest).toISOString());
  });

  it('falls back to generation time, then the project timestamp', () => {
    const gen = 1_700_000_000_000;
    expect(resolveDocumentUpdatedAt(projectPrd({ generatedAt: gen }), undefined)).toBe(
      new Date(gen).toISOString(),
    );

    const projectTime = new Date('2026-05-05T00:00:00.000Z');
    const bare = { sections: [] };
    expect(resolveDocumentUpdatedAt(bare, projectTime)).toBe(projectTime.toISOString());
  });

  it('never returns empty, so no document renders "Unknown"', () => {
    expect(resolveDocumentUpdatedAt({ sections: [] }, undefined)).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
  });

  it('ignores unparseable and zero timestamps', () => {
    const gen = 1_700_000_000_000;
    const content = {
      updatedAt: 'not-a-date',
      manualEditedAt: { a: 0, b: NaN },
      generatedAt: gen,
    };
    expect(resolveDocumentUpdatedAt(content, undefined)).toBe(new Date(gen).toISOString());
  });

  it('stamps without mutating the input', () => {
    const content = projectPrd();
    const when = new Date('2026-03-03T03:03:03.000Z');
    const stamped = stampUpdatedAt(content, when);

    expect(stamped.updatedAt).toBe(when.toISOString());
    expect((content as any).updatedAt).toBeUndefined();
    expect(stamped.sections).toEqual(content.sections);
  });
});

describe('content comparison ignores the save stamp', () => {
  it('treats two copies differing only by updatedAt as equal', () => {
    // Otherwise every hydrate looks like a change, writes back, and retriggers
    // auto-save — the sync flip-flop this project has hit before.
    const a = projectPrd({ updatedAt: '2026-01-01T00:00:00.000Z' });
    const b = projectPrd({ updatedAt: '2026-09-09T00:00:00.000Z' });
    expect(isSameDocumentContent(a, b)).toBe(true);
  });

  it('ignores key order but not real edits', () => {
    const a = { sections: [section('x')], version: 1 };
    const b = { version: 1, sections: [section('x')] };
    expect(isSameDocumentContent(a, b)).toBe(true);

    const edited = { sections: [section('x', 'different')], version: 1 };
    expect(isSameDocumentContent(a, edited)).toBe(false);
  });

  it('does not equate a missing document with an empty one', () => {
    expect(isSameDocumentContent(null, projectPrd())).toBe(false);
    expect(isSameDocumentContent(null, null)).toBe(true);
  });
});

describe('listing and payloads', () => {
  it('lists every document with its address', () => {
    const wd = { prdData: projectPrd(), workflowPRDs: [workflowPrd('wf-1'), workflowPrd('wf-2')] };
    const docs = listDocuments(wd, { projectName: 'Acme', projectUpdatedAt: new Date() });

    expect(docs.map((d) => d.docId)).toEqual([
      'project-prd',
      'workflow-prd:wf-1',
      'workflow-prd:wf-2',
    ]);
    expect(docs[0].sectionCount).toBe(1);
    expect(docs.every((d) => !!d.updatedAt)).toBe(true);
  });

  it('skips workflow entries with no workflow id, which have no address', () => {
    const wd = { workflowPRDs: [workflowPrd('wf-1'), { sections: [] }] };
    expect(listDocuments(wd)).toHaveLength(1);
  });

  it('returns an empty list for a project with no documents', () => {
    expect(listDocuments({ nodes: [], edges: [] })).toEqual([]);
    expect(listDocuments(null)).toEqual([]);
  });

  it('builds a payload carrying the stored content unchanged', () => {
    const stored = projectPrd({ updatedAt: '2026-02-02T00:00:00.000Z' });
    const payload = buildDocumentPayload({ prdData: stored }, 'project-prd', undefined, {
      projectName: 'Acme',
    });

    expect(payload?.docId).toBe('project-prd');
    expect(payload?.title).toBe('Acme Spec');
    expect(payload?.updatedAt).toBe('2026-02-02T00:00:00.000Z');
    expect(payload?.content).toEqual(stored);
  });

  it('returns null when the document does not exist yet', () => {
    expect(buildDocumentPayload({ nodes: [] }, 'project-prd', undefined)).toBeNull();
    expect(buildDocumentPayload({ workflowPRDs: [] }, 'workflow-prd', 'wf-1')).toBeNull();
  });
});

describe('save/load round trip', () => {
  it('reads back exactly what was written, for both kinds', () => {
    let wd: any = { nodes: [{ id: 'n1' }] };

    const p = stampUpdatedAt(projectPrd());
    wd = writeDocumentContent(wd, 'project-prd', undefined, p);
    const w = stampUpdatedAt(workflowPrd('wf-1'));
    wd = writeDocumentContent(wd, 'workflow-prd', 'wf-1', w);

    expect(readDocumentContent(wd, 'project-prd')).toEqual(p);
    expect(readDocumentContent(wd, 'workflow-prd', 'wf-1')).toEqual(w);
    expect(wd.nodes).toEqual([{ id: 'n1' }]);
  });

  it('supports deleting a document by writing null', () => {
    let wd: any = { prdData: projectPrd(), workflowPRDs: [workflowPrd('wf-1')] };
    wd = writeDocumentContent(wd, 'workflow-prd', 'wf-1', null);

    expect(readDocumentContent(wd, 'workflow-prd', 'wf-1')).toBeNull();
    expect(readDocumentContent(wd, 'project-prd')).toBeTruthy();
  });
});
