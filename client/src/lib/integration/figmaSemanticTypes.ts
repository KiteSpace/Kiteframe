/**
 * Figma Semantic Metadata Types
 * 
 * These types define the semantic structure extracted from Figma frame node trees.
 * Used for AI workflow generation, form extraction, and navigation inference.
 * NOT used for visual UI reconstruction.
 */

export type FigmaSemanticElementType =
  | 'heading'
  | 'text'
  | 'button'
  | 'link'
  | 'input'
  | 'label'
  | 'checkbox'
  | 'radio'
  | 'image'
  | 'icon'
  | 'section';

export interface FigmaSemanticBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaSemanticElement {
  id: string;
  type: FigmaSemanticElementType;
  name: string;
  text?: string;
  figmaNodeType: string;
  bounds: FigmaSemanticBounds;
  parentId?: string | null;
  childrenIds?: string[];
  isPrimaryAction?: boolean;
  isDisabled?: boolean;
  isRequiredField?: boolean;
}

export interface FigmaSemanticFormCandidate {
  id: string;
  name: string;
  fieldIds: string[];
  submitButtonIds: string[];
}

export interface FigmaSemanticNavigationTarget {
  elementId: string;
  label: string;
  inferredTargetName?: string;
}

/**
 * Workflow Graph Types for Option 3 Full Semantic Engine
 * 
 * These types represent the intermediate workflow graph structure
 * built from semantic elements before converting to Kiteframe nodes.
 */

export interface FigmaScreenStep {
  id: string;
  frameId: string;
  title: string;
  subtitle?: string;
  description?: string;
  bounds?: FigmaSemanticBounds;
  primaryActions: string[];
  secondaryActions: string[];
  elementIds: string[];
}

export type FigmaWorkflowEdgeReason = 
  | 'spatial-sequence' 
  | 'matching-label' 
  | 'form-submit' 
  | 'unknown';

export interface FigmaWorkflowEdgeHint {
  sourceStepId: string;
  targetStepId: string;
  reason: FigmaWorkflowEdgeReason;
  label?: string;
}

export interface FigmaWorkflowGraph {
  frameId: string;
  frameName: string;
  pageName?: string;
  steps: FigmaScreenStep[];
  edges: FigmaWorkflowEdgeHint[];
}

export interface FigmaSemanticMetadata {
  frameId: string;
  frameName: string;
  pageName: string;
  size: {
    width: number;
    height: number;
  };
  elements: FigmaSemanticElement[];
  forms: FigmaSemanticFormCandidate[];
  navigationTargets: FigmaSemanticNavigationTarget[];
  extractedAt: string;
  truncated?: boolean;
  truncationReason?: string;
  workflowGraph?: FigmaWorkflowGraph;
}
