import type { AiClient, AiRequest, AiResponse, AiMessage } from './types';
import { supportsVision } from './types';

function hasImageContent(messages: AiMessage[]): boolean {
  return messages.some(m => {
    if (typeof m.content === 'string') return false;
    return m.content.some(part => part.type === 'image_url');
  });
}

function serializeMessages(messages: AiMessage[]): unknown[] {
  return messages.map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : m.content.map(part => {
      if (part.type === 'text') return { type: 'text', text: part.text };
      return { type: 'image_url', image_url: { url: part.image_url.url } };
    })
  }));
}

// Friendly label used by the global "working…" indicator. Falls back to a
// generic label if no taskType is supplied.
function jobLabelFor(taskType: string | undefined): string {
  switch (taskType) {
    case 'prd_generation': return 'Generating PRD';
    case 'workflow_reasoning': return 'Generating workflow';
    case 'workflow_experiments': return 'Running experiment';
    case 'workflow_generate': return 'Generating workflow';
    case 'workflow_edit': return 'Editing workflow';
    case 'workflow_advise': return 'Analyzing workflow';
    case 'vision_ingestion': return 'Analyzing image';
    case 'general_chat': return 'KiteAI is thinking';
    default: return 'AI is working';
  }
}

// Hook that the AiJobsProvider wires up at app startup. Allows OpenAICompatClient
// (which is plain JS, not a React component) to register/clear pending jobs in
// the global store so the persistent indicator can show progress and so jobs
// survive tab navigation.
type JobHooks = {
  register: (job: { jobId: string; label: string; taskType?: string; startedAt: number }) => void;
  clear: (jobId: string) => void;
};

let jobHooks: JobHooks | null = null;
export function setAiJobHooks(hooks: JobHooks | null) {
  jobHooks = hooks;
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

async function pollJob(jobId: string): Promise<{ text: string }> {
  const startedAt = Date.now();
  while (true) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error('AI job timed out');
    }
    const res = await fetch(`/api/ai/jobs/${jobId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`AI error: ${res.status} - ${err.error || 'Unknown error'}`);
    }
    const data = await res.json();
    if (data.status === 'completed') {
      return { text: data.text ?? '' };
    }
    if (data.status === 'failed') {
      throw new Error(`AI error: ${data.errorStatus || 500} - ${data.error || 'Unknown error'}`);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

export class OpenAICompatClient implements AiClient {
  constructor(private opts: { baseURL: string; apiKey?: string; headers?: Record<string,string>; defaultModel?: string }) {}

  async chat(req: AiRequest): Promise<AiResponse> {
    const savedSettings = localStorage.getItem('ai_settings');
    let currentModel = req.model || this.opts.defaultModel || 'claude-sonnet-4-5-20250929';
    let provider = req.provider || 'anthropic';
    let apiKey = null;

    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (!req.model) {
          currentModel = settings.model === 'custom' && settings.customModel
            ? settings.customModel
            : settings.model || currentModel;
        }
        if (!req.provider) {
          provider = settings.provider || 'anthropic';
        }
        apiKey = settings.apiKey;
      } catch (e) {
        console.warn('Failed to parse saved AI settings, using default model');
      }
    }

    const containsImages = hasImageContent(req.messages);
    if (containsImages && !supportsVision(currentModel)) {
      console.warn(`[OpenAICompatClient] Model ${currentModel} does not support vision. Falling back to claude-sonnet-4-5-20250929.`);
      currentModel = 'claude-sonnet-4-5-20250929';
    }

    const serializedMessages = serializeMessages(req.messages);

    // POST /api/ai/job: returns a jobId immediately. The server runs the AI call in
    // the background and only deducts credits if it succeeds. We then poll until
    // the job completes — this means tab navigation, panel closes, etc. don't
    // cancel an in-flight AI operation.
    const startRes = await fetch('/api/ai/job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: currentModel,
        messages: serializedMessages,
        temperature: req.temperature ?? 0.7,
        maxTokens: req.maxTokens ?? 1024,
        provider: provider,
        apiKey: apiKey,
        taskType: req.taskType,
        optimizationSessionId: req.optimizationSessionId,
        jobLabel: jobLabelFor(req.taskType),
      }),
    });

    if (!startRes.ok) {
      const errorData = await startRes.json().catch(() => ({}));
      throw new Error(`AI error: ${startRes.status} - ${errorData.error || 'Unknown error'}`);
    }

    const { jobId } = await startRes.json();
    if (!jobId) throw new Error('AI error: server did not return a job id');

    const startedAt = Date.now();
    jobHooks?.register({ jobId, label: jobLabelFor(req.taskType), taskType: req.taskType, startedAt });

    try {
      const { text } = await pollJob(jobId);
      return { text };
    } finally {
      jobHooks?.clear(jobId);
    }
  }
}
