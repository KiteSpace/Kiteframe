/**
 * Phase 6.7: Decision Repair Heuristic
 * 
 * Automatically repairs incomplete decision nodes (missing Yes/No branches,
 * unlabeled edges, dangling outcomes) BEFORE the system offers Propose or
 * Experiment suggestions.
 * 
 * This is a REPAIR mechanism, not an exploration mechanism.
 * 
 * Hard Guarantees:
 * - Modifies existing workflows only (MERGE mode)
 * - Never creates parallel workflows
 * - Never deletes user-created nodes
 * - Never invents business semantics
 * - Never triggers Propose or Experiment for fixable issues
 * - Is idempotent (safe to run multiple times)
 */

import type { Node, Edge } from '@/lib/kiteframe/types';

export type DecisionIssueType = 
  | 'MISSING_OUTCOME'    // Decision has <2 outgoing edges
  | 'UNLABELED_EDGES'    // Decision edges missing labels
  | 'DANGLING_EDGE';     // Edge has no valid target

export interface DecisionIssue {
  decisionNodeId: string;
  issueType: DecisionIssueType;
  existingOutcomes: string[];
  missingOutcomes: string[];
  affectedEdgeIds: string[];
  confidence: number;
}

export interface DecisionRepairApplied {
  decisionNodeId: string;
  issuesResolved: DecisionIssueType[];
  edgesAdded: number;
  labelsAssigned: string[];
  nodesCreated: string[];
}

export interface DecisionRepairResult {
  nodes: Node[];
  edges: Edge[];
  repairsApplied: DecisionRepairApplied[];
  hasChanges: boolean;
}

const DECISION_NODE_TYPES = ['condition', 'decision', 'branch', 'switch', 'gateway', 'if'];
const TERMINATION_NODE_TYPES = ['end', 'exit', 'terminate', 'complete', 'finish', 'output', 'done', 'success'];
const SUPPORT_NODE_TYPES = ['support', 'help', 'contact', 'assistance'];
const RETRY_NODE_TYPES = ['retry', 'loop', 'repeat', 'back'];

const DEFAULT_POSITIVE_LABELS = ['Yes', 'Pass', 'Valid', 'Success', 'Continue', 'Approved'];
const DEFAULT_NEGATIVE_LABELS = ['No', 'Fail', 'Invalid', 'Error', 'Exit', 'Rejected'];

function isDecisionNode(node: Node): boolean {
  const nodeType = (node.type || '').toLowerCase();
  const nodeLabel = (node.data?.label || '').toLowerCase();
  
  return DECISION_NODE_TYPES.some(type => 
    nodeType.includes(type) || nodeLabel.includes(type)
  );
}

function isTerminationNode(node: Node): boolean {
  const nodeType = (node.type || '').toLowerCase();
  const nodeLabel = (node.data?.label || '').toLowerCase();
  
  return TERMINATION_NODE_TYPES.some(type => 
    nodeType.includes(type) || nodeLabel.includes(type)
  );
}

function isSupportNode(node: Node): boolean {
  const nodeType = (node.type || '').toLowerCase();
  const nodeLabel = (node.data?.label || '').toLowerCase();
  
  return SUPPORT_NODE_TYPES.some(type => 
    nodeType.includes(type) || nodeLabel.includes(type)
  );
}

function isRetryNode(node: Node): boolean {
  const nodeType = (node.type || '').toLowerCase();
  const nodeLabel = (node.data?.label || '').toLowerCase();
  
  return RETRY_NODE_TYPES.some(type => 
    nodeType.includes(type) || nodeLabel.includes(type)
  );
}

function getOutgoingEdges(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter(edge => edge.source === nodeId);
}

function getEdgeLabels(edges: Edge[]): string[] {
  return edges
    .map(edge => edge.label?.toString() || edge.data?.label?.toString() || '')
    .filter(Boolean);
}

function normalizeLabel(label: string): string {
  return label.toLowerCase().trim();
}

function isPositiveOutcome(label: string): boolean {
  const normalized = normalizeLabel(label);
  return DEFAULT_POSITIVE_LABELS.some(pos => normalizeLabel(pos) === normalized) ||
    ['yes', 'pass', 'valid', 'success', 'continue', 'approved', 'true', 'ok', 'accept'].includes(normalized);
}

