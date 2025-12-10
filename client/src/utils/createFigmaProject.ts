import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import type { FigmaFrame } from '@/lib/integration/figmaApi';

export interface WorkflowData {
  nodes: Node[];
  edges: Edge[];
  canvasObjects?: CanvasObject[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface FigmaFrameWithThumbnail {
  frame: FigmaFrame;
  thumbnailUrl: string | null;
}

function generateId(): string {
  return `figma-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function buildFigmaFrameWorkflow(
  framesWithThumbnails: FigmaFrameWithThumbnail[],
  startPosition: { x: number; y: number } = { x: 100, y: 100 },
  spacing: number = 50
): WorkflowData {
  const nodes: Node[] = [];
  let currentX = startPosition.x;

  for (const { frame, thumbnailUrl } of framesWithThumbnails) {
    const nodeWidth = Math.min(frame.width, 800);
    const nodeHeight = Math.min(frame.height, 600);
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
        sourceType: 'url',
        figmaId: frame.id,
        figmaType: frame.type,
        figmaPageName: frame.pageName,
        originalWidth: frame.width,
        originalHeight: frame.height,
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
  spacing: number = 50
): Node[] {
  const maxX = existingNodes.reduce((max, n) => Math.max(max, n.position.x + ((n.style as any)?.width || 200)), 0);
  
  const { nodes } = buildFigmaFrameWorkflow(
    framesWithThumbnails,
    { x: maxX + spacing, y: 100 },
    spacing
  );

  return nodes;
}
