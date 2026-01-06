/**
 * Phase 6.5: Merge vs Branch Intent Detection
 * 
 * Lightweight intent classifier that determines whether the user wants to:
 * - MERGE: Modify the existing workflow in place (refine, fix, improve)
 * - BRANCH: Create a new workflow variant for comparison (alternative, version 2)
 * 
 * This prevents accidental workflow duplication and false "disconnected" insights.
 * 
 * V1 Constraints:
 * - No UI prompts in ambiguous cases
 * - Ambiguous defaults to MERGE (safer)
 * - Read-only in Test Flight, WhyInspector, import flows
 */

export type MergeBranchIntent = 'merge' | 'branch' | 'ambiguous';

export interface MergeBranchDetectorInput {
  userMessage: string;
  hasExistingWorkflow: boolean;
  previousUserMessages?: string[];
}

export interface MergeBranchDecision {
  intent: MergeBranchIntent;
  confidence: number;
  detectedSignals: string[];
  /** Resolved intent - ambiguous always resolves to 'merge' for safety */
  resolvedIntent: 'merge' | 'branch';
}

const MERGE_SIGNALS: Array<{ pattern: RegExp; signal: string; weight: number }> = [
  { pattern: /\b(tighten|tightening)\b/i, signal: 'tighten', weight: 0.9 },
  { pattern: /\b(simplif(y|ied|ying|ication))\b/i, signal: 'simplify', weight: 0.9 },
  { pattern: /\b(clean\s*up|cleanup)\b/i, signal: 'cleanup', weight: 0.9 },
  { pattern: /\b(fix(ed|ing|es)?)\b/i, signal: 'fix', weight: 0.85 },
  { pattern: /\b(correct(ed|ing|ion)?)\b/i, signal: 'correct', weight: 0.85 },
  { pattern: /\b(improv(e|ed|ing|ement))\b/i, signal: 'improve', weight: 0.8 },
  { pattern: /\b(refin(e|ed|ing|ement))\b/i, signal: 'refine', weight: 0.85 },
  { pattern: /\b(reduce|reducing)\s+(branching|complexity|steps)\b/i, signal: 'reduce-complexity', weight: 0.9 },
  { pattern: /\b(remov(e|ed|ing))\s+(dead\s*ends?|redundant)\b/i, signal: 'remove-dead-ends', weight: 0.9 },
  { pattern: /\b(add(ing)?)\s+(retry|error|failure)\s*(logic|handling)?\b/i, signal: 'add-retry-logic', weight: 0.85 },
  { pattern: /\b(handle|handling)\s+(failure|error|exception)s?\b/i, signal: 'handle-failures', weight: 0.85 },
  { pattern: /\b(make|making)\s+(it\s+)?optional\b/i, signal: 'make-optional', weight: 0.8 },
  { pattern: /\b(adjust(ing)?)\s+(this|the)\s+(workflow|flow|diagram)\b/i, signal: 'adjust-workflow', weight: 0.9 },
  { pattern: /\b(update|updating)\s+(this|the)?\s*(workflow|flow|node|step)?\b/i, signal: 'update', weight: 0.75 },
  { pattern: /\b(modify|modifying)\b/i, signal: 'modify', weight: 0.8 },
  { pattern: /\b(tweak|tweaking)\b/i, signal: 'tweak', weight: 0.85 },
  { pattern: /\b(edit|editing)\b/i, signal: 'edit', weight: 0.75 },
  { pattern: /\b(change|changing)\s+(this|the|that)\b/i, signal: 'change-this', weight: 0.8 },
  { pattern: /\b(optimize|optimizing|optimization)\b/i, signal: 'optimize', weight: 0.8 },
  { pattern: /\b(streamline|streamlining)\b/i, signal: 'streamline', weight: 0.85 },
  { pattern: /\b(consolidate|consolidating)\b/i, signal: 'consolidate', weight: 0.85 },
  { pattern: /\b(merge|merging)\s+(these|the|those)?\s*(steps|nodes)?\b/i, signal: 'merge-steps', weight: 0.9 },
];

