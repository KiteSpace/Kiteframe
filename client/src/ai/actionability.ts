/**
 * KiteAI Actionability Scoring System
 * 
 * Determines if user input meets the actionability threshold for workflow generation.
 * A prompt is actionable ONLY if it satisfies AT LEAST 3 of the 5 dimensions.
 * 
 * This system now supports unified scoring across text, image, and Figma inputs
 * by incorporating vision-extracted signals into the overall confidence score.
 */

import { VisionExtractedSignals } from './kiteaiState';

export type ActionabilityDimensions = {
  actor: boolean;
  trigger: boolean;
  goal: boolean;
  scope: boolean;
  flowSignal: boolean;
};

export type ActionabilityResult = {
  score: number;
  dimensions: ActionabilityDimensions;
  missing: (keyof ActionabilityDimensions)[];
  present: (keyof ActionabilityDimensions)[];
  confidence: number;
  isActionable: boolean;
};

const ACTOR_PATTERNS = [
  /\b(user|admin|customer|client|manager|developer|employee|team|staff|member|visitor|guest|owner|operator|agent|support|analyst)\b/i,
  /\b(i want|we need|they should|someone|anyone|everybody|person|people)\b/i,
  /\b(as a|the \w+ will|when the \w+ does)\b/i,
];

const TRIGGER_PATTERNS = [
  /\b(when|after|before|once|upon|if|trigger|start|begin|initiate|on)\b/i,
  /\b(clicks?|submits?|enters?|visits?|arrives?|receives?|completes?|finishes?)\b/i,
  /\b(every|daily|weekly|monthly|hourly|scheduled|cron|periodic)\b/i,
  /\b(on \w+ event|when \w+ happens|after \w+ is done)\b/i,
];

const GOAL_PATTERNS = [
  /\b(to|so that|in order to|for|goal|objective|purpose|outcome|result|achieve|accomplish)\b/i,
  /\b(should|must|needs? to|wants? to|will|can|able to)\b/i,
  /\b(create|generate|build|make|produce|deliver|provide|enable|allow)\b/i,
  /\b(success|complete|finish|done|ready|approved|validated|verified)\b/i,
];

const SCOPE_PATTERNS = [
  /\b(only|just|limited to|excluding|except|without|not including|specifically)\b/i,
  /\b(within|inside|outside|between|from \w+ to \w+)\b/i,
  /\b(includes?|excludes?|contains?|covers?|handles?)\b/i,
  /\b(minimum|maximum|at least|at most|up to|no more than)\b/i,
  /\b(first|last|initial|final|primary|secondary)\b/i,
];

const FLOW_PATTERNS = [
  /\b(then|next|after that|followed by|leads to|goes to|moves to|transitions to)\b/i,
  /\b(step \d+|phase \d+|stage \d+|first|second|third|finally|lastly)\b/i,
  /\b(if.+then|else|otherwise|in case|depending on|based on)\b/i,
  /\b(loop|repeat|iterate|cycle|until|while|for each)\b/i,
  /\b(branch|split|merge|parallel|concurrent|sequential)\b/i,
  /\b(workflow|process|flow|pipeline|sequence|chain)\b/i,
  /→|->|=>|>>|-->/,
];

function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text));
}

function countPatternMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter(pattern => pattern.test(text)).length;
}

export function computeActionability(input: string): ActionabilityResult {
  const text = input.trim().toLowerCase();
  
  if (!text || text.length < 5) {
    return {
      score: 0,
      dimensions: { actor: false, trigger: false, goal: false, scope: false, flowSignal: false },
      missing: ['actor', 'trigger', 'goal', 'scope', 'flowSignal'],
      present: [],
      confidence: 0,
      isActionable: false,
    };
  }

  const dimensions: ActionabilityDimensions = {
    actor: matchesAnyPattern(text, ACTOR_PATTERNS),
    trigger: matchesAnyPattern(text, TRIGGER_PATTERNS),
    goal: matchesAnyPattern(text, GOAL_PATTERNS),
    scope: matchesAnyPattern(text, SCOPE_PATTERNS),
    flowSignal: matchesAnyPattern(text, FLOW_PATTERNS),
  };

  const present = (Object.keys(dimensions) as (keyof ActionabilityDimensions)[])
    .filter(key => dimensions[key]);
  const missing = (Object.keys(dimensions) as (keyof ActionabilityDimensions)[])
    .filter(key => !dimensions[key]);
  
  const score = present.length;

  // Calculate confidence based on pattern match strength
  let patternStrength = 0;
  patternStrength += countPatternMatches(text, ACTOR_PATTERNS) * 0.15;
  patternStrength += countPatternMatches(text, TRIGGER_PATTERNS) * 0.15;
  patternStrength += countPatternMatches(text, GOAL_PATTERNS) * 0.2;
  patternStrength += countPatternMatches(text, SCOPE_PATTERNS) * 0.15;
  patternStrength += countPatternMatches(text, FLOW_PATTERNS) * 0.2;

  // Length bonus (longer prompts tend to be more specific)
  const lengthBonus = Math.min(text.length / 200, 0.15);
  
  // Base confidence from score
  const baseConfidence = score / 5;
  
  // Combined confidence
  const confidence = Math.min(baseConfidence * 0.6 + patternStrength * 0.3 + lengthBonus, 1);

  const isActionable = score >= 3 && confidence >= 0.75;

  return {
    score,
    dimensions,
    missing,
    present,
    confidence: Math.round(confidence * 100) / 100,
    isActionable,
  };
}

