import type { Insight } from '@/lib/kiteframe/utils/insights/types';
import type { Node } from '@/lib/kiteframe/types';

export type InsightPattern =
  | 'single_point_of_failure'
  | 'ambiguous_responsibility'
  | 'overloaded_step'
  | 'missing_validation'
  | 'orphan_path'
  | 'circular_dependency'
  | 'missing_error_handling'
  | 'bottleneck'
  | 'unknown';

export interface GenerationBias {
  preferredNodeTypes: Array<'input' | 'process' | 'condition' | 'output'>;
  preferredStructures: Array<'parallel' | 'sequential' | 'branching' | 'guard' | 'fallback'>;
  maxNodes: number;
  minNodes: number;
  suggestRedundancy: boolean;
  suggestDecomposition: boolean;
  attachmentStrategy: 'downstream' | 'upstream' | 'parallel' | 'any';
}

const PATTERN_KEYWORDS: Record<InsightPattern, string[]> = {
  single_point_of_failure: [
    'single point', 'no fallback', 'dependency', 'bottleneck', 'one path',
    'critical path', 'no alternative', 'sole', 'only way', 'single route'
  ],
  ambiguous_responsibility: [
    'unclear', 'ambiguous', 'who', 'ownership', 'responsibility', 'multiple',
    'conflicting', 'overlapping', 'undefined role', 'which'
  ],
  overloaded_step: [
    'too many', 'complex', 'overloaded', 'multiple responsibilities', 'doing too much',
    'combined', 'large step', 'monolithic', 'bloated', 'handles everything'
  ],
  missing_validation: [
    'no validation', 'unchecked', 'missing check', 'no verification', 'unvalidated',
    'no guard', 'no condition', 'assumes', 'no error', 'skip check'
  ],
  orphan_path: [
    'orphan', 'disconnected', 'dead end', 'no continuation', 'isolated',
    'unreachable', 'no input', 'no output', 'floating'
  ],
  circular_dependency: [
    'circular', 'loop', 'cycle', 'recursive', 'self-referencing',
    'infinite', 'depends on itself', 'back to'
  ],
  missing_error_handling: [
    'no error', 'failure', 'exception', 'crash', 'what if',
    'edge case', 'unexpected', 'missing handler', 'no catch'
  ],
  bottleneck: [
    'bottleneck', 'slow', 'blocking', 'wait', 'sequential',
    'one at a time', 'queue', 'delay', 'throughput'
  ],
  unknown: [],
};

const PATTERN_BIASES: Record<InsightPattern, GenerationBias> = {
  single_point_of_failure: {
    preferredNodeTypes: ['condition', 'process'],
    preferredStructures: ['parallel', 'fallback'],
    maxNodes: 4,
    minNodes: 2,
    suggestRedundancy: true,
    suggestDecomposition: false,
    attachmentStrategy: 'parallel',
  },
  ambiguous_responsibility: {
    preferredNodeTypes: ['condition', 'process'],
    preferredStructures: ['branching'],
    maxNodes: 3,
    minNodes: 1,
    suggestRedundancy: false,
    suggestDecomposition: false,
    attachmentStrategy: 'downstream',
  },
  overloaded_step: {
    preferredNodeTypes: ['process'],
    preferredStructures: ['sequential'],
    maxNodes: 4,
    minNodes: 2,
    suggestRedundancy: false,
    suggestDecomposition: true,
    attachmentStrategy: 'downstream',
  },
  missing_validation: {
    preferredNodeTypes: ['condition'],
    preferredStructures: ['guard'],
    maxNodes: 2,
    minNodes: 1,
    suggestRedundancy: false,
    suggestDecomposition: false,
    attachmentStrategy: 'upstream',
  },
  orphan_path: {
    preferredNodeTypes: ['process', 'output'],
    preferredStructures: ['sequential'],
    maxNodes: 2,
    minNodes: 1,
    suggestRedundancy: false,
    suggestDecomposition: false,
    attachmentStrategy: 'any',
  },
  circular_dependency: {
    preferredNodeTypes: ['condition', 'process'],
    preferredStructures: ['guard', 'sequential'],
    maxNodes: 2,
    minNodes: 1,
    suggestRedundancy: false,
    suggestDecomposition: true,
    attachmentStrategy: 'downstream',
  },
  missing_error_handling: {
    preferredNodeTypes: ['condition', 'output'],
    preferredStructures: ['branching', 'fallback'],
    maxNodes: 3,
    minNodes: 1,
    suggestRedundancy: true,
    suggestDecomposition: false,
    attachmentStrategy: 'downstream',
  },
  bottleneck: {
    preferredNodeTypes: ['process'],
    preferredStructures: ['parallel'],
    maxNodes: 4,
    minNodes: 2,
    suggestRedundancy: true,
    suggestDecomposition: true,
    attachmentStrategy: 'parallel',
  },
  unknown: {
    preferredNodeTypes: ['process'],
    preferredStructures: ['sequential'],
    maxNodes: 3,
    minNodes: 1,
    suggestRedundancy: false,
    suggestDecomposition: false,
    attachmentStrategy: 'downstream',
  },
};

export function detectInsightPattern(insight: Insight): InsightPattern {
  const searchText = `${insight.title} ${insight.description}`.toLowerCase();
  
  let bestMatch: InsightPattern = 'unknown';
  let bestScore = 0;
  
  for (const [pattern, keywords] of Object.entries(PATTERN_KEYWORDS)) {
    if (pattern === 'unknown') continue;
    
    let score = 0;
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        score += keyword.length;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern as InsightPattern;
    }
  }
  
  return bestMatch;
}

export function getGenerationBias(insight: Insight): GenerationBias {
  const pattern = detectInsightPattern(insight);
  return PATTERN_BIASES[pattern];
}

export function getPatternGuidance(insight: Insight): string {
  const pattern = detectInsightPattern(insight);
  const bias = PATTERN_BIASES[pattern];
  
  const parts: string[] = [];
  
  if (bias.suggestRedundancy) {
    parts.push('Consider adding parallel paths or fallback mechanisms for redundancy.');
  }
  
  if (bias.suggestDecomposition) {
    parts.push('Consider breaking this into smaller, focused steps.');
  }
  
  if (bias.preferredStructures.includes('guard')) {
    parts.push('Adding validation or guard conditions is recommended.');
  }
  
  if (bias.preferredStructures.includes('branching')) {
    parts.push('Use explicit branching to clarify decision paths.');
  }
  
  if (bias.attachmentStrategy === 'upstream') {
    parts.push('New nodes should precede (guard) the affected nodes.');
  } else if (bias.attachmentStrategy === 'parallel') {
    parts.push('New nodes should run alongside existing nodes as alternatives.');
  }
  
  parts.push(`Target ${bias.minNodes}-${bias.maxNodes} new nodes.`);
  parts.push(`Preferred node types: ${bias.preferredNodeTypes.join(', ')}.`);
  
  return parts.join(' ');
}

export function getNodeCountConstraints(
  insight: Insight,
  affectedNodeCount: number
): { min: number; max: number } {
  const bias = getGenerationBias(insight);
  
  if (affectedNodeCount === 1) {
    return { min: 1, max: Math.min(bias.maxNodes, 2) };
  }
  
  if (affectedNodeCount > 3) {
    return { min: 1, max: 2 };
  }
  
  return { min: bias.minNodes, max: bias.maxNodes };
}
