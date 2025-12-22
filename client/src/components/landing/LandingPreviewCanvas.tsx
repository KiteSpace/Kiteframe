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
    position: { x: 234.20, y: 232.84 },
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
    position: { x: 484.40, y: 132.84 },
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
    position: { x: 715.13, y: 132.84 },
    data: {
      label: 'Collaboration Powered by Kite AI',
      description: 'Clear alignment on scope, roles, and success criteria',
      nodeIcon: '⚡',
      iconVisible: true,
      colors: { headerBackground: '#3b82f6', bodyBackground: '#ebf3fe', borderColor: '#3b82f6', headerTextColor: '#000000' }
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '6-kiteai-1766183815176-5',
    type: 'process',
    position: { x: 947.63, y: 132.84 },
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
    position: { x: 1180.43, y: 132.84 },
    data: {
      label: "Let's go!",
      description: 'Teams execute with confidence',
      nodeIcon: '🚀',
      iconVisible: true,
      colors: { headerBackground: '#06b6d4', bodyBackground: '#e6f8fb', borderColor: '#06b6d4', headerTextColor: '#000000' }
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: 'node-1766184941202-z2uv9om2z',
    type: 'output',
    position: { x: 1413.00, y: 132.84 },
    data: {
      label: 'Launch Day',
      description: 'On time and under budget.',
      nodeIcon: '🎯',
      iconVisible: true,
      colors: { headerBackground: '#22c55e', bodyBackground: '#e9f9ef', borderColor: '#22c55e', headerTextColor: '#000000' }
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '9-kiteai-1766183815176-8',
    type: 'process',
    position: { x: 483.40, y: 332.84 },
    data: { label: 'Kickoff', description: 'So are you leading this meeting, or am I?' },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '10-kiteai-1766183815176-9',
    type: 'process',
    position: { x: 368.84, y: 498.36 },
    data: { label: 'Scatter', description: 'Everyone get to it!' },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '11-kiteai-1766183815176-10',
    type: 'process',
    position: { x: 716.13, y: 320.50 },
    data: { label: 'Requirements doc created', description: 'Hmmmm, this seems incomplete and outdated. Who took notes??' },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '12-kiteai-1766183815176-11',
    type: 'process',
    position: { x: 617.42, y: 653.99 },
    data: { label: 'Design review', description: 'This is what the PRD stated. Did I miss a meeting?' },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '13-kiteai-1766183815176-12',
    type: 'process',
    position: { x: 892.43, y: 631.10 },
    data: { label: 'Engineering questions surface late', description: "We're going to need Craig over in ML Sys dept for this..." },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '14-kiteai-1766183815176-13',
    type: 'process',
    position: { x: 892.43, y: 441.59 },
    data: { label: 'Another meeting scheduled', description: "Well, we're running out sprints. Let's build and we can address the tech debt after release." },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false
  },
  {
    id: '15-kiteai-1766183815176-14',
    type: 'process',
    position: { x: 986.97, y: 302.60 },
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
    position: { x: 1180.43, y: 498.66 },
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
];

const HERO_EDGES: Edge[] = [
  { id: 'edge-1766184325682', source: '1-kiteai-1766183815176-0', target: '3-kiteai-1766183815176-2', type: 'bezier', style: { strokeColor: '#22c55e', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'edge-1766352137830', source: '4-kiteai-1766183815176-3', target: '6-kiteai-1766183815176-5', type: 'bezier', style: { strokeColor: '#3b82f6', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'edge-kiteai-2', source: '3-kiteai-1766183815176-2', target: '4-kiteai-1766183815176-3', type: 'straight', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'edge-kiteai-5', source: '6-kiteai-1766183815176-5', target: '7-kiteai-1766183815176-6', type: 'straight', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'edge-1766184980436', source: '7-kiteai-1766183815176-6', target: 'node-1766184941202-z2uv9om2z', type: 'bezier', style: { strokeColor: '#3b82f6', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'edge-1766184327845', source: '1-kiteai-1766183815176-0', target: '9-kiteai-1766183815176-8', type: 'bezier', style: { strokeColor: '#eab308', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'edge-kiteai-8', source: '9-kiteai-1766183815176-8', target: '10-kiteai-1766183815176-9', type: 'bezier', style: { strokeColor: '#1e293b', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'edge-kiteai-9', source: '10-kiteai-1766183815176-9', target: '11-kiteai-1766183815176-10', type: 'bezier', style: { strokeColor: '#1e293b', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'edge-kiteai-10', source: '11-kiteai-1766183815176-10', target: '12-kiteai-1766183815176-11', type: 'straight', style: { strokeColor: '#1e293b', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'edge-1766184048804', source: '10-kiteai-1766183815176-9', target: '12-kiteai-1766183815176-11', type: 'step', style: { strokeColor: '#1e293b', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'edge-1766184029305', source: '12-kiteai-1766183815176-11', target: '14-kiteai-1766183815176-13', type: 'bezier', style: { strokeColor: '#1e293b', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'edge-1766184074938', source: '12-kiteai-1766183815176-11', target: '13-kiteai-1766183815176-12', type: 'bezier', style: { strokeColor: '#1e293b', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'edge-1766184454549', source: '14-kiteai-1766183815176-13', target: '13-kiteai-1766183815176-12', type: 'bezier', style: { strokeColor: '#64748b', strokeWidth: 2 }, markerEnd: true, animated: true, interactable: false },
  { id: 'edge-1766184043755', source: '14-kiteai-1766183815176-13', target: '10-kiteai-1766183815176-9', type: 'step', style: { strokeColor: '#ef4444', strokeWidth: 2 }, markerEnd: true, animated: true, interactable: false },
  { id: 'edge-kiteai-13', source: '14-kiteai-1766183815176-13', target: '15-kiteai-1766183815176-14', type: 'bezier', style: { strokeColor: '#1e293b', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'edge-kiteai-14', source: '15-kiteai-1766183815176-14', target: '16-kiteai-1766183815176-15', type: 'straight', style: { strokeColor: '#1e293b', strokeWidth: 2 }, markerEnd: true, animated: true, interactable: false },
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
    id: 'object-1766187644228',
    type: 'shape',
    position: { x: 40, y: 40 },
    data: {
      shapeType: 'rectangle',
      fillColor: '#ec4899',
      fillOpacity: 0.5,
      gradient: { enabled: false, type: 'linear', direction: 0, colors: [{ color: '#e5e7eb', position: 0 }, { color: '#d1d5db', position: 1 }] },
      strokeColor: '#ec4899',
      strokeWidth: 2,
      strokeOpacity: 1,
      strokeStyle: 'dashed',
      text: '',
      textColor: '#374151',
      fontSize: 14,
      fontFamily: 'Inter',
      fontWeight: 400,
      fontStyle: 'normal',
      textAlign: 'center',
      borderRadius: 8,
      opacity: 1,
      shadow: { enabled: false, color: '#00000040', blur: 8, offsetX: 0, offsetY: 4 },
      lineCap: 'round',
      arrowSize: 1
    } as ShapeNodeData,
    width: 280,
    height: 170,
    style: { width: 280, height: 170 }
  },
  {
    id: 'object-1766187646611',
    type: 'text',
    position: { x: 52, y: 10 },
    data: createTextData('Add a styled text object!'),
    width: 260,
    height: 40,
    style: { width: 260, height: 40 }
  },
  {
    id: 'object-1766187649812',
    type: 'sticky',
    position: { x: 120, y: 80 },
    data: {
      text: 'Have an idea you want to return to later? Drop a sticky note so you don\'t forget your killer idea!',
      backgroundColor: '#fef3c7',
      textColor: '#92400e',
      borderStyle: 'dotted'
    } as StickyNoteData,
    width: 180,
    height: 130,
    zIndex: 1,
    style: {}
  },
  {
    id: 'object-1766187657595',
    type: 'shape',
    position: { x: 340, y: 60 },
    data: {
      shapeType: 'hexagon',
      fillColor: '#6366f1',
      fillOpacity: 0.5,
      gradient: { enabled: false, type: 'linear', direction: 0, colors: [{ color: '#e5e7eb', position: 0 }, { color: '#d1d5db', position: 1 }] },
      strokeColor: '#6366f1',
      strokeWidth: 2,
      strokeOpacity: 1,
      strokeStyle: 'solid',
      text: '',
      textColor: '#374151',
      fontSize: 14,
      fontFamily: 'Inter',
      fontWeight: 400,
      fontStyle: 'normal',
      textAlign: 'center',
      borderRadius: 8,
      opacity: 1,
      shadow: { enabled: false, color: '#00000040', blur: 8, offsetX: 0, offsetY: 4 },
      lineCap: 'round',
      arrowSize: 1
    } as ShapeNodeData,
    width: 180,
    height: 160,
    style: { width: 180, height: 160 },
    zIndex: 0
  },
  {
    id: 'object-1766187867093',
    type: 'text',
    position: { x: 560, y: 30 },
    data: {
      ...createTextData('Replit'),
      hyperlink: {
        url: 'https://replit.com',
        text: 'Replit',
        showPreview: true,
        showText: false,
        metadata: {
          title: 'Replit – Build apps and sites with AI',
          description: 'Build and deploy software collaboratively with the power of AI without spending a second on setup.',
          image: 'https://replit.com/public/images/opengraph.png',
          siteName: 'replit',
          favicon: 'https://replit.com/public/icons/favicon-prompt-192.png'
        }
      }
    },
    width: 200,
    height: 100,
    style: { width: 200, height: 100 }
  },
  {
    id: 'canvas-object-1766187971025',
    type: 'text',
    position: { x: 556, y: -30 },
    data: {
      ...createTextData('You can even convert text objects to link previews!'),
      textColor: '#3b82f6'
    },
    width: 220,
    height: 60,
    style: { width: 220, height: 60 }
  },
  {
    id: 'object-1766188080940',
    type: 'shape',
    position: { x: 530, y: 150 },
    data: {
      shapeType: 'circle',
      fillColor: '#06b6d4',
      fillOpacity: 0.5,
      gradient: { enabled: false, type: 'linear', direction: 0, colors: [{ color: '#e5e7eb', position: 0 }, { color: '#d1d5db', position: 1 }] },
      strokeColor: '#06b6d4',
      strokeWidth: 2,
      strokeOpacity: 1,
      strokeStyle: 'solid',
      text: '',
      textColor: '#374151',
      fontSize: 14,
      fontFamily: 'Inter',
      fontWeight: 400,
      fontStyle: 'normal',
      textAlign: 'center',
      borderRadius: 8,
      opacity: 1,
      shadow: { enabled: false, color: '#00000040', blur: 8, offsetX: 0, offsetY: 4 },
      lineCap: 'round',
      arrowSize: 1
    } as ShapeNodeData,
    width: 140,
    height: 120,
    style: { width: 140, height: 120 }
  }
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

function calculateFitViewportForObjects(objects: CanvasObject[], containerWidth: number, containerHeight: number, padding: number = 30) {
  if (objects.length === 0) return { x: 0, y: 0, zoom: 1 };
  
  const minX = Math.min(...objects.map(o => o.position.x));
  const maxX = Math.max(...objects.map(o => o.position.x + (o.width || 200)));
  const minY = Math.min(...objects.map(o => o.position.y));
  const maxY = Math.max(...objects.map(o => o.position.y + (o.height || 100)));
  
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
  const [canvasObjects, setCanvasObjects] = useState<CanvasObject[]>(initialObjects);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (variant === 'hero') {
        const fitViewport = calculateFitViewport(HERO_NODES, rect.width, rect.height, 40);
        setViewport(fitViewport);
      } else if (variant === 'objects') {
        const fitViewport = calculateFitViewportForObjects(OBJECTS_DATA, rect.width, rect.height, 30);
        setViewport(fitViewport);
      }
    }
  }, [variant]);

  useEffect(() => {
    if ((variant !== 'hero' && variant !== 'objects') || !containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          if (variant === 'hero') {
            const fitViewport = calculateFitViewport(HERO_NODES, width, height, 40);
            setViewport(fitViewport);
          } else if (variant === 'objects') {
            const fitViewport = calculateFitViewportForObjects(OBJECTS_DATA, width, height, 30);
            setViewport(fitViewport);
          }
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

  const handleCanvasObjectsChange = useCallback((newObjects: CanvasObject[]) => {
    if (variant === 'objects') {
      setCanvasObjects(newObjects);
    }
  }, [variant]);

  const handleViewportChange = useCallback((newViewport: { x: number; y: number; zoom: number }) => {
    if (variant !== 'hero' && variant !== 'objects') {
      setViewport(newViewport);
    }
  }, [variant]);

  const isReadOnly = variant === 'hero';
  const disablePanZoom = variant === 'hero' || variant === 'objects';

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
          onCanvasObjectsChange={handleCanvasObjectsChange}
          onViewportChange={handleViewportChange}
          enablePlugins={false}
          showMiniMap={false}
          snapToGrid={false}
          readOnly={isReadOnly}
          disablePan={disablePanZoom}
          disableWheelZoom={disablePanZoom}
        />
      </div>
    </PluginProvider>
  );
}
