import type { Node, Edge } from '../types';
import { extractSemanticNodeData, extractSemanticEdgeData } from './semanticHash';
import { normalizeNodesForExperiment, markGeneratedEdgesAsPreview } from './experimentNormalizer';

export interface SemanticNode {
  id: string;
  type: string;
  label: string;
  description?: string;
  data: Record<string, unknown>;
}

export interface SemanticEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
}

export interface FormField {
  nodeId: string;
  nodeName: string;
  fields: Array<{
    name: string;
    type: string;
    required?: boolean;
  }>;
}

export interface ScreenReference {
  nodeId: string;
  name: string;
  url?: string;
  type: 'image' | 'figma' | 'webview';
}

export interface SemanticWorkflowModel {
  workflowId: string;
  name: string;
  nodeCount: number;
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  forms: FormField[];
  screens: ScreenReference[];
  primaryActions: string[];
  errorPaths: string[];
  assumptions: string[];
  entryPoints: string[];
  exitPoints: string[];
}

function findEntryPoints(nodes: Node[], edges: Edge[]): string[] {
  const targetIds = new Set(edges.map(e => e.target));
  return nodes
    .filter(n => !targetIds.has(n.id))
    .map(n => n.data?.label || n.type || n.id);
}

function findExitPoints(nodes: Node[], edges: Edge[]): string[] {
  const sourceIds = new Set(edges.map(e => e.source));
  return nodes
    .filter(n => !sourceIds.has(n.id))
    .map(n => n.data?.label || n.type || n.id);
}

function extractForms(nodes: Node[]): FormField[] {
  const forms: FormField[] = [];
  
  for (const node of nodes) {
    if (node.type === 'form' || node.data?.fields) {
      const fields = node.data?.fields || [];
      forms.push({
        nodeId: node.id,
        nodeName: node.data?.label || 'Form',
        fields: fields.map((f: any) => ({
          name: f.name || f.label || 'field',
          type: f.type || 'text',
          required: f.required
        }))
      });
    }
  }
  
  return forms;
}

function extractScreens(nodes: Node[]): ScreenReference[] {
  const screens: ScreenReference[] = [];
  
  for (const node of nodes) {
    if (node.type === 'image' || node.type === 'webview' || node.data?.imageUrl) {
      screens.push({
        nodeId: node.id,
        name: node.data?.label || 'Screen',
        url: node.data?.imageUrl || node.data?.url,
        type: node.type === 'webview' ? 'webview' : 
              node.data?.sourceType === 'figma' ? 'figma' : 'image'
      });
    }
  }
  
  return screens;
}

function extractPrimaryActions(nodes: Node[], edges: Edge[]): string[] {
  const actions: string[] = [];
  
  for (const node of nodes) {
    if (node.type === 'process' || node.type === 'action' || node.type === 'ai') {
      const label = node.data?.label;
      if (label) actions.push(label);
    }
  }
  
  for (const edge of edges) {
    if (edge.label) {
      actions.push(edge.label);
    }
  }
  
  return Array.from(new Set(actions));
}

function extractErrorPaths(nodes: Node[], edges: Edge[]): string[] {
  const errorPaths: string[] = [];
  
  for (const node of nodes) {
    if (node.type === 'condition') {
      const noEdge = edges.find(e => 
        e.source === node.id && 
        (e.label?.toLowerCase().includes('no') || 
         e.label?.toLowerCase().includes('error') ||
         e.label?.toLowerCase().includes('fail'))
      );
      if (noEdge) {
        const targetNode = nodes.find(n => n.id === noEdge.target);
        errorPaths.push(`${node.data?.label || 'Condition'} → ${targetNode?.data?.label || 'Error'}`);
      }
    }
  }
  
  return errorPaths;
}

export function extractSemanticWorkflowModel(
  workflowId: string,
  workflowName: string,
  nodes: Node[],
  edges: Edge[],
  options?: { includeSpeculative?: boolean }
): SemanticWorkflowModel {
  // Normalize nodes and edges to ensure experiment-aware data (handles legacy wildcard payloads)
  const normalizedNodes = normalizeNodesForExperiment(nodes, workflowId);
  const normalizedEdges = markGeneratedEdgesAsPreview(edges);
  
  // Filter out speculative nodes and wildcard/experiment nodes by default (they're not committed to the workflow)
  const includeSpeculative = options?.includeSpeculative ?? false;
  const filteredNodes = normalizedNodes.filter(node => {
    // Always filter out wildcard/experiment nodes from semantic model - they're just UI containers
    if (node.type === 'wildcard' || node.type === 'experiment') return false;
    // Filter out speculative nodes unless explicitly included (check both meta.speculative and data.ui.preview)
    if (!includeSpeculative && node.meta?.speculative) return false;
    if (!includeSpeculative && node.data?.ui?.preview === true) return false;
    return true;
  });
  const filteredEdges = normalizedEdges.filter(edge => {
    // Filter out speculative edges
    if (!includeSpeculative && edge.meta?.speculative) return false;
    // Filter out edges connected to filtered-out nodes
    const sourceExists = filteredNodes.some(n => n.id === edge.source);
    const targetExists = filteredNodes.some(n => n.id === edge.target);
    return sourceExists && targetExists;
  });
  
  const semanticNodes: SemanticNode[] = filteredNodes.map(node => {
    const extracted = extractSemanticNodeData(node);
    return {
      id: extracted.id,
      type: extracted.type,
      label: extracted.label,
      description: node.data?.description,
      data: extracted.data
    };
  });
  
  const semanticEdges: SemanticEdge[] = filteredEdges.map(edge => {
    const extracted = extractSemanticEdgeData(edge);
    return {
      id: extracted.id,
      source: extracted.source,
      target: extracted.target,
      label: extracted.label,
      type: extracted.type
    };
  });
  
  return {
    workflowId,
    name: workflowName,
    nodeCount: filteredNodes.length,
    nodes: semanticNodes,
    edges: semanticEdges,
    forms: extractForms(filteredNodes),
    screens: extractScreens(filteredNodes),
    primaryActions: extractPrimaryActions(filteredNodes, filteredEdges),
    errorPaths: extractErrorPaths(filteredNodes, filteredEdges),
    assumptions: [],
    entryPoints: findEntryPoints(filteredNodes, filteredEdges),
    exitPoints: findExitPoints(filteredNodes, filteredEdges)
  };
}
