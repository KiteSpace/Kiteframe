import React, { useState, useRef, useEffect, useCallback } from 'react';
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

/** Render a single block's runs as JSX (read-only mode) */
function renderRuns(runs: RichTextRun[], defaultFontSize: number, defaultColor: string) {
  return runs.map((run, i) => {
    const style: React.CSSProperties = {
      fontWeight: run.bold ? (run.fontWeight ?? 700) : (run.fontWeight ?? 400),
      fontStyle: run.italic ? 'italic' : 'normal',
      textDecoration: run.underline ? 'underline' : 'none',
      fontSize: run.fontSize ? `${run.fontSize}px` : undefined,
      color: defaultColor,
    };
    return (
      <span key={i} style={style}>
        {run.text || '\u200B'}
      </span>
    );
  });
}

// ─── Format toolbar ─────────────────────────────────────────────────────────

interface FormatToolbarProps {
  anchorRect: DOMRect | null;
  containerRect: DOMRect | null;
  onCommand: (cmd: string, value?: string) => void;
  zoom: number;
}

function FormatToolbar({ anchorRect, containerRect, onCommand, zoom }: FormatToolbarProps) {
  if (!anchorRect || !containerRect) return null;

  // Position above the selection, centred
  const toolbarWidth = 320;
  const toolbarHeight = 36;
  const gap = 6;

  let left = anchorRect.left + anchorRect.width / 2 - toolbarWidth / 2;
  let top = anchorRect.top - toolbarHeight - gap;

  // Keep inside viewport
  if (left < 8) left = 8;
  if (left + toolbarWidth > window.innerWidth - 8) left = window.innerWidth - 8 - toolbarWidth;
  if (top < 8) top = anchorRect.bottom + gap; // flip below if too high

  const btn = (label: string, cmd: string, value?: string, title?: string) => (
    <button
      key={cmd + (value ?? '')}
      title={title ?? label}
      onMouseDown={(e) => {
        e.preventDefault(); // keep focus in editor
        onCommand(cmd, value);
      }}
      className="px-1.5 py-0.5 text-xs font-medium rounded hover:bg-accent transition-colors"
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed flex items-center gap-0.5 bg-card border border-border rounded-md shadow-lg px-2 py-1"
      style={{ zIndex: 9999, left, top, height: toolbarHeight, minWidth: toolbarWidth }}
      data-testid="rich-text-format-toolbar"
      onMouseDown={(e) => e.preventDefault()} // prevent blur
    >
      {btn('B', 'bold', undefined, 'Bold')}
      <div className="w-px h-4 bg-border mx-0.5" />
      {btn('I', 'italic', undefined, 'Italic')}
      <div className="w-px h-4 bg-border mx-0.5" />
      {btn('U', 'underline', undefined, 'Underline')}
      <div className="w-px h-4 bg-border mx-0.5" />
      {/* Font size */}
      <select
        title="Font size"
        data-testid="rich-text-font-size"
        className="text-xs border border-border rounded px-1 py-0.5 bg-background h-6 cursor-pointer"
        defaultValue=""
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => { onCommand('fontSize', e.target.value); e.target.value = ''; }}
      >
        <option value="" disabled>Size</option>
        {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64].map((s) => (
          <option key={s} value={String(s)}>{s}</option>
        ))}
      </select>
      <div className="w-px h-4 bg-border mx-0.5" />
      {/* Font weight */}
      <select
        title="Font weight"
        data-testid="rich-text-font-weight"
        className="text-xs border border-border rounded px-1 py-0.5 bg-background h-6 cursor-pointer"
        defaultValue=""
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => { onCommand('fontWeight', e.target.value); e.target.value = ''; }}
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
      {btn('• List', 'insertUnorderedList', undefined, 'Bullet list')}
      <div className="w-px h-4 bg-border mx-0.5" />
      {btn('1. List', 'insertOrderedList', undefined, 'Numbered list')}
    </div>
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
  viewport?: { x: number; y: number; zoom: number };
  selectedCanvasObjectCount?: number;
}

