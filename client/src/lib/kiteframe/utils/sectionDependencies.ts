import type { Node, Edge } from '../types';

export interface SectionDependency {
  sectionId: string;
  nodeTypes: string[];
  edgePatterns: ('entry' | 'exit' | 'condition' | 'error' | 'all')[];
  includeLabels: boolean;
  includeData: boolean;
}

export const SECTION_DEPENDENCIES: SectionDependency[] = [
  {
    sectionId: 'overview',
    nodeTypes: ['*'],
    edgePatterns: ['all'],
    includeLabels: true,
    includeData: false,
  },
  {
    sectionId: 'requirements',
    nodeTypes: ['input', 'process', 'output'],
    edgePatterns: ['all'],
    includeLabels: true,
    includeData: true,
  },
  {
    sectionId: 'user-flow',
    nodeTypes: ['*'],
    edgePatterns: ['entry', 'exit', 'all'],
    includeLabels: true,
    includeData: false,
  },
  {
    sectionId: 'inputs-outputs',
    nodeTypes: ['input', 'output'],
    edgePatterns: ['entry', 'exit'],
    includeLabels: true,
    includeData: true,
  },
  {
    sectionId: 'failure-scenarios',
    nodeTypes: ['condition', 'output'],
    edgePatterns: ['condition', 'error'],
    includeLabels: true,
    includeData: true,
  },
  {
    sectionId: 'recovery-fallback',
    nodeTypes: ['condition', 'process'],
    edgePatterns: ['error', 'condition'],
    includeLabels: true,
    includeData: true,
  },
  {
    sectionId: 'operational-risks',
    nodeTypes: ['ai', 'process', 'condition'],
    edgePatterns: ['all'],
    includeLabels: true,
    includeData: true,
  },
  {
    sectionId: 'acceptance-criteria',
    nodeTypes: ['input', 'output', 'condition'],
    edgePatterns: ['entry', 'exit'],
    includeLabels: true,
    includeData: true,
  },
];

function matchesNodeType(nodeType: string, patterns: string[]): boolean {
  if (patterns.includes('*')) return true;
  return patterns.includes(nodeType);
}

function getEdgePattern(edge: Edge, nodes: Node[]): 'entry' | 'exit' | 'condition' | 'error' | 'normal' {
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);
  
  const hasNoIncoming = !nodes.some(n => n.id !== edge.source);
  if (hasNoIncoming && sourceNode) return 'entry';
  
  const hasNoOutgoing = !nodes.some(n => n.id !== edge.target);
  if (hasNoOutgoing && targetNode) return 'exit';
  
  if (sourceNode?.type === 'condition') return 'condition';
  
  const label = edge.label?.toLowerCase() || '';
  if (label.includes('error') || label.includes('fail') || label.includes('no')) {
    return 'error';
  }
  
  return 'normal';
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

export function computeSectionHash(
  sectionId: string,
  nodes: Node[],
  edges: Edge[]
): string {
  const dependency = SECTION_DEPENDENCIES.find(d => d.sectionId === sectionId);
  if (!dependency) {
    return simpleHash(JSON.stringify({ nodes: nodes.map(n => n.id), edges: edges.map(e => e.id) }));
  }

  const relevantNodes = nodes.filter(n => matchesNodeType(n.type || 'default', dependency.nodeTypes));
  
  const relevantEdges = edges.filter(e => {
    if (dependency.edgePatterns.includes('all')) return true;
    const pattern = getEdgePattern(e, nodes);
    return dependency.edgePatterns.includes(pattern as any);
  });

  const nodeData = relevantNodes.map(n => ({
    id: n.id,
    type: n.type,
    label: dependency.includeLabels ? (n.data?.label || '') : '',
    data: dependency.includeData ? extractRelevantData(n) : {},
  })).sort((a, b) => a.id.localeCompare(b.id));

  const edgeData = relevantEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: dependency.includeLabels ? (e.label || '') : '',
  })).sort((a, b) => a.id.localeCompare(b.id));

  return simpleHash(JSON.stringify({ nodes: nodeData, edges: edgeData }));
}

function extractRelevantData(node: Node): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (node.data) {
    if (node.data.description) data.description = node.data.description;
    if (node.data.content) data.content = node.data.content;
    if (node.data.fields) data.fields = node.data.fields;
    if (node.data.conditions) data.conditions = node.data.conditions;
    if (node.data.inputs) data.inputs = node.data.inputs;
    if (node.data.outputs) data.outputs = node.data.outputs;
  }
  return data;
}

export interface SectionHashMap {
  [sectionId: string]: string;
}

export function computeAllSectionHashes(nodes: Node[], edges: Edge[]): SectionHashMap {
  const hashes: SectionHashMap = {};
  SECTION_DEPENDENCIES.forEach(dep => {
    hashes[dep.sectionId] = computeSectionHash(dep.sectionId, nodes, edges);
  });
  return hashes;
}

export interface StaleSectionInfo {
  sectionId: string;
  isStale: boolean;
  storedHash: string | null;
  currentHash: string;
}

export function detectStaleSections(
  storedHashes: SectionHashMap | undefined,
  currentHashes: SectionHashMap
): StaleSectionInfo[] {
  if (!storedHashes) {
    return Object.keys(currentHashes).map(sectionId => ({
      sectionId,
      isStale: false,
      storedHash: null,
      currentHash: currentHashes[sectionId],
    }));
  }

  return Object.keys(currentHashes).map(sectionId => {
    const storedHash = storedHashes[sectionId] || null;
    const currentHash = currentHashes[sectionId];
    return {
      sectionId,
      isStale: storedHash !== null && storedHash !== currentHash,
      storedHash,
      currentHash,
    };
  });
}

const SECTION_HASH_STORAGE_PREFIX = 'section-hashes-';

export function loadSectionHashes(projectId: string, workflowId: string): SectionHashMap | null {
  const key = `${SECTION_HASH_STORAGE_PREFIX}${projectId}-${workflowId}`;
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function saveSectionHashes(projectId: string, workflowId: string, hashes: SectionHashMap): void {
  const key = `${SECTION_HASH_STORAGE_PREFIX}${projectId}-${workflowId}`;
  localStorage.setItem(key, JSON.stringify(hashes));
}
