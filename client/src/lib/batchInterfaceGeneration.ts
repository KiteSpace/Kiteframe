import {
  buildPageBrief, selectInterfacePages, selectedInterfaceSurfaces, type InterfacePlan, type PageBrief,
} from '@shared/interfacePlan';
import { runPageBatch, type PageStatus } from '@shared/pageBatch';

export const MOCK_WORKFLOW_BATCH_FLAG = 'mock_workflow_batch';
export const PAGE_CONCURRENCY = 3;

export interface PageRun { screenId: string; name: string; status: PageStatus; error?: string }
export interface PageResult { craftState: string; warnings: string[] }

/**
 * One generation per selected page (page 1 first to warm the prompt cache, then 3 at a time).
 * Pages already in `completed` are reused, so running again retries only the failed pages.
 */
export async function generateInterfacePages(plan: InterfacePlan, o: {
  generatePage: (pagePlan: InterfacePlan, brief: PageBrief, signal?: AbortSignal) => Promise<PageResult>;
  completed: Map<string, PageResult>;
  signal?: AbortSignal;
  onProgress?: (runs: PageRun[]) => void;
}): Promise<{ pages: Array<{ screenId: string; craftState: string }>; failed: PageRun[]; warnings: string[]; cancelled: boolean }> {
  const brief = buildPageBrief(plan);
  const pages = selectedInterfaceSurfaces(plan).filter((s) => s.kind === 'page');
  const runs: PageRun[] = pages.map((p) => ({ screenId: p.id, name: p.name, status: o.completed.has(p.id) ? 'done' : 'queued' }));
  const emit = () => o.onProgress?.(runs.map((r) => ({ ...r })));
  emit();
  const todo = pages.filter((p) => !o.completed.has(p.id));
  await runPageBatch(todo, async (page, _i, signal) => {
    const result = await o.generatePage(selectInterfacePages(plan, [page.id]), brief, signal);
    o.completed.set(page.id, result);
    return result;
  }, {
    concurrency: PAGE_CONCURRENCY, signal: o.signal, warmFirst: o.completed.size === 0,
    onStatus: (i, status, error) => {
      const run = runs.find((r) => r.screenId === todo[i].id)!;
      run.status = status; run.error = error;
      emit();
    },
  });
  const failed = runs.filter((r) => r.status !== 'done');
  return {
    pages: pages.filter((p) => o.completed.has(p.id)).map((p) => ({ screenId: p.id, craftState: o.completed.get(p.id)!.craftState })),
    failed, cancelled: !!o.signal?.aborted,
    warnings: Array.from(new Set(pages.flatMap((p) => o.completed.get(p.id)?.warnings ?? []))),
  };
}
