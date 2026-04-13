export type AiModel = 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-5-20250929' | 'claude-opus-4-5-20251101' | 'custom';

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
  optimizationSessionId?: string;
};

export type AiResponse = { text: string };

export interface ModelCapabilities {
  vision: boolean;
  maxTokens: number;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  'claude-haiku-4-5-20251001': { vision: true, maxTokens: 200000 },
  'claude-sonnet-4-5-20250929': { vision: true, maxTokens: 200000 },
  'claude-opus-4-5-20251101': { vision: true, maxTokens: 200000 },
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