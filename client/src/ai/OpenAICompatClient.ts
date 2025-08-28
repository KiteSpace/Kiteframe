import type { AiClient, AiRequest, AiResponse } from './types';

export class OpenAICompatClient implements AiClient {
  constructor(private opts: { baseURL: string; apiKey?: string; headers?: Record<string,string> }) {}
  async chat(req: AiRequest): Promise<AiResponse> {
    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    // Use backend proxy to access server-side API key
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: req.model || 'gpt-5', 
        messages: req.messages, 
        temperature: req.temperature ?? 0.7, 
        maxTokens: req.maxTokens ?? 1024 
      })
    });
    if(!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`AI error: ${res.status} - ${errorData.error || 'Unknown error'}`);
    }
    const json = await res.json();
    return { text: json.text ?? '' };
  }
}