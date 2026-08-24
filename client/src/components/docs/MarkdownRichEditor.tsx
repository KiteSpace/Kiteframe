import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  MessageSquareQuote,
  Minus,
  Save,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { hasUnsupportedRichMarkdown, markdownToRichHtml, richHtmlToMarkdown } from './markdownRichText';
import type { DocDensity } from './types';

type EditorMode = 'rich' | 'markdown';
export type BlockFormat = 'body' | 'h1' | 'h2' | 'h3' | 'blockquote' | 'pre';

function getSelectedBlockElement(editor: HTMLElement | null): HTMLElement | null {
  const selection = window.getSelection();
  if (!editor || !selection?.rangeCount || !selection.anchorNode || !editor.contains(selection.anchorNode)) {
    return null;
  }

  let node: Node | null = selection.anchorNode;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

  while (node && node !== editor) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = (node as HTMLElement).tagName.toLowerCase();
      if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'blockquote' || tagName === 'pre') {
        return node as HTMLElement;
      }
    }
    node = node.parentNode;
  }

  return null;
}

export function getSelectedBlockFormat(editor: HTMLElement | null): BlockFormat {
  const block = getSelectedBlockElement(editor);
  if (block) return block.tagName.toLowerCase() as BlockFormat;
  return 'body';
}

function resetSelectedBlockToBody(editor: HTMLElement): boolean {
  const block = getSelectedBlockElement(editor);
  if (!block) return false;

  const paragraph = block.tagName.toLowerCase() === 'blockquote'
    && block.children.length === 1
    && block.firstElementChild?.tagName.toLowerCase() === 'p'
    ? block.firstElementChild
    : document.createElement('p');
  if (paragraph !== block.firstElementChild) {
    while (block.firstChild) paragraph.appendChild(block.firstChild);
  }
  block.replaceWith(paragraph);

  const range = document.createRange();
  range.selectNodeContents(paragraph);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return true;
}

