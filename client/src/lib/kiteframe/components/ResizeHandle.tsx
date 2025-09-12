import React, { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  nodeRef: React.RefObject<HTMLElement>;
  onResize?: (width: number, height: number) => void;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  position,
  nodeRef,
  onResize,
  minWidth = 100,
  minHeight = 50,
  maxWidth = 800,
  maxHeight = 600
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [startDimensions, setStartDimensions] = useState({ width: 0, height: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });

  const getPositionClasses = () => {
    const baseClasses = 'absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-sm opacity-100 transition-opacity cursor-';
    
    switch (position) {
      case 'top-left':
        return cn(baseClasses + 'nw-resize', '-top-1.5 -left-1.5');
      case 'top-right':
        return cn(baseClasses + 'ne-resize', '-top-1.5 -right-1.5');
      case 'bottom-left':
        return cn(baseClasses + 'sw-resize', '-bottom-1.5 -left-1.5');
      case 'bottom-right':
        return cn(baseClasses + 'se-resize', '-bottom-1.5 -right-1.5');
      default:
        return baseClasses + 'se-resize';
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!nodeRef.current) return;
    
    const rect = nodeRef.current.getBoundingClientRect();
    setStartDimensions({ width: rect.width, height: rect.height });
    setStartPosition({ x: e.clientX, y: e.clientY });
    setIsResizing(true);

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - startPosition.x;
      const deltaY = e.clientY - startPosition.y;

      let newWidth = startDimensions.width;
      let newHeight = startDimensions.height;

      // Calculate new dimensions based on handle position
      switch (position) {
        case 'top-left':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startDimensions.width - deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startDimensions.height - deltaY));
          break;
        case 'top-right':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startDimensions.width + deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startDimensions.height - deltaY));
          break;
        case 'bottom-left':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startDimensions.width - deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startDimensions.height + deltaY));
          break;
        case 'bottom-right':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startDimensions.width + deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startDimensions.height + deltaY));
          break;
      }

      console.log('🔧 RESIZE HANDLE:', {
        position,
        startDimensions: { width: startDimensions.width, height: startDimensions.height },
        newDimensions: { width: newWidth, height: newHeight },
        deltas: { deltaX, deltaY }
      });
      onResize?.(newWidth, newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position, nodeRef, onResize, startDimensions, startPosition, isResizing, minWidth, minHeight, maxWidth, maxHeight]);

  return (
    <div
      className={getPositionClasses()}
      onMouseDown={handleMouseDown}
      data-testid={`resize-handle-${position}`}
    />
  );
};