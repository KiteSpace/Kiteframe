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
import { ROUTER_CONFIG } from './config';
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
        provider: settings.provider || 'anthropic',
        model: settings.model === 'custom' && settings.customModel 
          ? settings.customModel 
          : settings.model || 'claude-3-haiku-20240307',
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
  
  console.log(`[AIRouter] Using ${policy.systemModel} for ${taskType}`);
  return { 
    provider: policy.systemProvider, 
    model: policy.systemModel,
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
    
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startTime = performance.now();
    
    console.log(`[AIRouter] Request started:`, {
      requestId,
      taskType,
      model,
      provider,
      sessionId: sessionId ? sessionId.slice(0, 8) + '...' : undefined,
      retryCount: metadata?.retryCount ?? 0,
      usedSessionLock,
    });
    
    try {
      const response = await baseClient.chat({
        model,
        provider,
        messages: messages as AiMessage[],
        temperature: temperature ?? ROUTER_CONFIG.defaultTemperature,
        maxTokens: maxTokens ?? ROUTER_CONFIG.defaultMaxTokens,
        taskType,
      });
      
      const duration = Math.round(performance.now() - startTime);
      const responseLength = response.text?.length ?? 0;
      
      // Phase 1.2: Treat empty responses as failures - trigger fallback
      if (responseLength === 0) {
        const policy = TASK_TYPE_POLICIES[taskType];
        const alreadyUsedFallback = metadata?.usedFallback ?? false;
        
        console.error(`[AIRouter] Empty response received:`, {
          requestId,
          taskType,
          model,
          provider,
          durationMs: duration,
          issue: 'responseLength === 0',
        });
        
        // Try fallback if available, not already used, and different from primary
        const canFallback = policy.fallbackModel && 
                            policy.fallbackModel !== model && 
                            !alreadyUsedFallback;
        
        if (canFallback) {
          console.warn(`[AIRouter] Empty response from ${model}. Falling back to ${policy.fallbackModel}.`);
          
          const fallbackResponse = await baseClient.chat({
            model: policy.fallbackModel!,
            provider: policy.systemProvider,
            messages: messages as AiMessage[],
            temperature: temperature ?? ROUTER_CONFIG.defaultTemperature,
            maxTokens: maxTokens ?? ROUTER_CONFIG.defaultMaxTokens,
            taskType,
          });
          
          const fallbackLength = fallbackResponse.text?.length ?? 0;
          const fallbackDuration = Math.round(performance.now() - startTime);
          
          console.log(`[AIRouter] Fallback completed:`, {
            requestId,
            taskType,
            originalModel: model,
            fallbackModel: policy.fallbackModel,
            success: fallbackLength > 0,
            durationMs: fallbackDuration,
            responseLength: fallbackLength,
          });
          
          if (fallbackLength === 0) {
            throw new Error(`Both ${model} and fallback ${policy.fallbackModel} returned empty responses`);
          }
          
          return {
            text: fallbackResponse.text,
            metadata: {
              ...routerMetadata,
              modelUsed: policy.fallbackModel!,
              usedFallback: true,
              fallbackModelUsed: policy.fallbackModel,
            },
          };
        }
        
        // No fallback available or fallback same as primary - throw error
        throw new Error(`Model ${model} returned empty response and no distinct fallback available`);
      }
      
      console.log(`[AIRouter] Request completed:`, {
        requestId,
        taskType,
        model,
        provider,
        success: true,
        durationMs: duration,
        responseLength,
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
          
          const fallbackDuration = Math.round(performance.now() - startTime);
          console.log(`[AIRouter] Fallback completed:`, {
            requestId,
            taskType,
            originalModel: model,
            fallbackModel: policy.fallbackModel,
            success: true,
            durationMs: fallbackDuration,
            retryCount: currentRetry,
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
          const errorDuration = Math.round(performance.now() - startTime);
          console.error(`[AIRouter] Fallback to ${policy.fallbackModel} also failed:`, {
            requestId,
            taskType,
            originalModel: model,
            fallbackModel: policy.fallbackModel,
            durationMs: errorDuration,
            retryCount: currentRetry,
            error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
          });
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }
  
  return { chat };
}

export type AiRouter = ReturnType<typeof createAiRouter>;
