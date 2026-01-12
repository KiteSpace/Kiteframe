/**
 * AI Telemetry - Structured logging for AI interactions
 * 
 * Provides minimal, dev-only console logging to:
 * - Validate AI workflows during testing
 * - Distinguish AI failures from UX/system issues
 * - Assess perceived AI reliability
 * 
 * NO external services - console only.
 */

export type AiInteractionLog = {
  surface: 'home' | 'project';
  phase: 'baseline' | 'edge_expand' | 'accept' | 'in_project' | 'test_flight';
  action: 'generate' | 'expand_edges' | 'apply' | 'replace' | 'create' | 'propose' | 'fix';
  success: boolean;
  reason?: 'parse_fail' | 'no_change' | 'blocked' | 'user_cancel' | 'over_construction' | 'scope_violation' | 'new_issues';
  nodeDelta?: number;
  edgeDelta?: number;
  aiStability?: AiStabilityMetrics;
};

/**
 * AI Stability Metrics (Part 6)
 * 
 * Tracks diagnostic health before and after AI proposals
 * to detect cascading issues and regressions.
 */
export type AiStabilityMetrics = {
  baselineIssueCount: number;
  postProposalIssueCount: number;
  newIssueCount: number;
  resolvedIssueCount: number;
  proposalRejected: boolean;
  rejectionReason?: 'over_construction' | 'scope_violation' | 'new_issues' | 'incomplete_schema';
};

export function logAiInteraction(event: AiInteractionLog): void {
  if (process.env.NODE_ENV !== 'development') return;
  console.info('[AI_TELEMETRY]', event);
}

/**
 * Log AI stability metrics specifically for gold-standard validation.
 */
export function logAiStability(metrics: AiStabilityMetrics): void {
  if (process.env.NODE_ENV !== 'development') return;
  console.info('[AI_STABILITY]', metrics);
}
