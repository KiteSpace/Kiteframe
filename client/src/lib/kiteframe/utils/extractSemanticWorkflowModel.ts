import type { Node, Edge } from '../types';
import { extractSemanticNodeData, extractSemanticEdgeData } from './semanticHash';

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
  edges: Edge[]
): SemanticWorkflowModel {
  const semanticNodes: SemanticNode[] = nodes.map(node => {
    const extracted = extractSemanticNodeData(node);
    return {
      id: extracted.id,
      type: extracted.type,
      label: extracted.label,
      description: node.data?.description,
      data: extracted.data
    };
  });
  
  const semanticEdges: SemanticEdge[] = edges.map(edge => {
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
    nodeCount: nodes.length,
    nodes: semanticNodes,
    edges: semanticEdges,
    forms: extractForms(nodes),
    screens: extractScreens(nodes),
    primaryActions: extractPrimaryActions(nodes, edges),
    errorPaths: extractErrorPaths(nodes, edges),
    assumptions: [],
    entryPoints: findEntryPoints(nodes, edges),
    exitPoints: findExitPoints(nodes, edges)
  };
}
