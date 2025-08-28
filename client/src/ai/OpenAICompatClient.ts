import type { AiClient, AiRequest, AiResponse } from './types';

export class OpenAICompatClient implements AiClient {
  constructor(private opts: { baseURL: string; apiKey?: string; headers?: Record<string,string> }) {}
  async chat(req: AiRequest): Promise<AiResponse> {
    // Using gpt-4o for better compatibility
    // Use backend proxy to access server-side API key
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: req.model || 'gpt-4o', 
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