function isNegativeOutcome(label: string): boolean {
  const normalized = normalizeLabel(label);
  return DEFAULT_NEGATIVE_LABELS.some(neg => normalizeLabel(neg) === normalized) ||
    ['no', 'fail', 'invalid', 'error', 'exit', 'rejected', 'false', 'cancel', 'reject', 'deny'].includes(normalized);
}

function findComplementaryLabel(existingLabels: string[]): string {
  const normalizedLabels = existingLabels.map(normalizeLabel);
  
  const hasPositive = normalizedLabels.some(isPositiveOutcome);
  const hasNegative = normalizedLabels.some(isNegativeOutcome);
  
  if (hasPositive && !hasNegative) {
    return 'No';
  }
  if (hasNegative && !hasPositive) {
    return 'Yes';
  }
  
  return 'No';
}

/**
 * Phase 4.1: Banned placeholder labels - "Option A/B/C/D" are forbidden
 * These provide no semantic value and confuse users.
 * Instead, we use a sentinel value that signals the edge needs proper labeling.
 * The sentinel is stripped in UI display but preserved for diagnostics.
 */
const BANNED_LABEL_PATTERN = /^Option\s+[A-Z]$/i;
export const NEEDS_LABEL_SENTINEL = '{needs-label}';

export function isBannedLabel(label: string): boolean {
  return BANNED_LABEL_PATTERN.test(label.trim());
}

export function isNeedsLabelSentinel(label: string): boolean {
  return label === NEEDS_LABEL_SENTINEL;
}

function generateDefaultLabels(edgeCount: number): string[] {
  if (edgeCount === 2) {
    return ['Yes', 'No'];
  }
  
  // Phase 4.1: For >2 branches, use sentinel instead of "Option A/B/C/D"
  // Sentinel signals that the edge needs proper labeling by AI or user
  console.log('[DecisionRepair] Using needs-label sentinel for', edgeCount, 'edges (banning Option A/B/C/D)');
  return Array.from({ length: edgeCount }, () => NEEDS_LABEL_SENTINEL);
}

function generateUniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function detectIncompleteDecisions(
  nodes: Node[],
  edges: Edge[]
): DecisionIssue[] {
  const issues: DecisionIssue[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  for (const node of nodes) {
    if (!isDecisionNode(node)) continue;
    
    const outgoingEdges = getOutgoingEdges(node.id, edges);
    const existingLabels = getEdgeLabels(outgoingEdges);
    
    if (outgoingEdges.length < 2) {
      const missingOutcomes: string[] = [];
      if (outgoingEdges.length === 0) {
        missingOutcomes.push('Yes', 'No');
      } else if (outgoingEdges.length === 1) {
        missingOutcomes.push(findComplementaryLabel(existingLabels));
      }
      
      issues.push({
        decisionNodeId: node.id,
        issueType: 'MISSING_OUTCOME',
        existingOutcomes: existingLabels,
        missingOutcomes,
        affectedEdgeIds: outgoingEdges.map(e => e.id),
        confidence: 0.95,
      });
    }
    
    const unlabeledEdges = outgoingEdges.filter(
      edge => !edge.label && !edge.data?.label
    );
    
    if (unlabeledEdges.length > 0) {
      issues.push({
        decisionNodeId: node.id,
        issueType: 'UNLABELED_EDGES',
        existingOutcomes: existingLabels,
        missingOutcomes: [],
        affectedEdgeIds: unlabeledEdges.map(e => e.id),
        confidence: 1.0,
      });
    }
    
    const danglingEdges = outgoingEdges.filter(
      edge => !nodeMap.has(edge.target)
    );
    
    if (danglingEdges.length > 0) {
      issues.push({
        decisionNodeId: node.id,
        issueType: 'DANGLING_EDGE',
        existingOutcomes: existingLabels,
        missingOutcomes: [],
        affectedEdgeIds: danglingEdges.map(e => e.id),
        confidence: 1.0,
      });
    }
  }
  
  return issues;
}

function findFallbackTarget(nodes: Node[], preferRetry: boolean = false): Node | null {
  if (preferRetry) {
    const retryNode = nodes.find(isRetryNode);
    if (retryNode) return retryNode;
  }
  
  const supportNode = nodes.find(isSupportNode);
  if (supportNode) return supportNode;
  
  const terminationNode = nodes.find(isTerminationNode);
  if (terminationNode) return terminationNode;
  
  return null;
}

function createMinimalFallbackNode(decisionNode: Node): Node {
  const offsetX = 200;
  const offsetY = 150;
  
  return {
    id: generateUniqueId('exit'),
    type: 'process',
    position: {
      x: (decisionNode.position?.x || 0) + offsetX,
      y: (decisionNode.position?.y || 0) + offsetY,
    },
    data: {
      label: 'Exit Flow',
      description: 'Auto-generated exit point for incomplete decision branch',
      meta: {
        createdByDecisionRepair: true,
        createdAt: Date.now(),
      },
    },
  };
}

export function ensureEdgeLabels(
  edges: Edge[],
  decisionNodeId: string
): { edges: Edge[]; labelsAssigned: string[] } {
  const outgoingEdges = edges.filter(e => e.source === decisionNodeId);
  const otherEdges = edges.filter(e => e.source !== decisionNodeId);
  
  const unlabeledEdges = outgoingEdges.filter(e => !e.label && !e.data?.label);
  
  if (unlabeledEdges.length === 0) {
    return { edges, labelsAssigned: [] };
  }
  
  const existingLabels = outgoingEdges
    .filter(e => e.label || e.data?.label)
    .map(e => e.label?.toString() || e.data?.label?.toString() || '');
  
  const defaultLabels = generateDefaultLabels(outgoingEdges.length);
  
  let labelIndex = 0;
  const labelsAssigned: string[] = [];
  
  const updatedOutgoing = outgoingEdges.map(edge => {
    if (edge.label || edge.data?.label) {
      labelIndex++;
      return edge;
    }
    
    let newLabel: string;
    if (outgoingEdges.length === 2 && unlabeledEdges.length === 2) {
      newLabel = defaultLabels[labelIndex] || 'Yes';
    } else if (outgoingEdges.length === 2 && unlabeledEdges.length === 1) {
      newLabel = findComplementaryLabel(existingLabels);
    } else {
      // Phase 4.1: Use sentinel instead of "Option X" for >2 branches
      // Sentinel signals that proper labeling is needed
      newLabel = defaultLabels[labelIndex] || NEEDS_LABEL_SENTINEL;
    }
    
    labelsAssigned.push(newLabel);
    labelIndex++;
    
    return {
      ...edge,
      label: newLabel,
      data: {
        ...edge.data,
        label: newLabel,
        repairedByDecisionRepair: true,
      },
    };
  });
  
  return {
    edges: [...otherEdges, ...updatedOutgoing],
    labelsAssigned,
  };
}

export function repairDecision(
  nodes: Node[],
  edges: Edge[],
  issue: DecisionIssue
): { nodes: Node[]; edges: Edge[]; repair: DecisionRepairApplied } {
  let updatedNodes = [...nodes];
  let updatedEdges = [...edges];
  const repair: DecisionRepairApplied = {
    decisionNodeId: issue.decisionNodeId,
    issuesResolved: [issue.issueType],
    edgesAdded: 0,
    labelsAssigned: [],
    nodesCreated: [],
  };
  
  const decisionNode = nodes.find(n => n.id === issue.decisionNodeId);
  if (!decisionNode) {
    return { nodes, edges, repair };
  }
  
  switch (issue.issueType) {
    case 'UNLABELED_EDGES': {
      const labelResult = ensureEdgeLabels(updatedEdges, issue.decisionNodeId);
      updatedEdges = labelResult.edges;
      repair.labelsAssigned = labelResult.labelsAssigned;
      break;
    }
    
    case 'MISSING_OUTCOME': {
      const labelResult = ensureEdgeLabels(updatedEdges, issue.decisionNodeId);
      updatedEdges = labelResult.edges;
      repair.labelsAssigned.push(...labelResult.labelsAssigned);
      
      const outgoingEdges = getOutgoingEdges(issue.decisionNodeId, updatedEdges);
      
      if (outgoingEdges.length < 2) {
        let targetNode = findFallbackTarget(updatedNodes, true);
        
        if (!targetNode) {
          const exitNode = createMinimalFallbackNode(decisionNode);
          updatedNodes = [...updatedNodes, exitNode];
          targetNode = exitNode;
          repair.nodesCreated.push(exitNode.id);
        }
        
        const existingLabels = getEdgeLabels(outgoingEdges);
        const newLabel = findComplementaryLabel(existingLabels);
        
        const newEdge: Edge = {
          id: generateUniqueId('edge'),
          source: issue.decisionNodeId,
          target: targetNode.id,
          label: newLabel,
          data: {
            label: newLabel,
            createdByDecisionRepair: true,
          },
        };
        
        updatedEdges = [...updatedEdges, newEdge];
        repair.edgesAdded++;
        repair.labelsAssigned.push(newLabel);
      }
      break;
    }
    
    case 'DANGLING_EDGE': {
      let targetNode = findFallbackTarget(updatedNodes, false);
      
      if (!targetNode) {
        const exitNode = createMinimalFallbackNode(decisionNode);
        updatedNodes = [...updatedNodes, exitNode];
        targetNode = exitNode;
        repair.nodesCreated.push(exitNode.id);
      }
      
      updatedEdges = updatedEdges.map(edge => {
        if (issue.affectedEdgeIds.includes(edge.id)) {
          return {
            ...edge,
            target: targetNode!.id,
            data: {
              ...edge.data,
              repairedByDecisionRepair: true,
            },
          };
        }
        return edge;
      });
      break;
    }
  }
  
  return { nodes: updatedNodes, edges: updatedEdges, repair };
}

export function runDecisionRepair(
  nodes: Node[],
  edges: Edge[],
  options: { enabled?: boolean } = {}
): DecisionRepairResult {
  const { enabled = true } = options;
  
  if (!enabled) {
    return {
      nodes,
      edges,
      repairsApplied: [],
      hasChanges: false,
    };
  }
  
  const issues = detectIncompleteDecisions(nodes, edges);
  
  if (issues.length === 0) {
    return {
      nodes,
      edges,
      repairsApplied: [],
      hasChanges: false,
    };
  }
  
  let currentNodes = nodes;
  let currentEdges = edges;
  const repairsApplied: DecisionRepairApplied[] = [];
  
  const issuesByNode = new Map<string, DecisionIssue[]>();
  for (const issue of issues) {
    const existing = issuesByNode.get(issue.decisionNodeId) || [];
    existing.push(issue);
    issuesByNode.set(issue.decisionNodeId, existing);
  }
  
  for (const [nodeId, nodeIssues] of Array.from(issuesByNode.entries())) {
    const prioritized = nodeIssues.sort((a: DecisionIssue, b: DecisionIssue) => {
      const priority: Record<DecisionIssueType, number> = {
        'UNLABELED_EDGES': 0,
        'MISSING_OUTCOME': 1,
        'DANGLING_EDGE': 2,
      };
      return priority[a.issueType] - priority[b.issueType];
    });
    
    for (const issue of prioritized) {
      const result = repairDecision(currentNodes, currentEdges, issue);
      currentNodes = result.nodes;
      currentEdges = result.edges;
      
      const hasRepairs = 
        result.repair.edgesAdded > 0 ||
        result.repair.labelsAssigned.length > 0 ||
        result.repair.nodesCreated.length > 0;
      
      if (hasRepairs) {
        repairsApplied.push(result.repair);
      }
    }
  }
  
  return {
    nodes: currentNodes,
    edges: currentEdges,
    repairsApplied,
    hasChanges: repairsApplied.length > 0,
  };
}

export function isDecisionRepairNeeded(nodes: Node[], edges: Edge[]): boolean {
  const issues = detectIncompleteDecisions(nodes, edges);
  return issues.length > 0;
}

export function getRepairableIssues(nodes: Node[], edges: Edge[]): DecisionIssue[] {
  return detectIncompleteDecisions(nodes, edges);
}
