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
    guideColor = 'hsl(221.2, 83.2%, 53.3%)', // Primary blue from shadcn
    guideOpacity = 0.8,
    indicatorSize = 8
  } = visualStyle;

  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1000 }}
    >
      {guides.map((guide, index) => {
        const isHorizontal = guide.type === 'horizontal';
        const opacity = Math.min(guideOpacity, 0.4 + (guide.strength * 0.1));
        
        // Transform guide position based on viewport
        const transformedPosition = isHorizontal
          ? guide.position * viewport.zoom + viewport.y
          : guide.position * viewport.zoom + viewport.x;
        
        const size = isHorizontal 
          ? canvasSize.width * viewport.zoom
          : canvasSize.height * viewport.zoom;
        
        return (
          <div
            key={`${guide.type}-${guide.position}-${index}`}
            className="absolute transition-opacity duration-200"
            style={{
              [isHorizontal ? 'top' : 'left']: `${transformedPosition}px`,
              [isHorizontal ? 'left' : 'top']: isHorizontal ? `${viewport.x}px` : `${viewport.y}px`,
              [isHorizontal ? 'width' : 'height']: `${size}px`,
              [isHorizontal ? 'height' : 'width']: '1px',
              backgroundColor: guideColor,
              opacity,
              boxShadow: `0 0 4px ${guideColor}40`,
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
                [isHorizontal ? 'left' : 'top']: `${size / 2 - indicatorSize / 2}px`
              }}
            />
            
            {/* Guide strength indicator for strong alignments */}
            {guide.strength > 2 && (
              <div
                className="absolute text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium shadow-sm"
                style={{
                  [isHorizontal ? 'top' : 'left']: isHorizontal ? '-24px' : '-28px',
                  [isHorizontal ? 'left' : 'top']: `${size / 2 - 12}px`,
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