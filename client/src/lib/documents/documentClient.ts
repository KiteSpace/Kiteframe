/**
 * Client access to addressable project documents (PRDs).
 *
 * The server is the system of record; localStorage remains a cache so the panel
 * still renders offline, for a project that was never cloud-saved, and in the
 * moment before the first fetch resolves.
 *
 * See `shared/documents.ts` for the addressing scheme and why documents live
 * inside `workflowData` rather than a table of their own.
 */

import {
  buildDocId,
  resolveDocumentUpdatedAt,
  type DocKind,
} from '@shared/documents';

export interface RemoteDocument {
  docId: string;
  docKind: DocKind;
  workflowId?: string;
  title: string;
  updatedAt: string;
  content: any;
}

/**
 * Whether a panel `projectId` addresses a real server-side project.
 *
 * The Project Panel is keyed by `projectUuid || cloudProjectId || tabId`, so the
 * same prop can be a genuine project uuid, a numeric cloud id, a local tab id
 * like `tab-1712…`, or the literal `default`. Only the first is addressable.
 * Guessing wrong is cheap in one direction and not the other: treating a local
 * tab as addressable would fire a 404 on every keystroke of a document that can
 * never be saved anyway.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAddressableProject(projectId: string | undefined | null): boolean {
  return !!projectId && UUID_RE.test(projectId);
}

function documentUrl(projectUuid: string, docKind: DocKind, workflowId?: string): string {
  const docId = buildDocId(docKind, workflowId);
  return `/api/project/${encodeURIComponent(projectUuid)}/documents/${encodeURIComponent(docId)}`;
}

export type FetchOutcome =
  | { status: 'ok'; document: RemoteDocument }
  | { status: 'absent' } // project exists, document not generated yet
  | { status: 'unavailable' }; // offline, unauthorised, or server error

/**
 * Read one document from the server.
 *
 * `absent` and `unavailable` are deliberately distinct. "No document yet" means
 * the local cache holds nothing worth keeping either; "couldn't reach the
 * server" means the cache is the best copy available and must not be discarded.
 * Collapsing the two would blank a user's document whenever the network blipped.
 */
export async function fetchDocument(
  projectUuid: string,
  docKind: DocKind,
  workflowId?: string,
  signal?: AbortSignal,
): Promise<FetchOutcome> {
  try {
    const res = await fetch(documentUrl(projectUuid, docKind, workflowId), {
      credentials: 'include',
      signal,
    });
    if (res.status === 404) {
      // Distinguish "no such document" from "no such project": only the former
      // is a normal empty state. Both leave the cache intact, but a missing
      // project should not be reported as an empty document.
      const body = await res.json().catch(() => null);
      return body?.docId ? { status: 'absent' } : { status: 'unavailable' };
    }
    if (!res.ok) return { status: 'unavailable' };

    const body = await res.json();
    return body?.document ? { status: 'ok', document: body.document } : { status: 'absent' };
  } catch {
    return { status: 'unavailable' };
  }
}

/** Write one document to the server. Returns the new `updatedAt`, or null. */
export async function saveDocument(
  projectUuid: string,
  docKind: DocKind,
  workflowId: string | undefined,
  content: any,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(documentUrl(projectUuid, docKind, workflowId), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal,
    });
    if (!res.ok) {
      console.warn('[documents] save rejected', res.status, buildDocId(docKind, workflowId));
      return null;
    }
    const body = await res.json();
    return body?.document?.updatedAt ?? null;
  } catch {
    // Non-fatal: the localStorage cache still holds the edit and the project's
    // own cloud auto-save carries documents too, so nothing is lost.
    return null;
  }
}

// ─── Debounced saving ────────────────────────────────────────────────────────
//
// Section edits fire per keystroke-batch. Saving each one would hammer a
// read-modify-write of the whole project blob, so writes are coalesced per
// document. Generation, by contrast, saves immediately — it is a single
// deliberate act and the user may navigate away straight after it.

const SAVE_DEBOUNCE_MS = 1200;

