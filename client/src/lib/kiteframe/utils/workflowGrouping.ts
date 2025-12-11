import type { Node, Edge } from '../types';
import { computeWorkflowHash as computeHash, getStoredHash, storeHash, isWorkflowStale } from './semanticHash';

export interface WorkflowGroup {
  id: string;
  name: string;
  rootNodeId: string;
  nodeIds: string[];
  edgeIds: string[];
  nodes: Node[];
  edges: Edge[];
  hash: string;
}

export function groupWorkflows(nodes: Node[], edges: Edge[]): WorkflowGroup[] {
  if (nodes.length === 0) return [];

  const nodeIdSet = new Set(nodes.map(n => n.id));
  
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach(n => adjacency.set(n.id, new Set()));
  
  edges.forEach(e => {
    if (nodeIdSet.has(e.source) && nodeIdSet.has(e.target)) {
      adjacency.get(e.source)?.add(e.target);
      adjacency.get(e.target)?.add(e.source);
    }
  });

  const visited = new Set<string>();
  const groups: WorkflowGroup[] = [];

  function dfs(startId: string): string[] {
    const component: string[] = [];
    const stack = [startId];
    
    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      component.push(nodeId);
      
      const neighbors = adjacency.get(nodeId);
      if (neighbors) {
        neighbors.forEach(neighbor => {
          if (!visited.has(neighbor)) {
            stack.push(neighbor);
          }
        });
      }
    }
    
    return component;
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  nodes.forEach(node => {
    if (visited.has(node.id)) return;
    
    const componentNodeIds = dfs(node.id);
    
    let rootNodeId = componentNodeIds[0];
    let minSum = Infinity;
    
    componentNodeIds.forEach(nodeId => {
      const n = nodeMap.get(nodeId);
      if (n) {
        const sum = n.position.x + n.position.y;
        if (sum < minSum) {
          minSum = sum;
          rootNodeId = nodeId;
        }
      }
    });

    const componentEdges = edges
      .filter(e => componentNodeIds.includes(e.source) && componentNodeIds.includes(e.target));
    const componentEdgeIds = componentEdges.map(e => e.id);
    
    const componentNodes = componentNodeIds.map(id => nodeMap.get(id)!).filter(Boolean);

    const rootNode = nodeMap.get(rootNodeId);
    const defaultName = rootNode?.data?.label || rootNode?.data?.name || `Workflow ${groups.length + 1}`;
    const hash = computeHash(componentNodes, componentEdges);

    groups.push({
      id: `workflow-${rootNodeId}`,
      name: defaultName,
      rootNodeId,
      nodeIds: componentNodeIds,
      edgeIds: componentEdgeIds,
      nodes: componentNodes,
      edges: componentEdges,
      hash,
    });
  });

  return groups.sort((a, b) => {
    const nodeA = nodeMap.get(a.rootNodeId);
    const nodeB = nodeMap.get(b.rootNodeId);
    if (!nodeA || !nodeB) return 0;
    const sumA = nodeA.position.x + nodeA.position.y;
    const sumB = nodeB.position.x + nodeB.position.y;
    return sumA - sumB;
  });
}

export function extractSemanticNodeData(node: Node): object {
  return {
    id: node.id,
    type: node.type,
    label: node.data?.label || node.data?.name || '',
    text: node.data?.text || '',
    fields: node.data?.fields || [],
  };
}

export function computeWorkflowHash(nodes: Node[], edges: Edge[]): string {
  return computeHash(nodes, edges);
}

export function checkWorkflowStale(projectId: string, workflowId: string, nodes: Node[], edges: Edge[]): boolean {
  return isWorkflowStale(projectId, workflowId, nodes, edges);
}

export function saveWorkflowHash(projectId: string, workflowId: string, nodes: Node[], edges: Edge[]): void {
  const hash = computeHash(nodes, edges);
  storeHash(projectId, workflowId, hash);
}

export { getStoredHash, storeHash, isWorkflowStale } from './semanticHash';
