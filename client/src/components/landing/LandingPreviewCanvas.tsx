import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { KiteFrameCanvas, PluginProvider } from '@/lib/kiteframe';
import type { Node, Edge, CanvasObject, StickyNoteData, ShapeNodeData, TextNodeData } from '@/lib/kiteframe/types';

interface LandingPreviewCanvasProps {
  variant?: 'hero' | 'features' | 'objects' | 'kiteframe-demo';
}

const HERO_NODES: Node[] = [
  {
    id: '1',
    type: 'input',
    position: { x: 295.90, y: 390.62 },
    data: {
      label: 'User Signs Up',
      description: 'You create an account and log in',
      icon: 'UserPlus',
      iconColor: 'hsl(142, 76%, 36%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
  {
    id: '2',
    type: 'ai',
    position: { x: 545.90, y: 251.37 },
    data: {
      label: 'Prompt Chat',
      description: 'You describe your project idea via chat interface',
      icon: 'MessageSquare',
      iconColor: 'hsl(221, 83%, 53%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
  {
    id: '3',
    type: 'process',
    position: { x: 545.90, y: 390.62 },
    data: {
      label: 'Project Created',
      description: 'New project tab opens with initial structure',
      icon: 'FolderPlus',
      iconColor: 'hsl(262, 83%, 58%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
  {
    id: '4',
    type: 'ai',
    position: { x: 545.90, y: 522.74 },
    data: {
      label: 'Refine with Agent',
      description: 'In-project AI agent helps refine scope and details',
      icon: 'Bot',
      iconColor: 'hsl(221, 83%, 53%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
  {
    id: '5',
    type: 'ai',
    position: { x: 826.95, y: 251.37 },
    data: {
      label: 'Generate PRD',
      description: 'AI creates comprehensive Product Requirements Document',
      icon: 'FileText',
      iconColor: 'hsl(24, 95%, 53%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
  {
    id: '6',
    type: 'ai',
    position: { x: 826.95, y: 390.62 },
    data: {
      label: 'Generate Workflow',
      description: 'AI builds visual workflow with nodes and edges',
      icon: 'GitBranch',
      iconColor: 'hsl(24, 95%, 53%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
  {
    id: '7',
    type: 'process',
    position: { x: 826.95, y: 522.74 },
    data: {
      label: 'Export Bundle',
      description: 'Package PRD + workflow as .kiteframe project bundle',
      icon: 'Download',
      iconColor: 'hsl(173, 58%, 39%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
  {
    id: '8',
    type: 'process',
    position: { x: 1099.98, y: 390.62 },
    data: {
      label: 'Handoff',
      description: 'You share the project bundle with PMs and engineers for implementation',
      icon: 'Send',
      iconColor: 'hsl(262, 83%, 58%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
  {
    id: '9',
    type: 'output',
    position: { x: 1346.40, y: 390.62 },
    data: {
      label: 'SUCCESS! 🎉',
      description: 'Your team has clear specs and workflow to build from, on time and under budget',
      icon: 'CheckCircle2',
      iconColor: 'hsl(142, 76%, 36%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
];

const HERO_EDGES: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'e2-3', source: '2', target: '3', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'e3-4', source: '3', target: '4', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'e4-5', source: '4', target: '5', type: 'step', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'e5-6', source: '5', target: '6', type: 'bezier', style: { strokeColor: '#3b82f6', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'e6-7', source: '6', target: '7', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'e7-8', source: '7', target: '8', type: 'step', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'e8-9', source: '8', target: '9', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
];

const HERO_MOBILE_NODES: Node[] = [
  {
    id: 'mobile-node-1',
    type: 'input',
    position: { x: 278.96, y: -100 },
    data: {
      label: 'User Signs Up',
      description: 'You create an account and log in',
      icon: 'UserPlus',
      iconColor: 'hsl(142, 76%, 36%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
  {
    id: 'mobile-node-2',
    type: 'ai',
    position: { x: 278.96, y: 35 },
    data: {
      label: 'Prompt Chat',
      description: 'You describe your project idea via chat interface',
      icon: 'MessageSquare',
      iconColor: 'hsl(221, 83%, 53%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
  {
    id: 'mobile-node-3',
    type: 'ai',
    position: { x: 278.96, y: 170 },
    data: {
      label: 'Refine with Agent',
      description: 'In-project AI agent helps refine scope and details',
      icon: 'Bot',
      iconColor: 'hsl(221, 83%, 53%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
  {
    id: 'mobile-node-4',
    type: 'ai',
    position: { x: 278.96, y: 305 },
    data: {
      label: 'Generate PRD',
      description: 'AI creates comprehensive Product Requirements Document',
      icon: 'FileText',
      iconColor: 'hsl(24, 95%, 53%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
  {
    id: 'mobile-node-5',
    type: 'process',
    position: { x: 278.96, y: 440 },
    data: {
      label: 'Export Bundle',
      description: 'Package PRD + workflow as .kiteframe project bundle',
      icon: 'Download',
      iconColor: 'hsl(173, 58%, 39%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
  {
    id: 'mobile-node-6',
    type: 'output',
    position: { x: 278.96, y: 575 },
    data: {
      label: 'SUCCESS! 🎉',
      description: 'Your team has clear specs and workflow to build from',
      icon: 'CheckCircle2',
      iconColor: 'hsl(142, 76%, 36%)',
    },
    width: 200, height: 100, draggable: false, selectable: false, doubleClickable: false,
  },
];

const HERO_MOBILE_EDGES: Edge[] = [
  { id: 'mobile-edge-1', source: 'mobile-node-1', target: 'mobile-node-2', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'mobile-edge-2', source: 'mobile-node-2', target: 'mobile-node-3', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'mobile-edge-3', source: 'mobile-node-3', target: 'mobile-node-4', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'mobile-edge-4', source: 'mobile-node-4', target: 'mobile-node-5', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'mobile-edge-5', source: 'mobile-node-5', target: 'mobile-node-6', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
];

const KITEFRAME_DEMO_NODES: Node[] = [
  {
    id: '1',
    type: 'input',
    position: { x: 295.90, y: 390.62 },
    data: {
      label: 'User Signs Up',
      description: 'You create an account and log in',
      icon: 'UserPlus',
      iconColor: 'hsl(142, 76%, 36%)',
    },
    width: 200, height: 100,
    draggable: true, selectable: false, doubleClickable: false,
  },
  {
    id: '2',
    type: 'ai',
    position: { x: 545.90, y: 251.37 },
    data: {
      label: 'Prompt Chat',
      description: 'You describe your project idea via chat interface',
      icon: 'MessageSquare',
      iconColor: 'hsl(221, 83%, 53%)',
    },
    width: 200, height: 100,
    draggable: true, selectable: false, doubleClickable: false,
  },
  {
    id: '3',
    type: 'process',
    position: { x: 545.90, y: 390.62 },
    data: {
      label: 'Project Created',
      description: 'New project tab opens with initial structure',
      icon: 'FolderPlus',
      iconColor: 'hsl(262, 83%, 58%)',
    },
    width: 200, height: 100,
    draggable: true, selectable: false, doubleClickable: false,
  },
  {
    id: '4',
    type: 'ai',
    position: { x: 545.90, y: 522.74 },
    data: {
      label: 'Refine with Agent',
      description: 'In-project AI agent helps refine scope and details',
      icon: 'Bot',
      iconColor: 'hsl(221, 83%, 53%)',
    },
    width: 200, height: 100,
    draggable: true, selectable: false, doubleClickable: false,
  },
  {
    id: '5',
    type: 'ai',
    position: { x: 826.95, y: 251.37 },
    data: {
      label: 'Generate PRD',
      description: 'AI creates comprehensive Product Requirements Document',
      icon: 'FileText',
      iconColor: 'hsl(24, 95%, 53%)',
    },
    width: 200, height: 100,
    draggable: true, selectable: false, doubleClickable: false,
  },
  {
    id: '6',
    type: 'ai',
    position: { x: 826.95, y: 390.62 },
    data: {
      label: 'Generate Workflow',
      description: 'AI builds visual workflow with nodes and edges',
      icon: 'GitBranch',
      iconColor: 'hsl(24, 95%, 53%)',
    },
    width: 200, height: 100,
    draggable: true, selectable: false, doubleClickable: false,
  },
  {
    id: '7',
    type: 'process',
    position: { x: 826.95, y: 522.74 },
    data: {
      label: 'Export Bundle',
      description: 'Package PRD + workflow as .kiteframe project bundle',
      icon: 'Download',
      iconColor: 'hsl(173, 58%, 39%)',
    },
    width: 200, height: 100,
    draggable: true, selectable: false, doubleClickable: false,
  },
  {
    id: '8',
    type: 'process',
    position: { x: 1099.98, y: 390.62 },
    data: {
      label: 'Handoff',
      description: 'You share the project bundle with PMs and engineers for implementation',
      icon: 'Send',
      iconColor: 'hsl(262, 83%, 58%)',
    },
    width: 200, height: 100,
    draggable: true, selectable: false, doubleClickable: false,
  },
  {
    id: '9',
    type: 'output',
    position: { x: 1346.40, y: 390.62 },
    data: {
      label: 'SUCCESS! 🎉',
      description: 'Your team has clear specs and workflow to build from, on time and under budget',
      icon: 'CheckCircle2',
      iconColor: 'hsl(142, 76%, 36%)',
    },
    width: 200, height: 100,
    draggable: true, selectable: false, doubleClickable: false,
  },
];

const KITEFRAME_DEMO_EDGES: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true },
  { id: 'e2-3', source: '2', target: '3', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true },
  { id: 'e3-4', source: '3', target: '4', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true },
  { id: 'e4-5', source: '4', target: '5', type: 'step', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true },
  { id: 'e5-6', source: '5', target: '6', type: 'bezier', style: { strokeColor: '#3b82f6', strokeWidth: 2 }, markerEnd: true },
  { id: 'e6-7', source: '6', target: '7', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true },
  { id: 'e7-8', source: '7', target: '8', type: 'step', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true },
  { id: 'e8-9', source: '8', target: '9', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true },
];

const FEATURE_NODES: Node[] = [
  {
    id: 'f1',
    type: 'input',
    position: { x: 0, y: 115 },
    data: {
      label: 'User Signs Up',
      description: 'New user creates account',
      icon: 'User',
      iconColor: 'hsl(221.2, 83.2%, 53.3%)',
    },
    draggable: false,
    selectable: false,
    doubleClickable: false,
    width: 105,
    height: 50,
  },
  {
    id: 'f2',
    type: 'process',
    position: { x: 120, y: 115 },
    data: {
      label: 'Welcome Screen',
      description: 'Show value prop and next steps',
      icon: 'Sparkles',
      iconColor: 'hsl(262.1, 83.3%, 57.8%)',
    },
    draggable: false,
    selectable: false,
    doubleClickable: false,
    width: 105,
    height: 50,
  },
  {
    id: 'f3',
    type: 'condition',
    position: { x: 240, y: 115 },
    data: {
      label: 'Account Type?',
      description: 'Free or Pro selection',
      icon: 'GitBranch',
      iconColor: 'hsl(47.9, 95.8%, 53.1%)',
    },
    draggable: false,
    selectable: false,
    doubleClickable: false,
    width: 105,
    height: 50,
  },
  {
    id: 'f4',
    type: 'process',
    position: { x: 360, y: 50 },
    data: {
      label: 'Pro Upgrade Flow',
      description: 'Show pricing, features, payment',
      icon: 'Crown',
      iconColor: 'hsl(47.9, 95.8%, 53.1%)',
    },
    draggable: false,
    selectable: false,
    doubleClickable: false,
    width: 105,
    height: 50,
  },
  {
    id: 'f5',
    type: 'process',
    position: { x: 360, y: 180 },
    data: {
      label: 'Skip to Free',
      description: 'Continue with free tier',
      icon: 'ArrowRight',
      iconColor: 'hsl(142.1, 76.2%, 36.3%)',
    },
    draggable: false,
    selectable: false,
    doubleClickable: false,
    width: 105,
    height: 50,
  },
  {
    id: 'f6',
    type: 'process',
    position: { x: 480, y: 115 },
    data: {
      label: 'Project Setup',
      description: 'Create first project screen',
      icon: 'FolderPlus',
      iconColor: 'hsl(221.2, 83.2%, 53.3%)',
    },
    draggable: false,
    selectable: false,
    doubleClickable: false,
    width: 105,
    height: 50,
  },
  {
    id: 'f7',
    type: 'input',
    position: { x: 600, y: 115 },
    data: {
      label: 'Project Details',
      description: 'Name, description, template selection',
      icon: 'FileText',
      iconColor: 'hsl(262.1, 83.3%, 57.8%)',
    },
    draggable: false,
    selectable: false,
    doubleClickable: false,
    width: 105,
    height: 50,
  },
  {
    id: 'f8',
    type: 'ai',
    position: { x: 720, y: 115 },
    data: {
      label: 'AI Canvas Setup',
      description: 'Generate initial workflow nodes',
      icon: 'Sparkles',
      iconColor: 'hsl(262.1, 83.3%, 57.8%)',
    },
    draggable: false,
    selectable: false,
    doubleClickable: false,
    width: 105,
    height: 50,
  },
  {
    id: 'f9',
    type: 'output',
    position: { x: 840, y: 115 },
    data: {
      label: 'Canvas Ready',
      description: 'User lands in working canvas',
      icon: 'CheckCircle',
      iconColor: 'hsl(142.1, 76.2%, 36.3%)',
    },
    draggable: false,
    selectable: false,
    doubleClickable: false,
    width: 105,
    height: 50,
  },
];

const FEATURE_EDGES: Edge[] = [
  { id: 'fe1-2', source: 'f1', target: 'f2', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'fe2-3', source: 'f2', target: 'f3', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'fe3-4', source: 'f3', target: 'f4', type: 'bezier', style: { strokeColor: 'hsl(47.9, 95.8%, 53.1%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'fe3-5', source: 'f3', target: 'f5', type: 'bezier', style: { strokeColor: 'hsl(142.1, 76.2%, 36.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'fe4-6', source: 'f4', target: 'f6', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'fe5-6', source: 'f5', target: 'f6', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'fe6-7', source: 'f6', target: 'f7', type: 'bezier', style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'fe7-8', source: 'f7', target: 'f8', type: 'bezier', style: { strokeColor: 'hsl(262.1, 83.3%, 57.8%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
  { id: 'fe8-9', source: 'f8', target: 'f9', type: 'bezier', style: { strokeColor: 'hsl(142.1, 76.2%, 36.3%)', strokeWidth: 2 }, markerEnd: true, interactable: false },
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
  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const initialNodes = variant === 'hero' ? HERO_NODES : variant === 'features' ? FEATURE_NODES : variant === 'kiteframe-demo' ? KITEFRAME_DEMO_NODES : [];
  const initialEdges = variant === 'hero' ? HERO_EDGES : variant === 'features' ? FEATURE_EDGES : variant === 'kiteframe-demo' ? KITEFRAME_DEMO_EDGES : [];
  const initialObjects = variant === 'objects' ? OBJECTS_DATA : [];

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [canvasObjects, setCanvasObjects] = useState<CanvasObject[]>(initialObjects);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [mobileViewport, setMobileViewport] = useState({ x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (variant === 'hero') {
        const fitViewport = calculateFitViewport(HERO_NODES, rect.width, rect.height, 40);
        setViewport(fitViewport);
      } else if (variant === 'objects') {
        const fitViewport = calculateFitViewportForObjects(OBJECTS_DATA, rect.width, rect.height, 30);
        setViewport(fitViewport);
      } else if (variant === 'kiteframe-demo') {
        const fitViewport = calculateFitViewport(KITEFRAME_DEMO_NODES, rect.width, rect.height, 40);
        setViewport(fitViewport);
      }
    }
    if (variant === 'hero' && mobileContainerRef.current) {
      const rect = mobileContainerRef.current.getBoundingClientRect();
      const fitViewport = calculateFitViewport(HERO_MOBILE_NODES, rect.width, rect.height, 20);
      setMobileViewport(fitViewport);
    }
  }, [variant]);

  useEffect(() => {
    if ((variant !== 'hero' && variant !== 'objects' && variant !== 'kiteframe-demo') || !containerRef.current) return;
    
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
          } else if (variant === 'kiteframe-demo') {
            const fitViewport = calculateFitViewport(KITEFRAME_DEMO_NODES, width, height, 40);
            setViewport(fitViewport);
          }
        }
      }
    });
    
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [variant]);

  useEffect(() => {
    if (variant !== 'hero' || !mobileContainerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const fitViewport = calculateFitViewport(HERO_MOBILE_NODES, width, height, 20);
          setMobileViewport(fitViewport);
        }
      }
    });
    
    resizeObserver.observe(mobileContainerRef.current);
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

  if (variant === 'hero') {
    return (
      <PluginProvider>
        <div 
          ref={containerRef}
          className="hidden md:block"
          style={canvasStyle}
          data-testid="landing-canvas-hero-desktop"
        >
          <KiteFrameCanvas
            nodes={HERO_NODES}
            edges={HERO_EDGES}
            canvasObjects={[]}
            viewport={viewport}
            onNodesChange={() => {}}
            onEdgesChange={() => {}}
            onCanvasObjectsChange={() => {}}
            onViewportChange={() => {}}
            enablePlugins={false}
            showMiniMap={false}
            snapToGrid={false}
            readOnly={true}
            disablePan={true}
            disableWheelZoom={true}
          />
        </div>
        <div 
          ref={mobileContainerRef}
          className="block md:hidden"
          style={canvasStyle}
          data-testid="landing-canvas-hero-mobile"
        >
          <KiteFrameCanvas
            nodes={HERO_MOBILE_NODES}
            edges={HERO_MOBILE_EDGES}
            canvasObjects={[]}
            viewport={mobileViewport}
            onNodesChange={() => {}}
            onEdgesChange={() => {}}
            onCanvasObjectsChange={() => {}}
            onViewportChange={() => {}}
            enablePlugins={false}
            showMiniMap={false}
            snapToGrid={false}
            readOnly={true}
            disablePan={true}
            disableWheelZoom={true}
          />
        </div>
      </PluginProvider>
    );
  }

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
