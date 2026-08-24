/**
 * Project-panel documentation living inside `saved_projects.workflowData`.
 *
 * These fields are the system of record for what shared viewers see in the
 * Project panel. They are independent of the canvas snapshot (nodes/edges): a
 * canvas-only save must never erase them, and a docs-only edit must be
 * persistable without requiring a canvas change.
 *
 * Flat keys are canonical. Nested `workflowData.documentation.*` exists only
 * for `.kiteframe` v2.1.0 imports; share/view reads fall back to it.
 */

import { readProjectPrd, readWorkflowPrds } from './documents';

/** Flat keys stored on `workflowData` for share + cloud sync. */
export const PANEL_DOC_KEYS = [
  'prdData',
  'workflowPRDs',
  'notesData',
  'detailsData',
] as const;

export type PanelDocKey = (typeof PANEL_DOC_KEYS)[number];

export interface PanelDocsBundle {
  prdData: any | null;
  workflowPRDs: any[] | null;
  notesData: string | null;
  detailsData: string | null;
}

function nestedDocumentation(workflowData: any): any {
  return workflowData && typeof workflowData === 'object'
    ? workflowData.documentation
    : undefined;
}

/**
 * Normalize nested overview blobs into the `detailsData` JSON string the
 * Project Overview section and share viewer already understand.
 */
function detailsFromNested(doc: any): string | null {
  if (!doc || typeof doc !== 'object') return null;
  const overview = doc.projectOverview ?? doc.details ?? doc.overview;
  if (overview == null) return null;
  if (typeof overview === 'string') return overview;
  try {
    return JSON.stringify(overview);
  } catch {
    return null;
  }
}

function notesFromNested(doc: any): string | null {
  if (!doc || typeof doc !== 'object') return null;
  const notes = doc.notes ?? doc.projectNotes ?? doc.notesData;
  if (notes == null) return null;
  if (typeof notes === 'string') return notes;
  try {
    return JSON.stringify(notes);
  } catch {
    return null;
  }
}

/**
 * Extract the documentation payload the share/view APIs and live updates must
 * surface. Prefers flat keys; falls back to nested `.kiteframe` documentation.
 */
export function extractSharePanelDocs(workflowData: any): PanelDocsBundle {
  const doc = nestedDocumentation(workflowData);
  const prdData = readProjectPrd(workflowData);
  const workflowPRDsList = readWorkflowPrds(workflowData);
  const flatNotes =
    typeof workflowData?.notesData === 'string' ? workflowData.notesData : null;
  const flatDetails =
    typeof workflowData?.detailsData === 'string' ? workflowData.detailsData : null;

  return {
    prdData: prdData ?? null,
    workflowPRDs: workflowPRDsList.length > 0 ? workflowPRDsList : null,
    notesData: flatNotes ?? notesFromNested(doc),
    detailsData: flatDetails ?? detailsFromNested(doc),
  };
}

/**
 * Merge an incoming `workflowData` patch into an existing blob without letting
 * a canvas-only (or docs-empty) save erase documentation the server already
 * holds.
 *
 * Rules per panel-doc key:
 *   - key absent / `undefined` on incoming → keep existing
 *   - key present (including explicit `null`) → take incoming
 *
 * Callers that mean "I don't know about docs" must omit the keys. Callers that
 * mean "clear this document" must send `null` (the addressable document PUT
 * path does this for PRDs).
 */
export function mergeWorkflowDataPreservingPanelDocs(
  existing: any,
  incoming: any,
): any {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...existing }
      : {};
  const patch =
    incoming && typeof incoming === 'object' && !Array.isArray(incoming)
      ? incoming
      : {};

  const merged: Record<string, unknown> = { ...base, ...patch };

  for (const key of PANEL_DOC_KEYS) {
    if (!(key in patch) || patch[key] === undefined) {
      if (key in base) merged[key] = base[key];
      else delete merged[key];
    }
  }

  return merged;
}

/**
 * Build a partial docs object for a cloud save: only keys with a real value.
 * Omitting empty keys lets `mergeWorkflowDataPreservingPanelDocs` keep the
 * server copy when the author's localStorage simply has nothing for that key
 * (e.g. wrong project id, fresh tab) rather than wiping shared docs.
 */
export function pickPresentPanelDocs(docs: {
  prdData?: any | null;
  workflowPRDs?: any[] | null;
  notesData?: string | null;
  detailsData?: string | null;
}): Partial<PanelDocsBundle> {
  const out: Partial<PanelDocsBundle> = {};
  if (docs.prdData != null) out.prdData = docs.prdData;
  if (Array.isArray(docs.workflowPRDs) && docs.workflowPRDs.length > 0) {
    out.workflowPRDs = docs.workflowPRDs;
  }
  if (typeof docs.notesData === 'string' && docs.notesData.length > 0) {
    out.notesData = docs.notesData;
  }
  if (typeof docs.detailsData === 'string' && docs.detailsData.length > 0) {
    out.detailsData = docs.detailsData;
  }
  return out;
}

/** Shape used when broadcasting `share_update` / building `/api/view` docs. */
export function shareUpdateDocsFromWorkflowData(workflowData: any): PanelDocsBundle {
  return extractSharePanelDocs(workflowData);
}
