import { useState, useCallback, useEffect } from 'react';
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
  ]);

  const [showAiModal, setShowAiModal] = useState(false);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node?: Node } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-2');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>('');
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
      style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 },
      markers: { type: 'arrow', position: 'end' }
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
    setSelectedEdgeId(''); // Deselect edges when node is selected
    setEdges(prev => prev.map(e => ({ ...e, selected: false })));
  }, []);

  const handleEdgeClick = useCallback((edge: Edge) => {
    setEdges(prev => prev.map(e => ({ ...e, selected: e.id === edge.id })));
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(''); // Deselect nodes when edge is selected
    setNodes(prev => prev.map(n => ({ ...n, selected: false })));
  }, []);

  const handleNodeRightClick = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleCanvasClick = useCallback(() => {
    setNodes(prev => prev.map(n => ({ ...n, selected: false })));
    setEdges(prev => prev.map(e => ({ ...e, selected: false })));
    setSelectedNodeId('');
    setSelectedEdgeId('');
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
        label: type === 'image' ? 'Image' : `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
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

      // Delete selected nodes (only if no input is focused)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Check if the focus is on an input, textarea, or contenteditable element
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).contentEditable === 'true' ||
          activeElement.getAttribute('role') === 'textbox'
        );
        
        // Only delete nodes if no input is focused
        if (!isInputFocused) {
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, selectedNodeId, handleUndo, handleRedo, saveToHistory]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const selectedEdge = edges.find(e => e.id === selectedEdgeId);

  // Handle edge updates
  const handleEdgeUpdate = useCallback((edgeId: string, updates: Partial<Edge>) => {
    setEdges(prev => prev.map(e => e.id === edgeId ? { ...e, ...updates } : e));
  }, []);

  // Export workflow as JSON file
  const handleExportWorkflow = useCallback(() => {
    // Process nodes to include image metadata
    const processedNodes = nodes.map(node => {
      if (node.type === 'image' && node.data?.src) {
        return {
          ...node,
          data: {
            ...node.data,
            imageMetadata: {
              filename: node.data.filename || null,
              sourceUrl: node.data.sourceUrl || null,
              sourceType: node.data.sourceType || 'unknown',
              originalSrc: node.data.src
            }
          }
        };
      }
      return node;
    });

    const workflowData = {
      version: "1.1.0", // Increment version to support image metadata
      metadata: {
        name: "KiteFrame Workflow",
        description: "Exported workflow from KiteFrame editor",
        created: new Date().toISOString(),
        nodeCount: nodes.length,
        edgeCount: edges.length,
        hasImages: nodes.some(n => n.type === 'image' && n.data?.src)
      },
      nodes: processedNodes,
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

  // State for missing images during import
  const [missingImages, setMissingImages] = useState<Array<{
    nodeId: string;
    filename: string | null;
    sourceUrl: string | null;
    sourceType: string;
  }>>([]);
  const [showMissingImagesModal, setShowMissingImagesModal] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<{
    nodes: Node[];
    edges: Edge[];
    viewport?: { x: number; y: number; zoom: number };
  } | null>(null);

  // Import workflow from JSON data with missing image detection
  const handleImportWorkflow = useCallback(async (newNodes: Node[], newEdges: Edge[], newViewport?: { x: number; y: number; zoom: number }) => {
    console.log('handleImportWorkflow called with:', newNodes.length, 'nodes,', newEdges.length, 'edges');
    
    // Check for missing images
    const missingImageNodes: Array<{
      nodeId: string;
      filename: string | null;
      sourceUrl: string | null;
      sourceType: string;
    }> = [];

    for (const node of newNodes) {
      if (node.type === 'image' && node.data?.src) {
        // Check if image is accessible
        try {
          const response = await fetch(node.data.src, { method: 'HEAD' });
          if (!response.ok) {
            throw new Error('Image not accessible');
          }
        } catch (error) {
          // Image is missing, add to missing list
          const metadata = node.data.imageMetadata;
          missingImageNodes.push({
            nodeId: node.id,
            filename: metadata?.filename || null,
            sourceUrl: metadata?.sourceUrl || null,
            sourceType: metadata?.sourceType || 'unknown'
          });
        }
      }
    }

    if (missingImageNodes.length > 0) {
      // Show missing images modal
      setMissingImages(missingImageNodes);
      setPendingImportData({ nodes: newNodes, edges: newEdges, viewport: newViewport });
      setShowMissingImagesModal(true);
      setShowImportModal(false); // Close import modal
    } else {
      // No missing images, proceed with import
      saveToHistory(); // Save current state before import
      setNodes(newNodes);
      setEdges(newEdges);
      if (newViewport) {
        setViewport(newViewport);
      }
      setSelectedNodeId(''); // Clear selection
      setShowImportModal(false); // Close modal after successful import
      console.log('Import completed, modal closed');
    }
  }, [saveToHistory]);

  // Handle missing image replacement
  const handleMissingImageReplace = useCallback((nodeId: string, objectPath: string, filename?: string) => {
    if (pendingImportData) {
      const updatedNodes = pendingImportData.nodes.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              src: objectPath,
              filename: filename,
              sourceType: 'upload'
            }
          };
        }
        return node;
      });
      
      setPendingImportData({
        ...pendingImportData,
        nodes: updatedNodes
      });
      
      // Remove from missing list
      setMissingImages(prev => prev.filter(item => item.nodeId !== nodeId));
    }
  }, [pendingImportData]);

  // Complete import after all missing images are resolved
  const handleCompleteMissingImageImport = useCallback(() => {
    if (pendingImportData) {
      saveToHistory(); // Save current state before import
      setNodes(pendingImportData.nodes);
      setEdges(pendingImportData.edges);
      if (pendingImportData.viewport) {
        setViewport(pendingImportData.viewport);
      }
      setSelectedNodeId(''); // Clear selection
      setShowMissingImagesModal(false);
      setPendingImportData(null);
      setMissingImages([]);
      console.log('Import completed with resolved missing images');
    }
  }, [pendingImportData, saveToHistory]);

  // Handle image upload completion with auto-sizing
  const handleImageUpload = useCallback((nodeId: string, objectPath: string, filename?: string) => {
    // Create an image element to get natural dimensions
    const img = new Image();
    img.onload = () => {
      const maxWidth = 300;
      const maxHeight = 300;
      const headerHeight = 28; // Approximate height of the title bar
      
      // Calculate available space for the image (accounting for header)
      const availableHeight = maxHeight - headerHeight;
      
      // Calculate the scaling factor to fit within max dimensions while maintaining aspect ratio
      const scaleX = maxWidth / img.naturalWidth;
      const scaleY = availableHeight / img.naturalHeight;
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
      
      const imageWidth = Math.round(img.naturalWidth * scale);
      const imageHeight = Math.round(img.naturalHeight * scale);
      
      // Total node dimensions (image + header)
      const finalWidth = Math.max(imageWidth, 150);
      const finalHeight = Math.max(imageHeight + headerHeight, 100);
      
      setNodes(prev => prev.map(n => 
        n.id === nodeId 
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                src: objectPath,
                filename: filename,
                sourceType: 'upload'
              },
              width: finalWidth,
              height: finalHeight
            }
          : n
      ));
      saveToHistory(); // Save to history after image upload and resize
    };
    
    img.onerror = () => {
      // Fallback if image fails to load - just set the src without resizing
      setNodes(prev => prev.map(n => 
        n.id === nodeId 
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                src: objectPath,
                filename: filename,
                sourceType: 'upload'
              } 
            }
          : n
      ));
      saveToHistory();
    };
    
    // Set the source to trigger loading
    img.src = objectPath;
  }, [saveToHistory]);

  // Handle image URL input
  const handleImageUrl = useCallback((nodeId: string, url: string) => {
    // Create an image element to get natural dimensions
    const img = new Image();
    img.onload = () => {
      const maxWidth = 300;
      const maxHeight = 300;
      const headerHeight = 28; // Approximate height of the title bar
      
      // Calculate available space for the image (accounting for header)
      const availableHeight = maxHeight - headerHeight;
      
      // Calculate the scaling factor to fit within max dimensions while maintaining aspect ratio
      const scaleX = maxWidth / img.naturalWidth;
      const scaleY = availableHeight / img.naturalHeight;
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
      
      const imageWidth = Math.round(img.naturalWidth * scale);
      const imageHeight = Math.round(img.naturalHeight * scale);
      
      // Total node dimensions (image + header)
      const finalWidth = Math.max(imageWidth, 150);
      const finalHeight = Math.max(imageHeight + headerHeight, 100);
      
      setNodes(prev => prev.map(n => 
        n.id === nodeId 
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                src: url,
                sourceUrl: url,
                sourceType: 'url'
              },
              width: finalWidth,
              height: finalHeight
            }
          : n
      ));
      saveToHistory(); // Save to history after image URL and resize
    };
    
    img.onerror = () => {
      // Fallback if image fails to load - just set the src without resizing
      setNodes(prev => prev.map(n => 
        n.id === nodeId 
          ? { 
              ...n, 
              data: { 
                ...n.data, 
                src: url,
                sourceUrl: url,
                sourceType: 'url'
              } 
            }
          : n
      ));
      saveToHistory();
    };
    
    // Set the source to trigger loading
    img.src = url;
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
          {selectedEdge ? (
            <EdgeCustomizer
              selectedEdge={selectedEdge}
              onEdgeUpdate={handleEdgeUpdate}
              onDeselectEdge={() => {
                setEdges(prev => prev.map(e => ({ ...e, selected: false })));
                setSelectedEdgeId('');
              }}
            />
          ) : (
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
              onImageUpload={handleImageUpload}
              onImageUrl={handleImageUrl}
            />
          )}
          
          <main className="flex-1 relative">
            <WorkflowCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
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

        {showMissingImagesModal && (
          <MissingImagesModal
            missingImages={missingImages}
            onImageReplace={handleMissingImageReplace}
            onComplete={handleCompleteMissingImageImport}
            onCancel={() => {
              setShowMissingImagesModal(false);
              setPendingImportData(null);
              setMissingImages([]);
            }}
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
