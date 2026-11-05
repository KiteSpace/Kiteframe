import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiBilling } from '../aiBillingContext';
import { executeAiChat } from '../aiChatExecutor';

const call = async (fetchImpl: () => Promise<unknown>) => {
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
  const billing = { attempted: false, completed: false };
  await aiBilling.run(billing, async () => {
    try {
      await executeAiChat({ provider: 'anthropic', model: 'claude-haiku-4-5-20251001', apiKey: 'test-key', messages: [{ role: 'user', content: 'hi' }] });
    } catch { /* only the billing state matters here */ }
  });
  return billing;
};

describe('executeAiChat billing state', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('marks a completed call when Claude returns a response', async () => {
    const billing = await call(async () => ({
      ok: true, status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'not json {' }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'max_tokens' }),
      text: async () => '',
    }));
    expect(billing).toEqual({ attempted: true, completed: true });
  });

  it('leaves the call uncompleted on an upstream 5xx or a network error', async () => {
    expect(await call(async () => ({ ok: false, status: 529, text: async () => '{}' }))).toEqual({ attempted: true, completed: false });
    expect(await call(async () => { throw new TypeError('fetch failed'); })).toEqual({ attempted: true, completed: false });
  });
});
