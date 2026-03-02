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
    systemModel: 'claude-sonnet-4-5',
    systemProvider: 'anthropic',
    allowUserOverride: false,
    fallbackModel: 'claude-haiku-3-5',
  },
  workflow_experiments: {
    systemModel: 'claude-sonnet-4-5',
    systemProvider: 'anthropic',
    allowUserOverride: false,
    fallbackModel: 'claude-haiku-3-5',
  },
  workflow_advise: {
    systemModel: 'claude-sonnet-4-5',
    systemProvider: 'anthropic',
    allowUserOverride: true,
    fallbackModel: 'claude-haiku-3-5',
  },
  workflow_edit: {
    systemModel: 'claude-sonnet-4-5',
    systemProvider: 'anthropic',
    allowUserOverride: false,
    fallbackModel: 'claude-haiku-3-5',
  },
  workflow_generate: {
    systemModel: 'claude-sonnet-4-5',
    systemProvider: 'anthropic',
    allowUserOverride: false,
    fallbackModel: 'claude-haiku-3-5',
  },
  prd_generation: {
    systemModel: 'claude-sonnet-4-5',
    systemProvider: 'anthropic',
    allowUserOverride: false,
    fallbackModel: 'claude-haiku-3-5',
  },
  vision_ingestion: {
    systemModel: 'claude-sonnet-4-5',
    systemProvider: 'anthropic',
    allowUserOverride: false,
    fallbackModel: undefined,
  },
  general_chat: {
    systemModel: 'claude-haiku-3-5',
    systemProvider: 'anthropic',
    allowUserOverride: true,
    fallbackModel: 'claude-haiku-3-5',
  },
};
