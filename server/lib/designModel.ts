import { executeAiChat } from '../aiChatExecutor';
import type { createStageTimer } from './stageTiming';
import { parseDesignJson, readUsage, type DesignModelUsage } from './designJson';

export { parseDesignJson, readUsage, type DesignJsonResult, type DesignModelUsage } from './designJson';

/** Feature flag gating the current-model, no-prefill, cached-prompt design path. */
export const DESIGN_AI_V2_FLAG = 'design_ai_v2';

export const DESIGN_JSON_ONLY_RULE =
  'Respond with only the JSON object described above: no prose before or after it and no markdown code fences.';

type StageTimer = ReturnType<typeof createStageTimer>;


export interface RunDesignModelOptions {
  /** `design_ai_v2`: current model, no prefill, cached static system prefix. */
  v2: boolean;
  /** Task type for the legacy and v2 paths, resolved through TASK_TYPE_MODELS. */
  taskType: { legacy: string; v2: string };
  /** Static prefix first (cached on v2), then any per-route extensions. */
  systemBlocks: string[];
  messages: Array<{ role: 'user' | 'assistant'; content: any }>;
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
  timer?: StageTimer;
  /** Parse the reply as JSON (default true). The planner validates its own output. */
  parseJson?: boolean;
}

export type RunDesignModelResult =
  | { ok: true; value: any; text: string; stopReason?: string; usage: DesignModelUsage; model: string }
  | {
      ok: false;
      status: number;
      error: string;
      reason: 'upstream' | 'max_tokens' | 'incomplete' | 'invalid';
      usage?: DesignModelUsage;
      model?: string;
    };

export async function runDesignModel(o: RunDesignModelOptions): Promise<RunDesignModelResult> {
  const blocks = o.systemBlocks.filter((b) => b && b.length > 0);
  const prefill = !o.v2;
  const result = await executeAiChat(
    {
      provider: 'anthropic',
      taskType: o.v2 ? o.taskType.v2 : o.taskType.legacy,
      maxTokens: o.maxTokens,
      // Current (v2) models reject `temperature`.
        ...(!o.v2 && typeof o.temperature === 'number' ? { temperature: o.temperature } : {}),
      messages: prefill ? [...o.messages, { role: 'assistant', content: '{' }] : o.messages,
    },
    o.signal,
    o.v2
      ? { systemBlocks: o.parseJson === false ? blocks : [...blocks, DESIGN_JSON_ONLY_RULE], cacheSystem: true,
          rawUserText: true }
      : { systemPrompt: blocks.join('\n\n'),
          rawUserText: true },
  );
  if (!result.ok) {
    o.timer?.mark('model', { ok: false, status: result.status });
    return { ok: false, status: result.status || 500, error: result.error || 'AI generation failed', reason: 'upstream' };
  }
  const usage = readUsage(result.json);
  const stopReason: string | undefined = result.json?.stop_reason;
  const model = result.activeModel || '';
  o.timer?.mark('model', {
    model,
    stopReason,
    tokensIn: usage.inputTokens,
    tokensOut: usage.outputTokens,
    cacheRead: usage.cacheReadTokens,
    cacheWrite: usage.cacheCreationTokens,
  });
  if (stopReason === 'max_tokens') {
    return { ok: false, status: 500, error: 'truncated', reason: 'max_tokens', usage, model };
  }
  const text = result.text || '';
  if (o.parseJson === false) return { ok: true, value: null, text, stopReason, usage, model };
  const parsed = parseDesignJson(text, prefill);
  o.timer?.mark('parse', { ok: parsed.ok });
  if (!parsed.ok) {
    if (parsed.error === 'invalid') console.error('[design] JSON parse failed. First 800 chars:', text.slice(0, 800));
    return { ok: false, status: 500, error: parsed.error, reason: parsed.error, usage, model };
  }
  return { ok: true, value: parsed.value, text, stopReason, usage, model };
}
