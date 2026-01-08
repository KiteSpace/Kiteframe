export type TaskType = 
  | 'workflow_reasoning'
  | 'workflow_experiments'
  | 'workflow_advise'
  | 'workflow_edit'
  | 'workflow_generate'
  | 'prd_generation'
  | 'vision_ingestion'
  | 'general_chat';

export interface SessionModelLock {
  provider: string;
  model: string;
  lockedAt: number;
}

export interface RouterMetadata {
  taskType: TaskType;
  sessionId?: string;
  sessionModelLock?: SessionModelLock;
  providerUsed: string;
  modelUsed: string;
  retryCount?: number;
  usedFallback: boolean;
  fallbackModelUsed?: string;
}

export interface RouterRequest {
  taskType: TaskType;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
  }>;
  sessionId?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Partial<RouterMetadata>;
}

export interface RouterResponse {
  text: string;
  metadata: RouterMetadata;
}

export interface ModelPolicy {
  systemModel: string;
  systemProvider: string;
  allowUserOverride: boolean;
  fallbackModel?: string;
}

export const TASK_TYPE_POLICIES: Record<TaskType, ModelPolicy> = {
  workflow_reasoning: {
    systemModel: 'gpt-4o',
    systemProvider: 'openai',
    allowUserOverride: false,
    fallbackModel: 'gpt-4o',
  },
  workflow_experiments: {
    systemModel: 'gpt-4o',
    systemProvider: 'openai',
    allowUserOverride: false,
    fallbackModel: 'gpt-4o',
  },
  workflow_advise: {
    systemModel: 'gpt-4o',
    systemProvider: 'openai',
    allowUserOverride: true,
    fallbackModel: 'gpt-4o',
  },
  workflow_edit: {
    systemModel: 'gpt-4o',
    systemProvider: 'openai',
    allowUserOverride: false,
    fallbackModel: 'gpt-4o',
  },
  workflow_generate: {
    systemModel: 'gpt-4o',
    systemProvider: 'openai',
    allowUserOverride: false,
    fallbackModel: 'gpt-4o',
  },
  prd_generation: {
    systemModel: 'gpt-4o',
    systemProvider: 'openai',
    allowUserOverride: false,
    fallbackModel: 'gpt-4o',
  },
  vision_ingestion: {
    systemModel: 'gpt-4o',
    systemProvider: 'openai',
    allowUserOverride: false,
    fallbackModel: undefined,
  },
  general_chat: {
    systemModel: 'gpt-4o',
    systemProvider: 'openai',
    allowUserOverride: true,
    fallbackModel: 'gpt-4o',
  },
};
