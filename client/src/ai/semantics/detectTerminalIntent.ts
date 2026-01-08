/**
 * Phase 6.8: Semantic Terminal Inference
 * 
 * Detects whether a leaf node (no outgoing edges) is semantically terminal
 * based on its label, description, and incoming edge context.
 * 
 * This is a read-only, deterministic detector that does NOT modify the graph.
 * It only provides signals for diagnostics suppression and explainability.
 */

import type { Node, Edge } from '@/lib/kiteframe/types';

export type TerminalConfidence = 'high' | 'medium' | 'low';

export interface TerminalIntentSignal {
  isLikelyTerminal: boolean;
  confidence: TerminalConfidence;
  reasons: string[];
  matchedRules: string[];
}

const HIGH_COMPLETION_KEYWORDS = [
  'complete', 'completed', 'done', 'finished', 'finalized',
  'success', 'successful', 'created', 'submitted', 'sent',
  'notified', 'confirmed', 'approved', 'rejected', 'approval', 'rejection',
  'account created', 'setup complete', 'dashboard created',
  'request processed', 'order placed', 'payment complete',
  'registration complete', 'verification complete'
];

const HIGH_EXPLICIT_END_PHRASES = [
  'flow ends here', 'end of flow', 'no further action',
  'process ends', 'workflow complete', 'end process',
  'final step', 'last step', 'terminal step'
];

const HIGH_DECISION_OUTCOME_LABELS = [
  'approved', 'rejected', 'complete', 'completed',
  'success', 'failed', 'denied', 'accepted',
  'passed', 'declined', 'cancelled', 'confirmed'
];

const MEDIUM_NOTIFY_KEYWORDS = [
  'notify', 'inform', 'email user', 'send message',
  'show confirmation', 'alert', 'send notification',
  'send email', 'send sms', 'push notification'
];

const MEDIUM_ADMIN_KEYWORDS = [
  'archive', 'log', 'record', 'store', 'audit',
  'save', 'persist', 'write log', 'capture'
];

function getNodeText(node: Node): string {
  const data = node.data as Record<string, unknown> | undefined;
  const label = (data?.label as string) ?? (data?.title as string) ?? '';
  const description = (data?.description as string) ?? (data?.text as string) ?? '';
  return `${label} ${description}`.toLowerCase().trim();
}

function getEdgeLabel(edge: Edge): string {
  const edgeData = edge.data as Record<string, unknown> | undefined;
  const label = (edgeData?.label as string) ?? (edge as any).label ?? '';
  return label.toLowerCase().trim();
}

function isDecisionNode(node: Node): boolean {
  const decisionTypes = ['condition', 'decision'];
  return decisionTypes.includes(node.type || '');
}

function matchesAny(text: string, keywords: string[]): string[] {
  return keywords.filter(kw => text.includes(kw));
}

export function detectTerminalIntent(args: {
  node: Node;
  incomingEdges: Edge[];
  outgoingEdges: Edge[];
  nodesById: Map<string, Node>;
  edgesById?: Map<string, Edge>;
}): TerminalIntentSignal {
  const { node, incomingEdges, outgoingEdges, nodesById } = args;
  
  const defaultResult: TerminalIntentSignal = {
    isLikelyTerminal: false,
    confidence: 'low',
    reasons: [],
    matchedRules: [],
  };
  
  if (outgoingEdges.length > 0) {
    return defaultResult;
  }
  
  if (incomingEdges.length === 0) {
    return defaultResult;
  }
  
  const terminalTypes = ['output', 'end'];
  if (terminalTypes.includes(node.type || '')) {
    return defaultResult;
  }
  
  const reasons: string[] = [];
  const matchedRules: string[] = [];
  let highConfidence = false;
  let mediumConfidence = false;
  
  const text = getNodeText(node);
  
  const completionMatches = matchesAny(text, HIGH_COMPLETION_KEYWORDS);
  if (completionMatches.length > 0) {
    highConfidence = true;
    reasons.push(`Contains completion keyword: "${completionMatches[0]}"`);
    matchedRules.push('TERM_HIGH_KEYWORD');
  }
  
  const explicitEndMatches = matchesAny(text, HIGH_EXPLICIT_END_PHRASES);
  if (explicitEndMatches.length > 0) {
    highConfidence = true;
    reasons.push(`Contains explicit end phrase: "${explicitEndMatches[0]}"`);
    matchedRules.push('TERM_HIGH_EXPLICIT_END');
  }
  
  for (const edge of incomingEdges) {
    const sourceNode = nodesById.get(edge.source);
    if (sourceNode && isDecisionNode(sourceNode)) {
      const edgeLabel = getEdgeLabel(edge);
      const outcomeMatches = matchesAny(edgeLabel, HIGH_DECISION_OUTCOME_LABELS);
      if (outcomeMatches.length > 0) {
        highConfidence = true;
        reasons.push(`Decision outcome branch: "${outcomeMatches[0]}"`);
        matchedRules.push('TERM_HIGH_DECISION_OUTCOME');
        break;
      }
    }
  }
  
  if (!highConfidence) {
    const notifyMatches = matchesAny(text, MEDIUM_NOTIFY_KEYWORDS);
    if (notifyMatches.length > 0) {
      mediumConfidence = true;
      reasons.push(`Contains notification action: "${notifyMatches[0]}"`);
      matchedRules.push('TERM_MED_NOTIFY');
    }
    
    const adminMatches = matchesAny(text, MEDIUM_ADMIN_KEYWORDS);
    if (adminMatches.length > 0) {
      mediumConfidence = true;
      reasons.push(`Contains administrative action: "${adminMatches[0]}"`);
      matchedRules.push('TERM_MED_ADMIN');
    }
  }
  
  if (highConfidence) {
    return {
      isLikelyTerminal: true,
      confidence: 'high',
      reasons,
      matchedRules,
    };
  }
  
  if (mediumConfidence) {
    return {
      isLikelyTerminal: true,
      confidence: 'medium',
      reasons,
      matchedRules,
    };
  }
  
  return defaultResult;
}

export function isSemanticTerminalInferenceEnabled(): boolean {
  try {
    return import.meta.env.VITE_ENABLE_SEMANTIC_TERMINAL_INFERENCE !== 'false';
  } catch {
    return true;
  }
}