export function RichTextFieldObject({
  object,
  onUpdate,
  onResize,
  onStartDrag,
  onClick,
  onContextMenu,
  viewport,
  selectedCanvasObjectCount = 0,
}: RichTextFieldObjectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Last non-collapsed selection range inside the editor. Needed because
  // interacting with the toolbar's <select> elements moves focus (and can
  // collapse the selection) before onChange fires.
  const savedRangeRef = useRef<Range | null>(null);

  const data = object.data as RichTextFieldData;
  // Validate persisted/imported data before rendering or generating HTML
  const blocks: RichTextBlock[] = React.useMemo(
    () => sanitizeBlocks(data.blocks),
    [data.blocks],
  );
  const width = object.style?.width ?? object.width ?? 300;
  const height = object.style?.height ?? object.height ?? 120;
  const zoom = viewport?.zoom ?? 1;
  const isSelected = object.selected;

  // ── Serialise contenteditable → RichTextBlock[] ─────────────────────────
  const serialise = useCallback((): RichTextBlock[] => {
    const el = editorRef.current;
    if (!el) return emptyDoc();

    const result: RichTextBlock[] = [];

    // Formatting context inherited from ancestor elements. Nested formatting
    // (e.g. <b><span style="font-size:24px">…</span></b>) must merge, not
    // flatten — each element layers its marks on top of the inherited ones.
    type Fmt = Omit<RichTextRun, 'text'>;

    const processNode = (node: Node, parentBlock: RichTextBlock, fmt: Fmt) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? '';
        if (text) {
          parentBlock.runs.push({ text, ...fmt });
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const style = el.style;

      const next: Fmt = { ...fmt };
      if (tag === 'b' || tag === 'strong') next.bold = true;
      if (tag === 'i' || tag === 'em') next.italic = true;
      if (tag === 'u') next.underline = true;
      if (style.fontWeight) {
        const fw = sanitizeFontWeight(style.fontWeight === 'bold' ? 700 : style.fontWeight);
        if (fw !== undefined) next.fontWeight = fw;
        if (style.fontWeight === 'bold' || (fw !== undefined && fw >= 700)) next.bold = true;
      }
      if (style.fontSize) {
        const fs = sanitizeFontSize(style.fontSize);
        if (fs !== undefined) next.fontSize = fs;
      }
      if (style.fontStyle === 'italic') next.italic = true;
      if (style.textDecoration?.includes('underline')) next.underline = true;

      el.childNodes.forEach((child) => processNode(child, parentBlock, next));
    };

    const processBlockEl = (el: HTMLElement, type: RichTextBlock['type']): RichTextBlock => {
      const block: RichTextBlock = { type, runs: [] };
      el.childNodes.forEach((child) => processNode(child, block, {}));
      if (block.runs.length === 0) block.runs.push({ text: '' });
      return block;
    };

    el.childNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const child = node as HTMLElement;
      const tag = child.tagName.toLowerCase();
      if (tag === 'ul') {
        child.querySelectorAll('li').forEach((li) => {
          result.push(processBlockEl(li, 'bullet'));
        });
      } else if (tag === 'ol') {
        child.querySelectorAll('li').forEach((li) => {
          result.push(processBlockEl(li, 'ordered'));
        });
      } else {
        result.push(processBlockEl(child, 'paragraph'));
      }
    });

    return result.length ? result : emptyDoc();
  }, []);

  // ── Commit edit ──────────────────────────────────────────────────────────
  const commitEdit = useCallback(() => {
    const newBlocks = serialise();
    onUpdate?.({ blocks: newBlocks });
    setIsEditing(false);
    setSelectionRect(null);
  }, [serialise, onUpdate]);

  // ── Enter edit mode ──────────────────────────────────────────────────────
  const enterEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  // Focus editor after entering edit mode
  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus();
      // Move cursor to end
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
      updateContainerRect();
    }
  }, [isEditing]);

  const updateContainerRect = () => {
    if (wrapperRef.current) {
      setContainerRect(wrapperRef.current.getBoundingClientRect());
    }
  };

  // Track selection for toolbar positioning
  const handleSelectionChange = useCallback(() => {
    if (!isEditing) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      // Only track selections that live inside this editor
      if (editorRef.current?.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
        setSelectionRect(range.getBoundingClientRect());
      }
    } else {
      // Keep the toolbar mounted while the user interacts with it (e.g. an
      // open <select> steals focus and may collapse the editor selection).
      const active = document.activeElement as HTMLElement | null;
      if (active && active.closest('[data-testid="rich-text-format-toolbar"]')) {
        return;
      }
      setSelectionRect(null);
    }
  }, [isEditing]);

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
  const handleFormatCommand = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    // Interacting with a <select> in the toolbar moves focus out of the
    // contenteditable and collapses the selection before onChange fires.
    // Restore the last known in-editor selection so the command applies
    // to the text the user actually selected.
    const currentSel = window.getSelection();
    if (
      savedRangeRef.current &&
      (!currentSel ||
        currentSel.isCollapsed ||
        currentSel.rangeCount === 0 ||
        !editorRef.current?.contains(currentSel.getRangeAt(0).commonAncestorContainer))
    ) {
      currentSel?.removeAllRanges();
      currentSel?.addRange(savedRangeRef.current.cloneRange());
    }
    switch (cmd) {
      case 'bold':
        document.execCommand('bold');
        break;
      case 'italic':
        document.execCommand('italic');
        break;
      case 'underline':
        document.execCommand('underline');
        break;
      case 'insertUnorderedList':
        document.execCommand('insertUnorderedList');
        break;
      case 'insertOrderedList':
        document.execCommand('insertOrderedList');
        break;
      case 'fontSize': {
        const size = sanitizeFontSize(value);
        if (size !== undefined) {
          // execCommand fontSize only supports 1-7; use span instead
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed) {
            document.execCommand('fontSize', false, '7'); // placeholder
            // Replace all <font size="7"> with <span style="font-size:...px">
            editorRef.current?.querySelectorAll('font[size="7"]').forEach((f) => {
              const span = document.createElement('span');
              span.style.fontSize = `${size}px`;
              span.innerHTML = f.innerHTML;
              f.replaceWith(span);
            });
          }
        }
        break;
      }
      case 'fontWeight': {
        const weight = sanitizeFontWeight(value);
        if (weight !== undefined) {
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const span = document.createElement('span');
            span.style.fontWeight = String(weight);
            try {
              range.surroundContents(span);
            } catch {
              // selection crosses element boundaries — wrap extracted content
              const fragment = range.extractContents();
              span.appendChild(fragment);
              range.insertNode(span);
            }
          }
        }
        break;
      }
    }
  }, []);

  // ── Build initial HTML from blocks ───────────────────────────────────────
  const blocksToHtml = (blocks: RichTextBlock[]): string => {
    const runToHtml = (run: RichTextRun): string => {
      let html = run.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (!html) html = '\u200B';
      const styles: string[] = [];
      if (run.fontSize) styles.push(`font-size:${run.fontSize}px`);
      if (run.fontWeight) styles.push(`font-weight:${run.fontWeight}`);
      if (run.italic) styles.push('font-style:italic');
      if (run.underline) styles.push('text-decoration:underline');
      if (run.bold && !run.fontWeight) styles.push('font-weight:700');
      if (styles.length > 0) {
        return `<span style="${styles.join(';')}">${html}</span>`;
      }
      return html;
    };

    const grouped: Array<{ type: RichTextBlock['type']; items: RichTextBlock[] }> = [];
    for (const block of blocks) {
      const last = grouped[grouped.length - 1];
      if (last && last.type === block.type && block.type !== 'paragraph') {
        last.items.push(block);
      } else {
        grouped.push({ type: block.type, items: [block] });
      }
    }

    return grouped
      .map(({ type, items }) => {
        if (type === 'bullet') {
          const lis = items.map((b) => `<li>${b.runs.map(runToHtml).join('')}</li>`).join('');
          return `<ul style="margin:0;padding-left:1.2em;">${lis}</ul>`;
        }
        if (type === 'ordered') {
          const lis = items.map((b) => `<li>${b.runs.map(runToHtml).join('')}</li>`).join('');
          return `<ol style="margin:0;padding-left:1.2em;">${lis}</ol>`;
        }
        return `<div>${items[0].runs.map(runToHtml).join('')}</div>`;
      })
      .join('');
  };

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
      if (group.type === 'bullet') {
        return (
          <ul key={gi} style={{ margin: 0, paddingLeft: '1.2em' }}>
            {group.items.map((block, bi) => (
              <li key={bi}>{renderRuns(block.runs, data.fontSize ?? 14, data.textColor ?? '#000000')}</li>
            ))}
          </ul>
        );
      }
      if (group.type === 'ordered') {
        return (
          <ol key={gi} style={{ margin: 0, paddingLeft: '1.2em' }}>
            {group.items.map((block, bi) => (
              <li key={bi}>{renderRuns(block.runs, data.fontSize ?? 14, data.textColor ?? '#000000')}</li>
            ))}
          </ol>
        );
      }
      return (
        <div key={gi}>
          {renderRuns(group.items[0].runs, data.fontSize ?? 14, data.textColor ?? '#000000')}
        </div>
      );
    });
  };

  const isOnlySelected = isSelected && selectedCanvasObjectCount === 1;

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
          overflow: 'hidden',
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
          enterEdit();
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
            dangerouslySetInnerHTML={{ __html: blocksToHtml(blocks) }}
            onKeyDown={handleKeyDown}
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
            style={{
              width: '100%',
              height: '100%',
              outline: 'none',
              padding: '8px',
              fontSize: data.fontSize ? `${data.fontSize}px` : '14px',
              fontFamily: data.fontFamily ?? 'Inter, system-ui, sans-serif',
              color: data.textColor ?? '#000000',
              boxSizing: 'border-box',
              overflowY: 'auto',
              lineHeight: 1.5,
            }}
          />
        ) : (
          /* ── Read-only view ── */
          <div
            style={{
              width: '100%',
              height: '100%',
              padding: '8px',
              fontSize: data.fontSize ? `${data.fontSize}px` : '14px',
              fontFamily: data.fontFamily ?? 'Inter, system-ui, sans-serif',
              color: data.textColor ?? '#000000',
              boxSizing: 'border-box',
              overflowY: 'hidden',
              lineHeight: 1.5,
              pointerEvents: 'none',
            }}
          >
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

        {/* Resize handles */}
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

      {/* Format toolbar (only while editing and text is selected) */}
      {isEditing && selectionRect && (
        <FormatToolbar
          anchorRect={selectionRect}
          containerRect={containerRect}
          onCommand={handleFormatCommand}
          zoom={zoom}
        />
      )}
    </>
  );
}
