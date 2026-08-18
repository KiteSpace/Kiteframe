/**
 * Tests for the design-page chat transcript and the cross-tab merge that
 * protects every conversation from being clobbered by a second tab.
 *
 * Two problems are covered:
 *
 *   1. The design page's KiteAI chat had no persistence at all — its messages
 *      lived in component state and were discarded on reload or unmount.
 *   2. Every conversation was stored with a plain read-modify-write, so two
 *      tabs writing the same thread would silently lose one side's messages.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  readDesignChat,
  saveDesignChat,
  appendDesignChat,
  designChatStorageKey,
  adoptPendingDesignTranscript,
  stashPendingTranscript,
  readStoredMessages,
  saveStoredMessages,
  readTranscript,
  saveTranscript,
  transcriptStorageKey,
  MAX_TRANSCRIPT_ENTRIES,
  type TranscriptEntry,
} from '../kiteaiTranscript';

const DESIGN = 'design-1';
const OWNER = 'user-abc';

let clock = Date.parse('2026-01-01T00:00:00Z');

/** Entries get strictly increasing timestamps so ordering assertions are meaningful. */
function entry(id: string, content = id): TranscriptEntry {
  clock += 1000;
  return { id, role: 'user', content, timestamp: new Date(clock) };
}

function at(id: string, ms: number): TranscriptEntry {
  return { id, role: 'user', content: id, timestamp: new Date(ms) };
}

