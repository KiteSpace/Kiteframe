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
    
    const res = await fetch('/api/ai/chat', {
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