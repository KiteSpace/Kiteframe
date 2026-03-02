export const ROUTER_CONFIG = {
  maxRetries: 1,
  defaultTemperature: 0.7,
  defaultMaxTokens: 4096,
  defaultModel: 'claude-3-5-sonnet-20241022',
  fallbackModel: 'claude-3-5-haiku-20241022',
  visionModel: 'claude-3-5-sonnet-20241022',
} as const;
