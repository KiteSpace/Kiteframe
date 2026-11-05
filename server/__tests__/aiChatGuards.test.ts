import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeAiChat } from '../aiChatExecutor';

describe('executeAiChat client guards', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  afterEach(() => fetchSpy.mockClear());
  const messages = [{ role: 'user', content: 'hi' }];

  it('rejects server-only task types, including as an array', async () => {
    for (const taskType of ['design_v2', ['design_v2'], 'wireframe', { k: 1 }]) {
      const r = await executeAiChat({ provider: 'anthropic', taskType, messages });
      expect(r).toMatchObject({ ok: false, status: 400, error: 'Unsupported task type.' });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a client-picked flagged model on a user task type', async () => {
    const r = await executeAiChat({ provider: 'anthropic', taskType: 'general_chat', model: 'claude-sonnet-5-5', messages });
    expect(r).toMatchObject({ ok: false, status: 400, error: 'Unsupported model.' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
