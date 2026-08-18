/**
 * Phase 2.2: Full Graph Payload Detector
 * 
 * Detects when AI generates a "full graph" (complete workflow) vs a "patch" (small edit).
 * Full graphs should NOT be merged by default - they require explicit REPLACE confirmation.
 * 
 * Heuristics:
 * H1: Incoming nodes >= min(8, 0.6 * existing) OR >= 10 nodes
 * H2: Incoming contains >= 3 duplicate canonical labels present in existing
 * H3: Incoming has linear chain covering start→end (input→output)
 * H4: Incoming node ids are mostly new, with no stable mapping to existing
 */

import type { Node, Edge } from '@/lib/kiteframe/types';
import type { FullGraphDetectionResult, MutationIntent } from './types';

const CANONICAL_LABELS = [
  'opportunity identification',
  'initial assessment',
  'research',
  'design',
  'build',
  'test',
  'release',
  'complete',
  'start',
  'end',
  'input',
  'output',
  'process',
  'decision',
  'approval'
];

function normalizeLabel(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

function extractNodeLabels(nodes: Node[]): string[] {
  return nodes
    .map(n => normalizeLabel(n.data?.label || ''))
    .filter(Boolean);
}

function countDuplicateLabels(
  existingLabels: string[],
  incomingLabels: string[]
): number {
  const existingSet = new Set(existingLabels);
  return incomingLabels.filter(label => existingSet.has(label)).length;
}

function countCanonicalLabels(labels: string[]): number {
  return labels.filter(label => 
    CANONICAL_LABELS.some(canonical => label.includes(canonical))
  ).length;
}

function detectLinearChain(nodes: Node[], edges: Edge[]): boolean {
  if (nodes.length < 3) return false;
  
  const nodeIds = new Set(nodes.map(n => n.id));
  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();
  
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  }
  
  let startNodes = 0;
  let endNodes = 0;
  let linearNodes = 0;
  
  for (const node of nodes) {
    const inD = inDegree.get(node.id) || 0;
    const outD = outDegree.get(node.id) || 0;
    
    if (inD === 0 && outD > 0) startNodes++;
    if (outD === 0 && inD > 0) endNodes++;
    if (inD <= 1 && outD <= 1) linearNodes++;
  }
  
  const isLinear = startNodes === 1 && endNodes >= 1 && linearNodes >= nodes.length * 0.6;
  
  const hasInputOutput = nodes.some(n => {
    const type = (n.type || '').toLowerCase();
    const label = normalizeLabel(n.data?.label || '');
    return type.includes('input') || type.includes('start') || 
           label.includes('start') || label.includes('input');
  }) && nodes.some(n => {
    const type = (n.type || '').toLowerCase();
    const label = normalizeLabel(n.data?.label || '');
    return type.includes('output') || type.includes('end') || 
           label.includes('complete') || label.includes('end');
  });
  
  return isLinear && hasInputOutput;
}

function countNewNodeIds(existingNodes: Node[], incomingNodes: Node[]): number {
  const existingIds = new Set(existingNodes.map(n => n.id));
  return incomingNodes.filter(n => !existingIds.has(n.id)).length;
}

export function detectFullGraphPayload(
  existingNodes: Node[],
  existingEdges: Edge[],
  incomingNodes: Node[],
  incomingEdges: Edge[]
): FullGraphDetectionResult {
  const matchedHeuristics: string[] = [];
  let confidence = 0;
  
  const existingLabels = extractNodeLabels(existingNodes);
  const incomingLabels = extractNodeLabels(incomingNodes);
  
  // H1: Node count threshold
  const countThreshold = Math.min(8, existingNodes.length * 0.6);
  const meetsCountThreshold = incomingNodes.length >= countThreshold || incomingNodes.length >= 10;
  
  if (meetsCountThreshold) {
    matchedHeuristics.push('H1_NODE_COUNT_THRESHOLD');
    confidence += 0.3;
  }
  
  // H2: Duplicate canonical labels
  const duplicateCount = countDuplicateLabels(existingLabels, incomingLabels);
  const canonicalCount = countCanonicalLabels(incomingLabels);
  
  if (duplicateCount >= 3 || canonicalCount >= 5) {
    matchedHeuristics.push('H2_DUPLICATE_CANONICAL_LABELS');
    confidence += 0.25;
  }
  
  // H3: Linear chain with start→end
  const hasLinearChain = detectLinearChain(incomingNodes, incomingEdges);
  
  if (hasLinearChain) {
    matchedHeuristics.push('H3_LINEAR_CHAIN_START_END');
    confidence += 0.25;
  }
  
  // H4: Mostly new node IDs
  const newNodeCount = countNewNodeIds(existingNodes, incomingNodes);
  const newNodeRatio = incomingNodes.length > 0 ? newNodeCount / incomingNodes.length : 0;
  
  if (newNodeRatio >= 0.8 && incomingNodes.length >= 5) {
    matchedHeuristics.push('H4_MOSTLY_NEW_NODE_IDS');
    confidence += 0.2;
  }
  
  const isFullGraph = confidence >= 0.5 || matchedHeuristics.length >= 2;
  
  let suggestedIntent: MutationIntent;
  if (isFullGraph) {
    suggestedIntent = existingNodes.length > 0 ? 'REPLACE' : 'PATCH';
  } else {
    suggestedIntent = 'PATCH';
  }
  
  console.log('[FullGraphDetector] Detection result:', {
    isFullGraph,
    confidence,
    matchedHeuristics,
    suggestedIntent,
    stats: {
      existingNodeCount: existingNodes.length,
      incomingNodeCount: incomingNodes.length,
      duplicateLabels: duplicateCount,
      canonicalLabels: canonicalCount,
      hasLinearChain,
      newNodeRatio
    }
  });
  
  return {
    isFullGraph,
    confidence,
    matchedHeuristics,
    suggestedIntent
  };
}

export function shouldBlockMerge(detection: FullGraphDetectionResult): boolean {
  return detection.isFullGraph && detection.suggestedIntent !== 'PATCH';
}

export function requiresReplaceConfirmation(detection: FullGraphDetectionResult): boolean {
  return detection.isFullGraph && detection.confidence >= 0.5;
}
