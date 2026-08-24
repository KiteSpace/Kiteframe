/**
 * Addressing and storage contract for project documents (PRDs).
 *
 * Documents are *not* a separate table. They live inside `savedProjects.workflowData`
 * under the long-standing `prdData` (project PRD) and `workflowPRDs` (array of
 * per-workflow PRDs) keys. That shape is load-bearing in three places already:
 * the `.kiteframe` v2.1.0 export, the share-link payload, and the view-only
 * viewer. Introducing a second store would mean dual-writing the same content
 * to two places, which is exactly how earlier sync bugs in this project started.
 *
 * What this module adds on top is an *address*: a stable id derived from
 * `{ projectUuid, docKind, workflowId? }` so a reader pane or a chat artifact
 * card can point at one document without loading and understanding the whole
 * project blob.
 *
 * Shared by client and server so both agree on ids, extraction and merging.
 */

export type DocKind = 'project-prd' | 'workflow-prd';

export const DOC_KINDS: DocKind[] = ['project-prd', 'workflow-prd'];

/** Separator between a doc kind and its workflow id inside a doc id. */
const DOC_ID_SEP = ':';

export interface DocumentAddress {
  projectUuid: string;
  docKind: DocKind;
  /** Required for `workflow-prd`, absent for `project-prd`. */
  workflowId?: string;
}

/** Metadata-only view, for listing documents without shipping their content. */
export interface DocumentMeta {
  docId: string;
  docKind: DocKind;
  workflowId?: string;
  title: string;
  /** ISO 8601. Never null — callers render it directly. */
  updatedAt: string;
  sectionCount: number;
}

export interface DocumentPayload extends DocumentMeta {
  /** The `ProjectPRD` / `WorkflowPRD` object, unchanged from its stored form. */
  content: any;
}

/**
 * Build the id for a document *within* a project. The full address is
 * `{ projectUuid, docId }` — the project uuid is carried by the URL path
 * rather than baked into the id, so the same document keeps its id if a
 * project is ever copied.
 */
export function buildDocId(docKind: DocKind, workflowId?: string): string {
  if (docKind === 'workflow-prd') {
    if (!workflowId) throw new Error('buildDocId: workflow-prd requires a workflowId');
    return `workflow-prd${DOC_ID_SEP}${workflowId}`;
  }
  return 'project-prd';
}

/** Inverse of `buildDocId`. Returns null for anything unrecognised. */
export function parseDocId(docId: string): { docKind: DocKind; workflowId?: string } | null {
  if (!docId) return null;
  if (docId === 'project-prd') return { docKind: 'project-prd' };

  const prefix = `workflow-prd${DOC_ID_SEP}`;
  if (docId.startsWith(prefix)) {
    // A workflow id may itself contain the separator, so split once only.
    const workflowId = docId.slice(prefix.length);
    return workflowId ? { docKind: 'workflow-prd', workflowId } : null;
  }
  return null;
}

// ─── workflowData accessors ──────────────────────────────────────────────────
//
// `workflowData` is untyped jsonb that has accumulated several generations of
// shape. Everything below treats it defensively: a malformed or legacy blob
// must degrade to "no document", never throw, because these run inside request
// handlers serving the whole project.

/** Legacy `.kiteframe` imports nest documentation instead of flattening it. */
function nestedDocumentation(workflowData: any): any {
  return workflowData && typeof workflowData === 'object' ? workflowData.documentation : undefined;
}

export function readProjectPrd(workflowData: any): any | null {
  if (!workflowData || typeof workflowData !== 'object') return null;
  return workflowData.prdData ?? nestedDocumentation(workflowData)?.projectPRD ?? null;
}

export function readWorkflowPrds(workflowData: any): any[] {
  if (!workflowData || typeof workflowData !== 'object') return [];
  const raw = workflowData.workflowPRDs ?? nestedDocumentation(workflowData)?.workflowPRDs ?? null;
  return Array.isArray(raw) ? raw.filter((p) => p && typeof p === 'object') : [];
}

export function readWorkflowPrd(workflowData: any, workflowId: string): any | null {
  return readWorkflowPrds(workflowData).find((p) => p?.workflowId === workflowId) ?? null;
}

/**
 * Pull one document's content out of a project blob by address.
 * Returns null when the project has no such document yet.
 */
export function readDocumentContent(
  workflowData: any,
  docKind: DocKind,
  workflowId?: string,
): any | null {
  if (docKind === 'project-prd') return readProjectPrd(workflowData);
  if (!workflowId) return null;
  return readWorkflowPrd(workflowData, workflowId);
}

/**
 * Merge one document's content back into a project blob, returning a new blob.
 *
 * Only the addressed document is touched — every other key of `workflowData`
 * (nodes, edges, notes, the other PRDs) is carried through untouched, so a
 * document save can never truncate the canvas.
 *
 * Writes to the flat `prdData` / `workflowPRDs` keys. A legacy blob that only
 * had nested `documentation` is thereby upgraded to the canonical flat shape on
 * first write; the nested copy is left alone so an older client reading it
 * still sees something rather than nothing.
 */
