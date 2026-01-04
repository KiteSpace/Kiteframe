export const ENABLE_GPT5_WORKFLOW_REASONING = false;

export const ROUTER_CONFIG = {
  maxRetries: 1,
  defaultTemperature: 0.7,
  defaultMaxTokens: 4096,
  gpt5Model: 'gpt-5.1',
  fallbackModel: 'gpt-4o',
  visionModel: 'gpt-4o',
} as const;
