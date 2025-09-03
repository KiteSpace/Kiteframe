# Edge Endpoint Reconnection Implementation Guide

This guide provides complete code and step-by-step instructions for implementing edge endpoint selection and reconnection functionality, allowing users to drag edge endpoints to different nodes to change connections.

## 🎯 Overview

**What This Feature Does:**
- Users can click on any edge to select it and reveal draggable handles
- Drag source or target handles to connect edges to different nodes  
- Real-time visual feedback during dragging
- Automatic validation to prevent duplicate connections
- Smooth coordinate transformation for zoomed/panned canvases

**Key Components:**
1. **EdgeHandles Component** - Renders draggable handles on selected edges
2. **Edge Selection Logic** - Handles edge selection/deselection  
3. **Reconnection Handler** - Updates edge connections when dragging completes
4. **Visual Feedback System** - Preview lines and node highlighting

## 📋 Prerequisites

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

## 🔧 Core Implementation

### 1. EdgeHandles Component

```typescript
// components/EdgeHandles.tsx
import React, { useState, useRef, useEffect } from 'react';

interface Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
  style?: { width?: number; height?: number };
}

interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
}

interface EdgeHandlesProps {
  edge: Edge;
  sourceNode?: Node;
  targetNode?: Node;
  nodes: Node[];
  edges: Edge[];
  onEdgeReconnect?: (edgeId: string, newSource?: string, newTarget?: string) => void;
  viewport?: { x: number; y: number; zoom: number };
}

interface DragState {
  isDragging: boolean;
  isSource: boolean; // true for source handle, false for target handle
  startPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
  originalSource: string;
  originalTarget: string;
}

export function EdgeHandles({
  edge,
  sourceNode,
  targetNode,
  nodes,
  edges,
  onEdgeReconnect,
  viewport = { x: 0, y: 0, zoom: 1 }
}: EdgeHandlesProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Calculate connection point for a node edge
  const getConnectionPoint = (node: Node, otherNode: Node, isSource: boolean) => {
    const nodeWidth = node.style?.width || (node.type === 'kframe' ? 400 : 200);
    const nodeHeight = node.style?.height || (node.type === 'kframe' ? 300 : 100);
    const nodeX = node.position.x;
    const nodeY = node.position.y;
    const nodeCenterX = nodeX + nodeWidth / 2;
    const nodeCenterY = nodeY + nodeHeight / 2;
    
    const otherNodeWidth = otherNode.type === 'kframe' ? (otherNode.style?.width || 400) : (otherNode.style?.width || 200);
    const otherNodeHeight = otherNode.type === 'kframe' ? (otherNode.style?.height || 300) : (otherNode.style?.height || 100);
    const otherCenterX = otherNode.position.x + otherNodeWidth / 2;
    const otherCenterY = otherNode.position.y + otherNodeHeight / 2;
    
    // Calculate angle between nodes to determine connection side
    const deltaX = otherCenterX - nodeCenterX;
    const deltaY = otherCenterY - nodeCenterY;
    const angle = Math.atan2(deltaY, deltaX);
    
    // Determine which edge to connect to based on angle
    const absAngle = Math.abs(angle);
    const isHorizontal = absAngle < Math.PI / 4 || absAngle > (3 * Math.PI / 4);
    
    const handleOffset = 8; // Handle size
    
    let connectionPoint;
    if (isHorizontal) {
      // Connect to left or right edge
      if (deltaX > 0) {
        connectionPoint = { x: nodeX + nodeWidth + handleOffset/2, y: nodeCenterY };
      } else {
        connectionPoint = { x: nodeX - handleOffset/2, y: nodeCenterY };
      }
    } else {
      // Connect to top or bottom edge
      if (deltaY > 0) {
        connectionPoint = { x: nodeCenterX, y: nodeY + nodeHeight + handleOffset/2 };
      } else {
        connectionPoint = { x: nodeCenterX, y: nodeY - handleOffset/2 };
      }
    }
    
    return connectionPoint;
  };

  // Check if cursor position is over a node
  const getNodeUnderCursor = (x: number, y: number): Node | null => {
    for (const node of nodes) {
      const nodeWidth = node.style?.width || (node.type === 'kframe' ? 400 : 200);
      const nodeHeight = node.style?.height || (node.type === 'kframe' ? 300 : 100);
      
      if (
        x >= node.position.x &&
        x <= node.position.x + nodeWidth &&
        y >= node.position.y &&
        y <= node.position.y + nodeHeight
      ) {
        return node;
      }
    }
    return null;
  };

  // Handle mouse down on edge handles
  const handleMouseDown = (event: React.MouseEvent, isSource: boolean) => {
    event.stopPropagation();
    event.preventDefault();
    
    // Prevent canvas panning during drag
    const customEvent = new CustomEvent('edgeHandleDragStart');
    window.dispatchEvent(customEvent);

    // Get canvas container for coordinate transformation
    const svg = (event.currentTarget as Element).closest('svg');
    if (!svg) return;

    const canvasContainer = svg.closest('[data-canvas-container]') as HTMLElement;
    if (!canvasContainer) return;
    
    const canvasRect = canvasContainer.getBoundingClientRect();
    
    // Transform screen coordinates to canvas coordinates
    const rawMouseX = event.clientX - canvasRect.left;
    const rawMouseY = event.clientY - canvasRect.top;
    const x = (rawMouseX - viewport.x) / viewport.zoom;
    const y = (rawMouseY - viewport.y) / viewport.zoom;

    setDragState({
      isDragging: true,
      isSource,
      startPosition: { x, y },
      currentPosition: { x, y },
      originalSource: edge.source,
      originalTarget: edge.target
    });

    console.log('[EdgeHandles] Started dragging', {
      edgeId: edge.id,
      handle: isSource ? 'source' : 'target',
      startPosition: { x, y }
    });
  };

  // Handle mouse move during drag
  const handleMouseMove = (event: MouseEvent) => {
    if (!dragState) return;

    const svg = document.querySelector(`[data-edge-id="${edge.id}"]`)?.closest('svg');
    if (!svg) return;

    const canvasContainer = svg.closest('[data-canvas-container]') as HTMLElement;
    if (!canvasContainer) return;
    
    const canvasRect = canvasContainer.getBoundingClientRect();
    
    // Transform screen coordinates to canvas coordinates
    const rawMouseX = event.clientX - canvasRect.left;
    const rawMouseY = event.clientY - canvasRect.top;
    const x = (rawMouseX - viewport.x) / viewport.zoom;
    const y = (rawMouseY - viewport.y) / viewport.zoom;

    // Update drag state with current cursor position
    setDragState(prev => prev ? {
      ...prev,
      currentPosition: { x, y }
    } : null);

    // Check if we're over a valid target node for visual feedback
    const nodeUnder = getNodeUnderCursor(x, y);
    setHoveredNode(nodeUnder && nodeUnder.id !== edge.source && nodeUnder.id !== edge.target ? nodeUnder.id : null);
  };

  // Handle mouse up to complete reconnection
  const handleMouseUp = (event: MouseEvent) => {
    if (!dragState) return;

    const svg = document.querySelector(`[data-edge-id="${edge.id}"]`)?.closest('svg');
    if (!svg) return;

    const canvasContainer = svg.closest('[data-canvas-container]') as HTMLElement;
    if (!canvasContainer) return;
    
    const canvasRect = canvasContainer.getBoundingClientRect();
    
    // Transform screen coordinates to canvas coordinates  
    const rawMouseX = event.clientX - canvasRect.left;
    const rawMouseY = event.clientY - canvasRect.top;
    const x = (rawMouseX - viewport.x) / viewport.zoom;
    const y = (rawMouseY - viewport.y) / viewport.zoom;

    // Check if we're over a valid target node
    const targetNode = getNodeUnderCursor(x, y);
    
    if (targetNode && targetNode.id !== edge.source && targetNode.id !== edge.target) {
      // Calculate new source and target based on which handle was dragged
      const newSource = dragState.isSource ? targetNode.id : edge.source;
      const newTarget = dragState.isSource ? edge.target : targetNode.id;
      
      // Check if this connection already exists (prevent duplicates)
      const edgeExists = edges?.some(e => 
        e.id !== edge.id && (
          (e.source === newSource && e.target === newTarget) || 
          (e.source === newTarget && e.target === newSource)
        )
      ) || false;
      
      if (!edgeExists) {
        console.log('[EdgeHandles] Reconnecting edge:', {
          edgeId: edge.id,
          from: { source: edge.source, target: edge.target },
          to: { source: newSource, target: newTarget }
        });
        onEdgeReconnect?.(edge.id, newSource, newTarget);
      } else {
        console.log('[EdgeHandles] Reconnection cancelled - duplicate edge would be created');
      }
    } else {
      console.log('[EdgeHandles] Reconnection cancelled - invalid target');
    }

    // Clean up drag state
    setDragState(null);
    setHoveredNode(null);
    
    // Re-enable canvas panning
    const customEvent = new CustomEvent('edgeHandleDragEnd');
    window.dispatchEvent(customEvent);
  };

  // Set up global mouse events when dragging starts
  useEffect(() => {
    if (dragState?.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState?.isDragging, edge.id, edge.source, edge.target]);

  if (!sourceNode || !targetNode) return null;

  // Calculate handle positions
  const sourcePoint = getConnectionPoint(sourceNode, targetNode, true);
  const targetPoint = getConnectionPoint(targetNode, sourceNode, false);

  return (
    <g data-edge-id={edge.id} data-testid="edge-handles">
      
      {/* Preview line during drag */}
      {dragState && (() => {
        const previewX1 = dragState.isSource ? dragState.currentPosition.x : sourcePoint.x;
        const previewY1 = dragState.isSource ? dragState.currentPosition.y : sourcePoint.y;
        const previewX2 = dragState.isSource ? targetPoint.x : dragState.currentPosition.x;
        const previewY2 = dragState.isSource ? targetPoint.y : dragState.currentPosition.y;
        
        // Check if connection would be valid
        const newSource = dragState.isSource ? (hoveredNode || dragState.originalSource) : dragState.originalSource;
        const newTarget = dragState.isSource ? dragState.originalTarget : (hoveredNode || dragState.originalTarget);
        const edgeExists = edges?.some(e => 
          e.id !== edge.id && (
            (e.source === newSource && e.target === newTarget) || 
            (e.source === newTarget && e.target === newSource)
          )
        ) || false;
        
        // Color: red for invalid, green for valid target, blue for default
        const strokeColor = edgeExists ? "#ef4444" : (hoveredNode ? "#22c55e" : "#3b82f6");
        
        return (
          <line
            x1={previewX1}
            y1={previewY1}
            x2={previewX2}
            y2={previewY2}
            stroke={strokeColor}
            strokeWidth="3"
            strokeDasharray="5,5"
            opacity="0.8"
            pointerEvents="none"
          />
        );
      })()}

      {/* Original connection ghost during drag */}
      {dragState && (
        <line
          x1={sourcePoint.x}
          y1={sourcePoint.y}
          x2={targetPoint.x}
          y2={targetPoint.y}
          stroke="#64748b"
          strokeWidth="2"
          opacity="0.3"
          pointerEvents="none"
        />
      )}

      {/* Source handle (blue circle) */}
      <circle
        cx={sourcePoint.x}
        cy={sourcePoint.y}
        r="8"
        fill="#3b82f6"
        stroke="white"
        strokeWidth="3"
        cursor="pointer"
        opacity={dragState?.isSource ? 0.7 : 1}
        onMouseDown={(e) => handleMouseDown(e, true)}
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
          pointerEvents: 'auto'
        }}
      />

      {/* Target handle (blue circle) */}
      <circle
        cx={targetPoint.x}
        cy={targetPoint.y}
        r="8"
        fill="#3b82f6"
        stroke="white"
        strokeWidth="3"
        cursor="pointer"
        opacity={dragState?.isSource === false ? 0.7 : 1}
        onMouseDown={(e) => handleMouseDown(e, false)}
        style={{
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
          pointerEvents: 'auto'
        }}
      />

      {/* Node highlight during drag */}
      {dragState && hoveredNode && (
        <>
          {nodes
            .filter(node => node.id === hoveredNode)
            .map(node => {
              const nodeWidth = node.style?.width || (node.type === 'kframe' ? 400 : 200);
              const nodeHeight = node.style?.height || (node.type === 'kframe' ? 300 : 100);
              
              return (
                <rect
                  key={node.id}
                  x={node.position.x - 2}
                  y={node.position.y - 2}
                  width={nodeWidth + 4}
                  height={nodeHeight + 4}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="3"
                  rx="8"
                  opacity="0.7"
                  pointerEvents="none"
                />
              );
            })
          }
        </>
      )}
    </g>
  );
}
```

