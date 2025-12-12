export interface ConfidenceContext {
  nodeCount: number;
  edgeCount: number;
  hasSemanticData: boolean;
  userPromptLength: number;
}

export function computeConfidence(context: ConfidenceContext): number {
  let score = 0;

  if (context.hasSemanticData) score += 0.4;
  if (context.nodeCount >= 3) score += 0.2;
  if (context.edgeCount >= 2) score += 0.2;
  if (context.userPromptLength > 20) score += 0.2;

  return Math.min(score, 1);
}

export const CONFIDENCE_THRESHOLD = 0.4;

export function isConfidenceInsufficient(confidence: number): boolean {
  return confidence < CONFIDENCE_THRESHOLD;
}
