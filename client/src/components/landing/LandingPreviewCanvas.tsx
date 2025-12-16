import { useEffect, useRef, useState, useCallback } from 'react';
import type { Node, Edge, Position } from '@/lib/kiteframe/types';

const SAMPLE_NODES: Node[] = [
  {
    id: 'concept',
    type: 'input',
    position: { x: 80, y: 200 },
    data: { label: 'Concept' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 140,
    height: 56,
  },
  {
    id: 'workflow',
    type: 'process',
    position: { x: 280, y: 200 },
    data: { label: 'Workflow' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 140,
    height: 56,
  },
  {
    id: 'coordination',
    type: 'process',
    position: { x: 480, y: 200 },
    data: { label: 'Coordination' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 140,
    height: 56,
  },
  {
    id: 'alignment',
    type: 'condition',
    position: { x: 680, y: 188 },
    data: { label: 'Alignment' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 140,
    height: 80,
  },
  {
    id: 'launch',
    type: 'output',
    position: { x: 880, y: 200 },
    data: { label: 'Launch' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 140,
    height: 56,
  },
];

const SAMPLE_EDGES: Edge[] = [
  { id: 'e1', source: 'concept', target: 'workflow', type: 'smoothstep' },
  { id: 'e2', source: 'workflow', target: 'coordination', type: 'smoothstep' },
  { id: 'e3', source: 'coordination', target: 'alignment', type: 'smoothstep' },
  { id: 'e4', source: 'alignment', target: 'launch', type: 'smoothstep' },
];

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  input: { bg: '#e0f2fe', border: '#38bdf8', text: '#0369a1' },
  output: { bg: '#dcfce7', border: '#4ade80', text: '#166534' },
  process: { bg: '#f3e8ff', border: '#c084fc', text: '#7e22ce' },
  condition: { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' },
  ai: { bg: '#fce7f3', border: '#f472b6', text: '#9d174d' },
};

interface DragState {
  nodeId: string;
  startX: number;
  startY: number;
  nodeStartX: number;
  nodeStartY: number;
}

export default function LandingPreviewCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>(SAMPLE_NODES);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const getNodeCenter = useCallback((node: Node): Position => {
    const width = node.width || 140;
    const height = node.height || 56;
    return {
      x: node.position.x + width / 2,
      y: node.position.y + height / 2,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setDragState({
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      nodeStartX: node.position.x,
      nodeStartY: node.position.y,
    });
  }, [nodes]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState) return;
    
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    
    setNodes(prev => prev.map(node => 
      node.id === dragState.nodeId
        ? { ...node, position: { x: dragState.nodeStartX + dx, y: dragState.nodeStartY + dy } }
        : node
    ));
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  const renderEdge = (edge: Edge) => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return null;

    const source = getNodeCenter(sourceNode);
    const target = getNodeCenter(targetNode);
    
    const sourceRight = sourceNode.position.x + (sourceNode.width || 140);
    const targetLeft = targetNode.position.x;
    
    const startX = sourceRight;
    const startY = source.y;
    const endX = targetLeft;
    const endY = target.y;
    
    const midX = (startX + endX) / 2;
    const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

    return (
      <g key={edge.id}>
        <path
          d={path}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={2}
          markerEnd="url(#arrowhead)"
        />
        {edge.label && (
          <text
            x={midX}
            y={(startY + endY) / 2 - 8}
            textAnchor="middle"
            className="text-xs fill-slate-500 font-medium"
          >
            {edge.label}
          </text>
        )}
      </g>
    );
  };

  const renderNode = (node: Node) => {
    const colors = NODE_COLORS[node.type || 'process'];
    const width = node.width || 140;
    const height = node.height || 56;

    return (
      <g
        key={node.id}
        transform={`translate(${node.position.x}, ${node.position.y})`}
        style={{ cursor: dragState?.nodeId === node.id ? 'grabbing' : 'grab' }}
        onMouseDown={(e) => handleMouseDown(e, node.id)}
      >
        <rect
          width={width}
          height={height}
          rx={node.type === 'condition' ? 0 : 8}
          fill={colors.bg}
          stroke={colors.border}
          strokeWidth={2}
          transform={node.type === 'condition' ? `rotate(0)` : undefined}
          style={{
            filter: dragState?.nodeId === node.id ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' : 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
          }}
        />
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={colors.text}
          className="text-sm font-medium select-none pointer-events-none"
          style={{ fontSize: '14px' }}
        >
          {node.data.label}
        </text>
      </g>
    );
  };

  return (
    <div 
      ref={canvasRef}
      className="w-full h-full bg-slate-50/50 dark:bg-slate-900/50 overflow-hidden"
      data-testid="landing-preview-canvas"
    >
      <svg width="100%" height="100%" viewBox="0 0 1100 456" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
          </marker>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1" fill="#e2e8f0" fillOpacity="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        {SAMPLE_EDGES.map(renderEdge)}
        {nodes.map(renderNode)}
      </svg>
    </div>
  );
}
