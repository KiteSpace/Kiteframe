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
} as const;

export type FeatureFlag = keyof typeof featureFlags;

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag];
}
