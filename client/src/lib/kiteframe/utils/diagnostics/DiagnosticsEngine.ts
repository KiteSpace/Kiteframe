import type { Node, Edge } from '../../types';
import type { DiagnosticIssue, DiagnosticType, DiagnosticSeverity, RepairInfo } from './types';
import { detectLoops, isLoopDetectionEnabled } from '@/ai/analysis/loopDetection';

interface GraphInput {
  nodes: Node[];
  edges: Edge[];
  projectId: string;
  workflowId?: string;
  repairInfo?: RepairInfo;
}

interface AdjacencyMaps {
  outgoing: Map<string, string[]>;
  incoming: Map<string, string[]>;
  nodeMap: Map<string, Node>;
}

function generateFingerprint(
  projectId: string,
  workflowId: string | undefined,
  type: DiagnosticType,
  nodeId?: string,
  edgeId?: string,
  extra?: string
): string {
  const parts = [projectId, workflowId || 'global', type, nodeId || '', edgeId || '', extra || ''];
  let hash = 0;
  const str = parts.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `diag_${Math.abs(hash).toString(36)}`;
}

function createIssue(
  input: GraphInput,
  type: DiagnosticType,
  title: string,
  description: string,
  severity: DiagnosticSeverity,
  nodeId?: string,
  edgeId?: string,
  experimentMode?: 'whatif' | 'enhancement' | 'open_exploration',
  extra?: string
): DiagnosticIssue {
  const fingerprint = generateFingerprint(input.projectId, input.workflowId, type, nodeId, edgeId, extra);
  const now = Date.now();
  
  return {
    id: fingerprint,
    projectId: input.projectId,
    workflowId: input.workflowId,
    nodeId,
    edgeId,
    type,
    title,
    description,
    severity,
    status: 'new',
    createdAt: now,
    updatedAt: now,
    fingerprint,
    recommendedAction: experimentMode ? {
      kind: 'create-experiment',
      experimentMode,
    } : { kind: 'navigate' },
  };
}

function buildAdjacencyMaps(nodes: Node[], edges: Edge[]): AdjacencyMaps {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  const nodeMap = new Map<string, Node>();
  
  for (const node of nodes) {
    nodeMap.set(node.id, node);
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }
  
  for (const edge of edges) {
    const sourceList = outgoing.get(edge.source);
    const targetList = incoming.get(edge.target);
    if (sourceList) sourceList.push(edge.target);
    if (targetList) targetList.push(edge.source);
  }
  
  return { outgoing, incoming, nodeMap };
}

function isTerminalNode(node: Node): boolean {
  const terminalTypes = ['output', 'end'];
  return terminalTypes.includes(node.type || '');
}

function isStartNode(node: Node): boolean {
  const startTypes = ['input', 'start'];
  return startTypes.includes(node.type || '');
}

function isDecisionNode(node: Node): boolean {
  const decisionTypes = ['condition', 'decision'];
  return decisionTypes.includes(node.type || '');
}

function isCanvasObject(node: Node): boolean {
  const objectTypes = ['sticky-note', 'shape', 'text'];
  return objectTypes.includes(node.type || '');
}

function findConnectedComponents(nodes: Node[], adjacency: AdjacencyMaps): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];
  
  function dfs(nodeId: string, component: string[]) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    component.push(nodeId);
    
    const outNeighbors = adjacency.outgoing.get(nodeId) || [];
    const inNeighbors = adjacency.incoming.get(nodeId) || [];
    
    for (const neighbor of [...outNeighbors, ...inNeighbors]) {
      dfs(neighbor, component);
    }
  }
  
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const component: string[] = [];
      dfs(node.id, component);
      if (component.length > 0) {
        components.push(component);
      }
    }
  }
  
  return components;
}

