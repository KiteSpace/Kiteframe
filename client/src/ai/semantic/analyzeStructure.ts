/**
 * Phase 6B: Structural Analysis
 * 
 * Analyzes workflow structure to detect the presence of expected elements.
 * This is READ-ONLY - no workflow modification occurs.
 * 
 * The analysis is deterministic and independent of semantic claims.
 */

import type { Node, Edge } from '@/lib/kiteframe/types';
import type { StructuralElement } from './structuralExpectations';

/**
 * Structural signature of a workflow
 * Captures what structural elements are present
 */
export interface StructuralSignature {
  /** Has at least one condition/decision node */
  hasDecisionNodes: boolean;
  
  /** Has at least one loop/cycle in the graph */
  hasLoops: boolean;
  
  /** Has terminal nodes that indicate escalation/error */
  hasTerminalEscalation: boolean;
  
  /** Has monitoring/tracking process nodes */
  hasMonitoringStep: boolean;
  
  /** Has explicit human handoff nodes */
  hasHumanHandoff: boolean;
  
  /** Has any terminal nodes (no outgoing edges) */
  hasTerminalNodes: boolean;
  
  /** Count of decision nodes */
  decisionNodeCount: number;
  
  /** Count of terminal nodes */
  terminalNodeCount: number;
  
  /** Node IDs that are decision nodes */
  decisionNodeIds: string[];
  
  /** Node IDs that are terminal nodes */
  terminalNodeIds: string[];
  
  /** Node IDs that are escalation terminals */
  escalationNodeIds: string[];
}

/**
 * Keywords indicating decision/condition nodes
 */
const DECISION_INDICATORS = ['condition', 'decision', 'branch', 'switch', 'if', 'check', 'validate', 'verify'];

/**
 * Keywords indicating escalation/error terminals
 */
const ESCALATION_INDICATORS = [
  'error', 'fail', 'reject', 'escalate', 'alert', 'notify', 'support',
  'exception', 'abort', 'cancel', 'timeout', 'expired', 'blocked',
  'suspended', 'flagged', 'review', 'manual',
];

/**
 * Keywords indicating monitoring/tracking steps
 */
const MONITORING_INDICATORS = [
  'monitor', 'track', 'log', 'record', 'count', 'measure',
  'observe', 'watch', 'audit', 'checkpoint',
];

/**
 * Keywords indicating human handoff
 */
const HUMAN_HANDOFF_INDICATORS = [
  'manual review', 'human review', 'support team', 'admin review',
  'manager approval', 'manual approval', 'pending review',
  'await approval', 'escalate to', 'hand off', 'handoff',
];

/**
 * Check if a node is a decision/condition node
 */
function isDecisionNode(node: Node): boolean {
  const type = (node.type || '').toLowerCase();
  const label = (node.data?.label || '').toLowerCase();
  
  if (type === 'condition') return true;
  
  return DECISION_INDICATORS.some(ind => 
    type.includes(ind) || label.includes(ind)
  );
}

/**
 * Check if a node is an escalation/error terminal
 */
function isEscalationNode(node: Node): boolean {
  const label = (node.data?.label || '').toLowerCase();
  const description = (node.data?.description || '').toLowerCase();
  const text = `${label} ${description}`;
  
  return ESCALATION_INDICATORS.some(ind => text.includes(ind));
}

/**
 * Check if a node is a monitoring/tracking step
 */
function isMonitoringNode(node: Node): boolean {
  const label = (node.data?.label || '').toLowerCase();
  const description = (node.data?.description || '').toLowerCase();
  const text = `${label} ${description}`;
  
  return MONITORING_INDICATORS.some(ind => text.includes(ind));
}

/**
 * Check if a node represents human handoff
 */
function isHumanHandoffNode(node: Node): boolean {
  const label = (node.data?.label || '').toLowerCase();
  const description = (node.data?.description || '').toLowerCase();
  const text = `${label} ${description}`;
  
  return HUMAN_HANDOFF_INDICATORS.some(ind => text.includes(ind));
}

/**
 * Detect cycles/loops in the graph using DFS
 */
function detectCycles(nodes: Node[], edges: Edge[]): boolean {
  const adjacency = new Map<string, string[]>();
  const nodeIds = new Set(nodes.map(n => n.id));
  
  // Build adjacency list
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    
    const neighbors = adjacency.get(edge.source) || [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
  }
  
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function hasCycleDFS(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycleDFS(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }
    
    recursionStack.delete(nodeId);
    return false;
  }
  
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (hasCycleDFS(node.id)) return true;
    }
  }
  
  return false;
}

/**
 * Find terminal nodes (nodes with no outgoing edges)
 */
function findTerminalNodes(nodes: Node[], edges: Edge[]): Node[] {
  const hasOutgoing = new Set<string>();
  
  for (const edge of edges) {
    hasOutgoing.add(edge.source);
  }
  
  return nodes.filter(n => !hasOutgoing.has(n.id));
}

/**
 * Analyze workflow structure to produce a structural signature
 * 
 * This is the main entry point for Phase 6B structural analysis.
 * The analysis is deterministic and independent of semantic claims.
 */
export function analyzeStructure(nodes: Node[], edges: Edge[]): StructuralSignature {
  const decisionNodes = nodes.filter(isDecisionNode);
  const terminalNodes = findTerminalNodes(nodes, edges);
  const escalationNodes = nodes.filter(isEscalationNode);
  const monitoringNodes = nodes.filter(isMonitoringNode);
  const handoffNodes = nodes.filter(isHumanHandoffNode);
  
  const hasLoops = detectCycles(nodes, edges);
  
  // Check for escalation among terminals
  const terminalEscalationNodes = terminalNodes.filter(isEscalationNode);
  
  return {
    hasDecisionNodes: decisionNodes.length > 0,
    hasLoops,
    hasTerminalEscalation: terminalEscalationNodes.length > 0,
    hasMonitoringStep: monitoringNodes.length > 0,
    hasHumanHandoff: handoffNodes.length > 0,
    hasTerminalNodes: terminalNodes.length > 0,
    decisionNodeCount: decisionNodes.length,
    terminalNodeCount: terminalNodes.length,
    decisionNodeIds: decisionNodes.map(n => n.id),
    terminalNodeIds: terminalNodes.map(n => n.id),
    escalationNodeIds: escalationNodes.map(n => n.id),
  };
}

/**
 * Check if a structural element is present in the signature
 */
export function hasStructuralElement(
  signature: StructuralSignature,
  element: StructuralElement
): boolean {
  switch (element) {
    case 'decision_node':
      return signature.hasDecisionNodes;
    case 'loop_edge':
      return signature.hasLoops;
    case 'escalation_path':
      return signature.hasTerminalEscalation;
    case 'terminal_node':
      return signature.hasTerminalNodes;
    case 'monitoring_step':
      return signature.hasMonitoringStep;
    case 'human_handoff':
      return signature.hasHumanHandoff;
    case 'counter_state':
      // Future: not currently detectable
      return false;
    case 'timer_state':
      // Future: not currently detectable
      return false;
    default:
      return false;
  }
}
