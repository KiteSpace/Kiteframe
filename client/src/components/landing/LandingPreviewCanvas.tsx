import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { KiteFrameCanvas, PluginProvider } from '@/lib/kiteframe';
import type { Node, Edge, CanvasObject, StickyNoteData, ShapeNodeData, TextNodeData } from '@/lib/kiteframe/types';

interface LandingPreviewCanvasProps {
  variant?: 'hero' | 'features' | 'objects';
}

const HERO_NODES: Node[] = [
  {
    id: '1-kiteai-1766183815176-0',
    type: 'input',
    position: { x: 215.63, y: 254.35 },
    data: {
      label: 'Business-Critical Initiative',
      description: "It's go time!",
      icon: 'ArrowRight',
      iconColor: 'text-blue-500',
      fontSize: 18,
      bold: true,
      textAlign: 'center',
      nodeIcon: '⭐',
      iconVisible: true,
      colors: { headerBackground: '#6366f1', bodyBackground: '#eff0fe', borderColor: '#6366f1', headerTextColor: '#000000' }
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '3-kiteai-1766183815176-2',
    type: 'process',
    position: { x: 600, y: 100 },
    data: {
      label: 'Hey KiteAI!',
      description: 'Hi, how can I help you?',
      nodeIcon: '💡',
      iconVisible: true,
      colors: { headerBackground: '#22c55e', bodyBackground: '#e9f9ef', borderColor: '#22c55e', headerTextColor: '#000000' }
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '4-kiteai-1766183815176-3',
    type: 'process',
    position: { x: 847.49, y: 98.75 },
    data: {
      label: 'Collaboration Powered by Kite AI',
      description: 'All systems go!',
      nodeIcon: '⚡',
      iconVisible: true,
      colors: { headerBackground: '#3b82f6', bodyBackground: '#ebf3fe', borderColor: '#3b82f6', headerTextColor: '#000000' }
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '5-kiteai-1766183815176-4',
    type: 'process',
    position: { x: 1100, y: 98.75 },
    data: {
      label: 'Alignment',
      description: 'Clear alignment on scope, roles, and success criteria',
      nodeIcon: '✅',
      iconVisible: true,
      colors: { headerBackground: '#3b82f6', bodyBackground: '#ebf3fe', borderColor: '#3b82f6', headerTextColor: '#000000' }
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '6-kiteai-1766183815176-5',
    type: 'process',
    position: { x: 1347.42, y: 99.96 },
    data: {
      label: 'Magic',
      description: 'Kite AI generates a structured PRD in seconds',
      nodeIcon: '⭐',
      iconVisible: true,
      colors: { headerBackground: '#8b5cf6', bodyBackground: '#f3effe', borderColor: '#8b5cf6', headerTextColor: '#000000' }
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '7-kiteai-1766183815176-6',
    type: 'process',
    position: { x: 1600, y: 100 },
    data: {
      label: "Let's go!",
      description: 'Teams execute with confidence',
      nodeIcon: '🎯',
      iconVisible: true,
      colors: { headerBackground: '#06b6d4', bodyBackground: '#e6f8fb', borderColor: '#06b6d4', headerTextColor: '#000000' }
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '9-kiteai-1766183815176-8',
    type: 'process',
    position: { x: 600, y: 400 },
    data: { label: 'Kickoff', description: 'So are you leading this meeting, or am I?' },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '10-kiteai-1766183815176-9',
    type: 'process',
    position: { x: 968.84, y: 521.66 },
    data: { label: 'Scatter', description: 'Everyone get to it!' },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '11-kiteai-1766183815176-10',
    type: 'process',
    position: { x: 853.10, y: 338.57 },
    data: { label: 'Requirements doc created', description: 'Hmmmm, this seems incomplete and outdated. Who took notes??' },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '12-kiteai-1766183815176-11',
    type: 'process',
    position: { x: 1094.96, y: 289.67 },
    data: { label: 'Design review', description: 'This is what the PRD stated. Did I miss a meeting?' },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '13-kiteai-1766183815176-12',
    type: 'process',
    position: { x: 1418.41, y: 570.11 },
    data: { label: 'Engineering questions surface late', description: "We're going to need Craig over in ML Sys dept for this..." },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '14-kiteai-1766183815176-13',
    type: 'process',
    position: { x: 1444.65, y: 344.45 },
    data: { label: 'Another meeting scheduled', description: "Well, we're running out sprints. Let's build and we can address the tech debt after release." },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '15-kiteai-1766183815176-14',
    type: 'process',
    position: { x: 1716.80, y: 398.44 },
    data: {
      label: 'Scope changes introduced',
      description: "There's no time!",
      colors: { headerBackground: '#f8fafc', bodyBackground: '#ffffff', borderColor: '#e2e8f0', headerTextColor: '#0f172a' }
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '16-kiteai-1766183815176-15',
    type: 'process',
    position: { x: 1950.52, y: 398.36 },
    data: {
      label: 'Launch?',
      description: '¯\\_(ツ)_/¯',
      fontSize: 20,
      bold: true,
      textAlign: 'center',
      nodeIcon: '🚩',
      iconVisible: true,
      colors: { headerBackground: '#f97316', bodyBackground: '#fef1e8', borderColor: '#f97316', headerTextColor: '#000000' }
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: 'node-1766184941202-z2uv9om2z',
    type: 'process',
    position: { x: 1835.50, y: 100 },
    data: {
      label: 'Launch Day',
      description: 'On time and under budget.',
      nodeIcon: '🎯',
      iconVisible: true,
      colors: { headerBackground: '#22c55e', bodyBackground: '#e9f9ef', borderColor: '#22c55e', headerTextColor: '#000000' }
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
];

const HERO_EDGES: Edge[] = [
  { id: 'edge-1766184325682', source: '1-kiteai-1766183815176-0', target: '3-kiteai-1766183815176-2', type: 'bezier', style: { strokeColor: '#22c55e', strokeWidth: 2 }, interactable: false },
  { id: 'edge-kiteai-2', source: '3-kiteai-1766183815176-2', target: '4-kiteai-1766183815176-3', type: 'straight', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, interactable: false },
  { id: 'edge-kiteai-3', source: '4-kiteai-1766183815176-3', target: '5-kiteai-1766183815176-4', type: 'straight', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, interactable: false },
  { id: 'edge-kiteai-4', source: '5-kiteai-1766183815176-4', target: '6-kiteai-1766183815176-5', type: 'straight', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, interactable: false },
  { id: 'edge-kiteai-5', source: '6-kiteai-1766183815176-5', target: '7-kiteai-1766183815176-6', type: 'straight', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, interactable: false },
  { id: 'edge-1766184980436', source: '7-kiteai-1766183815176-6', target: 'node-1766184941202-z2uv9om2z', type: 'bezier', style: { strokeColor: '#3b82f6', strokeWidth: 2 }, interactable: false },
  { id: 'edge-1766184327845', source: '1-kiteai-1766183815176-0', target: '9-kiteai-1766183815176-8', type: 'bezier', style: { strokeColor: '#eab308', strokeWidth: 2 }, interactable: false },
  { id: 'edge-kiteai-8', source: '9-kiteai-1766183815176-8', target: '10-kiteai-1766183815176-9', type: 'bezier', style: { strokeColor: '#1e293b', strokeWidth: 2 }, interactable: false },
  { id: 'edge-kiteai-9', source: '10-kiteai-1766183815176-9', target: '11-kiteai-1766183815176-10', type: 'bezier', style: { strokeColor: '#1e293b', strokeWidth: 2 }, interactable: false },
  { id: 'edge-kiteai-10', source: '11-kiteai-1766183815176-10', target: '12-kiteai-1766183815176-11', type: 'straight', style: { strokeColor: '#1e293b', strokeWidth: 2 }, interactable: false },
  { id: 'edge-1766184048804', source: '10-kiteai-1766183815176-9', target: '12-kiteai-1766183815176-11', type: 'step', style: { strokeColor: '#1e293b', strokeWidth: 2 }, interactable: false },
  { id: 'edge-1766184029305', source: '12-kiteai-1766183815176-11', target: '14-kiteai-1766183815176-13', type: 'bezier', style: { strokeColor: '#1e293b', strokeWidth: 2 }, interactable: false },
  { id: 'edge-1766184074938', source: '12-kiteai-1766183815176-11', target: '13-kiteai-1766183815176-12', type: 'bezier', style: { strokeColor: '#1e293b', strokeWidth: 2 }, interactable: false },
  { id: 'edge-1766184454549', source: '14-kiteai-1766183815176-13', target: '13-kiteai-1766183815176-12', type: 'bezier', style: { strokeColor: '#64748b', strokeWidth: 2 }, animated: true, interactable: false },
  { id: 'edge-1766184043755', source: '14-kiteai-1766183815176-13', target: '10-kiteai-1766183815176-9', type: 'step', style: { strokeColor: '#ef4444', strokeWidth: 2 }, animated: true, interactable: false },
  { id: 'edge-kiteai-13', source: '14-kiteai-1766183815176-13', target: '15-kiteai-1766183815176-14', type: 'bezier', style: { strokeColor: '#1e293b', strokeWidth: 2 }, interactable: false },
  { id: 'edge-kiteai-14', source: '15-kiteai-1766183815176-14', target: '16-kiteai-1766183815176-15', type: 'straight', style: { strokeColor: '#1e293b', strokeWidth: 2 }, interactable: false },
];

const FEATURE_NODES: Node[] = [
  {
    id: 'input',
    type: 'input',
    position: { x: 40, y: 60 },
    data: { label: 'User Input' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 110,
    height: 50,
  },
  {
    id: 'validate',
    type: 'process',
    position: { x: 200, y: 60 },
    data: { label: 'Validate' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 110,
    height: 50,
  },
  {
    id: 'condition',
    type: 'condition',
    position: { x: 360, y: 50 },
    data: { label: 'Valid?' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 90,
    height: 70,
  },
  {
    id: 'success',
    type: 'output',
    position: { x: 520, y: 30 },
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
    position: { x: 520, y: 110 },
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

const createStickyNoteData = (text: string, bgColor: string): StickyNoteData => ({
  text,
  fontSize: 12,
  fontFamily: 'Inter',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textAlign: 'left',
  textDecoration: 'none',
  backgroundColor: bgColor,
  textColor: '#374151',
});

const createShapeData = (shapeType: 'rectangle' | 'circle', fillColor: string, strokeColor: string): ShapeNodeData => ({
  shapeType,
  fillColor,
  strokeColor,
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 1,
});

const createTextData = (text: string): TextNodeData => ({
  label: text,
  text,
  fontSize: 16,
  fontFamily: 'Inter',
  fontWeight: 'bold',
  fontStyle: 'normal',
  textAlign: 'left',
  textDecoration: 'none',
  textTransform: 'none',
  lineHeight: 1.4,
  letterSpacing: 0,
  textColor: '#374151',
});

const OBJECTS_DATA: CanvasObject[] = [
  {
    id: 'sticky1',
    type: 'sticky',
    position: { x: 40, y: 30 },
    data: createStickyNoteData('Remember to\nvalidate inputs!', '#fef08a'),
    width: 140,
    height: 100,
  },
  {
    id: 'sticky2',
    type: 'sticky',
    position: { x: 200, y: 60 },
    data: createStickyNoteData('Check edge\ncases', '#fed7aa'),
    width: 140,
    height: 100,
  },
  {
    id: 'shape1',
    type: 'shape',
    position: { x: 380, y: 40 },
    data: createShapeData('circle', '#c4b5fd', '#a78bfa'),
    width: 80,
    height: 80,
  },
  {
    id: 'shape2',
    type: 'shape',
    position: { x: 500, y: 50 },
    data: createShapeData('rectangle', '#a5f3fc', '#67e8f9'),
    width: 100,
    height: 60,
  },
  {
    id: 'text1',
    type: 'text',
    position: { x: 40, y: 160 },
    data: createTextData('Workflow Notes'),
    width: 150,
    height: 30,
  },
];

function calculateFitViewport(nodes: Node[], containerWidth: number, containerHeight: number, padding: number = 50) {
  if (nodes.length === 0) return { x: 0, y: 0, zoom: 1 };
  
  const minX = Math.min(...nodes.map(n => n.position.x));
  const maxX = Math.max(...nodes.map(n => n.position.x + (n.width || 200)));
  const minY = Math.min(...nodes.map(n => n.position.y));
  const maxY = Math.max(...nodes.map(n => n.position.y + (n.height || 100)));
  
  const contentWidth = maxX - minX;
  const contentHeight = maxY - minY;
  
  const scaleX = (containerWidth - padding * 2) / contentWidth;
  const scaleY = (containerHeight - padding * 2) / contentHeight;
  const zoom = Math.min(scaleX, scaleY, 1);
  
  const centerX = minX + contentWidth / 2;
  const centerY = minY + contentHeight / 2;
  
  const x = containerWidth / 2 - centerX * zoom;
  const y = containerHeight / 2 - centerY * zoom;
  
  return { x, y, zoom };
}

export default function LandingPreviewCanvas({ variant = 'hero' }: LandingPreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialNodes = variant === 'hero' ? HERO_NODES : variant === 'features' ? FEATURE_NODES : [];
  const initialEdges = variant === 'hero' ? HERO_EDGES : variant === 'features' ? FEATURE_EDGES : [];
  const initialObjects = variant === 'objects' ? OBJECTS_DATA : [];

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [canvasObjects] = useState<CanvasObject[]>(initialObjects);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    if (variant === 'hero' && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const fitViewport = calculateFitViewport(HERO_NODES, rect.width, rect.height, 40);
      setViewport(fitViewport);
    }
  }, [variant]);

  useEffect(() => {
    if (variant !== 'hero' || !containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const fitViewport = calculateFitViewport(HERO_NODES, width, height, 40);
          setViewport(fitViewport);
        }
      }
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [variant]);

  const handleNodesChange = useCallback((newNodes: Node[]) => {
    if (variant !== 'hero') {
      setNodes(newNodes);
    }
  }, [variant]);

  const handleEdgesChange = useCallback((newEdges: Edge[]) => {
    if (variant !== 'hero') {
      setEdges(newEdges);
    }
  }, [variant]);

  const handleViewportChange = useCallback((newViewport: { x: number; y: number; zoom: number }) => {
    if (variant !== 'hero') {
      setViewport(newViewport);
    }
  }, [variant]);

  const isReadOnly = variant === 'hero';

  const canvasStyle = useMemo(() => ({
    width: '100%',
    height: '100%',
    background: 'transparent',
    '--kiteframe-canvas-bg': 'transparent',
    ...(isReadOnly ? { pointerEvents: 'none' as const } : {}),
  }), [isReadOnly]);

  return (
    <PluginProvider>
      <div 
        ref={containerRef}
        style={canvasStyle}
        data-testid={`landing-canvas-${variant}`}
      >
        <KiteFrameCanvas
          nodes={nodes}
          edges={edges}
          canvasObjects={canvasObjects}
          viewport={viewport}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onViewportChange={handleViewportChange}
          enablePlugins={false}
          showMiniMap={false}
          snapToGrid={false}
          readOnly={isReadOnly}
        />
      </div>
    </PluginProvider>
  );
}
