export type AiModel = 'gpt-4o' | 'gpt-5.1' | 'custom';

export type AiMessageContent = 
  | string 
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

export type AiMessage = { 
  role: 'system' | 'user' | 'assistant' | 'tool'; 
  content: AiMessageContent;
};

export type AiRequest = { 
  model?: string; 
  messages: AiMessage[]; 
  temperature?: number; 
  maxTokens?: number; 
  stream?: boolean;
};

export type AiResponse = { text: string };

export interface ModelCapabilities {
  vision: boolean;
  maxTokens: number;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  'gpt-4o': { vision: true, maxTokens: 128000 },
  'gpt-5.1': { vision: true, maxTokens: 200000 },
};

export function getModelCapabilities(model: string): ModelCapabilities {
  return MODEL_CAPABILITIES[model] || { vision: false, maxTokens: 4096 };
}

export function supportsVision(model: string): boolean {
  return getModelCapabilities(model).vision;
}

export interface AiClient {
  chat(req: AiRequest): Promise<AiResponse>;
  stream?(req: AiRequest, onToken: (t:string)=>void): Promise<void>;
}