### 2. Main Canvas Component Integration

```typescript
// components/WorkflowCanvas.tsx
import React, { useState } from 'react';
import { EdgeHandles } from './EdgeHandles';

interface Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
  style?: { width?: number; height?: number };
}

interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export function WorkflowCanvas() {
  const [nodes, setNodes] = useState<Node[]>([
    { 
      id: '1', 
      type: 'default', 
      position: { x: 100, y: 100 }, 
      data: { label: 'Start' },
      style: { width: 200, height: 100 }
    },
    { 
      id: '2', 
      type: 'default', 
      position: { x: 400, y: 100 }, 
      data: { label: 'Process' },
      style: { width: 200, height: 100 }
    },
    { 
      id: '3', 
      type: 'default', 
      position: { x: 700, y: 100 }, 
      data: { label: 'End' },
      style: { width: 200, height: 100 }
    }
  ]);

  const [edges, setEdges] = useState<Edge[]>([
    { id: 'e1', source: '1', target: '2', type: 'default' },
    { id: 'e2', source: '2', target: '3', type: 'default' }
  ]);

  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  // Handle edge selection
  const handleEdgeClick = (edge: Edge) => {
    console.log('Edge selected:', edge.id);
    setSelectedEdge(edge);
  };

  // Handle canvas click (deselect edge)
  const handleCanvasClick = () => {
    setSelectedEdge(null);
  };

  // Handle edge reconnection
  const handleEdgeReconnect = (
    edgeId: string, 
    newSource?: string, 
    newTarget?: string
  ) => {
    setEdges(prevEdges => {
      return prevEdges.map(edge => {
        if (edge.id === edgeId) {
          const updatedEdge = {
            ...edge,
            source: newSource || edge.source,
            target: newTarget || edge.target
          };
          
          console.log('Edge reconnected:', {
            edgeId,
            from: { source: edge.source, target: edge.target },
            to: { source: updatedEdge.source, target: updatedEdge.target }
          });
          
          return updatedEdge;
        }
        return edge;
      });
    });

    // Deselect edge after successful reconnection
    setSelectedEdge(null);
  };

  // Render edge path (simplified SVG path)
  const renderEdge = (edge: Edge) => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return null;

    const sourceX = sourceNode.position.x + (sourceNode.style?.width || 200) / 2;
    const sourceY = sourceNode.position.y + (sourceNode.style?.height || 100) / 2;
    const targetX = targetNode.position.x + (targetNode.style?.width || 200) / 2;
    const targetY = targetNode.position.y + (targetNode.style?.height || 100) / 2;

    return (
      <line
        key={edge.id}
        x1={sourceX}
        y1={sourceY}
        x2={targetX}
        y2={targetY}
        stroke={selectedEdge?.id === edge.id ? "#3b82f6" : "#64748b"}
        strokeWidth={selectedEdge?.id === edge.id ? "3" : "2"}
        cursor="pointer"
        onClick={() => handleEdgeClick(edge)}
      />
    );
  };

  // Render node (simplified rectangle)
  const renderNode = (node: Node) => {
    const width = node.style?.width || 200;
    const height = node.style?.height || 100;
    
    return (
      <g key={node.id}>
        <rect
          x={node.position.x}
          y={node.position.y}
          width={width}
          height={height}
          fill="#f8fafc"
          stroke="#64748b"
          strokeWidth="2"
          rx="8"
        />
        <text
          x={node.position.x + width / 2}
          y={node.position.y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="14"
          fill="#1f2937"
        >
          {node.data.label}
        </text>
      </g>
    );
  };

  return (
    <div 
      className="w-full h-screen bg-gray-50" 
      data-canvas-container
      onClick={handleCanvasClick}
    >
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 1200 800"
        className="overflow-visible"
      >
        {/* Render all edges */}
        {edges.map(edge => renderEdge(edge))}
        
        {/* Render all nodes */}
        {nodes.map(node => renderNode(node))}
        
        {/* Render edge handles for selected edge */}
        {selectedEdge && (
          <EdgeHandles
            edge={selectedEdge}
            sourceNode={nodes.find(n => n.id === selectedEdge.source)}
            targetNode={nodes.find(n => n.id === selectedEdge.target)}
            nodes={nodes}
            edges={edges}
            onEdgeReconnect={handleEdgeReconnect}
            viewport={viewport}
          />
        )}
      </svg>
    </div>
  );
}
```

