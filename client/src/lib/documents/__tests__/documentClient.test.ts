/**
 * Ordering guarantees for document saves.
 *
 * These cover the two ways a save can be silently undone: a queued edit running
 * after a newer immediate save, and two saves landing out of order. Both end the
 * same way — older text on the server, stamped newer, winning every subsequent
 * hydration.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  flushDocumentSaves,
  hasPendingSave,
  isAddressableProject,
  saveDocumentNow,
  scheduleDocumentSave,
} from '../documentClient';

const UUID = '11111111-2222-4333-8444-555555555555';

/** Records the order request bodies actually reach the network. */
function mockFetch(delaysMs: number[] = []) {
  const sent: string[] = [];
  let call = 0;
  const fetchMock = vi.fn(async (_url: string, init: any) => {
    const i = call++;
    const body = JSON.parse(init.body);
    const delay = delaysMs[i] ?? 0;
    if (delay) await new Promise((r) => setTimeout(r, delay));
    sent.push(body.content.marker);
    return {
      ok: true,
      status: 200,
      json: async () => ({ document: { updatedAt: new Date().toISOString() } }),
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return { sent, fetchMock };
}

const doc = (marker: string) => ({ sections: [], marker });

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('addressability', () => {
  it('only treats a uuid as a server-addressable project', () => {
    expect(isAddressableProject(UUID)).toBe(true);
    // Local tab ids and the numeric cloud id must not trigger requests for a
    // document that cannot exist on the server.
    expect(isAddressableProject('tab-1712345678')).toBe(false);
    expect(isAddressableProject('default')).toBe(false);
    expect(isAddressableProject('12345')).toBe(false);
    expect(isAddressableProject('')).toBe(false);
    expect(isAddressableProject(undefined)).toBe(false);
  });
});

describe('debounced saves', () => {
  it('coalesces rapid edits into one request with the latest content', async () => {
    const { sent, fetchMock } = mockFetch();

    scheduleDocumentSave(UUID, 'project-prd', undefined, doc('a'));
    scheduleDocumentSave(UUID, 'project-prd', undefined, doc('b'));
    scheduleDocumentSave(UUID, 'project-prd', undefined, doc('c'));

    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent).toEqual(['c']);
  });

  it('keeps separate documents on separate debounces', async () => {
    const { sent } = mockFetch();

    scheduleDocumentSave(UUID, 'project-prd', undefined, doc('project'));
    scheduleDocumentSave(UUID, 'workflow-prd', 'wf-1', doc('workflow'));

    await vi.advanceTimersByTimeAsync(2000);
    expect(sent.sort()).toEqual(['project', 'workflow']);
  });

  it('reports a queued save so hydration can stand aside', async () => {
    mockFetch();
    scheduleDocumentSave(UUID, 'project-prd', undefined, doc('a'));
    expect(hasPendingSave(UUID, 'project-prd')).toBe(true);

    await vi.advanceTimersByTimeAsync(2000);
    expect(hasPendingSave(UUID, 'project-prd')).toBe(false);
  });

  it('flushes queued saves on demand, for navigating away', async () => {
    const { sent } = mockFetch();
    scheduleDocumentSave(UUID, 'project-prd', undefined, doc('unflushed'));

    await flushDocumentSaves();
    expect(sent).toEqual(['unflushed']);
  });
});

describe('an immediate save supersedes a queued edit', () => {
  it('discards the queued edit instead of letting it overwrite', async () => {
    // Regression: edit (queued 'old') then Generate/Restore (immediate 'new').
    // If the queued save still runs, the server ends up holding 'old' stamped
    // later than 'new', and every later load resurrects it.
    const { sent } = mockFetch();

    scheduleDocumentSave(UUID, 'project-prd', undefined, doc('old'));
    await saveDocumentNow(UUID, 'project-prd', undefined, doc('new'));
    await vi.advanceTimersByTimeAsync(3000);

    expect(sent).toEqual(['new']);
  });
});

describe('saves to one document never land out of order', () => {
  it('applies a slow save before a fast one that followed it', async () => {
    // First request hangs, second is instant. Unchained, the second would land
    // first and the first would overwrite it with older content.
    const { sent } = mockFetch([100, 0]);

    const first = saveDocumentNow(UUID, 'project-prd', undefined, doc('first'));
    const second = saveDocumentNow(UUID, 'project-prd', undefined, doc('second'));
    await vi.advanceTimersByTimeAsync(500);
    await Promise.all([first, second]);

    expect(sent).toEqual(['first', 'second']);
  });

  it('does not strand later saves when an earlier one fails', async () => {
    const sent: string[] = [];
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: any) => {
        const i = call++;
        if (i === 0) throw new Error('network down');
        sent.push(JSON.parse(init.body).content.marker);
        return { ok: true, status: 200, json: async () => ({ document: {} }) };
      }),
    );

    const failed = await saveDocumentNow(UUID, 'project-prd', undefined, doc('doomed'));
    expect(failed).toBeNull(); // reported, not thrown — the cache still holds it

    await saveDocumentNow(UUID, 'project-prd', undefined, doc('after'));
    expect(sent).toEqual(['after']);
  });

  it('lets unrelated documents proceed in parallel', async () => {
    // A stalled project-prd save must not block a workflow-prd save.
    const { sent } = mockFetch([100, 0]);

    const slow = saveDocumentNow(UUID, 'project-prd', undefined, doc('slow'));
    const fast = saveDocumentNow(UUID, 'workflow-prd', 'wf-1', doc('fast'));
    await vi.advanceTimersByTimeAsync(500);
    await Promise.all([slow, fast]);

    expect(sent).toEqual(['fast', 'slow']);
  });
});

describe('failures are non-fatal', () => {
  it('reports a rejected save without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })),
    );
    await expect(saveDocumentNow(UUID, 'project-prd', undefined, doc('x'))).resolves.toBeNull();
  });
});
