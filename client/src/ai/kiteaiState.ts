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
  /**
   * Set to true when user has confirmed execution (e.g., "yes", "go ahead").
   * This is a one-way latch - once true, it never reverts.
   */
  hasUserConfirmedExecution: boolean;
  /**
   * Set to true when workflow generation has been triggered.
   * This is a one-way latch - prevents duplicate generation.
   */
  executionTriggered: boolean;
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

/**
 * HARD CAP: Maximum clarification turns before forcing execution-ready.
 * After this many turns, we generate with assumptions rather than ask more questions.
 */
const MAX_CLARIFICATION_TURNS = 2;

/**
 * Fast path trigger types:
 * - 'button': User clicked a Generate button (always fast-path)
 * - 'phrase': User said a confirmation phrase (e.g., "yes", "go ahead")
 * - 'experiment': Experiment node Generate (always fast-path)
 * - 'image': Image/Figma upload + Generate (always fast-path)
 */
export type FastPathTrigger = 'button' | 'phrase' | 'experiment' | 'image';

export function createInitialContext(mode: KiteAIMode = 'base'): ConversationContext {
  return {
    state: 'clarification',
    mode,
    vagueReplyCount: 0,
    lastActionability: null,
    conversationHistory: [],
    accumulatedContext: {},
    sources: [],
    hasUserConfirmedExecution: false,
    executionTriggered: false,
  };
}

/**
 * CONFIRMATION PHRASES - Case-insensitive detection for execution confirmation.
 * When user says any of these in execution-ready state, we force immediate workflow generation.
 */
const CONFIRMATION_PHRASES = [
  'yes',
  'yep', 
  'yeah',
  'ok',
  'okay',
  'looks good',
  'sounds good',
  'go ahead',
  'do it',
  'create the workflow',
  'generate it',
  'that works',
  'confirm',
  'create it',
  'build it',
  'let\'s do it',
  'let\'s go',
  'proceed',
  'sure',
  'perfect',
  'great',
  'good',
  'start',
  'begin',
];

/**
 * NEGATIVE QUALIFIERS - These indicate the user wants to continue refining, not confirm.
 * If any of these appear in the message, it's NOT a confirmation.
 */
const NEGATIVE_QUALIFIERS = [
  'but', 'however', 'although', 'except', 'unless', 'instead',
  'wait', 'hold on', 'actually', 'hmm', 'one more', 'also add',
  'can you', 'could you', 'would you', 'please add', 'add a', 'add one',
  'change', 'modify', 'update', 'edit', 'remove', 'delete', 'with',
  'first', 'before', 'what about', 'how about', 'should we', 'maybe',
  'i think', 'let me', 'let\'s also', 'don\'t forget', 'make sure',
  'include', 'excluding', 'more', 'less', 'another', 'different',
];

/**
 * STANDALONE ACK WORDS - These can be ignored when checking if message is ONLY a confirmation.
 * E.g., "yes please" or "okay thanks" should still be confirmations.
 */
const ACK_SUFFIXES = ['please', 'thanks', 'thank you', 'now', 'let\'s go', '!', '.', ','];

/**
 * Detect if user message is a confirmation phrase.
 * Used to force EXECUTE_WORKFLOW intent when in execution-ready state.
 * 
 * STRICT RULES:
 * 1. Must be a short message (under 100 chars)
 * 2. Must NOT contain any negative qualifiers
 * 3. Must match or start with a confirmation phrase
 * 4. If there's text after the confirmation phrase, it must be trivial (ack suffix or punctuation)
 */
export function isConfirmationPhrase(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  
  // Rule 1: Message too long to be a simple confirmation
  if (normalized.length > 100) {
    return false;
  }
  
  // Rule 2: Check for negative qualifiers - if any found, it's NOT a confirmation
  const hasNegativeQualifier = NEGATIVE_QUALIFIERS.some(qualifier => 
    normalized.includes(qualifier)
  );
  if (hasNegativeQualifier) {
    console.log('[KiteAI] Confirmation rejected - contains qualifier:', normalized);
    return false;
  }
  
  // Rule 3: Strip common ack suffixes to get the core message
  let core = normalized;
  for (const suffix of ACK_SUFFIXES) {
    if (core.endsWith(suffix)) {
      core = core.slice(0, -suffix.length).trim();
    }
  }
  // Strip leading/trailing punctuation
  core = core.replace(/^[.,!?\s]+|[.,!?\s]+$/g, '');
  
  // Rule 4: Core message should match a confirmation phrase exactly
  // OR start with a confirmation phrase and be followed only by trivial content
  const isMatch = CONFIRMATION_PHRASES.some(phrase => {
    // Exact match of core
    if (core === phrase) return true;
    
    // Core starts with phrase and remaining is trivial (1-2 words max)
    if (core.startsWith(phrase)) {
      const remainder = core.slice(phrase.length).trim();
      // Allow empty remainder or very short ack words
      if (remainder === '' || remainder.length <= 10) {
        // Check remainder doesn't contain substantive content
        const remainderWords = remainder.split(/\s+/).filter(w => w.length > 0);
        if (remainderWords.length <= 2) {
          return true;
        }
      }
    }
    
    return false;
  });
  
  if (isMatch) {
    console.log('[KiteAI] Confirmation phrase detected:', normalized);
  }
  
  return isMatch;
}

/**
 * Check if we should force execution based on confirmation phrase in execution-ready state.
 */