export function writeDocumentContent(
  workflowData: any,
  docKind: DocKind,
  workflowId: string | undefined,
  content: any,
): any {
  const base = workflowData && typeof workflowData === 'object' ? { ...workflowData } : {};

  if (docKind === 'project-prd') {
    base.prdData = content ?? null;
    return base;
  }

  if (!workflowId) throw new Error('writeDocumentContent: workflow-prd requires a workflowId');

  const existing = readWorkflowPrds(workflowData);
  const next = existing.filter((p) => p?.workflowId !== workflowId);
  if (content) next.push({ ...content, workflowId });

  // Canonical ordering by workflow id. The client folds this array into a cloud
  // sync signature, so an unstable order would read as a content change and
  // cause pointless save round-trips between devices.
  next.sort((a, b) => String(a?.workflowId ?? '').localeCompare(String(b?.workflowId ?? '')));

  base.workflowPRDs = next.length > 0 ? next : null;
  return base;
}

// ─── Timestamps ──────────────────────────────────────────────────────────────

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return null;
}

/**
 * Best available "last updated" for a document.
 *
 * Preference order:
 *  1. `content.updatedAt` — stamped by this module on every document save.
 *  2. The newest manual section edit — a document written before per-document
 *     stamping existed still knows when a human last touched a section.
 *  3. `content.generatedAt` — when the AI produced it.
 *  4. The project's own `updatedAt`, so the field is never empty.
 *
 * Without the fallbacks every pre-existing document would render "Updated:
 * Unknown" forever, since nothing back-filled the new field.
 */
export function resolveDocumentUpdatedAt(content: any, projectUpdatedAt?: unknown): string {
  const direct = toIso(content?.updatedAt);
  if (direct) return direct;

  const manualEdits = content?.manualEditedAt;
  if (manualEdits && typeof manualEdits === 'object') {
    const stamps = Object.values(manualEdits)
      .map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0))
      .filter((v) => v > 0);
    if (stamps.length > 0) {
      const newest = toIso(Math.max(...stamps));
      if (newest) return newest;
    }
  }

  return toIso(content?.generatedAt) ?? toIso(projectUpdatedAt) ?? new Date().toISOString();
}

/** Stamp a document as saved now. Returns a new object; input is untouched. */
export function stampUpdatedAt(content: any, when: Date = new Date()): any {
  if (!content || typeof content !== 'object') return content;
  return { ...content, updatedAt: when.toISOString() };
}

/**
 * Compare two documents ignoring the save stamp.
 *
 * Used to decide whether a server copy is genuinely different from the local
 * cache. Without ignoring `updatedAt`, every hydrate would look like a change
 * and write back, which in turn re-triggers auto-save — the flip-flop loop that
 * cloud sync in this project is already careful to avoid.
 */
export function isSameDocumentContent(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const { updatedAt: _a, ...restA } = a as Record<string, unknown>;
  const { updatedAt: _b, ...restB } = b as Record<string, unknown>;
  return stableStringify(restA) === stableStringify(restB);
}

/** JSON with object keys sorted, so key order can't fake a difference. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (val as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return val;
  });
}

// ─── Listing ─────────────────────────────────────────────────────────────────

function sectionCountOf(content: any): number {
  return Array.isArray(content?.sections) ? content.sections.length : 0;
}

export function projectPrdTitle(content: any, projectName?: string): string {
  const name = content?.projectName || projectName || 'Project';
  return `${name} Spec`;
}

export function workflowPrdTitle(content: any): string {
  const name = content?.workflowName || 'Workflow';
  return `${name} Spec`;
}

/** Every document a project currently holds, as metadata only. */
export function listDocuments(
  workflowData: any,
  opts: { projectName?: string; projectUpdatedAt?: unknown } = {},
): DocumentMeta[] {
  const docs: DocumentMeta[] = [];

  const projectPrd = readProjectPrd(workflowData);
  if (projectPrd) {
    docs.push({
      docId: buildDocId('project-prd'),
      docKind: 'project-prd',
      title: projectPrdTitle(projectPrd, opts.projectName),
      updatedAt: resolveDocumentUpdatedAt(projectPrd, opts.projectUpdatedAt),
      sectionCount: sectionCountOf(projectPrd),
    });
  }

  for (const prd of readWorkflowPrds(workflowData)) {
    if (!prd?.workflowId) continue;
    docs.push({
      docId: buildDocId('workflow-prd', prd.workflowId),
      docKind: 'workflow-prd',
      workflowId: prd.workflowId,
      title: workflowPrdTitle(prd),
      updatedAt: resolveDocumentUpdatedAt(prd, opts.projectUpdatedAt),
      sectionCount: sectionCountOf(prd),
    });
  }

  return docs;
}

/** Assemble the full payload for one document. */
export function buildDocumentPayload(
  workflowData: any,
  docKind: DocKind,
  workflowId: string | undefined,
  opts: { projectName?: string; projectUpdatedAt?: unknown } = {},
): DocumentPayload | null {
  const content = readDocumentContent(workflowData, docKind, workflowId);
  if (!content) return null;

  return {
    docId: buildDocId(docKind, workflowId),
    docKind,
    workflowId,
    title:
      docKind === 'project-prd'
        ? projectPrdTitle(content, opts.projectName)
        : workflowPrdTitle(content),
    updatedAt: resolveDocumentUpdatedAt(content, opts.projectUpdatedAt),
    sectionCount: sectionCountOf(content),
    content,
  };
}
