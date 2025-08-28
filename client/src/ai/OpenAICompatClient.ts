import type { AiClient, AiRequest, AiResponse } from './types';

export class OpenAICompatClient implements AiClient {
  constructor(private opts: { baseURL: string; apiKey?: string; headers?: Record<string,string> }) {}
  async chat(req: AiRequest): Promise<AiResponse> {
    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const res = await fetch(`${this.opts.baseURL.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.opts.apiKey?{Authorization:`Bearer ${this.opts.apiKey}`}:{}) , ...(this.opts.headers||{}) },
      body: JSON.stringify({ model: req.model || 'gpt-5', messages: req.messages, temperature: req.temperature ?? 0.7, max_tokens: req.maxTokens ?? 1024 })
    });
    if(!res.ok) throw new Error(`AI error: ${res.status}`);
    const json = await res.json();
    return { text: json.choices?.[0]?.message?.content ?? '' };
  }
}