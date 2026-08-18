import { OpenAICompatClient } from '../OpenAICompatClient';
import { createAiRouter, type AiRouter } from './aiRouter';

let routerInstance: AiRouter | null = null;

/**
 * Get the singleton AI router instance.
 * All AI calls should go through this router for proper task-type routing,
 * session locking, and model provenance tracking.
 */
export function getRouter(): AiRouter {
  if (!routerInstance) {
    const baseClient = new OpenAICompatClient({ baseURL: '/api/ai' });
    routerInstance = createAiRouter(baseClient);
  }
  return routerInstance;
}

/**
 * Reset the router instance (useful for testing)
 */
export function resetRouter(): void {
  routerInstance = null;
}
