/**
 * Semantic Workflow Generator
 * 
 * Generates Kiteframe workflow nodes from Figma semantic metadata.
 * Creates a visual workflow representation of the UI elements detected in a Figma frame.
 * 
 * Usage: Select a Figma ImageNode with semantic data, click "Generate Workflow" in toolbar.
 */

import type { Node, Edge } from '../kiteframe/types';
import type { FigmaSemanticMetadata, FigmaSemanticElement } from './figmaSemanticTypes';

/**
 * Generate a unique ID for workflow nodes
 */
function generateWorkflowNodeId(): string {
  return `wf-node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Result of workflow generation
 */
export interface WorkflowGenerationResult {
  nodes: Node[];
  edges: Edge[];
  workflowGroupId: string;
}

/**
 * Generate workflow nodes from Figma semantic metadata.
 * 
 * @param semantic - The FigmaSemanticMetadata extracted from the frame
 * @param frameName - Name of the frame (used for workflow group naming)
 * @param sourceNode - The ImageNode containing the Figma frame
 * @returns WorkflowGenerationResult with nodes, edges, and workflowGroupId
 */
export function generateWorkflowFromFigmaSemantic(
  semantic: FigmaSemanticMetadata,
  frameName: string,
  sourceNode: Node
): WorkflowGenerationResult {
  const workflowGroupId = `wf-${semantic.frameId || Date.now()}`;
  
  const nodes: Node[] = [];
  const edges: Edge[] = []; // Empty for MVP - future: navigation edges
  
  // Calculate starting position to the right of the source node
  const sourceWidth = (sourceNode.style?.width as number) || sourceNode.width || 400;
  let x = sourceNode.position.x + sourceWidth + 120;
  let y = sourceNode.position.y;
  
  // Spacing between generated nodes
  const verticalSpacing = 100;
  const nodeWidth = 200;
  const nodeHeight = 80;
  
  // Filter and sort elements for workflow generation
  // Priority: headings first, then inputs, then buttons, then other elements
  const prioritizedElements = prioritizeElements(semantic.elements || []);
  
  // Limit to prevent overwhelming workflows (max 20 nodes)
  const elementsToProcess = prioritizedElements.slice(0, 20);
  
  for (const element of elementsToProcess) {
    const node = createNodeFromSemanticElement(element, { x, y }, workflowGroupId, nodeWidth, nodeHeight);
    nodes.push(node);
    y += nodeHeight + verticalSpacing;
  }
  
  // If forms were detected, add a form summary node
  if (semantic.forms && semantic.forms.length > 0) {
    const formNode = createFormSummaryNode(semantic.forms[0], { x, y }, workflowGroupId, nodeWidth);
    nodes.push(formNode);
  }
  
  return { nodes, edges, workflowGroupId };
}

/**
 * Prioritize elements for workflow display
 * Order: headings → inputs → buttons → links → other
 */
function prioritizeElements(elements: FigmaSemanticElement[]): FigmaSemanticElement[] {
  const priority: Record<string, number> = {
    'heading': 1,
    'input': 2,
    'button': 3,
    'link': 4,
    'checkbox': 5,
    'radio': 5,
    'label': 6,
    'section': 7,
    'text': 8,
    'icon': 9,
    'image': 10,
  };
  
  return [...elements].sort((a, b) => {
    const aPriority = priority[a.type] || 99;
    const bPriority = priority[b.type] || 99;
    return aPriority - bPriority;
  });
}

/**
 * Create a Kiteframe node from a semantic element
 */
function createNodeFromSemanticElement(
  element: FigmaSemanticElement,
  position: { x: number; y: number },
  workflowGroupId: string,
  width: number,
  height: number
): Node {
  const baseData = {
    label: element.text || element.name || element.type,
    description: element.text && element.name !== element.text ? element.name : undefined,
    semanticType: element.type,
    figmaElementId: element.id,
    workflowGroupId,
  };
  
  const commonProps = {
    id: generateWorkflowNodeId(),
    position,
    draggable: true,
    selectable: true,
    showHandles: true,
    style: { width, height },
  };
  
  switch (element.type) {
    case 'heading':
      return {
        ...commonProps,
        type: 'basic',
        data: {
          ...baseData,
          colors: {
            headerBackground: '#4f46e5',
            bodyBackground: '#eef2ff',
            headerTextColor: '#ffffff',
          },
        },
      };
    
    case 'button':
      return {
        ...commonProps,
        type: 'basic',
        data: {
          ...baseData,
          colors: {
            headerBackground: element.isPrimaryAction ? '#059669' : '#6366f1',
            bodyBackground: element.isPrimaryAction ? '#d1fae5' : '#e0e7ff',
            headerTextColor: '#ffffff',
          },
        },
      };
    
    case 'input':
      return {
        ...commonProps,
        type: 'basic',
        data: {
          ...baseData,
          description: element.isRequiredField ? 'Required field' : undefined,
          colors: {
            headerBackground: '#0891b2',
            bodyBackground: '#cffafe',
            headerTextColor: '#ffffff',
          },
        },
      };
    
    case 'link':
      return {
        ...commonProps,
        type: 'basic',
        data: {
          ...baseData,
          colors: {
            headerBackground: '#7c3aed',
            bodyBackground: '#ede9fe',
            headerTextColor: '#ffffff',
          },
        },
      };
    
    case 'checkbox':
    case 'radio':
      return {
        ...commonProps,
        type: 'basic',
        data: {
          ...baseData,
          colors: {
            headerBackground: '#0d9488',
            bodyBackground: '#ccfbf1',
            headerTextColor: '#ffffff',
          },
        },
      };
    
    case 'section':
      return {
        ...commonProps,
        type: 'basic',
        data: {
          ...baseData,
          colors: {
            headerBackground: '#475569',
            bodyBackground: '#f1f5f9',
            headerTextColor: '#ffffff',
          },
        },
      };
    
    case 'label':
    case 'text':
    default:
      return {
        ...commonProps,
        type: 'basic',
        data: {
          ...baseData,
          colors: {
            headerBackground: '#64748b',
            bodyBackground: '#f8fafc',
            headerTextColor: '#ffffff',
          },
        },
      };
  }
}

/**
 * Create a form summary node from detected form candidates
 */
function createFormSummaryNode(
  form: { id: string; name: string; fieldIds: string[]; submitButtonIds: string[] },
  position: { x: number; y: number },
  workflowGroupId: string,
  width: number
): Node {
  return {
    id: generateWorkflowNodeId(),
    type: 'basic',
    position,
    draggable: true,
    selectable: true,
    showHandles: true,
    style: { width, height: 100 },
    data: {
      label: `Form: ${form.name}`,
      description: `${form.fieldIds.length} fields, ${form.submitButtonIds.length} submit button(s)`,
      semanticType: 'form',
      figmaElementId: form.id,
      workflowGroupId,
      colors: {
        headerBackground: '#ea580c',
        bodyBackground: '#fff7ed',
        headerTextColor: '#ffffff',
      },
    },
  };
}
