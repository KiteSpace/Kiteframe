import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertOperationActive, beginBackgroundCommit, cancelOperation, dismissOperation,
  getOperations, inheritOperationSignal, operationForSignal, retainedCell,
  runBackgroundOperation, setOperationOwner, withOperationSignal,
} from '../backgroundOperations';
import { useBackgroundCallback, useRetainedAiState } from '../useBackgroundOperation';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
};
afterEach(() => { act(() => setOperationOwner(null, true)); });

describe('view-independent AI ownership', () => {
  it('retains progress and saves only the original project after a view switch and unmount', async () => {
    const gate = deferred();
    const persisted = vi.fn();
    let requests = 0;
    function Panel({ scope }: { scope: string }) {
      const [value, setValue] = useRetainedAiState(scope, 'result', '', v => { persisted(scope, v); });
      const start = useBackgroundCallback(scope, 'Generate', async signal => {
        requests++;
        await gate.promise;
        assertOperationActive(signal);
        setValue(`Completed ${scope}`);
      }, [scope]);
      return <><button onClick={() => void start()}>Generate</button><output>{value || 'Empty'}</output></>;
    }
    const view = render(<Panel scope="project:A" />);
    fireEvent.click(screen.getByText('Generate'));
    await act(async () => { await Promise.resolve(); });
    view.rerender(<Panel scope="project:B" />);
    expect(screen.getByText('Empty')).toBeTruthy();
    view.unmount();
    const returned = render(<Panel scope="project:A" />);
    fireEvent.click(screen.getByText('Generate')); // Remount must not submit twice.
    expect(requests).toBe(1);
    returned.unmount();
    await act(async () => { gate.resolve(); await gate.promise; });
    render(<Panel scope="project:A" />);
    expect(screen.getByText('Completed project:A')).toBeTruthy();
    expect(persisted).toHaveBeenCalledExactlyOnceWith('project:A', 'Completed project:A');
    expect(getOperations().find(op => op.key === 'project:A')?.status).toBe('completed');
  });

  it('allows independent projects to finish in either order', async () => {
    const a = deferred(), b = deferred();
    const results: string[] = [];
    const first = runBackgroundOperation('a', 'A', async () => { await a.promise; results.push('a'); });
    const second = runBackgroundOperation('b', 'B', async () => { await b.promise; results.push('b'); });
    b.resolve(); await second;
    expect(results).toEqual(['b']);
    expect(getOperations().find(op => op.key === 'a')?.status).toBe('running');
    a.resolve(); await first;
    expect(results).toEqual(['b', 'a']);
  });

  it('stops explicitly without applying a late result or stranding the duplicate lock', async () => {
    const gate = deferred(), saved = vi.fn();
    const run = runBackgroundOperation('a', 'A', async signal => {
      await gate.promise; assertOperationActive(signal); saved();
    });
    await Promise.resolve();
    cancelOperation('a'); dismissOperation('a');
    expect(getOperations()[0].status).toBe('cancelled');
    gate.resolve(); await run;
    expect(saved).not.toHaveBeenCalled();
    dismissOperation('a');
    await runBackgroundOperation('a', 'Retry', async () => { saved(); });
    expect(saved).toHaveBeenCalledOnce();
  });

  it('retains failures and retries exactly once', async () => {
    let attempts = 0;
    const work = async () => { if (++attempts === 1) throw new Error('Provider failed'); return 'OK'; };
    await runBackgroundOperation('a', 'A', work);
    expect(getOperations()[0]).toMatchObject({ status: 'failed', error: 'Provider failed', settled: true });
    await getOperations()[0].retry();
    expect(attempts).toBe(2);
    expect(getOperations()[0].status).toBe('completed');
  });

  it('invalidates old setters and clients when the user changes', async () => {
    setOperationOwner('first');
    const cell = retainedCell('a', 'before');
    const chat = vi.fn().mockResolvedValue({ text: 'reply' });
    const oldClient = withOperationSignal({ chat }, 'a');
    setOperationOwner('second');
    const save = vi.fn();
    cell.write('late result', save);
    expect(save).not.toHaveBeenCalled();
    expect(retainedCell('a', 'second user').read()).toBe('second user');
    await expect(oldClient.chat({})).rejects.toMatchObject({ name: 'AbortError' });
    expect(chat).not.toHaveBeenCalled();
  });

  it('inherits Spec section ownership and prevents cancellation during an atomic save', async () => {
    const gate = deferred();
    const run = runBackgroundOperation('spec:a', 'Spec', async signal => {
      const child = new AbortController();
      inheritOperationSignal(signal, child.signal);
      expect(operationForSignal(child.signal)).toBe('spec:a');
      beginBackgroundCommit(signal);
      cancelOperation('spec:a');
      expect(signal.aborted).toBe(false);
      await gate.promise;
    });
    await Promise.resolve();
    gate.resolve(); await run;
    expect(getOperations()[0].status).toBe('completed');
  });
});
