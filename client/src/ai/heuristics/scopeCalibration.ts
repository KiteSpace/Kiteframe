import type { Insight } from '@/lib/kiteframe/utils/insights/types';
import { getSessionSignals } from './sessionSignals';

export interface ScopeConstraints {
  maxNodes: number;
  attachmentDirection: 'downstream' | 'upstream' | 'parallel' | 'any';
  allowGlobalRestructuring: boolean;
  scopeReductionFactor: number;
}

export function calibrateProposalScope(
  insight: Insight,
  affectedNodeCount: number
): ScopeConstraints {
  const signals = getSessionSignals();
  
  let maxNodes = 4;
  let attachmentDirection: ScopeConstraints['attachmentDirection'] = 'any';
  let allowGlobalRestructuring = true;
  let scopeReductionFactor = 1.0;
  
  if (affectedNodeCount === 1) {
    maxNodes = 2;
    attachmentDirection = 'downstream';
    allowGlobalRestructuring = false;
  } else if (affectedNodeCount === 2) {
    maxNodes = 3;
    attachmentDirection = 'downstream';
    allowGlobalRestructuring = false;
  } else if (affectedNodeCount >= 3 && affectedNodeCount <= 5) {
    maxNodes = 3;
    attachmentDirection = 'any';
    allowGlobalRestructuring = false;
  } else if (affectedNodeCount > 5) {
    maxNodes = 2;
    attachmentDirection = 'downstream';
    allowGlobalRestructuring = false;
    scopeReductionFactor = 0.5;
  }
  
  const cancelCount = signals.canceledProposals.filter((p: { insightId: string }) => p.insightId === insight.id).length;
  if (cancelCount > 0) {
    maxNodes = Math.max(1, Math.floor(maxNodes * Math.pow(0.7, cancelCount)));
    scopeReductionFactor *= Math.pow(0.8, cancelCount);
  }
  
  return {
    maxNodes,
    attachmentDirection,
    allowGlobalRestructuring,
    scopeReductionFactor,
  };
}

export function getScopeGuidance(
  insight: Insight,
  affectedNodeCount: number
): string {
  const scope = calibrateProposalScope(insight, affectedNodeCount);
  const parts: string[] = [];
  
  parts.push(`Generate at most ${scope.maxNodes} new nodes.`);
  
  if (scope.attachmentDirection === 'downstream') {
    parts.push('Connect new nodes downstream from affected nodes only.');
  } else if (scope.attachmentDirection === 'upstream') {
    parts.push('Add guard/validation nodes upstream of affected nodes.');
  } else if (scope.attachmentDirection === 'parallel') {
    parts.push('Add parallel paths alongside affected nodes.');
  }
  
  if (!scope.allowGlobalRestructuring) {
    parts.push('Do not restructure the workflow globally. Make surgical, localized changes.');
  }
  
  if (scope.scopeReductionFactor < 1) {
    parts.push('Keep changes minimal and focused.');
  }
  
  return parts.join(' ');
}
