export type AiModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4' | 'gpt-3.5-turbo' | 'gpt-5' | 'gpt-5.1' | 'custom';

export type AiMode = 'ADVISE' | 'EDIT' | 'GENERATE';

export const AI_MODE_LABELS: Record<AiMode, string> = {
  ADVISE: 'Suggest',
  EDIT: 'Apply changes',
  GENERATE: 'Create new workflow',
};

export const AI_MODE_DESCRIPTIONS: Record<AiMode, string> = {
  ADVISE: 'Get suggestions and analysis without modifying the canvas',
  EDIT: 'Apply changes to the existing workflow',
  GENERATE: 'Create a new workflow from scratch',
};

export const DEFAULT_AI_MODE: AiMode = 'EDIT'; // Phase 4: Changed from ADVISE - toggle removed, mutations always allowed

export type AiMessageContent = 
  | string 
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

export type AiMessage = { 
  role: 'system' | 'user' | 'assistant' | 'tool'; 
  content: AiMessageContent;
};

export type AiRequest = { 
  model?: string; 
  provider?: string;
  messages: AiMessage[]; 
  temperature?: number; 
  maxTokens?: number; 
  stream?: boolean;
  taskType?: string;
};

export type AiResponse = { text: string };

export interface ModelCapabilities {
  vision: boolean;
  maxTokens: number;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  'gpt-4o': { vision: true, maxTokens: 128000 },
  'gpt-4o-mini': { vision: true, maxTokens: 128000 },
  'gpt-4': { vision: false, maxTokens: 8192 },
  'gpt-3.5-turbo': { vision: false, maxTokens: 4096 },
  'gpt-5': { vision: true, maxTokens: 200000 },
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