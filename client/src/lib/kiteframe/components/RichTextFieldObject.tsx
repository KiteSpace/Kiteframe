import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { CanvasObject, RichTextFieldData, RichTextBlock, RichTextRun } from '../types';
import { ResizeHandle } from './ResizeHandle';

// ─── helpers ───────────────────────────────────────────────────────────────

function emptyDoc(): RichTextBlock[] {
  return [{ type: 'paragraph', runs: [{ text: '' }] }];
}

// Allowed formatting values — persisted data and toolbar input are both
// validated against these before being applied or interpolated into HTML/CSS.
const MIN_FONT_SIZE = 6;
const MAX_FONT_SIZE = 200;
const ALLOWED_FONT_WEIGHTS = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900]);
const BLOCK_TYPES = new Set<RichTextBlock['type']>(['paragraph', 'bullet', 'ordered']);

/** Elements that terminate the current paragraph when found at the editor root. */
const BLOCK_TAGS = new Set([
  'div', 'p', 'li', 'blockquote', 'pre', 'section', 'article',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
]);

const ZERO_WIDTH = /\u200B/g;

function sanitizeFontSize(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(n)));
}

function sanitizeFontWeight(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return undefined;
  // Snap to nearest hundred within 100–900
  const snapped = Math.min(900, Math.max(100, Math.round(n / 100) * 100));
  return ALLOWED_FONT_WEIGHTS.has(snapped) ? snapped : undefined;
}

/** Validate persisted/imported rich-text blocks at runtime. Unknown or
 *  malformed entries are dropped or coerced — never interpolated raw. */
function sanitizeBlocks(input: unknown): RichTextBlock[] {
  if (!Array.isArray(input)) return emptyDoc();
  const blocks: RichTextBlock[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const type = BLOCK_TYPES.has((raw as any).type) ? (raw as any).type : 'paragraph';
    const rawRuns = Array.isArray((raw as any).runs) ? (raw as any).runs : [];
    const runs: RichTextRun[] = [];
    for (const r of rawRuns) {
      if (!r || typeof r !== 'object' || typeof r.text !== 'string') continue;
      const run: RichTextRun = { text: r.text };
      if (r.bold === true) run.bold = true;
      if (r.italic === true) run.italic = true;
      if (r.underline === true) run.underline = true;
      const fs = r.fontSize !== undefined ? sanitizeFontSize(r.fontSize) : undefined;
      if (fs !== undefined) run.fontSize = fs;
      const fw = r.fontWeight !== undefined ? sanitizeFontWeight(r.fontWeight) : undefined;
      if (fw !== undefined) run.fontWeight = fw;
      runs.push(run);
    }
    if (runs.length === 0) runs.push({ text: '' });
    blocks.push({ type, runs });
  }
  return blocks.length > 0 ? blocks : emptyDoc();
}

/** Object-level typography, shared by the editor and the read-only view so
 *  the "Text Style" popover in the linear toolbar affects both identically. */
function objectTypography(data: RichTextFieldData): React.CSSProperties {
  const decoration = String(data.textDecoration ?? '');
  const weight = data.fontWeight;
  return {
    fontSize: data.fontSize ? `${data.fontSize}px` : '14px',
    fontFamily: data.fontFamily ?? 'Inter, system-ui, sans-serif',
    color: data.textColor ?? '#000000',
    fontWeight: weight === 'bold' ? 700 : weight === 'normal' ? 400 : undefined,
    fontStyle: decoration.includes('italic') ? 'italic' : undefined,
    textDecoration: decoration.includes('line-through') ? 'line-through' : undefined,
    textAlign: (data.textAlign as React.CSSProperties['textAlign']) ?? undefined,
  };
}

/** Render a single block's runs as JSX (read-only mode).
 *  Marks the run does NOT carry are left undefined so the object-level
 *  typography above keeps applying (otherwise a span would clobber it). */
function renderRuns(runs: RichTextRun[]) {
  return runs.map((run, i) => {
    const style: React.CSSProperties = {
      fontWeight: run.fontWeight ?? (run.bold ? 700 : undefined),
      fontStyle: run.italic ? 'italic' : undefined,
      textDecoration: run.underline ? 'underline' : undefined,
      fontSize: run.fontSize ? `${run.fontSize}px` : undefined,
    };
    return (
      <span key={i} style={style}>
        {run.text || '\u200B'}
      </span>
    );
  });
}

