import { useState, useCallback, useEffect } from 'react';
import { WorkflowCanvas } from '@/components/WorkflowCanvas';
import { Sidebar } from '@/components/Sidebar';
import { Toolbar } from '@/components/Toolbar';
import { AiSettingsModal } from '@/components/AiSettingsModal';
import { AiWorkflowGenerator } from '@/components/AiWorkflowGenerator';
import { WorkflowImportModal } from '@/components/WorkflowImportModal';
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
      data: { label: 'Input Node', description: 'Data source configuration', icon: 'ArrowRight', iconColor: 'text-blue-500' },
      width: 200,
      height: 100
    },
    {
      id: 'node-2',
      type: 'ai',
      position: { x: 500, y: 100 },
      data: { label: 'AI Processor', description: 'Process data with AI\nModel: GPT-4o', icon: 'Bot', iconColor: 'text-purple-500' },
      width: 200,
      height: 120,
      selected: true
    },
    {
      id: 'node-3',
      type: 'condition',
      position: { x: 200, y: 300 },
      data: { label: 'Condition', description: 'Evaluate condition logic', icon: 'HelpCircle', iconColor: 'text-yellow-500' },
      width: 200,
      height: 100
    },
    {
      id: 'node-4',
      type: 'output',
      position: { x: 500, y: 300 },
      data: { label: 'Output', description: 'Final result destination', icon: 'ArrowLeft', iconColor: 'text-red-500' },
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node?: Node } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-2');
  const [viewport, setViewport] = useState({ x: 100, y: 100, zoom: 1 });

  // History management for undo/redo
  const [history, setHistory] = useState<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // AI Client setup - now uses backend proxy
  const aiClient = new OpenAICompatClient({
    baseURL: '/api', // Will use backend proxy
  });

  // Save current state to history
  const saveToHistory = useCallback(() => {
    const currentState = { nodes, edges };
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(currentState);
      // Limit history to 50 entries
      if (newHistory.length > 50) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [nodes, edges, historyIndex]);

  // Initialize history with current state
  useEffect(() => {
    if (history.length === 0) {
      saveToHistory();
    }
  }, []);

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setNodes(previousState.nodes);
      setEdges(previousState.edges);
      setHistoryIndex(prev => prev - 1);
      setSelectedNodeId('');
    }
  }, [history, historyIndex]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setHistoryIndex(prev => prev + 1);
      setSelectedNodeId('');
    }
  }, [history, historyIndex]);

  const handleNodesChange = useCallback((newNodes: Node[]) => {
    setNodes(newNodes);
  }, []);

  const handleEdgesChange = useCallback((newEdges: Edge[]) => {
    setEdges(newEdges);
  }, []);

  const handleConnect = useCallback((connection: { source: string; target: string }) => {
    saveToHistory(); // Save current state before connecting
    const newEdge: Edge = {
      id: `edge-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      type: 'bezier',
      data: { color: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 }
    };
    setEdges(prev => [...prev, newEdge]);
  }, [saveToHistory]);

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
    saveToHistory(); // Save current state before adding node
    const icons = {
      input: { icon: 'ArrowRight', color: 'text-blue-500' },
      process: { icon: 'Cog', color: 'text-green-500' },
      condition: { icon: 'HelpCircle', color: 'text-yellow-500' },
      output: { icon: 'ArrowLeft', color: 'text-red-500' },
      ai: { icon: 'Bot', color: 'text-purple-500' },
      image: { icon: 'Image', color: 'text-indigo-500' }
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
  }, [saveToHistory]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    saveToHistory(); // Save current state before deletion
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    setContextMenu(null);
  }, [saveToHistory]);

  const handleFitView = useCallback(() => {
    setViewport({ x: 100, y: 100, zoom: 1 });
  }, []);

  const handleZoomChange = useCallback((zoom: number) => {
    setViewport(prev => ({ ...prev, zoom }));
  }, []);

  const handleAiGenerate = useCallback((nodes: Node[], edges: Edge[]) => {
    saveToHistory(); // Save current state before AI generation
    setNodes(nodes);
    setEdges(edges);
    // Center the viewport on the generated workflow
    setViewport({ x: 50, y: 50, zoom: 0.8 });
  }, [saveToHistory]);

  // Keyboard event handling for deleting selected nodes and undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      // Delete selected nodes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          e.preventDefault();
          saveToHistory(); // Save current state before deletion
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
  }, [nodes, selectedNodeId, handleUndo, handleRedo, saveToHistory]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // Export workflow as JSON file
  const handleExportWorkflow = useCallback(() => {
    const workflowData = {
      version: "1.0.0",
      metadata: {
        name: "KiteFrame Workflow",
        description: "Exported workflow from KiteFrame editor",
        created: new Date().toISOString(),
        nodeCount: nodes.length,
        edgeCount: edges.length
      },
      nodes,
      edges,
      viewport
    };

    const jsonString = JSON.stringify(workflowData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `kiteframe-workflow-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [nodes, edges, viewport]);

  // Import workflow from JSON data
  const handleImportWorkflow = useCallback((newNodes: Node[], newEdges: Edge[], newViewport?: { x: number; y: number; zoom: number }) => {
    console.log('handleImportWorkflow called with:', newNodes.length, 'nodes,', newEdges.length, 'edges');
    console.log('New nodes:', newNodes);
    console.log('New edges:', newEdges);
    console.log('New viewport:', newViewport);
    
    saveToHistory(); // Save current state before import
    setNodes(newNodes);
    setEdges(newEdges);
    if (newViewport) {
      setViewport(newViewport);
    }
    setSelectedNodeId(''); // Clear selection
    setShowImportModal(false); // Close modal after successful import
    console.log('Import completed, modal closed');
  }, [saveToHistory]);

  return (
    <AiProvider client={aiClient}>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <Toolbar
          onNewWorkflow={() => {}}
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
            onExport={handleExportWorkflow}
            onImport={() => setShowImportModal(true)}
            onNodeUpdate={(nodeId, updates) => {
              setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
            }}
            onDeselectNode={() => {
              setNodes(prev => prev.map(n => ({ ...n, selected: false })));
              setSelectedNodeId('');
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
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < history.length - 1}
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

        {showImportModal && (
          <WorkflowImportModal
            onClose={() => setShowImportModal(false)}
            onImport={handleImportWorkflow}
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
