export const ROUTER_CONFIG = {
  maxRetries: 1,
  defaultTemperature: 0.7,
  defaultMaxTokens: 4096,
  defaultModel: 'claude-sonnet-4-5-20250929',
  fallbackModel: 'claude-haiku-4-5-20251001',
  visionModel: 'claude-sonnet-4-5-20250929',
} as const;