interface PendingSave {
  projectUuid: string;
  docKind: DocKind;
  workflowId?: string;
  content: any;
  timer: ReturnType<typeof setTimeout>;
  onSaved?: (updatedAt: string | null) => void;
}

const pendingSaves = new Map<string, PendingSave>();

/**
 * In-flight ordering, one chain per document.
 *
 * Without it, a debounced save that is already on the wire can land *after* a
 * later immediate save (generation, restore) and overwrite it with older text —
 * and because the server stamps whichever arrives last, the stale copy then
 * looks newer than the good one and wins every subsequent hydration too.
 * Chaining makes writes to one document apply in the order they were made.
 */
const saveChains = new Map<string, Promise<unknown>>();

function pendingKey(projectUuid: string, docKind: DocKind, workflowId?: string): string {
  return `${projectUuid}::${buildDocId(docKind, workflowId)}`;
}

function enqueue<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = saveChains.get(key) ?? Promise.resolve();
  // Run regardless of whether the predecessor resolved or rejected: one failed
  // save must not strand every later save for the same document.
  const run = prior.then(fn, fn);
  const settled = run.catch(() => undefined);
  saveChains.set(key, settled);
  void settled.then(() => {
    // Clear only if nothing queued behind this one, so the map cannot grow
    // without bound. Compare against the value actually stored.
    if (saveChains.get(key) === settled) saveChains.delete(key);
  });
  return run;
}

/** Drop a queued save. Used when a newer save supersedes it. */
function cancelPending(key: string): void {
  const existing = pendingSaves.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    pendingSaves.delete(key);
  }
}

function runSave(key: string): Promise<void> {
  const pending = pendingSaves.get(key);
  if (!pending) return Promise.resolve();
  cancelPending(key);

  return enqueue(key, async () => {
    const updatedAt = await saveDocument(
      pending.projectUuid,
      pending.docKind,
      pending.workflowId,
      pending.content,
    );
    pending.onSaved?.(updatedAt);
  });
}

/**
 * Queue a document save, replacing any save still waiting for the same
 * document. The latest content wins — an intermediate keystroke has no value
 * once a newer one exists.
 */
export function scheduleDocumentSave(
  projectUuid: string,
  docKind: DocKind,
  workflowId: string | undefined,
  content: any,
  onSaved?: (updatedAt: string | null) => void,
): void {
  const key = pendingKey(projectUuid, docKind, workflowId);
  cancelPending(key);

  pendingSaves.set(key, {
    projectUuid,
    docKind,
    workflowId,
    content,
    onSaved,
    timer: setTimeout(() => void runSave(key), SAVE_DEBOUNCE_MS),
  });
}

/**
 * Save now, discarding any queued save for the same document.
 *
 * The discard matters: a queued edit is always older than the content being
 * saved here, so letting it run afterwards would undo this save.
 */
export function saveDocumentNow(
  projectUuid: string,
  docKind: DocKind,
  workflowId: string | undefined,
  content: any,
): Promise<string | null> {
  const key = pendingKey(projectUuid, docKind, workflowId);
  cancelPending(key);
  return enqueue(key, () => saveDocument(projectUuid, docKind, workflowId, content));
}

/** Flush every queued save immediately (navigating away, closing a document). */
export function flushDocumentSaves(): Promise<void[]> {
  return Promise.all(Array.from(pendingSaves.keys(), (key) => runSave(key)));
}

/** Whether a save is still queued — used to avoid hydrating over local edits. */
export function hasPendingSave(
  projectUuid: string,
  docKind: DocKind,
  workflowId?: string,
): boolean {
  return pendingSaves.has(pendingKey(projectUuid, docKind, workflowId));
}

// A queued edit must not be lost to a reload or a tab close. `pagehide` covers
// both, and fires on mobile Safari where `beforeunload` does not.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    void flushDocumentSaves();
  });
}

/** Local "last updated" for a cached document, for last-write-wins comparison. */
export function localUpdatedAt(content: any): string | null {
  if (!content) return null;
  return resolveDocumentUpdatedAt(content, undefined);
}