const BRANCH_SIGNALS: Array<{ pattern: RegExp; signal: string; weight: number }> = [
  { pattern: /\b(alternative|alternate)\b/i, signal: 'alternative', weight: 0.95 },
  { pattern: /\b(another)\s+(approach|way|method|option)\b/i, signal: 'another-approach', weight: 0.9 },
  { pattern: /\b(different)\s+(version|approach|way|flow)\b/i, signal: 'different-version', weight: 0.9 },
  { pattern: /\b(compare|comparing|comparison)\b/i, signal: 'compare', weight: 0.85 },
  { pattern: /\b(what\s+if)\s+(instead|we|I)\b/i, signal: 'what-if-instead', weight: 0.9 },
  { pattern: /\b(version)\s*[2-9]\b/i, signal: 'version-2', weight: 0.95 },
  { pattern: /\b(v[2-9])\b/i, signal: 'v2', weight: 0.9 },
  { pattern: /\b(variant|variation)\b/i, signal: 'variant', weight: 0.9 },
  { pattern: /\b(explore)\s+(a\s+)?(new|different)\s+(flow|approach|way)\b/i, signal: 'explore-new', weight: 0.9 },
  { pattern: /\b(start)\s+(fresh|over|from\s+scratch)\b/i, signal: 'start-fresh', weight: 0.95 },
  { pattern: /\b(new)\s+(workflow|flow|diagram|approach)\b/i, signal: 'new-workflow', weight: 0.85 },
  { pattern: /\b(create)\s+(another|a\s+new|separate)\b/i, signal: 'create-another', weight: 0.9 },
  { pattern: /\b(fork|forking)\b/i, signal: 'fork', weight: 0.95 },
  { pattern: /\b(branch|branching)\s+(off|out)\b/i, signal: 'branch-off', weight: 0.95 },
  { pattern: /\b(side\s*by\s*side)\b/i, signal: 'side-by-side', weight: 0.85 },
  { pattern: /\b(parallel)\s+(version|approach)\b/i, signal: 'parallel-version', weight: 0.9 },
];

function matchPatterns(
  message: string,
  patterns: Array<{ pattern: RegExp; signal: string; weight: number }>
): { signals: string[]; totalWeight: number; maxWeight: number } {
  const signals: string[] = [];
  let totalWeight = 0;
  let maxWeight = 0;

  for (const { pattern, signal, weight } of patterns) {
    if (pattern.test(message)) {
      signals.push(signal);
      totalWeight += weight;
      maxWeight = Math.max(maxWeight, weight);
    }
  }

  return { signals, totalWeight, maxWeight };
}

/**
 * Detect whether the user intends to MERGE (modify existing) or BRANCH (create new).
 * 
 * This is a pure function with no side effects.
 * 
 * @param input - User message and context
 * @returns Decision with intent, confidence, and detected signals
 */
export function detectMergeBranchIntent(input: MergeBranchDetectorInput): MergeBranchDecision {
  const { userMessage, hasExistingWorkflow, previousUserMessages = [] } = input;

  if (!hasExistingWorkflow) {
    return {
      intent: 'branch',
      confidence: 1.0,
      detectedSignals: ['no-existing-workflow'],
      resolvedIntent: 'branch',
    };
  }

  const normalizedMessage = userMessage.toLowerCase().trim();
  
  const mergeMatch = matchPatterns(normalizedMessage, MERGE_SIGNALS);
  const branchMatch = matchPatterns(normalizedMessage, BRANCH_SIGNALS);

  const mergeScore = mergeMatch.totalWeight;
  const branchScore = branchMatch.totalWeight;

  const allSignals = [
    ...mergeMatch.signals.map(s => `merge:${s}`),
    ...branchMatch.signals.map(s => `branch:${s}`),
  ];

  if (branchScore > 0 && branchScore > mergeScore) {
    return {
      intent: 'branch',
      confidence: Math.min(branchMatch.maxWeight, 0.95),
      detectedSignals: allSignals,
      resolvedIntent: 'branch',
    };
  }

  if (mergeScore > 0 && mergeScore >= branchScore) {
    return {
      intent: 'merge',
      confidence: Math.min(mergeMatch.maxWeight, 0.95),
      detectedSignals: allSignals,
      resolvedIntent: 'merge',
    };
  }

  if (previousUserMessages.length > 0) {
    const recentContext = previousUserMessages.slice(-3).join(' ');
    const contextMergeMatch = matchPatterns(recentContext, MERGE_SIGNALS);
    const contextBranchMatch = matchPatterns(recentContext, BRANCH_SIGNALS);
    
    if (contextMergeMatch.totalWeight > contextBranchMatch.totalWeight) {
      return {
        intent: 'merge',
        confidence: 0.6,
        detectedSignals: [...allSignals, 'context:merge-history'],
        resolvedIntent: 'merge',
      };
    }
    if (contextBranchMatch.totalWeight > contextMergeMatch.totalWeight) {
      return {
        intent: 'branch',
        confidence: 0.6,
        detectedSignals: [...allSignals, 'context:branch-history'],
        resolvedIntent: 'branch',
      };
    }
  }

  return {
    intent: 'ambiguous',
    confidence: 0.5,
    detectedSignals: allSignals.length > 0 ? allSignals : ['no-clear-signals'],
    resolvedIntent: 'merge', // Safety: ambiguous always resolves to merge
  };
}

/**
 * Resolve the final intent, defaulting ambiguous to MERGE.
 * 
 * @param decision - The raw decision from detectMergeBranchIntent
 * @returns Resolved intent ('merge' or 'branch', never 'ambiguous')
 */
export function resolveIntent(decision: MergeBranchDecision): 'merge' | 'branch' {
  if (decision.intent === 'ambiguous') {
    return 'merge';
  }
  return decision.intent;
}

/**
 * Check if the decision was ambiguous (for audit/debugging).
 */
export function isAmbiguous(decision: MergeBranchDecision): boolean {
  return decision.intent === 'ambiguous';
}
