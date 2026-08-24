/**
 * The reader pane — a dedicated column for reading and editing one document.
 *
 * The right rail can show the same documents, but it is a 400-600px column
 * shared with four other tabs: fine for skimming a section, hostile to reading
 * a spec end to end. The reader gives a document its own width, a contents nav
 * and reading typography, without taking it out of the editor.
 *
 * Two things about the geometry are deliberate and easy to get wrong:
 *
 *  - The text measure is fixed at ~400px no matter how wide the pane is. Extra
 *    width goes to the contents nav and the margins. A 700px line length is
 *    worse to read than a 400px one, so "wider" must not mean "longer lines".
 *
 *  - Below a certain total width the pane stops compressing the canvas and
 *    overlays it instead. Compressing forever eventually leaves a canvas too
 *    narrow to see anything on, at which point the editor has silently become
 *    a document viewer.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { List, X, FileText, PanelLeftClose, PanelLeftOpen, Sparkles, Edit3, Save, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  closeReader,
  forceCloseReader,
  forceOpenInReader,
  openInReader,
  setReaderNavigationGuard,
  targetDocId,
  type ReaderTarget,
  useReaderTarget,
  RAIL_GEOMETRY_EVENT,
} from '@/stores/readerStore';
import { docSectionDomId, type ReaderDocMeta } from '@/components/docs';
import { ProjectPRDSection, WorkflowPRDSection } from '@/components/panels/ProjectPanel/sections';
import { detectWorkflowSummaries } from '@/lib/kiteframe/utils/workflowSummaries';
import { formatDate } from '@/lib/utils/formatDate';
import type { Node, Edge } from '@/lib/kiteframe/types';
import { createProjectNote, loadProjectNotes, saveProjectNotes, type ProjectNote } from '@/lib/projectNotes';
import { findPromptConversation, readTranscript, subscribeTranscript, type TranscriptEntry } from '@/lib/kiteaiTranscript';

/**
 * Width budget, in px.
 *
 * MIN and the nav threshold are derived from the measure rather than picked:
 *   padding 24 + nav + gap 24 + measure 400 + padding 24 (+4 for the scrollbar)
 * gives 516 with the 40px numeral strip and 638 with the full 162px nav. So a
 * pane narrower than 638 cannot show the full nav *and* a full-width measure —
 * and the measure is the thing that must not yield.
 */
const MIN_READER_WIDTH = 516;
const MAX_READER_WIDTH = 800;
const DEFAULT_READER_WIDTH = 660;
const NAV_COLLAPSE_WIDTH = 638;
const NAV_FULL_WIDTH = 162;
const NAV_STRIP_WIDTH = 40;

/** Canvas that must stay visible before the pane switches to overlaying it. */
const MIN_CANVAS_WIDTH = 320;

const WIDTH_KEY_PREFIX = 'kiteframe-reader-width-';
const NAV_PREF_KEY = 'kiteframe-reader-contents-open';

function clampReaderWidth(width: number): number {
  const fallback = Number.isFinite(width) ? width : DEFAULT_READER_WIDTH;
  // Never wider than the window itself, however wide the stored value is.
  const viewportCap =
    typeof window === 'undefined' ? MAX_READER_WIDTH : Math.max(MIN_READER_WIDTH, window.innerWidth - 80);
  return Math.max(MIN_READER_WIDTH, Math.min(MAX_READER_WIDTH, Math.min(viewportCap, fallback)));
}

function readStoredWidth(projectId: string): number {
  if (typeof window === 'undefined') return DEFAULT_READER_WIDTH;
  try {
    const saved = localStorage.getItem(`${WIDTH_KEY_PREFIX}${projectId}`);
    return clampReaderWidth(saved ? parseInt(saved, 10) : DEFAULT_READER_WIDTH);
  } catch {
    return DEFAULT_READER_WIDTH;
  }
}

interface ContentsNavProps {
  sections: { id: string; title: string }[];
  activeSection: string | null;
  collapsed: boolean;
  onSelect: (sectionId: string) => void;
}

/**
 * Contents nav. Collapsed it becomes a numeral strip rather than disappearing:
 * position within a long document is exactly what is hardest to hold in your
 * head, and a 40px column of numbers still answers "where am I".
 */
