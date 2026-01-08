/**
 * Advanced Model Feature Flag
 * 
 * Controls whether advanced models are used for workflow_reasoning, workflow_experiments,
 * and prd_generation tasks. When OFF, fallback model (GPT-4o) is used.
 * 
 * Environment variable: VITE_ENABLE_GPT5_WORKFLOW_REASONING
 * Values: "true" or "1" to enable, any other value to disable
 * 
 * Note: Currently all task types use gpt-4o as the stable default.
 */
export const ENABLE_GPT5_WORKFLOW_REASONING = 
  import.meta.env.VITE_ENABLE_GPT5_WORKFLOW_REASONING === 'true' ||
  import.meta.env.VITE_ENABLE_GPT5_WORKFLOW_REASONING === '1';

export const ROUTER_CONFIG = {
  maxRetries: 1,
  defaultTemperature: 0.7,
  defaultMaxTokens: 4096,
  defaultModel: 'gpt-4o',
  fallbackModel: 'gpt-4o',
  visionModel: 'gpt-4o',
} as const;
