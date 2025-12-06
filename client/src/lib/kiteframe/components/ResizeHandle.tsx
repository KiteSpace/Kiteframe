import React, { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useEventCleanup } from '../utils/eventCleanup';

interface ResizeHandleProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  nodeRef: React.RefObject<HTMLElement>;
  onResize?: (width: number, height: number, resizeInfo: { position: string }) => void;
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
  const cleanupManager = useEventCleanup();
  const cleanupFnRef = useRef<(() => void) | null>(null);

  const getPositionClasses = () => {
    const baseClasses = 'absolute bg-white border-[3px] border-blue-500 rounded-sm opacity-100 transition-opacity cursor-';
    
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
    const baseSize = 12; // Smaller base size
    const actualSize = Math.max(10, baseSize / zoom); // Minimum 10px
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
    
    // Get current dimensions from computed style for more accurate measurements
    const computedStyle = window.getComputedStyle(nodeRef.current);
    const currentWidth = parseFloat(computedStyle.width) || nodeRef.current.offsetWidth;
    const currentHeight = parseFloat(computedStyle.height) || nodeRef.current.offsetHeight;
    
    startDimensionsRef.current = { width: currentWidth, height: currentHeight };
    
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

      // Pass the handle position for proper resize direction calculation
      onResize?.(newWidth, newHeight, { position });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      isResizingRef.current = false;
      // Clean up using stored cleanup function
      if (cleanupFnRef.current) {
        cleanupFnRef.current();
        cleanupFnRef.current = null;
      }
    };

    // Use cleanup manager for event listeners
    const cleanupMove = cleanupManager.addEventListener(document, 'mousemove', handleMouseMove);
    const cleanupUp = cleanupManager.addEventListener(document, 'mouseup', handleMouseUp);
    
    // Store combined cleanup function
    cleanupFnRef.current = () => {
      cleanupMove();
      cleanupUp();
    };
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