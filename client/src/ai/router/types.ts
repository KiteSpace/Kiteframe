export type TaskType =
  | 'workflow_reasoning'
  | 'workflow_experiments'
  | 'workflow_advise'
  | 'workflow_edit'
  | 'workflow_generate'
  | 'prd_generation'
  | 'vision_ingestion'
  | 'general_chat';

export interface ModelPolicy {
  systemModel: string;
  systemProvider: string;
  allowUserOverride: boolean;
  fallbackModel?: string;
}

export interface RouterRequest {
  taskType?: TaskType;
  model?: string;
  provider?: string;
  messages: any[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  optimizationSessionId?: string;
}

export interface RouterResponse {
  text: string;
  model?: string;
  provider?: string;
  requestId?: string;
}

export interface RouterState {
  requestId: string;
  taskType: TaskType | undefined;
  model: string;
  provider: string;
  retryCount: number;
  usedSessionLock: boolean;
}

export const TASK_TYPE_POLICIES: Record<TaskType, ModelPolicy> = {
  workflow_reasoning: {
    systemModel: 'claude-sonnet-4-5-20250929',
    systemProvider: 'anthropic',
    allowUserOverride: false,
    fallbackModel: 'claude-haiku-4-5-20251001',
  },
  workflow_experiments: {
    systemModel: 'claude-sonnet-4-5-20250929',
    systemProvider: 'anthropic',
    allowUserOverride: false,
    fallbackModel: 'claude-haiku-4-5-20251001',
  },
  workflow_advise: {
    systemModel: 'claude-haiku-4-5-20251001',
    systemProvider: 'anthropic',
    allowUserOverride: true,
    fallbackModel: 'claude-haiku-4-5-20251001',
  },
  workflow_edit: {
    systemModel: 'claude-sonnet-4-5-20250929',
    systemProvider: 'anthropic',
    allowUserOverride: false,
    fallbackModel: 'claude-haiku-4-5-20251001',
  },
  workflow_generate: {
    systemModel: 'claude-sonnet-4-5-20250929',
    systemProvider: 'anthropic',
    allowUserOverride: false,
    fallbackModel: 'claude-haiku-4-5-20251001',
  },
  prd_generation: {
    systemModel: 'claude-sonnet-4-5-20250929',
    systemProvider: 'anthropic',
    allowUserOverride: false,
    fallbackModel: 'claude-haiku-4-5-20251001',
  },
  vision_ingestion: {
    systemModel: 'claude-sonnet-4-5-20250929',
    systemProvider: 'anthropic',
    allowUserOverride: false,
    fallbackModel: undefined,
  },
  general_chat: {
    systemModel: 'claude-haiku-4-5-20251001',
    systemProvider: 'anthropic',
    allowUserOverride: true,
    fallbackModel: 'claude-haiku-4-5-20251001',
  },
};
