import { useState, useCallback, useEffect, useMemo } from 'react';
import { WorkflowCanvas } from '@/components/WorkflowCanvas';
import { Sidebar } from '@/components/Sidebar';
import { EdgeCustomizer } from '@/components/EdgeCustomizer';
import { Toolbar } from '@/components/Toolbar';
import { AiSettingsModal } from '@/components/AiSettingsModal';
import { AiWorkflowGenerator } from '@/components/AiWorkflowGenerator';
import { WorkflowImportModal } from '@/components/WorkflowImportModal';
import { ContextMenu } from '@/components/ContextMenu';
import { MissingImagesModal } from '@/components/MissingImagesModal';
import { AiProvider } from '../ai/AiProvider';
import { OpenAICompatClient } from '../ai/OpenAICompatClient';
import { ObjectUploader } from '@/components/ObjectUploader';
import type { Node, Edge } from '../lib/kiteframe/types';
import '../lib/kiteframe/styles/kiteframe.css';
import { X, Plus } from 'lucide-react';

// Type for a single workflow tab
interface WorkflowTab {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  selectedNodeId: string;
  selectedEdgeId: string;
  history: Array<{ nodes: Node[]; edges: Edge[]; viewport: { x: number; y: number; zoom: number } }>;
  historyIndex: number;
  showImageModal: string | null;
}

