import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Node, Edge } from '../types';

export interface MinimapProps {
  nodes: Node[];
  edges: Edge[];
  viewportBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  canvasBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  zoom: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  width?: number;
  height?: number;
  onViewportChange?: (x: number, y: number) => void;
  className?: string;
}

const MinimapComponent: React.FC<MinimapProps> = ({
  nodes,
  edges,
  viewportBounds,
  canvasBounds,
  zoom,
  position = 'bottom-right',
  width = 200,
  height = 150,
  onViewportChange,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scale, setScale] = useState(1);
  const isDraggingRef = useRef(false);

  // Calculate scale to fit all content in minimap
  useEffect(() => {
    const canvasWidth = canvasBounds.maxX - canvasBounds.minX || 1000;
    const canvasHeight = canvasBounds.maxY - canvasBounds.minY || 1000;
    
    const scaleX = width / canvasWidth;
    const scaleY = height / canvasHeight;
    setScale(Math.min(scaleX, scaleY) * 0.9); // 0.9 for padding
  }, [canvasBounds, width, height]);

  // Draw minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Save context
    ctx.save();

    // Apply scale and translation
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(
      -(canvasBounds.minX + (canvasBounds.maxX - canvasBounds.minX) / 2),
      -(canvasBounds.minY + (canvasBounds.maxY - canvasBounds.minY) / 2)
    );

    // Draw edges
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1 / scale;
    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        ctx.beginPath();
        ctx.moveTo(
          sourceNode.position.x + (sourceNode.width || 200) / 2,
          sourceNode.position.y + (sourceNode.height || 100) / 2
        );
        ctx.lineTo(
          targetNode.position.x + (targetNode.width || 200) / 2,
          targetNode.position.y + (targetNode.height || 100) / 2
        );
        ctx.stroke();
      }
    });

    // Draw nodes
    nodes.forEach(node => {
      const nodeWidth = node.width || 200;
      const nodeHeight = node.height || 100;
      
      // Node background
      ctx.fillStyle = node.selected ? '#3b82f6' : '#e5e7eb';
      ctx.fillRect(
        node.position.x,
        node.position.y,
        nodeWidth,
        nodeHeight
      );
      
      // Node border
      ctx.strokeStyle = node.selected ? '#1e40af' : '#9ca3af';
      ctx.lineWidth = 2 / scale;
      ctx.strokeRect(
        node.position.x,
        node.position.y,
        nodeWidth,
        nodeHeight
      );
    });

    // Draw viewport rectangle
    ctx.strokeStyle = '#3b82f6';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.lineWidth = 2 / scale;
    
    const viewportWidth = viewportBounds.width / zoom;
    const viewportHeight = viewportBounds.height / zoom;
    
    ctx.fillRect(
      viewportBounds.x,
      viewportBounds.y,
      viewportWidth,
      viewportHeight
    );
    ctx.strokeRect(
      viewportBounds.x,
      viewportBounds.y,
      viewportWidth,
      viewportHeight
    );

    // Restore context
    ctx.restore();
  }, [nodes, edges, viewportBounds, canvasBounds, zoom, scale, width, height]);

  // Handle click to pan
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onViewportChange) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert click position to world coordinates
    const worldX = (x - width / 2) / scale + 
      (canvasBounds.minX + (canvasBounds.maxX - canvasBounds.minX) / 2);
    const worldY = (y - height / 2) / scale + 
      (canvasBounds.minY + (canvasBounds.maxY - canvasBounds.minY) / 2);

    // Center viewport on clicked position
    const viewportWidth = viewportBounds.width / zoom;
    const viewportHeight = viewportBounds.height / zoom;
    
    onViewportChange(
      worldX - viewportWidth / 2,
      worldY - viewportHeight / 2
    );
  }, [onViewportChange, width, height, scale, canvasBounds, viewportBounds, zoom]);

  // Handle drag to pan
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    isDraggingRef.current = true;
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !onViewportChange) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert to world coordinates
    const worldX = (x - width / 2) / scale + 
      (canvasBounds.minX + (canvasBounds.maxX - canvasBounds.minX) / 2);
    const worldY = (y - height / 2) / scale + 
      (canvasBounds.minY + (canvasBounds.maxY - canvasBounds.minY) / 2);

    // Center viewport on dragged position
    const viewportWidth = viewportBounds.width / zoom;
    const viewportHeight = viewportBounds.height / zoom;
    
    onViewportChange(
      worldX - viewportWidth / 2,
      worldY - viewportHeight / 2
    );
  }, [isDragging, onViewportChange, width, height, scale, canvasBounds, viewportBounds, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    isDraggingRef.current = false;
  }, []);

  // Global mouse handlers for drag outside canvas
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !onViewportChange) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Convert to world coordinates
      const worldX = (x - width / 2) / scale + 
        (canvasBounds.minX + (canvasBounds.maxX - canvasBounds.minX) / 2);
      const worldY = (y - height / 2) / scale + 
        (canvasBounds.minY + (canvasBounds.maxY - canvasBounds.minY) / 2);

      // Center viewport on dragged position
      const viewportWidth = viewportBounds.width / zoom;
      const viewportHeight = viewportBounds.height / zoom;
      
      onViewportChange(
        worldX - viewportWidth / 2,
        worldY - viewportHeight / 2
      );
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        setIsDragging(false);
        isDraggingRef.current = false;
      }
    };

    // Add global listeners
    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, scale, width, height, canvasBounds, viewportBounds, zoom, onViewportChange]);

  // Position classes - memoized to prevent recreation
  const positionClasses = useMemo(() => ({
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  }), []);

  return (
    <div
      className={`absolute ${positionClasses[position]} bg-white rounded-lg shadow-lg border border-gray-200 p-2 ${className}`}
      data-testid="minimap"
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="cursor-pointer rounded"
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          // Only stop dragging if not actively dragging
          // Global listeners will handle cleanup when dragging
          if (!isDragging) {
            handleMouseUp();
          }
        }}
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="text-xs text-gray-500 text-center mt-1">
        Minimap
      </div>
    </div>
  );
};

// Export memoized component to prevent unnecessary re-renders
export const Minimap = React.memo(MinimapComponent);