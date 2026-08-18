import type { Node, Edge } from '../types';

interface SemanticNodeData {
  id: string;
  type: string;
  label: string;
  data: Record<string, unknown>;
}

interface SemanticEdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
}

export function extractSemanticNodeData(node: Node): SemanticNodeData {
  const semanticData: Record<string, unknown> = {};
  
  if (node.data) {
    if (node.data.label) semanticData.label = node.data.label;
    if (node.data.description) semanticData.description = node.data.description;
    if (node.data.content) semanticData.content = node.data.content;
    if (node.data.fields) semanticData.fields = node.data.fields;
    if (node.data.columns) semanticData.columns = node.data.columns;
    if (node.data.rows) semanticData.rows = node.data.rows;
    if (node.data.inputs) semanticData.inputs = node.data.inputs;
    if (node.data.outputs) semanticData.outputs = node.data.outputs;
    if (node.data.conditions) semanticData.conditions = node.data.conditions;
    if (node.data.actions) semanticData.actions = node.data.actions;
    if (node.data.prompt) semanticData.prompt = node.data.prompt;
    if (node.data.url) semanticData.url = node.data.url;
  }
  
  return {
    id: node.id,
    type: node.type || 'default',
    label: node.data?.label || '',
    data: semanticData
  };
}

export function extractSemanticEdgeData(edge: Edge): SemanticEdgeData {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: edge.type
  };
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function computeWorkflowHash(nodes: Node[], edges: Edge[]): string {
  const semanticNodes = nodes
    .map(extractSemanticNodeData)
    .sort((a, b) => a.id.localeCompare(b.id));
  
  const semanticEdges = edges
    .map(extractSemanticEdgeData)
    .sort((a, b) => a.id.localeCompare(b.id));
  
  const payload = JSON.stringify({ nodes: semanticNodes, edges: semanticEdges });
  return simpleHash(payload);
}

const HASH_STORAGE_PREFIX = 'hash-';

export function getStoredHash(projectId: string, workflowId: string): string | null {
  const key = `${HASH_STORAGE_PREFIX}${projectId}-${workflowId}`;
  return localStorage.getItem(key);
}

export function storeHash(projectId: string, workflowId: string, hash: string): void {
  const key = `${HASH_STORAGE_PREFIX}${projectId}-${workflowId}`;
  localStorage.setItem(key, hash);
}

export function isWorkflowStale(projectId: string, workflowId: string, nodes: Node[], edges: Edge[]): boolean {
  const storedHash = getStoredHash(projectId, workflowId);
  if (!storedHash) return false;
  
  const currentHash = computeWorkflowHash(nodes, edges);
  return storedHash !== currentHash;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedHashUpdate(
  projectId: string, 
  workflowId: string, 
  nodes: Node[], 
  edges: Edge[],
  delay: number = 500
): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  debounceTimer = setTimeout(() => {
    const hash = computeWorkflowHash(nodes, edges);
    storeHash(projectId, workflowId, hash);
    debounceTimer = null;
  }, delay);
}
