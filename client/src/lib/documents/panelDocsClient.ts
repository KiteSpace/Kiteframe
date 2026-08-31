/**
 * Debounced client for Project panel notes / overview persistence.
 *
 * PRDs already have `/api/project/:uuid/documents/:docId`. Notes and overview
 * details share the same `workflowData` blob but historically only rode along
 * on full cloud saves — which meant a docs-only edit could stay in localStorage
 * until the next canvas change, leaving shared viewers stale.
 *
 * This module posts to `PUT /api/project/:projectUuid/panel-docs` so those
 * fields become first-class server state, independent of the canvas snapshot.
 */

import { isAddressableProject } from './documentClient';

const SAVE_DEBOUNCE_MS = 1200;

export interface PanelDocsPayload {
  notesData?: string | null;
  detailsData?: string | null;
  name?: string;
  description?: string | null;
}

interface PendingPanelDocsSave {
  projectUuid: string;
  payload: PanelDocsPayload;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingPanelDocsSave>();
const saveChains = new Map<string, Promise<unknown>>();

// Generic in the result type because callers want different things back:
// runSave discards the outcome, while savePanelDocsNow reports whether the
// write succeeded.
function enqueue<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prior = saveChains.get(key) ?? Promise.resolve();
  const run = prior.then(fn, fn);
  const settled = run.catch(() => undefined);
  saveChains.set(key, settled);
  void settled.then(() => {
    if (saveChains.get(key) === settled) saveChains.delete(key);
  });
  return run;
}

async function putPanelDocs(
  projectUuid: string,
  payload: PanelDocsPayload,
): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/project/${encodeURIComponent(projectUuid)}/panel-docs`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      console.warn('[panel-docs] save rejected', res.status, projectUuid);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function cancelPending(projectUuid: string): void {
  const existing = pending.get(projectUuid);
  if (existing) {
    clearTimeout(existing.timer);
    pending.delete(projectUuid);
  }
}

function runSave(projectUuid: string): Promise<void> {
  const entry = pending.get(projectUuid);
  if (!entry) return Promise.resolve();
  cancelPending(projectUuid);
  return enqueue(projectUuid, () => putPanelDocs(entry.projectUuid, entry.payload).then(() => undefined));
}

/**
 * Queue a panel-docs save for an addressable project. Latest payload wins.
 * No-ops for local tab ids / share UUIDs used as viewer keys — those are not
 * projectUuid and must not hit the owner-only endpoint.
 */
export function schedulePanelDocsSave(
  projectUuid: string | undefined | null,
  payload: PanelDocsPayload,
): void {
  if (!isAddressableProject(projectUuid)) return;
  const key = projectUuid as string;
  const existing = pending.get(key);
  if (existing) clearTimeout(existing.timer);
  const merged: PanelDocsPayload = { ...(existing?.payload ?? {}), ...payload };
  pending.set(key, {
    projectUuid: key,
    payload: merged,
    timer: setTimeout(() => void runSave(key), SAVE_DEBOUNCE_MS),
  });
}

export function savePanelDocsNow(
  projectUuid: string | undefined | null,
  payload: PanelDocsPayload,
): Promise<boolean> {
  if (!isAddressableProject(projectUuid)) return Promise.resolve(false);
  const key = projectUuid as string;
  cancelPending(key);
  return enqueue(key, () => putPanelDocs(key, payload));
}

export function flushPanelDocsSaves(): Promise<void[]> {
  return Promise.all(Array.from(pending.keys(), (key) => runSave(key)));
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    void flushPanelDocsSaves();
  });
}
