import { useState, useCallback, useEffect, useMemo } from 'react';
import { WorkflowCanvas } from '@/components/WorkflowCanvas';
import { PluginProvider, layoutPlugin, consolePlugin, testPlugin, advancedInteractionsPlugin } from '@/lib/kiteframe';
import { PluginTestButton } from '@/components/PluginTestButton';
import { PluginTestPanel } from '@/components/PluginTestPanel';

import { Sidebar } from '@/components/Sidebar';
import { EdgeCustomizer } from '@/components/EdgeCustomizer';
import { Toolbar } from '@/components/Toolbar';
import { AiSettingsModal } from '@/components/AiSettingsModal';
import { AiWorkflowGenerator } from '@/components/AiWorkflowGenerator';
import { WorkflowImportModal } from '@/components/WorkflowImportModal';
import { ContextMenu } from '@/components/ContextMenu';
import { MissingImagesModal } from '@/components/MissingImagesModal';
import { NewTabModal } from '@/components/NewTabModal';
import { AiProvider, useAi } from '../ai/AiProvider';
import { OpenAICompatClient } from '../ai/OpenAICompatClient';
import { useToast } from '@/hooks/use-toast';
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

function WorkflowEditorContent({ onAiSettingsChange }: { onAiSettingsChange?: () => void }) {
  const ai = useAi();
  const { toast } = useToast();

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

  // Generate random 3-node workflow
  const generateRandomWorkflow = useCallback(() => {
    const nodeTypes = [
      { type: 'input', icon: 'ArrowRight', iconColor: 'text-blue-500', labels: ['Data Source', 'Input Stream', 'Raw Data', 'User Input'], descriptions: ['Data source configuration', 'Incoming data stream', 'Raw data collection', 'User input validation'] },
      { type: 'process', icon: 'Cog', iconColor: 'text-gray-500', labels: ['Transform', 'Process', 'Filter', 'Validate'], descriptions: ['Data transformation', 'Process workflow step', 'Filter and clean data', 'Validate input data'] },
      { type: 'condition', icon: 'HelpCircle', iconColor: 'text-yellow-500', labels: ['Decision', 'Check', 'Condition', 'Branch'], descriptions: ['Evaluate condition logic', 'Check data quality', 'Conditional branching', 'Decision point'] },
      { type: 'output', icon: 'ArrowLeft', iconColor: 'text-red-500', labels: ['Result', 'Export', 'Save', 'Output'], descriptions: ['Final result destination', 'Export processed data', 'Save to database', 'Output data stream'] },
      { type: 'ai', icon: 'Bot', iconColor: 'text-purple-500', labels: ['AI Model', 'ML Process', 'Neural Net', 'Analysis'], descriptions: ['Process data with AI\nModel: GPT-4o', 'Machine learning processing', 'Neural network analysis', 'AI-powered analysis'] },
      { type: 'image', icon: 'Image', iconColor: 'text-green-500', labels: ['Visual', 'Chart', 'Diagram', 'Image'], descriptions: ['Visual representation', 'Generate chart or graph', 'Create diagram', 'Image processing'] }
    ];

    // Randomly select 3 different node types
    const shuffled = [...nodeTypes].sort(() => 0.5 - Math.random());
    const selectedTypes = shuffled.slice(0, 3);
    
    // Generate random positions in a flowing layout
    const positions = [
      { x: 150 + Math.random() * 100, y: 80 + Math.random() * 40 },
      { x: 400 + Math.random() * 100, y: 80 + Math.random() * 40 },
      { x: 275 + Math.random() * 100, y: 250 + Math.random() * 40 }
    ];
    
    // Create nodes
    const nodes = selectedTypes.map((nodeType, index) => {
      const randomLabel = nodeType.labels[Math.floor(Math.random() * nodeType.labels.length)];
      const randomDesc = nodeType.descriptions[Math.floor(Math.random() * nodeType.descriptions.length)];
      return {
        id: `node-${index + 1}`,
        type: nodeType.type,
        position: positions[index],
        data: { 
          label: randomLabel, 
          description: randomDesc, 
          icon: nodeType.icon, 
          iconColor: nodeType.iconColor 
        },
        width: 200,
        height: nodeType.type === 'ai' ? 120 : 100
      };
    });

    // Create edges between the nodes (linear flow: 1->2->3)
    const edgeTypes: ('bezier' | 'straight' | 'step' | 'curved' | 'orthogonal' | 'smoothstep')[] = ['bezier', 'straight', 'step'];
    const colors = [
      'hsl(221.2, 83.2%, 53.3%)', 
      'hsl(142.1, 76.2%, 36.3%)',
      'hsl(262.1, 83.3%, 57.8%)',
      'hsl(346.8, 77.2%, 49.8%)'
    ];
    
    const edges: Edge[] = [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: edgeTypes[Math.floor(Math.random() * edgeTypes.length)],
        animated: Math.random() > 0.5,
        style: { strokeColor: colors[Math.floor(Math.random() * colors.length)], strokeWidth: 2 },
        markers: { type: 'arrow', position: 'end' }
      },
      {
        id: 'edge-2',
        source: 'node-2',
        target: 'node-3',
        type: edgeTypes[Math.floor(Math.random() * edgeTypes.length)],
        animated: Math.random() > 0.5,
        style: { strokeColor: colors[Math.floor(Math.random() * colors.length)], strokeWidth: 2 },
        markers: { type: 'arrow', position: 'end' }
      }
    ];

    return { nodes, edges };
  }, []);

  // Create default tab with random workflow
  const createDefaultTab = useCallback((): WorkflowTab => {
    const { nodes, edges } = generateRandomWorkflow();
    return {
      id: generateTabId(),
      name: generateCuteName(),
      nodes,
      edges,
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedNodeId: '',
      selectedEdgeId: '',
      history: [],
      historyIndex: -1,
      showImageModal: null
    };
  }, [generateTabId, generateCuteName, generateRandomWorkflow]);

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

  // New tab creation handlers
  const handleCreateBlank = useCallback(() => {
    const newTab = createBlankTab();
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [createBlankTab]);

  // Direct AI generation function
  const generateWorkflowFromPrompt = useCallback(async (prompt: string): Promise<{ nodes: Node[]; edges: Edge[] }> => {
    const systemPrompt = `You are a workflow generator. Create a visual workflow based on the user's description. 

Return ONLY a valid JSON object with "nodes" and "edges" arrays. Keep descriptions short and concise.

Each node should have:
- id: unique string (like "node-1", "node-2", etc.)
- type: one of "input", "process", "condition", "output", "ai", "image"
- position: {x: number, y: number} (CENTER workflow - start first node at x:300, y:250, then x:550, y:250, etc.)
- data: {label: string, description: string (MAX 50 chars), icon: string, iconColor: string}
- width: 200, height: 100

POSITIONING: Start at x:300, y:250, then horizontally +250px per node. For branches: y:100 (upper), y:400 (lower).

Each edge should have:
- id: unique string (like "edge-1", "edge-2", etc.)
- source: source node id
- target: target node id
- type: "bezier"
- style: {strokeColor: "hsl(221.2, 83.2%, 53.3%)", strokeWidth: 2}
- markers: {type: "arrow", position: "end"}

Icon mapping:
- input: "ArrowRight", color: "text-blue-500"
- process: "Cog", color: "text-green-500"  
- condition: "HelpCircle", color: "text-yellow-500"
- output: "ArrowLeft", color: "text-red-500"
- ai: "Bot", color: "text-purple-500"
- image: "Image", color: "text-indigo-500"

Create a logical flow. Keep descriptions brief. Return ONLY valid JSON.`;

    const response = await ai.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      maxTokens: 4000
    });

    // Parse the AI response with better JSON cleaning
    let cleanedResponse = response.text.trim();
    
    // Remove markdown code blocks if present
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }
    
    cleanedResponse = cleanedResponse.trim();
    
    console.log('🧹 CLEANED RESPONSE:', cleanedResponse.substring(0, 200) + '...');
    
    let workflowData;
    try {
      workflowData = JSON.parse(cleanedResponse);
    } catch (firstError) {
      const errorMsg = firstError instanceof Error ? firstError.message : String(firstError);
      console.log('❌ FIRST PARSE FAILED, TRYING FIXES:', errorMsg);
      
      // Try additional cleaning if first parse fails
      let fixedResponse = cleanedResponse;
      
      // Remove any trailing commas before closing brackets/braces
      fixedResponse = fixedResponse.replace(/,(\s*[}\]])/g, '$1');
      
      // Fix unquoted keys (but be careful not to break quoted strings)
      fixedResponse = fixedResponse.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      
      // Convert single quotes to double quotes (but avoid breaking contractions in strings)
      fixedResponse = fixedResponse.replace(/:\s*'([^']*)'/g, ': "$1"');
      
      console.log('🔧 ATTEMPTING FIXED PARSE:', fixedResponse.substring(0, 200) + '...');
      
      try {
        workflowData = JSON.parse(fixedResponse);
      } catch (secondError) {
        const secondErrorMsg = secondError instanceof Error ? secondError.message : String(secondError);
        console.error('❌ BOTH PARSE ATTEMPTS FAILED:', { 
          original: errorMsg,
          afterFix: secondErrorMsg,
          responseLength: response.text.length,
          cleanedLength: cleanedResponse.length,
          rawStart: response.text.substring(0, 100),
          cleanedStart: cleanedResponse.substring(0, 100)
        });
        throw new Error(`Failed to parse AI response: ${secondErrorMsg}. Raw response length: ${response.text.length}`);
      }
    }

    if (workflowData.nodes && workflowData.edges) {
      console.log('🤖 AI GENERATED WORKFLOW (DIRECT):', { 
        nodeCount: workflowData.nodes.length, 
        edgeCount: workflowData.edges.length,
        nodes: workflowData.nodes,
        edges: workflowData.edges
      });
      
      return workflowData;
    } else {
      throw new Error('Invalid workflow structure returned');
    }
  }, [ai]);

  const handleCreateFromPrompt = useCallback(async (prompt: string) => {
    try {
      // Create a new blank tab first
      const newTab = createBlankTab();
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
      
      // Generate workflow directly using AI
      const generatedWorkflow = await generateWorkflowFromPrompt(prompt);
      
      // Update the new tab with generated nodes and edges
      setTabs(prev => prev.map(tab => 
        tab.id === newTab.id 
          ? { 
              ...tab, 
              nodes: generatedWorkflow.nodes.map(node => ({ ...node, selected: false })),
              edges: generatedWorkflow.edges.map(edge => ({ ...edge, selected: false }))
            }
          : tab
      ));
      
      toast({
        title: "Workflow Generated",
        description: `Created ${generatedWorkflow.nodes.length} nodes and ${generatedWorkflow.edges.length} connections.`,
        variant: "default"
      });
      
    } catch (error) {
      console.error('Workflow generation error:', error);
      
      let title = "Generation Failed";
      let description = "Failed to generate workflow. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          title = "Authentication Error";
          description = "Invalid API key. Please check your OpenAI API key in AI Settings.";
        } else if (error.message.includes('429')) {
          title = "Rate Limit Exceeded";
          description = "Too many requests. Please wait a moment and try again.";
        } else if (error.message.includes('500')) {
          title = "Server Error";
          description = "OpenAI service is temporarily unavailable. Please try again later.";
        } else {
          description = error.message;
        }
      }
      
      toast({
        title,
        description,
        variant: "destructive"
      });
    }
  }, [createBlankTab, generateWorkflowFromPrompt, toast]);



  const handleCreateFromFile = useCallback((data: { nodes: Node[]; edges: Edge[] }) => {
    const newTab: WorkflowTab = {
      id: generateTabId(),
      name: generateCuteName(),
      nodes: data.nodes.map(node => ({ ...node, selected: false })),
      edges: data.edges.map(edge => ({ ...edge, selected: false })),
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedNodeId: '',
      selectedEdgeId: '',
      history: [],
      historyIndex: -1,
      showImageModal: null
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [generateTabId, generateCuteName]);

  const handleCreateFromTemplate = useCallback((template: { name: string; nodes: Node[]; edges: Edge[] }) => {
    const newTab: WorkflowTab = {
      id: generateTabId(),
      name: template.name,
      nodes: template.nodes.map(node => ({ ...node, selected: false })),
      edges: template.edges.map(edge => ({ ...edge, selected: false })),
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedNodeId: '',
      selectedEdgeId: '',
      history: [],
      historyIndex: -1,
      showImageModal: null
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [generateTabId, generateCuteName]);

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

  // Helper function to calculate offset position for appending workflows
  const calculateWorkflowOffset = useCallback((newNodes: Node[]): { x: number; y: number } => {
    if (nodes.length === 0) {
      return { x: 0, y: 0 }; // No offset needed if canvas is empty
    }

    // Find the rightmost and bottommost positions of existing nodes
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    nodes.forEach(node => {
      const nodeRight = node.position.x + (node.width || 200);
      const nodeBottom = node.position.y + (node.height || 100);
      
      if (nodeRight > maxX) maxX = nodeRight;
      if (nodeBottom > maxY) maxY = nodeBottom;
    });

    // Find the leftmost and topmost positions of new nodes
    let minNewX = Infinity;
    let minNewY = Infinity;
    
    newNodes.forEach(node => {
      if (node.position.x < minNewX) minNewX = node.position.x;
      if (node.position.y < minNewY) minNewY = node.position.y;
    });

    // Calculate offset to place new workflow to the right with some spacing
    const horizontalSpacing = 300;
    const verticalSpacing = 100;
    
    const offsetX = maxX + horizontalSpacing - minNewX;
    const offsetY = Math.max(0, (maxY + verticalSpacing) - minNewY);

    return { x: offsetX, y: offsetY };
  }, [nodes]);

  // Function to append AI-generated workflow to existing canvas
  const appendAiWorkflowToCanvas = useCallback(async (prompt: string) => {
    try {
      // Generate workflow using AI
      const generatedWorkflow = await generateWorkflowFromPrompt(prompt);
      
      // Calculate offset for new nodes
      const offset = calculateWorkflowOffset(generatedWorkflow.nodes);
      
      // Apply offset to new nodes
      const offsetNodes = generatedWorkflow.nodes.map(node => ({
        ...node,
        id: `${node.id}-${Date.now()}`, // Ensure unique IDs
        position: {
          x: node.position.x + offset.x,
          y: node.position.y + offset.y
        },
        selected: false
      }));

      // Apply offset to new edges and update IDs
      const offsetEdges = generatedWorkflow.edges.map(edge => ({
        ...edge,
        id: `${edge.id}-${Date.now()}`, // Ensure unique IDs
        source: `${edge.source}-${Date.now()}`,
        target: `${edge.target}-${Date.now()}`,
        selected: false
      }));

      // Append to existing nodes and edges
      setNodes(prev => [...prev, ...offsetNodes]);
      setEdges(prev => [...prev, ...offsetEdges]);
      
      // Save to history after state updates
      setTimeout(() => saveToHistory(), 0);
      
      toast({
        title: "Workflow Added",
        description: `Added ${offsetNodes.length} nodes and ${offsetEdges.length} connections to canvas.`,
        variant: "default"
      });
      
    } catch (error) {
      console.error('Workflow generation error:', error);
      
      let title = "Generation Failed";
      let description = "Failed to generate workflow. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes('401')) {
          title = "Authentication Error";
          description = "Invalid API key. Please check your OpenAI API key in AI Settings.";
        } else if (error.message.includes('429')) {
          title = "Rate Limit Exceeded";
          description = "Too many requests. Please wait a moment and try again.";
        } else if (error.message.includes('500')) {
          title = "Server Error";
          description = "OpenAI service is temporarily unavailable. Please try again later.";
        } else {
          description = error.message;
        }
      }
      
      toast({
        title,
        description,
        variant: "destructive"
      });
    }
  }, [generateWorkflowFromPrompt, calculateWorkflowOffset, saveToHistory, toast]);

  // Function to append imported workflow to existing canvas
  const appendImportedWorkflowToCanvas = useCallback((importedWorkflow: { nodes: Node[]; edges: Edge[]; viewport?: any }) => {
    if (!importedWorkflow.nodes || !importedWorkflow.edges) {
      toast({
        title: "Import Failed",
        description: "Invalid workflow format. Must contain nodes and edges.",
        variant: "destructive"
      });
      return;
    }

    // Calculate offset for new nodes
    const offset = calculateWorkflowOffset(importedWorkflow.nodes);
    
    // Apply offset to imported nodes
    const offsetNodes = importedWorkflow.nodes.map(node => ({
      ...node,
      id: `${node.id}-imported-${Date.now()}`, // Ensure unique IDs
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y
      },
      selected: false
    }));

    // Apply offset to imported edges and update IDs
    const offsetEdges = importedWorkflow.edges.map(edge => ({
      ...edge,
      id: `${edge.id}-imported-${Date.now()}`, // Ensure unique IDs
      source: `${edge.source}-imported-${Date.now()}`,
      target: `${edge.target}-imported-${Date.now()}`,
      selected: false
    }));

    // Append to existing nodes and edges
    setNodes(prev => [...prev, ...offsetNodes]);
    setEdges(prev => [...prev, ...offsetEdges]);
    
    // Save to history after state updates
    setTimeout(() => saveToHistory(), 0);
    
    toast({
      title: "Workflow Imported",
      description: `Added ${offsetNodes.length} nodes and ${offsetEdges.length} connections to canvas.`,
      variant: "default"
    });
  }, [calculateWorkflowOffset, saveToHistory, toast]);

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
  const [showNewTabModal, setShowNewTabModal] = useState(false);
  const [showPluginTest, setShowPluginTest] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node?: Node } | null>(null);

  // Expose tab manager to global window for pro plugins
  useEffect(() => {
    (window as any).tabManager = {
      currentTab: activeTab,
      tabs: tabs,
      setTabs: setTabs,
      setActiveTabId: setActiveTabId,
      updateTab: updateActiveTab
    };
  }, [activeTab, tabs, setTabs, setActiveTabId, updateActiveTab]);

  // Auto-register demo plugins when component mounts
  useEffect(() => {
    const registerPlugins = async () => {
      try {
        const { kiteFrameCore, consolePlugin, testPlugin, advancedInteractionsPlugin, versionControlPlugin } = await import('@/lib/kiteframe');
        kiteFrameCore.use(consolePlugin);
        kiteFrameCore.use(testPlugin);
        kiteFrameCore.use(advancedInteractionsPlugin);
        kiteFrameCore.use(versionControlPlugin);
        console.log('✅ Demo + Pro plugins registered successfully');
        console.log('🔌 Plugin System Ready! Check Settings → Test Plugins or watch console for activity');
        console.log('🚀 Advanced Interactions Pro: Quick-add handles enabled on node hover!');
      } catch (error) {
        console.error('❌ Plugin registration error:', error);
        console.log('ℹ️ Some plugins may not have loaded correctly');
      }
    };
    registerPlugins();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <Toolbar
          onOpenAiSettings={() => setShowAiModal(true)}
          onOpenPluginTest={() => setShowPluginTest(true)}
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
              onClick={() => setShowNewTabModal(true)}
              data-testid="button-new-tab"
              title="New Workflow Tab"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Sidebar or Edge Customizer */}
          <div className="w-64 sm:w-80 border-r border-border flex flex-col">
            {selectedEdgeId ? (
              <EdgeCustomizer
                selectedEdge={edges.find(e => e.id === selectedEdgeId)}
                onEdgeUpdate={(edgeId: string, updates: Partial<Edge>) => {
                  setEdges(prev => prev.map(e => e.id === edgeId ? { ...e, ...updates } : e));
                  saveToHistory();
                }}
                onDeselectEdge={() => {
                  setSelectedEdgeId('');
                  setEdges(prev => prev.map(e => ({ ...e, selected: false })));
                }}
              />
            ) : (
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
              onImport={() => {
                // Create hidden file input for importing and appending to existing workflow
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const data = JSON.parse(event.target?.result as string);
                      appendImportedWorkflowToCanvas(data);
                    } catch (error) {
                      toast({
                        title: "Import Failed",
                        description: "Invalid JSON file. Please select a valid workflow file.",
                        variant: "destructive"
                      });
                    }
                  };
                  reader.readAsText(file);
                };
                input.click();
              }}
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
                // Update the node with the image data and auto-size
                const img = new Image();
                img.onload = () => {
                  const maxWidth = 300;
                  const maxHeight = 250;
                  const headerHeight = 30;
                  
                  const aspectRatio = img.naturalWidth / img.naturalHeight;
                  let imageWidth = img.naturalWidth;
                  let imageHeight = img.naturalHeight;
                  
                  // Scale down if needed to fit constraints
                  const scaleX = imageWidth > maxWidth ? maxWidth / imageWidth : 1;
                  const scaleY = imageHeight > maxHeight ? maxHeight / imageHeight : 1;
                  const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
                  
                  imageWidth = Math.round(imageWidth * scale);
                  imageHeight = Math.round(imageHeight * scale);
                  
                  setNodes(prev => prev.map(n => 
                    n.id === nodeId 
                      ? { 
                          ...n, 
                          width: Math.max(200, imageWidth + 20), // Add padding
                          height: imageHeight + headerHeight + 20, // Add header and padding
                          data: { ...n.data, src: objectPath, filename }
                        }
                      : n
                  ));
                  saveToHistory();
                };
                img.src = objectPath;
              }}
              onImageUrl={(nodeId: string, url: string) => {
                // Update the node with the image URL and auto-size
                const img = new Image();
                img.onload = () => {
                  const maxWidth = 300;
                  const maxHeight = 250;
                  const headerHeight = 30;
                  
                  const aspectRatio = img.naturalWidth / img.naturalHeight;
                  let imageWidth = img.naturalWidth;
                  let imageHeight = img.naturalHeight;
                  
                  // Scale down if needed to fit constraints
                  const scaleX = imageWidth > maxWidth ? maxWidth / imageWidth : 1;
                  const scaleY = imageHeight > maxHeight ? maxHeight / imageHeight : 1;
                  const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
                  
                  imageWidth = Math.round(imageWidth * scale);
                  imageHeight = Math.round(imageHeight * scale);
                  
                  setNodes(prev => prev.map(n => 
                    n.id === nodeId 
                      ? { 
                          ...n, 
                          width: Math.max(200, imageWidth + 20), // Add padding
                          height: imageHeight + headerHeight + 20, // Add header and padding
                          data: { ...n.data, src: url, sourceUrl: url }
                        }
                      : n
                  ));
                  saveToHistory();
                };
                img.src = url;
              }}
              showImageModal={showImageModal}
              onOpenImageModal={setShowImageModal}
              onCloseImageModal={() => setShowImageModal(null)}
              onOpenAiGenerator={() => setShowAiGenerator(true)}
              />
            )}
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
              // Save AI settings to localStorage
              localStorage.setItem('ai_settings', JSON.stringify(settings));
              if (settings.apiKey) {
                localStorage.setItem('openai_api_key', settings.apiKey);
              }
              console.log('AI settings saved:', settings);
              setShowAiModal(false);
              // Update the AI client with new settings
              onAiSettingsChange?.();
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
              
              // Append generated workflow to existing canvas instead of replacing it
              if (generatedWorkflow.nodes && generatedWorkflow.edges) {
                // Calculate offset for new nodes
                const offset = calculateWorkflowOffset(generatedWorkflow.nodes);
                
                // Generate unique timestamp for this batch
                const batchId = Date.now();
                const randomSuffix = Math.random().toString(36).substr(2, 9);
                
                // Create a mapping from old node IDs to new node IDs
                const nodeIdMapping: { [oldId: string]: string } = {};
                
                // Apply offset to new nodes with guaranteed unique IDs
                const offsetNodes = generatedWorkflow.nodes.map((node: Node, index: number) => {
                  const oldId = node.id || `node-${index}`;
                  const newId = `${oldId}-ai-${batchId}-${index}`;
                  nodeIdMapping[oldId] = newId;
                  
                  return {
                    ...node,
                    id: newId,
                    position: {
                      x: node.position.x + offset.x,
                      y: node.position.y + offset.y
                    },
                    selected: false
                  };
                });

                // Apply offset to new edges and update IDs using the mapping
                const offsetEdges = generatedWorkflow.edges.map((edge: Edge, index: number) => ({
                  ...edge,
                  id: `${edge.id || `edge-${index}`}-ai-${batchId}-${index}`,
                  source: nodeIdMapping[edge.source] || edge.source,
                  target: nodeIdMapping[edge.target] || edge.target,
                  selected: false
                }));

                // Append to existing nodes and edges
                setNodes(prev => [...prev, ...offsetNodes]);
                setEdges(prev => [...prev, ...offsetEdges]);
                
                console.log('📝 AI WORKFLOW APPENDED TO CANVAS:', { 
                  addedNodes: offsetNodes.length, 
                  addedEdges: offsetEdges.length 
                });
                
                // Save to history after state updates
                setTimeout(() => saveToHistory(), 0);
                
                toast({
                  title: "Workflow Generated",
                  description: `Added ${offsetNodes.length} nodes and ${offsetEdges.length} connections to canvas.`,
                  variant: "default"
                });
              }
              
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
        {showNewTabModal && (
          <NewTabModal
            isOpen={showNewTabModal}
            onClose={() => setShowNewTabModal(false)}
            onCreateBlank={handleCreateBlank}
            onCreateFromPrompt={handleCreateFromPrompt}
            onCreateFromFile={handleCreateFromFile}
            onCreateFromTemplate={handleCreateFromTemplate}
          />
        )}

        {/* Plugin Test Panel */}
        {showPluginTest && (
          <PluginTestPanel
            onClose={() => setShowPluginTest(false)}
            nodes={nodes}
            edges={edges}
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
  );
}

