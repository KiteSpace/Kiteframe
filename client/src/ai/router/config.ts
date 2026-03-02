export const ROUTER_CONFIG = {
  maxRetries: 1,
  defaultTemperature: 0.7,
  defaultMaxTokens: 4096,
  defaultModel: 'claude-sonnet-4-5',
  fallbackModel: 'claude-haiku-3-5',
  visionModel: 'claude-sonnet-4-5',
} as const;
