/**
 * useKiteAIConversation Hook
 * 
 * Manages KiteAI conversation state machine, actionability scoring,
 * and UI gating for workflow generation.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  computeActionability,
  computeActionabilityWithVision,
  ActionabilityResult,
  getMissingDimensionQuestions,
  getVisionMissingQuestions,
} from '@/ai/actionability';
import {
  KiteAIState,
  KiteAIMode,
  ConversationContext,
  ConversationSource,
  ConversationSourceType,
  VisionExtractedSignals,
  createInitialContext,
  computeNextState,
  applyTransition,
  canShowStartProject,
  getConfidenceLevel,
  addSource,
  getAggregatedVisionSignals,
  updateSourceSignals,
  shouldForceExecution,
  markExecutionTriggered,
} from '@/ai/kiteaiState';
import {
  getSystemPrompt,
  buildClarificationPrompt,
  buildEscalationPrompt,
  buildExecutionConfirmationPrompt,
} from '@/ai/kiteaiPrompts';

export interface KiteAIConversationState {
  context: ConversationContext;
  canStartProject: boolean;
  currentScore: number;
  currentConfidence: number;
  missingDimensions: string[];
  suggestedQuestions: string[];
  systemPrompt: string;
  stateLabel: string;
}

export interface UseKiteAIConversationResult {
  state: KiteAIConversationState;
  processUserInput: (input: string) => ProcessInputResult;
  setMode: (mode: KiteAIMode) => void;
  reset: () => void;
  addAssistantMessage: (content: string) => void;
  getAccumulatedSummary: () => string;
  /**
   * Add a source (text, image, or Figma frame) to the conversation context.
   * This enables unified actionability scoring across all input types.
   */
  addConversationSource: (
    type: ConversationSourceType,
    payload: any,
    confidence: number,
    extractedSignals?: VisionExtractedSignals
  ) => void;
  /**
   * Get all sources currently in the conversation.
   */
  getSources: () => ConversationSource[];
  /**
   * Get aggregated vision signals from all image/Figma sources.
   */
  getVisionSignals: () => VisionExtractedSignals;
  /**
   * Update vision signals for sources of a specific type.
   * Used to enrich sources with AI-extracted signals after analysis.
   */
  updateVisionSignals: (sourceType: ConversationSourceType, signals: VisionExtractedSignals) => void;
  /**
   * Check if user's message should trigger immediate workflow execution.
   * Returns true if in execution-ready state and user sent a confirmation phrase.
   */
  checkForceExecution: (message: string) => boolean;
  /**
   * Mark execution as triggered. Call this immediately before generating workflow.
   * This is a one-way latch that prevents duplicate generation.
   */
  triggerExecution: () => void;
  /**
   * Check if execution has already been triggered.
   */
  isExecutionTriggered: () => boolean;
}

export interface ProcessInputResult {
  actionability: ActionabilityResult;
  previousState: KiteAIState;
  newState: KiteAIState;
  stateChanged: boolean;
  canProceed: boolean;
  guidancePrompt: string;
  /**
   * True if user confirmed execution and workflow should be generated immediately.
   * When true, skip AI response and trigger workflow generation directly.
   */
  forceExecution: boolean;
}

const STATE_LABELS: Record<KiteAIState, string> = {
  'clarification': 'Gathering Requirements',
  'escalation': 'Suggesting Options',
  'execution-ready': 'Ready to Build',
};