// Main wrapper component that provides AiProvider context
export default function WorkflowEditor() {
  const createAiClient = useCallback(() => {
    // Load saved AI settings
    const savedSettings = localStorage.getItem('ai_settings');
    let baseURL = 'https://api.openai.com/v1';
    let defaultModel = 'gpt-4o'; // using gpt-4o as it's available with current API key access
    
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        
        // Legacy model migration for gpt-5 -> gpt-4o
        if (settings.model === 'gpt-5') {
          settings.model = 'gpt-4o';
          localStorage.setItem('ai_settings', JSON.stringify(settings));
        }
        
        if (settings.provider === 'custom' && settings.customEndpoint) {
          baseURL = settings.customEndpoint;
        } else if (settings.provider === 'anthropic') {
          baseURL = 'https://api.anthropic.com/v1';
        }
        defaultModel = settings.model === 'custom' && settings.customModel 
          ? settings.customModel 
          : settings.model || defaultModel;
      } catch (e) {
        console.warn('Failed to parse saved AI settings');
      }
    }
    
    return new OpenAICompatClient({
      baseURL,
      apiKey: localStorage.getItem('openai_api_key') || '',
      defaultModel
    });
  }, []);

  const [aiClient, setAiClient] = useState<OpenAICompatClient>(createAiClient);

  // Function to update AI client when settings change
  const updateAiClient = useCallback(() => {
    setAiClient(createAiClient());
  }, [createAiClient]);

  return (
    <AiProvider client={aiClient}>
      <WorkflowEditorContent onAiSettingsChange={updateAiClient} />
    </AiProvider>
  );
}