import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  closeReader,
  forceOpenInReader,
  openInReader,
  setReaderNavigationGuard,
  targetDocId,
  useReaderTarget,
} from '../readerStore';

function ReaderTargetProbe() {
  const target = useReaderTarget();
  return <output data-testid="target">{target ? targetDocId(target) : 'closed'}</output>;
}

afterEach(() => {
  act(() => closeReader());
});

describe('reader note targets', () => {
  it('opens and switches notes within the existing reader target', () => {
    render(<ReaderTargetProbe />);

    act(() => {
      expect(openInReader({ docKind: 'note', noteId: 'note-a' })).toBe(true);
    });
    expect(screen.getByTestId('target')).toHaveTextContent('note:note-a');

    act(() => {
      expect(openInReader({ docKind: 'note', noteId: 'note-b' })).toBe(true);
    });
    expect(screen.getByTestId('target')).toHaveTextContent('note:note-b');
  });

  it('rejects a note target with no addressable note id', () => {
    expect(openInReader({ docKind: 'note' })).toBe(false);
  });

  it('opens an addressable prompt conversation and rejects an unaddressable one', () => {
    render(<ReaderTargetProbe />);

    act(() => {
      expect(openInReader({ docKind: 'prompt-conversation', conversationId: 'prompt-a' })).toBe(true);
    });
    expect(screen.getByTestId('target')).toHaveTextContent('prompt-conversation:prompt-a');

    expect(openInReader({ docKind: 'prompt-conversation' })).toBe(false);
  });

  it('defers global document transitions while a reader draft is active', () => {
    render(<ReaderTargetProbe />);
    let requested = '';
    const removeGuard = setReaderNavigationGuard(next => {
      requested = next ? targetDocId(next) : 'close';
      return true;
    });

    act(() => {
      expect(openInReader({ docKind: 'project-prd' })).toBe(true);
    });
    expect(requested).toBe('project-prd');
    expect(screen.getByTestId('target')).toHaveTextContent('closed');

    act(() => {
      expect(forceOpenInReader({ docKind: 'project-prd' })).toBe(true);
    });
    expect(screen.getByTestId('target')).toHaveTextContent('project-prd');
    removeGuard();
  });
});