export function getDimensionDescription(dimension: keyof ActionabilityDimensions): string {
  const descriptions: Record<keyof ActionabilityDimensions, string> = {
    actor: 'Who the user or primary actor is',
    trigger: 'When or why the workflow starts',
    goal: 'What success looks like',
    scope: 'What is in or out of scope',
    flowSignal: 'Steps, states, or sequence of actions',
  };
  return descriptions[dimension];
}

export function getMissingDimensionQuestions(missing: (keyof ActionabilityDimensions)[]): string[] {
  const questions: Record<keyof ActionabilityDimensions, string> = {
    actor: 'Who will be using this workflow? (e.g., customers, admins, team members)',
    trigger: 'What triggers this workflow to start? (e.g., user action, scheduled time, event)',
    goal: 'What should happen when the workflow completes successfully?',
    scope: 'What should be included or excluded from this workflow?',
    flowSignal: 'Can you describe the main steps or stages in this process?',
  };
  return missing.map(dim => questions[dim]);
}

/**
 * Compute actionability with vision signals enhancement.
 * Vision signals from images/Figma can boost confidence and satisfy dimensions.
 */
export function computeActionabilityWithVision(
  input: string,
  visionSignals?: VisionExtractedSignals
): ActionabilityResult {
  // Start with base text actionability
  const baseResult = computeActionability(input);
  
  if (!visionSignals) {
    return baseResult;
  }
  
  // Clone dimensions for modification
  const dimensions = { ...baseResult.dimensions };
  
  // Vision signals can satisfy dimensions
  // Flows detected satisfies flowSignal
  if (visionSignals.flowsDetected || visionSignals.branching) {
    dimensions.flowSignal = true;
  }
  
  // Screens detected can indicate scope
  if (visionSignals.screensDetected && visionSignals.screensDetected.length > 0) {
    dimensions.scope = true;
  }
  
  // Decision points indicate flow
  if (visionSignals.decisionPoints && visionSignals.decisionPoints.length > 0) {
    dimensions.flowSignal = true;
  }
  
  // Entry points indicate trigger
  if (visionSignals.entryPoints && visionSignals.entryPoints.length > 0) {
    dimensions.trigger = true;
  }
  
  // Primary CTA indicates goal
  if (visionSignals.primaryCTA) {
    dimensions.goal = true;
  }
  
  // Recalculate present/missing based on enhanced dimensions
  const present = (Object.keys(dimensions) as (keyof ActionabilityDimensions)[])
    .filter(key => dimensions[key]);
  const missing = (Object.keys(dimensions) as (keyof ActionabilityDimensions)[])
    .filter(key => !dimensions[key]);
  
  const score = present.length;
  
  // Calculate vision confidence boost
  let visionBoost = 0;
  
  if (visionSignals.screensDetected && visionSignals.screensDetected.length > 0) {
    visionBoost += 0.1;
  }
  if (visionSignals.flowsDetected) {
    visionBoost += 0.15;
  }
  if (visionSignals.decisionPoints && visionSignals.decisionPoints.length > 0) {
    visionBoost += 0.1;
  }
  if (visionSignals.entryPoints && visionSignals.entryPoints.length > 0) {
    visionBoost += 0.05;
  }
  if (visionSignals.primaryCTA) {
    visionBoost += 0.05;
  }
  
  // Cap vision boost
  visionBoost = Math.min(visionBoost, 0.3);
  
  // Enhanced confidence with vision
  const confidence = Math.min(baseResult.confidence + visionBoost, 1);
  const isActionable = score >= 3 && confidence >= 0.75;
  
  console.log('[Actionability] Enhanced with vision:', {
    baseConfidence: baseResult.confidence,
    visionBoost,
    finalConfidence: confidence,
    score,
    visionSignals,
  });
  
  return {
    score,
    dimensions,
    missing,
    present,
    confidence: Math.round(confidence * 100) / 100,
    isActionable,
  };
}

/**
 * Get clarification questions that are specific to missing vision signals.
 * These help guide the user when image/Figma analysis is incomplete.
 */
export function getVisionMissingQuestions(signals: VisionExtractedSignals): string[] {
  const questions: string[] = [];
  
  if (signals.missingInfo && signals.missingInfo.length > 0) {
    // Use the AI-detected missing info
    questions.push(...signals.missingInfo.map(info => 
      `I noticed this might be missing: ${info}. Can you clarify?`
    ));
  }
  
  if (!signals.flowsDetected && !signals.branching) {
    questions.push('Can you describe the main steps or flow for this process?');
  }
  
  if (!signals.primaryCTA) {
    questions.push('What is the main action users should take?');
  }
  
  return questions;
}