// ─── Format toolbar ─────────────────────────────────────────────────────────

interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  bullet: boolean;
  ordered: boolean;
}

interface FormatToolbarProps {
  /** Screen rect of the text field itself — the toolbar is anchored to this,
   *  never to the current text selection, so it does not jump around. */
  anchorRect: DOMRect | null;
  onCommand: (cmd: string, value?: string) => void;
  state: FormatState;
}

const TOOLBAR_WIDTH = 340;
const TOOLBAR_HEIGHT = 36;
const TOOLBAR_GAP = 8;

function FormatToolbar({ anchorRect, onCommand, state }: FormatToolbarProps) {
  if (!anchorRect) return null;

  let left = anchorRect.left + anchorRect.width / 2 - TOOLBAR_WIDTH / 2;
  let top = anchorRect.top - TOOLBAR_HEIGHT - TOOLBAR_GAP;

  // Keep inside the viewport; flip below the field when there is no room above
  if (left < 8) left = 8;
  if (left + TOOLBAR_WIDTH > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - 8 - TOOLBAR_WIDTH);
  }
  if (top < 8) top = anchorRect.bottom + TOOLBAR_GAP;

  // The canvas layer this component lives in is CSS-transformed, which makes
  // `position: fixed` resolve against that ancestor instead of the viewport.
  // Portal to <body> so the screen coordinates above mean what they say —
  // otherwise the bar lands on top of the field and swallows its clicks.
  const mount = typeof document !== 'undefined' ? document.body : null;
  if (!mount) return null;

  const btn = (
    label: React.ReactNode,
    cmd: string,
    opts: { title: string; testId: string; active?: boolean; style?: React.CSSProperties },
  ) => (
    <button
      key={cmd}
      type="button"
      title={opts.title}
      data-testid={opts.testId}
      data-active={opts.active ? 'true' : 'false'}
      onMouseDown={(e) => {
        e.preventDefault(); // keep focus (and the selection) in the editor
        e.stopPropagation();
        onCommand(cmd);
      }}
      className={
        'px-1.5 py-0.5 text-xs rounded transition-colors ' +
        (opts.active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent')
      }
      style={opts.style}
    >
      {label}
    </button>
  );

  return createPortal(
    <div
      className="fixed flex items-center gap-0.5 bg-card border border-border rounded-md shadow-lg px-2 py-1"
      style={{ zIndex: 10000, left, top, height: TOOLBAR_HEIGHT, width: TOOLBAR_WIDTH }}
      data-testid="rich-text-format-toolbar"
      onMouseDown={(e) => e.preventDefault()} // prevent blur/commit
    >
      {btn('B', 'bold', {
        title: 'Bold',
        testId: 'rich-text-bold',
        active: state.bold,
        style: { fontWeight: 700 },
      })}
      {btn('I', 'italic', {
        title: 'Italic',
        testId: 'rich-text-italic',
        active: state.italic,
        style: { fontStyle: 'italic' },
      })}
      {btn('U', 'underline', {
        title: 'Underline',
        testId: 'rich-text-underline',
        active: state.underline,
        style: { textDecoration: 'underline' },
      })}
      <div className="w-px h-4 bg-border mx-0.5" />
      {/* Font size */}
      <select
        title="Font size"
        data-testid="rich-text-font-size"
        className="text-xs border border-border rounded px-1 py-0.5 bg-background h-6 cursor-pointer"
        defaultValue=""
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value;
          e.target.value = '';
          onCommand('fontSize', v);
        }}
      >
        <option value="" disabled>Size</option>
        {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64].map((s) => (
          <option key={s} value={String(s)}>{s}</option>
        ))}
      </select>
      {/* Font weight */}
      <select
        title="Font weight"
        data-testid="rich-text-font-weight"
        className="text-xs border border-border rounded px-1 py-0.5 bg-background h-6 cursor-pointer"
        defaultValue=""
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value;
          e.target.value = '';
          onCommand('fontWeight', v);
        }}
      >
        <option value="" disabled>Weight</option>
        <option value="300">Light</option>
        <option value="400">Regular</option>
        <option value="500">Medium</option>
        <option value="600">SemiBold</option>
        <option value="700">Bold</option>
        <option value="900">Black</option>
      </select>
      <div className="w-px h-4 bg-border mx-0.5" />
      {btn('• List', 'insertUnorderedList', {
        title: 'Bullet list',
        testId: 'rich-text-bullet-list',
        active: state.bullet,
      })}
      {btn('1. List', 'insertOrderedList', {
        title: 'Numbered list',
        testId: 'rich-text-ordered-list',
        active: state.ordered,
      })}
    </div>,
    mount,
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface RichTextFieldObjectProps {
  object: CanvasObject & { data: RichTextFieldData };
  onUpdate?: (updates: Partial<RichTextFieldData>) => void;
  onResize?: (width: number, height: number, resizeInfo?: { position: string }) => void;
  onStartDrag?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Fired when inline editing starts/stops so the host can hide the
   *  object-level linear toolbar while the format bar is on screen. */
  onEditingChange?: (isEditing: boolean) => void;
  viewport?: { x: number; y: number; zoom: number };
  selectedCanvasObjectCount?: number;
}