function detectMissingEndState(input: GraphInput, adjacency: AdjacencyMaps): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const nodes = Array.from(adjacency.nodeMap.values());
  
  const hasTerminal = nodes.some(n => isTerminalNode(n));
  if (hasTerminal) return issues;
  
  const workflowNodes = nodes.filter(n => !isCanvasObject(n));
  if (workflowNodes.length === 0) return issues;
  
  const hasAnyEdges = workflowNodes.some(n => {
    const out = adjacency.outgoing.get(n.id) || [];
    const inc = adjacency.incoming.get(n.id) || [];
    return out.length > 0 || inc.length > 0;
  });
  
  if (!hasAnyEdges && workflowNodes.length <= 1) return issues;
  
  issues.push(createIssue(
    input,
    'missing-end-state',
    'Missing end state',
    'This workflow has no terminal (output/end) node. Add an output node to complete the flow.',
    'warn',
    undefined,
    undefined,
    'whatif'
  ));
  
  return issues;
}

function detectDeadEndNodes(input: GraphInput, adjacency: AdjacencyMaps): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  
  for (const [nodeId, node] of Array.from(adjacency.nodeMap.entries())) {
    if (isTerminalNode(node) || isCanvasObject(node)) continue;
    
    const outgoing = adjacency.outgoing.get(nodeId) || [];
    const incoming = adjacency.incoming.get(nodeId) || [];
    
    if (outgoing.length === 0 && incoming.length > 0) {
      const label = (node.data as { label?: string })?.label || node.type;
      issues.push(createIssue(
        input,
        'dead-end-node',
        'Dead-end node',
        `"${label}" has no outgoing connections. It should either connect to another node or be marked as an output.`,
        'warn',
        nodeId,
        undefined,
        'whatif'
      ));
    }
  }
  
  return issues;
}

function detectDisconnectedSubgraphs(input: GraphInput, adjacency: AdjacencyMaps): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  
  const workflowNodes = Array.from(adjacency.nodeMap.values()).filter(n => !isCanvasObject(n));
  if (workflowNodes.length <= 1) return issues;
  
  const components = findConnectedComponents(workflowNodes, adjacency);
  
  if (components.length > 1) {
    const sortedComponents = components.sort((a, b) => b.length - a.length);
    
    for (let i = 1; i < sortedComponents.length; i++) {
      const component = sortedComponents[i];
      const representativeNodeId = component[0];
      const node = adjacency.nodeMap.get(representativeNodeId);
      const label = node ? ((node.data as { label?: string })?.label || node.type) : 'Unknown';
      
      issues.push(createIssue(
        input,
        'disconnected-subgraph',
        'Disconnected flow',
        `"${label}" and ${component.length - 1} other node(s) are not connected to the main workflow.`,
        'info',
        representativeNodeId,
        undefined,
        'enhancement',
        `component-${i}`
      ));
    }
  }
  
  return issues;
}

function detectOrphanDecisions(input: GraphInput, adjacency: AdjacencyMaps): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  
  for (const [nodeId, node] of Array.from(adjacency.nodeMap.entries())) {
    if (!isDecisionNode(node)) continue;
    
    const outgoing = adjacency.outgoing.get(nodeId) || [];
    
    if (outgoing.length === 1) {
      const label = (node.data as { label?: string })?.label || 'Decision';
      issues.push(createIssue(
        input,
        'orphan-decision',
        'Incomplete decision',
        `"${label}" only has one outgoing path. Decision nodes typically need at least two branches (e.g., Yes/No).`,
        'risk',
        nodeId,
        undefined,
        'whatif'
      ));
    } else if (outgoing.length === 0) {
      const incoming = adjacency.incoming.get(nodeId) || [];
      if (incoming.length > 0) {
        const label = (node.data as { label?: string })?.label || 'Decision';
        issues.push(createIssue(
          input,
          'orphan-decision',
          'Decision without paths',
          `"${label}" has no outgoing paths. Add branches for different outcomes.`,
          'risk',
          nodeId,
          undefined,
          'whatif'
        ));
      }
    }
  }
  
  return issues;
}

