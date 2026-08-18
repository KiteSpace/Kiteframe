import React from 'react';
import type { SnapGuide } from '../utils/snapUtils';

interface SnapGuidesProps {
  guides: SnapGuide[];
  canvasSize: { width: number; height: number };
  viewport: { x: number; y: number; zoom: number };
  show: boolean;
  visualStyle?: {
    guideColor?: string;
    guideOpacity?: number;
    indicatorSize?: number;
  };
}

export const SnapGuides: React.FC<SnapGuidesProps> = ({
  guides,
  canvasSize,
  viewport,
  show,
  visualStyle = {}
}) => {
  if (!show || guides.length === 0) return null;

  const {
    guideColor = 'hsl(220, 13%, 60%)', // Grey color
    guideOpacity = 0.7,
    indicatorSize = 6
  } = visualStyle;

  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1000 }}
    >
      {guides.map((guide, index) => {
        const isHorizontal = guide.type === 'horizontal';
        const opacity = Math.min(guideOpacity, 0.4 + (guide.strength * 0.1));
        
        // Transform guide position from world to screen coordinates with pixel snapping
        const transformedPosition = isHorizontal
          ? Math.round(guide.position * viewport.zoom + viewport.y) + 0.5
          : Math.round(guide.position * viewport.zoom + viewport.x) + 0.5;
        
        // Constant line thickness
        const lineThickness = 1;
        
        return (
          <div
            key={`${guide.type}-${guide.position}-${index}`}
            className="absolute transition-opacity duration-200"
            style={{
              [isHorizontal ? 'top' : 'left']: `${transformedPosition}px`,
              [isHorizontal ? 'left' : 'top']: 0,
              [isHorizontal ? 'width' : 'height']: '100%',
              [isHorizontal ? 'height' : 'width']: `${lineThickness}px`,
              borderTop: isHorizontal ? `${lineThickness}px dashed ${guideColor}` : 'none',
              borderLeft: !isHorizontal ? `${lineThickness}px dashed ${guideColor}` : 'none',
              opacity,
            }}
          >
            {/* Guide line indicator dot */}
            <div
              className="absolute rounded-full border border-background shadow-sm transition-all duration-200"
              style={{
                width: `${indicatorSize}px`,
                height: `${indicatorSize}px`,
                backgroundColor: guideColor,
                [isHorizontal ? 'top' : 'left']: `-${indicatorSize / 2}px`,
                [isHorizontal ? 'left' : 'top']: '50%',
                transform: isHorizontal ? 'translateX(-50%)' : 'translateY(-50%)'
              }}
            />
            
            {/* Guide strength indicator for strong alignments */}
            {guide.strength > 2 && (
              <div
                className="absolute text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium shadow-sm"
                style={{
                  [isHorizontal ? 'top' : 'left']: isHorizontal ? '-24px' : '-28px',
                  [isHorizontal ? 'left' : 'top']: '50%',
                  transform: isHorizontal ? 'translateX(-50%)' : 'translateY(-50%)',
                  fontSize: '10px',
                  minWidth: '24px',
                  textAlign: 'center'
                }}
              >
                {guide.strength}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};