function focusRichEditor(editor: HTMLElement) {
  editor.focus();
  const selection = window.getSelection();
  if (selection?.rangeCount && selection.anchorNode && editor.contains(selection.anchorNode)) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

interface MarkdownRichEditorProps {
  value: string;
  density: DocDensity;
  sectionKey: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const TOOLBAR_BUTTON_CLASS = 'h-7 w-7 p-0 text-muted-foreground hover:text-foreground';
const TOOLBAR_ACTIVE_BUTTON_CLASS = 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary';

export function MarkdownRichEditor({
  value,
  density,
  sectionKey,
  onChange,
  onSave,
  onCancel,
}: MarkdownRichEditorProps) {
  const richEditorRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const lastEditorMarkdownRef = useRef('');
  const [mode, setMode] = useState<EditorMode>(() => (
    hasUnsupportedRichMarkdown(value) ? 'markdown' : 'rich'
  ));
  const previousModeRef = useRef<EditorMode>(mode);
  const [activeBlockFormat, setActiveBlockFormat] = useState<BlockFormat>('body');
  const unsupportedInRichMode = hasUnsupportedRichMarkdown(value);
  const isReader = density === 'reader';

  const hydrateRichEditor = useCallback((markdown: string) => {
    const editor = richEditorRef.current;
    if (!editor) return;
    editor.innerHTML = markdownToRichHtml(markdown);
    lastEditorMarkdownRef.current = markdown;
  }, []);

  useEffect(() => {
    if (mode !== 'rich') {
      previousModeRef.current = mode;
      setActiveBlockFormat('body');
      return;
    }

    // Rich mode mounts a new contentEditable after a Markdown -> Rich
    // transition. Its DOM starts empty even though the draft value and the
    // last-serialised ref are identical, so the value-change guard alone
    // cannot decide whether hydration is needed.
    if (previousModeRef.current !== 'rich' || value !== lastEditorMarkdownRef.current) {
      hydrateRichEditor(value);
    }
    previousModeRef.current = mode;
  }, [mode, value, hydrateRichEditor]);

  const updateActiveBlockFormat = useCallback(() => {
    if (mode !== 'rich') return;
    setActiveBlockFormat(getSelectedBlockFormat(richEditorRef.current));
  }, [mode]);

  useEffect(() => {
    if (mode === 'rich' && richEditorRef.current) {
      focusRichEditor(richEditorRef.current);
      updateActiveBlockFormat();
    }
  }, [mode, updateActiveBlockFormat]);

  useEffect(() => {
    if (mode !== 'rich') return;
    const handleSelectionChange = () => updateActiveBlockFormat();
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [mode, updateActiveBlockFormat]);

  const switchMode = useCallback((nextMode: EditorMode) => {
    if (nextMode === 'rich' && unsupportedInRichMode) return;
    if (nextMode === mode) return;
    if (mode === 'rich' && richEditorRef.current) {
      const nextValue = richHtmlToMarkdown(richEditorRef.current);
      lastEditorMarkdownRef.current = nextValue;
      onChange(nextValue);
    }
    setMode(nextMode);
  }, [mode, onChange, unsupportedInRichMode]);

  const handleRichInput = useCallback(() => {
    if (!richEditorRef.current) return;
    const nextValue = richHtmlToMarkdown(richEditorRef.current);
    lastEditorMarkdownRef.current = nextValue;
    onChange(nextValue);
    updateActiveBlockFormat();
  }, [onChange, updateActiveBlockFormat]);

  const runCommand = useCallback((command: string, commandValue?: string) => {
    const editor = richEditorRef.current;
    if (!editor) return;
    const currentBlockFormat = getSelectedBlockFormat(editor);
    const isBlockFormatCommand = command === 'formatBlock';
    const requestedBlockFormat = commandValue as BlockFormat | undefined;
    const nextCommandValue = isBlockFormatCommand && requestedBlockFormat
      ? (requestedBlockFormat === currentBlockFormat && requestedBlockFormat !== 'body' ? 'p' : requestedBlockFormat)
      : commandValue;
    editor.focus();
    try {
      document.execCommand('styleWithCSS', false, 'false');
      if (isBlockFormatCommand && requestedBlockFormat === currentBlockFormat && requestedBlockFormat !== 'body') {
        resetSelectedBlockToBody(editor);
      }
      document.execCommand(command, false, nextCommandValue);
      if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
        editor.querySelectorAll('ul, ol').forEach((list) => {
          const element = list as HTMLElement;
          element.style.listStyleType = element.tagName.toLowerCase() === 'ol' ? 'decimal' : 'disc';
          element.style.paddingLeft = '1.25rem';
        });
      }
      handleRichInput();
      updateActiveBlockFormat();
    } catch {
      // The source editor remains available in browsers that do not implement
      // a legacy rich-text command.
    }
  }, [handleRichInput, updateActiveBlockFormat]);

  const addLink = useCallback(() => {
    const href = window.prompt('Paste a link');
    if (href?.trim()) runCommand('createLink', href.trim());
  }, [runCommand]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      onSave();
    }
  }, [onCancel, onSave]);

  const handleBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && shellRef.current?.contains(nextTarget)) return;
    onSave();
  }, [onSave]);

  return (
    <div
      ref={shellRef}
      className="space-y-2 rounded-md border border-primary/20 bg-background p-2"
      onBlur={handleBlur}
      data-testid={`section-editor-${sectionKey}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
        <div className="inline-flex rounded-md bg-muted p-0.5" aria-label="Editing mode">
          <button
            type="button"
            className={cn(
              'rounded px-2 py-1 text-[11px] font-medium transition-colors',
              mode === 'rich' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              unsupportedInRichMode && 'cursor-not-allowed opacity-50',
            )}
            onClick={() => switchMode('rich')}
            disabled={unsupportedInRichMode}
            title={unsupportedInRichMode ? 'This section uses advanced markdown. Edit it in Markdown mode to preserve every detail.' : undefined}
            data-testid={`rich-mode-${sectionKey}`}
          >
            Rich text
          </button>
          <button
            type="button"
            className={cn(
              'rounded px-2 py-1 text-[11px] font-medium transition-colors',
              mode === 'markdown' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => switchMode('markdown')}
            data-testid={`markdown-mode-${sectionKey}`}
          >
            Markdown
          </button>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={onCancel} data-testid={`cancel-edit-${sectionKey}`}>
            <X size={12} className="mr-1" />
            Cancel
          </Button>
          <Button type="button" size="sm" className="h-7 px-2 text-[11px]" onClick={onSave} data-testid={`save-edit-${sectionKey}`}>
            <Save size={12} className="mr-1" />
            Save
          </Button>
        </div>
      </div>

      {unsupportedInRichMode && (
        <p className="rounded bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" data-testid={`advanced-markdown-notice-${sectionKey}`}>
          This section uses advanced markdown that rich text cannot safely preserve. Edit it in Markdown mode.
        </p>
      )}

      {mode === 'rich' ? (
        <>
          <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Text formatting">
            <Button type="button" variant="ghost" size="sm" className={TOOLBAR_BUTTON_CLASS} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('bold')} aria-label="Bold" title="Bold"><Bold size={13} /></Button>
            <Button type="button" variant="ghost" size="sm" className={TOOLBAR_BUTTON_CLASS} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('italic')} aria-label="Italic" title="Italic"><Italic size={13} /></Button>
            <Button type="button" variant="ghost" size="sm" className={cn('h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground', activeBlockFormat === 'body' && TOOLBAR_ACTIVE_BUTTON_CLASS)} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'p')} aria-label="Body text" aria-pressed={activeBlockFormat === 'body'} title="Body text">Body</Button>
            <Button type="button" variant="ghost" size="sm" className={cn(TOOLBAR_BUTTON_CLASS, activeBlockFormat === 'h1' && TOOLBAR_ACTIVE_BUTTON_CLASS)} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'h1')} aria-label="Heading 1" aria-pressed={activeBlockFormat === 'h1'} title="Heading 1"><Heading1 size={13} /></Button>
            <Button type="button" variant="ghost" size="sm" className={cn(TOOLBAR_BUTTON_CLASS, activeBlockFormat === 'h2' && TOOLBAR_ACTIVE_BUTTON_CLASS)} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'h2')} aria-label="Heading 2" aria-pressed={activeBlockFormat === 'h2'} title="Heading 2"><Heading2 size={13} /></Button>
            <Button type="button" variant="ghost" size="sm" className={cn(TOOLBAR_BUTTON_CLASS, activeBlockFormat === 'h3' && TOOLBAR_ACTIVE_BUTTON_CLASS)} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'h3')} aria-label="Heading 3" aria-pressed={activeBlockFormat === 'h3'} title="Heading 3"><Heading3 size={13} /></Button>
            <Button type="button" variant="ghost" size="sm" className={TOOLBAR_BUTTON_CLASS} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertUnorderedList')} aria-label="Bulleted list" title="Bulleted list"><List size={13} /></Button>
            <Button type="button" variant="ghost" size="sm" className={TOOLBAR_BUTTON_CLASS} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertOrderedList')} aria-label="Numbered list" title="Numbered list"><ListOrdered size={13} /></Button>
            <Button type="button" variant="ghost" size="sm" className={cn(TOOLBAR_BUTTON_CLASS, activeBlockFormat === 'blockquote' && TOOLBAR_ACTIVE_BUTTON_CLASS)} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'blockquote')} aria-label="Quote" aria-pressed={activeBlockFormat === 'blockquote'} title="Quote"><MessageSquareQuote size={13} /></Button>
            <Button type="button" variant="ghost" size="sm" className={cn(TOOLBAR_BUTTON_CLASS, activeBlockFormat === 'pre' && TOOLBAR_ACTIVE_BUTTON_CLASS)} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('formatBlock', 'pre')} aria-label="Code block" aria-pressed={activeBlockFormat === 'pre'} title="Code block"><Code size={13} /></Button>
            <Button type="button" variant="ghost" size="sm" className={TOOLBAR_BUTTON_CLASS} onMouseDown={(event) => event.preventDefault()} onClick={addLink} aria-label="Add link" title="Add link"><Link size={13} /></Button>
            <Button type="button" variant="ghost" size="sm" className={TOOLBAR_BUTTON_CLASS} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('insertHorizontalRule')} aria-label="Divider" title="Divider"><Minus size={13} /></Button>
          </div>
          <div
            ref={richEditorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Rich text editor"
            className={cn(
              'min-h-[120px] rounded px-2 py-1.5 text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-primary/25',
              '[&>p]:mb-2 [&>h1]:mb-2 [&>h1]:text-xl [&>h1]:font-bold [&>h1]:leading-snug [&>h2]:mb-2 [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:leading-snug [&>h3]:mb-1 [&>h3]:text-base [&>h3]:font-semibold [&>h3]:leading-snug [&>ul]:my-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:my-2 [&>ol]:list-decimal [&>ol]:pl-5 [&>blockquote]:my-2 [&>blockquote]:border-l-2 [&>blockquote]:border-primary/40 [&>blockquote]:pl-3 [&>pre]:my-2 [&>pre]:overflow-x-auto [&>pre]:rounded [&>pre]:bg-muted [&>pre]:p-2 [&>pre]:font-mono [&>pre]:text-xs [&>hr]:my-3',
              isReader && 'min-h-[180px] text-[15px] leading-[1.7]',
            )}
            onInput={handleRichInput}
            onMouseUp={updateActiveBlockFormat}
            onKeyUp={updateActiveBlockFormat}
            onPaste={(event) => {
              const text = event.clipboardData.getData('text/plain');
              if (!text) return;
              event.preventDefault();
              document.execCommand('insertText', false, text);
              handleRichInput();
            }}
            onKeyDown={handleKeyDown}
            data-testid={`rich-editor-${sectionKey}`}
          />
        </>
      ) : (
        <Textarea
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
            'min-h-[160px] resize-y border-0 bg-muted/40 font-mono text-xs leading-relaxed shadow-none focus-visible:ring-2',
            isReader && 'min-h-[200px] text-[13px]',
          )}
          placeholder="Write markdown..."
          spellCheck={false}
          data-testid={`textarea-${sectionKey}`}
        />
      )}

      <div className="flex justify-end gap-2 text-[10px] text-muted-foreground">
        <span>Esc to cancel</span>
        <span>·</span>
        <span>⌘+Enter to save</span>
      </div>
    </div>
  );
}