const EMPTY_FORMAT_STATE: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  bullet: false,
  ordered: false,
};

export function RichTextFieldObject({
  object,
  onUpdate,
  onResize,
  onStartDrag,
  onClick,
  onContextMenu,
  onEditingChange,
  viewport,
  selectedCanvasObjectCount = 0,
}: RichTextFieldObjectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [formatState, setFormatState] = useState<FormatState>(EMPTY_FORMAT_STATE);
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Last non-collapsed selection range inside the editor. Needed because
  // interacting with the toolbar's <select> elements moves focus (and can
  // collapse the selection) before onChange fires.
  const savedRangeRef = useRef<Range | null>(null);
  // The editor's innerHTML is seeded once per editing session. Re-deriving it
  // from props on every render would reset the DOM (and the caret) whenever
  // the debounced sync writes blocks back to the store.
  const editHtmlRef = useRef<string>('');
  const syncTimerRef = useRef<number | null>(null);
  const onEditingChangeRef = useRef(onEditingChange);
  onEditingChangeRef.current = onEditingChange;
  // Deferred writes (debounced sync, commit) must use the newest callback, not
  // the one that existed when they were scheduled — see scheduleSync.
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const data = object.data as RichTextFieldData;
  // Validate persisted/imported data before rendering or generating HTML
  const blocks: RichTextBlock[] = React.useMemo(
    () => sanitizeBlocks(data.blocks),
    [data.blocks],
  );
  const width = object.style?.width ?? object.width ?? 300;
  const height = object.style?.height ?? object.height ?? 120;
  const isSelected = object.selected;
  const typography = objectTypography(data);

  // ── Serialise contenteditable → RichTextBlock[] ─────────────────────────
  const serialise = useCallback((): RichTextBlock[] => {
    const el = editorRef.current;
    if (!el) return emptyDoc();

    const result: RichTextBlock[] = [];

    // Formatting context inherited from ancestor elements. Nested formatting
    // (e.g. <b><span style="font-size:24px">…</span></b>) must merge, not
    // flatten — each element layers its marks on top of the inherited ones.
    type Fmt = Omit<RichTextRun, 'text'>;

    const pushRun = (block: RichTextBlock, rawText: string, fmt: Fmt) => {
      // Zero-width spaces are only placeholders for empty runs in the
      // generated HTML — they must never accumulate in the stored document.
      const text = rawText.replace(ZERO_WIDTH, '');
      if (!text) return;
      block.runs.push({ text, ...fmt });
    };

    /** Lets a nested <br> end the block it is sitting in and start the next
     *  one, instead of silently vanishing along with the line break. */
    interface BlockCtx {
      getBlock: () => RichTextBlock;
      split: () => void;
    }

    const processNode = (node: Node, ctx: BlockCtx, fmt: Fmt) => {
      if (node.nodeType === Node.TEXT_NODE) {
        pushRun(ctx.getBlock(), node.textContent ?? '', fmt);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const style = el.style;

      // Shift+Enter (and pasted markup) produce a <br> inside the block
      if (tag === 'br') {
        ctx.split();
        return;
      }

      const next: Fmt = { ...fmt };
      if (tag === 'b' || tag === 'strong') next.bold = true;
      if (tag === 'i' || tag === 'em') next.italic = true;
      if (tag === 'u') next.underline = true;
      if (style.fontWeight) {
        const fw = sanitizeFontWeight(style.fontWeight === 'bold' ? 700 : style.fontWeight);
        if (fw !== undefined) next.fontWeight = fw;
        if (style.fontWeight === 'normal') {
          next.bold = false;
        } else if (style.fontWeight === 'bold' || (fw !== undefined && fw >= 700)) {
          next.bold = true;
        } else if (fw !== undefined) {
          next.bold = false;
        }
      }
      if (style.fontSize) {
        const fs = sanitizeFontSize(style.fontSize);
        if (fs !== undefined) next.fontSize = fs;
      }
      if (style.fontStyle === 'italic') next.italic = true;
      if (style.fontStyle === 'normal') next.italic = false;
      if (style.textDecoration?.includes('underline')) next.underline = true;
      if (style.textDecoration === 'none') next.underline = false;

      el.childNodes.forEach((child) => processNode(child, ctx, next));
    };

    /** One source element can yield several blocks when it contains <br>s. */
    const processBlockEl = (el: HTMLElement, type: RichTextBlock['type']): RichTextBlock[] => {
      const blocks: RichTextBlock[] = [];
      let current: RichTextBlock = { type, runs: [] };
      const ctx: BlockCtx = {
        getBlock: () => current,
        split: () => {
          blocks.push(current);
          current = { type, runs: [] };
        },
      };
      el.childNodes.forEach((child) => {
        // A nested list inside a list item is flattened into its own blocks
        // by the caller; ignore it here so its text is not duplicated.
        const tag =
          child.nodeType === Node.ELEMENT_NODE
            ? (child as HTMLElement).tagName.toLowerCase()
            : '';
        if (tag === 'ul' || tag === 'ol') return;
        processNode(child, ctx, {});
      });
      blocks.push(current);
      for (const b of blocks) if (b.runs.length === 0) b.runs.push({ text: '' });
      return blocks;
    };

    // Lists produced by execCommand can be nested; walk them depth-first so
    // every list item becomes a block of the right type.
    const processList = (listEl: HTMLElement) => {
      const type: RichTextBlock['type'] =
        listEl.tagName.toLowerCase() === 'ol' ? 'ordered' : 'bullet';
      Array.from(listEl.children).forEach((child) => {
        const tag = child.tagName.toLowerCase();
        if (tag === 'li') {
          result.push(...processBlockEl(child as HTMLElement, type));
          Array.from(child.children).forEach((grand) => {
            const gTag = grand.tagName.toLowerCase();
            if (gTag === 'ul' || gTag === 'ol') processList(grand as HTMLElement);
          });
        } else if (tag === 'ul' || tag === 'ol') {
          processList(child as HTMLElement);
        }
      });
    };

    // contentEditable freely emits bare text nodes and inline elements at the
    // root (especially after toggling lists off). Collect them into an
    // implicit paragraph instead of dropping them.
    let inlineBlock: RichTextBlock | null = null;
    const flushInline = () => {
      if (!inlineBlock) return;
      if (inlineBlock.runs.length === 0) inlineBlock.runs.push({ text: '' });
      result.push(inlineBlock);
      inlineBlock = null;
    };
    const inlineTarget = (): RichTextBlock => {
      if (!inlineBlock) inlineBlock = { type: 'paragraph', runs: [] };
      return inlineBlock;
    };

    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent ?? '').replace(ZERO_WIDTH, '');
        if (text) pushRun(inlineTarget(), text, {});
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const child = node as HTMLElement;
      const tag = child.tagName.toLowerCase();

      if (tag === 'ul' || tag === 'ol') {
        flushInline();
        processList(child);
        return;
      }
      if (tag === 'br') {
        // Ends the implicit paragraph being collected; only a <br> with
        // nothing before it means a genuinely blank line.
        if (inlineBlock) flushInline();
        else result.push({ type: 'paragraph', runs: [{ text: '' }] });
        return;
      }
      if (BLOCK_TAGS.has(tag)) {
        flushInline();
        result.push(...processBlockEl(child, 'paragraph'));
        // A list nested directly inside a root-level block still counts
        Array.from(child.children).forEach((grand) => {
          const gTag = grand.tagName.toLowerCase();
          if (gTag === 'ul' || gTag === 'ol') processList(grand as HTMLElement);
        });
        return;
      }
      // Inline element at the root (b/i/u/span/font/…)
      processNode(child, { getBlock: inlineTarget, split: flushInline }, {});
    });
    flushInline();

    return result.length ? result : emptyDoc();
  }, []);

  const cancelPendingSync = useCallback(() => {
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  }, []);

  /** Push the live editor content into the canvas object without leaving
   *  edit mode, so formatting is persisted (and autosaved) as it happens. */
  const syncNow = useCallback(() => {
    cancelPendingSync();
    if (!editorRef.current) return;
    onUpdateRef.current?.({ blocks: serialise() });
  }, [cancelPendingSync, serialise]);

  const scheduleSync = useCallback(
    (delay = 300) => {
      cancelPendingSync();
      syncTimerRef.current = window.setTimeout(() => {
        syncTimerRef.current = null;
        if (!editorRef.current) return;
        // Always go through the ref: the host rebuilds `onUpdate` around a
        // fresh snapshot of the canvas objects on every render, so a callback
        // captured when the timer was scheduled would resurrect the objects
        // as they were before any concurrent edit.
        onUpdateRef.current?.({ blocks: serialise() });
      }, delay);
    },
    [cancelPendingSync, serialise],
  );

  useEffect(() => () => cancelPendingSync(), [cancelPendingSync]);

  // ── Build initial HTML from blocks ───────────────────────────────────────
  const blocksToHtml = useCallback((source: RichTextBlock[]): string => {
    const runToHtml = (run: RichTextRun): string => {
      let html = run.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (!html) html = '\u200B';
      const styles: string[] = [];
      if (run.fontSize) styles.push(`font-size:${run.fontSize}px`);
      if (run.fontWeight) styles.push(`font-weight:${run.fontWeight}`);
      else if (run.bold) styles.push('font-weight:700');
      if (run.italic) styles.push('font-style:italic');
      if (run.underline) styles.push('text-decoration:underline');
      if (styles.length > 0) {
        return `<span style="${styles.join(';')}">${html}</span>`;
      }
      return html;
    };

    const grouped: Array<{ type: RichTextBlock['type']; items: RichTextBlock[] }> = [];
    for (const block of source) {
      const last = grouped[grouped.length - 1];
      if (last && last.type === block.type && block.type !== 'paragraph') {
        last.items.push(block);
      } else {
        grouped.push({ type: block.type, items: [block] });
      }
    }

    return grouped
      .map(({ type, items }) => {
        if (type === 'bullet' || type === 'ordered') {
          const tag = type === 'bullet' ? 'ul' : 'ol';
          const lis = items.map((b) => `<li>${b.runs.map(runToHtml).join('')}</li>`).join('');
          return `<${tag} style="margin:0;padding-left:1.2em;">${lis}</${tag}>`;
        }
        return `<div>${items[0].runs.map(runToHtml).join('')}</div>`;
      })
      .join('');
  }, []);

  // ── Commit edit ──────────────────────────────────────────────────────────
  const commitEdit = useCallback(() => {
    cancelPendingSync();
    const newBlocks = editorRef.current ? serialise() : null;
    if (newBlocks) onUpdateRef.current?.({ blocks: newBlocks });
    savedRangeRef.current = null;
    setIsEditing(false);
    setAnchorRect(null);
    setFormatState(EMPTY_FORMAT_STATE);
    onEditingChangeRef.current?.(false);
  }, [cancelPendingSync, serialise]);

  // ── Enter edit mode ──────────────────────────────────────────────────────
  const enterEdit = useCallback(() => {
    // Freeze the HTML for the whole session (see editHtmlRef)
    editHtmlRef.current = blocksToHtml(sanitizeBlocks(object.data?.blocks));
    setIsEditing(true);
    onEditingChangeRef.current?.(true);
  }, [blocksToHtml, object.data]);

  /** Recompute the toolbar anchor from the field's own screen rect. */
  const updateAnchorRect = useCallback(() => {
    if (wrapperRef.current) {
      setAnchorRect(wrapperRef.current.getBoundingClientRect());
    }
  }, []);

  const refreshFormatState = useCallback(() => {
    try {
      setFormatState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        bullet: document.queryCommandState('insertUnorderedList'),
        ordered: document.queryCommandState('insertOrderedList'),
      });
    } catch {
      /* queryCommandState is unavailable in some environments */
    }
  }, []);

  // Focus editor after entering edit mode
  useEffect(() => {
    if (!isEditing || !editorRef.current) return;
    editorRef.current.focus();
    // Move cursor to end
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
    updateAnchorRect();
    refreshFormatState();
  }, [isEditing, updateAnchorRect, refreshFormatState]);

  // Keep the toolbar glued to the field as the canvas pans, zooms or the
  // field is moved/resized.
  useEffect(() => {
    if (!isEditing) return;
    updateAnchorRect();
  }, [
    isEditing,
    updateAnchorRect,
    viewport?.x,
    viewport?.y,
    viewport?.zoom,
    width,
    height,
    object.position.x,
    object.position.y,
  ]);

  useEffect(() => {
    if (!isEditing) return;
    const onWindowChange = () => updateAnchorRect();
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [isEditing, updateAnchorRect]);

  // Track the live selection so format commands can be restored onto it and
  // the toolbar can show which marks are active.
  const handleSelectionChange = useCallback(() => {
    if (!isEditing) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        if (!sel.isCollapsed) savedRangeRef.current = range.cloneRange();
        refreshFormatState();
      }
    }
  }, [isEditing, refreshFormatState]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  // Escape commits edit
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        commitEdit();
      }
    },
    [commitEdit],
  );

  // ── Format command ───────────────────────────────────────────────────────
  const handleFormatCommand = useCallback(
    (cmd: string, value?: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();

      // Interacting with a <select> in the toolbar moves focus out of the
      // contenteditable and collapses the selection before onChange fires.
      // Restore the last known in-editor selection so the command applies
      // to the text the user actually selected.
      const sel = window.getSelection();
      const hasEditorSelection =
        !!sel &&
        sel.rangeCount > 0 &&
        !sel.isCollapsed &&
        editor.contains(sel.getRangeAt(0).commonAncestorContainer);
      if (!hasEditorSelection && savedRangeRef.current) {
        sel?.removeAllRanges();
        sel?.addRange(savedRangeRef.current.cloneRange());
      }

      // Emit semantic tags (<b>/<i>/<u>) rather than inline styles — the
      // serialiser and the toggle-off behaviour both rely on them.
      try {
        document.execCommand('styleWithCSS', false, 'false');
      } catch {
        /* not supported everywhere */
      }

      const selectSpanContents = (span: HTMLElement) => {
        const s = window.getSelection();
        const r = document.createRange();
        r.selectNodeContents(span);
        s?.removeAllRanges();
        s?.addRange(r);
        savedRangeRef.current = r.cloneRange();
      };

      switch (cmd) {
        case 'bold':
        case 'italic':
        case 'underline':
        case 'insertUnorderedList':
        case 'insertOrderedList':
          document.execCommand(cmd);
          break;
        case 'fontSize': {
          const size = sanitizeFontSize(value);
          const current = window.getSelection();
          if (size === undefined || !current || current.isCollapsed) break;
          // execCommand fontSize only accepts the legacy 1–7 scale; use it as
          // a marker and swap the <font> tags for real pixel sizes.
          document.execCommand('fontSize', false, '7');
          const created: HTMLElement[] = [];
          editor.querySelectorAll('font[size="7"]').forEach((f) => {
            const span = document.createElement('span');
            span.style.fontSize = `${size}px`;
            while (f.firstChild) span.appendChild(f.firstChild);
            f.replaceWith(span);
            created.push(span);
          });
          if (created.length > 0) {
            const s = window.getSelection();
            const r = document.createRange();
            r.setStartBefore(created[0]);
            r.setEndAfter(created[created.length - 1]);
            s?.removeAllRanges();
            s?.addRange(r);
            savedRangeRef.current = r.cloneRange();
          }
          break;
        }
        case 'fontWeight': {
          const weight = sanitizeFontWeight(value);
          const current = window.getSelection();
          if (
            weight === undefined ||
            !current ||
            current.isCollapsed ||
            current.rangeCount === 0
          ) {
            break;
          }
          const range = current.getRangeAt(0);
          const span = document.createElement('span');
          span.style.fontWeight = String(weight);
          try {
            span.appendChild(range.extractContents());
            range.insertNode(span);
            selectSpanContents(span);
          } catch {
            /* selection could not be wrapped — leave the document untouched */
          }
          break;
        }
        default:
          return;
      }

      refreshFormatState();
      // Persist promptly so the change survives a re-render or an autosave
      // that happens before the user leaves edit mode.
      scheduleSync(150);
    },
    [refreshFormatState, scheduleSync],
  );

  // ── Read-only rendering of blocks ────────────────────────────────────────
  const renderBlocks = () => {
    const grouped: Array<{ type: RichTextBlock['type']; items: RichTextBlock[] }> = [];
    for (const block of blocks) {
      const last = grouped[grouped.length - 1];
      if (last && last.type === block.type && block.type !== 'paragraph') {
        last.items.push(block);
      } else {
        grouped.push({ type: block.type, items: [block] });
      }
    }

    return grouped.map((group, gi) => {
      if (group.type === 'bullet' || group.type === 'ordered') {
        const ListTag = group.type === 'bullet' ? 'ul' : 'ol';
        return (
          <ListTag key={gi} style={{ margin: 0, paddingLeft: '1.2em' }}>
            {group.items.map((block, bi) => (
              <li key={bi}>{renderRuns(block.runs)}</li>
            ))}
          </ListTag>
        );
      }
      return <div key={gi}>{renderRuns(group.items[0].runs)}</div>;
    });
  };

  const isOnlySelected = isSelected && selectedCanvasObjectCount === 1;

  const contentStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    padding: '8px',
    boxSizing: 'border-box',
    lineHeight: 1.5,
    // The content scrolls/clips here, NOT on the wrapper — the wrapper hosts
    // the selection border and the resize handles, which sit half outside its
    // bounds and would otherwise be cut off.
    overflowX: 'hidden',
    ...typography,
  };

  return (
    <>
      <div
        ref={wrapperRef}
        data-testid="rich-text-field-object"
        style={{
          position: 'absolute',
          left: object.position.x,
          top: object.position.y,
          width,
          height,
          cursor: isEditing ? 'text' : 'default',
          userSelect: isEditing ? 'text' : 'none',
          zIndex: object.zIndex ?? 1,
          backgroundColor: data.backgroundColor ?? 'transparent',
          border: isSelected
            ? '2px solid hsl(var(--primary))'
            : '1.5px dashed hsl(var(--border))',
          borderRadius: 4,
          boxSizing: 'border-box',
          // No overflow clipping here — see contentStyle above.
        }}
        onMouseDown={(e) => {
          if (isEditing) {
            e.stopPropagation(); // don't start canvas drag while editing
            return;
          }
          onStartDrag?.(e);
        }}
        onClick={(e) => {
          if (!isEditing) onClick?.(e);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!isEditing) enterEdit();
        }}
        onContextMenu={onContextMenu}
      >
        {isEditing ? (
          /* ── Inline contenteditable editor ── */
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-testid="rich-text-editor"
            dangerouslySetInnerHTML={{ __html: editHtmlRef.current }}
            onKeyDown={handleKeyDown}
            onInput={() => scheduleSync()}
            onBlur={(e) => {
              // Don't commit when focus moves into the formatting toolbar
              // (e.g. opening the font size/weight <select>) — the user is
              // still editing and the command handler restores the selection.
              const next = e.relatedTarget as HTMLElement | null;
              if (next && next.closest('[data-testid="rich-text-format-toolbar"]')) {
                return;
              }
              commitEdit();
            }}
            style={{ ...contentStyle, outline: 'none', overflowY: 'auto' }}
          />
        ) : (
          /* ── Read-only view ── */
          <div style={{ ...contentStyle, overflowY: 'hidden', pointerEvents: 'none' }}>
            {(() => {
              const allEmpty = blocks.every((b) =>
                b.runs.every((r) => !r.text || r.text === '\u200B'),
              );
              if (allEmpty) {
                return (
                  <span style={{ color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
                    Double-click to edit…
                  </span>
                );
              }
              return renderBlocks();
            })()}
          </div>
        )}

        {/* Resize handles — direct children of the unclipped wrapper */}
        {isOnlySelected && !isEditing && onResize && (
          <>
            {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pos) => (
              <ResizeHandle
                key={pos}
                position={pos}
                nodeRef={wrapperRef}
                onResize={(newW, newH, resizeInfo) => onResize(newW, newH, resizeInfo)}
                minWidth={100}
                minHeight={60}
                maxWidth={1200}
                maxHeight={900}
                viewport={viewport}
              />
            ))}
          </>
        )}
      </div>

      {/* Format toolbar — anchored to the field, visible for the whole session */}
      {isEditing && (
        <FormatToolbar
          anchorRect={anchorRect}
          onCommand={handleFormatCommand}
          state={formatState}
        />
      )}
    </>
  );
}
