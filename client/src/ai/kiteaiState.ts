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

export interface ConversationContext {
  state: KiteAIState;
  mode: KiteAIMode;
  vagueReplyCount: number;
  lastActionability: ActionabilityResult | null;
  conversationHistory: ConversationMessage[];
  accumulatedContext: AccumulatedContext;
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
  stop: 0.4,
  followUp: 0.7,
  execute: 0.75,
} as const;

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
  };
}

export function isVagueReply(actionability: ActionabilityResult): boolean {
  return actionability.score < 2 || actionability.confidence < CONFIDENCE_THRESHOLDS.stop;
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
  return actionability.confidence < CONFIDENCE_THRESHOLDS.stop;
}

export function needsFollowUp(actionability: ActionabilityResult): boolean {
  return (
    actionability.confidence >= CONFIDENCE_THRESHOLDS.stop &&
    actionability.confidence < CONFIDENCE_THRESHOLDS.execute
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
      reason: `Confidence too low (${actionability.confidence} < ${CONFIDENCE_THRESHOLDS.stop}) - cannot proceed`,
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

export function getConfidenceLevel(confidence: number): 'stop' | 'followUp' | 'execute' {
  if (confidence < CONFIDENCE_THRESHOLDS.stop) return 'stop';
  if (confidence < CONFIDENCE_THRESHOLDS.execute) return 'followUp';
  return 'execute';
}
