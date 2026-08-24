/**
 * Keeps one PRD document in sync between the server (system of record) and the
 * localStorage cache the panels have always read from.
 *
 * Responsibilities, in order of importance:
 *  1. On open, show the newest copy that exists — server or cache.
 *  2. Never blank a document because the server was unreachable.
 *  3. Never overwrite newer local edits with an older server copy.
 *  4. Report a real `updatedAt` so the header can stop saying "Unknown".
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isSameDocumentContent, resolveDocumentUpdatedAt, type DocKind } from '@shared/documents';
import {
  fetchDocument,
  hasPendingSave,
  isAddressableProject,
  saveDocumentNow,
  scheduleDocumentSave,
} from './documentClient';

interface Options<T> {
  projectId: string;
  docKind: DocKind;
  /** Required for `workflow-prd`. */
  workflowId?: string;
  /**
   * When false, never fetch or save — used by read-only shared viewers whose
   * `projectId` is a shareUuid (also a UUID) and must not hit owner APIs.
   */
  enabled?: boolean;
  /** Read the cached copy (localStorage). */
  readLocal: () => T | null;
  /** Write the cache. Called only when the server copy genuinely wins. */
  writeLocal: (content: T) => void;
  /** Push an adopted server copy into component state. */
  onAdoptRemote: (content: T) => void;
}

interface Result<T> {
  /** ISO timestamp of the newest known save, or null when nothing is stored. */
  updatedAt: string | null;
  /** True while the first server read for this address is in flight. */
  isHydrating: boolean;
  /**
   * Persist a document. `immediate` skips the debounce — use it for generation
   * and version restores, where the user may navigate away straight after.
   */
  persist: (content: T, opts?: { immediate?: boolean }) => void;
  /** Record a local save that the caller already wrote to the cache. */
  noteLocalSave: (content: T) => void;
}

function timeOf(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

export function useServerDocument<T>({
  projectId,
  docKind,
  workflowId,
  enabled = true,
  readLocal,
  writeLocal,
  onAdoptRemote,
}: Options<T>): Result<T> {
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);

  // Callbacks are re-created on each render by their owners. Holding them in
  // refs keeps the hydration effect keyed strictly to the document *address*,
  // so an unrelated re-render cannot re-run a fetch mid-edit.
  const readLocalRef = useRef(readLocal);
  const writeLocalRef = useRef(writeLocal);
  const onAdoptRemoteRef = useRef(onAdoptRemote);
  useEffect(() => {
    readLocalRef.current = readLocal;
    writeLocalRef.current = writeLocal;
    onAdoptRemoteRef.current = onAdoptRemote;
  });

  const addressable =
    enabled &&
    isAddressableProject(projectId) &&
    (docKind !== 'workflow-prd' || !!workflowId);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    // Start from whatever the cache knows, so the header shows a timestamp
    // immediately rather than flashing "Unknown" until the fetch lands.
    const cached = readLocalRef.current();
    setUpdatedAt(cached ? resolveDocumentUpdatedAt(cached, undefined) : null);

    if (!addressable) {
      setIsHydrating(false);
      return () => controller.abort();
    }

    // A queued save means the local copy is strictly newer than anything the
    // server can return. Hydrating now would resurrect the pre-edit document.
    if (hasPendingSave(projectId, docKind, workflowId)) {
      setIsHydrating(false);
      return () => controller.abort();
    }

    setIsHydrating(true);

    void (async () => {
      const outcome = await fetchDocument(projectId, docKind, workflowId, controller.signal);
      if (cancelled) return;
      setIsHydrating(false);

      const local = readLocalRef.current();

      // Server unreachable → the cache is the best copy we have. Keep it.
      if (outcome.status === 'unavailable') return;

      // Server has no such document. If we hold one locally (generated offline,
      // or before this sync existed), promote it so it becomes addressable.
      if (outcome.status === 'absent') {
        if (local) {
          const stamped = await saveDocumentNow(projectId, docKind, workflowId, local);
          if (!cancelled && stamped) setUpdatedAt(stamped);
        }
        return;
      }

      const remote = outcome.document;

      if (!local) {
        writeLocalRef.current(remote.content as T);
        onAdoptRemoteRef.current(remote.content as T);
        setUpdatedAt(remote.updatedAt);
        return;
      }

      // Same content: nothing to write. Writing anyway would fire the panel-docs
      // change event, which retriggers the project's cloud auto-save — the
      // hydrate/save flip-flop this codebase has been bitten by before.
      if (isSameDocumentContent(local, remote.content)) {
        setUpdatedAt(remote.updatedAt);
        return;
      }

      const localTime = timeOf(resolveDocumentUpdatedAt(local, undefined));
      const remoteTime = timeOf(remote.updatedAt);

      if (remoteTime > localTime) {
        writeLocalRef.current(remote.content as T);
        onAdoptRemoteRef.current(remote.content as T);
        setUpdatedAt(remote.updatedAt);
      } else {
        // Local is newer (or the two are indistinguishable, in which case the
        // copy the user is looking at wins). Push it up.
        const stamped = await saveDocumentNow(projectId, docKind, workflowId, local);
        if (!cancelled) setUpdatedAt(stamped ?? resolveDocumentUpdatedAt(local, undefined));
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId, docKind, workflowId, addressable]);

  const persist = useCallback(
    (content: T, opts?: { immediate?: boolean }) => {
      // Optimistic: the cache write has already happened in the caller, so the
      // header should advance even if the project is local-only or offline.
      const optimistic = new Date().toISOString();
      setUpdatedAt(optimistic);

      if (!addressable) return;

      if (opts?.immediate) {
        // Cancels any queued edit for this document — that edit is older than
        // what we are saving now, so running it afterwards would undo this.
        void saveDocumentNow(projectId, docKind, workflowId, content).then((stamped) => {
          if (stamped) setUpdatedAt(stamped);
        });
        return;
      }

      scheduleDocumentSave(projectId, docKind, workflowId, content, (stamped) => {
        if (stamped) setUpdatedAt(stamped);
      });
    },
    [addressable, projectId, docKind, workflowId],
  );

  const noteLocalSave = useCallback((content: T) => {
    setUpdatedAt(resolveDocumentUpdatedAt(content, undefined) ?? new Date().toISOString());
  }, []);

  return { updatedAt, isHydrating, persist, noteLocalSave };
}
