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
}