export function shouldForceExecution(
  context: ConversationContext, 
  userMessage: string
): boolean {
  // Already triggered - don't trigger again
  if (context.executionTriggered) {
    return false;
  }
  
  // Must be in execution-ready state
  if (context.state !== 'execution-ready') {
    return false;
  }
  
  // Check if message is a confirmation phrase
  return isConfirmationPhrase(userMessage);
}

/**
 * Mark execution as triggered. This is a one-way latch.
 */
export function markExecutionTriggered(context: ConversationContext): ConversationContext {
  if (context.executionTriggered) {
    console.log('[KiteAI] Execution already triggered, ignoring duplicate');
    return context;
  }
  
  console.log('[KiteAI] EXECUTION TRIGGERED - workflow generation will start immediately');
  return {
    ...context,
    hasUserConfirmedExecution: true,
    executionTriggered: true,
  };
}

/**
 * CENTRALIZED FAST PATH GATE
 * 
 * This is the SINGLE authoritative function for determining if we should bypass clarification.
 * UI actions and explicit user commands override confidence scores.
 * 
 * Returns true if workflow should be generated immediately without further questions.
 */
export function shouldExecuteFastPath(
  context: ConversationContext,
  trigger: FastPathTrigger,
  userMessage?: string
): boolean {
  // Already triggered - fast path is already in effect
  if (context.executionTriggered) {
    console.log('[KiteAI] Fast path: execution already triggered');
    return true;
  }
  
  // Button clicks require at least some context OR execution-ready state
  if (trigger === 'button') {
    const hasConversation = context.conversationHistory.length > 0;
    const isExecutionReady = context.state === 'execution-ready';
    
    if (hasConversation || isExecutionReady) {
      console.log('[KiteAI] Fast path: Generate button with context - bypassing clarification');
      return true;
    }
    console.log('[KiteAI] Fast path: Generate button - no context yet, allowing first turn');
    return false;
  }
  
  if (trigger === 'experiment') {
    console.log('[KiteAI] Fast path: Experiment node - bypassing clarification');
    return true;
  }
  
  if (trigger === 'image') {
    // Image/Figma uploads: only fast-path after max turns OR if already execution-ready
    const hasVisionSources = context.sources.some(
      s => s.type === 'image' || s.type === 'figma-frame'
    );
    const maxTurnsReached = hasReachedMaxClarificationTurns(context);
    const isExecutionReady = context.state === 'execution-ready';
    
    if (hasVisionSources && (maxTurnsReached || isExecutionReady)) {
      console.log('[KiteAI] Fast path: Image/Figma with max turns or execution-ready - bypassing clarification');
      return true;
    }
    console.log('[KiteAI] Fast path: Image/Figma - not ready yet (turns:', getClarificationTurnCount(context), '/', MAX_CLARIFICATION_TURNS, ')');
    return false;
  }
  
  // Phrase trigger requires message check
  if (trigger === 'phrase' && userMessage && isConfirmationPhrase(userMessage)) {
    console.log('[KiteAI] Fast path: Confirmation phrase detected:', userMessage);
    return true;
  }
  
  // MAX_CLARIFICATION_TURNS cap: After 2 turns, force execution
  const turnCount = context.conversationHistory.filter(m => m.role === 'user').length;
  if (turnCount >= MAX_CLARIFICATION_TURNS && context.state !== 'execution-ready') {
    console.log(`[KiteAI] Fast path: Max clarification turns (${MAX_CLARIFICATION_TURNS}) reached - forcing execution`);
    return true;
  }
  
  return false;
}

/**
 * Get the current clarification turn count.
 */
export function getClarificationTurnCount(context: ConversationContext): number {
  return context.conversationHistory.filter(m => m.role === 'user').length;
}

/**
 * Check if max clarification turns have been reached.
 */
export function hasReachedMaxClarificationTurns(context: ConversationContext): boolean {
  return getClarificationTurnCount(context) >= MAX_CLARIFICATION_TURNS;
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

/**
 * Update vision signals for a specific source type.
 * Used to enrich sources with AI-extracted signals after analysis.
 */
export function updateSourceSignals(
  context: ConversationContext,
  sourceType: ConversationSourceType,
  signals: VisionExtractedSignals
): ConversationContext {
  const updatedSources = context.sources.map(source => {
    if (source.type === sourceType && !source.extractedSignals) {
      return {
        ...source,
        extractedSignals: signals,
        confidence: Math.min(source.confidence + 0.2, 1), // Boost confidence after analysis
      };
    }
    return source;
  });
  
  return {
    ...context,
    sources: updatedSources,
  };
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
  const turnCount = getClarificationTurnCount(context);

  // HARD GATE 1: Once executionTriggered is true, NEVER go back to clarification
  if (context.executionTriggered) {
    console.log('[KiteAI] Execution triggered - blocking any backward transition');
    return {
      from: currentState,
      to: 'execution-ready',
      reason: 'Execution triggered - state locked at execution-ready',
      actionability,
    };
  }

  // HARD GATE 2: After MAX_CLARIFICATION_TURNS, force execution-ready
  if (turnCount >= MAX_CLARIFICATION_TURNS && currentState !== 'execution-ready') {
    console.log(`[KiteAI] MAX_CLARIFICATION_TURNS (${MAX_CLARIFICATION_TURNS}) reached - forcing execution-ready`);
    return {
      from: currentState,
      to: 'execution-ready',
      reason: `Max clarification turns (${MAX_CLARIFICATION_TURNS}) reached - generating with assumptions`,
      actionability,
    };
  }

  // HARD GATE 3: If confidence < 0.4, stay in current state or escalate (never proceed to execution)
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
