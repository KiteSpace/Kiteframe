import type { AiClient, AiRequest, AiResponse } from './types';

export class OpenAICompatClient implements AiClient {
  constructor(private opts: { baseURL: string; apiKey?: string; headers?: Record<string,string> }) {}
  async chat(req: AiRequest): Promise<AiResponse> {
    const res = await fetch(`${this.opts.baseURL.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.opts.apiKey?{Authorization:`Bearer ${this.opts.apiKey}`}:{}) , ...(this.opts.headers||{}) },
      body: JSON.stringify({ model: req.model || 'gpt-4o-mini', messages: req.messages, temperature: req.temperature ?? 0.7, max_tokens: req.maxTokens ?? 1024 })
    });
    if(!res.ok) throw new Error(`AI error: ${res.status}`);
    const json = await res.json();
    return { text: json.choices?.[0]?.message?.content ?? '' };
  }
}