function ContentsNav({ sections, activeSection, collapsed, onSelect }: ContentsNavProps) {
  if (sections.length === 0) return null;

  return (
    <nav
      className="flex-none h-full overflow-y-auto border-r border-border-soft bg-card py-6"
      style={{ width: collapsed ? NAV_STRIP_WIDTH : NAV_FULL_WIDTH }}
      data-testid="reader-contents"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      {!collapsed && (
        <div className="mb-2 px-[14px] text-[10px] font-bold uppercase tracking-[.11em] text-muted-foreground flex items-center gap-1">
          <List size={10} />
          Contents
        </div>
      )}
      <TooltipProvider delayDuration={150}>
        <ul className={collapsed ? 'space-y-1 px-1.5' : 'space-y-0.5 px-2'}>
          {sections.map((section, index) => {
            const isActive = activeSection === section.id;
            const button = (
              <button
                onClick={() => onSelect(section.id)}
                className={cn(
                  'w-full rounded transition-colors',
                  collapsed
                    ? 'h-7 text-[11px] tabular-nums flex items-center justify-center'
                    : 'border-l-2 border-transparent text-left text-[11.5px] px-2 py-1 leading-snug',
                  isActive
                    ? 'border-[color:var(--brand)] bg-brand-soft text-[color:var(--brand-strong)] font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                data-testid={`reader-outline-${section.id}`}
                data-active={isActive ? 'true' : 'false'}
                aria-label={section.title}
              >
                {collapsed ? index + 1 : section.title}
              </button>
            );

            return (
              <li key={section.id}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">{section.title}</TooltipContent>
                  </Tooltip>
                ) : (
                  button
                )}
              </li>
            );
          })}
        </ul>
      </TooltipProvider>
    </nav>
  );
}

function NotesNav({
  notes,
  activeNoteId,
  collapsed,
  isReadOnly,
  onSelect,
  onCreate,
}: {
  notes: ProjectNote[];
  activeNoteId?: string;
  collapsed: boolean;
  isReadOnly: boolean;
  onSelect: (noteId: string) => void;
  onCreate: () => void;
}) {
  return (
    <nav
      className="flex-none h-full overflow-y-auto border-r border-border-soft bg-card py-6"
      style={{ width: collapsed ? NAV_STRIP_WIDTH : NAV_FULL_WIDTH }}
      data-testid="reader-notes-nav"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      {!collapsed && (
        <div className="mb-2 flex items-center justify-between px-[14px] text-[10px] font-bold uppercase tracking-[.11em] text-muted-foreground">
          <span className="flex items-center gap-1"><FileText size={10} /> Notes</span>
          {!isReadOnly && (
            <button
              className="rounded p-0.5 text-foreground hover:bg-accent"
              onClick={onCreate}
              aria-label="Create note"
              data-testid="reader-create-note"
            >
              <Plus size={12} />
            </button>
          )}
        </div>
      )}
      <TooltipProvider delayDuration={150}>
        <ul className={collapsed ? 'space-y-1 px-1.5' : 'space-y-0.5 px-2'}>
          {notes.map((note, index) => {
            const isActive = activeNoteId === note.id;
            const button = (
              <button
                onClick={() => onSelect(note.id)}
                className={cn(
                  'w-full rounded transition-colors',
                   collapsed ? 'h-7 text-[11px] tabular-nums flex items-center justify-center' : 'border-l-2 border-transparent text-left text-[11.5px] px-2 py-1 leading-snug',
                   isActive ? 'border-[color:var(--brand)] bg-brand-soft text-[color:var(--brand-strong)] font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                data-testid={`reader-note-nav-${note.id}`}
                data-active={isActive ? 'true' : 'false'}
                aria-label={note.title}
              >
                {collapsed ? index + 1 : note.title}
              </button>
            );
            return (
              <li key={note.id}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">{note.title}</TooltipContent>
                  </Tooltip>
                ) : button}
              </li>
            );
          })}
        </ul>
      </TooltipProvider>
    </nav>
  );
}

const confidenceStyles: Record<string, string> = {
  high: 'bg-brand-soft text-brand-strong',
  medium: 'bg-muted text-muted-foreground',
  low: 'bg-warning-soft text-warning-foreground',
};

const confidenceLabels: Record<string, string> = {
  high: 'High confidence',
  medium: 'Medium',
  low: 'Needs detail',
};

interface ReaderPaneProps {
  projectId?: string;
  projectName?: string;
  nodes: Node[];
  edges: Edge[];
  isReadOnly?: boolean;
}

