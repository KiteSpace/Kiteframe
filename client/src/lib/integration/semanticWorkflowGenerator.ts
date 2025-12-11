/**
 * Semantic Workflow Generator (Option 3: Full Semantic Engine)
 * 
 * Generates Kiteframe workflow nodes from Figma semantic metadata.
 * Creates one Basic node per logical "screen/step" detected in the Figma frame.
 * 
 * Usage: Select a Figma ImageNode with semantic data, click "Generate Workflow" in toolbar.
 */

import type { Node, Edge } from '../kiteframe/types';
import type { FigmaSemanticMetadata, FigmaScreenStep, FigmaWorkflowGraph } from './figmaSemanticTypes';
import { buildWorkflowGraphFromSemantic } from './figmaWorkflowGraphBuilder';

const NODE_HEIGHT = 120;
const NODE_WIDTH = 220;
const VERTICAL_SPACING = 50;
const HORIZONTAL_OFFSET = 100;

function generateNodeId(): string {
  return `wf-node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateEdgeId(): string {
  return `wf-edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface WorkflowGenerationResult {
  nodes: Node[];
  edges: Edge[];
  workflowGroupId: string;
  workflowName: string;
}

export function generateWorkflowFromFigmaImageNode(
  sourceImageNode: Node
): WorkflowGenerationResult | null {
  if (sourceImageNode.type !== 'image') {
    return null;
  }
  
  const semantic = sourceImageNode.data?.figmaSemantic as FigmaSemanticMetadata | undefined;
  if (!semantic) {
    return null;
  }
  
  let graph = semantic.workflowGraph;
  if (!graph) {
    graph = buildWorkflowGraphFromSemantic(
      semantic,
      semantic.frameId || sourceImageNode.data?.figmaId || sourceImageNode.id,
      semantic.frameName || sourceImageNode.data?.label || 'Figma Frame',
      semantic.pageName || sourceImageNode.data?.figmaPageName
    );
    semantic.workflowGraph = graph;
  }
  
  const workflowGroupId = `wf-${graph.frameId || Date.now()}`;
  
  const sourceWidth = (sourceImageNode.style?.width as number) || sourceImageNode.width || 400;
  const startX = sourceImageNode.position.x + sourceWidth + HORIZONTAL_OFFSET;
  const startY = sourceImageNode.position.y;
  
  const stepIdToNodeId = new Map<string, string>();
  const nodes: Node[] = [];
  
  for (let i = 0; i < graph.steps.length; i++) {
    const step = graph.steps[i];
    const nodeId = generateNodeId();
    stepIdToNodeId.set(step.id, nodeId);
    
    const node = createBasicNodeFromStep(
      step,
      nodeId,
      {
        x: startX,
        y: startY + i * (NODE_HEIGHT + VERTICAL_SPACING),
      },
      workflowGroupId,
      graph
    );
    nodes.push(node);
  }
  
  const edges: Edge[] = [];
  const edgeKeys = new Set<string>();
  
  for (const edgeHint of graph.edges) {
    const sourceNodeId = stepIdToNodeId.get(edgeHint.sourceStepId);
    const targetNodeId = stepIdToNodeId.get(edgeHint.targetStepId);
    
    if (!sourceNodeId || !targetNodeId) continue;
    
    const key = `${sourceNodeId}->${targetNodeId}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    
    edges.push({
      id: generateEdgeId(),
      source: sourceNodeId,
      target: targetNodeId,
      type: 'smoothstep',
      label: edgeHint.label,
      data: {
        reason: edgeHint.reason,
        workflowGroupId,
      },
    });
  }
  
  return {
    nodes,
    edges,
    workflowGroupId,
    workflowName: graph.frameName || 'Figma Workflow',
  };
}

function createBasicNodeFromStep(
  step: FigmaScreenStep,
  nodeId: string,
  position: { x: number; y: number },
  workflowGroupId: string,
  graph: FigmaWorkflowGraph
): Node {
  let description = step.description || step.subtitle || '';
  
  if (step.primaryActions.length > 0) {
    const actionsText = step.primaryActions.slice(0, 2).join(', ');
    if (description) {
      description += ` • Actions: ${actionsText}`;
    } else {
      description = `Actions: ${actionsText}`;
    }
  }
  
  return {
    id: nodeId,
    type: 'basic',
    position,
    draggable: true,
    selectable: true,
    showHandles: true,
    style: { width: NODE_WIDTH, height: NODE_HEIGHT },
    data: {
      label: step.title,
      description: description || undefined,
      figmaSource: {
        frameId: graph.frameId,
        stepId: step.id,
        pageName: graph.pageName,
      },
      workflowGroupId,
      colors: getStepColors(step),
    },
  };
}

function getStepColors(step: FigmaScreenStep): {
  headerBackground: string;
  bodyBackground: string;
  headerTextColor: string;
} {
  if (step.primaryActions.length > 0) {
    const hasSubmit = step.primaryActions.some(a => 
      /submit|save|confirm|send|create/i.test(a)
    );
    if (hasSubmit) {
      return {
        headerBackground: '#059669',
        bodyBackground: '#d1fae5',
        headerTextColor: '#ffffff',
      };
    }
    
    const hasNext = step.primaryActions.some(a => 
      /next|continue|proceed|start/i.test(a)
    );
    if (hasNext) {
      return {
        headerBackground: '#2563eb',
        bodyBackground: '#dbeafe',
        headerTextColor: '#ffffff',
      };
    }
  }
  
  if (step.secondaryActions.length > 0) {
    const hasBack = step.secondaryActions.some(a => 
      /back|cancel|return|previous/i.test(a)
    );
    if (hasBack) {
      return {
        headerBackground: '#64748b',
        bodyBackground: '#f1f5f9',
        headerTextColor: '#ffffff',
      };
    }
  }
  
  const titleLower = step.title.toLowerCase();
  if (/login|sign in|authentication/i.test(titleLower)) {
    return {
      headerBackground: '#7c3aed',
      bodyBackground: '#ede9fe',
      headerTextColor: '#ffffff',
    };
  }
  if (/register|sign up|create account/i.test(titleLower)) {
    return {
      headerBackground: '#0891b2',
      bodyBackground: '#cffafe',
      headerTextColor: '#ffffff',
    };
  }
  if (/dashboard|home|main/i.test(titleLower)) {
    return {
      headerBackground: '#4f46e5',
      bodyBackground: '#eef2ff',
      headerTextColor: '#ffffff',
    };
  }
  if (/settings|preferences|config/i.test(titleLower)) {
    return {
      headerBackground: '#475569',
      bodyBackground: '#f8fafc',
      headerTextColor: '#ffffff',
    };
  }
  if (/success|complete|done|thank/i.test(titleLower)) {
    return {
      headerBackground: '#16a34a',
      bodyBackground: '#dcfce7',
      headerTextColor: '#ffffff',
    };
  }
  if (/error|fail|warning/i.test(titleLower)) {
    return {
      headerBackground: '#dc2626',
      bodyBackground: '#fee2e2',
      headerTextColor: '#ffffff',
    };
  }
  
  return {
    headerBackground: '#3b82f6',
    bodyBackground: '#eff6ff',
    headerTextColor: '#ffffff',
  };
}

export function generateWorkflowFromFigmaSemantic(
  semantic: FigmaSemanticMetadata,
  frameName: string,
  sourceNode: Node
): WorkflowGenerationResult {
  const result = generateWorkflowFromFigmaImageNode(sourceNode);
  
  if (result) {
    return result;
  }
  
  const workflowGroupId = `wf-${semantic.frameId || Date.now()}`;
  const graph = buildWorkflowGraphFromSemantic(
    semantic,
    semantic.frameId || sourceNode.id,
    frameName,
    semantic.pageName
  );
  
  const sourceWidth = (sourceNode.style?.width as number) || sourceNode.width || 400;
  const startX = sourceNode.position.x + sourceWidth + HORIZONTAL_OFFSET;
  const startY = sourceNode.position.y;
  
  const stepIdToNodeId = new Map<string, string>();
  const nodes: Node[] = [];
  
  for (let i = 0; i < graph.steps.length; i++) {
    const step = graph.steps[i];
    const nodeId = generateNodeId();
    stepIdToNodeId.set(step.id, nodeId);
    
    const node = createBasicNodeFromStep(
      step,
      nodeId,
      {
        x: startX,
        y: startY + i * (NODE_HEIGHT + VERTICAL_SPACING),
      },
      workflowGroupId,
      graph
    );
    nodes.push(node);
  }
  
  const edges: Edge[] = [];
  const edgeKeys = new Set<string>();
  
  for (const edgeHint of graph.edges) {
    const sourceNodeId = stepIdToNodeId.get(edgeHint.sourceStepId);
    const targetNodeId = stepIdToNodeId.get(edgeHint.targetStepId);
    
    if (!sourceNodeId || !targetNodeId) continue;
    
    const key = `${sourceNodeId}->${targetNodeId}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    
    edges.push({
      id: generateEdgeId(),
      source: sourceNodeId,
      target: targetNodeId,
      type: 'smoothstep',
      label: edgeHint.label,
      data: {
        reason: edgeHint.reason,
        workflowGroupId,
      },
    });
  }
  
  return {
    nodes,
    edges,
    workflowGroupId,
    workflowName: graph.frameName || frameName,
  };
}