function findStronglyConnectedComponents(adjacency: AdjacencyMaps): string[][] {
  const nodeIds = Array.from(adjacency.nodeMap.keys());
  const index = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let currentIndex = 0;
  
  function strongConnect(nodeId: string) {
    index.set(nodeId, currentIndex);
    lowlink.set(nodeId, currentIndex);
    currentIndex++;
    stack.push(nodeId);
    onStack.add(nodeId);
    
    const neighbors = adjacency.outgoing.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!index.has(neighbor)) {
        strongConnect(neighbor);
        lowlink.set(nodeId, Math.min(lowlink.get(nodeId)!, lowlink.get(neighbor)!));
      } else if (onStack.has(neighbor)) {
        lowlink.set(nodeId, Math.min(lowlink.get(nodeId)!, index.get(neighbor)!));
      }
    }
    
    if (lowlink.get(nodeId) === index.get(nodeId)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== nodeId);
      sccs.push(scc);
    }
  }
  
  for (const nodeId of nodeIds) {
    if (!index.has(nodeId)) {
      strongConnect(nodeId);
    }
  }
  
  return sccs;
}

function hasSelfLoop(nodeId: string, adjacency: AdjacencyMaps): boolean {
  const outgoing = adjacency.outgoing.get(nodeId) || [];
  return outgoing.includes(nodeId);
}

function detectRetryWithoutCounter(input: GraphInput, adjacency: AdjacencyMaps, filteredEdges: Edge[]): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  
  if (!isLoopDetectionEnabled()) {
    return issues;
  }
  
  const result = detectLoops(
    Array.from(adjacency.nodeMap.values()),
    filteredEdges
  );
  
  for (const concern of result.concerns) {
    if (concern.type === 'retry_without_counter') {
      const firstNodeId = concern.affectedNodeIds?.[0];
      const node = firstNodeId ? adjacency.nodeMap.get(firstNodeId) : undefined;
      const label = node ? ((node.data as { label?: string })?.label || node.type) : 'Unknown';
      
      issues.push(createIssue(
        input,
        'retry-without-counter',
        'Retry without limit',
        concern.message || `"${label}" appears to be a retry pattern without a visible counter or max attempts.`,
        'warn',
        firstNodeId,
        undefined,
        'enhancement',
        concern.affectedNodeIds?.join(',')
      ));
    }
  }
  
  return issues;
}

function detectLoopsWithoutExit(input: GraphInput, adjacency: AdjacencyMaps): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const processedCycles = new Set<string>();
  
  const sccs = findStronglyConnectedComponents(adjacency);
  
  for (const scc of sccs) {
    const isSingleNodeCycle = scc.length === 1 && hasSelfLoop(scc[0], adjacency);
    if (scc.length < 2 && !isSingleNodeCycle) continue;
    
    const sccSet = new Set(scc);
    let hasExitFromScc = false;
    
    for (const nodeId of scc) {
      const node = adjacency.nodeMap.get(nodeId);
      if (node && isTerminalNode(node)) {
        hasExitFromScc = true;
        break;
      }
      
      const outNeighbors = adjacency.outgoing.get(nodeId) || [];
      for (const neighbor of outNeighbors) {
        if (!sccSet.has(neighbor)) {
          hasExitFromScc = true;
          break;
        }
      }
      if (hasExitFromScc) break;
    }
    
    if (!hasExitFromScc) {
      const cycleKey = [...scc].sort().join(',');
      if (processedCycles.has(cycleKey)) continue;
      processedCycles.add(cycleKey);
      
      const firstNodeId = scc[0];
      const node = adjacency.nodeMap.get(firstNodeId);
      const label = node ? ((node.data as { label?: string })?.label || node.type) : 'Unknown';
      
      issues.push(createIssue(
        input,
        'loop-without-exit',
        'Infinite loop detected',
        `"${label}" is part of a loop with no exit path. Add a condition or branch to break out of the cycle.`,
        'critical',
        firstNodeId,
        undefined,
        'whatif',
        cycleKey
      ));
    }
  }
  
  return issues;
}

