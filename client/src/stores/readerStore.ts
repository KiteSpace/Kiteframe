/**
 * Which document the reader pane is showing, if any.
 *
 * The reader is mounted once next to the canvas, but it is opened from places
 * far away from it — an artifact card inside the KiteAI chat, the Project tab's
 * document header. A module-level store keeps that a one-line call from
 * anywhere instead of threading a callback down through the whole rail.
 *
 * Deliberately not persisted: reopening a project should show the canvas, not
 * whatever document happened to be open when the tab was last closed. What
 * *does* survive a reload is the artifact card in the transcript, which is the
 * durable way back into the document.
 */

import { useSyncExternalStore } from 'react';
import { buildDocId, type DocKind } from '@shared/documents';

export type ReaderDocKind = DocKind | 'note' | 'prompt-conversation';

export interface ReaderTarget {
  docKind: ReaderDocKind;
  /** Required for `workflow-prd`. */
  workflowId?: string;
  /** Required for an individually addressable project note. */
  noteId?: string;
  /** Required for a transcript-backed prompt conversation. */
  conversationId?: string;
  /** Section to reveal on open. */
  sectionId?: string;
  /**
   * Bumped on every open so re-opening the same document (or the same section)
   * still re-scrolls. Without it, clicking an already-open artifact card is a
   * no-op and reads as a broken button.
   */
  openedAt: number;
}

/**
 * Fired by the right rail whenever its width or collapsed state changes.
 *
 * The reader's compress-or-overlay decision depends on how much room the rail
 * has left it, and a flex sibling's resize does not notify anyone: the row and
 * the reader's own slot both keep their size when only the rail changes. So the
 * rail says so explicitly rather than the reader trying to observe it.
 */
export const RAIL_GEOMETRY_EVENT = 'kiteframe:rail-geometry';

/** Announce a rail width/collapse change to the reader. */
export function notifyRailGeometryChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(RAIL_GEOMETRY_EVENT));
}

type Listener = () => void;

let target: ReaderTarget | null = null;
const listeners = new Set<Listener>();
type NavigationGuard = (next: ReaderTarget | null) => boolean;
let navigationGuard: NavigationGuard | null = null;

function emit() {
  listeners.forEach(l => {
    try {
      l();
    } catch (error) {
      console.warn('[readerStore] listener failed', error);
    }
  });
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ReaderTarget | null {
  return target;
}

/**
 * Open a document in the reader.
 *
 * Targets are validated here rather than at each call site: they arrive from a
 * URL the user can type and from artifact records rehydrated out of a
 * localStorage transcript that may predate the current shape. A workflow PRD
 * without a workflow id has no addressable document — `buildDocId` throws on
 * one — so it is refused rather than allowed to reach the pane.
 */
function validateTarget(next: Omit<ReaderTarget, 'openedAt'>): ReaderTarget | null {
  if (
    next.docKind !== 'project-prd' &&
    next.docKind !== 'workflow-prd' &&
    next.docKind !== 'note' &&
    next.docKind !== 'prompt-conversation'
  ) {
    console.warn('[readerStore] ignoring unknown document kind', next.docKind);
    return null;
  }
  if (next.docKind === 'workflow-prd' && !next.workflowId) {
    console.warn('[readerStore] ignoring workflow document with no workflow id');
    return null;
  }
  if (next.docKind === 'note' && !next.noteId) {
    console.warn('[readerStore] ignoring note with no note id');
    return null;
  }
  if (next.docKind === 'prompt-conversation' && !next.conversationId) {
    console.warn('[readerStore] ignoring prompt conversation with no conversation id');
    return null;
  }
  return { ...next, openedAt: Date.now() };
}

function setTarget(next: ReaderTarget): void {
  target = next;
  emit();
}

export function openInReader(next: Omit<ReaderTarget, 'openedAt'>): boolean {
  const validated = validateTarget(next);
  if (!validated) return false;
  if (navigationGuard?.(validated)) return true;
  setTarget(validated);
  return true;
}

export function closeReader(): void {
  if (target === null) return;
  if (navigationGuard?.(null)) return;
  target = null;
  emit();
}

/** Complete a reader transition after the reader itself resolved unsaved work. */
export function forceOpenInReader(next: Omit<ReaderTarget, 'openedAt'>): boolean {
  const validated = validateTarget(next);
  if (!validated) return false;
  setTarget(validated);
  return true;
}

/** Close after the reader itself resolved unsaved work. */
export function forceCloseReader(): void {
  if (target === null) return;
  target = null;
  emit();
}

/** Install one active-draft transition interceptor, returning an unregister function. */
export function setReaderNavigationGuard(guard: NavigationGuard): () => void {
  navigationGuard = guard;
  return () => {
    if (navigationGuard === guard) navigationGuard = null;
  };
}

/** The document currently open in the reader, or null when it is closed. */
export function useReaderTarget(): ReaderTarget | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/** Whether a specific document is the one the reader is showing. */
export function useIsOpenInReader(
  docKind: ReaderDocKind,
  workflowId?: string,
  noteId?: string,
  conversationId?: string,
): boolean {
  const current = useReaderTarget();
  if (!current) return false;
  return current.docKind === docKind
    && (current.workflowId ?? undefined) === (workflowId ?? undefined)
    && (current.noteId ?? undefined) === (noteId ?? undefined)
    && (current.conversationId ?? undefined) === (conversationId ?? undefined);
}

/** Stable id for the document a target addresses. */
export function targetDocId(
  t: Pick<ReaderTarget, 'docKind' | 'workflowId' | 'noteId' | 'conversationId'>,
): string {
  if (t.docKind === 'note') return `note:${t.noteId || ''}`;
  if (t.docKind === 'prompt-conversation') return `prompt-conversation:${t.conversationId || ''}`;
  return buildDocId(t.docKind, t.workflowId);
}
