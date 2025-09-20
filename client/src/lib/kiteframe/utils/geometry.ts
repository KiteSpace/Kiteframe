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
      
      return {
        x: totalPadding,
        y: totalPadding,
        width: innerWidth,
        height: innerHeight
      };
    }

    case 'circle': {
      // For circle, use the largest centered square that fits inside
      // r = min(width, height) / 2 - stroke/2
      // inner square side = r * sqrt(2) ≈ r * 1.414 ≈ 0.7071 * diameter
      const diameter = Math.min(width, height) - effectiveStroke * 2;
      const radius = diameter / 2;
      const innerSquareSide = radius * Math.sqrt(2) - totalPadding * 2;
      
      if (innerSquareSide <= 0) return null;
      
      const centerX = width / 2;
      const centerY = height / 2;
      const halfSide = innerSquareSide / 2;
      
      return {
        x: centerX - halfSide,
        y: centerY - halfSide,
        width: innerSquareSide,
        height: innerSquareSide,
        clipPath: `circle(${radius}px at ${centerX}px ${centerY}px)`
      };
    }

    case 'triangle': {
      // Conservative inner rectangle for isosceles triangle (apex top, base bottom)
      // Use 60% width, 50% height to avoid edge intrusion
      const innerWidth = Math.max(0, width * 0.6 - totalPadding * 2);
      const innerHeight = Math.max(0, height * 0.5 - totalPadding * 2);
      
      if (innerWidth <= 0 || innerHeight <= 0) return null;
      
      return {
        x: (width - innerWidth) / 2,
        y: (height - innerHeight) / 2 + height * 0.05, // Slight bias downward
        width: innerWidth,
        height: innerHeight,
        clipPath: `polygon(50% 0%, 0% 100%, 100% 100%)`
      };
    }

    case 'hexagon': {
      // Regular hexagon with flat top
      // Use 80% width, 70% height for safe inner area
      const innerWidth = Math.max(0, width * 0.8 - totalPadding * 2);
      const innerHeight = Math.max(0, height * 0.7 - totalPadding * 2);
      
      if (innerWidth <= 0 || innerHeight <= 0) return null;
      
      return {
        x: (width - innerWidth) / 2,
        y: (height - innerHeight) / 2,
        width: innerWidth,
        height: innerHeight,
        clipPath: `polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)`
      };
    }

    default:
      return null;
  }
}