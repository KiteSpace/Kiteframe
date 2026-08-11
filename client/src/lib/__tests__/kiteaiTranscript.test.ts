import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  appendTranscript,
  readTranscript,
  stashPendingTranscript,
  adoptPendingTranscript,
  subscribeTranscript,
  buildGenerationExchange,
  extractScreenLabels,
  transcriptStorageKey,
  type TranscriptEntry,
} from '../kiteaiTranscript';

const PROJECT = 'proj-1';

function entry(id: string, content = 'hi'): TranscriptEntry {
  return { id, role: 'user', content, timestamp: new Date('2026-01-01T00:00:00Z') };
}

beforeEach(() => {
  localStorage.clear();
});

describe('appendTranscript', () => {
  it('appends to an empty transcript', () => {
    appendTranscript(PROJECT, [entry('a')]);
    expect(readTranscript(PROJECT).map((m) => m.id)).toEqual(['a']);
  });

  it('preserves existing discussion instead of replacing it', () => {
    // Prior conversation the user had before generating.
    localStorage.setItem(
      transcriptStorageKey(PROJECT),
      JSON.stringify([entry('older', 'what can you do?')]),
    );
    appendTranscript(PROJECT, [entry('gen-1'), entry('gen-2')]);
    const ids = readTranscript(PROJECT).map((m) => m.id);
    expect(ids).toEqual(['older', 'gen-1', 'gen-2']);
  });

  it('is idempotent for ids already present (safe on retry)', () => {
    appendTranscript(PROJECT, [entry('a'), entry('b')]);
    appendTranscript(PROJECT, [entry('b'), entry('c')]);
    expect(readTranscript(PROJECT).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('ignores empty input and missing project', () => {
    appendTranscript(PROJECT, []);
    appendTranscript('', [entry('a')]);
    expect(readTranscript(PROJECT)).toEqual([]);
  });

  it('rehydrates timestamps as Date objects', () => {
    appendTranscript(PROJECT, [entry('a')]);
    expect(readTranscript(PROJECT)[0].timestamp).toBeInstanceOf(Date);
  });

  it('does not throw when storage rejects the write', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => appendTranscript(PROJECT, [entry('a')])).not.toThrow();
    spy.mockRestore();
  });
});

describe('pending (pre-project) exchange', () => {
  const OWNER = 'user-a';
  const meta = { ownerId: OWNER, designId: 'd1' };

  it('adopts a stashed exchange into the project transcript exactly once', () => {
    stashPendingTranscript([entry('p1'), entry('p2')], meta);

    const adopted = adoptPendingTranscript(PROJECT, OWNER);
    expect(adopted.map((m) => m.id)).toEqual(['p1', 'p2']);
    expect(readTranscript(PROJECT).map((m) => m.id)).toEqual(['p1', 'p2']);

    // The stash is claimed on first adoption, so a second project cannot
    // inherit the same exchange.
    expect(adoptPendingTranscript('proj-2', OWNER)).toEqual([]);
    expect(readTranscript('proj-2')).toEqual([]);
  });

  it('returns nothing when there is no stash', () => {
    expect(adoptPendingTranscript(PROJECT, OWNER)).toEqual([]);
  });

  it('never leaks one user\u2019s exchange to a different signed-in user', () => {
    stashPendingTranscript([entry('secret', 'my private product idea')], meta);

    // A different account on the same browser must not inherit it...
    expect(adoptPendingTranscript(PROJECT, 'user-b')).toEqual([]);
    expect(readTranscript(PROJECT)).toEqual([]);

    // ...and the rightful owner can still claim it afterwards.
    expect(adoptPendingTranscript(PROJECT, OWNER).map((m) => m.id)).toEqual(['secret']);
  });

  it('does not adopt for an unauthenticated reader', () => {
    stashPendingTranscript([entry('p1')], meta);
    expect(adoptPendingTranscript(PROJECT, undefined)).toEqual([]);
    expect(readTranscript(PROJECT)).toEqual([]);
  });

  it('refuses to stash an exchange with no owner', () => {
    stashPendingTranscript([entry('p1')], { ownerId: '', designId: 'd1' });
    expect(adoptPendingTranscript(PROJECT, OWNER)).toEqual([]);
  });

  it('expires a stale stash instead of attaching it to an unrelated project', () => {
    stashPendingTranscript([entry('p1')], meta);

    // Eleven minutes later the handoff is long over; the stash must not be
    // grafted onto whatever project the user happens to open next.
    const realNow = Date.now;
    Date.now = () => realNow() + 11 * 60 * 1000;
    try {
      expect(adoptPendingTranscript(PROJECT, OWNER)).toEqual([]);
      expect(readTranscript(PROJECT)).toEqual([]);
    } finally {
      Date.now = realNow;
    }

    // And it is cleaned up rather than left to linger.
    expect(adoptPendingTranscript(PROJECT, OWNER)).toEqual([]);
  });

  it('ignores a malformed stash', () => {
    localStorage.setItem('kiteframe-kiteai-pending-exchange', 'not json');
    expect(adoptPendingTranscript(PROJECT, OWNER)).toEqual([]);
  });
});

describe('subscribeTranscript', () => {
  it('notifies subscribers of the matching project on append', () => {
    const onChange = vi.fn();
    const unsub = subscribeTranscript(PROJECT, onChange);

    appendTranscript(PROJECT, [entry('a')]);
    expect(onChange).toHaveBeenCalledTimes(1);

    appendTranscript('other-project', [entry('b')]);
    expect(onChange).toHaveBeenCalledTimes(1);

    unsub();
    appendTranscript(PROJECT, [entry('c')]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('extractScreenLabels', () => {
  const state = {
    ROOT: { type: { resolvedName: 'AstryxSection' }, nodes: ['a1', 'a2', 'x'] },
    a1: { type: { resolvedName: 'AstryxArtboard' }, props: { label: 'Login' } },
    a2: { type: { resolvedName: 'AstryxArtboard' }, props: { label: 'Dashboard' } },
    x: { type: { resolvedName: 'AstryxStack' }, props: {} },
  };

  it('reads artboard labels in ROOT order, skipping non-artboards', () => {
    expect(extractScreenLabels(state)).toEqual(['Login', 'Dashboard']);
  });

  it('accepts a JSON string', () => {
    expect(extractScreenLabels(JSON.stringify(state))).toEqual(['Login', 'Dashboard']);
  });

  it('returns [] for malformed or empty input', () => {
    expect(extractScreenLabels('not json')).toEqual([]);
    expect(extractScreenLabels(null)).toEqual([]);
    expect(extractScreenLabels({})).toEqual([]);
  });
});

describe('buildGenerationExchange', () => {
  it('records prompt, reply with preview, and a closing offer', () => {
    const msgs = buildGenerationExchange({
      prompt: 'a booking app for a barber shop',
      designId: 'd1',
      title: 'Barber Booking',
      screenLabels: ['Home', 'Booking'],
      origin: 'home',
    });

    expect(msgs).toHaveLength(3);
    expect(msgs[0].role).toBe('user');
    // The user's own words are preserved verbatim.
    expect(msgs[0].content).toBe('a booking app for a barber shop');

    expect(msgs[1].role).toBe('assistant');
    expect(msgs[1].content).toContain('Home');
    expect(msgs[1].content).toContain('Booking');
    expect(msgs[1].designPreview).toEqual({
      designId: 'd1',
      title: 'Barber Booking',
      screenLabels: ['Home', 'Booking'],
    });

    // Closing message must make it explicit that changes are possible.
    expect(msgs[2].role).toBe('assistant');
    expect(msgs[2].content.toLowerCase()).toContain('change');
  });

  it('phrases the workflow bridge in the user voice, not the synthetic prompt', () => {
    const msgs = buildGenerationExchange({
      prompt: 'SYSTEM: generate screens for nodes [...]',
      designId: 'd2',
      screenLabels: ['Checkout'],
      origin: 'workflow',
      workflowName: 'Order Flow',
    });

    expect(msgs[0].content).toBe('Generate an interface from the "Order Flow" workflow.');
    expect(msgs[0].content).not.toContain('SYSTEM:');
    expect(msgs[1].content).toContain('Order Flow');
  });

  it('handles a generation that produced no labelled screens', () => {
    const msgs = buildGenerationExchange({ prompt: 'p', designId: 'd3', origin: 'home' });
    expect(msgs).toHaveLength(3);
    expect(msgs[1].designPreview?.screenLabels).toEqual([]);
  });

  it('produces unique ids and non-decreasing timestamps', () => {
    const a = buildGenerationExchange({ prompt: 'p', designId: 'd', origin: 'home' });
    const b = buildGenerationExchange({ prompt: 'p', designId: 'd', origin: 'home' });
    const ids = [...a, ...b].map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(a[0].timestamp.getTime()).toBeLessThanOrEqual(a[1].timestamp.getTime());
    expect(a[1].timestamp.getTime()).toBeLessThanOrEqual(a[2].timestamp.getTime());
  });
});