export default function WorkflowEditor() {
  // Generate unique ID for tabs
  const generateTabId = useCallback(() => `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);
  
  // Generate cute workflow names
  const generateCuteName = useCallback(() => {
    const adjectives = [
      'Sunny', 'Happy', 'Magic', 'Bright', 'Cozy', 'Sweet', 'Clever', 'Gentle', 
      'Peaceful', 'Cheerful', 'Dreamy', 'Sparkly', 'Golden', 'Fresh', 'Lovely'
    ];
    const nouns = [
      'Adventure', 'Journey', 'Flow', 'Quest', 'Path', 'Dream', 'Story', 'Project',
      'Creation', 'Vision', 'Wonder', 'Discovery', 'Symphony', 'Garden', 'Blueprint'
    ];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj} ${noun}`;
  }, []);

  // Create default tab with sample data
  const createDefaultTab = useCallback((): WorkflowTab => ({
    id: generateTabId(),
    name: generateCuteName(),
    nodes: [
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
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'bezier',
        style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 },
        markers: { type: 'arrow', position: 'end' }
      },
      {
        id: 'edge-2',
        source: 'node-3',
        target: 'node-2',
        type: 'bezier',
        animated: true,
        style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 },
        markers: { type: 'arrow', position: 'end' }
      }
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeId: 'node-2',
    selectedEdgeId: '',
    history: [],
    historyIndex: -1,
    showImageModal: null
  }), [generateTabId, generateCuteName]);

  // Create blank tab
  const createBlankTab = useCallback((): WorkflowTab => ({
    id: generateTabId(),
    name: generateCuteName(),
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeId: '',
    selectedEdgeId: '',
    history: [],
    historyIndex: -1,
    showImageModal: null
  }), [generateTabId, generateCuteName]);

  // Tab management state
  const [tabs, setTabs] = useState<WorkflowTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');

  // Initialize tabs on first render
  useEffect(() => {
    if (tabs.length === 0) {
      const defaultTab = createDefaultTab();
      setTabs([defaultTab]);
      setActiveTabId(defaultTab.id);
    }
  }, [createDefaultTab]);

  // Get current active tab
  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  // Convenience getters for current tab state
  const nodes = activeTab?.nodes || [];
  const edges = activeTab?.edges || [];
  const viewport = activeTab?.viewport || { x: 0, y: 0, zoom: 1 };
  const selectedNodeId = activeTab?.selectedNodeId || '';
  const selectedEdgeId = activeTab?.selectedEdgeId || '';
  const history = activeTab?.history || [];
  const historyIndex = activeTab?.historyIndex || -1;
  const showImageModal = activeTab?.showImageModal || null;

  // Update current tab
  const updateActiveTab = useCallback((updates: Partial<WorkflowTab>) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId ? { ...tab, ...updates } : tab
    ));
  }, [activeTabId]);

  // Setters that update the active tab
  const setNodes = useCallback((newNodes: Node[] | ((prev: Node[]) => Node[])) => {
    const resolvedNodes = typeof newNodes === 'function' ? newNodes(nodes) : newNodes;
    updateActiveTab({ nodes: resolvedNodes });
  }, [nodes, updateActiveTab]);

  const setEdges = useCallback((newEdges: Edge[] | ((prev: Edge[]) => Edge[])) => {
    const resolvedEdges = typeof newEdges === 'function' ? newEdges(edges) : newEdges;
    updateActiveTab({ edges: resolvedEdges });
  }, [edges, updateActiveTab]);

  const setViewport = useCallback((newViewport: { x: number; y: number; zoom: number } | ((prev: { x: number; y: number; zoom: number }) => { x: number; y: number; zoom: number })) => {
    const resolvedViewport = typeof newViewport === 'function' ? newViewport(viewport) : newViewport;
    updateActiveTab({ viewport: resolvedViewport });
  }, [viewport, updateActiveTab]);

  const setSelectedNodeId = useCallback((id: string) => {
    updateActiveTab({ selectedNodeId: id });
  }, [updateActiveTab]);

  const setSelectedEdgeId = useCallback((id: string) => {
    updateActiveTab({ selectedEdgeId: id });
  }, [updateActiveTab]);

  const setShowImageModal = useCallback((nodeId: string | null) => {
    updateActiveTab({ showImageModal: nodeId });
  }, [updateActiveTab]);

  const setWorkflowName = useCallback((name: string) => {
    updateActiveTab({ name });
  }, [updateActiveTab]);

  // Tab operations
  const createNewTab = useCallback(() => {
    const newTab = createBlankTab();
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [createBlankTab]);

  const closeTab = useCallback((tabId: string) => {
    if (tabs.length <= 1) return; // Don't close the last tab
    
    setTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      // If we're closing the active tab, switch to the previous tab or first tab
      if (tabId === activeTabId) {
        const closingIndex = prev.findIndex(tab => tab.id === tabId);
        const newActiveTab = newTabs[Math.max(0, closingIndex - 1)] || newTabs[0];
        setActiveTabId(newActiveTab.id);
      }
      return newTabs;
    });
  }, [tabs.length, activeTabId]);

  const renameTab = useCallback((tabId: string, newName: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, name: newName } : tab
    ));
  }, []);

  // Other UI state
  const [showAiModal, setShowAiModal] = useState(false);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node?: Node } | null>(null);
  const [aiClient, setAiClient] = useState<OpenAICompatClient>(() => {
    return new OpenAICompatClient({
      baseURL: localStorage.getItem('aiBaseURL') || 'https://api.openai.com/v1',
      apiKey: localStorage.getItem('aiApiKey') || ''
    });
  });

  // Save current state to history
  const saveToHistory = useCallback(() => {
    const currentState = { nodes, edges, viewport };
    updateActiveTab({
      history: [...history.slice(0, historyIndex + 1), currentState].slice(-50), // Limit to 50 entries
      historyIndex: Math.min(historyIndex + 1, 49)
    });
  }, [nodes, edges, viewport, history, historyIndex, updateActiveTab]);

  // Initialize history with current state
  useEffect(() => {
    if (history.length === 0) {
      saveToHistory();
    }
  }, [activeTabId]); // Re-initialize when switching tabs

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      updateActiveTab({
        nodes: previousState.nodes,
        edges: previousState.edges,
        viewport: previousState.viewport,
        historyIndex: historyIndex - 1
      });
    }
  }, [history, historyIndex, updateActiveTab]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      updateActiveTab({
        nodes: nextState.nodes,
        edges: nextState.edges,
        viewport: nextState.viewport,
        historyIndex: historyIndex + 1
      });
    }
  }, [history, historyIndex, updateActiveTab]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Rest of the component implementation would go here...
  // For now, let me just return a basic structure

  return (
    <AiProvider client={aiClient}>
      <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <Toolbar
          onOpenAiSettings={() => setShowAiModal(true)}
        />
        
        {/* Tab Bar */}
        <div className="flex items-center bg-card border-b border-border px-4 py-2">
          <div className="flex items-center space-x-1 flex-1 overflow-x-auto">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-md cursor-pointer min-w-0 ${
                  tab.id === activeTabId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTabId(tab.id)}
                data-testid={`tab-${tab.id}`}
              >
                <span className="truncate text-sm font-medium max-w-32">{tab.name}</span>
                {tabs.length > 1 && (
                  <button
                    className="ml-1 hover:bg-background/20 rounded p-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    data-testid={`close-tab-${tab.id}`}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            <button
              className="flex items-center justify-center w-8 h-8 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={createNewTab}
              data-testid="button-new-tab"
              title="New Workflow Tab"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Sidebar */}
          <div className="w-80 border-r border-border flex flex-col">
            <Sidebar
              selectedNode={nodes.find(n => n.id === selectedNodeId)}
              onCreateNode={(type: string) => {
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
                    label: type === 'image' ? 'Image' : `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
                    description: `Configure ${type} settings`,
                    icon: icons[type as keyof typeof icons]?.icon || 'fas fa-cube',
                    iconColor: icons[type as keyof typeof icons]?.color || 'text-gray-500'
                  },
                  width: 200,
                  height: 100
                };

                setNodes(prev => [...prev, newNode]);
              }}
              onFitView={() => {
                if (nodes.length === 0) {
                  setViewport({ x: 0, y: 0, zoom: 1 });
                  return;
                }

                // Calculate bounding box of all nodes
                let minX = Infinity;
                let minY = Infinity;
                let maxX = -Infinity;
                let maxY = -Infinity;

                nodes.forEach(node => {
                  const w = node.style?.width ?? node.width ?? 200;
                  const h = node.style?.height ?? node.height ?? 100;
                  
                  minX = Math.min(minX, node.position.x);
                  minY = Math.min(minY, node.position.y);
                  maxX = Math.max(maxX, node.position.x + w);
                  maxY = Math.max(maxY, node.position.y + h);
                });

                // Add padding around the content
                const padding = 100;
                const contentWidth = maxX - minX + (padding * 2);
                const contentHeight = maxY - minY + (padding * 2);

                // Canvas dimensions (approximate viewport size)
                const canvasWidth = 800;
                const canvasHeight = 600;

                // Calculate zoom to fit content with margin
                const zoomX = (canvasWidth * 0.9) / contentWidth;
                const zoomY = (canvasHeight * 0.9) / contentHeight;
                const zoom = Math.max(0.1, Math.min(1.2, Math.min(zoomX, zoomY)));

                // Calculate content center
                const contentCenterX = (minX + maxX) / 2;
                const contentCenterY = (minY + maxY) / 2;

                // Calculate viewport translation to center content
                const x = (canvasWidth / 2) - (contentCenterX * zoom);
                const y = (canvasHeight / 2) - (contentCenterY * zoom);

                setViewport({ x, y, zoom });
              }}
              onClearCanvas={() => {
                saveToHistory();
                setNodes([]);
                setEdges([]);
                setSelectedNodeId('');
                setSelectedEdgeId('');
              }}
              onExport={() => {
                const workflow = {
                  name: activeTab?.name || 'My Workflow',
                  nodes,
                  edges,
                  viewport
                };
                const dataStr = JSON.stringify(workflow, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                const exportFileDefaultName = `${workflow.name}.json`;
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', exportFileDefaultName);
                linkElement.click();
              }}
              onImport={() => setShowImportModal(true)}
              onNodeUpdate={(nodeId: string, updates: Partial<Node>) => {
                setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
                saveToHistory();
              }}
              onDeselectNode={() => {
                setSelectedNodeId('');
                setNodes(prev => prev.map(n => ({ ...n, selected: false })));
              }}
              onImageUpload={(nodeId: string, objectPath: string, filename?: string) => {
                // Handle image upload logic
                console.log('Image upload:', { nodeId, objectPath, filename });
              }}
              onImageUrl={(nodeId: string, url: string) => {
                // Handle image URL logic
                console.log('Image URL:', { nodeId, url });
              }}
              showImageModal={showImageModal}
              onOpenImageModal={setShowImageModal}
              onCloseImageModal={() => setShowImageModal(null)}
              onOpenAiGenerator={() => setShowAiGenerator(true)}
            />
          </div>

          {/* Canvas Area */}
          <div className="flex-1 relative">
            
            <WorkflowCanvas
              nodes={nodes}
              edges={edges}
              viewport={viewport}
              onViewportChange={setViewport}
              onNodesChange={(changes) => {
                setNodes(prev => {
                  let newNodes = [...prev];
                  changes.forEach(change => {
                    if (change.type === 'position' && change.position) {
                      const nodeIndex = newNodes.findIndex(n => n.id === change.id);
                      if (nodeIndex >= 0) {
                        newNodes[nodeIndex] = { ...newNodes[nodeIndex], position: change.position };
                      }
                    } else if (change.type === 'select') {
                      const nodeIndex = newNodes.findIndex(n => n.id === change.id);
                      if (nodeIndex >= 0) {
                        newNodes[nodeIndex] = { ...newNodes[nodeIndex], selected: change.selected };
                      }
                    } else if (change.type === 'remove') {
                      newNodes = newNodes.filter(n => n.id !== change.id);
                    }
                  });
                  return newNodes;
                });
                saveToHistory();
              }}
              onEdgesChange={(changes) => {
                setEdges(prev => {
                  let newEdges = [...prev];
                  changes.forEach(change => {
                    if (change.type === 'select') {
                      const edgeIndex = newEdges.findIndex(e => e.id === change.id);
                      if (edgeIndex >= 0) {
                        newEdges[edgeIndex] = { ...newEdges[edgeIndex], selected: change.selected };
                      }
                    } else if (change.type === 'remove') {
                      newEdges = newEdges.filter(e => e.id !== change.id);
                    }
                  });
                  return newEdges;
                });
                saveToHistory();
              }}
              onConnect={(connection) => {
                const newEdge: Edge = {
                  id: `edge-${Date.now()}`,
                  source: connection.source,
                  target: connection.target,
                  type: 'bezier',
                  style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 },
                  markers: { type: 'arrow', position: 'end' }
                };
                setEdges(prev => [...prev, newEdge]);
                saveToHistory();
              }}
              onNodeClick={(nodeId) => {
                setNodes(prev => prev.map(n => ({ ...n, selected: n.id === nodeId })));
                setEdges(prev => prev.map(e => ({ ...e, selected: false })));
                setSelectedNodeId(nodeId);
                setSelectedEdgeId('');
                setContextMenu(null);
              }}
              onEdgeClick={(edge) => {
                setNodes(prev => prev.map(n => ({ ...n, selected: false })));
                setEdges(prev => prev.map(e => ({ ...e, selected: e.id === edge.id })));
                setSelectedNodeId('');
                setSelectedEdgeId(edge.id);
                setContextMenu(null);
              }}
              onCanvasClick={() => {
                setNodes(prev => prev.map(n => ({ ...n, selected: false })));
                setEdges(prev => prev.map(e => ({ ...e, selected: false })));
                setSelectedNodeId('');
                setSelectedEdgeId('');
                setContextMenu(null);
              }}
              onNodeRightClick={(e, node) => {
                setContextMenu({ x: e.clientX, y: e.clientY, node });
              }}
              onImageButtonClick={setShowImageModal}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onFitView={() => {
                if (nodes.length === 0) {
                  setViewport({ x: 0, y: 0, zoom: 1 });
                  return;
                }

                // Calculate bounding box of all nodes
                let minX = Infinity;
                let minY = Infinity;
                let maxX = -Infinity;
                let maxY = -Infinity;

                nodes.forEach(node => {
                  const w = node.style?.width ?? node.width ?? 200;
                  const h = node.style?.height ?? node.height ?? 100;
                  
                  minX = Math.min(minX, node.position.x);
                  minY = Math.min(minY, node.position.y);
                  maxX = Math.max(maxX, node.position.x + w);
                  maxY = Math.max(maxY, node.position.y + h);
                });

                // Add padding around the content
                const padding = 100;
                const contentWidth = maxX - minX + (padding * 2);
                const contentHeight = maxY - minY + (padding * 2);

                // Canvas dimensions (approximate viewport size)
                const canvasWidth = 800;
                const canvasHeight = 600;

                // Calculate zoom to fit content with margin
                const zoomX = (canvasWidth * 0.9) / contentWidth;
                const zoomY = (canvasHeight * 0.9) / contentHeight;
                const zoom = Math.max(0.1, Math.min(1.2, Math.min(zoomX, zoomY)));

                // Calculate content center
                const contentCenterX = (minX + maxX) / 2;
                const contentCenterY = (minY + maxY) / 2;

                // Calculate viewport translation to center content
                const x = (canvasWidth / 2) - (contentCenterX * zoom);
                const y = (canvasHeight / 2) - (contentCenterY * zoom);

                setViewport({ x, y, zoom });
              }}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </div>
        </div>

        {/* Modals */}
        {showAiModal && (
          <AiSettingsModal
            onClose={() => setShowAiModal(false)}
            onSave={(settings) => {
              // Update AI client with new settings
              console.log('AI settings saved:', settings);
              setShowAiModal(false);
            }}
          />
        )}
        {showAiGenerator && (
          <AiWorkflowGenerator
            onClose={() => setShowAiGenerator(false)}
            onGenerate={(generatedWorkflow) => {
              // Handle generated workflow
              setNodes(generatedWorkflow.nodes);
              setEdges(generatedWorkflow.edges);
              saveToHistory();
              setShowAiGenerator(false);
            }}
          />
        )}
        {showImportModal && (
          <WorkflowImportModal
            onClose={() => setShowImportModal(false)}
            onImport={(importedWorkflow) => {
              // Handle imported workflow
              setNodes(importedWorkflow.nodes);
              setEdges(importedWorkflow.edges);
              if (importedWorkflow.viewport) {
                setViewport(importedWorkflow.viewport);
              }
              saveToHistory();
              setShowImportModal(false);
            }}
          />
        )}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onDeleteNode={() => {
              if (contextMenu.node) {
                saveToHistory();
                setNodes(prev => prev.filter(n => n.id !== contextMenu.node!.id));
                setEdges(prev => prev.filter(e => e.source !== contextMenu.node!.id && e.target !== contextMenu.node!.id));
                setContextMenu(null);
              }
            }}
          />
        )}
      </div>
    </AiProvider>
  );
}