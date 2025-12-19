/**
 * KiteAI Conversation State Machine
 * 
 * Manages the state transitions for KiteAI conversations:
 * - clarification (default): Asking targeted questions about missing dimensions
 * - escalation: Proposing concrete workflow directions after 2 vague replies
 * - execution-ready: Ready to generate workflow (score >= 3, confidence >= 0.75)
 */

import { ActionabilityResult } from './actionability';

export type KiteAIState = 'clarification' | 'escalation' | 'execution-ready';

export type KiteAIMode = 'base' | 'designer' | 'pm';

/**
 * ConversationSource - tracks all inputs (text, image, Figma) in a unified structure
 * This enables consistent actionability scoring across all entry modes.
 */
export type ConversationSourceType = 'text' | 'image' | 'figma-frame';

export interface VisionExtractedSignals {
  // Common signals
  screensDetected?: string[];
  flowsDetected?: boolean;
  decisionPoints?: string[];
  missingInfo?: string[];
  // Figma-specific signals
  screenType?: string;
  entryPoints?: string[];
  primaryCTA?: string;
  branching?: boolean;
  // General vision confidence
  overallDescription?: string;
}

export interface ConversationSource {
  type: ConversationSourceType;
  payload: any;
  confidence: number;
  extractedSignals?: VisionExtractedSignals;
  timestamp: number;
}

