import type { RouterMetadata } from './types';
import type { ModelProvenance } from '../explainability/types';

/**
 * Convert RouterMetadata to ModelProvenance for DecisionSnapshot
 * This ensures model identity is auditable in Phase 5
 */
export function toModelProvenance(metadata: RouterMetadata): ModelProvenance {
  return {
    providerUsed: metadata.providerUsed,
    modelUsed: metadata.modelUsed,
    routerTaskType: metadata.taskType as ModelProvenance['routerTaskType'],
    usedFallback: metadata.usedFallback,
    fallbackModelUsed: metadata.fallbackModelUsed,
    sessionId: metadata.sessionId,
  };
}

/**
 * Create a minimal ModelProvenance when router metadata is not available
 * (e.g., for legacy code paths)
 */
export function createFallbackProvenance(
  provider: string = 'anthropic',
  model: string = 'claude-3-haiku-20240307',
  taskType: ModelProvenance['routerTaskType'] = 'general_chat'
): ModelProvenance {
  return {
    providerUsed: provider,
    modelUsed: model,
    routerTaskType: taskType,
    usedFallback: false,
  };
}
