/**
 * Phase 7: Loop Detection Utility
 * 
 * Detects potential infinite loops, retry patterns without counters, and cycles
 * without proper exit conditions in workflow graphs.
 * 
 * Philosophy:
 * - Detection is passive and non-blocking
 * - Warnings surfaced for visibility only
 * - Does not prevent workflow acceptance
 * - Designed to enhance explainability
 */

import type { Node, Edge } from '@/lib/kiteframe/types';
import type { UnresolvedConcern, UnresolvedConcernType } from '@/ai/explainability/types';

export interface LoopDetectionResult {
  hasLoops: boolean;
  concerns: UnresolvedConcern[];
  loopNodeIds: string[];
}

export interface DetectedLoop {
  nodeIds: string[];
  entryNodeId: string;
  hasExitCondition: boolean;
  hasRetryCounter: boolean;
  loopType: 'cycle' | 'self_loop' | 'retry_pattern';
}

const RETRY_KEYWORDS = ['retry', 'repeat', 'again', 'reattempt', 'try again', 'loop', 'iterate'];
const COUNTER_KEYWORDS = ['count', 'counter', 'attempt', 'times', 'max', 'limit', '#', 'number'];
const EXIT_KEYWORDS = ['exit', 'break', 'stop', 'end', 'terminate', 'success', 'complete', 'done', 'fail', 'failure'];

function hasExitCondition(node: Node, edges: Edge[], allNodes: Node[]): boolean {
  const nodeData = node.data as any;
  const label = (nodeData?.label || '').toLowerCase();
  const description = (nodeData?.description || '').toLowerCase();
  const combined = `${label} ${description}`;
  
  if (EXIT_KEYWORDS.some(kw => combined.includes(kw))) {
    return true;
  }
  
  if (node.type === 'condition') {
    const outgoingEdges = edges.filter(e => e.source === node.id);
    const edgeLabels = outgoingEdges.map(e => 
      ((e.data as any)?.label || (e as any).label || '').toLowerCase()
    ).join(' ');
    
    if (EXIT_KEYWORDS.some(kw => edgeLabels.includes(kw))) {
      return true;
    }
  }
  
  return false;
}

function hasRetryCounter(node: Node): boolean {
  const nodeData = node.data as any;
  const label = (nodeData?.label || '').toLowerCase();
  const description = (nodeData?.description || '').toLowerCase();
  const combined = `${label} ${description}`;
  
  return COUNTER_KEYWORDS.some(kw => combined.includes(kw));
}

function isRetryPattern(node: Node): boolean {
  const nodeData = node.data as any;
  const label = (nodeData?.label || '').toLowerCase();
  const description = (nodeData?.description || '').toLowerCase();
  const combined = `${label} ${description}`;
  
  return RETRY_KEYWORDS.some(kw => combined.includes(kw));
}

function findCycles(nodes: Node[], edges: Edge[]): string[][] {
  const cycles: string[][] = [];
  const adjacency: Map<string, string[]> = new Map();
  
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    const existing = adjacency.get(edge.source) || [];
    existing.push(edge.target);
    adjacency.set(edge.source, existing);
  }
  
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];
  
  function dfs(nodeId: string): void {
    if (recStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart);
        cycles.push([...cycle, nodeId]);
      }
      return;
    }
    
    if (visited.has(nodeId)) {
      return;
    }
    
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);
    
    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }
    
    path.pop();
    recStack.delete(nodeId);
  }
  
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }
  
  return cycles;
}

function findSelfLoops(nodes: Node[], edges: Edge[]): string[] {
  const selfLoopNodeIds: string[] = [];
  
  for (const edge of edges) {
    if (edge.source === edge.target) {
      if (!selfLoopNodeIds.includes(edge.source)) {
        selfLoopNodeIds.push(edge.source);
      }
    }
  }
  
  return selfLoopNodeIds;
}

export function detectLoops(nodes: Node[], edges: Edge[]): LoopDetectionResult {
  const concerns: UnresolvedConcern[] = [];
  const allLoopNodeIds: string[] = [];
  const detectedLoops: DetectedLoop[] = [];
  
  const selfLoopNodeIds = findSelfLoops(nodes, edges);
  for (const nodeId of selfLoopNodeIds) {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      const hasExit = hasExitCondition(node, edges, nodes);
      const hasCounter = hasRetryCounter(node);
      
      detectedLoops.push({
        nodeIds: [nodeId],
        entryNodeId: nodeId,
        hasExitCondition: hasExit,
        hasRetryCounter: hasCounter,
        loopType: 'self_loop',
      });
      
      if (!allLoopNodeIds.includes(nodeId)) {
        allLoopNodeIds.push(nodeId);
      }
      
      if (!hasExit && !hasCounter) {
        concerns.push({
          type: 'infinite_loop_risk',
          severity: 'warning',
          message: `Self-referencing node "${(node.data as any)?.label || 'Unnamed'}" has no visible exit condition or retry limit.`,
          affectedNodeIds: [nodeId],
          detectedAt: Date.now(),
        });
      }
    }
  }
  
  const cycles = findCycles(nodes, edges);
  for (const cycle of cycles) {
    const cycleWithoutLast = cycle.slice(0, -1);
    const uniqueNodeIds = Array.from(new Set(cycleWithoutLast));
    const cycleNodes = uniqueNodeIds.map(id => nodes.find(n => n.id === id)).filter(Boolean) as Node[];
    
    const hasAnyExit = cycleNodes.some(n => hasExitCondition(n, edges, nodes));
    const hasAnyCounter = cycleNodes.some(n => hasRetryCounter(n));
    const isRetry = cycleNodes.some(n => isRetryPattern(n));
    
    detectedLoops.push({
      nodeIds: uniqueNodeIds,
      entryNodeId: uniqueNodeIds[0],
      hasExitCondition: hasAnyExit,
      hasRetryCounter: hasAnyCounter,
      loopType: isRetry ? 'retry_pattern' : 'cycle',
    });
    
    for (const id of uniqueNodeIds) {
      if (!allLoopNodeIds.includes(id)) {
        allLoopNodeIds.push(id);
      }
    }
    
    if (!hasAnyExit && uniqueNodeIds.length > 0) {
      const concernType: UnresolvedConcernType = 'loop_without_exit';
      const firstNode = cycleNodes[0];
      const cycleLabel = cycleNodes.map(n => (n.data as any)?.label || 'Unnamed').join(' → ');
      
      concerns.push({
        type: concernType,
        severity: 'warning',
        message: `Cycle detected (${cycleLabel}) without a visible exit condition. Consider adding a decision node to break the loop.`,
        affectedNodeIds: uniqueNodeIds,
        detectedAt: Date.now(),
      });
    }
    
    if (isRetry && !hasAnyCounter) {
      concerns.push({
        type: 'retry_without_counter',
        severity: 'warning',
        message: `Retry pattern detected without a visible counter or max attempts. Consider adding a limit to prevent infinite retries.`,
        affectedNodeIds: uniqueNodeIds,
        detectedAt: Date.now(),
      });
    }
  }
  
  return {
    hasLoops: allLoopNodeIds.length > 0,
    concerns,
    loopNodeIds: allLoopNodeIds,
  };
}

export function isLoopDetectionEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const envFlag = (import.meta as any).env?.VITE_ENABLE_LOOP_DETECTION_WARNINGS;
    if (envFlag !== undefined) {
      return envFlag === 'true' || envFlag === true;
    }
  }
  return true;
}