export function ReaderPane({
  projectId,
  projectName,
  nodes,
  edges,
  isReadOnly = false,
}: ReaderPaneProps) {
  const target = useReaderTarget();
  const storageId = projectId || 'default';

  const outerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [width, setWidth] = useState(() => readStoredWidth(storageId));
  const [isResizing, setIsResizing] = useState(false);
  // How much horizontal room exists to the left of the rail. Measured rather
  // than derived, because the rail is user-resizable and collapsible.
  const [availableWidth, setAvailableWidth] = useState(() =>
    typeof window === 'undefined' ? 0 : window.innerWidth,
  );
  const [docMeta, setDocMeta] = useState<ReaderDocMeta | null>(null);
  const [promptConversation, setPromptConversation] = useState<TranscriptEntry[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState({ title: '', content: '' });
  const [noteConflict, setNoteConflict] = useState<'changed' | 'deleted' | null>(null);
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  const [isClosePending, setIsClosePending] = useState(false);
  const [isCreatePending, setIsCreatePending] = useState(false);
  const [pendingExternalTransition, setPendingExternalTransition] = useState<ReaderTarget | 'close' | null>(null);
  const noteEditBaseRef = useRef<ProjectNote | null>(null);
  const [contentsPreferred, setContentsPreferred] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(NAV_PREF_KEY) !== 'false';
  });

  /**
   * Deep link in: `?doc=project-prd`, `?doc=workflow-prd:<id>`, or a prompt
   * conversation, optionally
   * with `&section=<key>`. Runs once — after that the URL follows the reader,
   * not the other way round, or closing it would immediately reopen it.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const doc = params.get('doc');
    if (!doc) return;
    const separator = doc.indexOf(':');
    const kind = separator === -1 ? doc : doc.slice(0, separator);
    const linkedWorkflowId = separator === -1 ? undefined : doc.slice(separator + 1);
    if (
      kind !== 'project-prd' &&
      kind !== 'workflow-prd' &&
      kind !== 'note' &&
      kind !== 'prompt-conversation'
    ) return;
    // `openInReader` refuses a malformed target (e.g. `?doc=workflow-prd` with
    // no id); strip the parameters so the URL stops advertising a document
    // that was never opened.
    const opened = openInReader({
      docKind: kind,
      workflowId: linkedWorkflowId || undefined,
      noteId: kind === 'note' ? linkedWorkflowId || undefined : undefined,
      conversationId: kind === 'prompt-conversation' ? linkedWorkflowId || undefined : undefined,
      sectionId: params.get('section') || undefined,
    });
    if (!opened) {
      const url = new URL(window.location.href);
      url.searchParams.delete('doc');
      url.searchParams.delete('section');
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  // Deep link out. replaceState rather than pushState: the reader is a view of
  // the project, not a place — Back should leave the project, not step through
  // every document that was opened along the way.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (target) {
      url.searchParams.set('doc', targetDocId(target));
      if (target.sectionId) url.searchParams.set('section', target.sectionId);
      else url.searchParams.delete('section');
    } else {
      if (!url.searchParams.has('doc') && !url.searchParams.has('section')) return;
      url.searchParams.delete('doc');
      url.searchParams.delete('section');
    }
    window.history.replaceState(null, '', url.toString());
  }, [target]);

  // Calls to openInReader come from cards throughout the app. While this pane
  // owns an unsaved note draft, intercept every one of those global transitions
  // here instead of relying on each caller to remember a local confirmation.
  useEffect(() => {
    if (!isEditingNote || target?.docKind !== 'note') return;
    return setReaderNavigationGuard(next => {
      if (next?.docKind === 'note' && next.noteId === target.noteId) return false;
      setPendingExternalTransition(next ?? 'close');
      setPendingNoteId(null);
      setIsClosePending(false);
      setIsCreatePending(false);
      return true;
    });
  }, [isEditingNote, target?.docKind, target?.noteId]);

  // Prompt cards are only an address into the project transcript. Keep the
  // reader in sync if another tab finishes or repairs the exchange after the
  // card was opened.
  useEffect(() => {
    if (target?.docKind !== 'prompt-conversation' || !target.conversationId || !projectId) {
      setPromptConversation([]);
      return;
    }
    const sync = () => {
      setPromptConversation(
        findPromptConversation(readTranscript(projectId), target.conversationId!),
      );
    };
    sync();
    return subscribeTranscript(projectId, sync);
  }, [projectId, target?.conversationId, target?.docKind, target?.openedAt]);

  // Width is per project: a spec-heavy project earns a wide reader without
  // imposing it on every other project the user opens.
  useEffect(() => {
    setWidth(readStoredWidth(storageId));
  }, [storageId]);

  const persistWidth = useCallback(
    (next: number) => {
      try {
        localStorage.setItem(`${WIDTH_KEY_PREFIX}${storageId}`, String(next));
      } catch {}
    },
    [storageId],
  );

  /**
   * How much room the canvas and the reader have to share.
   *
   * The pane's slot sits immediately left of the rail, so its right edge is the
   * rail's left edge in both layout modes — including overlay, where the slot
   * is zero-width. The left end of the interval is the canvas's own left edge,
   * *not* the viewport's: the editor's left sidebar is a flex sibling that owns
   * 256px when expanded, and counting that as canvas room lets the reader
   * squeeze the canvas below its minimum (and, in overlay, hang off-screen).
   */
  const measure = useCallback(() => {
    const el = outerRef.current;
    if (!el) return;
    const right = el.getBoundingClientRect().right;
    // The canvas area is the slot's immediate left sibling in the editor row.
    const canvasArea = el.previousElementSibling as HTMLElement | null;
    const left = canvasArea ? canvasArea.getBoundingClientRect().left : 0;
    const span = right - Math.max(0, left);
    if (span > 0) setAvailableWidth(span);
  }, []);

  useLayoutEffect(() => {
    if (!target) return;
    measure();
  }, [target, measure]);

  useEffect(() => {
    if (!target || typeof window === 'undefined') return;

    let persistHandle: number | undefined;
    const onResize = () => {
      measure();
      // Re-clamp so a stored-wide reader cannot hang off a narrowed window.
      setWidth(prev => {
        const next = clampReaderWidth(prev);
        window.clearTimeout(persistHandle);
        persistHandle = window.setTimeout(() => persistWidth(next), 200);
        return next;
      });
    };

    window.addEventListener('resize', onResize);
    window.addEventListener(RAIL_GEOMETRY_EVENT, measure);

    // The rail can also change size without announcing it (a parent layout
    // change, a toolbar wrapping), so watch the containing row as a backstop.
    const parent = outerRef.current?.parentElement;
    let observer: ResizeObserver | undefined;
    if (parent && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => measure());
      observer.observe(parent);
    }

    return () => {
      window.clearTimeout(persistHandle);
      window.removeEventListener('resize', onResize);
      window.removeEventListener(RAIL_GEOMETRY_EVENT, measure);
      observer?.disconnect();
    };
  }, [target, measure, persistWidth]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const el = outerRef.current;
      if (!el) return;
      // Measured from the slot's right edge, which is the pane's right edge in
      // both modes — the drag handle lives on the left.
      const next = clampReaderWidth(el.getBoundingClientRect().right - e.clientX);
      setWidth(next);
    };
    const onUp = () => {
      setIsResizing(false);
      setWidth(current => {
        persistWidth(current);
        return current;
      });
    };
    // Suppress selection for the whole gesture: the pointer sweeps across the
    // document body, and without this the drag paints a selection behind it.
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    // Capture phase, deliberately. The drag crosses the canvas, whose own
    // mouse handlers stop propagation — React's listeners sit on the app root,
    // so a bubbling document listener never sees those moves and the drag
    // stalls the moment the pointer leaves the pane.
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
    };
  }, [isResizing, persistWidth]);

  const workflow = useMemo(() => {
    if (!target || target.docKind !== 'workflow-prd' || !target.workflowId) return null;
    const { workflowSummaries } = detectWorkflowSummaries(nodes, edges, projectId);
    return workflowSummaries.find(w => w.id === target.workflowId) ?? null;
  }, [target, nodes, edges, projectId]);

  // A document that changes identity must not keep the previous one's outline.
  const docAddress = target ? `${target.docKind}:${target.workflowId ?? ''}:${target.noteId ?? ''}` : null;
  useEffect(() => {
    setDocMeta(null);
    setActiveSection(null);
    setIsEditingNote(false);
    setNoteDraft({ title: '', content: '' });
    setNoteConflict(null);
    setPendingNoteId(null);
    setIsClosePending(false);
    setIsCreatePending(false);
    setPendingExternalTransition(null);
    noteEditBaseRef.current = null;
  }, [docAddress]);

  const reloadNotes = useCallback(() => {
    setNotes(loadProjectNotes(projectId).data.notes);
  }, [projectId]);

  useEffect(() => {
    if (target?.docKind !== 'note') return;
    reloadNotes();
    const handlePanelRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (detail?.projectId && detail.projectId !== (projectId || '')) return;
      // A cloud pull must never replace the base document while the author has
      // an unsaved draft. The next save is intentionally based on the note they
      // were editing, and a later refresh will adopt the synced value.
      if (isEditingNote) return;
      reloadNotes();
    };
    window.addEventListener('kiteframe:panelDataRefresh', handlePanelRefresh);
    return () => window.removeEventListener('kiteframe:panelDataRefresh', handlePanelRefresh);
  }, [isEditingNote, projectId, reloadNotes, target?.docKind]);

  const handleDocMeta = useCallback((meta: ReaderDocMeta | null) => {
    setDocMeta(prev => {
      if (prev === meta) return prev;
      if (
        prev &&
        meta &&
        prev.title === meta.title &&
        prev.updatedAt === meta.updatedAt &&
        prev.version === meta.version &&
        prev.autoGenerated === meta.autoGenerated &&
        prev.confidence === meta.confidence &&
        prev.sections.length === meta.sections.length &&
        prev.sections.every((s, i) => s.id === meta.sections[i].id && s.title === meta.sections[i].title)
      ) {
        return prev;
      }
      return meta;
    });
  }, []);

  const sections = target?.docKind === 'prompt-conversation' ? [] : docMeta?.sections ?? [];
  /**
   * The width actually rendered. The stored width is the user's preference and
   * survives untouched; this is what fits *right now*. Deriving it during
   * render means the pane reacts to the sidebar opening or the rail widening
   * immediately, rather than staying too wide until the next window resize.
   */
  const effectiveWidth =
    availableWidth > 0
      ? Math.max(MIN_READER_WIDTH, Math.min(width, availableWidth))
      : width;
  const navCollapsed = effectiveWidth < NAV_COLLAPSE_WIDTH || !contentsPreferred;
  const isOverlay = availableWidth - effectiveWidth < MIN_CANVAS_WIDTH;

  const scrollToSection = useCallback((sectionId: string) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const el = scroller.querySelector<HTMLElement>(`#${CSS.escape(docSectionDomId(sectionId, 'reader'))}`);
    if (!el) return;
    const top =
      el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 16;
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    setActiveSection(sectionId);
  }, []);

  // Reveal the requested section once the document has actually rendered it.
  // `openedAt` is in the dependency list so re-opening the same section from an
  // artifact card scrolls again instead of silently doing nothing.
  const requestedSection = target?.sectionId;
  const openedAt = target?.openedAt;
  useEffect(() => {
    if (!requestedSection || sections.length === 0) return;
    if (!sections.some(s => s.id === requestedSection)) return;
    const handle = window.setTimeout(() => scrollToSection(requestedSection), 60);
    return () => window.clearTimeout(handle);
  }, [requestedSection, openedAt, sections, scrollToSection]);

  /**
   * Scroll-spy, scoped to the reader's own scroll container.
   *
   * Measured on scroll rather than with IntersectionObserver: a spec section
   * is routinely taller than the viewport, so its intersection *ratio* never
   * crosses any useful threshold and a ratio-based observer simply stops
   * reporting. "Which section's heading did I last pass" is the actual
   * question, and reading tops answers it directly.
   *
   * The rail may be rendering the same document at the same time;
   * `docSectionDomId` keeps the two sets of ids apart so this cannot latch
   * onto the wrong one.
   */
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || sections.length === 0) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const scrollerTop = scroller.getBoundingClientRect().top;
      // A heading within the top ~25% of the pane still counts as "here".
      const threshold = scrollerTop + Math.min(120, scroller.clientHeight * 0.25);

      let current = sections[0].id;
      for (const section of sections) {
        const el = document.getElementById(docSectionDomId(section.id, 'reader'));
        if (!el) continue;
        if (el.getBoundingClientRect().top <= threshold) current = section.id;
        else break;
      }
      setActiveSection(prev => (prev === current ? prev : current));
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', onScroll);
    };
  }, [sections]);

  const toggleContents = useCallback(() => {
    setContentsPreferred(prev => {
      const next = !prev;
      try {
        localStorage.setItem(NAV_PREF_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  if (!target) return null;

  const activeNote = target.docKind === 'note' ? notes.find(note => note.id === target.noteId) ?? null : null;
  const title =
    target.docKind === 'note'
      ? activeNote?.title ?? 'Note'
      : target.docKind === 'prompt-conversation'
        ? 'Prompt conversation'
      : docMeta?.title ??
        (target.docKind === 'project-prd' ? `${projectName || 'Project'} Spec` : `${workflow?.name ?? 'Workflow'} Spec`);

  const metaLine = target.docKind === 'note'
    ? activeNote ? `${activeNote.author} · ${formatDate(activeNote.updatedAt)} · v${activeNote.version}` : ''
    : target.docKind === 'prompt-conversation'
      ? 'KiteAI · Read only'
    : [
        'Kiteframe',
        docMeta?.updatedAt ? formatDate(docMeta.updatedAt) : null,
        docMeta?.version ? `v${docMeta.version}` : 'Draft',
      ].filter(Boolean).join(' · ');

  const startNoteEdit = () => {
    if (!activeNote || isReadOnly) return;
    setNoteDraft({ title: activeNote.title, content: activeNote.content });
    noteEditBaseRef.current = { ...activeNote };
    setNoteConflict(null);
    setIsEditingNote(true);
  };

  const discardNoteEdit = () => {
    if (projectId) {
      const current = loadProjectNotes(projectId).data;
      setNotes(current.notes);
      const currentNote = activeNote ? current.notes.find(note => note.id === activeNote.id) : null;
      if (currentNote) {
        setNoteDraft({ title: currentNote.title, content: currentNote.content });
        noteEditBaseRef.current = { ...currentNote };
      }
    } else if (activeNote) {
      setNoteDraft({ title: activeNote.title, content: activeNote.content });
    }
    setNoteConflict(null);
    setIsEditingNote(false);
  };

  const saveNoteEdit = () => {
    if (!activeNote || !projectId) return;
    const currentData = loadProjectNotes(projectId).data;
    const currentNote = currentData.notes.find(note => note.id === activeNote.id);
    const editBase = noteEditBaseRef.current;
    if (editBase && !currentNote) {
      // A deletion is a conflict too. Keep the draft on screen and let the
      // author explicitly recover it as a new note or discard it.
      setNoteConflict('deleted');
      return false;
    }
    if (currentNote && editBase && (currentNote.version !== editBase.version || currentNote.updatedAt !== editBase.updatedAt)) {
      // Do not turn an external change into a silent whole-collection overwrite.
      // Keep the draft visible and ask the user to explicitly reload before
      // writing again.
      setNotes(currentData.notes);
      setNoteConflict('changed');
      return false;
    }
    const now = new Date().toISOString();
    const next = currentData.notes.map(note => note.id === activeNote.id
      ? {
          ...note,
          title: noteDraft.title.trim() || 'Untitled note',
          content: noteDraft.content,
          version: note.version + 1,
          updatedAt: now,
        }
      : note);
    setNotes(next);
    saveProjectNotes(projectId, { notes: next });
    noteEditBaseRef.current = null;
    setNoteConflict(null);
    setIsEditingNote(false);
    return true;
  };

  const reloadNoteEdit = () => {
    if (!activeNote || !projectId) return;
    const current = loadProjectNotes(projectId).data;
    const currentNote = current.notes.find(note => note.id === activeNote.id);
    setNotes(current.notes);
    if (currentNote) {
      setNoteDraft({ title: currentNote.title, content: currentNote.content });
      noteEditBaseRef.current = { ...currentNote };
    }
    setNoteConflict(null);
  };

  const selectNote = (noteId: string) => {
    if (target.noteId === noteId) return;
    if (isEditingNote) {
      setPendingNoteId(noteId);
      setIsClosePending(false);
      setIsCreatePending(false);
      return;
    }
    openInReader({ docKind: 'note', noteId });
  };

  const requestClose = () => {
    if (target.docKind === 'note' && isEditingNote) {
      setPendingNoteId(null);
      setIsClosePending(true);
      setIsCreatePending(false);
      return;
    }
    closeReader();
  };

  const continuePendingNavigation = (save: boolean) => {
    if (save) {
      if (!saveNoteEdit()) return;
    } else {
      discardNoteEdit();
    }
    const nextNoteId = pendingNoteId;
    const shouldClose = isClosePending;
    const shouldCreate = isCreatePending;
    const externalTransition = pendingExternalTransition;
    setPendingNoteId(null);
    setIsClosePending(false);
    setIsCreatePending(false);
    setPendingExternalTransition(null);
    if (externalTransition === 'close') forceCloseReader();
    else if (externalTransition) forceOpenInReader(externalTransition);
    else if (nextNoteId) forceOpenInReader({ docKind: 'note', noteId: nextNoteId });
    else if (shouldClose) forceCloseReader();
    else if (shouldCreate) finishCreateNote();
  };

  const recoverDeletedDraft = () => {
    if (!projectId) return;
    const newNote = {
      ...createProjectNote(projectId),
      title: noteDraft.title.trim() || 'Recovered note',
      content: noteDraft.content,
    };
    const current = loadProjectNotes(projectId).data;
    const next = [...current.notes, newNote];
    setNotes(next);
    saveProjectNotes(projectId, { notes: next });
    setNoteConflict(null);
    setIsEditingNote(false);
    forceOpenInReader({ docKind: 'note', noteId: newNote.id });
  };

  const finishCreateNote = () => {
    if (isReadOnly || !projectId) return;
    const note = createProjectNote(projectId);
    const current = loadProjectNotes(projectId).data;
    const next = [...current.notes, note];
    setNotes(next);
    saveProjectNotes(projectId, { notes: next });
    forceOpenInReader({ docKind: 'note', noteId: note.id });
  };

  const createNoteInReader = () => {
    if (isReadOnly || !projectId) return;
    if (isEditingNote) {
      setPendingNoteId(null);
      setIsClosePending(false);
      setIsCreatePending(true);
      return;
    }
    finishCreateNote();
  };

  return (
    <div
      ref={outerRef}
      className={cn('relative h-full flex-none', isOverlay && 'w-0 overflow-visible')}
      style={isOverlay ? undefined : { width: effectiveWidth }}
      data-testid="reader-pane-slot"
      data-reader-mode={isOverlay ? 'overlay' : 'compress'}
    >
      <div
        className={cn(
          'h-full bg-card border-l border-border flex flex-col',
          isOverlay
            ? 'absolute top-0 bottom-0 right-0 z-[90]'
            : 'w-full',
        )}
        style={isOverlay ? { width: effectiveWidth } : undefined}
        data-testid="reader-pane"
        data-reader-width={effectiveWidth}
      >
        <div
          onMouseDown={e => {
            // Without preventDefault the browser treats the gesture as a text
            // selection — and if the press lands inside an existing selection,
            // as a native text *drag*, which stops delivering mousemove
            // entirely and leaves the resize stuck part-way.
            e.preventDefault();
            setIsResizing(true);
          }}
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize group z-10"
          title="Drag to resize"
          data-testid="reader-resize-handle"
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-border group-hover:bg-primary transition-colors" />
        </div>

        <header
           className="h-[52px] flex-none flex items-center gap-2 border-b border-border pl-4 pr-3"
          data-testid="reader-header"
        >
          <FileText size={14} className="flex-none text-muted-foreground" />
           <h2 className="text-[14px] font-semibold truncate" data-testid="reader-title">
            {title}
          </h2>
          {target.docKind !== 'prompt-conversation' && docMeta?.confidence && (
            <span
              className={cn(
                'flex-none px-1.5 py-0.5 text-[10px] rounded font-medium',
                confidenceStyles[docMeta.confidence],
              )}
              data-testid="reader-confidence"
            >
              {confidenceLabels[docMeta.confidence]}
            </span>
          )}
          {metaLine && (
            <span
               className="flex-none ml-auto text-[9.5px] font-mono tracking-[.03em] text-muted-foreground tabular-nums"
              data-testid="reader-meta"
            >
              {metaLine}
            </span>
          )}
          <div className={cn('flex-none flex items-center gap-0.5', !metaLine && 'ml-auto')}>
            {effectiveWidth >= NAV_COLLAPSE_WIDTH && sections.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={toggleContents}
                title={contentsPreferred ? 'Hide contents' : 'Show contents'}
                aria-label={contentsPreferred ? 'Hide contents' : 'Show contents'}
                data-testid="reader-toggle-contents"
              >
                {contentsPreferred ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={requestClose}
              title="Close reader"
              aria-label="Close reader"
              data-testid="reader-close"
            >
              <X size={14} />
            </Button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex">
          {target.docKind === 'note' ? (
            <NotesNav
              notes={notes}
              activeNoteId={target.noteId}
              collapsed={navCollapsed}
              isReadOnly={isReadOnly}
              onSelect={selectNote}
              onCreate={createNoteInReader}
            />
          ) : (
            <ContentsNav
              sections={sections}
              activeSection={activeSection}
              collapsed={navCollapsed}
              onSelect={scrollToSection}
            />
          )}

          <div
            ref={scrollRef}
             className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-4"
            data-testid="reader-body"
          >
            {/* The document's own title, at reading size, aligned with the
                widened document body below. The header above repeats it small
                because it stays put while this one scrolls away. */}
            <div className="w-full px-4 pt-8 pb-1">
              <h1 className="text-[26px] leading-tight font-semibold tracking-tight" data-testid="reader-doc-title">
                {title}
              </h1>
              {docMeta?.autoGenerated && (
                <span
                  className="mt-2 inline-flex items-center gap-1 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand-strong"
                  data-testid="reader-ai-draft-label"
                >
                  <Sparkles size={10} />
                  AI Draft
                </span>
              )}
            </div>

            {target.docKind === 'note' && (
              <div className="max-w-[400px] mx-auto pb-12" data-testid="reader-note-document">
                {!activeNote ? (
                  <div className="py-10 text-center text-sm text-muted-foreground" data-testid="reader-missing-note">
                    This note is no longer available.
                  </div>
                ) : isEditingNote ? (
                  <div className="space-y-4">
                    {(pendingNoteId || isClosePending || isCreatePending || pendingExternalTransition) && (
                      <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-foreground" data-testid="reader-note-leave-confirmation">
                        Save or discard your changes before {isClosePending || pendingExternalTransition === 'close' ? 'closing the reader' : isCreatePending ? 'creating a new note' : pendingExternalTransition ? 'opening another document' : 'switching notes'}.
                        <div className="mt-2 flex gap-2">
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => { setPendingNoteId(null); setIsClosePending(false); setIsCreatePending(false); setPendingExternalTransition(null); }}>
                            Cancel
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => continuePendingNavigation(false)}>
                            Discard
                          </Button>
                          <Button size="sm" className="h-6 px-2 text-[11px]" onClick={() => continuePendingNavigation(true)}>
                            Save
                          </Button>
                        </div>
                      </div>
                    )}
                    {noteConflict && (
                      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground" data-testid="reader-note-conflict">
                        {noteConflict === 'deleted'
                          ? 'This note was removed somewhere else. Recover your draft as a new note or discard it.'
                          : 'This note changed somewhere else. Reload the latest version before saving your draft.'}
                        {noteConflict === 'deleted' ? (
                          <Button variant="ghost" size="sm" className="ml-2 h-6 px-2 text-[11px]" onClick={recoverDeletedDraft} data-testid="reader-recover-note">
                            Recover as new note
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="ml-2 h-6 px-2 text-[11px]" onClick={reloadNoteEdit} data-testid="reader-reload-note">
                            Reload latest
                          </Button>
                        )}
                      </div>
                    )}
                    <input
                      value={noteDraft.title}
                      onChange={event => setNoteDraft(draft => ({ ...draft, title: event.target.value }))}
                      className="w-full border-b border-border bg-transparent pb-2 text-[20px] font-semibold outline-none focus:border-primary"
                      aria-label="Note title"
                      data-testid="reader-note-title-input"
                    />
                    <textarea
                      value={noteDraft.content}
                      onChange={event => setNoteDraft(draft => ({ ...draft, content: event.target.value }))}
                       className="min-h-[300px] w-full resize-y rounded-md border-2 border-dashed border-[color:var(--brand)] bg-transparent p-3 text-[15px] leading-[1.7] outline-offset-8 outline-none"
                      placeholder="Write your note..."
                      aria-label="Note content"
                      data-testid="reader-note-content-input"
                    />
                    <div className="flex justify-end gap-2">
                       <Button variant="outline" size="sm" className="h-7 border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground" onClick={discardNoteEdit} data-testid="reader-discard-note">Discard</Button>
                       <Button size="sm" className="h-7 bg-primary font-semibold text-primary-foreground hover:bg-[color:var(--primary-hover)]" onClick={saveNoteEdit} data-testid="reader-save-note"><Save size={13} className="mr-1" />Save changes</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mb-5 text-[11px] font-mono text-muted-foreground">
                      {activeNote.author} · {formatDate(activeNote.updatedAt)} · v{activeNote.version}
                    </p>
                    <div className="whitespace-pre-wrap text-[15px] leading-[1.7] text-foreground" data-testid="reader-note-content">
                      {activeNote.content || <span className="italic text-muted-foreground">This note is empty.</span>}
                    </div>
                    {!isReadOnly && (
                      <Button variant="ghost" size="sm" className="mt-6 text-xs" onClick={startNoteEdit} data-testid="reader-edit-note">
                        <Edit3 size={13} className="mr-1" />Edit note
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {target.docKind === 'prompt-conversation' && (
              <div className="w-full px-4 pb-12" data-testid="reader-prompt-conversation">
                {promptConversation.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground" data-testid="reader-missing-prompt-conversation">
                    This prompt conversation is no longer available.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {promptConversation.map((message) => (
                      <article
                        key={message.id}
                        className={cn(
                          'rounded-lg border p-4',
                          message.role === 'user'
                            ? 'ml-auto max-w-[88%] border-primary/20 bg-primary/5'
                            : 'mr-auto max-w-full border-border bg-card',
                        )}
                      >
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                          {message.role === 'user' ? 'You' : 'KiteAI'}
                        </p>
                        <div className="whitespace-pre-wrap text-[14px] leading-[1.65] text-foreground">
                          {message.content}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {target.docKind === 'project-prd' && projectId && (
              <ProjectPRDSection
                projectId={projectId}
                projectName={projectName || 'Untitled'}
                nodes={nodes}
                edges={edges}
                isReadOnly={isReadOnly}
                density="reader"
                onDocMeta={handleDocMeta}
              />
            )}

            {target.docKind === 'workflow-prd' && projectId && workflow && (
              <WorkflowPRDSection
                key={workflow.id}
                projectId={projectId}
                workflowId={workflow.id}
                workflowName={workflow.name}
                nodes={workflow.nodes}
                edges={workflow.edges}
                isReadOnly={isReadOnly}
                density="reader"
                onDocMeta={handleDocMeta}
              />
            )}

            {target.docKind === 'workflow-prd' && !workflow && (
              <div className="py-10 text-center text-sm text-muted-foreground" data-testid="reader-missing-workflow">
                That workflow is no longer on the canvas, so its spec cannot be opened.
              </div>
            )}

            {!projectId && (
              <div className="py-10 text-center text-sm text-muted-foreground" data-testid="reader-no-project">
                Save this project to open its documents.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReaderPane;
