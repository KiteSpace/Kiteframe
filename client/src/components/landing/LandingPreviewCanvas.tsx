import { useEffect, useRef, useState, useCallback } from 'react';
import type { Node, Edge, Position } from '@/lib/kiteframe/types';

interface LandingPreviewCanvasProps {
  variant?: 'hero' | 'features' | 'objects';
}

const HERO_NODES: Node[] = [
  {
    id: 'process',
    type: 'process',
    position: { x: 60, y: 180 },
    data: { label: 'Process' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 120,
    height: 50,
  },
  {
    id: 'table',
    type: 'table',
    position: { x: 240, y: 180 },
    data: { label: 'Table' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 120,
    height: 50,
  },
  {
    id: 'form',
    type: 'form',
    position: { x: 420, y: 180 },
    data: { label: 'Form' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 120,
    height: 50,
  },
  {
    id: 'code',
    type: 'code',
    position: { x: 600, y: 180 },
    data: { label: 'Code' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 120,
    height: 50,
  },
  {
    id: 'figma',
    type: 'figma',
    position: { x: 780, y: 180 },
    data: { label: 'Figma' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 120,
    height: 50,
  },
];

const HERO_EDGES: Edge[] = [
  { id: 'e1', source: 'process', target: 'table', type: 'smoothstep' },
  { id: 'e2', source: 'table', target: 'form', type: 'smoothstep' },
  { id: 'e3', source: 'form', target: 'code', type: 'smoothstep' },
  { id: 'e4', source: 'code', target: 'figma', type: 'smoothstep' },
];

const FEATURE_NODES: Node[] = [
  {
    id: 'input',
    type: 'input',
    position: { x: 80, y: 60 },
    data: { label: 'User Input' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 120,
    height: 50,
  },
  {
    id: 'validate',
    type: 'process',
    position: { x: 280, y: 60 },
    data: { label: 'Validate' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 120,
    height: 50,
  },
  {
    id: 'condition',
    type: 'condition',
    position: { x: 480, y: 48 },
    data: { label: 'Valid?' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 100,
    height: 70,
  },
  {
    id: 'success',
    type: 'output',
    position: { x: 680, y: 30 },
    data: { label: 'Success' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 100,
    height: 50,
  },
  {
    id: 'error',
    type: 'output',
    position: { x: 680, y: 120 },
    data: { label: 'Error' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 100,
    height: 50,
  },
];

const FEATURE_EDGES: Edge[] = [
  { id: 'e1', source: 'input', target: 'validate', type: 'smoothstep' },
  { id: 'e2', source: 'validate', target: 'condition', type: 'smoothstep' },
  { id: 'e3', source: 'condition', target: 'success', type: 'smoothstep', label: 'Yes' },
  { id: 'e4', source: 'condition', target: 'error', type: 'smoothstep', label: 'No' },
];

const OBJECTS_DATA = [
  { id: 'sticky1', type: 'sticky', x: 60, y: 40, width: 140, height: 100, color: '#fef08a', text: 'Remember to\nvalidate inputs!' },
  { id: 'sticky2', type: 'sticky', x: 220, y: 80, width: 140, height: 100, color: '#fed7aa', text: 'Check edge\ncases' },
  { id: 'shape1', type: 'circle', x: 400, y: 60, size: 80, color: '#c4b5fd' },
  { id: 'shape2', type: 'rect', x: 520, y: 50, width: 100, height: 60, color: '#a5f3fc' },
  { id: 'text1', type: 'text', x: 60, y: 170, text: 'Workflow Notes', fontSize: 18 },
  { id: 'link1', type: 'link', x: 400, y: 150, width: 220, height: 50, url: 'figma.com/design...' },
];

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  input: { bg: '#e0f2fe', border: '#38bdf8', text: '#0369a1' },
  output: { bg: '#dcfce7', border: '#4ade80', text: '#166534' },
  process: { bg: '#f3e8ff', border: '#c084fc', text: '#7e22ce' },
  condition: { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' },
  ai: { bg: '#fce7f3', border: '#f472b6', text: '#9d174d' },
  table: { bg: '#e0f2fe', border: '#38bdf8', text: '#0369a1' },
  form: { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' },
  code: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
  figma: { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
};

interface DragState {
  nodeId: string;
  startX: number;
  startY: number;
  nodeStartX: number;
  nodeStartY: number;
}

export default function LandingPreviewCanvas({ variant = 'hero' }: LandingPreviewCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const initialNodes = variant === 'hero' ? HERO_NODES : variant === 'features' ? FEATURE_NODES : [];
  const edges = variant === 'hero' ? HERO_EDGES : variant === 'features' ? FEATURE_EDGES : [];
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const getNodeCenter = useCallback((node: Node): Position => {
    const width = node.width || 120;
    const height = node.height || 50;
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
    
    const sourceRight = sourceNode.position.x + (sourceNode.width || 120);
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
    const width = node.width || 120;
    const height = node.height || 50;

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
          style={{ fontSize: '13px' }}
        >
          {node.data.label}
        </text>
      </g>
    );
  };

  const renderObjects = () => {
    return OBJECTS_DATA.map((obj) => {
      if (obj.type === 'sticky') {
        return (
          <g key={obj.id} transform={`translate(${obj.x}, ${obj.y})`}>
            <rect
              width={obj.width}
              height={obj.height}
              fill={obj.color}
              rx={4}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
            />
            <text
              x={10}
              y={25}
              fill="#525252"
              style={{ fontSize: '12px', fontWeight: 500 }}
            >
              {obj.text?.split('\n').map((line, i) => (
                <tspan key={i} x={10} dy={i === 0 ? 0 : 16}>{line}</tspan>
              ))}
            </text>
          </g>
        );
      }
      if (obj.type === 'circle') {
        return (
          <circle
            key={obj.id}
            cx={obj.x + (obj.size || 40) / 2}
            cy={obj.y + (obj.size || 40) / 2}
            r={(obj.size || 40) / 2}
            fill={obj.color}
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
          />
        );
      }
      if (obj.type === 'rect') {
        return (
          <rect
            key={obj.id}
            x={obj.x}
            y={obj.y}
            width={obj.width}
            height={obj.height}
            fill={obj.color}
            rx={6}
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
          />
        );
      }
      if (obj.type === 'text') {
        return (
          <text
            key={obj.id}
            x={obj.x}
            y={obj.y}
            fill="#374151"
            style={{ fontSize: `${obj.fontSize || 14}px`, fontWeight: 600 }}
          >
            {obj.text}
          </text>
        );
      }
      if (obj.type === 'link') {
        return (
          <g key={obj.id} transform={`translate(${obj.x}, ${obj.y})`}>
            <rect
              width={obj.width}
              height={obj.height}
              fill="#f8fafc"
              stroke="#e2e8f0"
              strokeWidth={1}
              rx={6}
            />
            <text
              x={12}
              y={30}
              fill="#6366f1"
              style={{ fontSize: '12px', textDecoration: 'underline' }}
            >
              {obj.url}
            </text>
          </g>
        );
      }
      return null;
    });
  };

  const viewBox = variant === 'hero' ? '0 0 960 400' : variant === 'objects' ? '0 0 680 220' : '0 0 840 200';

  return (
    <div 
      ref={canvasRef}
      className="w-full h-full overflow-hidden"
      data-testid={`landing-canvas-${variant}`}
    >
      <svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
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
        </defs>
        {variant === 'objects' ? (
          renderObjects()
        ) : (
          <>
            {edges.map(renderEdge)}
            {nodes.map(renderNode)}
          </>
        )}
      </svg>
    </div>
  );
}
