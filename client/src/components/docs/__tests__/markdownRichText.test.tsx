import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRichEditor } from '../MarkdownRichEditor';
import {
  hasUnsupportedRichMarkdown,
  markdownToRichHtml,
  richHtmlToMarkdown,
} from '../markdownRichText';

const INPUTS_MARKDOWN = ['## Inputs', '', '- Email'].join('\n');

function selectBlock(block: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(block);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  fireEvent(document, new Event('selectionchange'));
}

describe('markdown rich-text conversion', () => {
  it('round-trips the supported PRD formatting subset', () => {
    const source = [
      '## Inputs',
      '',
      '- **Account email**',
      '- [Reference](https://example.com/reference)',
      '',
      '> Confirm the input before continuing.',
      '',
      '```',
      'const ready = true;',
      '```',
      '',
      '---',
    ].join('\n');
    const container = document.createElement('div');
    container.innerHTML = markdownToRichHtml(source);

    expect(richHtmlToMarkdown(container)).toBe(source);
  });

  it('only permits safe link protocols when making editable HTML', () => {
    const html = markdownToRichHtml('[Safe](https://example.com) and [Unsafe](javascript:alert(1))');

    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('javascript:');
  });

  it('routes rich-text-unsafe markdown to source mode', () => {
    expect(hasUnsupportedRichMarkdown('| Name | Value |\n| --- | --- |')).toBe(true);
    expect(hasUnsupportedRichMarkdown('![Diagram](https://example.com/a.png)')).toBe(true);
    expect(hasUnsupportedRichMarkdown('[Unsafe](javascript:alert(1))')).toBe(true);
    expect(hasUnsupportedRichMarkdown('## Outputs\n\n- A response record')).toBe(false);
  });
});

function EditorHarness({ initialValue, onSave, onCancel }: {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <MarkdownRichEditor
      value={value}
      density="rail"
      sectionKey="inputs-outputs"
      onChange={setValue}
      onSave={() => onSave(value)}
      onCancel={onCancel ?? (() => undefined)}
    />
  );
}

