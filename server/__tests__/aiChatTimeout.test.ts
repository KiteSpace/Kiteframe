import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeAiChat } from '../aiChatExecutor';

const body = {
  provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', apiKey: 'test-only-key',
  messages: [{ role: 'user', content: 'Test request' }],
};

afterEach(() => vi.unstubAllGlobals());

describe('AI provider abort handling', () => {
  it('reports a provider deadline as a timeout rather than an internal server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Deadline exceeded', 'TimeoutError')));
    expect(await executeAiChat(body)).toMatchObject({ ok: false, status: 504, error: 'AI request timed out. Please retry.' });
  });

  it('recognizes a timeout signal even when fetch rejects with AbortError', async () => {
    const controller = new AbortController();
    controller.abort(new DOMException('Deadline exceeded', 'TimeoutError'));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
    expect(await executeAiChat(body, controller.signal)).toMatchObject({ ok: false, status: 504 });
  });

  it('keeps user cancellation distinct from a timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
    expect(await executeAiChat(body)).toMatchObject({ ok: false, status: 499, error: 'Cancelled by client' });
  });
});
