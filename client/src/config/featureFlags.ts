/**
 * Feature Flags Configuration
 * 
 * Controls feature rollout and gating.
 * Default values can be overridden by environment variables.
 */

export const featureFlags = {
  /**
   * PROPOSE_SOLUTION_PREVIEW
   * 
   * Phase 1: Enables the "Propose Solution" button in the Insights tab.
   * When enabled, users can generate a read-only workflow preview.
   * 
   * Default: false (off)
   */
  PROPOSE_SOLUTION_PREVIEW: import.meta.env.VITE_PROPOSE_SOLUTION_PREVIEW === 'true',
  
  /**
   * SEMANTIC_TERMINAL_INFERENCE
   * 
   * Phase 6.8: Enables semantic terminal inference in Test Flight diagnostics.
   * When enabled, dead-end warnings are suppressed for nodes that appear to be
   * semantically terminal (e.g., "Notify user", "Setup complete") even if they
   * are not explicitly typed as output/end nodes.
   * 
   * Default: true (on for Beta, off for Production)
   */
  SEMANTIC_TERMINAL_INFERENCE: import.meta.env.VITE_ENABLE_SEMANTIC_TERMINAL_INFERENCE !== 'false',
} as const;

export type FeatureFlag = keyof typeof featureFlags;

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag];
}
