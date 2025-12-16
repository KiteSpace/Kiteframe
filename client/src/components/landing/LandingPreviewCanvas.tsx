import { useState, useCallback, useMemo } from 'react';
import { KiteFrameCanvas, PluginProvider } from '@/lib/kiteframe';
import type { Node, Edge, CanvasObject, StickyNoteData, ShapeNodeData, TextNodeData } from '@/lib/kiteframe/types';

interface LandingPreviewCanvasProps {
  variant?: 'hero' | 'features' | 'objects';
}

const HERO_NODES: Node[] = [
  {
    id: 'process',
    type: 'process',
    position: { x: 60, y: 160 },
    data: { label: 'Process' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 120,
    height: 60,
  },
  {
    id: 'table',
    type: 'table',
    position: { x: 240, y: 160 },
    data: { label: 'Table', columns: [], rows: [] },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 120,
    height: 60,
  },
  {
    id: 'form',
    type: 'form',
    position: { x: 420, y: 160 },
    data: { label: 'Form', fields: [] },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 120,
    height: 60,
  },
  {
    id: 'code',
    type: 'code',
    position: { x: 600, y: 160 },
    data: { label: 'Code', language: 'javascript', code: '' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 120,
    height: 60,
  },
  {
    id: 'figma',
    type: 'webview',
    position: { x: 780, y: 160 },
    data: { label: 'Figma', url: '' },
    draggable: true,
    selectable: false,
    doubleClickable: false,
    width: 120,
    height: 60,
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

export default function LandingPreviewCanvas({ variant = 'hero' }: LandingPreviewCanvasProps) {
  const initialNodes = variant === 'hero' ? HERO_NODES : variant === 'features' ? FEATURE_NODES : [];
  const initialEdges = variant === 'hero' ? HERO_EDGES : variant === 'features' ? FEATURE_EDGES : [];
  const initialObjects = variant === 'objects' ? OBJECTS_DATA : [];

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [canvasObjects] = useState<CanvasObject[]>(initialObjects);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  const handleNodesChange = useCallback((newNodes: Node[]) => {
    setNodes(newNodes);
  }, []);

  const handleEdgesChange = useCallback((newEdges: Edge[]) => {
    setEdges(newEdges);
  }, []);

  const handleViewportChange = useCallback((newViewport: { x: number; y: number; zoom: number }) => {
    setViewport(newViewport);
  }, []);

  const canvasStyle = useMemo(() => ({
    width: '100%',
    height: '100%',
    background: 'transparent',
  }), []);

  return (
    <PluginProvider>
      <div 
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
        />
      </div>
    </PluginProvider>
  );
}
