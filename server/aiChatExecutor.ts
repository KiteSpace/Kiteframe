import { sanitizeAiPrompt, MAX_AI_PROMPT_CHARS } from "./utils/sanitize";

export interface AiChatExecResult {
  ok: boolean;
  status: number;
  text?: string;
  json?: any;
  activeProvider?: string;
  activeModel?: string;
  error?: string;
  details?: string;
}

const TASK_TYPE_MODELS: Record<string, { model: string; provider: string; allowUserOverride: boolean }> = {
  workflow_reasoning: { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic', allowUserOverride: false },
  workflow_experiments: { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic', allowUserOverride: false },
  workflow_edit: { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic', allowUserOverride: false },
  workflow_generate: { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic', allowUserOverride: false },
  workflow_advise: { model: 'claude-haiku-4-5-20251001', provider: 'anthropic', allowUserOverride: true },
  prd_generation: { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic', allowUserOverride: false },
  vision_ingestion: { model: 'claude-sonnet-4-5-20250929', provider: 'anthropic', allowUserOverride: false },
  general_chat: { model: 'claude-haiku-4-5-20251001', provider: 'anthropic', allowUserOverride: true },
};

const COMPLEXITY_KEYWORDS = /\b(if|when|unless|condition|loop|retry|branch|parallel|decision|fallback|alternative|exception|error handling|multiple|either|otherwise|in case|depends on|based on|check whether|validate|approval|escalat)\b/i;

function isSimpleWorkflowPrompt(msgs: any[]): boolean {
  const lastUser = [...msgs].reverse().find((m: any) => m.role === 'user');
  if (!lastUser) return false;
  const text = typeof lastUser.content === 'string' ? lastUser.content
    : Array.isArray(lastUser.content) ? lastUser.content.map((c: any) => c.text || '').join(' ')
    : '';
  const wordCount = text.trim().split(/\s+/).length;
  return wordCount <= 20 && !COMPLEXITY_KEYWORDS.test(text);
}

/**
 * Deepest content nesting that will be walked. Real payloads are at most a
 * couple of levels (a tool_result block holding text blocks); anything past
 * this is an abusive payload, so its content is dropped rather than recursed
 * into.
 */
const MAX_CONTENT_DEPTH = 6;

/** Shared per-message allowance, so many small blocks cannot outflank a per-block cap. */
interface TextBudget { left: number }

function takeFromBudget(text: string, budget: TextBudget): string {
  if (budget.left <= 0) return '';
  const cleaned = sanitizeAiPrompt(text);
  const out = cleaned.length > budget.left ? cleaned.slice(0, budget.left) : cleaned;
  budget.left -= out.length;
  return out;
}

function sanitizeContentNode(node: unknown, budget: TextBudget, depth: number): unknown {
  if (typeof node === 'string') return takeFromBudget(node, budget);
  if (Array.isArray(node)) {
    if (depth >= MAX_CONTENT_DEPTH) return [];
    return node.map((child) => sanitizeContentNode(child, budget, depth + 1));
  }
  if (node && typeof node === 'object') {
    const block = node as Record<string, any>;
    // Image blocks pass through byte-for-byte: sanitizing base64 would corrupt
    // it, and the routes already cap image size on the way in.
    if (block.type === 'image') return block;
    if (depth >= MAX_CONTENT_DEPTH) return {};
    const out: Record<string, any> = { ...block };
    // `text` covers text blocks; `content` covers containers such as
    // tool_result, whose nested payload is text the client chose.
    if (typeof block.text === 'string') out.text = takeFromBudget(block.text, budget);
    if (block.content !== undefined) out.content = sanitizeContentNode(block.content, budget, depth + 1);
    return out;
  }
  return node;
}

/**
 * Applies the user-input filter to every part of a message that carries text,
 * whatever shape the content arrives in.
 *
 * The vision routes (design-from-image, design-from-url, Figma frame import)
 * send `content` as an array of blocks - an `{type:'image'}` alongside a
 * `{type:'text'}` - and those text blocks carry user-influenced values such as
 * a Figma frame label. `/api/ai/chat` additionally accepts whatever a client
 * sends, including provider-valid containers like `tool_result` that nest text
 * one level deeper. Every text-bearing field is filtered and counted against a
 * single per-message budget, so splitting hostile text across many blocks does
 * not buy a larger allowance than one long string would get.
 *
 * Image blocks are the sole exception and are passed through untouched.
 */
function sanitizeMessageContent(content: unknown): unknown {
  return sanitizeContentNode(content, { left: MAX_AI_PROMPT_CHARS }, 0);
}

/**
 * Server-only options. These are function arguments precisely so that no HTTP
 * payload can reach them: `/api/ai/chat` and the async job worker hand `body`
 * to this function straight from the client request.
 */
export interface AiChatInternalOptions {
  /** Trusted system prompt. Only route handlers may supply this. */
  systemPrompt?: string;
}

export async function executeAiChat(
  body: any,
  signal?: AbortSignal,
  internal?: AiChatInternalOptions,
): Promise<AiChatExecResult> {
  try {
    const { model, temperature, maxTokens, provider, apiKey: clientApiKey, taskType } = body;

    let resolvedModel = model;
    let resolvedProvider = provider;

    if (taskType && TASK_TYPE_MODELS[taskType]) {
      const policy = TASK_TYPE_MODELS[taskType];
      if (!policy.allowUserOverride || !model) {
        resolvedModel = policy.model;
        resolvedProvider = policy.provider;
      }
      if (taskType === 'workflow_generate' && isSimpleWorkflowPrompt(body.messages || [])) {
        resolvedModel = 'claude-haiku-4-5-20251001';
        resolvedProvider = 'anthropic';
      }
    }

    // NOTHING in `body` is trusted: `/api/ai/chat` and the job worker forward a
    // client request body here verbatim. The only trusted system prompt is the
    // `internal` argument, which is unreachable from any HTTP payload - in
    // particular a client-supplied `body.systemPrompt` is never read.
    //
    // The trusted prompt skips sanitization because it is a server-owned
    // constant (the Astryx design catalog and vision extension). Sanitizing it
    // truncated the ~28k-char design template to 10k, hiding most of the
    // component list - and all of the output-format rules - from the model.
    const trustedSystemPrompt =
      typeof internal?.systemPrompt === 'string' && internal.systemPrompt.length > 0
        ? internal.systemPrompt
        : '';

    // Client messages can never occupy the provider's system channel. Any role
    // other than 'assistant' is demoted to 'user' before provider translation,
    // so a `role: 'system'` in the request body carries no privilege, and every
    // text payload - a plain string, or a text block inside an array-form
    // vision message - is sanitized and length-bounded.
    const sanitizedMessages = (body.messages || []).map((msg: any) => ({
      ...msg,
      role: msg?.role === 'assistant' ? 'assistant' : 'user',
      content: sanitizeMessageContent(msg?.content),
    }));

    const messages = trustedSystemPrompt
      ? [{ role: 'system', content: trustedSystemPrompt }, ...sanitizedMessages]
      : sanitizedMessages;

    let activeProvider = resolvedProvider || provider;
    let activeApiKey = clientApiKey;
    const activeModel = resolvedModel || model;

    if (!activeProvider) {
      if (activeModel && activeModel.includes('claude')) activeProvider = 'anthropic';
      else if (activeModel && (activeModel.includes('gpt') || activeModel.includes('o1'))) activeProvider = 'openai';
      else activeProvider = 'anthropic';
    }

    if (activeProvider === 'anthropic') {
      activeApiKey = activeApiKey || process.env.ANTHROPIC_API_KEY;
    } else if (activeProvider === 'openai') {
      activeApiKey = process.env.OPENAI_API_KEY;
    }

    if (!activeApiKey && activeProvider !== 'ollama' && activeProvider !== 'kiteframe') {
      return {
        ok: false,
        status: 401,
        error: `${activeProvider} API key not configured. Please set it in AI settings.`,
      };
    }

    let endpoint: string;
    let headers: Record<string, string>;
    let requestBody: any;

    if (activeProvider === 'anthropic') {
      endpoint = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': activeApiKey!,
        'anthropic-version': '2023-06-01',
      };
      const systemParts: string[] = [];
      const anthropicMessages = messages.filter((msg: any) => {
        if (msg.role === 'system') {
          const content = typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
              : '';
          if (content) systemParts.push(content);
          return false;
        }
        return true;
      });
      const systemPrompt = systemParts.join('\n\n');
      requestBody = {
        model: activeModel,
        max_tokens: maxTokens || 1024,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: anthropicMessages,
      };
    } else if (activeProvider === 'ollama') {
      const { customEndpoint } = body;
      endpoint = `${customEndpoint || 'http://localhost:11434'}/v1/chat/completions`;
      headers = { 'Content-Type': 'application/json' };
      requestBody = { model: activeModel, messages, temperature, max_tokens: maxTokens, stream: false };
    } else if (activeProvider === 'kiteframe') {
      endpoint = 'https://kiteline-ai.replit.app/v1/chat/completions';
      headers = { 'Content-Type': 'application/json' };
      requestBody = { model: activeModel, messages, temperature, max_tokens: maxTokens, stream: false };
    } else if (activeProvider === 'custom') {
      const { customEndpoint } = body;
      if (!customEndpoint) {
        return { ok: false, status: 400, error: 'Custom endpoint is required for custom provider' };
      }
      const isCustomOllama = customEndpoint.includes('ollama') || !activeApiKey;
      const isCustomOpenAI = customEndpoint.includes('api.openai.com');
      const isGpt5Model = activeModel && (activeModel.includes('gpt-5') || activeModel.startsWith('gpt-5'));
      endpoint = `${customEndpoint.replace(/\/$/, '')}/v1/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        ...(isCustomOllama ? {} : { 'Authorization': `Bearer ${activeApiKey}` }),
      };
      if (isCustomOpenAI && isGpt5Model) {
        requestBody = { model: activeModel, messages, max_completion_tokens: maxTokens };
      } else {
        requestBody = {
          model: activeModel,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(isCustomOllama ? { stream: false } : {}),
        };
      }
    } else {
      endpoint = 'https://api.anthropic.com/v1/messages';
      const fallbackKey = activeApiKey || process.env.ANTHROPIC_API_KEY;
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': fallbackKey || '',
        'anthropic-version': '2023-06-01',
      };
      requestBody = {
        model: activeModel || 'claude-haiku-4-5-20251001',
        messages,
        max_tokens: maxTokens || 1024,
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`${activeProvider} API Error ${response.status}:`, errText);
      try {
        const errorData = JSON.parse(errText);
        if (response.status === 400 && activeProvider === 'anthropic' &&
            errorData.error?.message?.includes('credit balance is too low')) {
          return {
            ok: false,
            status: 400,
            error: 'Insufficient credits in your Anthropic account. Please add credits in your Anthropic console.',
          };
        }
      } catch {}
      return {
        ok: false,
        status: response.status,
        error: `${activeProvider} API error: ${response.status}`,
        details: errText,
        activeProvider,
        activeModel,
      };
    }

    const json = await response.json();
    let responseText = '';
    if (activeProvider === 'anthropic') {
      responseText = json.content?.[0]?.text || '';
    } else {
      responseText = json.choices?.[0]?.message?.content || '';
    }

    return {
      ok: true,
      status: 200,
      text: responseText,
      json,
      activeProvider,
      activeModel,
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { ok: false, status: 499, error: 'Cancelled by client' };
    }
    console.error('executeAiChat error:', error);
    if (body?.provider === 'ollama' || body?.provider === 'kiteframe') {
      const serviceName = body.provider === 'kiteframe' ? 'Kiteframe' : 'Ollama';
      if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED') ||
          (error instanceof TypeError && error.message?.includes('fetch'))) {
        return {
          ok: false,
          status: 400,
          error: `${serviceName} service not available. ${body.provider === 'ollama' ? 'Please start Ollama locally with: ollama serve' : 'Please try again later or contact support.'}`,
        };
      }
      return {
        ok: false,
        status: 400,
        error: `${serviceName} connection failed. Ensure the service is running and accessible.`,
      };
    }
    return { ok: false, status: 500, error: 'Internal server error' };
  }
}
