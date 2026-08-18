import type { Node } from '../types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpaceProbeResult {
  direction: 'right' | 'left' | 'down' | 'up';
  startOffset: { x: number; y: number };
  spacing: { x: number; y: number };
  laneOffset: { x: number; y: number };
  score: number;
  fallbackUsed: boolean;
}

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 100;
const HORIZONTAL_SPACING = 280;
const VERTICAL_SPACING = 200;
const PADDING = 50;

export function getNodeRect(node: Node): Rect {
  const width = node.width || node.measuredWidth || node.style?.width || DEFAULT_NODE_WIDTH;
  const height = node.height || node.measuredHeight || node.style?.height || DEFAULT_NODE_HEIGHT;
  
  return {
    x: node.position.x,
    y: node.position.y,
    width: typeof width === 'number' ? width : DEFAULT_NODE_WIDTH,
    height: typeof height === 'number' ? height : DEFAULT_NODE_HEIGHT,
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  const aPadded = {
    x: a.x - PADDING,
    y: a.y - PADDING,
    width: a.width + PADDING * 2,
    height: a.height + PADDING * 2,
  };
  
  return !(
    aPadded.x + aPadded.width <= b.x ||
    b.x + b.width <= aPadded.x ||
    aPadded.y + aPadded.height <= b.y ||
    b.y + b.height <= aPadded.y
  );
}

export function computeOverlapArea(a: Rect, b: Rect): number {
  const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return overlapX * overlapY;
}

export function scorePlacement(candidateRects: Rect[], existingRects: Rect[]): number {
  let overlapCount = 0;
  let totalOverlapArea = 0;
  
  for (const candidate of candidateRects) {
    for (const existing of existingRects) {
      if (rectsOverlap(candidate, existing)) {
        overlapCount++;
        totalOverlapArea += computeOverlapArea(candidate, existing);
      }
    }
  }
  
  return overlapCount * 10000 + totalOverlapArea;
}

function generateCandidateRects(
  origin: { x: number; y: number },
  nodeCount: number,
  direction: 'right' | 'left' | 'down' | 'up',
  spacingMultiplier: number = 1.0
): Rect[] {
  const rects: Rect[] = [];
  const hSpacing = HORIZONTAL_SPACING * spacingMultiplier;
  const vSpacing = VERTICAL_SPACING * spacingMultiplier;
  
  for (let i = 0; i < nodeCount; i++) {
    let x = origin.x;
    let y = origin.y;
    
    switch (direction) {
      case 'right':
        x = origin.x + 300 + (i * hSpacing);
        y = origin.y + (i % 2 === 0 ? 0 : 120);
        break;
      case 'left':
        x = origin.x - 300 - (i * hSpacing);
        y = origin.y + (i % 2 === 0 ? 0 : 120);
        break;
      case 'down':
        x = origin.x + (i % 2 === 0 ? 0 : 200);
        y = origin.y + 200 + (i * vSpacing);
        break;
      case 'up':
        x = origin.x + (i % 2 === 0 ? 0 : 200);
        y = origin.y - 200 - (i * vSpacing);
        break;
    }
    
    rects.push({
      x,
      y,
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    });
  }
  
  return rects;
}

export function probeAvailableSpace(
  origin: { x: number; y: number },
  existingNodes: Node[],
  nodeCount: number,
  axisPreference?: 'horizontal' | 'vertical'
): SpaceProbeResult {
  const existingRects = existingNodes
    .filter(n => n.type !== 'experiment')
    .map(getNodeRect);
  
  const directions: ('right' | 'left' | 'down' | 'up')[] = axisPreference === 'vertical'
    ? ['down', 'up', 'right', 'left']
    : ['right', 'left', 'down', 'up'];
  
  let bestResult: SpaceProbeResult | null = null;
  let bestScore = Infinity;
  
  for (const direction of directions) {
    const candidateRects = generateCandidateRects(origin, nodeCount, direction);
    const score = scorePlacement(candidateRects, existingRects);
    
    if (score < bestScore) {
      bestScore = score;
      const isHorizontal = direction === 'right' || direction === 'left';
      const sign = direction === 'right' || direction === 'down' ? 1 : -1;
      
      bestResult = {
        direction,
        startOffset: {
          x: isHorizontal ? 300 * sign : 0,
          y: isHorizontal ? 0 : 200 * sign,
        },
        spacing: {
          x: isHorizontal ? HORIZONTAL_SPACING * sign : 0,
          y: isHorizontal ? 0 : VERTICAL_SPACING * sign,
        },
        laneOffset: { x: 0, y: 0 },
        score,
        fallbackUsed: false,
      };
    }
    
    if (score === 0) break;
  }
  
  if (bestResult && bestScore > 0) {
    const candidateRectsExpanded = generateCandidateRects(
      origin,
      nodeCount,
      bestResult.direction,
      1.5
    );
    const expandedScore = scorePlacement(candidateRectsExpanded, existingRects);
    
    if (expandedScore < bestScore) {
      const isHorizontal = bestResult.direction === 'right' || bestResult.direction === 'left';
      const sign = bestResult.direction === 'right' || bestResult.direction === 'down' ? 1 : -1;
      
      bestResult = {
        ...bestResult,
        spacing: {
          x: isHorizontal ? HORIZONTAL_SPACING * 1.5 * sign : 0,
          y: isHorizontal ? 0 : VERTICAL_SPACING * 1.5 * sign,
        },
        score: expandedScore,
        fallbackUsed: true,
      };
      bestScore = expandedScore;
    }
    
    if (bestScore > 0) {
      const currentDir = bestResult.direction;
      const alternateDirection = (currentDir === 'right' || currentDir === 'left')
        ? 'down' as const
        : 'right' as const;
      const alternateCandidates = generateCandidateRects(origin, nodeCount, alternateDirection);
      const alternateScore = scorePlacement(alternateCandidates, existingRects);
      
      if (alternateScore < bestScore) {
        const isHorizontal = alternateDirection === 'right';
        const sign = 1;
        
        bestResult = {
          direction: alternateDirection,
          startOffset: {
            x: isHorizontal ? 300 * sign : 0,
            y: isHorizontal ? 0 : 200 * sign,
          },
          spacing: {
            x: isHorizontal ? HORIZONTAL_SPACING * sign : 0,
            y: isHorizontal ? 0 : VERTICAL_SPACING * sign,
          },
          laneOffset: { x: 0, y: 0 },
          score: alternateScore,
          fallbackUsed: true,
        };
        bestScore = alternateScore;
      }
    }
    
    if (bestScore > 0) {
      bestResult = {
        ...bestResult,
        laneOffset: { x: 120, y: 120 },
        fallbackUsed: true,
      };
    }
  }
  
  if (!bestResult) {
    bestResult = {
      direction: 'right',
      startOffset: { x: 300, y: 0 },
      spacing: { x: HORIZONTAL_SPACING, y: 0 },
      laneOffset: { x: 0, y: 0 },
      score: 0,
      fallbackUsed: false,
    };
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[ExperimentLayout] direction=${bestResult.direction} score=${bestResult.score} fallbackUsed=${bestResult.fallbackUsed}`);
  }
  
  return bestResult;
}

export function applySpaceProbeResult(
  origin: { x: number; y: number },
  nodeCount: number,
  probeResult: SpaceProbeResult
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  
  for (let i = 0; i < nodeCount; i++) {
    const isHorizontal = probeResult.direction === 'right' || probeResult.direction === 'left';
    const staggerOffset = i % 2 === 0 ? 0 : (isHorizontal ? 120 : 200);
    
    positions.push({
      x: origin.x + probeResult.startOffset.x + (i * probeResult.spacing.x) + probeResult.laneOffset.x + (isHorizontal ? 0 : staggerOffset),
      y: origin.y + probeResult.startOffset.y + (i * probeResult.spacing.y) + probeResult.laneOffset.y + (isHorizontal ? staggerOffset : 0),
    });
  }
  
  return positions;
}
