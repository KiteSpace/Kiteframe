import { describe, expect, it } from 'vitest';
import { createSpecSummaryCaches } from '../lib/specSummaryCache';

describe('per-user Specs summary caches', () => {
  it("a user filling their cache only evicts their own entries", () => {
    const forUser = createSpecSummaryCaches(10, 3);
    forUser('a').set('a1', 'summary');
    const b = forUser('b');
    for (let i = 0; i < 20; i++) b.set(`b${i}`, 's');
    expect(forUser('b').size).toBe(3);
    expect(forUser('a').get('a1')).toBe('summary');
  });

  it('drops the least recently used user past the user cap', () => {
    const forUser = createSpecSummaryCaches(2, 5);
    forUser('a').set('k', 'v');
    forUser('b').set('k', 'v');
    forUser('a');
    forUser('c');
    expect(forUser('a').get('k')).toBe('v');
    expect(forUser('b').size).toBe(0);
  });

  it("evicts a user's least recently read entry, not the oldest written", () => {
    const forUser = createSpecSummaryCaches(10, 2);
    const a = forUser('a');
    a.set('k1', 'v1');
    a.set('k2', 'v2');
    a.get('k1');
    a.set('k3', 'v3');
    forUser('a');
    expect([...forUser('a').keys()]).toEqual(['k1', 'k3']);
  });
});
