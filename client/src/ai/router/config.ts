/**
 * GPT-5 Workflow Reasoning Feature Flag
 * 
 * Controls whether GPT-5.1 is used for workflow_reasoning, workflow_experiments,
 * and prd_generation tasks. When OFF, fallback model (GPT-4o) is used.
 * 
 * Environment variable: VITE_ENABLE_GPT5_WORKFLOW_REASONING
 * Values: "true" or "1" to enable, any other value to disable
 * 
 * For Beta rollout, set VITE_ENABLE_GPT5_WORKFLOW_REASONING=true
 */
export const ENABLE_GPT5_WORKFLOW_REASONING = 
  import.meta.env.VITE_ENABLE_GPT5_WORKFLOW_REASONING === 'true' ||
  import.meta.env.VITE_ENABLE_GPT5_WORKFLOW_REASONING === '1';

export const ROUTER_CONFIG = {
  maxRetries: 1,
  defaultTemperature: 0.7,
  defaultMaxTokens: 4096,
  gpt5Model: 'gpt-5.1',
  fallbackModel: 'gpt-4o',
  visionModel: 'gpt-4o',
} as const;
