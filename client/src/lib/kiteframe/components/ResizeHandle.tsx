import React, { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  nodeRef: React.RefObject<HTMLElement>;
  onResize?: (width: number, height: number, anchor: { x: number; y: number }) => void;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  viewport?: { x: number; y: number; zoom: number };
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  position,
  nodeRef,
  onResize,
  minWidth = 100,
  minHeight = 50,
  maxWidth = 800,
  maxHeight = 600,
  viewport
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const startDimensionsRef = useRef({ width: 0, height: 0 });
  const startPositionRef = useRef({ x: 0, y: 0 });
  const isResizingRef = useRef(false);

  const getPositionClasses = () => {
    const baseClasses = 'absolute bg-white border-2 border-blue-500 rounded-sm opacity-100 transition-opacity cursor-';
    
    switch (position) {
      case 'top-left':
        return cn(baseClasses + 'nw-resize');
      case 'top-right':
        return cn(baseClasses + 'ne-resize');
      case 'bottom-left':
        return cn(baseClasses + 'sw-resize');
      case 'bottom-right':
        return cn(baseClasses + 'se-resize');
      default:
        return baseClasses + 'se-resize';
    }
  };

  const getHandleStyle = () => {
    // Make handles zoom-invariant: larger when zoomed out, smaller when zoomed in
    const zoom = viewport?.zoom ?? 1;
    const baseSize = 16; // Base size in pixels (larger than before)
    const actualSize = Math.max(12, baseSize / zoom); // Minimum 12px
    const offset = actualSize / 2;
    
    const baseStyle = {
      width: `${actualSize}px`,
      height: `${actualSize}px`,
    };
    
    switch (position) {
      case 'top-left':
        return { ...baseStyle, top: `-${offset}px`, left: `-${offset}px` };
      case 'top-right':
        return { ...baseStyle, top: `-${offset}px`, right: `-${offset}px` };
      case 'bottom-left':
        return { ...baseStyle, bottom: `-${offset}px`, left: `-${offset}px` };
      case 'bottom-right':
        return { ...baseStyle, bottom: `-${offset}px`, right: `-${offset}px` };
      default:
        return baseStyle;
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!nodeRef.current) return;
    
    console.log('🔧 RESIZE HANDLE MOUSE DOWN:', { position });
    
    // Get current dimensions from computed style for more accurate measurements
    const computedStyle = window.getComputedStyle(nodeRef.current);
    const currentWidth = parseFloat(computedStyle.width) || nodeRef.current.offsetWidth;
    const currentHeight = parseFloat(computedStyle.height) || nodeRef.current.offsetHeight;
    
    startDimensionsRef.current = { width: currentWidth, height: currentHeight };
    
    console.log('🔧 RESIZE START:', {
      dimensions: startDimensionsRef.current,
      mousePos: { x: e.clientX, y: e.clientY }
    });
    startPositionRef.current = { x: e.clientX, y: e.clientY };
    setIsResizing(true);
    isResizingRef.current = true;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;

      // Raw mouse deltas in screen space
      const rawDeltaX = e.clientX - startPositionRef.current.x;
      const rawDeltaY = e.clientY - startPositionRef.current.y;
      
      // Apply viewport zoom correction
      const zoom = viewport?.zoom || 1;
      const deltaX = rawDeltaX / zoom;
      const deltaY = rawDeltaY / zoom;
      
      console.log('🔧 RESIZE COORDINATE DEBUG:', {
        position,
        screenMouse: { x: e.clientX, y: e.clientY },
        startMouse: startPositionRef.current,
        rawDeltas: { x: rawDeltaX, y: rawDeltaY },
        zoom,
        correctedDeltas: { x: deltaX, y: deltaY },
        startDimensions: startDimensionsRef.current
      });

      let newWidth = startDimensionsRef.current.width;
      let newHeight = startDimensionsRef.current.height;

      // Calculate new dimensions based on handle position
      switch (position) {
        case 'top-left':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startDimensionsRef.current.width - deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startDimensionsRef.current.height - deltaY));
          break;
        case 'top-right':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startDimensionsRef.current.width + deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startDimensionsRef.current.height - deltaY));
          break;
        case 'bottom-left':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startDimensionsRef.current.width - deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startDimensionsRef.current.height + deltaY));
          break;
        case 'bottom-right':
          newWidth = Math.max(minWidth, Math.min(maxWidth, startDimensionsRef.current.width + deltaX));
          newHeight = Math.max(minHeight, Math.min(maxHeight, startDimensionsRef.current.height + deltaY));
          break;
      }

      // Calculate anchor position based on handle position
      if (!nodeRef.current) return;
      const nodeRect = nodeRef.current.getBoundingClientRect();
      let anchor = { x: 0, y: 0 };
      
      switch (position) {
        case 'top-left':
          anchor = { x: nodeRect.right, y: nodeRect.bottom }; // Keep bottom-right fixed
          break;
        case 'top-right':
          anchor = { x: nodeRect.left, y: nodeRect.bottom }; // Keep bottom-left fixed
          break;
        case 'bottom-left':
          anchor = { x: nodeRect.right, y: nodeRect.top }; // Keep top-right fixed
          break;
        case 'bottom-right':
          anchor = { x: nodeRect.left, y: nodeRect.top }; // Keep top-left fixed
          break;
      }
      
      onResize?.(newWidth, newHeight, anchor);
    };

    const handleMouseUp = () => {
      console.log('🔧 RESIZE HANDLE MOUSE UP');
      setIsResizing(false);
      isResizingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position, nodeRef, onResize, minWidth, minHeight, maxWidth, maxHeight]);

  return (
    <div
      className={getPositionClasses()}
      style={getHandleStyle()}
      onMouseDown={handleMouseDown}
      data-testid={`resize-handle-${position}`}
    />
  );
};