describe('MarkdownRichEditor', () => {
  it('lets a user switch to markdown, edit it, and save the same canonical string', () => {
    const onSave = vi.fn();
    render(<EditorHarness initialValue="## Inputs\n\n- Email" onSave={onSave} />);

    fireEvent.click(screen.getByTestId('markdown-mode-inputs-outputs'));
    const textarea = screen.getByTestId('textarea-inputs-outputs');
    fireEvent.change(textarea, { target: { value: '## Inputs\n\n- Email\n- Account ID' } });
    fireEvent.click(screen.getByTestId('save-edit-inputs-outputs'));

    expect(onSave).toHaveBeenCalledWith('## Inputs\n\n- Email\n- Account ID');
  });

  it('rehydrates the rich editor after switching back from markdown', () => {
    const onSave = vi.fn();
    render(<EditorHarness initialValue={INPUTS_MARKDOWN} onSave={onSave} />);

    fireEvent.click(screen.getByTestId('markdown-mode-inputs-outputs'));
    fireEvent.click(screen.getByTestId('rich-mode-inputs-outputs'));

    const editor = screen.getByTestId('rich-editor-inputs-outputs');
    expect(editor).toHaveTextContent('Inputs');
    expect(editor).toHaveTextContent('Email');
    expect(editor.querySelector('h2')).toHaveTextContent('Inputs');

    fireEvent.click(screen.getByTestId('save-edit-inputs-outputs'));
    expect(onSave).toHaveBeenCalledWith(INPUTS_MARKDOWN);
  });

  it('shows edited markdown and saves new rich-text input after a mode round trip', () => {
    const onSave = vi.fn();
    render(<EditorHarness initialValue="## Inputs\n\n- Email" onSave={onSave} />);

    fireEvent.click(screen.getByTestId('markdown-mode-inputs-outputs'));
    fireEvent.change(screen.getByTestId('textarea-inputs-outputs'), {
      target: { value: '## Inputs\n\n- Account ID' },
    });
    fireEvent.click(screen.getByTestId('rich-mode-inputs-outputs'));

    const editor = screen.getByTestId('rich-editor-inputs-outputs');
    expect(editor).toHaveTextContent('Account ID');
    expect(editor).not.toHaveTextContent('Email');

    editor.innerHTML += '<p>Outputs are ready.</p>';
    fireEvent.input(editor);
    fireEvent.click(screen.getByTestId('save-edit-inputs-outputs'));

    expect(onSave).toHaveBeenCalledWith('## Inputs\n\n- Account ID\n\nOutputs are ready.');
  });

  it('shows the selected block format in the rich-text toolbar', () => {
    render(<EditorHarness initialValue={'# Title\n\n## Subtitle\n\n### Detail\n\nParagraph\n\n> Quoted\n\n```\nconst ready = true;\n```'} onSave={vi.fn()} />);
    const editor = screen.getByTestId('rich-editor-inputs-outputs');

    const cases: Array<[string, HTMLElement]> = [
      ['Heading 1', editor.querySelector('h1')!],
      ['Heading 2', editor.querySelector('h2')!],
      ['Heading 3', editor.querySelector('h3')!],
      ['Body text', editor.querySelector('p')!],
      ['Quote', editor.querySelector('blockquote')!],
      ['Code block', editor.querySelector('pre')!],
    ];

    for (const [label, block] of cases) {
      selectBlock(block);
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('restores an editable caret when formatted content is opened again', () => {
    const first = render(<EditorHarness initialValue="## Saved heading\n\nSaved body" onSave={vi.fn()} />);
    const firstEditor = screen.getByTestId('rich-editor-inputs-outputs');
    expect(firstEditor.contains(window.getSelection()?.anchorNode ?? null)).toBe(true);

    first.unmount();
    render(<EditorHarness initialValue="## Saved heading\n\nSaved body" onSave={vi.fn()} />);

    const reopenedEditor = screen.getByTestId('rich-editor-inputs-outputs');
    expect(reopenedEditor).toHaveTextContent('Saved heading');
    expect(reopenedEditor.contains(window.getSelection()?.anchorNode ?? null)).toBe(true);
  });

  it('toggles active block formats to Body text', () => {
    const execCommand = vi.fn(() => true);
    const originalExecCommand = document.execCommand;
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

    try {
      render(<EditorHarness initialValue={'## Heading\n\n> Quote\n\n```\nconst ready = true;\n```\n\nParagraph'} onSave={vi.fn()} />);
      const editor = screen.getByTestId('rich-editor-inputs-outputs');

      selectBlock(editor.querySelector('h2')!);
      fireEvent.click(screen.getByRole('button', { name: 'Heading 2' }));
      expect(execCommand).toHaveBeenLastCalledWith('formatBlock', false, 'p');

      selectBlock(editor.querySelector('blockquote')!);
      fireEvent.click(screen.getByRole('button', { name: 'Quote' }));
      expect(execCommand).toHaveBeenLastCalledWith('formatBlock', false, 'p');
      expect(editor.querySelector('blockquote')).toBeNull();
      expect(Array.from(editor.querySelectorAll('p')).find((paragraph) => paragraph.textContent === 'Quote')).toBeTruthy();

      selectBlock(editor.querySelector('pre')!);
      fireEvent.click(screen.getByRole('button', { name: 'Code block' }));
      expect(execCommand).toHaveBeenLastCalledWith('formatBlock', false, 'p');
      expect(editor.querySelector('pre')).toBeNull();

      selectBlock(editor.querySelector('p')!);
      fireEvent.click(screen.getByRole('button', { name: 'Body text' }));
      expect(execCommand).toHaveBeenLastCalledWith('formatBlock', false, 'p');
    } finally {
      Object.defineProperty(document, 'execCommand', { configurable: true, value: originalExecCommand });
    }
  });

  it('keeps advanced markdown in source mode and exposes a clear explanation', () => {
    render(<EditorHarness initialValue="| Input | Output |\n| --- | --- |" onSave={vi.fn()} />);

    expect(screen.getByTestId('textarea-inputs-outputs')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-markdown-notice-inputs-outputs')).toBeInTheDocument();
    expect(screen.getByTestId('rich-mode-inputs-outputs')).toBeDisabled();
  });

  it('cancels without calling save', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(<EditorHarness initialValue="Initial content" onSave={onSave} onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId('cancel-edit-inputs-outputs'));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});