export interface ConversationContext {
  state: KiteAIState;
  mode: KiteAIMode;
  vagueReplyCount: number;
  lastActionability: ActionabilityResult | null;
  conversationHistory: ConversationMessage[];
  accumulatedContext: AccumulatedContext;
  sources: ConversationSource[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  actionability?: ActionabilityResult;
}

export interface AccumulatedContext {
  actor?: string;
  trigger?: string;
  goal?: string;
  scope?: string;
  flowSignal?: string;
}

export interface StateTransition {
  from: KiteAIState;
  to: KiteAIState;
  reason: string;
  actionability: ActionabilityResult;
}

const CONFIDENCE_THRESHOLDS = {
  silent: 0.4,         // 0.0-0.4: Do NOT speak (insufficient signal)
  clarify: 0.7,        // 0.4-0.7: Ask clarifying questions ONLY
  proposeAssumptions: 0.85, // 0.7-0.85: Propose assumptions + preview
  execute: 0.85,       // 0.85+: Generate workflow (still gated by confirmation)
} as const;

export type ConfidenceLevel = 'silent' | 'clarify' | 'proposeAssumptions' | 'execute';

const ACTIONABILITY_THRESHOLD = 3;
const VAGUE_REPLY_LIMIT = 2;

export function createInitialContext(mode: KiteAIMode = 'base'): ConversationContext {
  return {
    state: 'clarification',
    mode,
    vagueReplyCount: 0,
    lastActionability: null,
    conversationHistory: [],
    accumulatedContext: {},
    sources: [],
  };
}

/**
 * Add a source (text, image, or Figma) to the conversation context.
 * All sources feed into the same actionability pipeline.
 */
export function addSource(
  context: ConversationContext,
  source: Omit<ConversationSource, 'timestamp'>
): ConversationContext {
  return {
    ...context,
    sources: [
      ...context.sources,
      { ...source, timestamp: Date.now() },
    ],
  };
}

/**
 * Get aggregated signals from all vision sources (images and Figma frames).
 * Used to enhance actionability scoring.
 */
export function getAggregatedVisionSignals(context: ConversationContext): VisionExtractedSignals {
  const visionSources = context.sources.filter(
    s => s.type === 'image' || s.type === 'figma-frame'
  );
  
  const aggregated: VisionExtractedSignals = {
    screensDetected: [],
    decisionPoints: [],
    missingInfo: [],
    entryPoints: [],
  };
  
  for (const source of visionSources) {
    if (source.extractedSignals) {
      const signals = source.extractedSignals;
      if (signals.screensDetected) {
        aggregated.screensDetected!.push(...signals.screensDetected);
      }
      if (signals.decisionPoints) {
        aggregated.decisionPoints!.push(...signals.decisionPoints);
      }
      if (signals.missingInfo) {
        aggregated.missingInfo!.push(...signals.missingInfo);
      }
      if (signals.entryPoints) {
        aggregated.entryPoints!.push(...signals.entryPoints);
      }
      if (signals.flowsDetected) {
        aggregated.flowsDetected = true;
      }
      if (signals.branching) {
        aggregated.branching = true;
      }
      if (signals.primaryCTA) {
        aggregated.primaryCTA = signals.primaryCTA;
      }
      if (signals.screenType) {
        aggregated.screenType = signals.screenType;
      }
      if (signals.overallDescription) {
        aggregated.overallDescription = signals.overallDescription;
      }
    }
  }
  
  return aggregated;
}

/**
 * Calculate a vision confidence boost based on extracted signals.
 * This is added to the text-based actionability score.
 */
export function getVisionConfidenceBoost(signals: VisionExtractedSignals): number {
  let boost = 0;
  
  // Screens detected indicate structure
  if (signals.screensDetected && signals.screensDetected.length > 0) {
    boost += 0.1;
  }
  
  // Flows detected indicate sequence
  if (signals.flowsDetected) {
    boost += 0.15;
  }
  
  // Decision points indicate branching logic
  if (signals.decisionPoints && signals.decisionPoints.length > 0) {
    boost += 0.1;
  }
  
  // Entry points clarify scope
  if (signals.entryPoints && signals.entryPoints.length > 0) {
    boost += 0.05;
  }
  
  // Primary CTA clarifies goal
  if (signals.primaryCTA) {
    boost += 0.05;
  }
  
  return Math.min(boost, 0.3); // Cap at 0.3 boost
}

export function isVagueReply(actionability: ActionabilityResult): boolean {
  return actionability.score < 2 || actionability.confidence < CONFIDENCE_THRESHOLDS.silent;
}

export function shouldEscalate(context: ConversationContext, actionability: ActionabilityResult): boolean {
  return (
    context.state === 'clarification' &&
    isVagueReply(actionability) &&
    context.vagueReplyCount >= VAGUE_REPLY_LIMIT - 1
  );
}

export function isExecutionReady(actionability: ActionabilityResult): boolean {
  return (
    actionability.score >= ACTIONABILITY_THRESHOLD &&
    actionability.confidence >= CONFIDENCE_THRESHOLDS.execute
  );
}

export function isLowConfidence(actionability: ActionabilityResult): boolean {
  return actionability.confidence < CONFIDENCE_THRESHOLDS.silent;
}

export function shouldProposeAssumptions(actionability: ActionabilityResult): boolean {
  return (
    actionability.confidence >= CONFIDENCE_THRESHOLDS.clarify &&
    actionability.confidence < CONFIDENCE_THRESHOLDS.proposeAssumptions
  );
}

export function needsFollowUp(actionability: ActionabilityResult): boolean {
  return (
    actionability.confidence >= CONFIDENCE_THRESHOLDS.silent &&
    actionability.confidence < CONFIDENCE_THRESHOLDS.clarify
  );
}

export function needsClarificationOnly(actionability: ActionabilityResult): boolean {
  return (
    actionability.confidence >= CONFIDENCE_THRESHOLDS.silent &&
    actionability.confidence < CONFIDENCE_THRESHOLDS.clarify
  );
}

export function computeNextState(
  context: ConversationContext,
  actionability: ActionabilityResult
): StateTransition {
  const currentState = context.state;

  // HARD GATE: If confidence < 0.4, stay in current state or escalate (never proceed to execution)
  if (isLowConfidence(actionability)) {
    console.log(`[KiteAI] LOW CONFIDENCE (${actionability.confidence}) - blocking progress`);
    
    // If already in escalation, stay there (only exit is execution-ready)
    if (currentState === 'escalation') {
      console.log(`[KiteAI] In escalation with low confidence - staying in escalation`);
      return {
        from: currentState,
        to: 'escalation',
        reason: `Staying in escalation - low confidence (${actionability.confidence}) but only exit is execution-ready`,
        actionability,
      };
    }
    
    // Check for escalation after 2 vague replies from clarification
    if (shouldEscalate(context, actionability)) {
      return {
        from: currentState,
        to: 'escalation',
        reason: `Escalation triggered - confidence too low (${actionability.confidence}) after ${VAGUE_REPLY_LIMIT} vague replies`,
        actionability,
      };
    }
    
    return {
      from: currentState,
      to: 'clarification',
      reason: `Confidence too low (${actionability.confidence} < ${CONFIDENCE_THRESHOLDS.silent}) - cannot proceed`,
      actionability,
    };
  }

  // Check for execution-ready (score >= 3 AND confidence >= 0.75)
  if (isExecutionReady(actionability)) {
    return {
      from: currentState,
      to: 'execution-ready',
      reason: `Actionability threshold met (score=${actionability.score}, confidence=${actionability.confidence})`,
      actionability,
    };
  }

  // Check for escalation (2 vague replies in clarification state)
  if (shouldEscalate(context, actionability)) {
    return {
      from: currentState,
      to: 'escalation',
      reason: `Escalation triggered after ${VAGUE_REPLY_LIMIT} vague replies`,
      actionability,
    };
  }

  // STRICT: If in escalation, ONLY exit to execution-ready (never back to clarification)
  // User must provide enough info to reach execution threshold
  if (currentState === 'escalation') {
    // Only way out of escalation is reaching execution-ready threshold
    console.log(`[KiteAI] In escalation - only exit is execution-ready (current: score=${actionability.score}, conf=${actionability.confidence})`);
    return {
      from: currentState,
      to: 'escalation',
      reason: `Staying in escalation until execution threshold (score>=3, confidence>=0.75)`,
      actionability,
    };
  }

  // Needs follow-up (0.4 <= confidence < 0.75) - stay in clarification
  if (needsFollowUp(actionability)) {
    console.log(`[KiteAI] FOLLOW-UP REQUIRED (conf=${actionability.confidence}) - staying in clarification`);
    return {
      from: currentState,
      to: 'clarification',
      reason: `Needs follow-up (confidence=${actionability.confidence} < 0.75)`,
      actionability,
    };
  }

  return {
    from: currentState,
    to: currentState === 'execution-ready' ? 'clarification' : currentState,
    reason: 'Continuing current state',
    actionability,
  };
}

export function applyTransition(
  context: ConversationContext,
  transition: StateTransition,
  userMessage: string
): ConversationContext {
  const newContext = { ...context };
  
  // Update state
  newContext.state = transition.to;
  newContext.lastActionability = transition.actionability;

  // Track vague replies
  if (isVagueReply(transition.actionability)) {
    newContext.vagueReplyCount = context.vagueReplyCount + 1;
  } else {
    newContext.vagueReplyCount = 0;
  }

  // Add to conversation history
  newContext.conversationHistory = [
    ...context.conversationHistory,
    {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
      actionability: transition.actionability,
    },
  ];

  // Log the transition
  logStateTransition(transition, newContext);

  return newContext;
}

export function logStateTransition(transition: StateTransition, context: ConversationContext): void {
  const { from, to, reason, actionability } = transition;
  
  if (from !== to) {
    console.log(
      `[KiteAI] state=${to} score=${actionability.score} confidence=${actionability.confidence} (was: ${from})`
    );
    if (to === 'escalation') {
      console.log('[KiteAI] escalation triggered');
    }
    if (to === 'execution-ready') {
      console.log('[KiteAI] execution-ready');
    }
  } else {
    console.log(
      `[KiteAI] state=${to} score=${actionability.score} confidence=${actionability.confidence}`
    );
  }
  
  console.log(`[KiteAI] reason: ${reason}`);
  console.log(`[KiteAI] vague replies: ${context.vagueReplyCount}`);
}

export function canShowStartProject(context: ConversationContext): boolean {
  return context.state === 'execution-ready';
}

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence < CONFIDENCE_THRESHOLDS.silent) return 'silent';
  if (confidence < CONFIDENCE_THRESHOLDS.clarify) return 'clarify';
  if (confidence < CONFIDENCE_THRESHOLDS.proposeAssumptions) return 'proposeAssumptions';
  return 'execute';
}
