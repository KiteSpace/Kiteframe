import { queryClient } from '@/lib/queryClient';
import { assertOperationActive, beginBackgroundCommit } from '@/ai/backgroundOperations';

type Surface = { read: () => string; apply: (state: string) => void };
const surfaces = new Map<string, Surface>();
const detachedSnapshots = new Map<string, string>();

export function registerDesignSurface(id: string, surface: Surface) {
  surfaces.set(id, surface);
  detachedSnapshots.delete(id);
  return () => {
    if (surfaces.get(id) !== surface) return;
    detachedSnapshots.set(id, surface.read());
    surfaces.delete(id);
  };
}
function canonical(value: unknown): string {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return String(value); }
  }
  const sort = (item: any): any => Array.isArray(item) ? item.map(sort) :
    item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])])) : item;
  return JSON.stringify(sort(value));
}
export async function readOriginalDesign(id: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`/api/designs/${encodeURIComponent(id)}`, { credentials: 'include', signal });
  if (!response.ok) throw new Error('The original design is no longer available or you are not signed in.');
  return (await response.json()).craftState;
}

/** Explicit target + compare-and-set, including changes in a newly mounted view. */
export async function commitBackgroundDesign(
  id: string, baseline: string, originalRemote: unknown, next: string, signal: AbortSignal,
) {
  assertOperationActive(signal);
  const local = surfaces.get(id)?.read() ?? detachedSnapshots.get(id) ?? baseline;
  if (canonical(local) !== canonical(baseline)) {
    throw new Error('This design was edited while AI was working. Your edits were kept; retry on the latest design.');
  }
  const current = await readOriginalDesign(id, signal);
  if (canonical(current) !== canonical(originalRemote) && canonical(current) !== canonical(baseline)) {
    throw new Error('The saved design changed while AI was working. Your edits were kept; retry on the latest design.');
  }
  assertOperationActive(signal);
  beginBackgroundCommit(signal);
  const response = await fetch(`/api/designs/${encodeURIComponent(id)}`, {
    method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ craftState: next, expectedCraftState: current }), signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Could not save AI changes to the original design.');
  }
  assertOperationActive(signal);
  // Update only the originating design, never the currently active editor.
  detachedSnapshots.set(id, next);
  surfaces.get(id)?.apply(next);
  const saved = await response.json();
  queryClient.setQueryData(['/api/designs', id], saved);
  void queryClient.invalidateQueries({ queryKey: ['/api/designs', id] });
}
