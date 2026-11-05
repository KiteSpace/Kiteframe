export type PageStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
export type BatchResult<R> =
  | { status: 'done'; value: R }
  | { status: 'failed'; error: string }
  | { status: 'cancelled' };

export interface PageBatchOptions {
  concurrency?: number;
  /** Run the first item alone so later items reuse its prompt-cache write. */
  warmFirst?: boolean;
  signal?: AbortSignal;
  onStatus?: (index: number, status: PageStatus, error?: string) => void;
}

/** Runs `worker` over `items` with bounded concurrency; results keep input order. Cancel stops queued items. */
export async function runPageBatch<T, R>(
  items: T[],
  worker: (item: T, index: number, signal: AbortSignal | undefined) => Promise<R>,
  opts: PageBatchOptions = {},
): Promise<BatchResult<R>[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 3);
  const results: BatchResult<R>[] = items.map(() => ({ status: 'cancelled' }));
  items.forEach((_, i) => opts.onStatus?.(i, 'queued'));
  const runOne = async (i: number) => {
    if (opts.signal?.aborted) return;
    opts.onStatus?.(i, 'running');
    try {
      const value = await worker(items[i], i, opts.signal);
      if (opts.signal?.aborted) { opts.onStatus?.(i, 'cancelled'); return; }
      results[i] = { status: 'done', value };
      opts.onStatus?.(i, 'done');
    } catch (e) {
      if (opts.signal?.aborted) { opts.onStatus?.(i, 'cancelled'); return; }
      const error = e instanceof Error ? e.message : String(e);
      results[i] = { status: 'failed', error };
      opts.onStatus?.(i, 'failed', error);
    }
  };
  let next = 0;
  if (opts.warmFirst !== false && items.length > 1) await runOne(next++);
  const lane = async () => { while (next < items.length && !opts.signal?.aborted) await runOne(next++); };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  results.forEach((r, i) => { if (r.status === 'cancelled' && i >= next) opts.onStatus?.(i, 'cancelled'); });
  return results;
}