### 3. Usage Example

```typescript
// App.tsx
import React from 'react';
import { WorkflowCanvas } from './components/WorkflowCanvas';

function App() {
  return (
    <div className="App">
      <h1>Edge Reconnection Demo</h1>
      <p>Click on any edge to select it, then drag the blue handles to reconnect to different nodes.</p>
      <WorkflowCanvas />
    </div>
  );
}

export default App;
```

## 🎨 Visual Feedback System

### Handle Styles
```css
/* Optional CSS for additional styling */
.edge-handle {
  cursor: grab;
  transition: opacity 0.2s;
}

.edge-handle:active {
  cursor: grabbing;
}

.edge-handle-preview {
  animation: dash 1s linear infinite;
}

@keyframes dash {
  to {
    stroke-dashoffset: -10;
  }
}
```

### Color Coding
- **Blue handles**: Default state (ready to drag)
- **Green preview**: Valid target connection
- **Red preview**: Invalid connection (duplicate would be created)  
- **Gray ghost**: Shows original connection during drag

## 🔧 Advanced Features

### 1. Custom Validation

```typescript
const handleEdgeReconnect = (edgeId: string, newSource?: string, newTarget?: string) => {
  // Custom validation rules
  const sourceNode = nodes.find(n => n.id === newSource);
  const targetNode = nodes.find(n => n.id === newTarget);
  
  // Prevent connecting input nodes to output nodes directly
  if (sourceNode?.type === 'input' && targetNode?.type === 'output') {
    console.warn('Direct input-to-output connections not allowed');
    return;
  }
  
  // Prevent self-connections
  if (newSource === newTarget) {
    console.warn('Cannot connect node to itself');
    return;
  }
  
  // Check maximum connections per node
  const sourceConnections = edges.filter(e => e.source === newSource || e.target === newSource).length;
  if (sourceConnections >= 5) {
    console.warn('Node has reached maximum connections (5)');
    return;
  }
  
  // Update the edge
  setEdges(prev => prev.map(edge => 
    edge.id === edgeId 
      ? { ...edge, source: newSource || edge.source, target: newTarget || edge.target }
      : edge
  ));
};
```

