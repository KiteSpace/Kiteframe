import type { AiClient, AiMessage } from '../types';
import { supportsVision } from '../types';
import type { 
  TaskType, 
  RouterRequest, 
  RouterResponse, 
  RouterMetadata,
  SessionModelLock,
} from './types';
import { TASK_TYPE_POLICIES } from './types';
import { ENABLE_GPT5_WORKFLOW_REASONING, ROUTER_CONFIG } from './config';
import { getSessionLock, setSessionLock, hasSessionLock } from './sessionLock';

function hasImageContent(messages: AiMessage[]): boolean {
  return messages.some(m => {
    if (typeof m.content === 'string') return false;
    return m.content.some(part => part.type === 'image_url');
  });
}

function getUserSettings(): { provider: string; model: string } | null {
  try {
    const saved = localStorage.getItem('ai_settings');
    if (saved) {
      const settings = JSON.parse(saved);
      return {
        provider: settings.provider || 'openai',
        model: settings.model === 'custom' && settings.customModel 
          ? settings.customModel 
          : settings.model || 'gpt-4o',
      };
    }
  } catch (e) {
    console.warn('[AIRouter] Failed to parse user settings');
  }
  return null;
}

function resolveModel(
  taskType: TaskType,
  sessionId?: string,
  containsImages?: boolean
): { provider: string; model: string; usedSessionLock: boolean } {
  const policy = TASK_TYPE_POLICIES[taskType];
  
  if (sessionId && hasSessionLock(sessionId)) {
    const lock = getSessionLock(sessionId)!;
    return { 
      provider: lock.provider, 
      model: lock.model,
      usedSessionLock: true,
    };
  }
  
  if (policy.allowUserOverride) {
    const userSettings = getUserSettings();
    if (userSettings) {
      let model = userSettings.model;
      if (containsImages && !supportsVision(model)) {
        console.warn(`[AIRouter] Model ${model} does not support vision. Falling back to ${ROUTER_CONFIG.visionModel}.`);
        model = ROUTER_CONFIG.visionModel;
      }
      return { 
        provider: userSettings.provider, 
        model,
        usedSessionLock: false,
      };
    }
  }
  
  if (ENABLE_GPT5_WORKFLOW_REASONING) {
    return { 
      provider: policy.systemProvider, 
      model: policy.systemModel,
      usedSessionLock: false,
    };
  }
  
  return { 
    provider: policy.systemProvider, 
    model: policy.fallbackModel || 'gpt-4o',
    usedSessionLock: false,
  };
}

export function createAiRouter(baseClient: AiClient) {
  async function chat(request: RouterRequest): Promise<RouterResponse> {
    const { taskType, messages, sessionId, temperature, maxTokens, metadata } = request;
    
    const containsImages = hasImageContent(messages as AiMessage[]);
    const { provider, model, usedSessionLock } = resolveModel(taskType, sessionId, containsImages);
    
    if (sessionId && !usedSessionLock) {
      const lock: SessionModelLock = {
        provider,
        model,
        lockedAt: Date.now(),
      };
      setSessionLock(sessionId, lock);
    }
    
    const routerMetadata: RouterMetadata = {
      taskType,
      sessionId,
      sessionModelLock: sessionId ? getSessionLock(sessionId) : undefined,
      providerUsed: provider,
      modelUsed: model,
      retryCount: metadata?.retryCount ?? 0,
      usedFallback: metadata?.usedFallback ?? false,
      fallbackModelUsed: metadata?.fallbackModelUsed,
    };
    
    try {
      const response = await baseClient.chat({
        model,
        provider,
        messages: messages as AiMessage[],
        temperature: temperature ?? ROUTER_CONFIG.defaultTemperature,
        maxTokens: maxTokens ?? ROUTER_CONFIG.defaultMaxTokens,
        taskType,
      });
      
      return {
        text: response.text,
        metadata: routerMetadata,
      };
    } catch (error) {
      const policy = TASK_TYPE_POLICIES[taskType];
      const currentRetry = metadata?.retryCount ?? 0;
      const alreadyUsedFallback = metadata?.usedFallback ?? false;
      
      if (currentRetry < ROUTER_CONFIG.maxRetries) {
        console.warn(`[AIRouter] Request failed, retrying (${currentRetry + 1}/${ROUTER_CONFIG.maxRetries})...`);
        return chat({
          ...request,
          metadata: {
            retryCount: currentRetry + 1,
            usedFallback: alreadyUsedFallback,
            fallbackModelUsed: metadata?.fallbackModelUsed,
          },
        });
      }
      
      if (policy.fallbackModel && model !== policy.fallbackModel && !alreadyUsedFallback) {
        console.warn(`[AIRouter] Retries exhausted. Falling back to ${policy.fallbackModel}.`);
        
        try {
          const fallbackResponse = await baseClient.chat({
            model: policy.fallbackModel,
            provider: policy.systemProvider,
            messages: messages as AiMessage[],
            temperature: temperature ?? ROUTER_CONFIG.defaultTemperature,
            maxTokens: maxTokens ?? ROUTER_CONFIG.defaultMaxTokens,
            taskType,
          });
          
          return {
            text: fallbackResponse.text,
            metadata: {
              ...routerMetadata,
              modelUsed: policy.fallbackModel,
              usedFallback: true,
              fallbackModelUsed: policy.fallbackModel,
            },
          };
        } catch (fallbackError) {
          console.error(`[AIRouter] Fallback to ${policy.fallbackModel} also failed.`);
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }
  
  return { chat };
}

export type AiRouter = ReturnType<typeof createAiRouter>;
