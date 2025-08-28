import { useState, useCallback, useEffect } from 'react';
import { WorkflowCanvas } from '@/components/WorkflowCanvas';
import { Sidebar } from '@/components/Sidebar';
import { Toolbar } from '@/components/Toolbar';
import { AiSettingsModal } from '@/components/AiSettingsModal';
import { AiWorkflowGenerator } from '@/components/AiWorkflowGenerator';
import { ContextMenu } from '@/components/ContextMenu';
import { AiProvider } from '../ai/AiProvider';
import { OpenAICompatClient } from '../ai/OpenAICompatClient';
import type { Node, Edge } from '../lib/kiteframe/types';
import '../lib/kiteframe/styles/kiteframe.css';

export default function WorkflowEditor() {
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: 'node-1',
      type: 'input',
      position: { x: 200, y: 100 },
      data: { label: 'Input Node', description: 'Data source configuration', icon: 'fas fa-sign-in-alt', iconColor: 'text-blue-500' },
      width: 200,
      height: 100
    },
    {
      id: 'node-2',
      type: 'ai',
      position: { x: 500, y: 100 },
      data: { label: 'AI Processor', description: 'Process data with AI\nModel: GPT-5', icon: 'fas fa-robot', iconColor: 'text-purple-500' },
      width: 200,
      height: 120,
      selected: true
    },
    {
      id: 'node-3',
      type: 'condition',
      position: { x: 200, y: 300 },
      data: { label: 'Condition', description: 'Evaluate condition logic', icon: 'fas fa-question-circle', iconColor: 'text-yellow-500' },
      width: 200,
      height: 100
    },
    {
      id: 'node-4',
      type: 'output',
      position: { x: 500, y: 300 },
      data: { label: 'Output', description: 'Final result destination', icon: 'fas fa-sign-out-alt', iconColor: 'text-red-500' },
      width: 200,
      height: 100
    }
  ]);
  const [edges, setEdges] = useState<Edge[]>([
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      type: 'bezier',
      data: { color: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }
    },
    {
      id: 'edge-2',
      source: 'node-3',
      target: 'node-2',
      type: 'bezier',
      animated: true,
      data: { color: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }
    }
  ]);

  const [showAiModal, setShowAiModal] = useState(false);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node?: Node } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-2');
  const [viewport, setViewport] = useState({ x: 100, y: 100, zoom: 1 });

  // AI Client setup
  const aiClient = new OpenAICompatClient({
    baseURL: 'https://api.openai.com',
    apiKey: import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('openai_api_key') || ''
  });

  const handleNodesChange = useCallback((newNodes: Node[]) => {
    setNodes(newNodes);
  }, []);

  const handleEdgesChange = useCallback((newEdges: Edge[]) => {
    setEdges(newEdges);
  }, []);

  const handleConnect = useCallback((connection: { source: string; target: string }) => {
    const newEdge: Edge = {
      id: `edge-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      type: 'bezier',
      data: { color: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }
    };
    setEdges(prev => [...prev, newEdge]);
  }, []);

  const handleNodeClick = useCallback((e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    if (!e.shiftKey) {
      setNodes(prev => prev.map(n => ({ ...n, selected: n.id === node.id })));
    } else {
      setNodes(prev => prev.map(n => n.id === node.id ? { ...n, selected: !n.selected } : n));
    }
    setSelectedNodeId(node.id);
  }, []);

  const handleNodeRightClick = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleCanvasClick = useCallback(() => {
    setNodes(prev => prev.map(n => ({ ...n, selected: false })));
    setSelectedNodeId('');
    setContextMenu(null);
  }, []);

  const handleCreateNode = useCallback((type: string) => {
    const icons = {
      input: { icon: 'fas fa-sign-in-alt', color: 'text-blue-500' },
      process: { icon: 'fas fa-cogs', color: 'text-green-500' },
      condition: { icon: 'fas fa-question-circle', color: 'text-yellow-500' },
      output: { icon: 'fas fa-sign-out-alt', color: 'text-red-500' },
      ai: { icon: 'fas fa-robot', color: 'text-purple-500' },
      image: { icon: 'fas fa-image', color: 'text-indigo-500' }
    };

    const newNode: Node = {
      id: `node-${Date.now()}`,
      type,
      position: { x: 400, y: 250 },
      data: {
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
        description: `Configure ${type} settings`,
        icon: icons[type as keyof typeof icons]?.icon || 'fas fa-cube',
        iconColor: icons[type as keyof typeof icons]?.color || 'text-gray-500'
      },
      width: 200,
      height: 100
    };

    setNodes(prev => [...prev, newNode]);
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    setContextMenu(null);
  }, []);

  const handleFitView = useCallback(() => {
    setViewport({ x: 100, y: 100, zoom: 1 });
  }, []);

  const handleZoomChange = useCallback((zoom: number) => {
    setViewport(prev => ({ ...prev, zoom }));
  }, []);

  const handleAiGenerate = useCallback((nodes: Node[], edges: Edge[]) => {
    setNodes(nodes);
    setEdges(edges);
    // Center the viewport on the generated workflow
    setViewport({ x: 50, y: 50, zoom: 0.8 });
  }, []);

  // Keyboard event handling for deleting selected nodes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          const selectedNodeIds = selectedNodes.map(n => n.id);
          // Remove selected nodes
          setNodes(prev => prev.filter(n => !n.selected));
          // Remove edges connected to deleted nodes
          setEdges(prev => prev.filter(e => 
            !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)
          ));
          // Clear selected node ID if it was deleted
          if (selectedNodeIds.includes(selectedNodeId)) {
            setSelectedNodeId('');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, selectedNodeId]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <AiProvider client={aiClient}>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <Toolbar
          onNewWorkflow={() => {}}
          onOpenWorkflow={() => {}}
          onSaveWorkflow={() => {}}
          onOpenAiSettings={() => setShowAiModal(true)}
          onOpenAiGenerator={() => setShowAiGenerator(true)}
          zoom={viewport.zoom}
        />
        
        <div className="flex flex-1">
          <Sidebar
            selectedNode={selectedNode}
            onCreateNode={handleCreateNode}
            onFitView={handleFitView}
            onClearCanvas={() => { setNodes([]); setEdges([]); }}
            onExport={() => {}}
            onNodeUpdate={(nodeId, updates) => {
              setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
            }}
          />
          
          <main className="flex-1 relative">
            <WorkflowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onNodeClick={handleNodeClick}
              onCanvasClick={handleCanvasClick}
              onNodeRightClick={handleNodeRightClick}
              viewport={viewport}
              onViewportChange={setViewport}
            />
          </main>
        </div>

        {showAiModal && (
          <AiSettingsModal
            onClose={() => setShowAiModal(false)}
            onSave={(settings) => {
              // Save AI settings to localStorage for demo
              localStorage.setItem('ai_settings', JSON.stringify(settings));
              if (settings.apiKey) {
                localStorage.setItem('openai_api_key', settings.apiKey);
              }
              setShowAiModal(false);
            }}
          />
        )}

        {showAiGenerator && (
          <AiWorkflowGenerator
            onClose={() => setShowAiGenerator(false)}
            onGenerate={handleAiGenerate}
          />
        )}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onDelete={() => contextMenu.node && handleDeleteNode(contextMenu.node.id)}
            onDuplicate={() => {
              if (contextMenu.node) {
                const duplicated = {
                  ...contextMenu.node,
                  id: `node-${Date.now()}`,
                  position: { x: contextMenu.node.position.x + 50, y: contextMenu.node.position.y + 50 }
                };
                setNodes(prev => [...prev, duplicated]);
              }
              setContextMenu(null);
            }}
            onCopy={() => {
              if (contextMenu.node) {
                navigator.clipboard.writeText(JSON.stringify(contextMenu.node));
              }
              setContextMenu(null);
            }}
          />
        )}
      </div>
    </AiProvider>
  );
}
