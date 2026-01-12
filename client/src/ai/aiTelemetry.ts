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
  phase: 'baseline' | 'edge_expand' | 'accept' | 'in_project';
  action: 'generate' | 'expand_edges' | 'apply' | 'replace' | 'create';
  success: boolean;
  reason?: 'parse_fail' | 'no_change' | 'blocked' | 'user_cancel';
  nodeDelta?: number;
  edgeDelta?: number;
};

export function logAiInteraction(event: AiInteractionLog): void {
  if (process.env.NODE_ENV !== 'development') return;
  console.info('[AI_TELEMETRY]', event);
}