export class DiagnosticsEngine {
  private filterSpeculative(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
    const filteredNodes = nodes.filter(n => !(n.meta as { speculative?: boolean })?.speculative);
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    return { nodes: filteredNodes, edges: filteredEdges };
  }
  
  analyze(input: GraphInput): DiagnosticIssue[] {
    const { nodes, edges } = this.filterSpeculative(input.nodes, input.edges);
    
    console.log('[DiagnosticsEngine] Analyzing workflow', {
      projectId: input.projectId,
      workflowId: input.workflowId,
      totalNodes: input.nodes.length,
      filteredNodes: nodes.length,
      speculativeNodesRemoved: input.nodes.length - nodes.length,
      totalEdges: input.edges.length,
      filteredEdges: edges.length,
      hasRepairInfo: !!input.repairInfo,
    });
    
    if (nodes.length === 0) {
      console.log('[DiagnosticsEngine] No nodes to analyze after filtering');
      return [];
    }
    
    const adjacency = buildAdjacencyMaps(nodes, edges);
    const issues: DiagnosticIssue[] = [];
    
    const nodeTypeSummary: Record<string, number> = {};
    for (const node of nodes) {
      const type = node.type || 'unknown';
      nodeTypeSummary[type] = (nodeTypeSummary[type] || 0) + 1;
    }
    console.log('[DiagnosticsEngine] Node types:', nodeTypeSummary);
    
    const missingEndIssues = detectMissingEndState(input, adjacency);
    const deadEndIssues = detectDeadEndNodes(input, adjacency);
    const disconnectedIssues = detectDisconnectedSubgraphs(input, adjacency);
    let orphanDecisionIssues = detectOrphanDecisions(input, adjacency);
    const loopIssues = detectLoopsWithoutExit(input, adjacency);
    const retryIssues = detectRetryWithoutCounter(input, adjacency, edges);
    
    if (input.repairInfo) {
      const { repairedNodeIds, repairedIssueTypes } = input.repairInfo;
      const repairedNodeSet = new Set(repairedNodeIds);
      
      orphanDecisionIssues = orphanDecisionIssues.filter(issue => {
        if (issue.nodeId && repairedNodeSet.has(issue.nodeId)) {
          console.log('[DiagnosticsEngine] Suppressing auto-repaired orphan-decision for node:', issue.nodeId);
          return false;
        }
        return true;
      });
      
      console.log('[DiagnosticsEngine] Repair suppression applied', {
        repairedNodes: repairedNodeIds.length,
        issueTypesSuppressed: Array.from(repairedIssueTypes),
      });
    }
    
    console.log('[DiagnosticsEngine] Detection results', {
      missingEndState: missingEndIssues.length,
      deadEndNodes: deadEndIssues.length,
      disconnectedSubgraphs: disconnectedIssues.length,
      orphanDecisions: orphanDecisionIssues.length,
      loopsWithoutExit: loopIssues.length,
      retryWithoutCounter: retryIssues.length,
    });
    
    issues.push(...missingEndIssues);
    issues.push(...deadEndIssues);
    issues.push(...disconnectedIssues);
    issues.push(...orphanDecisionIssues);
    issues.push(...loopIssues);
    issues.push(...retryIssues);
    
    console.log('[DiagnosticsEngine] Total issues found:', issues.length);
    
    return issues;
  }
  
  getIssuesForNode(issues: DiagnosticIssue[], nodeId: string): DiagnosticIssue[] {
    return issues.filter(i => i.nodeId === nodeId);
  }
  
  getActiveIssues(issues: DiagnosticIssue[]): DiagnosticIssue[] {
    return issues.filter(i => i.status !== 'resolved');
  }
  
  getNewIssues(issues: DiagnosticIssue[]): DiagnosticIssue[] {
    return issues.filter(i => i.status === 'new');
  }
}

export const diagnosticsEngine = new DiagnosticsEngine();