### 2. Undo/Redo Support

```typescript
const [history, setHistory] = useState<Edge[][]>([edges]);
const [historyIndex, setHistoryIndex] = useState(0);

const handleEdgeReconnect = (edgeId: string, newSource?: string, newTarget?: string) => {
  const newEdges = edges.map(edge => 
    edge.id === edgeId 
      ? { ...edge, source: newSource || edge.source, target: newTarget || edge.target }
      : edge
  );
  
  // Add to history
  const newHistory = history.slice(0, historyIndex + 1);
  newHistory.push(newEdges);
  setHistory(newHistory);
  setHistoryIndex(newHistory.length - 1);
  
  setEdges(newEdges);
};

const undo = () => {
  if (historyIndex > 0) {
    setHistoryIndex(historyIndex - 1);
    setEdges(history[historyIndex - 1]);
  }
};

const redo = () => {
  if (historyIndex < history.length - 1) {
    setHistoryIndex(historyIndex + 1);
    setEdges(history[historyIndex + 1]);
  }
};
```

### 3. Backend Synchronization

```typescript
const handleEdgeReconnect = async (edgeId: string, newSource?: string, newTarget?: string) => {
  // Optimistically update UI
  const newEdges = edges.map(edge => 
    edge.id === edgeId 
      ? { ...edge, source: newSource || edge.source, target: newTarget || edge.target }
      : edge
  );
  setEdges(newEdges);
  
  try {
    // Save to backend
    await fetch('/api/workflows/edges', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        edgeId,
        source: newSource,
        target: newTarget,
        timestamp: new Date().toISOString()
      })
    });
    
    console.log('Edge reconnection saved to backend');
  } catch (error) {
    console.error('Failed to save edge reconnection:', error);
    // Revert on error
    setEdges(edges);
  }
};
```

