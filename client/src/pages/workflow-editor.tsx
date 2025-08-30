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
        height: 120
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
    selectedNodeId: '',
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

  // History management
  const saveToHistory = useCallback(() => {
    if (!activeTab) return;
    
    const newHistoryState = {
      nodes: [...nodes],
      edges: [...edges],
      viewport: { ...viewport }
    };
    
    const newHistory = [...history.slice(0, historyIndex + 1), newHistoryState];
    updateActiveTab({ 
      history: newHistory,
      historyIndex: newHistory.length - 1
    });
  }, [activeTab, nodes, edges, viewport, history, historyIndex, updateActiveTab]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      updateActiveTab({
        nodes: [...state.nodes],
        edges: [...state.edges],
        viewport: { ...state.viewport },
        historyIndex: newIndex
      });
    }
  }, [historyIndex, history, updateActiveTab]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      updateActiveTab({
        nodes: [...state.nodes],
        edges: [...state.edges],
        viewport: { ...state.viewport },
        historyIndex: newIndex
      });
    }
  }, [historyIndex, history, updateActiveTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete key handler
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Check if we're not in an input field
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        
        // Delete selected nodes
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          e.preventDefault();
          console.log('Deleting selected nodes:', selectedNodes.map(n => n.id));
          setNodes(prev => prev.filter(n => !n.selected));
          setSelectedNodeId('');
          saveToHistory();
        }
        
        // Delete selected edges
        const selectedEdges = edges.filter(e => e.selected);
        if (selectedEdges.length > 0) {
          e.preventDefault();
          console.log('Deleting selected edges:', selectedEdges.map(e => e.id));
          setEdges(prev => prev.filter(e => !e.selected));
          setSelectedEdgeId('');
          saveToHistory();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, setNodes, setEdges, setSelectedNodeId, setSelectedEdgeId, saveToHistory]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Auto Layout Algorithms
  const handleAutoLayout = useCallback((layoutType: string) => {
    if (nodes.length === 0) return;
    
    saveToHistory();
    let updatedNodes = [...nodes];
    
    switch (layoutType) {
      case 'horizontal':
        // Arrange nodes horizontally with 250px spacing
        updatedNodes = updatedNodes.map((node, index) => ({
          ...node,
          position: { x: 300 + (index * 250), y: 250 }
        }));
        break;
        
      case 'vertical':
        // Arrange nodes vertically with 150px spacing
        updatedNodes = updatedNodes.map((node, index) => ({
          ...node,
          position: { x: 400, y: 150 + (index * 150) }
        }));
        break;
        
      case 'grid':
        // Arrange nodes in a grid pattern
        const cols = Math.ceil(Math.sqrt(updatedNodes.length));
        updatedNodes = updatedNodes.map((node, index) => {
          const row = Math.floor(index / cols);
          const col = index % cols;
          return {
            ...node,
            position: { x: 200 + (col * 250), y: 150 + (row * 150) }
          };
        });
        break;
        
      case 'circular':
        // Arrange nodes in a circle
        const centerX = 500;
        const centerY = 300;
        const radius = Math.max(150, updatedNodes.length * 30);
        updatedNodes = updatedNodes.map((node, index) => {
          const angle = (index / updatedNodes.length) * 2 * Math.PI;
          return {
            ...node,
            position: {
              x: centerX + Math.cos(angle) * radius,
              y: centerY + Math.sin(angle) * radius
            }
          };
        });
        break;
        
      case 'hierarchy':
        // Arrange nodes in a hierarchical tree structure
        // Input nodes at top, outputs at bottom, process nodes in middle
        const inputNodes = updatedNodes.filter(n => n.type === 'input');
        const processNodes = updatedNodes.filter(n => n.type === 'process' || n.type === 'ai' || n.type === 'condition');
        const outputNodes = updatedNodes.filter(n => n.type === 'output');
        const otherNodes = updatedNodes.filter(n => n.type && !['input', 'process', 'ai', 'condition', 'output'].includes(n.type));
        
        // Position input nodes at top
        inputNodes.forEach((node, index) => {
          const totalWidth = Math.max(1, inputNodes.length - 1) * 250;
          const startX = 500 - (totalWidth / 2);
          node.position = { x: startX + (index * 250), y: 100 };
          updatedNodes[updatedNodes.findIndex(n => n.id === node.id)] = node;
        });
        
        // Position process nodes in middle
        processNodes.forEach((node, index) => {
          const totalWidth = Math.max(1, processNodes.length - 1) * 250;
          const startX = 500 - (totalWidth / 2);
          node.position = { x: startX + (index * 250), y: 250 };
          updatedNodes[updatedNodes.findIndex(n => n.id === node.id)] = node;
        });
        
        // Position output nodes at bottom
        outputNodes.forEach((node, index) => {
          const totalWidth = Math.max(1, outputNodes.length - 1) * 250;
          const startX = 500 - (totalWidth / 2);
          node.position = { x: startX + (index * 250), y: 400 };
          updatedNodes[updatedNodes.findIndex(n => n.id === node.id)] = node;
        });
        
        // Position other nodes to the side
        otherNodes.forEach((node, index) => {
          node.position = { x: 750, y: 150 + (index * 150) };
          updatedNodes[updatedNodes.findIndex(n => n.id === node.id)] = node;
        });
        break;
    }
    
    setNodes(updatedNodes);
    console.log(`🔧 AUTO LAYOUT APPLIED: ${layoutType}`, { nodeCount: updatedNodes.length });
  }, [nodes, saveToHistory]);

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
              selectedEdge={edges.find(e => e.id === selectedEdgeId)}
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
              onEdgeUpdate={(edgeId: string, updates: Partial<Edge>) => {
                setEdges(prev => prev.map(e => e.id === edgeId ? { ...e, ...updates } : e));
                saveToHistory();
              }}
              onDeselectNode={() => {
                setSelectedNodeId('');
                setNodes(prev => prev.map(n => ({ ...n, selected: false })));
              }}
              onImageUpload={(nodeId: string, objectPath: string, filename?: string) => {
                // Update the node with the image data
                setNodes(prev => prev.map(n => 
                  n.id === nodeId 
                    ? { ...n, data: { ...n.data, src: objectPath, filename } }
                    : n
                ));
                saveToHistory();
              }}
              onImageUrl={(nodeId: string, url: string) => {
                // Update the node with the image URL
                setNodes(prev => prev.map(n => 
                  n.id === nodeId 
                    ? { ...n, data: { ...n.data, src: url, sourceUrl: url } }
                    : n
                ));
                saveToHistory();
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
                console.log('📊 onNodesChange CALLED:', {
                  changes,
                  isArray: Array.isArray(changes),
                  length: Array.isArray(changes) ? changes.length : 0,
                  firstItem: Array.isArray(changes) && changes.length > 0 ? changes[0] : null
                });
                
                // Handle both array of changes and direct node array updates
                if (Array.isArray(changes) && changes.length > 0) {
                  // Check if it's a direct nodes array update (from drag operations)
                  // Nodes have a 'type' property that is the node type ('input', 'ai', etc.)
                  // Changes have a 'type' property that is the change type ('position', 'select', etc.)
                  const isNodeArray = changes[0].id && changes[0].position && 
                    (changes[0].type === 'input' || changes[0].type === 'ai' || 
                     changes[0].type === 'condition' || changes[0].type === 'output' || 
                     changes[0].type === 'process' || changes[0].type === 'image');
                  
                  if (isNodeArray) {
                    // Direct nodes array from KiteFrameCanvas drag operations
                    console.log('📊 DIRECT NODE UPDATE (drag):', {
                      nodeCount: changes.length,
                      sample: changes[0]
                    });
                    setNodes(changes as Node[]);
                    // Don't save to history on every drag move, only on drag end
                  } else {
                    // Change-based updates
                    console.log('📊 CHANGE-BASED UPDATE:', {
                      changeTypes: changes.map((c: any) => c.type)
                    });
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
                  }
                }
              }}
              onEdgesChange={(changes: any[]) => {
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
              onNodeClick={(e: React.MouseEvent, node: Node) => {
                console.log(`📝 EDITOR NODE CLICK HANDLER:`, { 
                  nodeId: node.id, 
                  currentSelected: selectedNodeId,
                  shiftKey: e.shiftKey,
                  tabId: activeTab 
                });
                
                if (e.shiftKey) {
                  // Shift+click for multi-select
                  setNodes(prev => {
                    const updated = prev.map(n => {
                      if (n.id === node.id) {
                        return { ...n, selected: !n.selected };
                      }
                      return n;
                    });
                    console.log(`📝 MULTI-SELECT UPDATE:`, { 
                      selected: updated.filter(n => n.selected).map(n => n.id),
                      total: updated.length 
                    });
                    return updated;
                  });
                  
                  // Update selectedNodeId to the most recently clicked node if selected
                  if (!node.selected) {
                    setSelectedNodeId(node.id);
                  } else if (selectedNodeId === node.id) {
                    // If deselecting the current selected node, find another selected node
                    const otherSelected = nodes.find(n => n.selected && n.id !== node.id);
                    setSelectedNodeId(otherSelected?.id || '');
                  }
                } else {
                  // Regular click - single select
                  setNodes(prev => {
                    const updated = prev.map(n => ({ ...n, selected: n.id === node.id }));
                    console.log(`📝 SINGLE SELECT UPDATE:`, { 
                      selected: updated.filter(n => n.selected).map(n => n.id),
                      total: updated.length 
                    });
                    return updated;
                  });
                  setSelectedNodeId(node.id);
                }
                
                setEdges(prev => prev.map(e => ({ ...e, selected: false })));
                setSelectedEdgeId('');
                setContextMenu(null);
                
                console.log(`📝 SELECTION STATE SET:`, { 
                  selectedNodeId: node.selected && e.shiftKey ? '' : node.id,
                  selectedEdgeId: '',
                  tabId: activeTab 
                });
              }}
              onEdgeClick={(edge: Edge) => {
                console.log(`📝 EDITOR EDGE CLICK HANDLER:`, { 
                  edgeId: edge.id, 
                  currentSelected: selectedEdgeId,
                  tabId: activeTab 
                });
                
                setNodes(prev => prev.map(n => ({ ...n, selected: false })));
                setEdges(prev => {
                  const updated = prev.map(e => ({ ...e, selected: e.id === edge.id }));
                  console.log(`📝 EDGES SELECTION UPDATE:`, { 
                    selected: updated.filter(e => e.selected).map(e => e.id),
                    total: updated.length 
                  });
                  return updated;
                });
                setSelectedNodeId('');
                setSelectedEdgeId(edge.id);
                setContextMenu(null);
                
                console.log(`📝 SELECTION STATE SET:`, { 
                  selectedNodeId: '',
                  selectedEdgeId: edge.id,
                  tabId: activeTab 
                });
              }}
              onCanvasClick={() => {
                console.log(`📝 CANVAS CLICK:`, { tabId: activeTab, clearing: 'all selections' });
                setNodes(prev => prev.map(n => ({ ...n, selected: false })));
                setEdges(prev => prev.map(e => ({ ...e, selected: false })));
                setSelectedNodeId('');
                setSelectedEdgeId('');
                setContextMenu(null);
              }}
              onNodeRightClick={(e: React.MouseEvent, node: Node) => {
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
              onAutoLayout={handleAutoLayout}
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
            onGenerate={(generatedWorkflow: any) => {
              console.log('📝 WORKFLOW EDITOR RECEIVED AI DATA:', { 
                hasNodes: !!generatedWorkflow.nodes,
                nodeCount: generatedWorkflow.nodes?.length || 0,
                hasEdges: !!generatedWorkflow.edges,
                edgeCount: generatedWorkflow.edges?.length || 0,
                generatedWorkflow
              });
              
              // Handle generated workflow
              if (generatedWorkflow.nodes) {
                setNodes(generatedWorkflow.nodes);
                console.log('📝 NODES SET FROM AI:', generatedWorkflow.nodes);
              }
              if (generatedWorkflow.edges) {
                setEdges(generatedWorkflow.edges);
                console.log('📝 EDGES SET FROM AI:', generatedWorkflow.edges);
              }
              saveToHistory();
              setShowAiGenerator(false);
            }}
          />
        )}
        {showImportModal && (
          <WorkflowImportModal
            onClose={() => setShowImportModal(false)}
            onImport={(importedWorkflow: any) => {
              // Handle imported workflow
              if (importedWorkflow.nodes) {
                setNodes(importedWorkflow.nodes);
              }
              if (importedWorkflow.edges) {
                setEdges(importedWorkflow.edges);
              }
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
            onDelete={() => {
              if (contextMenu.node) {
                saveToHistory();
                setNodes(prev => prev.filter(n => n.id !== contextMenu.node!.id));
                setEdges(prev => prev.filter(e => e.source !== contextMenu.node!.id && e.target !== contextMenu.node!.id));
                setContextMenu(null);
              }
            }}
            onCopy={() => {
              // TODO: Implement copy functionality
              setContextMenu(null);
            }}
            onDuplicate={() => {
              if (contextMenu.node) {
                const newNode = {
                  ...contextMenu.node,
                  id: `node-${Date.now()}`,
                  position: {
                    x: contextMenu.node.position.x + 20,
                    y: contextMenu.node.position.y + 20
                  }
                };
                setNodes(prev => [...prev, newNode]);
                saveToHistory();
                setContextMenu(null);
              }
            }}
          />
        )}
      </div>
    </AiProvider>
  );
}