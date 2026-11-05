import { afterEach, describe, expect, it, vi } from 'vitest';
import { anthropicFetch, oldestInFlight, type AiBilling } from '../aiBillingContext';
import { executeAiChat } from '../aiChatExecutor';

const call = async (fetchImpl: () => Promise<unknown>) => {
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
  const billing: AiBilling = { attempted: false, completed: false };
  try {
    await executeAiChat({ provider: 'anthropic', model: 'claude-haiku-4-5-20251001', apiKey: 'test-key', messages: [{ role: 'user', content: 'hi' }] }, undefined, undefined, billing);
  } catch { /* only the billing state matters here */ }
  return billing;
};

const okResponse = {
  ok: true, status: 200,
  json: async () => ({ content: [{ type: 'text', text: 'not json {' }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'max_tokens' }),
  text: async () => '',
};

describe('executeAiChat billing state', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('marks a completed call when Claude returns a response', async () => {
    expect(await call(async () => okResponse)).toEqual({ attempted: true, completed: true, inFlight: [] });
  });

  it('leaves the call uncompleted on an upstream 5xx or a network error', async () => {
    expect(await call(async () => ({ ok: false, status: 529, text: async () => '{}' }))).toEqual({ attempted: true, completed: false, inFlight: [] });
    expect(await call(async () => { throw new TypeError('fetch failed'); })).toEqual({ attempted: true, completed: false, inFlight: [] });
  });
});

describe('anthropicFetch (routes that call Anthropic directly)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('records start, completion and failure on req.aiBilling', async () => {
    const req = { aiBilling: { attempted: false, completed: false } as AiBilling };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    await anthropicFetch(req, { method: 'POST' });
    expect(req.aiBilling).toEqual({ attempted: true, completed: false, inFlight: [] });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    await expect(anthropicFetch(req, { method: 'POST' })).rejects.toThrow('fetch failed');
    expect(req.aiBilling.completed).toBe(false);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
    await anthropicFetch(req, { method: 'POST' });
    expect(req.aiBilling.completed).toBe(true);
  });

  it('reports the oldest call still waiting for Claude', async () => {
    const req = { aiBilling: { attempted: false, completed: false } as AiBilling };
    let release!: () => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((r) => { release = () => r({ ok: true, status: 200 }); })));
    const pending = anthropicFetch(req, { method: 'POST' });
    expect(oldestInFlight(req.aiBilling)).toBeLessThanOrEqual(Date.now());
    release();
    await pending;
    expect(oldestInFlight(req.aiBilling)).toBeUndefined();
  });

  it('works without billing state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
    await expect(anthropicFetch(undefined, { method: 'POST' })).resolves.toMatchObject({ ok: true });
  });
});
