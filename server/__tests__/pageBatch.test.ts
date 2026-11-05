import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runPageBatch } from '@shared/pageBatch';
import { mergePageStates } from '../lib/mergePageStates';
import { layoutArtboards, sanitizeRootType } from '../lib/designPatchMerge';

const delay = (ms: number, value: string, signal?: AbortSignal) => new Promise<string>((resolve, reject) => {
  const t = setTimeout(() => resolve(value), ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); });
});

describe('runPageBatch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('warms with item 1 alone, then runs at most 3 at once, keeping input order', async () => {
    let running = 0; let peak = 0; const started: number[] = [];
    const p = runPageBatch([100, 50, 300, 10, 20, 30], async (ms, i) => {
      started.push(i); running++; peak = Math.max(peak, running);
      try { return await delay(ms, `p${i}`); } finally { running--; }
    });
    await vi.advanceTimersByTimeAsync(99);
    expect(started).toEqual([0]);
    await vi.advanceTimersByTimeAsync(1);
    expect(started).toEqual([0, 1, 2, 3]);
    await vi.runAllTimersAsync();
    const results = await p;
    expect(peak).toBe(3);
    expect(results.map((r) => (r.status === 'done' ? r.value : r.status))).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
  });

  it('a failed item does not stop the others', async () => {
    const p = runPageBatch([1, 2, 3], async (n) => { if (n === 2) throw new Error('boom'); return delay(10, `ok${n}`); });
    await vi.runAllTimersAsync();
    expect((await p).map((r) => r.status)).toEqual(['done', 'failed', 'done']);
  });

  it('cancel stops queued items and reports running ones as cancelled', async () => {
    const controller = new AbortController();
    const statuses: string[] = [];
    const p = runPageBatch([10, 10, 10, 10, 10, 10], (ms, i, signal) => delay(ms, `p${i}`, signal), {
      signal: controller.signal, onStatus: (i, s) => statuses.push(`${i}:${s}`),
    });
    await vi.advanceTimersByTimeAsync(15);
    controller.abort();
    await vi.runAllTimersAsync();
    const results = await p;
    expect(results[0].status).toBe('done');
    expect(results.slice(1).every((r) => r.status === 'cancelled')).toBe(true);
    expect(statuses).toContain('5:cancelled');
    expect(statuses).not.toContain('5:running');
  });
});

describe('mergePageStates', () => {
  const page = (screenId: string) => ({
    ROOT: { type: { resolvedName: 'AstryxSection' }, nodes: ['ab', 'stray'], parent: null },
    ab: { type: { resolvedName: 'AstryxArtboard' }, props: { label: screenId }, custom: { interfaceScreenId: screenId }, parent: 'ROOT', nodes: ['h'], linkedNodes: {} },
    h: { type: { resolvedName: 'AstryxHeading' }, props: { text: screenId }, parent: 'ab', nodes: [], linkedNodes: { slot: 'h' } },
  });

  it('prefixes ids per page and keeps ROOT valid', () => {
    const merged = mergePageStates([page('a'), page('b')]) as any;
    expect(merged.ROOT.nodes).toEqual(['fi0_ab', 'fi1_ab']);
    expect(merged.fi1_ab.nodes).toEqual(['fi1_h']);
    expect(merged.fi1_h.parent).toBe('fi1_ab');
    expect(merged.fi1_h.linkedNodes).toEqual({ slot: 'fi1_h' });
    for (const [id, n] of Object.entries(merged) as any) {
      if (id === 'ROOT') continue;
      expect(merged[n.parent]).toBeDefined();
      for (const child of n.nodes) expect(merged[child]).toBeDefined();
    }
    const laid = layoutArtboards(sanitizeRootType(merged)) as any;
    expect(laid.ROOT.nodes).toEqual(['fi0_ab', 'fi1_ab']);
  });
});