beforeEach(() => {
  localStorage.clear();
  clock = Date.parse('2026-01-01T00:00:00Z');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('design chat persistence', () => {
  it('round-trips a conversation for a design', () => {
    saveDesignChat(DESIGN, [entry('welcome'), entry('a')]);
    expect(readDesignChat(DESIGN).map((m) => m.id)).toEqual(['welcome', 'a']);
  });

  it('rehydrates timestamps to Date objects', () => {
    saveDesignChat(DESIGN, [entry('a')]);
    expect(readDesignChat(DESIGN)[0].timestamp).toBeInstanceOf(Date);
  });

  it('keeps each design on its own thread', () => {
    saveDesignChat('design-a', [entry('only-a')]);
    saveDesignChat('design-b', [entry('only-b')]);
    expect(readDesignChat('design-a').map((m) => m.id)).toEqual(['only-a']);
    expect(readDesignChat('design-b').map((m) => m.id)).toEqual(['only-b']);
  });

  it('returns nothing for a design with no history, so the greeting is used', () => {
    expect(readDesignChat('never-opened')).toEqual([]);
  });

  it('survives malformed stored data rather than throwing', () => {
    localStorage.setItem(designChatStorageKey(DESIGN), '{ not json');
    expect(readDesignChat(DESIGN)).toEqual([]);
    expect(() => saveDesignChat(DESIGN, [entry('a')])).not.toThrow();
    expect(readDesignChat(DESIGN).map((m) => m.id)).toEqual(['a']);
  });

  it('ignores a stored value that is not a list', () => {
    localStorage.setItem(designChatStorageKey(DESIGN), JSON.stringify({ nope: true }));
    expect(readDesignChat(DESIGN)).toEqual([]);
  });

  it('is a no-op without a design id, rather than writing a shared thread', () => {
    const msgs = [entry('a')];
    expect(saveDesignChat('', msgs)).toBe(msgs);
    expect(readDesignChat('')).toEqual([]);
    expect(localStorage.length).toBe(0);
  });

  it('reads conversations written before the envelope format existed', () => {
    // Every existing thread on disk is a bare array. Downgrading those users to
    // an empty conversation would be worse than the race the envelope guards.
    localStorage.setItem(
      designChatStorageKey(DESIGN),
      JSON.stringify([{ id: 'legacy', role: 'assistant', content: 'hi', timestamp: clock }]),
    );
    expect(readDesignChat(DESIGN).map((m) => m.id)).toEqual(['legacy']);
  });
});

describe('concurrent tabs', () => {
  it('does not lose the first tab\'s message when a second tab saves', () => {
    const welcome = at('welcome', 0);
    const fromTabA = at('a', 100);
    const fromTabB = at('b', 200);

    // Tab A and tab B both start from the same thread, then each adds its own
    // message and saves. A plain overwrite would leave only the later write.
    saveDesignChat(DESIGN, [welcome, fromTabA]);
    saveDesignChat(DESIGN, [welcome, fromTabB]);

    expect(readDesignChat(DESIGN).map((m) => m.id)).toEqual(['welcome', 'a', 'b']);
  });

  it('converges on the same order regardless of which tab saves first', () => {
    const w = at('welcome', 0);
    const a = at('a', 100);
    const b = at('b', 200);

    saveDesignChat('d1', [w, a]);
    saveDesignChat('d1', [w, b]);

    saveDesignChat('d2', [w, b]);
    saveDesignChat('d2', [w, a]);

    expect(readDesignChat('d1').map((m) => m.id)).toEqual(readDesignChat('d2').map((m) => m.id));
  });

  it('returns the merged thread so the caller can render the other tab\'s messages', () => {
    saveDesignChat(DESIGN, [at('welcome', 0), at('a', 100)]);
    const merged = saveDesignChat(DESIGN, [at('welcome', 0), at('b', 200)]);
    expect(merged.map((m) => m.id)).toEqual(['welcome', 'a', 'b']);
  });

  it('protects the project transcript the same way', () => {
    saveTranscript('proj', [at('welcome', 0), at('a', 100)]);
    saveTranscript('proj', [at('welcome', 0), at('b', 200)]);
    expect(readTranscript('proj').map((m) => m.id)).toEqual(['welcome', 'a', 'b']);
  });

  it('protects any keyed conversation, including the discussion thread', () => {
    const key = 'kiteframe-kiteai-discussion-proj';
    saveStoredMessages(key, [at('welcome', 0), at('a', 100)]);
    saveStoredMessages(key, [at('welcome', 0), at('b', 200)]);
    expect(readStoredMessages(key).map((m) => m.id)).toEqual(['welcome', 'a', 'b']);
  });

  it('appending does not drop what another tab already wrote', () => {
    saveDesignChat(DESIGN, [at('welcome', 0), at('a', 100)]);
    appendDesignChat(DESIGN, [at('gen', 200)]);
    expect(readDesignChat(DESIGN).map((m) => m.id)).toEqual(['welcome', 'a', 'gen']);
  });

  it('re-saving an unchanged thread does not duplicate anything', () => {
    const thread = [at('welcome', 0), at('a', 100)];
    saveDesignChat(DESIGN, thread);
    saveDesignChat(DESIGN, thread);
    saveDesignChat(DESIGN, thread);
    expect(readDesignChat(DESIGN).map((m) => m.id)).toEqual(['welcome', 'a']);
  });

  it('keeps the in-memory thread when storage rejects the write', () => {
    saveDesignChat(DESIGN, [at('a', 100)]);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const merged = saveDesignChat(DESIGN, [at('a', 100), at('b', 200)]);
    setItem.mockRestore();
    // The write failed, but the caller still gets a usable thread to render.
    expect(merged.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('deterministic ordering', () => {
  it('keeps same-millisecond messages from two tabs, in a settled order', () => {
    // Two tabs can trivially produce messages inside the same millisecond.
    // Both must survive, and the order must stop changing once written —
    // otherwise each tab would keep rewriting the other's ordering.
    const w = at('welcome', 0);
    const a = at('aaa', 500);
    const b = at('bbb', 500);

    saveDesignChat(DESIGN, [w, a]);
    saveDesignChat(DESIGN, [w, b]);
    const settled = readDesignChat(DESIGN).map((m) => m.id);

    expect(settled).toHaveLength(3);
    expect(settled).toContain('aaa');
    expect(settled).toContain('bbb');

    // Either tab reconciling again must not reshuffle it.
    saveDesignChat(DESIGN, [w, a]);
    saveDesignChat(DESIGN, [w, b]);
    expect(readDesignChat(DESIGN).map((m) => m.id)).toEqual(settled);
  });

  it('keeps existing history ahead of newly appended messages', () => {
    // Entries recorded in the same millisecond must not be reordered among
    // themselves — prior conversation stays above what is appended later.
    saveDesignChat(DESIGN, [at('zzz-older', 100)]);
    appendDesignChat(DESIGN, [at('aaa-newer', 100)]);
    expect(readDesignChat(DESIGN).map((m) => m.id)).toEqual(['zzz-older', 'aaa-newer']);
  });

  it('does not duplicate an id repeated inside a single batch', () => {
    saveDesignChat(DESIGN, [at('a', 100), at('a', 100), at('b', 200)]);
    expect(readDesignChat(DESIGN).map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('drops entries with no id rather than storing unmergeable messages', () => {
    saveDesignChat(DESIGN, [at('a', 100), { role: 'user', content: 'orphan', timestamp: new Date(150) } as TranscriptEntry]);
    expect(readDesignChat(DESIGN).map((m) => m.id)).toEqual(['a']);
  });
});

describe('history cap', () => {
  it('keeps the most recent messages once the cap is exceeded', () => {
    const many = Array.from({ length: MAX_TRANSCRIPT_ENTRIES + 50 }, (_, i) => at(`m${i}`, i));
    saveDesignChat(DESIGN, many);

    const stored = readDesignChat(DESIGN);
    expect(stored).toHaveLength(MAX_TRANSCRIPT_ENTRIES);
    expect(stored[0].id).toBe('m50');
    expect(stored[stored.length - 1].id).toBe(`m${MAX_TRANSCRIPT_ENTRIES + 49}`);
  });

  it('does not resurrect trimmed history when another tab reconciles', () => {
    const many = Array.from({ length: MAX_TRANSCRIPT_ENTRIES + 10 }, (_, i) => at(`m${i}`, i));
    saveDesignChat(DESIGN, many);

    // A tab still holding the full (pre-trim) thread reconciles. The trimmed
    // head must stay trimmed, or the cap would be fought forever.
    const merged = saveDesignChat(DESIGN, many);
    expect(merged).toHaveLength(MAX_TRANSCRIPT_ENTRIES);
    expect(merged.some((m) => m.id === 'm0')).toBe(false);
  });

  it('does not rotate history when many entries share the cutoff timestamp', () => {
    // Every entry has the same timestamp, so a time-only cutoff would re-admit
    // the trimmed head on each reconcile and push the tail back out, churning
    // the retained window instead of settling.
    const many = Array.from({ length: MAX_TRANSCRIPT_ENTRIES + 20 }, (_, i) =>
      at(`m${String(i).padStart(4, '0')}`, 1000),
    );
    saveDesignChat(DESIGN, many);
    const first = readDesignChat(DESIGN).map((m) => m.id);

    saveDesignChat(DESIGN, many);
    saveDesignChat(DESIGN, many);

    expect(readDesignChat(DESIGN).map((m) => m.id)).toEqual(first);
    expect(first).toHaveLength(MAX_TRANSCRIPT_ENTRIES);
  });

  it('still accepts genuinely new messages on a capped thread', () => {
    const many = Array.from({ length: MAX_TRANSCRIPT_ENTRIES, }, (_, i) => at(`m${i}`, i));
    saveDesignChat(DESIGN, many);
    appendDesignChat(DESIGN, [at('fresh', 10_000)]);

    const stored = readDesignChat(DESIGN);
    expect(stored).toHaveLength(MAX_TRANSCRIPT_ENTRIES);
    expect(stored[stored.length - 1].id).toBe('fresh');
  });
});

describe('adopting the generation exchange on the design page', () => {
  const exchange = [at('gen-prompt', 100), at('gen-reply', 200)];

  it('claims the exchange that produced this design', () => {
    stashPendingTranscript(exchange, { ownerId: OWNER, designId: DESIGN });
    const adopted = adoptPendingDesignTranscript(DESIGN, OWNER);

    expect(adopted.map((m) => m.id)).toEqual(['gen-prompt', 'gen-reply']);
    expect(readDesignChat(DESIGN).map((m) => m.id)).toEqual(['gen-prompt', 'gen-reply']);
  });

  it('leaves an exchange belonging to a different design alone', () => {
    stashPendingTranscript(exchange, { ownerId: OWNER, designId: 'some-other-design' });

    expect(adoptPendingDesignTranscript(DESIGN, OWNER)).toEqual([]);
    expect(readDesignChat(DESIGN)).toEqual([]);
    // Still claimable by the design it actually belongs to.
    expect(adoptPendingDesignTranscript('some-other-design', OWNER)).toHaveLength(2);
  });

  it('never hands one user\'s prompt to another account on the same browser', () => {
    stashPendingTranscript(exchange, { ownerId: OWNER, designId: DESIGN });

    expect(adoptPendingDesignTranscript(DESIGN, 'someone-else')).toEqual([]);
    expect(readDesignChat(DESIGN)).toEqual([]);
    // The rightful owner can still claim it.
    expect(adoptPendingDesignTranscript(DESIGN, OWNER)).toHaveLength(2);
  });

  it('can only be claimed once', () => {
    stashPendingTranscript(exchange, { ownerId: OWNER, designId: DESIGN });

    expect(adoptPendingDesignTranscript(DESIGN, OWNER)).toHaveLength(2);
    expect(adoptPendingDesignTranscript(DESIGN, OWNER)).toEqual([]);
    expect(readDesignChat(DESIGN)).toHaveLength(2);
  });

  it('discards a stash that has gone stale', () => {
    stashPendingTranscript(exchange, { ownerId: OWNER, designId: DESIGN });
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60 * 1000);

    expect(adoptPendingDesignTranscript(DESIGN, OWNER)).toEqual([]);
    expect(readDesignChat(DESIGN)).toEqual([]);
  });

  it('treats a stash with no timestamp as expired rather than immortal', () => {
    stashPendingTranscript(exchange, { ownerId: OWNER, designId: DESIGN });
    const key = Object.keys(localStorage).find((k) => k.includes('pending'));
    const raw = JSON.parse(localStorage.getItem(key!)!);
    delete raw.createdAt;
    localStorage.setItem(key!, JSON.stringify(raw));

    expect(adoptPendingDesignTranscript(DESIGN, OWNER)).toEqual([]);
    expect(readDesignChat(DESIGN)).toEqual([]);
  });

  it('treats a stash with a nonsensical timestamp as expired', () => {
    stashPendingTranscript(exchange, { ownerId: OWNER, designId: DESIGN });
    const key = Object.keys(localStorage).find((k) => k.includes('pending'));
    const raw = JSON.parse(localStorage.getItem(key!)!);
    raw.createdAt = 'not a number';
    localStorage.setItem(key!, JSON.stringify(raw));

    expect(adoptPendingDesignTranscript(DESIGN, OWNER)).toEqual([]);
  });

  it('does nothing when nobody is signed in', () => {
    stashPendingTranscript(exchange, { ownerId: OWNER, designId: DESIGN });
    expect(adoptPendingDesignTranscript(DESIGN, undefined)).toEqual([]);
    // Left intact for the owner to claim once they are known.
    expect(adoptPendingDesignTranscript(DESIGN, OWNER)).toHaveLength(2);
  });

  it('merges into an existing conversation instead of replacing it', () => {
    saveDesignChat(DESIGN, [at('welcome', 0)]);
    stashPendingTranscript(exchange, { ownerId: OWNER, designId: DESIGN });
    adoptPendingDesignTranscript(DESIGN, OWNER);

    expect(readDesignChat(DESIGN).map((m) => m.id)).toEqual(['welcome', 'gen-prompt', 'gen-reply']);
  });

  it('carries the design preview through to the stored thread', () => {
    const withPreview: TranscriptEntry = {
      id: 'gen-reply',
      role: 'assistant',
      content: 'I designed 2 screens',
      timestamp: new Date(200),
      designPreview: { designId: DESIGN, title: 'Booking app', screenLabels: ['Login', 'Home'] },
    };
    stashPendingTranscript([withPreview], { ownerId: OWNER, designId: DESIGN });
    adoptPendingDesignTranscript(DESIGN, OWNER);

    const stored = readDesignChat(DESIGN);
    expect(stored[0].designPreview).toEqual({
      designId: DESIGN,
      title: 'Booking app',
      screenLabels: ['Login', 'Home'],
    });
  });
});

describe('storage key separation', () => {
  it('does not collide with the project transcript for the same id', () => {
    saveDesignChat('same-id', [at('design-msg', 100)]);
    saveTranscript('same-id', [at('project-msg', 100)]);

    expect(designChatStorageKey('same-id')).not.toBe(transcriptStorageKey('same-id'));
    expect(readDesignChat('same-id').map((m) => m.id)).toEqual(['design-msg']);
    expect(readTranscript('same-id').map((m) => m.id)).toEqual(['project-msg']);
  });
});
