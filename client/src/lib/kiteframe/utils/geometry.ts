import { DISABLE_SHAPE_TEXT } from '../constants/defaults';

export function clamp(v:number, min:number, max:number){ return Math.max(min, Math.min(max, v)); }

export function clientToWorld(clientX:number, clientY:number, viewport:{x:number;y:number;zoom:number}, rect:DOMRect){
  const x = (clientX - rect.left - viewport.x) / viewport.zoom;
  const y = (clientY - rect.top - viewport.y) / viewport.zoom;
  return { x, y };
}

export function zoomAroundPoint(zoom:number, delta:number, minZoom:number, maxZoom:number){
  const factor = Math.exp(-delta * 0.2);
  return clamp(zoom * factor, minZoom, maxZoom);
}

export interface InnerTextRect {
  x: number;
  y: number;
  width: number;
  height: number;
  clipPath?: string;
}

/**
 * Calculate the effective inner text rectangle for a given shape type
 * This ensures text stays within the visible shape boundaries, not just the bounding box
 * 
 * @param shapeType - The type of shape
 * @param width - Shape width
 * @param height - Shape height  
 * @param strokeWidth - Stroke width (default: 0)
 * @param padding - Text padding (default: 8)
 * @returns Inner text rectangle or null if shape doesn't support text
 */
export function getInnerTextRect(
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'hexagon' | 'line' | 'arrow',
  width: number,
  height: number,
  strokeWidth: number = 0,
  padding: number = 8
): InnerTextRect | null {
  // Early return if shape text is disabled
  if (DISABLE_SHAPE_TEXT && shapeType !== 'line' && shapeType !== 'arrow') {
      return null;
  }


  // Shapes that don't support text
  if (shapeType === 'line' || shapeType === 'arrow') {
    return null;
  }

  // Account for stroke and padding
  const effectiveStroke = strokeWidth / 2;
  const totalPadding = padding + effectiveStroke;

  switch (shapeType) {
    case 'rectangle': {
      // Rectangle uses full area minus padding and stroke
      const innerWidth = Math.max(0, width - (totalPadding * 2));
      const innerHeight = Math.max(0, height - (totalPadding * 2));
      
      const result = {
        x: totalPadding,
        y: totalPadding,
        width: innerWidth,
        height: innerHeight
      };
      
      return result;
    }

    case 'circle': {
      // Balanced circle calculation with proper clip-path
      const diameter = Math.min(width, height) - effectiveStroke * 2;
      const radius = diameter / 2;
      // Use 80% of inscribed square for good text space without bleeding
      const innerSquareSide = Math.max(0, radius * Math.sqrt(2) * 0.8 - padding);
      
      if (innerSquareSide <= 20) { // Minimum usable text area
        return null;
      }
      
      const centerX = width / 2;
      const centerY = height / 2;
      const halfSide = innerSquareSide / 2;
      
      const result = {
        x: centerX - halfSide,
        y: centerY - halfSide,
        width: innerSquareSide,
        height: innerSquareSide,
        // Proper clip-path that matches text area
        clipPath: `circle(${radius}px at ${centerX}px ${centerY}px)`
      };
      
      return result;
    }

    case 'triangle': {
      // Balanced triangle calculation - 70% width, 60% height with proper clipping
      const innerWidth = Math.max(0, width * 0.7 - totalPadding * 2);
      const innerHeight = Math.max(0, height * 0.6 - totalPadding * 2);
      
      if (innerWidth <= 20 || innerHeight <= 15) return null;
      
      return {
        x: (width - innerWidth) / 2,
        y: (height - innerHeight) / 2 + height * 0.1, // Center with slight downward bias
        width: innerWidth,
        height: innerHeight,
        // Proper triangle clip-path to prevent text bleeding
        clipPath: `polygon(50% 0%, 0% 100%, 100% 100%)`
      };
    }

    case 'hexagon': {
      // Balanced hexagon calculation - 85% width, 75% height with proper clipping
      const innerWidth = Math.max(0, width * 0.85 - totalPadding * 2);
      const innerHeight = Math.max(0, height * 0.75 - totalPadding * 2);
      
      if (innerWidth <= 20 || innerHeight <= 15) return null;
      
      return {
        x: (width - innerWidth) / 2,
        y: (height - innerHeight) / 2,
        width: innerWidth,
        height: innerHeight,
        // Proper hexagon clip-path to prevent text bleeding
        clipPath: `polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)`
      };
    }

    default:
      return null;
  }
}