## 🚀 Integration Steps

### 1. Install Dependencies
```bash
npm install react react-dom
npm install -D @types/react @types/react-dom
```

### 2. Add Component Files
- Copy `EdgeHandles.tsx` to your components directory
- Copy `WorkflowCanvas.tsx` and customize for your needs

### 3. Update Your Canvas
- Add `data-canvas-container` attribute to your canvas container
- Implement edge selection logic
- Add `onEdgeReconnect` handler

### 4. Test the Feature
1. Click any edge to select it
2. Drag the blue handles to different nodes
3. Verify connections update correctly
4. Test edge validation (prevent duplicates)

## 🐛 Troubleshooting

### Handles Not Appearing
**Issue**: Edge handles don't show when edge is selected
**Solution**: Check edge selection state and node data

```typescript
// Add debugging
const handleEdgeClick = (edge: Edge) => {
  console.log('Edge clicked:', edge);
  console.log('Source node:', nodes.find(n => n.id === edge.source));
  console.log('Target node:', nodes.find(n => n.id === edge.target));
  setSelectedEdge(edge);
};
```

### Drag Not Working
**Issue**: Cannot drag handles or coordinates are wrong
**Solution**: Verify canvas container and viewport setup

```typescript
// Check canvas container exists
const canvasContainer = svg.closest('[data-canvas-container]') as HTMLElement;
if (!canvasContainer) {
  console.error('Canvas container not found - add data-canvas-container attribute');
  return;
}
```

### Connections Not Updating
**Issue**: Edge reconnection handler not firing
**Solution**: Check state update logic

```typescript
// Add logging to verify updates
const handleEdgeReconnect = (edgeId: string, newSource?: string, newTarget?: string) => {
  console.log('Reconnection called:', { edgeId, newSource, newTarget });
  
  setEdges(prev => {
    const updated = prev.map(edge => 
      edge.id === edgeId ? { ...edge, source: newSource || edge.source, target: newTarget || edge.target } : edge
    );
    console.log('Updated edges:', updated);
    return updated;
  });
};
```

## 📊 Performance Tips

1. **Memoize expensive calculations**
2. **Debounce mouse move events** for large canvases
3. **Use viewport culling** for many nodes/edges
4. **Batch state updates** when possible
5. **Optimize coordinate transformations**

This implementation provides a complete, production-ready edge reconnection system with visual feedback, validation, and smooth user interaction. The modular design allows easy customization for your specific use case.