export function useKiteAIConversation(initialMode: KiteAIMode = 'base'): UseKiteAIConversationResult {
  const [context, setContext] = useState<ConversationContext>(() => 
    createInitialContext(initialMode)
  );

  const processUserInput = useCallback((input: string): ProcessInputResult => {
    // CRITICAL: Check for forced execution FIRST (confirmation phrase in execution-ready state)
    // If user confirms, we should NOT send to AI - just trigger workflow generation immediately
    const forceExec = shouldForceExecution(context, input);
    
    if (forceExec) {
      console.log('[KiteAI] FORCE EXECUTION detected - user confirmed with:', input);
      // Return immediately with forceExecution flag - caller should trigger workflow generation
      // Use the last actionability result since we're not re-computing
      const lastActionability: ActionabilityResult = context.lastActionability ?? {
        score: 5,
        confidence: 1.0,
        present: ['actor', 'trigger', 'goal', 'scope', 'flowSignal'] as (keyof import('@/ai/actionability').ActionabilityDimensions)[],
        missing: [] as (keyof import('@/ai/actionability').ActionabilityDimensions)[],
        dimensions: { actor: true, trigger: true, goal: true, scope: true, flowSignal: true },
        isActionable: true,
      };
      
      return {
        actionability: lastActionability,
        previousState: 'execution-ready',
        newState: 'execution-ready',
        stateChanged: false,
        canProceed: true,
        guidancePrompt: '',
        forceExecution: true,
      };
    }
    
    // Get aggregated vision signals from all image/Figma sources
    const visionSignals = getAggregatedVisionSignals(context);
    const hasVisionSources = context.sources.some(
      s => s.type === 'image' || s.type === 'figma-frame'
    );
    
    // Use vision-enhanced actionability if we have vision sources
    const actionability = hasVisionSources
      ? computeActionabilityWithVision(input, visionSignals)
      : computeActionability(input);
    
    const transition = computeNextState(context, actionability);
    const newContext = applyTransition(context, transition, input);
    
    setContext(newContext);

    let guidancePrompt = '';
    
    if (transition.to === 'clarification') {
      // Include vision-specific questions if available
      const visionQuestions = hasVisionSources 
        ? getVisionMissingQuestions(visionSignals) 
        : [];
      
      guidancePrompt = buildClarificationPrompt(
        actionability.missing,
        actionability.score,
        context.mode
      );
      
      // Append vision-specific context if available
      if (visionQuestions.length > 0) {
        guidancePrompt += `\n\nBased on the visual analysis: ${visionQuestions.slice(0, 2).join(' ')}`;
      }
    } else if (transition.to === 'escalation') {
      const userContext = context.conversationHistory
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('. ');
      guidancePrompt = buildEscalationPrompt(userContext, context.mode);
    } else if (transition.to === 'execution-ready') {
      const summary = buildContextSummary(newContext);
      guidancePrompt = buildExecutionConfirmationPrompt(summary);
    }

    return {
      actionability,
      previousState: transition.from,
      newState: transition.to,
      stateChanged: transition.from !== transition.to,
      canProceed: transition.to === 'execution-ready',
      guidancePrompt,
      forceExecution: false,
    };
  }, [context]);

  const setMode = useCallback((mode: KiteAIMode) => {
    setContext(prev => ({ ...prev, mode }));
    console.log(`[KiteAI] mode changed to: ${mode}`);
  }, []);

  const reset = useCallback(() => {
    const newContext = createInitialContext(context.mode);
    setContext(newContext);
    console.log('[KiteAI] conversation reset');
  }, [context.mode]);

  const addAssistantMessage = useCallback((content: string) => {
    setContext(prev => ({
      ...prev,
      conversationHistory: [
        ...prev.conversationHistory,
        {
          role: 'assistant',
          content,
          timestamp: Date.now(),
        },
      ],
    }));
  }, []);

  const getAccumulatedSummary = useCallback((): string => {
    return buildContextSummary(context);
  }, [context]);

  /**
   * Add a source (text, image, or Figma frame) to the conversation context.
   */
  const addConversationSource = useCallback((
    type: ConversationSourceType,
    payload: any,
    confidence: number,
    extractedSignals?: VisionExtractedSignals
  ) => {
    console.log('[KiteAI] Adding source:', { type, confidence, extractedSignals });
    setContext(prev => addSource(prev, {
      type,
      payload,
      confidence,
      extractedSignals,
    }));
  }, []);

  /**
   * Get all sources in the conversation.
   */
  const getSources = useCallback((): ConversationSource[] => {
    return context.sources;
  }, [context.sources]);

  /**
   * Get aggregated vision signals from all image/Figma sources.
   */
  const getVisionSignals = useCallback((): VisionExtractedSignals => {
    return getAggregatedVisionSignals(context);
  }, [context]);

  /**
   * Update vision signals for sources of a specific type.
   */
  const updateVisionSignals = useCallback((
    sourceType: ConversationSourceType,
    signals: VisionExtractedSignals
  ) => {
    console.log('[KiteAI] Updating vision signals for', sourceType, signals);
    setContext(prev => updateSourceSignals(prev, sourceType, signals));
  }, []);

  /**
   * Check if user's message should trigger immediate workflow execution.
   */
  const checkForceExecution = useCallback((message: string): boolean => {
    return shouldForceExecution(context, message);
  }, [context]);

  /**
   * Mark execution as triggered. One-way latch.
   */
  const triggerExecution = useCallback(() => {
    setContext(prev => markExecutionTriggered(prev));
  }, []);

  /**
   * Check if execution has already been triggered.
   */
  const isExecutionTriggered = useCallback((): boolean => {
    return context.executionTriggered;
  }, [context.executionTriggered]);

  const state = useMemo((): KiteAIConversationState => {
    const lastActionability = context.lastActionability;
    const score = lastActionability?.score ?? 0;
    const confidence = lastActionability?.confidence ?? 0;
    const missing = lastActionability?.missing ?? [];
    
    // Include vision-related questions if we have vision sources
    const visionSignals = getAggregatedVisionSignals(context);
    const hasVisionSources = context.sources.some(
      s => s.type === 'image' || s.type === 'figma-frame'
    );
    const visionQuestions = hasVisionSources 
      ? getVisionMissingQuestions(visionSignals)
      : [];
    
    const suggestedQuestions = [
      ...getMissingDimensionQuestions(missing),
      ...visionQuestions,
    ];
    
    return {
      context,
      canStartProject: canShowStartProject(context),
      currentScore: score,
      currentConfidence: confidence,
      missingDimensions: missing,
      suggestedQuestions,
      systemPrompt: getSystemPrompt(context.mode),
      stateLabel: STATE_LABELS[context.state],
    };
  }, [context]);

  return {
    state,
    processUserInput,
    setMode,
    reset,
    addAssistantMessage,
    getAccumulatedSummary,
    addConversationSource,
    getSources,
    getVisionSignals,
    updateVisionSignals,
    checkForceExecution,
    triggerExecution,
    isExecutionTriggered,
  };
}

function buildContextSummary(context: ConversationContext): string {
  const userMessages = context.conversationHistory
    .filter(m => m.role === 'user')
    .map(m => m.content);
  
  if (userMessages.length === 0) {
    return 'No context gathered yet.';
  }

  const lastActionability = context.lastActionability;
  const parts: string[] = [];

  if (lastActionability) {
    const { present } = lastActionability;
    if (present.includes('actor')) {
      parts.push('• Actor: Identified from conversation');
    }
    if (present.includes('trigger')) {
      parts.push('• Trigger: Workflow start condition defined');
    }
    if (present.includes('goal')) {
      parts.push('• Goal: Success criteria understood');
    }
    if (present.includes('scope')) {
      parts.push('• Scope: Boundaries established');
    }
    if (present.includes('flowSignal')) {
      parts.push('• Flow: Process steps outlined');
    }
  }

  const summary = userMessages.join(' ').slice(0, 500);
  
  return `Based on our conversation:\n${parts.join('\n')}\n\nContext: "${summary}${summary.length >= 500 ? '...' : ''}"`;
}

export default useKiteAIConversation;
