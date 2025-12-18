import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import type { FigmaFrame } from '@/lib/integration/figmaApi';
import type { FigmaSemanticMetadata } from '@/lib/integration/figmaSemanticTypes';
import type { FigmaImportMode } from '@/components/modals/FigmaFramePicker';

export interface WorkflowData {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface FigmaFrameWithThumbnail {
  frame: FigmaFrame;
  thumbnailUrl: string | null;
  figmaSemantic?: FigmaSemanticMetadata | null;
}

export interface FigmaBuildOptions {
  importMode?: FigmaImportMode;
  figmaLastModified?: string;
}

function generateId(): string {
  return `figma-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function buildFigmaFrameWorkflow(
  framesWithThumbnails: FigmaFrameWithThumbnail[],
  startPosition: { x: number; y: number } = { x: 100, y: 100 },
  spacing: number = 50,
  figmaFileKey?: string,
  options?: FigmaBuildOptions
): WorkflowData {
  const nodes: Node[] = [];
  let currentX = startPosition.x;
  const isReferenceFrame = options?.importMode !== 'workflow';

  for (const { frame, thumbnailUrl, figmaSemantic } of framesWithThumbnails) {
    const nodeWidth = Math.min(frame.width, 800);
    const aspectRatio = frame.width / frame.height;
    
    const displayWidth = nodeWidth;
    const displayHeight = displayWidth / aspectRatio;

    const node: Node = {
      id: generateId(),
      type: 'image',
      position: { x: currentX, y: startPosition.y },
      data: {
        label: frame.name,
        src: thumbnailUrl || '',
        sourceType: 'figma-frame',
        figmaFileKey: figmaFileKey || '',
        figmaNodeId: frame.id,
        figmaNodeName: frame.name,
        isReferenceFrame,
        importedFrom: 'figma',
        figmaId: frame.id,
        figmaType: frame.type,
        figmaPageName: frame.pageName,
        originalWidth: frame.width,
        originalHeight: frame.height,
        figmaSemantic: figmaSemantic ?? null,
        figmaLastModified: options?.figmaLastModified ?? null,
      },
      style: {
        width: displayWidth,
        height: displayHeight,
      },
      draggable: true,
      selectable: true,
      showHandles: true,
    };

    nodes.push(node);
    currentX += displayWidth + spacing;
  }

  return {
    nodes,
    edges: [],
    canvasObjects: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function insertFigmaFrames(
  existingNodes: Node[],
  framesWithThumbnails: FigmaFrameWithThumbnail[],
  spacing: number = 50,
  figmaFileKey?: string,
  options?: FigmaBuildOptions
): Node[] {
  const maxX = existingNodes.reduce((max, n) => Math.max(max, n.position.x + ((n.style as any)?.width || 200)), 0);
  
  const { nodes } = buildFigmaFrameWorkflow(
    framesWithThumbnails,
    { x: maxX + spacing, y: 100 },
    spacing,
    figmaFileKey,
    options
  );

  return nodes;
}
