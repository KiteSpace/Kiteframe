import { describe, it, expect, vi, beforeEach } from 'vitest';

const executeAiChat = vi.fn();
vi.mock('../aiChatExecutor', () => ({ executeAiChat: (...args: any[]) => executeAiChat(...args) }));

import { parseDesignJson, readUsage, runDesignModel, DESIGN_JSON_ONLY_RULE } from '../lib/designModel';

describe('parseDesignJson', () => {
  it('ignores a stray extra closing brace after a complete object', () => {
    expect(parseDesignJson('{"a":{"b":"}"}}}', false)).toEqual({ ok: true, value: { a: { b: '}' } } });
  });
  it('reconstructs a prefilled reply', () => {
    expect(parseDesignJson('"type":"message","text":"hi"}', true)).toEqual({ ok: true, value: { type: 'message', text: 'hi' } });
  });
  it('accepts fenced or prose-wrapped replies without prefill', () => {
    expect(parseDesignJson('```json\n{"a":1}\n```', false)).toEqual({ ok: true, value: { a: 1 } });
    expect(parseDesignJson('Here you go: {"a":[1,2]} done', false)).toEqual({ ok: true, value: { a: [1, 2] } });
  });
  it('repairs trailing commas', () => {
    expect(parseDesignJson('{"a":[1,2,],}', false)).toEqual({ ok: true, value: { a: [1, 2] } });
  });
  it('reports incomplete and invalid replies', () => {
    expect(parseDesignJson('{"a":', false)).toEqual({ ok: false, error: 'incomplete' });
    expect(parseDesignJson('{"a": nope}', false)).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('readUsage', () => {
  it('reads cache token fields and defaults missing ones to 0', () => {
    expect(readUsage({ usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 12312 } }))
      .toEqual({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 12312, cacheCreationTokens: 0 });
  });
});

describe('runDesignModel', () => {
  beforeEach(() => executeAiChat.mockReset());
  const base = {
    taskType: { legacy: 'design', v2: 'design_v2' },
    systemBlocks: ['STATIC CATALOG', 'VISION EXT'],
    messages: [{ role: 'user' as const, content: 'make a login page' }],
    maxTokens: 1000,
  };

  it('legacy path prefills and joins the system prompt', async () => {
    executeAiChat.mockResolvedValue({ ok: true, status: 200, text: '"type":"message","text":"ok"}', json: { stop_reason: 'end_turn' }, activeModel: 'm' });
    const r = await runDesignModel({ ...base, v2: false });
    expect(r.ok && r.value).toEqual({ type: 'message', text: 'ok' });
    const [body, , internal] = executeAiChat.mock.calls[0];
    expect(body.taskType).toBe('design');
    expect(body.messages.at(-1)).toEqual({ role: 'assistant', content: '{' });
    expect(internal).toEqual({ systemPrompt: 'STATIC CATALOG\n\nVISION EXT', rawUserText: true });
  });

  it('v2 path ends on a user turn and sends cached system blocks', async () => {
    executeAiChat.mockResolvedValue({ ok: true, status: 200, text: '{"type":"message","text":"ok"}', json: { stop_reason: 'end_turn', usage: { cache_read_input_tokens: 9 } }, activeModel: 'm2' });
    const r = await runDesignModel({ ...base, v2: true });
    expect(r.ok && r.usage.cacheReadTokens).toBe(9);
    const [body, , internal] = executeAiChat.mock.calls[0];
    expect(body.taskType).toBe('design_v2');
    expect(body.messages.at(-1).role).toBe('user');
    expect(internal).toEqual({ systemBlocks: ['STATIC CATALOG', 'VISION EXT', DESIGN_JSON_ONLY_RULE], cacheSystem: true, rawUserText: true });
  });

  it('maps truncation and upstream failures without leaking details', async () => {
    executeAiChat.mockResolvedValueOnce({ ok: true, status: 200, text: '{"a":', json: { stop_reason: 'max_tokens' } });
    expect(await runDesignModel({ ...base, v2: true })).toMatchObject({ ok: false, reason: 'max_tokens' });
    executeAiChat.mockResolvedValueOnce({ ok: false, status: 499, error: 'Cancelled by client' });
    expect(await runDesignModel({ ...base, v2: true })).toMatchObject({ ok: false, status: 499, reason: 'upstream' });
  });
});
