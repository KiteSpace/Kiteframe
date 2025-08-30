import type { AiClient, AiRequest, AiResponse } from './types';

export class OpenAICompatClient implements AiClient {
  constructor(private opts: { baseURL: string; apiKey?: string; headers?: Record<string,string>; defaultModel?: string }) {}
  
  async chat(req: AiRequest): Promise<AiResponse> {
    // Get the current AI settings from localStorage
    const savedSettings = localStorage.getItem('ai_settings');
    let currentModel = req.model || this.opts.defaultModel || 'gpt-4o';
    let provider = 'openai';
    let apiKey = null;
    
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        // Use the saved settings
        if (!req.model) {
          currentModel = settings.model === 'custom' && settings.customModel 
            ? settings.customModel 
            : settings.model || currentModel;
        }
        provider = settings.provider || 'openai';
        apiKey = settings.apiKey;
      } catch (e) {
        console.warn('Failed to parse saved AI settings, using default model');
      }
    }
    
    // Use backend proxy with provider information
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: currentModel, 
        messages: req.messages, 
        temperature: req.temperature ?? 0.7, 
        maxTokens: req.maxTokens ?? 1024,
        provider: provider,
        apiKey: apiKey
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