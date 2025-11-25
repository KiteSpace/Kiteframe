import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { usePluginSystem } from '@/lib/kiteframe/core/PluginProvider';
import { WorkflowCanvas } from '@/components/WorkflowCanvas';
import FloatingLayersWidget from '@/components/layers/FloatingLayersWidget';
import { BlankCanvasState } from '@/components/BlankCanvasState';
import { PluginProvider, layoutPlugin, consolePlugin, testPlugin, advancedInteractionsPlugin } from '@/lib/kiteframe';
import { PluginTestButton } from '@/components/PluginTestButton';
import { PluginTestPanel } from '@/components/PluginTestPanel';

import { Sidebar } from '@/components/Sidebar';
import { CollapsedSidebar } from '@/components/CollapsedSidebar';
import { NodeTypesPopout } from '@/components/NodeTypesPopout';
import { ShapesPopout } from '@/components/ShapesPopout';
import { PropertiesCard } from '@/components/PropertiesCard';
import { Toolbar } from '@/components/Toolbar';
import { AiSettingsModal } from '@/components/AiSettingsModal';
import { AiWorkflowGenerator } from '@/components/AiWorkflowGenerator';
import { KiteAIChat } from '@/components/KiteAIChat';
import { WorkflowImportModal } from '@/components/WorkflowImportModal';
import { BugReportModal } from '@/components/BugReportModal';
import { ContextMenu } from '@/components/ContextMenu';
import { MissingImagesModal } from '@/components/MissingImagesModal';
import { NewTabModal } from '@/components/NewTabModal';
import { ImageUploadModal } from '@/lib/kiteframe/components/modals/ImageUploadModal';
import { AiProvider, useAi } from '../ai/AiProvider';
import { OpenAICompatClient } from '../ai/OpenAICompatClient';
import { useToast } from '@/hooks/use-toast';
import { ObjectUploader } from '@/components/ObjectUploader';
import { useFirebaseWorkflows } from '../hooks/useFirebaseWorkflows';
import { useAuth } from '../hooks/useAuth';
import type { Node, Edge, CanvasObject, ProFeaturesConfig, NodeType, TextNodeData, ShapeNodeData, StickyNoteData } from '../lib/kiteframe/types';
import { DEFAULT_SHAPE_NODE_DATA } from '../lib/kiteframe/constants/defaults';
import { recalculateAllEdgeZIndexes } from '../lib/kiteframe/utils/edgeZIndex';
import { applyThemeToNode, applyThemeToEdge, workflowThemes, getThemeById, type WorkflowTheme } from '../lib/themes';
import { isPureBlack, isPureWhite, getOppositeTextColor } from '../lib/kiteframe/utils/colorUtils';
import '../lib/kiteframe/styles/kiteframe.css';
import { 
  X, 
  Plus, 
  Brain, 
  Workflow, 
  Type, 
  Shapes, 
  StickyNote, 
  Route,
  Palette,
  MapPin,
  Network,
  Layers,
  UserPlus,
  CircuitBoard,
  Maximize2, 
  Trash2, 
  Download, 
  Upload, 
  Menu, 
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Workflow metadata types
interface WorkflowLink {
  id: string;
  text: string;
  url: string;
}

interface WorkflowMetadata {
  name: string;
  description: string;
  links: WorkflowLink[];
  linksFormat: 'bulleted' | 'text';
  categories: string[];
}

// Type for a single workflow tab
interface WorkflowTab {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  canvasObjects: CanvasObject[];
  viewport: { x: number; y: number; zoom: number };
  selectedNodeId: string;
  selectedEdgeId: string;
  history: Array<{ nodes: Node[]; edges: Edge[]; canvasObjects: CanvasObject[]; viewport: { x: number; y: number; zoom: number } }>;
  historyIndex: number;
  showImageModal: string | null;
  metadata: WorkflowMetadata;
}

function WorkflowEditorContent({ onAiSettingsChange }: { onAiSettingsChange?: () => void }) {
  const ai = useAi();
  const { toast } = useToast();

  // Editor Settings State with persistence
  const [editorSettings, setEditorSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('kiteframe-editor-settings');
      return saved ? JSON.parse(saved) : {
        nodeAutoConnect: true,
        snapToGuides: true
      };
    } catch {
      return {
        nodeAutoConnect: true,
        snapToGuides: true
      };
    }
  });

  // Save editor settings to localStorage
  useEffect(() => {
    localStorage.setItem('kiteframe-editor-settings', JSON.stringify(editorSettings));
  }, [editorSettings]);

  // Pro Features Configuration (now reactive to editor settings)
  const proFeaturesConfig: ProFeaturesConfig = useMemo(() => ({
    quickAdd: {
      enabled: true,
      showGhostPreview: true,
      defaultSpacing: 250,
      defaultNodeType: 'process',
      defaultNodeTemplate: {
        label: 'New Process',
        description: 'Configure process settings',
        icon: 'Cog',
        iconColor: 'text-gray-500'
      },
      onQuickAdd: (sourceNode, position, newNode) => {
        console.log('📊 Quick-add node created:', { source: sourceNode.id, position, new: newNode.id });
        toast({
          title: "Node Added",
          description: `Added ${newNode.data?.label} to the ${position} of ${sourceNode.data?.label}`,
        });
      }
    },
    copyPaste: {
      enabled: true,
      offsetDistance: 50,
      onCopy: (node) => {
        console.log('📋 Node copied:', node.id);
        toast({
          title: "Node Copied",
          description: `${node.data?.label} copied to clipboard`,
        });
      },
      onPaste: (originalNode, newNode) => {
        console.log('📋 Node pasted:', { original: originalNode.id, new: newNode.id });
        toast({
          title: "Node Pasted",
          description: `${newNode.data?.label} pasted from ${originalNode.data?.label}`,
        });
      }
    },
    advancedSelection: {
      enabled: true,
      enableMultiSelect: true,
      enableShiftDragSelection: true,
      selectionRectStyle: {
        border: '2px dashed #3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '4px'
      }
    },
    versionControl: {
      enabled: true,
      autoSaveInterval: 30000,
      maxSnapshots: 50,
      enableComparison: true,
      onSnapshot: (snapshot) => {
        console.log('📸 Snapshot created:', snapshot);
      }
    },
    edgeReconnection: {
      enabled: true,
      enableAllEdges: true, // Make all edges reconnectable by default
      visualFeedback: {
        handleColor: '#3b82f6',
        previewColor: '#3b82f6',
        validColor: '#22c55e',
        invalidColor: '#ef4444'
      }
    },
    smartGuides: {
      enabled: editorSettings.snapToGuides,
      threshold: 10,
      showGuides: editorSettings.snapToGuides,
      snapToNodes: editorSettings.snapToGuides,
      snapToGrid: false,
      gridSize: 20,
      snapToCanvas: editorSettings.snapToGuides
    },
    smartConnect: {
      enabled: editorSettings.nodeAutoConnect,
      threshold: 50,
      autoConnect: editorSettings.nodeAutoConnect,
      showPreview: editorSettings.nodeAutoConnect
    }
  }), [editorSettings]);

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
    const edgeTypes = ['bezier', 'straight'] as const;
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
        markers: { type: 'arrow' as const, position: 'end' as const }
      },
      {
        id: 'edge-2',
        source: 'node-2',
        target: 'node-3',
        type: edgeTypes[Math.floor(Math.random() * edgeTypes.length)],
        animated: Math.random() > 0.5,
        style: { strokeColor: colors[Math.floor(Math.random() * colors.length)], strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      }
    ];

    return { nodes, edges };
  }, []);

  // Generate User Journey template
  const generateUserJourneyTemplate = useCallback((): { nodes: Node[]; edges: Edge[] } => {
    const journeySteps = [
      'Discovery', 'Awareness', 'Research', 'Consideration', 'Decision', 
      'Purchase', 'Onboarding', 'Usage', 'Support', 'Advocacy'
    ];
    
    const touchpoints = [
      'Website Visit', 'Social Media', 'Email Campaign', 'Product Demo', 
      'Customer Service', 'Mobile App', 'In-Store Experience', 'Review Platform'
    ];
    
    const emotions = [
      'Curious', 'Excited', 'Overwhelmed', 'Confident', 'Satisfied', 
      'Frustrated', 'Delighted', 'Concerned', 'Hopeful', 'Loyal'
    ];

    const selectedSteps = journeySteps.sort(() => 0.5 - Math.random()).slice(0, 5);
    const nodes = selectedSteps.map((step, index) => {
      const touchpoint = touchpoints[Math.floor(Math.random() * touchpoints.length)];
      const emotion = emotions[Math.floor(Math.random() * emotions.length)];
      
      return {
        id: `step-${index + 1}`,
        type: index === 0 ? 'input' : index === selectedSteps.length - 1 ? 'output' : 'process',
        position: { x: 150 + index * 350, y: 200 + Math.random() * 80 },
        data: {
          label: step,
          description: `${touchpoint}\nFeeling: ${emotion}`,
          icon: index === 0 ? 'ArrowRight' : index === selectedSteps.length - 1 ? 'ArrowLeft' : 'User',
          iconColor: index === 0 ? 'text-blue-500' : index === selectedSteps.length - 1 ? 'text-red-500' : 'text-green-500'
        },
        width: 200,
        height: 100
      };
    });

    const edges: Edge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `journey-edge-${i + 1}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
        type: 'bezier' as const,
        animated: true,
        style: { strokeColor: 'hsl(142.1, 76.2%, 36.3%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      });
    }

    return { nodes, edges };
  }, []);

  // Generate Mindmap template
  const generateMindmapTemplate = useCallback((): { nodes: Node[]; edges: Edge[] } => {
    const centralTopics = [
      'Product Strategy', 'Marketing Plan', 'Business Model', 'User Research',
      'Project Goals', 'Innovation Ideas', 'Team Structure', 'Growth Strategy'
    ];
    
    const subtopics = [
      'Market Analysis', 'Customer Segments', 'Features', 'Pricing', 'Channels',
      'Resources', 'Timeline', 'Metrics', 'Risks', 'Opportunities', 'Partnerships',
      'Technology', 'Design', 'Operations', 'Finance', 'Legal', 'Quality'
    ];

    const centralTopic = centralTopics[Math.floor(Math.random() * centralTopics.length)];
    const selectedSubtopics = subtopics.sort(() => 0.5 - Math.random()).slice(0, 6);

    const nodes = [
      {
        id: 'central',
        type: 'process',
        position: { x: 600, y: 300 },
        data: {
          label: centralTopic,
          description: 'Central topic',
          icon: 'Target',
          iconColor: 'text-purple-500'
        },
        width: 200,
        height: 100
      }
    ];

    const angles = [0, 60, 120, 180, 240, 300].slice(0, selectedSubtopics.length);
    selectedSubtopics.forEach((topic, index) => {
      const angle = (angles[index] * Math.PI) / 180;
      const radius = 350;
      const x = 500 + radius * Math.cos(angle);
      const y = 250 + radius * Math.sin(angle);

      nodes.push({
        id: `branch-${index + 1}`,
        type: 'condition',
        position: { x, y },
        data: {
          label: topic,
          description: `Branch: ${topic}`,
          icon: 'GitBranch',
          iconColor: 'text-blue-500'
        },
        width: 180,
        height: 90
      });
    });

    const edges: Edge[] = [];
    for (let i = 1; i < nodes.length; i++) {
      edges.push({
        id: `mind-edge-${i}`,
        source: 'central',
        target: nodes[i].id,
        type: 'straight' as const,
        animated: false,
        style: { strokeColor: 'hsl(262.1, 83.3%, 57.8%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      });
    }

    return { nodes, edges };
  }, []);

  // Generate System Architecture template
  const generateSystemArchitectureTemplate = useCallback((): { nodes: Node[]; edges: Edge[] } => {
    const systems = [
      'Load Balancer', 'API Gateway', 'Web Server', 'Application Server',
      'Database', 'Cache Layer', 'Message Queue', 'File Storage', 'CDN',
      'Authentication Service', 'Monitoring', 'Analytics', 'Backup System'
    ];

    const selectedSystems = systems.sort(() => 0.5 - Math.random()).slice(0, 6);
    const layers = [
      { y: 100, label: 'Presentation Layer' },
      { y: 200, label: 'API Layer' },
      { y: 300, label: 'Business Logic' },
      { y: 400, label: 'Data Layer' }
    ];

    const nodes = selectedSystems.map((system, index) => {
      const layer = layers[Math.floor(index / 2) % layers.length];
      const xOffset = (index % 2) * 400 + 200;

      return {
        id: `sys-${index + 1}`,
        type: 'process',
        position: { x: xOffset, y: layer.y + Math.random() * 50 },
        data: {
          label: system,
          description: `${layer.label}\nComponent: ${system}`,
          icon: 'Server',
          iconColor: 'text-orange-500'
        },
        width: 200,
        height: 100
      };
    });

    const edges: Edge[] = [];
    
    // Guarantee base chain of connections
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `sys-edge-${edges.length + 1}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
        type: 'bezier' as const,
        animated: false,
        style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      });
    }

    // Add optional extra connections for complexity
    for (let i = 0; i < nodes.length - 2; i++) {
      if (Math.random() > 0.6) { // 40% chance of skip connections
        edges.push({
          id: `sys-edge-${edges.length + 1}`,
          source: nodes[i].id,
          target: nodes[i + 2].id,
          type: 'bezier' as const,
          animated: false,
          style: { strokeColor: 'hsl(262.1, 83.3%, 57.8%)', strokeWidth: 1 },
          markers: { type: 'arrow' as const, position: 'end' as const }
        });
      }
    }

    return { nodes, edges };
  }, []);

  // Generate Swim Lanes template
  const generateSwimLanesTemplate = useCallback((): { nodes: Node[]; edges: Edge[] } => {
    const lanes = [
      'Customer', 'Sales Team', 'Marketing', 'Support', 'Development',
      'Management', 'Finance', 'Operations', 'Legal', 'Design'
    ];

    const activities = [
      'Submit Request', 'Review Application', 'Approve Process', 'Create Account',
      'Send Notification', 'Generate Report', 'Schedule Meeting', 'Update Status',
      'Verify Information', 'Complete Task', 'Archive Records', 'Follow Up'
    ];

    // Generate 4-7 total nodes across 3 lanes
    const selectedLanes = lanes.sort(() => 0.5 - Math.random()).slice(0, 3);
    const totalNodes = 4 + Math.floor(Math.random() * 4); // 4-7 nodes
    const selectedActivities = activities.sort(() => 0.5 - Math.random()).slice(0, totalNodes);

    const nodes: Node[] = [];
    const laneNodes: { [laneIndex: number]: string[] } = {};
    const laneHeight = 150;

    // Distribute activities across lanes ensuring each lane has at least 1 node
    selectedLanes.forEach((lane, laneIndex) => {
      laneNodes[laneIndex] = [];
    });

    selectedActivities.forEach((activity, actIndex) => {
      const laneIndex = actIndex < selectedLanes.length 
        ? actIndex // First activities go to different lanes
        : Math.floor(Math.random() * selectedLanes.length); // Rest distributed randomly
      
      const activityIndexInLane = laneNodes[laneIndex].length;
      const nodeId = `lane-${laneIndex}-act-${activityIndexInLane}`;
      laneNodes[laneIndex].push(nodeId);

      nodes.push({
        id: nodeId,
        type: activityIndexInLane === 0 ? 'input' : 'process',
        position: { x: 250 + activityIndexInLane * 350, y: 150 + laneIndex * laneHeight },
        data: {
          label: activity,
          description: `Lane: ${selectedLanes[laneIndex]}\nActivity: ${activity}`,
          icon: activityIndexInLane === 0 ? 'ArrowRight' : 'Activity',
          iconColor: `hsl(${laneIndex * 120}, 70%, 50%)`
        },
        width: 200,
        height: 90
      });
    });

    const edges: Edge[] = [];
    
    // Connect nodes within each lane
    Object.keys(laneNodes).forEach(laneIndexStr => {
      const laneIndex = parseInt(laneIndexStr);
      const nodesInLane = laneNodes[laneIndex];
      
      for (let i = 0; i < nodesInLane.length - 1; i++) {
        edges.push({
          id: `swim-edge-lane-${laneIndex}-${i}`,
          source: nodesInLane[i],
          target: nodesInLane[i + 1],
          type: 'bezier' as const,
          animated: true,
          style: { strokeColor: `hsl(${laneIndex * 120}, 70%, 50%)`, strokeWidth: 2 },
          markers: { type: 'arrow' as const, position: 'end' as const }
        });
      }
    });

    // Add optional cross-lane handoffs for semantic workflow
    if (selectedLanes.length >= 2 && Math.random() > 0.4) {
      const lane1Nodes = laneNodes[0];
      const lane2Nodes = laneNodes[1];
      
      if (lane1Nodes.length > 0 && lane2Nodes.length > 0) {
        edges.push({
          id: 'swim-edge-handoff-1',
          source: lane1Nodes[lane1Nodes.length - 1], // Last node in first lane
          target: lane2Nodes[0], // First node in second lane
          type: 'bezier' as const,
          animated: false,
          style: { strokeColor: 'hsl(346.8, 77.2%, 49.8%)', strokeWidth: 2, strokeDasharray: '5,5' },
          markers: { type: 'arrow' as const, position: 'end' as const }
        });
      }
    }

    return { nodes, edges };
  }, []);

  // Generate User Account Creation template
  const generateUserAccountTemplate = useCallback((): { nodes: Node[]; edges: Edge[] } => {
    const steps = [
      'Registration Form', 'Email Verification', 'Profile Setup', 'Preferences',
      'Welcome Tour', 'First Login', 'Account Activation', 'Security Setup'
    ];

    const validationSteps = [
      'Validate Email', 'Check Password Strength', 'Verify Phone', 'Duplicate Check',
      'Terms Acceptance', 'Age Verification', 'Captcha Check', 'Fraud Detection'
    ];

    // Generate 4-7 total nodes (main steps + validations)
    const totalNodes = 4 + Math.floor(Math.random() * 4); // 4-7 nodes
    const mainStepsCount = Math.max(3, Math.ceil(totalNodes * 0.6)); // 60% main steps, min 3
    const validationsCount = totalNodes - mainStepsCount;
    
    const selectedSteps = steps.sort(() => 0.5 - Math.random()).slice(0, mainStepsCount);
    const selectedValidations = validationSteps.sort(() => 0.5 - Math.random()).slice(0, validationsCount);

    const nodes = selectedSteps.map((step, index) => ({
      id: `account-${index + 1}`,
      type: index === 0 ? 'input' : index === selectedSteps.length - 1 ? 'output' : 'process',
      position: { x: 200 + index * 300, y: 200 },
      data: {
        label: step,
        description: `User account creation step: ${step}`,
        icon: index === 0 ? 'UserPlus' : index === selectedSteps.length - 1 ? 'CheckCircle' : 'User',
        iconColor: index === 0 ? 'text-green-500' : index === selectedSteps.length - 1 ? 'text-blue-500' : 'text-purple-500'
      },
      width: 180,
      height: 100
    }));

    // Add validation nodes
    selectedValidations.forEach((validation, index) => {
      nodes.push({
        id: `validation-${index + 1}`,
        type: 'condition',
        position: { x: 250 + index * 200, y: 300 },
        data: {
          label: validation,
          description: `Validation: ${validation}`,
          icon: 'Shield',
          iconColor: 'text-yellow-500'
        },
        width: 160,
        height: 80
      });
    });

    const edges: Edge[] = [];
    // Main flow edges
    for (let i = 0; i < selectedSteps.length - 1; i++) {
      edges.push({
        id: `account-edge-${i + 1}`,
        source: `account-${i + 1}`,
        target: `account-${i + 2}`,
        type: 'bezier' as const,
        animated: true,
        style: { strokeColor: 'hsl(142.1, 76.2%, 36.3%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      });
    }

    // Validation edges
    selectedValidations.forEach((_, index) => {
      if (index < selectedSteps.length - 1) {
        edges.push({
          id: `val-edge-${index + 1}`,
          source: `account-${index + 1}`,
          target: `validation-${index + 1}`,
          type: 'straight' as const,
          animated: false,
          style: { strokeColor: 'hsl(45, 93%, 47%)', strokeWidth: 2 },
          markers: { type: 'arrow' as const, position: 'end' as const }
        });
      }
    });

    return { nodes, edges };
  }, []);

  // Generate I/O Logic template
  const generateIOLogicTemplate = useCallback((): { nodes: Node[]; edges: Edge[] } => {
    const inputSources = [
      'File Upload', 'API Request', 'Database Query', 'User Input',
      'Sensor Data', 'External Service', 'Message Queue', 'Webhook'
    ];

    const processes = [
      'Data Validation', 'Transform Format', 'Apply Rules', 'Filter Data',
      'Calculate Values', 'Merge Datasets', 'Aggregate Results', 'Clean Data'
    ];

    const outputDestinations = [
      'Database Write', 'File Export', 'API Response', 'Email Notification',
      'Dashboard Update', 'Report Generation', 'Alert System', 'Cache Update'
    ];

    const selectedInputs = inputSources.sort(() => 0.5 - Math.random()).slice(0, 2);
    const selectedProcesses = processes.sort(() => 0.5 - Math.random()).slice(0, 3);
    const selectedOutputs = outputDestinations.sort(() => 0.5 - Math.random()).slice(0, 2);

    const nodes: Node[] = [];

    // Input nodes
    selectedInputs.forEach((input, index) => {
      nodes.push({
        id: `input-${index + 1}`,
        type: 'input',
        position: { x: 150 + index * 250, y: 150 },
        data: {
          label: input,
          description: `Input source: ${input}`,
          icon: 'ArrowRight',
          iconColor: 'text-blue-500'
        },
        width: 160,
        height: 80
      });
    });

    // Processing nodes
    selectedProcesses.forEach((process, index) => {
      nodes.push({
        id: `process-${index + 1}`,
        type: index === Math.floor(selectedProcesses.length / 2) ? 'condition' : 'process',
        position: { x: 200 + index * 300, y: 300 },
        data: {
          label: process,
          description: `Processing: ${process}`,
          icon: index === Math.floor(selectedProcesses.length / 2) ? 'HelpCircle' : 'Cog',
          iconColor: index === Math.floor(selectedProcesses.length / 2) ? 'text-yellow-500' : 'text-green-500'
        },
        width: 180,
        height: 90
      });
    });

    // Output nodes
    selectedOutputs.forEach((output, index) => {
      nodes.push({
        id: `output-${index + 1}`,
        type: 'output',
        position: { x: 250 + index * 250, y: 450 },
        data: {
          label: output,
          description: `Output destination: ${output}`,
          icon: 'ArrowLeft',
          iconColor: 'text-red-500'
        },
        width: 160,
        height: 80
      });
    });

    const edges: Edge[] = [];
    
    // Connect inputs to first process
    selectedInputs.forEach((_, index) => {
      edges.push({
        id: `io-edge-input-${index + 1}`,
        source: `input-${index + 1}`,
        target: 'process-1',
        type: 'bezier' as const,
        animated: true,
        style: { strokeColor: 'hsl(221.2, 83.2%, 53.3%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      });
    });

    // Connect processes
    for (let i = 0; i < selectedProcesses.length - 1; i++) {
      edges.push({
        id: `io-edge-process-${i + 1}`,
        source: `process-${i + 1}`,
        target: `process-${i + 2}`,
        type: 'bezier' as const,
        animated: false,
        style: { strokeColor: 'hsl(142.1, 76.2%, 36.3%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      });
    }

    // Connect last process to outputs
    selectedOutputs.forEach((_, index) => {
      edges.push({
        id: `io-edge-output-${index + 1}`,
        source: `process-${selectedProcesses.length}`,
        target: `output-${index + 1}`,
        type: 'bezier' as const,
        animated: true,
        style: { strokeColor: 'hsl(346.8, 77.2%, 49.8%)', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      });
    });

    return { nodes, edges };
  }, []);

  // Create default tab with random workflow
  const createDefaultTab = useCallback((): WorkflowTab => {
    const { nodes, edges } = generateRandomWorkflow();
    const name = generateCuteName();
    const initialState = {
      nodes,
      edges,
      canvasObjects: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    
    return {
      id: generateTabId(),
      name,
      ...initialState,
      selectedNodeId: '',
      selectedEdgeId: '',
      history: [initialState], // Initialize with current state
      historyIndex: 0, // Start at index 0, not -1
      showImageModal: null,
      metadata: {
        name,
        description: '',
        links: [],
        linksFormat: 'text',
        categories: []
      }
    };
  }, [generateTabId, generateCuteName, generateRandomWorkflow]);

  // Create blank tab
  const createBlankTab = useCallback((): WorkflowTab => {
    const name = generateCuteName();
    const initialState = {
      nodes: [],
      edges: [],
      canvasObjects: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    
    return {
      id: generateTabId(),
      name,
      ...initialState,
      selectedNodeId: '',
      selectedEdgeId: '',
      history: [initialState], // Initialize with current state
      historyIndex: 0, // Start at index 0, not -1
      showImageModal: null,
      metadata: {
        name,
        description: '',
        links: [],
        linksFormat: 'text',
        categories: []
      }
    };
  }, [generateTabId, generateCuteName]);

  // Tab management state
  const [tabs, setTabs] = useState<WorkflowTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('dark-mode');
    return saved ? JSON.parse(saved) : false;
  });

  // Animation configuration state
  const [connectionAnimationConfig, setConnectionAnimationConfig] = useState<any>(() => {
    const saved = localStorage.getItem('connection-animation-config');
    return saved ? JSON.parse(saved) : {
      duration: 600,
      easing: 'ease-out',
      pulseOnConnection: true,
      showParticles: false,
      glowOnHover: true
    };
  });
  
  // SmartConnect preview state
  const [connectionPreview, setConnectionPreview] = useState<{ source: string; target: string } | null>(null);

  // Save animation config to localStorage
  useEffect(() => {
    localStorage.setItem('connection-animation-config', JSON.stringify(connectionAnimationConfig));
  }, [connectionAnimationConfig]);

  // Initialize tabs on first render - removed auto-create to show new creation experience

  // Migration effect: Fix existing tabs with invalid history state
  useEffect(() => {
    const hasInvalidTabs = tabs.some(tab => 
      tab.historyIndex === -1 || 
      tab.history.length === 0 || 
      (tab.history.length > 0 && tab.historyIndex >= tab.history.length)
    );

    if (hasInvalidTabs) {
      console.log('🔧 MIGRATING TABS: Fixing invalid history states');
      
      setTabs(prev => prev.map(tab => {
        // If tab has invalid history state, fix it
        if (tab.historyIndex === -1 || tab.history.length === 0 || tab.historyIndex >= tab.history.length) {
          const currentState = {
            nodes: tab.nodes,
            edges: tab.edges,
            canvasObjects: tab.canvasObjects || [],
            viewport: tab.viewport
          };
          
          console.log('🔧 MIGRATING TAB:', {
            tabId: tab.id,
            oldHistoryIndex: tab.historyIndex,
            oldHistoryLength: tab.history.length,
            newHistoryIndex: 0,
            newHistoryLength: 1
          });
          
          return {
            ...tab,
            history: [currentState],
            historyIndex: 0
          };
        }
        return tab;
      }));
    }
  }, [tabs]);

  // Dark mode effects
  useEffect(() => {
    // Apply/remove dark class to document element
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save to localStorage
    localStorage.setItem('dark-mode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);


  // Dark mode toggle function
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  // Get current active tab
  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  // Convenience getters for current tab state
  const nodes = activeTab?.nodes || [];
  const edges = activeTab?.edges || [];
  const canvasObjects = activeTab?.canvasObjects || [];
  const viewport = activeTab?.viewport || { x: 0, y: 0, zoom: 1 };
  const selectedNodeId = activeTab?.selectedNodeId || '';
  const selectedEdgeId = activeTab?.selectedEdgeId || '';
  
  // Derive selected canvas objects from active tab state
  const selectedCanvasObjects = useMemo(() => canvasObjects.filter(obj => obj.selected), [canvasObjects]);
  
  const history = activeTab?.history || [];
  const historyIndex = activeTab?.historyIndex ?? 0;
  const showImageModal = activeTab?.showImageModal || null;
  const metadata = activeTab?.metadata || {
    name: activeTab?.name || 'Untitled Workflow',
    description: '',
    links: [],
    linksFormat: 'text' as const,
    categories: []
  };

  // Update current tab
  const updateActiveTab = useCallback((updates: Partial<WorkflowTab>) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId ? { ...tab, ...updates } : tab
    ));
  }, [activeTabId]);

  // Track wireframe generation loading state
  const [generatingWireframe, setGeneratingWireframe] = useState(false);

  // Wireframe generation handler
  useEffect(() => {
    const handleGenerateWireframe = async (event: any) => {
      const { nodeId, node } = event.detail;
      
      if (!node || generatingWireframe) {
        // Ignore if already generating or no node provided
        if (generatingWireframe) {
          toast({
            title: 'Please wait',
            description: 'Wireframe generation in progress...',
          });
        }
        return;
      }

      try {
        setGeneratingWireframe(true);
        
        // Show loading toast
        toast({
          title: 'Generating wireframe...',
          description: `Creating mockup for "${node.data?.label || 'node'}"`,
        });

        // Call the wireframe generation API
        const response = await fetch('/api/generate-wireframe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            label: node.data?.label || 'Untitled',
            description: node.data?.description || '',
            nodeType: node.type || 'basic',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to generate wireframe' }));
          throw new Error(errorData.error || 'Failed to generate wireframe');
        }

        const { svg } = await response.json();

        // Convert SVG to data URL with proper encoding for non-ASCII characters
        const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

        // Create a new image node next to the source node
        const newImageNode: Node = {
          id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'image',
          position: {
            x: node.position.x + (node.width || 200) + 50, // Position to the right with some spacing
            y: node.position.y,
          },
          data: {
            label: `${node.data?.label || 'Node'} Mockup`,
            description: 'AI-generated wireframe',
            src: svgDataUrl,
            filename: `${node.data?.label || 'wireframe'}.svg`,
            sourceType: 'data',
            imageSize: 'contain',
          },
          width: 400,
          height: 300,
        };

        // Create auto-connection edge from source node to wireframe mockup
        const newEdge: Edge = {
          id: `edge-wireframe-${Date.now()}`,
          source: node.id,
          target: newImageNode.id,
          type: 'straight',
          style: {
            strokeColor: '#9333ea', // Purple color for mockup connections
            strokeWidth: 2,
            strokeDasharray: '5,5', // Dashed line
          },
          markers: {
            type: 'circle',
            position: 'end',
          },
          label: 'mockup',
          reconnectable: true,
          interactable: true,
        };

        // Add the new image node and edge to the canvas
        const currentTab = tabs.find(tab => tab.id === activeTabId);
        if (currentTab) {
          const currentNodes = currentTab.nodes;
          const currentEdges = currentTab.edges;
          
          // Save to history first
          const currentState = {
            nodes: currentNodes,
            edges: currentEdges,
            canvasObjects: currentTab.canvasObjects || [],
            viewport: currentTab.viewport
          };
          
          // Add to history
          const newHistory = currentTab.history.slice(0, currentTab.historyIndex + 1);
          newHistory.push(currentState);
          
          // Update with new node and edge
          updateActiveTab({
            nodes: [...currentNodes, newImageNode],
            edges: [...currentEdges, newEdge],
            history: newHistory,
            historyIndex: newHistory.length - 1,
          });

          toast({
            title: 'Wireframe generated!',
            description: 'AI-generated mockup added to canvas',
          });
        }
      } catch (error: any) {
        console.error('Wireframe generation error:', error);
        toast({
          title: 'Generation failed',
          description: error.message || 'Failed to generate wireframe. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setGeneratingWireframe(false);
      }
    };

    window.addEventListener('generateWireframe', handleGenerateWireframe);
    return () => {
      window.removeEventListener('generateWireframe', handleGenerateWireframe);
    };
  }, [tabs, activeTabId, toast, updateActiveTab, generatingWireframe]);

  // Theme change detection for text color updates using MutationObserver
  useEffect(() => {
    if (!activeTab) return;

    const handleThemeChange = () => {
      const currentTab = activeTabRef.current;
      if (!currentTab) return;

      const currentCanvasObjects = currentTab.canvasObjects || [];
      let hasChanges = false;
      
      const updatedCanvasObjects = currentCanvasObjects.map(obj => {
        if (obj.type === 'text') {
          const textData = obj.data as TextNodeData;
          const currentTextColor = textData.textColor;
          
          // Only update pure black/white colors
          if (isPureBlack(currentTextColor) || isPureWhite(currentTextColor)) {
            const newTextColor = getOppositeTextColor(currentTextColor);
            hasChanges = true;
            
            return {
              ...obj,
              data: {
                ...textData,
                textColor: newTextColor
              }
            };
          }
        }
        return obj;
      });

      // Only update if there were changes
      if (hasChanges) {
        updateActiveTab({ canvasObjects: updatedCanvasObjects });
      }
    };

    // Create MutationObserver to watch for theme class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isDarkNow = document.documentElement.classList.contains('dark');
          
          // Only trigger if theme actually changed
          if (isDarkNow !== lastThemeIsDarkRef.current) {
            lastThemeIsDarkRef.current = isDarkNow;
            
            // Clear any existing timeout
            if (debounceTimeoutRef.current) {
              clearTimeout(debounceTimeoutRef.current);
            }
            
            // Debounce the theme change handling
            debounceTimeoutRef.current = setTimeout(handleThemeChange, 10);
          }
        }
      });
    });

    // Start observing the document element for class changes
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Cleanup observer and timeout on unmount or activeTab change
    return () => {
      observer.disconnect();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [activeTab?.id, updateActiveTab]);

  // Setters that update the active tab
  const setNodes = useCallback((newNodes: Node[] | ((prev: Node[]) => Node[])) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        const currentNodes = tab.nodes || [];
        const resolvedNodes = typeof newNodes === 'function' ? newNodes(currentNodes) : newNodes;
        return { ...tab, nodes: resolvedNodes };
      }
      return tab;
    }));
  }, [activeTabId, setTabs]);

  const setEdges = useCallback((newEdges: Edge[] | ((prev: Edge[]) => Edge[])) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        const currentEdges = tab.edges || [];
        const resolvedEdges = typeof newEdges === 'function' ? newEdges(currentEdges) : newEdges;
        return { ...tab, edges: resolvedEdges };
      }
      return tab;
    }));
  }, [activeTabId, setTabs]);

  const setViewport = useCallback((newViewport: { x: number; y: number; zoom: number } | ((prev: { x: number; y: number; zoom: number }) => { x: number; y: number; zoom: number })) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        const currentViewport = tab.viewport || { x: 0, y: 0, zoom: 1 };
        const resolvedViewport = typeof newViewport === 'function' ? newViewport(currentViewport) : newViewport;
        return { ...tab, viewport: resolvedViewport };
      }
      return tab;
    }));
  }, [activeTabId, setTabs]);

  // Symmetric selection exclusivity: deselect nodes/edges when canvas objects are selected
  useEffect(() => {
    if (selectedCanvasObjects.length > 0) {
      setNodes(prev => prev.map(n => ({ ...n, selected: false })));
      setEdges(prev => prev.map(e => ({ ...e, selected: false })));
      updateActiveTab({ selectedNodeId: '', selectedEdgeId: '' });
    }
  }, [selectedCanvasObjects.length, updateActiveTab]);

  // Helper function to calculate viewport-centered position with sequential offset
  const getViewportCenteredPosition = useCallback(() => {
    // Use common canvas dimensions (matching WorkflowCanvas)
    const canvasWidth = 800;
    const canvasHeight = 600;
    
    // Calculate viewport center in world coordinates
    const viewportCenterX = (-viewport.x + canvasWidth / 2) / viewport.zoom;
    const viewportCenterY = (-viewport.y + canvasHeight / 2) / viewport.zoom;
    
    // Count existing nodes and canvas objects for offset
    const existingCount = (nodes?.length || 0) + (canvasObjects?.length || 0);
    
    // Improved spiral pattern that extends beyond 9 items
    const offsetDistance = 50; // World space units (not affected by zoom)
    let offsetX = 0;
    let offsetY = 0;
    
    if (existingCount > 0) {
      // Create expanding spiral pattern
      const ringSize = 3; // 3x3 grid per ring
      const ring = Math.floor((existingCount - 1) / (ringSize * ringSize));
      const posInRing = (existingCount - 1) % (ringSize * ringSize);
      
      // Calculate position within the current ring
      const col = posInRing % ringSize;
      const row = Math.floor(posInRing / ringSize);
      
      // Apply ring multiplier and center the grid
      const ringMultiplier = ring + 1;
      offsetX = (col - Math.floor(ringSize / 2)) * offsetDistance * ringMultiplier;
      offsetY = (row - Math.floor(ringSize / 2)) * offsetDistance * ringMultiplier;
    }
    
    // Default node dimensions for centering (nodes are typically 200x100)
    const nodeWidth = 200;
    const nodeHeight = 100;
    
    // Center the node by subtracting half its dimensions
    const centeredX = viewportCenterX + offsetX - nodeWidth / 2;
    const centeredY = viewportCenterY + offsetY - nodeHeight / 2;
    
    return {
      x: Math.round(centeredX),
      y: Math.round(centeredY)
    };
  }, [viewport, nodes, canvasObjects]);

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
    updateActiveTab({ 
      name,
      metadata: { ...metadata, name }
    });
  }, [updateActiveTab, metadata]);

  const setWorkflowMetadata = useCallback((newMetadata: WorkflowMetadata) => {
    updateActiveTab({ 
      name: newMetadata.name,
      metadata: newMetadata 
    });
  }, [updateActiveTab]);

  // Tab operations
  const createNewTab = useCallback(() => {
    const newTab = createBlankTab();
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [createBlankTab]);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      // If we're closing the active tab, switch to the previous tab or first tab
      if (tabId === activeTabId) {
        if (newTabs.length > 0) {
          const closingIndex = prev.findIndex(tab => tab.id === tabId);
          const newActiveTab = newTabs[Math.max(0, closingIndex - 1)] || newTabs[0];
          setActiveTabId(newActiveTab.id);
        } else {
          // No tabs remaining, clear active tab ID
          setActiveTabId('');
        }
      }
      return newTabs;
    });
  }, [tabs.length, activeTabId]);

  const renameTab = useCallback((tabId: string, newName: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, name: newName } : tab
    ));
  }, []);

  // Blank canvas state handlers
  const handleCreateBlankFromCanvas = useCallback(() => {
    const newTab = createBlankTab();
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    
    // Toast notification for new workflow creation
    toast({
      title: "New Workflow Created",
      description: `Created blank workflow "${newTab.name}"`
    });
  }, [createBlankTab, toast]);

  const handleCreateWithTemplate = useCallback(() => {
    const newTab = createDefaultTab();
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    
    // Toast notification for template workflow creation
    toast({
      title: "Template Workflow Created",
      description: `Created workflow "${newTab.name}" with template`
    });
  }, [createDefaultTab, toast]);

  const handleCreateWithAI = useCallback(() => {
    // Create blank tab first, then open AI generator
    const newTab = createBlankTab();
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setShowAiGenerator(true);
    
    // Toast notification for new workflow creation
    toast({
      title: "New Workflow Created",
      description: `Created workflow "${newTab.name}" for AI generation`
    });
  }, [createBlankTab, toast]);

  const handleImportFromCanvas = useCallback(() => {
    // Create blank tab first, then trigger import
    const newTab = createBlankTab();
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    // Create hidden file input for importing
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
          if (data.nodes && data.edges) {
            const importedNodes = data.nodes;
            const importedEdges = data.edges;
            const importedViewport = data.viewport || { x: 0, y: 0, zoom: 1 };
            
            // Create new history state for the imported workflow
            const newHistoryState = {
              nodes: [...importedNodes],
              edges: [...importedEdges],
              canvasObjects: data.canvasObjects || [],
              viewport: { ...importedViewport }
            };
            
            // Directly update the specific tab that was just created
            setTabs(prev => prev.map(tab => 
              tab.id === newTab.id 
                ? {
                    ...tab,
                    nodes: importedNodes,
                    edges: importedEdges,
                    viewport: importedViewport,
                    history: [...tab.history, newHistoryState],
                    historyIndex: tab.history.length // New index after adding the state
                  }
                : tab
            ));
            
            toast({
              title: "Workflow Imported",
              description: `Successfully imported ${importedNodes.length} nodes and ${importedEdges.length} connections.`,
            });
          }
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
  }, [createBlankTab, toast]);

  // Handle template creation from canvas
  const handleCreateTemplateFromCanvas = useCallback((templateType: string) => {
    let templateData;
    const name = generateCuteName();

    // Generate appropriate template based on type
    switch (templateType) {
      case 'user-journey':
        templateData = generateUserJourneyTemplate();
        break;
      case 'mindmap':
        templateData = generateMindmapTemplate();
        break;
      case 'system-architecture':
        templateData = generateSystemArchitectureTemplate();
        break;
      case 'swim-lanes':
        templateData = generateSwimLanesTemplate();
        break;
      case 'user-account-creation':
        templateData = generateUserAccountTemplate();
        break;
      case 'io-logic':
        templateData = generateIOLogicTemplate();
        break;
      default:
        // Fallback to blank if template type is not recognized
        handleCreateBlankFromCanvas();
        return;
    }

    const initialState = {
      nodes: templateData.nodes,
      edges: templateData.edges,
      canvasObjects: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    
    const newTab: WorkflowTab = {
      id: generateTabId(),
      name,
      ...initialState,
      selectedNodeId: '',
      selectedEdgeId: '',
      history: [initialState],
      historyIndex: 0,
      showImageModal: null,
      metadata: {
        name,
        description: '',
        links: [],
        linksFormat: 'text',
        categories: []
      }
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [generateTabId, generateCuteName, generateUserJourneyTemplate, generateMindmapTemplate, generateSystemArchitectureTemplate, generateSwimLanesTemplate, generateUserAccountTemplate, generateIOLogicTemplate, handleCreateBlankFromCanvas]);


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
      
      // Apply minimum spacing between nodes
      const spacedNodes = enforceMinimumNodeSpacing(workflowData.nodes, 16);
      console.log('✨ APPLIED MINIMUM SPACING:', { 
        originalNodes: workflowData.nodes.length,
        spacedNodes: spacedNodes.length,
        hasPositionChanges: JSON.stringify(workflowData.nodes) !== JSON.stringify(spacedNodes)
      });
      
      return {
        ...workflowData,
        nodes: spacedNodes
      };
    } else {
      throw new Error('Invalid workflow structure returned');
    }
  }, [ai]);

  // Function to enforce minimum spacing between nodes
  const enforceMinimumNodeSpacing = useCallback((nodes: Node[], minGap: number = 16, existingNodes: Node[] = []): Node[] => {
    if (nodes.length === 0) return nodes;
    
    const adjustedNodes = [...nodes];
    const maxIterations = 10; // Prevent infinite loops
    const allNodes = [...existingNodes, ...adjustedNodes]; // Combined set for collision checking
    
    // Helper function to get actual node dimensions
    const getNodeDimensions = (node: Node) => ({
      width: node.width || 200, // Fallback to 200 if width not specified
      height: node.height || 100  // Fallback to 100 if height not specified
    });
    
    // Helper function to check if two nodes are too close
    const areNodesTooClose = (nodeA: Node, nodeB: Node) => {
      const dimA = getNodeDimensions(nodeA);
      const dimB = getNodeDimensions(nodeB);
      
      const aLeft = nodeA.position.x;
      const aRight = nodeA.position.x + dimA.width;
      const aTop = nodeA.position.y;
      const aBottom = nodeA.position.y + dimA.height;
      
      const bLeft = nodeB.position.x;
      const bRight = nodeB.position.x + dimB.width;
      const bTop = nodeB.position.y;
      const bBottom = nodeB.position.y + dimB.height;
      
      // Check if bounding boxes overlap or are too close
      const horizontalOverlap = !(aRight + minGap < bLeft || bRight + minGap < aLeft);
      const verticalOverlap = !(aBottom + minGap < bTop || bBottom + minGap < aTop);
      
      return horizontalOverlap && verticalOverlap;
    };
    
    // Iteratively resolve collisions until stable or max iterations reached
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      let hasCollisions = false;
      
      // Check all pairs for collisions
      for (let i = 0; i < adjustedNodes.length; i++) {
        const nodeA = adjustedNodes[i];
        const dimA = getNodeDimensions(nodeA);
        
        // Check against existing nodes (we can't move these)
        for (let k = 0; k < existingNodes.length; k++) {
          const existingNode = existingNodes[k];
          if (areNodesTooClose(nodeA, existingNode)) {
            hasCollisions = true;
            
            // Move the new node away from existing node
            const dimExisting = getNodeDimensions(existingNode);
            const centerAX = nodeA.position.x + dimA.width / 2;
            const centerAY = nodeA.position.y + dimA.height / 2;
            const centerExistingX = existingNode.position.x + dimExisting.width / 2;
            const centerExistingY = existingNode.position.y + dimExisting.height / 2;
            
            const deltaX = centerAX - centerExistingX;
            const deltaY = centerAY - centerExistingY;
            
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              // Adjust horizontally
              if (deltaX > 0) {
                // Move nodeA to the right
                adjustedNodes[i] = {
                  ...nodeA,
                  position: {
                    ...nodeA.position,
                    x: existingNode.position.x + dimExisting.width + minGap
                  }
                };
              } else {
                // Move nodeA to the left
                adjustedNodes[i] = {
                  ...nodeA,
                  position: {
                    ...nodeA.position,
                    x: existingNode.position.x - dimA.width - minGap
                  }
                };
              }
            } else {
              // Adjust vertically
              if (deltaY > 0) {
                // Move nodeA down
                adjustedNodes[i] = {
                  ...nodeA,
                  position: {
                    ...nodeA.position,
                    y: existingNode.position.y + dimExisting.height + minGap
                  }
                };
              } else {
                // Move nodeA up
                adjustedNodes[i] = {
                  ...nodeA,
                  position: {
                    ...nodeA.position,
                    y: existingNode.position.y - dimA.height - minGap
                  }
                };
              }
            }
          }
        }
        
        // Check against other new nodes
        for (let j = i + 1; j < adjustedNodes.length; j++) {
          const nodeB = adjustedNodes[j];
          if (areNodesTooClose(adjustedNodes[i], nodeB)) {
            hasCollisions = true;
            
            // Move the later node (nodeB) away from the earlier one
            const dimB = getNodeDimensions(nodeB);
            const centerAX = adjustedNodes[i].position.x + dimA.width / 2;
            const centerAY = adjustedNodes[i].position.y + dimA.height / 2;
            const centerBX = nodeB.position.x + dimB.width / 2;
            const centerBY = nodeB.position.y + dimB.height / 2;
            
            const deltaX = centerBX - centerAX;
            const deltaY = centerBY - centerAY;
            
            // Add small random jitter to prevent oscillation
            const jitter = (Math.random() - 0.5) * 4;
            
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              // Adjust horizontally
              if (deltaX > 0) {
                // Move nodeB to the right
                adjustedNodes[j] = {
                  ...nodeB,
                  position: {
                    ...nodeB.position,
                    x: adjustedNodes[i].position.x + dimA.width + minGap + jitter
                  }
                };
              } else {
                // Move nodeB to the left
                adjustedNodes[j] = {
                  ...nodeB,
                  position: {
                    ...nodeB.position,
                    x: adjustedNodes[i].position.x - dimB.width - minGap + jitter
                  }
                };
              }
            } else {
              // Adjust vertically
              if (deltaY > 0) {
                // Move nodeB down
                adjustedNodes[j] = {
                  ...nodeB,
                  position: {
                    ...nodeB.position,
                    y: adjustedNodes[i].position.y + dimA.height + minGap + jitter
                  }
                };
              } else {
                // Move nodeB up
                adjustedNodes[j] = {
                  ...nodeB,
                  position: {
                    ...nodeB.position,
                    y: adjustedNodes[i].position.y - dimB.height - minGap + jitter
                  }
                };
              }
            }
          }
        }
      }
      
      // If no collisions found, we're done
      if (!hasCollisions) {
        console.log(`✨ Node spacing resolved in ${iteration + 1} iterations`);
        break;
      }
      
      // Log progress for debugging
      if (iteration === maxIterations - 1) {
        console.warn(`⚠️ Node spacing hit max iterations (${maxIterations}), some overlaps may remain`);
      }
    }
    
    return adjustedNodes;
  }, []);

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
    const name = generateCuteName();
    const initialState = {
      nodes: data.nodes.map(node => ({ ...node, selected: false })),
      edges: data.edges.map(edge => ({ ...edge, selected: false })),
      canvasObjects: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    
    const newTab: WorkflowTab = {
      id: generateTabId(),
      name,
      ...initialState,
      selectedNodeId: '',
      selectedEdgeId: '',
      history: [initialState], // Initialize with current state
      historyIndex: 0, // Start at index 0, not -1
      showImageModal: null,
      metadata: {
        name,
        description: '',
        links: [],
        linksFormat: 'text',
        categories: []
      }
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [generateTabId, generateCuteName]);

  const handleCreateFromTemplate = useCallback((template: { name: string; nodes: Node[]; edges: Edge[] }) => {
    const initialState = {
      nodes: template.nodes.map(node => ({ ...node, selected: false })),
      edges: template.edges.map(edge => ({ ...edge, selected: false })),
      canvasObjects: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    };
    
    const newTab: WorkflowTab = {
      id: generateTabId(),
      name: template.name,
      ...initialState,
      selectedNodeId: '',
      selectedEdgeId: '',
      history: [initialState], // Initialize with current state
      historyIndex: 0, // Start at index 0, not -1
      showImageModal: null,
      metadata: {
        name: template.name,
        description: '',
        links: [],
        linksFormat: 'text',
        categories: []
      }
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [generateTabId, generateCuteName]);

  // History management with debouncing to prevent excessive saves
  const saveToHistoryTimeoutRef = useRef<NodeJS.Timeout>();
  const saveToHistory = useCallback(() => {
    if (!activeTab) return;
    
    // Clear any existing timeout to debounce the save operation
    if (saveToHistoryTimeoutRef.current) {
      clearTimeout(saveToHistoryTimeoutRef.current);
    }
    
    saveToHistoryTimeoutRef.current = setTimeout(() => {
      // Use current state variables instead of stale activeTab references
      const currentNodes = nodes;
      const currentEdges = edges;
      const currentCanvasObjects = canvasObjects;
      const currentViewport = viewport;
      
      const newHistoryState = {
        nodes: [...currentNodes],
        edges: [...currentEdges],
        canvasObjects: [...currentCanvasObjects],
        viewport: { ...currentViewport }
      };
      
      const currentHistory = activeTab.history;
      const currentHistoryIndex = activeTab.historyIndex;
      
      // Check if this state is actually different from the last saved state
      const lastState = currentHistory[currentHistoryIndex];
      if (lastState && 
          lastState.nodes.length === currentNodes.length &&
          lastState.edges.length === currentEdges.length &&
          lastState.canvasObjects.length === currentCanvasObjects.length) {
        // Skip saving if nothing substantial has changed
        return;
      }
      
      // Remove any future history states if we're in the middle of history
      const newHistory = [...currentHistory.slice(0, currentHistoryIndex + 1), newHistoryState];
      
      // Limit history size to prevent memory issues (keep last 20 states)
      const maxHistorySize = 20;
      const trimmedHistory = newHistory.length > maxHistorySize 
        ? newHistory.slice(-maxHistorySize) 
        : newHistory;
      const newHistoryIndex = trimmedHistory.length - 1;
      
      // Minimal logging to prevent local storage overflow
      console.log('💾 History saved:', {
        nodes: currentNodes.length,
        edges: currentEdges.length,
        objects: currentCanvasObjects.length,
        historySize: trimmedHistory.length
      });
      
      updateActiveTab({ 
        history: trimmedHistory,
        historyIndex: newHistoryIndex
      });
    }, 200); // Debounce for 200ms to prevent excessive calls
  }, [activeTab, updateActiveTab, nodes, edges, canvasObjects, viewport]);

  // Quick-add functionality
  const handleQuickAdd = useCallback((sourceNode: Node, position: 'top' | 'right' | 'bottom' | 'left') => {
    saveToHistory(); // Save current state before adding node
    
    const spacing = proFeaturesConfig.quickAdd?.defaultSpacing ?? 250;
    const nodeType = proFeaturesConfig.quickAdd?.defaultNodeType ?? 'process';
    const template = proFeaturesConfig.quickAdd?.defaultNodeTemplate ?? {};
    
    let newPosition = { x: 0, y: 0 };
    switch (position) {
      case 'top':
        newPosition = { x: sourceNode.position.x, y: sourceNode.position.y - spacing };
        break;
      case 'right':
        newPosition = { x: sourceNode.position.x + spacing, y: sourceNode.position.y };
        break;
      case 'bottom':
        newPosition = { x: sourceNode.position.x, y: sourceNode.position.y + spacing };
        break;
      case 'left':
        newPosition = { x: sourceNode.position.x - spacing, y: sourceNode.position.y };
        break;
    }

    const newNode: Node = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: nodeType,
      position: newPosition,
      data: {
        label: 'New Process',
        description: 'Configure process settings',
        icon: 'Cog',
        iconColor: 'text-gray-500',
        ...template
      },
      width: 200,
      height: 100
    };

    // Add the new node
    setNodes(prev => [...prev, newNode]);
    
    // Create connecting edge
    const newEdge: Edge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source: sourceNode.id,
      target: newNode.id,
      type: 'bezier',
      style: {
        strokeColor: '#3b82f6',
        strokeWidth: 2
      },
      markers: {
        type: 'arrow',
        position: 'end'
      },
      reconnectable: true,
      interactable: true
    };
    
    setEdges(prev => [...prev, newEdge]);
    
    // Call custom handler if provided
    if (proFeaturesConfig.quickAdd?.onQuickAdd) {
      proFeaturesConfig.quickAdd.onQuickAdd(sourceNode, position, newNode);
    }
  }, [proFeaturesConfig.quickAdd, saveToHistory]);

  // Handle edge reconnection from pro features
  const handleEdgeReconnect = useCallback((edgeId: string, newSource: string, newTarget: string) => {
    console.log('🔗 Edge reconnection:', { edgeId, newSource, newTarget });
    
    setEdges(prev => prev.map(edge => 
      edge.id === edgeId 
        ? { ...edge, source: newSource, target: newTarget, selected: false }
        : edge
    ));
    
    saveToHistory();
  }, [setEdges, saveToHistory]);

  // Helper function to calculate offset position for appending workflows
  const calculateWorkflowOffset = useCallback((newNodes: Node[]): { x: number; y: number } => {
    if (nodes.length === 0) {
      return { x: 0, y: 0 }; // No offset needed if canvas is empty
    }

    // Find the bottommost position of existing nodes
    let maxY = -Infinity;
    
    nodes.forEach(node => {
      const nodeBottom = node.position.y + (node.height || 100);
      if (nodeBottom > maxY) maxY = nodeBottom;
    });

    // Find the topmost position of new nodes
    let minNewY = Infinity;
    
    newNodes.forEach(node => {
      if (node.position.y < minNewY) minNewY = node.position.y;
    });

    // Calculate offset to place new workflow underneath with some spacing
    const verticalSpacing = 150;
    
    const offsetX = 0; // Keep horizontal alignment with existing workflow
    const offsetY = maxY + verticalSpacing - minNewY;

    return { x: offsetX, y: offsetY };
  }, [nodes]);

  // Handle template creation to current active tab
  const handleAddTemplateToCurrentTab = useCallback((templateType: string, anchorPosition?: { x: number; y: number }) => {
    let templateData;

    // Generate appropriate template based on type
    switch (templateType) {
      case 'user-journey':
        templateData = generateUserJourneyTemplate();
        break;
      case 'mindmap':
        templateData = generateMindmapTemplate();
        break;
      case 'system-architecture':
        templateData = generateSystemArchitectureTemplate();
        break;
      case 'swim-lanes':
        templateData = generateSwimLanesTemplate();
        break;
      case 'user-account-creation':
        templateData = generateUserAccountTemplate();
        break;
      case 'io-logic':
        templateData = generateIOLogicTemplate();
        break;
      default:
        console.warn('Unknown template type:', templateType);
        return;
    }

    let offset: { x: number; y: number };
    
    if (anchorPosition) {
      // When a specific position is provided (from drag-and-drop), place template there
      // Calculate the bounding box of the template
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      templateData.nodes.forEach(node => {
        if (node.position.x < minX) minX = node.position.x;
        if (node.position.y < minY) minY = node.position.y;
        const nodeRight = node.position.x + (node.width || 200);
        const nodeBottom = node.position.y + (node.height || 100);
        if (nodeRight > maxX) maxX = nodeRight;
        if (nodeBottom > maxY) maxY = nodeBottom;
      });
      
      // Calculate center of template bounding box
      const templateCenterX = (minX + maxX) / 2;
      const templateCenterY = (minY + maxY) / 2;
      
      // Offset to center template at the drop position
      offset = {
        x: anchorPosition.x - templateCenterX,
        y: anchorPosition.y - templateCenterY
      };
      
      console.log('✨ Template placement at position:', { 
        templateType, 
        anchorPosition,
        templateCenter: { x: templateCenterX, y: templateCenterY },
        offset 
      });
    } else {
      // Use the existing offset calculation for appending workflows
      offset = calculateWorkflowOffset(templateData.nodes);
    }
    
    const timestamp = Date.now();
    
    // Apply offset to new nodes and ensure unique IDs
    const offsetNodes = templateData.nodes.map(node => ({
      ...node,
      id: `${node.id}-${timestamp}`, // Ensure unique IDs
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y
      },
      selected: false,
      // Ensure proper width/height for handle alignment
      width: node.width || 200,
      height: node.height || 100,
      // Ensure handles are properly aligned
      draggable: true,
      selectable: true
    }));

    // Apply offset to new edges and update IDs
    const offsetEdges = templateData.edges.map(edge => ({
      ...edge,
      id: `${edge.id}-${timestamp}`, // Ensure unique IDs
      source: `${edge.source}-${timestamp}`,
      target: `${edge.target}-${timestamp}`,
      selected: false,
      reconnectable: true, // Enable reconnection for template edges
      interactable: true // Make edges clickable
    }));

    // Append to existing nodes and edges
    setNodes(prev => [...prev, ...offsetNodes]);
    setEdges(prev => [...prev, ...offsetEdges]);
    
    // Save to history for undo/redo
    saveToHistory();
    
    console.log(`✨ Template "${templateType}" added to current tab:`, {
      newNodes: offsetNodes.length,
      newEdges: offsetEdges.length,
      offset,
      anchorPosition
    });
    
    // Toast notification for template creation
    toast({
      title: "Template Added",
      description: `${templateType.replace(/([A-Z])/g, ' $1').trim()} template added to canvas`,
      variant: "default"
    });
  }, [generateUserJourneyTemplate, generateMindmapTemplate, generateSystemArchitectureTemplate, generateSwimLanesTemplate, generateUserAccountTemplate, generateIOLogicTemplate, calculateWorkflowOffset, setNodes, setEdges, saveToHistory]);

  // Function to append AI-generated workflow to existing canvas
  const appendAiWorkflowToCanvas = useCallback(async (prompt: string) => {
    try {
      // Generate workflow using AI
      const generatedWorkflow = await generateWorkflowFromPrompt(prompt);
      
      // Apply minimum spacing between nodes in the generated workflow AND relative to existing nodes
      const spacedWorkflow = {
        ...generatedWorkflow,
        nodes: enforceMinimumNodeSpacing(generatedWorkflow.nodes, 16, nodes)
      };
      
      // Calculate offset for new nodes
      const offset = calculateWorkflowOffset(spacedWorkflow.nodes);
      
      // Apply offset to new nodes
      const offsetNodes = spacedWorkflow.nodes.map(node => ({
        ...node,
        id: `${node.id}-${Date.now()}`, // Ensure unique IDs
        position: {
          x: node.position.x + offset.x,
          y: node.position.y + offset.y
        },
        selected: false
      }));

      // Apply offset to new edges and update IDs
      const offsetEdges = spacedWorkflow.edges.map(edge => ({
        ...edge,
        id: `${edge.id}-${Date.now()}`, // Ensure unique IDs
        source: `${edge.source}-${Date.now()}`,
        target: `${edge.target}-${Date.now()}`,
        selected: false,
        reconnectable: true, // Enable reconnection for AI-generated edges
        interactable: true // Make edges clickable
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
  const appendImportedWorkflowToCanvas = useCallback((importedData: any) => {
    try {
      let nodes: Node[] = [];
      let edges: Edge[] = [];
      let canvasObjectsToImport: CanvasObject[] = [];
      
      // Handle comprehensive format
      if (importedData.version && importedData.canvas) {
        const { canvas } = importedData;
        nodes = canvas.nodes || [];
        edges = canvas.edges || [];
        canvasObjectsToImport = canvas.canvasObjects || [];
        
        toast({
          title: "Importing Comprehensive Workflow",
          description: `Importing "${importedData.workflow?.name || 'workflow'}" with all content and styling`,
        });
      } else {
        // Legacy format fallback
        nodes = importedData.nodes || [];
        edges = importedData.edges || [];
        canvasObjectsToImport = importedData.canvasObjects || [];
        
        toast({
          title: "Importing Legacy Workflow",
          description: "Importing workflow with legacy format",
        });
      }

      if (!nodes.length && !edges.length && !canvasObjectsToImport.length) {
        toast({
          title: "Import Failed",
          description: "No valid content found in the workflow file.",
          variant: "destructive"
        });
        return;
      }

      // Calculate offset for new content
      const offset = calculateWorkflowOffset(nodes);
      
      // Apply offset to imported nodes with unique IDs
      const offsetNodes = nodes.map(node => ({
        ...node,
        id: `${node.id}-imported-${Date.now()}`, // Ensure unique IDs
        position: {
          x: node.position.x + offset.x,
          y: node.position.y + offset.y
        },
        selected: false,
        // Preserve all styling and data
        data: { ...node.data },
        style: node.style || {}
      }));

      // Apply offset to imported edges and update IDs
      const offsetEdges = edges.map(edge => ({
        ...edge,
        id: `${edge.id}-imported-${Date.now()}`, // Ensure unique IDs
        source: `${edge.source}-imported-${Date.now()}`,
        target: `${edge.target}-imported-${Date.now()}`,
        selected: false,
        // Preserve all styling and data
        style: edge.style || {},
        data: edge.data || {}
      }));

      // Apply offset to imported canvas objects
      const offsetCanvasObjects = canvasObjectsToImport.map(obj => ({
        ...obj,
        id: `${obj.id}-imported-${Date.now()}`,
        position: {
          x: obj.position.x + offset.x,
          y: obj.position.y + offset.y
        },
        selected: false,
        // Preserve all styling and data
        data: { ...obj.data },
        style: obj.style || {}
      }));

      // Append to existing content
      setNodes(prev => [...prev, ...offsetNodes]);
      setEdges(prev => [...prev, ...offsetEdges]);
      
      if (offsetCanvasObjects.length > 0) {
        updateActiveTab({
          canvasObjects: [...canvasObjects, ...offsetCanvasObjects]
        });
      }
      
      // Save to history after state updates
      setTimeout(() => saveToHistory(), 0);
      
      toast({
        title: "Workflow Imported Successfully",
        description: `Added ${offsetNodes.length} nodes, ${offsetEdges.length} connections, and ${offsetCanvasObjects.length} canvas objects.`,
        variant: "default"
      });
      
    } catch (error) {
      console.error('Import failed:', error);
      toast({
        title: "Import Failed",
        description: "An error occurred while importing the workflow. Please check the file format.",
        variant: "destructive"
      });
    }
  }, [calculateWorkflowOffset, saveToHistory, toast]);

  const handleUndo = useCallback(() => {
    const canUndo = historyIndex > 0 && history.length > 1;
    
    console.log('🔄 UNDO BUTTON CLICKED (FIXED):', {
      canUndo,
      currentHistoryIndex: historyIndex,
      totalHistoryStates: history.length,
      tabId: activeTab?.id,
      currentState: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        nodeIds: nodes.map(n => n.id),
        edgeIds: edges.map(e => e.id)
      }
    });

    if (canUndo && history[historyIndex - 1]) {
      const newIndex = historyIndex - 1;
      const targetState = history[newIndex];
      
      console.log('⏪ UNDO ACTION PERFORMED (FIXED):', {
        from: {
          index: historyIndex,
          nodeCount: nodes.length,
          edgeCount: edges.length,
          nodeIds: nodes.map(n => n.id),
          edgeIds: edges.map(e => e.id)
        },
        to: {
          index: newIndex,
          nodeCount: targetState.nodes.length,
          edgeCount: targetState.edges.length,
          nodeIds: targetState.nodes.map(n => n.id),
          edgeIds: targetState.edges.map(e => e.id)
        },
        direction: 'BACKWARD (going to earlier state)',
        historyStack: history.map((state, index) => ({
          index,
          nodeCount: state.nodes.length,
          edgeCount: state.edges.length,
          isActive: index === newIndex
        }))
      });

      updateActiveTab({
        nodes: [...targetState.nodes],
        edges: [...targetState.edges],
        canvasObjects: [...(targetState.canvasObjects || [])],
        viewport: { ...targetState.viewport },
        historyIndex: newIndex
      });
    } else {
      console.log('⏪ UNDO NOT POSSIBLE: Already at oldest state or invalid history');
    }
  }, [historyIndex, history, updateActiveTab, nodes, edges, activeTab]);

  const handleRedo = useCallback(() => {
    const canRedo = historyIndex < history.length - 1 && history.length > 1;
    
    console.log('🔄 REDO BUTTON CLICKED (FIXED):', {
      canRedo,
      currentHistoryIndex: historyIndex,
      totalHistoryStates: history.length,
      tabId: activeTab?.id,
      currentState: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        nodeIds: nodes.map(n => n.id),
        edgeIds: edges.map(e => e.id)
      }
    });

    if (canRedo && history[historyIndex + 1]) {
      const newIndex = historyIndex + 1;
      const targetState = history[newIndex];
      
      console.log('⏩ REDO ACTION PERFORMED (FIXED):', {
        from: {
          index: historyIndex,
          nodeCount: nodes.length,
          edgeCount: edges.length,
          nodeIds: nodes.map(n => n.id),
          edgeIds: edges.map(e => e.id)
        },
        to: {
          index: newIndex,
          nodeCount: targetState.nodes.length,
          edgeCount: targetState.edges.length,
          nodeIds: targetState.nodes.map(n => n.id),
          edgeIds: targetState.edges.map(e => e.id)
        },
        direction: 'FORWARD (going to later state)',
        historyStack: history.map((state, index) => ({
          index,
          nodeCount: state.nodes.length,
          edgeCount: state.edges.length,
          isActive: index === newIndex
        }))
      });

      updateActiveTab({
        nodes: [...targetState.nodes],
        edges: [...targetState.edges],
        canvasObjects: [...(targetState.canvasObjects || [])],
        viewport: { ...targetState.viewport },
        historyIndex: newIndex
      });
    } else {
      console.log('⏩ REDO NOT POSSIBLE: Already at newest state or invalid history');
    }
  }, [historyIndex, history, updateActiveTab, nodes, edges, activeTab]);

  // Snapshot and Version History handlers
  const handleSnapshot = useCallback(() => {
    // Access version control plugin through global registry
    const versionPlugin = (window as any).kiteframeVersionControlPlugin;
    if (versionPlugin) {
      versionPlugin.handleSnapshot();
    } else {
      console.log('📸 Snapshot feature not available - requires Pro plugin');
      toast({
        title: "Snapshot Created",
        description: "Workflow state saved successfully.",
        variant: "default"
      });
    }
  }, [toast]);

  const handleVersionHistory = useCallback(() => {
    // Access version control plugin through global registry  
    const versionPlugin = (window as any).kiteframeVersionControlPlugin;
    if (versionPlugin) {
      versionPlugin.handleVersionHistory();
    } else {
      console.log('📚 Version History feature not available - requires Pro plugin');
      toast({
        title: "Version History",
        description: "Access version history and snapshots.",
        variant: "default"
      });
    }
  }, [toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete key handler
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Check if we're not in an input field
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
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

  // Listen for edge drag events to cancel click timers
  useEffect(() => {
    const handleEdgeDragStart = () => {
      console.log('📝 EDGE DRAG START - canceling any pending click timers');
      isDraggingRef.current = true;
      if (clickDelayTimeoutRef.current) {
        clearTimeout(clickDelayTimeoutRef.current);
        clickDelayTimeoutRef.current = null;
      }
    };

    const handleEdgeDragEnd = () => {
      console.log('📝 EDGE DRAG END - ready for next click');
      // Reset drag state after a short delay
      if (dragResetTimeoutRef.current) {
        clearTimeout(dragResetTimeoutRef.current);
      }
      dragResetTimeoutRef.current = setTimeout(() => {
        isDraggingRef.current = false;
      }, 100);
    };

    const handleCanvasObjectDragStart = () => {
      console.log('📝 CANVAS OBJECT DRAG START - canceling any pending click timers');
      isDraggingRef.current = true;
      if (clickDelayTimeoutRef.current) {
        clearTimeout(clickDelayTimeoutRef.current);
        clickDelayTimeoutRef.current = null;
      }
    };

    const handleCanvasObjectDragEnd = () => {
      console.log('📝 CANVAS OBJECT DRAG END - ready for next click');
      // Reset drag state after a short delay
      if (dragResetTimeoutRef.current) {
        clearTimeout(dragResetTimeoutRef.current);
      }
      dragResetTimeoutRef.current = setTimeout(() => {
        isDraggingRef.current = false;
      }, 100);
    };

    window.addEventListener('edgeHandleDragStart', handleEdgeDragStart);
    window.addEventListener('edgeHandleDragEnd', handleEdgeDragEnd);
    window.addEventListener('canvasObjectDragStart', handleCanvasObjectDragStart);
    window.addEventListener('canvasObjectDragEnd', handleCanvasObjectDragEnd);

    return () => {
      window.removeEventListener('edgeHandleDragStart', handleEdgeDragStart);
      window.removeEventListener('edgeHandleDragEnd', handleEdgeDragEnd);
      window.removeEventListener('canvasObjectDragStart', handleCanvasObjectDragStart);
      window.removeEventListener('canvasObjectDragEnd', handleCanvasObjectDragEnd);
    };
  }, []);

  // Cleanup timers on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (clickDelayTimeoutRef.current) {
        clearTimeout(clickDelayTimeoutRef.current);
      }
      if (dragResetTimeoutRef.current) {
        clearTimeout(dragResetTimeoutRef.current);
      }
    };
  }, []);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Get access to KiteFrame core system
  const { core } = usePluginSystem();
  
  // Register required plugins in useEffect to avoid registration during render
  useEffect(() => {
    if (core) {
      if (!core.getPlugin?.('layout')) {
        core.use(layoutPlugin);
      }
      if (!core.getPlugin?.('console-demo')) {
        core.use(consolePlugin);
      }
      if (!core.getPlugin?.('test-demo')) {
        core.use(testPlugin);
      }
      if (!core.getPlugin?.('advanced-interactions-pro')) {
        core.use(advancedInteractionsPlugin);
      }
    }
  }, [core]);

  // Connect plugin system to workflow editor state
  useEffect(() => {
    if (core && tabs && activeTabId) {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      if (activeTab) {
        core.updateContext({
          getNodes: () => activeTab.nodes,
          getEdges: () => activeTab.edges,
          updateNodes: (newNodes) => {
            updateActiveTab({
              nodes: newNodes
            });
          },
          updateEdges: (newEdges) => {
            updateActiveTab({
              edges: newEdges
            });
          },
          getViewport: () => activeTab.viewport,
          setViewport: (viewport) => {
            updateActiveTab({
              viewport
            });
          },
          getSelectedNodes: () => activeTab.selectedNodeId ? [activeTab.selectedNodeId] : [],
          setSelectedNodes: (nodeIds) => {
            updateActiveTab({
              selectedNodeId: nodeIds[0] || ''
            });
          }
        });
      }
    }
  }, [core, tabs, activeTabId, updateActiveTab]);

  // Auto Layout Handler - delegates to LayoutPlugin via KiteFrame  
  // Accepts string events or objects with eventId and spacing for distribute operations
  const handleAutoLayout = useCallback((eventData: string | { eventId: string; spacing: number }) => {
    if (nodes.length === 0) return;
    
    saveToHistory();
    
    let eventName: string;
    let payload: any = undefined;
    
    if (typeof eventData === 'string') {
      // Handle string events (align, layout operations)
      eventName = /^(align:|distribute:|layout:)/.test(eventData) ? eventData : `layout:${eventData}`;
    } else {
      // Handle object with spacing payload (distribute operations)
      eventName = eventData.eventId;
      payload = { spacing: eventData.spacing };
    }
    
    if (core) {
      try {
        // Emit event to the LayoutPlugin with optional payload
        core.emit(eventName, payload);
        const logMessage = payload 
          ? `🔧 AUTO LAYOUT EVENT EMITTED: ${eventName} with spacing: ${payload.spacing}px`
          : `🔧 AUTO LAYOUT EVENT EMITTED: ${eventName}`;
        console.log(logMessage, { nodeCount: nodes.length });
      } catch (error) {
        console.error(`❌ Failed to emit layout event: ${eventName}`, error);
      }
    } else {
      console.warn(`⚠️ KiteFrame core not available for layout: ${typeof eventData === 'string' ? eventData : eventData.eventId}`);
    }
  }, [nodes, saveToHistory, core]);


  // Other UI state
  const [showAiModal, setShowAiModal] = useState(false);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBugReportModal, setShowBugReportModal] = useState(false);
  const [showNewTabModal, setShowNewTabModal] = useState(false);
  const [showPluginTest, setShowPluginTest] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node?: Node; canvasObject?: CanvasObject } | null>(null);
  const [isEditingWorkflowName, setIsEditingWorkflowName] = useState(false);
  const [workflowNameInput, setWorkflowNameInput] = useState('');
  const [copiedProperties, setCopiedProperties] = useState<{ colors?: any; data?: Partial<Node['data']> } | null>(null);
  const [copiedCanvasObjectProperties, setCopiedCanvasObjectProperties] = useState<{ data?: any; style?: any } | null>(null);

  // Click vs drag detection for properties panel
  const clickDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const dragResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Theme change detection refs
  const activeTabRef = useRef<WorkflowTab | undefined>(undefined);
  const lastThemeIsDarkRef = useRef(document.documentElement.classList.contains('dark'));
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep refs in sync with current state
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sidebar-collapsed');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Popout state for collapsed sidebar
  const [activePopout, setActivePopout] = useState<'node-types' | 'shapes' | 'templates' | 'themes' | null>(null);

  // Current workflow theme state
  const [currentTheme, setCurrentTheme] = useState<WorkflowTheme>(() => {
    try {
      const savedThemeId = localStorage.getItem('workflow-theme') || 'default';
      return getThemeById(savedThemeId) || workflowThemes[0];
    } catch {
      return workflowThemes[0]; // Default theme
    }
  });

  // Image upload modal state
  const [selectedImageNodeId, setSelectedImageNodeId] = useState<string | null>(null);
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);

  // Save sidebar collapse state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Watch for openImageModal flag in node data
  useEffect(() => {
    const nodeWithModalFlag = nodes.find(n => n.data?.openImageModal);
    if (nodeWithModalFlag) {
      setSelectedImageNodeId(nodeWithModalFlag.id);
      setShowImageUploadModal(true);
      // Clear the flag
      setNodes(prev => prev.map(n => 
        n.id === nodeWithModalFlag.id 
          ? { ...n, data: { ...n.data, openImageModal: undefined } }
          : n
      ));
    }
  }, [nodes, setNodes]);

  // Icon mapping for collapsed sidebar
  const sidebarIcons = useMemo(() => ({
    'brain': Brain,
    'workflow': Workflow, 
    'type': Type,
    'shapes': Shapes,
    'sticky-note': StickyNote,
    'route': Route,
    'palette': Palette,
    'map-pin': MapPin,
    'network': Network,
    'layers': Layers,
    'user-plus': UserPlus,
    'circuit-board': CircuitBoard,
    'fit-view': Maximize2,
    'clear': Trash2,
    'export': Download,
    'import': Upload,
    'chevron-right': ChevronRight
  }), []);

  // Collapse/expand sidebar toggle
  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
    setActivePopout(null); // Close any open popouts when toggling
  }, []);

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


  // Reset form editing state when switching tabs
  useEffect(() => {
    setIsEditingWorkflowName(false);
    setWorkflowNameInput('');
  }, [activeTabId]);

  // Auto-register demo plugins when component mounts
  useEffect(() => {
    const registerPlugins = async () => {
      try {
        const { kiteFrameCore, consolePlugin, testPlugin, advancedInteractionsPlugin, versionControlPlugin, smartConnectPlugin } = await import('@/lib/kiteframe');
        kiteFrameCore.use(consolePlugin);
        kiteFrameCore.use(testPlugin);
        kiteFrameCore.use(advancedInteractionsPlugin);
        kiteFrameCore.use(versionControlPlugin);
        // Re-enabled SmartConnect plugin for auto-connect functionality
        kiteFrameCore.use(smartConnectPlugin);
        
        // Configure SmartConnect plugin with auto-connect
        smartConnectPlugin.configure(
          {
            enabled: true,
            autoConnect: true,
            threshold: 25, // Slightly increased to reduce performance impact
            showPreview: true
          },
          nodes,
          edges,
          // onConnect callback - creates new edges when auto-connect is triggered
          (connection) => {
            const newEdge = {
              id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              source: connection.source,
              target: connection.target,
              type: 'bezier' as const,
              animated: false,
              strokeWidth: 2,
              color: '#94a3b8'
            };
            
            const updatedEdges = [...edges, newEdge];
            updateActiveTab({ edges: updatedEdges });
            
            console.log('🚀 SmartConnect: Auto-connection created!', connection);
          },
          // onEdgesChange callback
          (updatedEdges) => {
            updateActiveTab({ edges: updatedEdges });
          },
          // connectionPreviewCallback - handles ghost preview during drag
          (preview) => {
            setConnectionPreview(preview);
            console.log('🔗 SmartConnect: Preview updated:', preview);
          }
        );
        
        console.log('✅ Demo + Pro plugins registered successfully');
        console.log('🔌 Plugin System Ready! Check Settings → Test Plugins or watch console for activity');
        console.log('🚀 Advanced Interactions Pro: Quick-add handles enabled on node hover!');
        console.log('🔗 SmartConnect Pro: Auto-connect enabled! Drag nodes close together to auto-connect.');
      } catch (error) {
        console.error('❌ Plugin registration error:', error);
        console.log('ℹ️ Some plugins may not have loaded correctly');
      }
    };
    registerPlugins();
  }, []);

  // Reconfigure SmartConnect plugin when nodes/edges change
  // This ensures the plugin has access to current nodes and edges for proximity detection
  useEffect(() => {
    const reconfigureSmartConnect = async () => {
      try {
        const { smartConnectPlugin } = await import('@/lib/kiteframe');
        
        // Configure SmartConnect plugin with current nodes and edges
        smartConnectPlugin.configure(
          proFeaturesConfig.smartConnect || {
            enabled: true,
            autoConnect: true,
            threshold: 50,
            showPreview: true
          },
          nodes,
          edges,
          // onConnect callback - creates new edges when auto-connect is triggered
          (connection) => {
            const newEdge = {
              id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              source: connection.source,
              target: connection.target,
              type: 'bezier' as const,
              animated: false,
              strokeWidth: 2,
              color: '#94a3b8'
            };
            
            setEdges(prev => [...prev, newEdge]);
            saveToHistory();
            
            console.log('🚀 SmartConnect: Auto-connection created!', connection);
          },
          // onEdgesChange callback
          (updatedEdges) => {
            setEdges(updatedEdges);
          },
          // connectionPreviewCallback - handles ghost preview during drag
          (preview) => {
            setConnectionPreview(preview);
            console.log('🔗 SmartConnect: Preview updated:', preview);
          }
        );
      } catch (error) {
        console.error('❌ SmartConnect reconfiguration error:', error);
      }
    };
    
    // Only reconfigure if we have nodes (avoid configuring on empty initial state)
    if (nodes.length > 0) {
      reconfigureSmartConnect();
    }
  }, [nodes, edges, proFeaturesConfig.smartConnect, saveToHistory]);

  // Handle keyboard shortcut for workflow name editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setWorkflowNameInput(activeTab?.name || '');
        setIsEditingWorkflowName(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab?.name]);

  // Handle quick-add node events from Advanced Interactions plugin
  useEffect(() => {
    const handleQuickAddNode = (event: CustomEvent) => {
      const { sourceNodeId, position, direction } = event.detail;
      console.log('🚀 Handling quick-add node:', { sourceNodeId, position, direction });

      // Find the source node to calculate new position
      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      if (!sourceNode) return;

      // Calculate new node position based on direction
      const spacing = 250;
      let newPosition = { x: 0, y: 0 };
      
      switch (direction) {
        case 'top':
          newPosition = { x: sourceNode.position.x, y: sourceNode.position.y - spacing };
          break;
        case 'right':
          newPosition = { x: sourceNode.position.x + spacing, y: sourceNode.position.y };
          break;
        case 'bottom':
          newPosition = { x: sourceNode.position.x, y: sourceNode.position.y + spacing };
          break;
        case 'left':
          newPosition = { x: sourceNode.position.x - spacing, y: sourceNode.position.y };
          break;
      }

      // Create new node
      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: 'process',
        position: newPosition,
        data: {
          label: 'New Process',
          description: 'Configure process settings',
          icon: 'Cog',
          iconColor: 'text-gray-500'
        },
        width: 200,
        height: 100
      };

      // Add the new node
      setNodes(prev => [...prev, newNode]);

      // Create edge from source to new node
      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        source: sourceNodeId,
        target: newNode.id,
        type: 'bezier' as const,
        animated: false,
        style: { strokeColor: '#3b82f6', strokeWidth: 2 },
        markers: { type: 'arrow' as const, position: 'end' as const }
      };

      setEdges(prev => [...prev, newEdge]);
      
      // Save to history
      saveToHistory();
    };

    // Listen for quick-add events
    window.addEventListener('kiteframe:quick-add-node', handleQuickAddNode as EventListener);
    
    return () => {
      window.removeEventListener('kiteframe:quick-add-node', handleQuickAddNode as EventListener);
    };
  }, [nodes, setNodes, setEdges, saveToHistory]);

  // Local storage persistence for workflows
  const saveToLocalStorage = useCallback((tabsToSave: WorkflowTab[]) => {
    try {
      localStorage.setItem('kiteframe_workflows', JSON.stringify(tabsToSave));
      console.log('💾 Workflows saved to local storage');
    } catch (error) {
      console.error('❌ Failed to save workflows to local storage:', error);
    }
  }, []);

  const loadFromLocalStorage = useCallback((): WorkflowTab[] => {
    try {
      const saved = localStorage.getItem('kiteframe_workflows');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('📂 Workflows loaded from local storage:', parsed.length);
        return parsed;
      }
    } catch (error) {
      console.error('❌ Failed to load workflows from local storage:', error);
    }
    return [];
  }, []);

  // Auto-save to local storage when tabs change
  useEffect(() => {
    if (tabs.length > 0) {
      const timer = setTimeout(() => {
        saveToLocalStorage(tabs);
      }, 1000); // Debounce saves by 1 second
      
      return () => clearTimeout(timer);
    }
  }, [tabs, saveToLocalStorage]);

  // Load workflows from local storage on mount
  useEffect(() => {
    const savedTabs = loadFromLocalStorage();
    if (savedTabs.length > 0) {
      setTabs(savedTabs);
      setActiveTabId(savedTabs[0].id);
      console.log('🔄 Restored workflows from local storage');
    }
  }, [loadFromLocalStorage]);

  return (
    <div className="h-screen flex flex-col bg-background">
        {/* Header */}
        <Toolbar
          onOpenAiSettings={() => setShowAiModal(true)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          editorSettings={editorSettings}
          onEditorSettingsChange={setEditorSettings}
          onOpenBugReport={() => setShowBugReportModal(true)}
        />
        
        {/* Tab Bar */}
        <div className="flex items-center bg-card border-b border-border px-4 py-2">
          <div className="flex items-center space-x-1 flex-1 overflow-x-auto min-w-0">
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
                {isEditingWorkflowName && tab.id === activeTabId ? (
                  <input
                    type="text"
                    value={workflowNameInput}
                    onChange={(e) => setWorkflowNameInput(e.target.value)}
                    onBlur={() => {
                      if (workflowNameInput.trim()) {
                        updateActiveTab({ name: workflowNameInput.trim() });
                      }
                      setIsEditingWorkflowName(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (workflowNameInput.trim()) {
                          updateActiveTab({ name: workflowNameInput.trim() });
                        }
                        setIsEditingWorkflowName(false);
                      } else if (e.key === 'Escape') {
                        setIsEditingWorkflowName(false);
                        setWorkflowNameInput(tab.name);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border-none outline-none text-sm font-medium text-inherit px-0 py-0 w-full max-w-32"
                    autoFocus
                    data-testid="input-workflow-name"
                  />
                ) : (
                  <span 
                    className="truncate text-sm font-medium max-w-32"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setWorkflowNameInput(tab.name);
                      setIsEditingWorkflowName(true);
                    }}
                    data-testid="text-workflow-name"
                    title="Double-click to rename"
                  >
                    {tab.name}
                  </span>
                )}
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
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className={`${isSidebarCollapsed ? 'w-12' : 'w-64'} border-r border-border flex flex-col transition-all duration-200 ${isSidebarCollapsed ? 'overflow-visible' : 'overflow-hidden'}`}>
            {isSidebarCollapsed ? (
              <>
                <CollapsedSidebar
                  toggleSidebar={toggleSidebar}
                  onCreateNode={(type: string) => {
                    // Handle creating canvas objects for text/sticky/shape types
                    if (['text', 'sticky', 'shape'].includes(type)) {
                      saveToHistory();
                      
                      let newCanvasObject: CanvasObject;
                      
                      if (type === 'text') {
                        newCanvasObject = {
                          id: `object-${Date.now()}`,
                          type: 'text',
                          position: getViewportCenteredPosition(),
                          data: { text: 'Click to edit text', fontSize: 16, fontFamily: 'Inter, system-ui, sans-serif', textColor: '#000000' } as any,
                          width: 200,
                          height: 50,
                          selected: false
                        };
                      } else if (type === 'sticky') {
                        newCanvasObject = {
                          id: `object-${Date.now()}`,
                          type: 'sticky',
                          position: getViewportCenteredPosition(),
                          data: { text: 'Sticky note...', backgroundColor: '#fef3c7', textColor: '#92400e' } as any,
                          width: 200,
                          height: 150,
                          selected: false
                        };
                      } else { // shape
                        newCanvasObject = {
                          id: `object-${Date.now()}`,
                          type: 'shape',
                          position: getViewportCenteredPosition(),
                          data: { shapeType: 'rectangle', fillColor: '#3b82f6', strokeColor: '#1e40af', strokeWidth: 2 } as any,
                          width: 150,
                          height: 100,
                          selected: false
                        };
                      }
                      
                      updateActiveTab({ 
                        canvasObjects: [...canvasObjects, newCanvasObject] 
                      });
                    }
                  }}
                  onCreateNodeAtPosition={(type: string, position: { x: number; y: number }) => {
                    // Handle position-based creation from drag-and-drop
                    if (['text', 'sticky', 'shape'].includes(type)) {
                      saveToHistory();
                      
                      let newCanvasObject: CanvasObject;
                      
                      if (type === 'text') {
                        newCanvasObject = {
                          id: `object-${Date.now()}`,
                          type: 'text',
                          position,
                          data: { text: 'Click to edit text', fontSize: 16, fontFamily: 'Inter, system-ui, sans-serif', textColor: '#000000' } as any,
                          width: 200,
                          height: 50,
                          selected: false
                        };
                      } else if (type === 'sticky') {
                        newCanvasObject = {
                          id: `object-${Date.now()}`,
                          type: 'sticky',
                          position,
                          data: { text: 'Sticky note...', backgroundColor: '#fef3c7', textColor: '#92400e' } as any,
                          width: 200,
                          height: 150,
                          selected: false
                        };
                      } else { // shape
                        newCanvasObject = {
                          id: `object-${Date.now()}`,
                          type: 'shape',
                          position,
                          data: { shapeType: 'rectangle', fillColor: '#3b82f6', strokeColor: '#1e40af', strokeWidth: 2 } as any,
                          width: 150,
                          height: 100,
                          selected: false
                        };
                      }
                      
                      updateActiveTab({ 
                        canvasObjects: [...canvasObjects, newCanvasObject] 
                      });
                    }
                  }}
                  onFitView={() => {
                    if (nodes.length === 0) {
                      setViewport({ x: 0, y: 0, zoom: 1 });
                      return;
                    }
                    // Implement fit view logic here or use existing implementation
                    console.log('🔧 FIT VIEW TRIGGERED from collapsed sidebar');
                  }}
                  onClearCanvas={() => {
                    if (window.confirm('Are you sure you want to clear the canvas? This will remove all nodes and edges.')) {
                      setNodes([]);
                      setEdges([]);
                      updateActiveTab({ canvasObjects: [] });
                      saveToHistory();
                    }
                  }}
                  onExport={() => {
                    const comprehensiveWorkflow = {
                      version: "1.0",
                      timestamp: new Date().toISOString(),
                      workflow: {
                        id: activeTab?.id || `workflow-${Date.now()}`,
                        name: activeTab?.name || 'My Workflow',
                        description: activeTab?.metadata?.description || '',
                        links: activeTab?.metadata?.links || [],
                        categories: activeTab?.metadata?.categories || []
                      },
                      canvas: {
                        nodes: nodes.map(node => ({
                          ...node,
                          // Preserve all styling and data
                          data: { ...node.data },
                          style: node.style || {}
                        })),
                        edges: edges.map(edge => ({
                          ...edge,
                          // Preserve all styling and data
                          style: edge.style || {},
                          data: edge.data || {}
                        })),
                        canvasObjects: canvasObjects.map(obj => ({
                          ...obj,
                          // Preserve all styling and data
                          data: { ...obj.data },
                          style: obj.style || {}
                        })),
                        viewport: { ...viewport }
                      }
                    };
                    
                    const dataStr = JSON.stringify(comprehensiveWorkflow, null, 2);
                    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                    const safeFileName = comprehensiveWorkflow.workflow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    const exportFileDefaultName = `${safeFileName}_complete_workflow.json`;
                    
                    const linkElement = document.createElement('a');
                    linkElement.setAttribute('href', dataUri);
                    linkElement.setAttribute('download', exportFileDefaultName);
                    linkElement.click();
                    
                    toast({
                      title: "Workflow Exported",
                      description: `"${comprehensiveWorkflow.workflow.name}" exported with all content and styling`,
                    });
                  }}
                  onImport={() => setShowImportModal(true)}
                  onOpenAiGenerator={() => setShowAiGenerator(true)}
                  onCreateTemplate={(templateType: string) => {
                    // Create a new tab if none exist
                    if (tabs.length === 0) {
                      const newTab = createBlankTab();
                      setTabs([newTab]);
                      setActiveTabId(newTab.id);
                      // Wait for the tab to be created before adding the template
                      setTimeout(() => {
                        handleAddTemplateToCurrentTab(templateType);
                      }, 50);
                      return;
                    }
                    
                    // Template generation at center (same logic as expanded sidebar)
                    console.log('🎯 CREATING TEMPLATE FROM COLLAPSED SIDEBAR:', { templateType, position: 'center' });
                    handleAddTemplateToCurrentTab(templateType);
                  }}
                  onCreateTemplateAtPosition={(templateType: string, position: { x: number; y: number }) => {
                    // Create a new tab if none exist
                    if (tabs.length === 0) {
                      const newTab = createBlankTab();
                      setTabs([newTab]);
                      setActiveTabId(newTab.id);
                      // Wait for the tab to be created before adding the template
                      setTimeout(() => {
                        handleAddTemplateToCurrentTab(templateType, position);
                      }, 50);
                      return;
                    }
                    
                    // Template generation at specific position from drag-and-drop
                    console.log('🎯 CREATING TEMPLATE AT POSITION FROM COLLAPSED SIDEBAR:', { templateType, position });
                    handleAddTemplateToCurrentTab(templateType, position);
                  }}
                  onApplyTheme={(theme) => {
                    // Update current theme state
                    setCurrentTheme(theme);
                    localStorage.setItem('workflow-theme', theme.id);
                    
                    // Apply theme to all nodes using the enhanced helper function
                    setNodes(prev => prev.map(node => ({
                      ...node,
                      data: applyThemeToNode(node.data, theme)
                    })));
                    
                    // Apply theme to all edges using the enhanced helper function
                    setEdges(prev => prev.map(edge => applyThemeToEdge(edge, theme)));
                    
                    saveToHistory();
                  }}
                  activePopout={activePopout}
                  setActivePopout={setActivePopout}
                  sidebarIcons={sidebarIcons}
                  viewport={viewport}
                />
                
                {/* Node Types Popout */}
                <NodeTypesPopout
                  isOpen={activePopout === 'node-types'}
                  onClose={() => setActivePopout(null)}
                  viewport={viewport}
                  onCreateNode={(type: string) => {
                    // Handle regular node creation
                    if (tabs.length === 0) {
                      const newTab = createBlankTab();
                      setTabs([newTab]);
                      setActiveTabId(newTab.id);
                    }

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
                      position: getViewportCenteredPosition(),
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
                    saveToHistory();
                    
                    // Toast notification for node creation
                    toast({
                      title: "Node Added",
                      description: `${newNode.data.label} added to canvas`,
                      variant: "default"
                    });
                  }}
                  onCreateNodeAtPosition={(type: string, position: { x: number; y: number }) => {
                    // Handle drag-and-drop node creation
                    if (tabs.length === 0) {
                      const newTab = createBlankTab();
                      setTabs([newTab]);
                      setActiveTabId(newTab.id);
                    }

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
                      position,
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
                    saveToHistory();
                    
                    // Toast notification for node creation
                    toast({
                      title: "Node Added",
                      description: `${newNode.data.label} added to canvas`,
                      variant: "default"
                    });
                  }}
                />
                
                {/* Shapes Popout */}
                <ShapesPopout
                  isOpen={activePopout === 'shapes'}
                  onClose={() => setActivePopout(null)}
                  viewport={viewport}
                  onCreateShape={(shapeType: string) => {
                    saveToHistory();
                    
                    const newCanvasObject: CanvasObject = {
                      id: `object-${Date.now()}`,
                      type: 'shape',
                      position: getViewportCenteredPosition(),
                      data: { ...DEFAULT_SHAPE_NODE_DATA, shapeType } as any,
                      width: 200,
                      height: shapeType === 'rectangle' ? 200 : 100,
                      selected: false
                    };
                    
                    updateActiveTab({ 
                      canvasObjects: [...canvasObjects, newCanvasObject] 
                    });
                    
                    // Toast notification for shape creation
                    toast({
                      title: "Shape Added",
                      description: `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)} shape added to canvas`,
                      variant: "default"
                    });
                  }}
                  onCreateShapeAtPosition={(shapeType: string, position: { x: number; y: number }) => {
                    saveToHistory();
                    
                    const newCanvasObject: CanvasObject = {
                      id: `object-${Date.now()}`,
                      type: 'shape',
                      position, // Use the provided position instead of center
                      data: { ...DEFAULT_SHAPE_NODE_DATA, shapeType } as any,
                      width: 200,
                      height: shapeType === 'rectangle' ? 200 : 100,
                      selected: false
                    };
                    
                    updateActiveTab({ 
                      canvasObjects: [...canvasObjects, newCanvasObject] 
                    });
                    
                    // Toast notification for shape creation
                    toast({
                      title: "Shape Added",
                      description: `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)} shape added to canvas`,
                      variant: "default"
                    });
                  }}
                />

                {/* Properties Card for selected objects - only show when sidebar is collapsed */}
                {isSidebarCollapsed && (selectedNodeId || selectedEdgeId || canvasObjects.some(obj => obj.selected)) && (
                  <PropertiesCard
                    selectedNode={nodes.find(n => n.id === selectedNodeId)}
                    selectedEdge={edges.find(e => e.id === selectedEdgeId)}
                    selectedCanvasObject={canvasObjects.find(obj => obj.selected)}
                    selectedNodeIds={nodes.filter(n => n.selected).map(n => n.id)}
                    selectedCanvasObjectIds={canvasObjects.filter(obj => obj.selected).map(obj => obj.id)}
                    nodes={nodes}
                    onNodeUpdate={(nodeId: string, updates: Partial<Node>) => {
                      setNodes(prev => prev.map(node => 
                        node.id === nodeId ? { ...node, ...updates } : node
                      ));
                      saveToHistory();
                    }}
                    onEdgeUpdate={(edgeId: string, updates: Partial<Edge>) => {
                      setEdges(prev => prev.map(edge => 
                        edge.id === edgeId ? { ...edge, ...updates } : edge
                      ));
                      saveToHistory();
                    }}
                    onCanvasObjectUpdate={(objectId: string, updates: any) => {
                      updateActiveTab({
                        canvasObjects: canvasObjects.map(obj => 
                          obj.id === objectId 
                            ? { 
                                ...obj, 
                                ...updates,
                                // If updates contains data, merge it with existing data
                                ...(updates.data && { data: { ...obj.data, ...updates.data } })
                              }
                            : obj
                        )
                      });
                      saveToHistory();
                    }}
                    onDeselect={() => {
                      // Only deselect the currently selected object, not all objects
                      if (selectedNodeId) {
                        setSelectedNodeId('');
                        setNodes(prev => prev.map(n => 
                          n.id === selectedNodeId ? { ...n, selected: false } : n
                        ));
                      }
                      if (selectedEdgeId) {
                        setSelectedEdgeId('');
                        setEdges(prev => prev.map(e => 
                          e.id === selectedEdgeId ? { ...e, selected: false } : e
                        ));
                      }
                      // Deselect any selected canvas objects
                      const hasSelectedCanvasObjects = canvasObjects.some(obj => obj.selected);
                      if (hasSelectedCanvasObjects) {
                        updateActiveTab({
                          canvasObjects: canvasObjects.map(obj => ({ ...obj, selected: false }))
                        });
                      }
                    }}
                    onImageUpload={async (nodeId: string, file: File) => {
                      // Convert file to data URL for local storage
                      return new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const dataUrl = reader.result as string;
                          resolve(dataUrl);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                      });
                    }}
                    onImageUrlSet={(nodeId: string, url: string) => {
                      // This handler is called when URL is set via modal
                      console.log('Image URL set for node:', nodeId, url);
                    }}
                  />
                )}
              </>
            ) : (
              <Sidebar
                selectedNode={nodes.find(n => n.id === selectedNodeId)}
                selectedNodes={nodes.filter(n => n.selected)}
                selectedEdge={edges.find(e => e.id === selectedEdgeId)}
                nodes={nodes}
                onToggleSidebar={toggleSidebar}
                onCreateNode={(type: string) => {
                // Create a new tab if none exist
                if (tabs.length === 0) {
                  const newTab = createBlankTab();
                  setTabs([newTab]);
                  setActiveTabId(newTab.id);
                  // Wait for the tab to be created before adding the node
                  setTimeout(() => {
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
                      position: getViewportCenteredPosition(),
                      data: {
                        label: type === 'image' ? 'Image' : `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
                        description: `Configure ${type} settings`,
                        icon: icons[type as keyof typeof icons]?.icon || 'fas fa-cube',
                        iconColor: icons[type as keyof typeof icons]?.color || 'text-gray-500'
                      },
                      width: 200,
                      height: 100
                    };

                    setNodes([newNode]);
                    saveToHistory();
                  }, 0);
                  return;
                }

                // For types like 'text', 'sticky', 'shape', create canvas objects instead of nodes
                if (['text', 'sticky', 'shape'].includes(type)) {
                  saveToHistory(); // Save current state before adding canvas object
                  
                  let newCanvasObject: CanvasObject;
                  
                  if (type === 'text') {
                    newCanvasObject = {
                      id: `object-${Date.now()}`,
                      type: 'text',
                      position: getViewportCenteredPosition(),
                      data: { text: 'Click to edit text', fontSize: 16, fontFamily: 'Inter, system-ui, sans-serif', textColor: '#000000' } as any,
                      style: { width: 200, height: 100 },
                      width: 200,
                      height: 100,
                      draggable: true,
                      resizable: true
                    };
                  } else if (type === 'sticky') {
                    newCanvasObject = {
                      id: `object-${Date.now()}`,
                      type: 'sticky',
                      position: getViewportCenteredPosition(),
                      data: { text: 'Your note here...', backgroundColor: '#fef3c7', textColor: '#92400e', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif' } as any,
                      style: { width: 180, height: 180 },
                      width: 180,
                      height: 180,
                      draggable: true,
                      resizable: true
                    };
                  } else {
                    newCanvasObject = {
                      id: `object-${Date.now()}`,
                      type: 'shape',
                      position: getViewportCenteredPosition(),
                      data: { shapeType: 'rectangle', fillColor: '#3b82f6', strokeColor: '#1d4ed8', strokeWidth: 2, strokeStyle: 'solid', opacity: 1 } as any,
                      style: { width: 200, height: 100 },
                      width: 200,
                      height: 100,
                      draggable: true,
                      resizable: true
                    };
                  }
                  
                  // Add to canvas objects instead of regular nodes
                  const currentCanvasObjects = activeTab?.canvasObjects || [];
                  updateActiveTab({ canvasObjects: [...currentCanvasObjects, newCanvasObject] });
                  
                  // Toast notification for canvas object creation
                  const objectTypeLabel = type === 'text' ? 'Text object' : type === 'sticky' ? 'Sticky note' : 'Shape';
                  toast({
                    title: `${objectTypeLabel} Added`,
                    description: `${objectTypeLabel} added to canvas`,
                    variant: "default"
                  });
                  return;
                }

                // Normal case - add to existing tab (for input, process, condition, output, ai, image)
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
                  position: getViewportCenteredPosition(),
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
                
                // Toast notification for node creation
                toast({
                  title: "Node Added",
                  description: `${newNode.data.label} added to canvas`,
                  variant: "default"
                });
              }}
              onCreateNodeAtPosition={(type: string, position: { x: number; y: number }) => {
                // Create a new tab if none exist
                if (tabs.length === 0) {
                  const newTab = createBlankTab();
                  setTabs([newTab]);
                  setActiveTabId(newTab.id);
                  return;
                }

                // Convert screen position to world position (using same logic as getViewportCenteredPosition)
                const worldPosition = {
                  x: Math.round((position.x - viewport.x) / viewport.zoom),
                  y: Math.round((position.y - viewport.y) / viewport.zoom)
                };
                
                // For canvas objects (text, sticky, shape)
                if (['text', 'sticky', 'shape'].includes(type)) {
                  saveToHistory();
                  
                  let newCanvasObject: CanvasObject;
                  
                  if (type === 'text') {
                    newCanvasObject = {
                      id: `object-${Date.now()}`,
                      type: 'text',
                      position: worldPosition,
                      data: { text: 'Click to edit text', fontSize: 16, fontFamily: 'Inter, system-ui, sans-serif', textColor: '#000000' } as any,
                      style: { width: 200, height: 100 },
                      width: 200,
                      height: 100,
                      draggable: true,
                      resizable: true
                    };
                  } else if (type === 'sticky') {
                    newCanvasObject = {
                      id: `object-${Date.now()}`,
                      type: 'sticky',
                      position: worldPosition,
                      data: { text: 'Your note here...', backgroundColor: '#fef3c7', textColor: '#92400e', fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif' } as any,
                      style: { width: 180, height: 180 },
                      width: 180,
                      height: 180,
                      draggable: true,
                      resizable: true
                    };
                  } else {
                    newCanvasObject = {
                      id: `object-${Date.now()}`,
                      type: 'shape',
                      position: worldPosition,
                      data: { shapeType: 'rectangle', fillColor: '#3b82f6', strokeColor: '#1d4ed8', strokeWidth: 2, strokeStyle: 'solid', opacity: 1 } as any,
                      style: { width: 200, height: 100 },
                      width: 200,
                      height: 100,
                      draggable: true,
                      resizable: true
                    };
                  }
                  
                  const currentCanvasObjects = activeTab?.canvasObjects || [];
                  updateActiveTab({ canvasObjects: [...currentCanvasObjects, newCanvasObject] });
                  
                  // Toast notification for canvas object creation
                  const objectTypeLabel = type === 'text' ? 'Text object' : type === 'sticky' ? 'Sticky note' : 'Shape';
                  toast({
                    title: `${objectTypeLabel} Added`,
                    description: `${objectTypeLabel} added to canvas`,
                    variant: "default"
                  });
                  return;
                }

                // For regular nodes (input, process, condition, output, ai, image)
                saveToHistory();
                
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
                  position: { x: worldPosition.x - 100, y: worldPosition.y - 50 }, // Center the node
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
                
                // Toast notification for node creation
                toast({
                  title: "Node Added",
                  description: `${newNode.data.label} added to canvas`,
                  variant: "default"
                });
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
                const comprehensiveWorkflow = {
                  version: "1.0",
                  timestamp: new Date().toISOString(),
                  workflow: {
                    id: activeTab?.id || `workflow-${Date.now()}`,
                    name: activeTab?.name || 'My Workflow',
                    description: activeTab?.metadata?.description || '',
                    links: activeTab?.metadata?.links || [],
                    categories: activeTab?.metadata?.categories || []
                  },
                  canvas: {
                    nodes: nodes.map(node => ({
                      ...node,
                      data: { ...node.data },
                      style: node.style || {}
                    })),
                    edges: edges.map(edge => ({
                      ...edge,
                      style: edge.style || {},
                      data: edge.data || {}
                    })),
                    canvasObjects: canvasObjects.map(obj => ({
                      ...obj,
                      data: { ...obj.data },
                      style: obj.style || {}
                    })),
                    viewport: { ...viewport }
                  }
                };
                
                const dataStr = JSON.stringify(comprehensiveWorkflow, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                const safeFileName = comprehensiveWorkflow.workflow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const exportFileDefaultName = `${safeFileName}_complete_workflow.json`;
                
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', exportFileDefaultName);
                linkElement.click();
                
                toast({
                  title: "Workflow Exported",
                  description: `"${comprehensiveWorkflow.workflow.name}" exported with all content and styling`,
                });
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
              onBulkNodeUpdate={(nodeIds: string[], updates: Partial<Node>) => {
                setNodes(prev => prev.map(n => 
                  nodeIds.includes(n.id) 
                    ? { 
                        ...n, 
                        ...updates,
                        data: updates.data ? { ...n.data, ...updates.data } : n.data
                      } 
                    : n
                ));
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
              onCanvasObjectUpdate={(objectId: string, updates: Partial<TextNodeData | ShapeNodeData | StickyNoteData>) => {
                const targetObj = canvasObjects.find(obj => obj.id === objectId);
                if (!targetObj) return;
                
                const nextData = { ...targetObj.data, ...updates };
                
                // Shallow equality check to prevent unnecessary updates
                const shallowEqual = (obj1: any, obj2: any) => {
                  const keys1 = Object.keys(obj1);
                  const keys2 = Object.keys(obj2);
                  if (keys1.length !== keys2.length) return false;
                  return keys1.every(key => obj1[key] === obj2[key]);
                };
                
                if (shallowEqual(targetObj.data, nextData)) {
                  return; // No change, skip update
                }
                
                const updatedObjects = canvasObjects.map(obj =>
                  obj.id === objectId
                    ? { ...obj, data: nextData }
                    : obj
                );
                updateActiveTab({ canvasObjects: updatedObjects });
                saveToHistory();
              }}
              onDeselectCanvasObjects={() => {
                const updatedObjects = canvasObjects.map(obj => ({ ...obj, selected: false }));
                updateActiveTab({ canvasObjects: updatedObjects });
              }}
              selectedCanvasObjects={selectedCanvasObjects}
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
              onSnapshot={handleSnapshot}
              onVersionHistory={handleVersionHistory}
              onApplyTheme={(theme) => {
                // Update current theme state
                setCurrentTheme(theme);
                localStorage.setItem('workflow-theme', theme.id);
                
                // Apply theme to all nodes using the enhanced helper function
                setNodes(prev => prev.map(node => ({
                  ...node,
                  data: applyThemeToNode(node.data, theme)
                })));

                // Apply theme to all edges using the enhanced helper function
                setEdges(prev => prev.map(edge => applyThemeToEdge(edge, theme)));

                saveToHistory();
              }}
              copiedProperties={copiedProperties}
              onApplyToWorkflow={(colors) => {
                // Apply colors to all nodes in the current workflow
                saveToHistory();
                setNodes(prev => prev.map(node => ({
                  ...node,
                  data: {
                    ...node.data,
                    colors: {
                      ...node.data?.colors,
                      headerBackground: colors.headerBackground,
                      bodyBackground: colors.bodyBackground,
                      headerTextColor: colors.headerTextColor,
                      bodyTextColor: colors.bodyTextColor
                    }
                  }
                })));
              }}
              currentWorkflow={activeTab ? {
                id: activeTab.id,
                name: activeTab.name,
                nodes: activeTab.nodes,
                edges: activeTab.edges
              } : undefined}
              onLoadWorkflow={(workflow) => {
                // Create a new tab with the loaded workflow
                const newTab: WorkflowTab = {
                  id: workflow.id,
                  name: workflow.name,
                  nodes: workflow.nodes,
                  edges: workflow.edges,
                  canvasObjects: [],
                  viewport: { x: 0, y: 0, zoom: 1 },
                  selectedNodeId: '',
                  selectedEdgeId: '',
                  history: [{ nodes: workflow.nodes, edges: workflow.edges, canvasObjects: [], viewport: { x: 0, y: 0, zoom: 1 } }],
                  historyIndex: 0,
                  showImageModal: null,
                  metadata: {
                    name: workflow.name,
                    description: '',
                    links: [],
                    linksFormat: 'bulleted',
                    categories: []
                  }
                };
                
                setTabs(prev => [...prev, newTab]);
                setActiveTabId(newTab.id);
              }}
              onCreateTemplate={(templateType: string) => {
                // Create a new tab if none exist
                if (tabs.length === 0) {
                  const newTab = createBlankTab();
                  setTabs([newTab]);
                  setActiveTabId(newTab.id);
                  // Wait for the tab to be created before adding the template
                  setTimeout(() => {
                    handleAddTemplateToCurrentTab(templateType);
                  }, 50);
                  return;
                }

                // Normal case - add template to current active tab
                handleAddTemplateToCurrentTab(templateType);
              }}
              onCreateTemplateAtPosition={(templateType: string, position: { x: number; y: number }) => {
                // Create a new tab if none exist
                if (tabs.length === 0) {
                  const newTab = createBlankTab();
                  setTabs([newTab]);
                  setActiveTabId(newTab.id);
                  // Wait for the tab to be created before adding the template
                  setTimeout(() => {
                    handleAddTemplateToCurrentTab(templateType, position);
                  }, 50);
                  return;
                }

                // Normal case - add template to current active tab with position
                handleAddTemplateToCurrentTab(templateType, position);
              }}
              viewport={viewport}
              connectionAnimationConfig={connectionAnimationConfig}
              onConnectionAnimationConfigChange={setConnectionAnimationConfig}
              />
            )}
          </div>

          {/* Canvas Area */}
          <div className={`flex-1 relative ${tabs.length > 0 ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            
            {tabs.length > 0 ? (
              <>
                <WorkflowCanvas
                data-testid="workflow-canvas"
                nodes={nodes}
                edges={edges}
                canvasObjects={canvasObjects}
                viewport={viewport}
                onViewportChange={setViewport}
                onCanvasObjectsChange={(newCanvasObjects) => {
                  updateActiveTab({ canvasObjects: newCanvasObjects });
                  saveToHistory();
                }}
              proFeatures={proFeaturesConfig}
              onQuickAdd={handleQuickAdd}
              workflowName={activeTab?.name}
              onWorkflowNameChange={setWorkflowName}
              workflowMetadata={metadata}
              onWorkflowMetadataChange={setWorkflowMetadata}
              onEdgeReconnect={handleEdgeReconnect}
              connectionAnimationConfig={connectionAnimationConfig}
              connectionPreview={connectionPreview}
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
                    
                    // Mark as dragging to prevent properties panel from opening
                    isDraggingRef.current = true;
                    
                    // Cancel any pending click delay timer since we're now dragging
                    if (clickDelayTimeoutRef.current) {
                      clearTimeout(clickDelayTimeoutRef.current);
                      clickDelayTimeoutRef.current = null;
                      console.log('📝 CANCELLED PROPERTIES PANEL due to drag operation');
                    }
                    
                    // Reset drag state after a delay (when user stops dragging)
                    if (dragResetTimeoutRef.current) {
                      clearTimeout(dragResetTimeoutRef.current);
                    }
                    dragResetTimeoutRef.current = setTimeout(() => {
                      isDraggingRef.current = false;
                      console.log('📝 DRAG STATE RESET - ready for next click');
                    }, 200); // Reset after 200ms of no drag activity
                    
                    setNodes(changes as Node[]);
                    // Don't save to history on every drag move, only on drag end
                  } else {
                    // Change-based updates
                    console.log('📊 CHANGE-BASED UPDATE:', {
                      changeTypes: changes.map((c: any) => c.type)
                    });

                    // Separate node changes by type for better history tracking
                    const selectionChanges = changes.filter(c => c.type === 'select');
                    const positionChanges = changes.filter(c => c.type === 'position');
                    const removalChanges = changes.filter(c => c.type === 'remove');
                    const otherChanges = changes.filter(c => c.type && !['select', 'position', 'remove'].includes(c.type));

                    // Process selection and position changes in batch (they don't change structure)
                    if (selectionChanges.length > 0 || positionChanges.length > 0) {
                      setNodes(prev => {
                        let newNodes = [...prev];
                        [...selectionChanges, ...positionChanges].forEach(change => {
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
                          }
                        });
                        return newNodes;
                      });
                      
                      // Only save to history for position changes (structural changes)
                      if (positionChanges.length > 0) {
                        saveToHistory();
                      }
                    }

                    // Process removal changes individually
                    if (removalChanges.length > 0) {
                      removalChanges.forEach((change, index) => {
                        console.log(`🗑️ NODE REMOVAL ${index + 1}/${removalChanges.length}:`, {
                          nodeId: change.id,
                          willSaveToHistory: true
                        });
                        
                        setNodes(prev => {
                          const newNodes = prev.filter(n => n.id !== change.id);
                          console.log(`🗑️ NODE REMOVED:`, {
                            removedId: change.id,
                            nodesBefore: prev.length,
                            nodesAfter: newNodes.length
                          });
                          return newNodes;
                        });
                        
                        // Save to history after each node removal
                        setTimeout(() => saveToHistory(), 10 * (index + 1));
                      });
                    }

                    // Process other changes
                    if (otherChanges.length > 0) {
                      setNodes(prev => {
                        let newNodes = [...prev];
                        otherChanges.forEach(change => {
                          console.log('📊 OTHER NODE CHANGE:', change);
                          // Handle any other change types here
                        });
                        return newNodes;
                      });
                      saveToHistory();
                    }
                  }
                }
              }}
              onEdgesChange={(changes: any[]) => {
                console.log('🔗 onEdgesChange CALLED:', {
                  changes,
                  changeTypes: changes.map(c => c.type),
                  isArray: Array.isArray(changes),
                  length: Array.isArray(changes) ? changes.length : 0
                });

                // Separate changes by type for individual history tracking
                const selectionChanges = changes.filter(c => c.type === 'select');
                const removalChanges = changes.filter(c => c.type === 'remove');
                const otherChanges = changes.filter(c => c.type !== 'select' && c.type !== 'remove');

                // Process selection changes in batch (don't save to history)
                if (selectionChanges.length > 0) {
                  setEdges(prev => {
                    let newEdges = [...prev];
                    selectionChanges.forEach(change => {
                      const edgeIndex = newEdges.findIndex(e => e.id === change.id);
                      if (edgeIndex >= 0) {
                        newEdges[edgeIndex] = { ...newEdges[edgeIndex], selected: change.selected };
                      }
                    });
                    return newEdges;
                  });
                }

                // Process removal changes individually (save to history for each)
                if (removalChanges.length > 0) {
                  removalChanges.forEach((change, index) => {
                    console.log(`🗑️ EDGE REMOVAL ${index + 1}/${removalChanges.length}:`, {
                      edgeId: change.id,
                      willSaveToHistory: true
                    });
                    
                    setEdges(prev => {
                      const newEdges = prev.filter(e => e.id !== change.id);
                      console.log(`🗑️ EDGE REMOVED:`, {
                        removedId: change.id,
                        edgesBefore: prev.length,
                        edgesAfter: newEdges.length
                      });
                      return newEdges;
                    });
                    
                    // Save to history after each edge removal
                    setTimeout(() => saveToHistory(), 10 * (index + 1)); // Stagger the saves slightly
                  });
                }

                // Process other changes in batch
                if (otherChanges.length > 0) {
                  setEdges(prev => {
                    let newEdges = [...prev];
                    otherChanges.forEach(change => {
                      // Handle any other change types here
                      console.log('🔗 OTHER EDGE CHANGE:', change);
                    });
                    return newEdges;
                  });
                  saveToHistory();
                }
              }}
              onConnect={(connection) => {
                const newEdge: Edge = {
                  id: `edge-${Date.now()}`,
                  source: connection.source,
                  target: connection.target,
                  type: 'bezier' as const,
                  style: { strokeColor: '#3b82f6', strokeWidth: 2 },
                  markers: { type: 'arrow' as const, position: 'end' as const },
                  reconnectable: true, // Enable reconnection for new edges
                  interactable: true // Make edge clickable
                };
                console.log('🔗 NEW EDGE CREATED:', newEdge);
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
                
                // Clear any existing click delay timer
                if (clickDelayTimeoutRef.current) {
                  clearTimeout(clickDelayTimeoutRef.current);
                  clickDelayTimeoutRef.current = null;
                }
                
                if (e.shiftKey) {
                  // Shift+click for multi-select - immediate action
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
                  
                  // Don't change selectedNodeId during multi-select to preserve the selection
                } else {
                  // Regular click - update selection immediately but delay properties panel
                  setNodes(prev => {
                    const updated = prev.map(n => ({ ...n, selected: n.id === node.id }));
                    console.log(`📝 SINGLE SELECT UPDATE:`, { 
                      selected: updated.filter(n => n.selected).map(n => n.id),
                      total: updated.length 
                    });
                    return updated;
                  });
                  
                  // Reset drag detection
                  isDraggingRef.current = false;
                  
                  // Delay opening properties panel to detect if this becomes a drag
                  clickDelayTimeoutRef.current = setTimeout(() => {
                    if (!isDraggingRef.current) {
                      console.log(`📝 CLICK CONFIRMED (no drag detected) - opening properties panel for:`, node.id);
                      setSelectedNodeId(node.id);
                    } else {
                      console.log(`📝 DRAG DETECTED - not opening properties panel for:`, node.id);
                    }
                    clickDelayTimeoutRef.current = null;
                  }, 150); // 150ms delay to detect drag
                }
                
                setEdges(prev => prev.map(e => ({ ...e, selected: false })));
                const updatedObjects = canvasObjects.map(obj => ({ ...obj, selected: false }));
                updateActiveTab({ canvasObjects: updatedObjects });
                setSelectedEdgeId('');
                setContextMenu(null);
                
                console.log(`📝 SELECTION STATE SET:`, { 
                  selectedNodeId: e.shiftKey ? selectedNodeId : 'delayed for drag detection',
                  selectedEdgeId: '',
                  tabId: activeTab 
                });
              }}
              onNodeDoubleClick={(e: React.MouseEvent, node: Node) => {
                console.log(`📝 EDITOR NODE DOUBLE-CLICK HANDLER:`, { 
                  nodeId: node.id, 
                  nodeType: node.type,
                  tabId: activeTab 
                });
                // The inline editing is already handled by BasicNode component internally
                // This handler can be used for additional functionality like logging
              }}
              onEdgeClick={(edge: Edge) => {
                console.log(`📝 EDITOR EDGE CLICK HANDLER:`, { 
                  edgeId: edge.id, 
                  currentSelected: selectedEdgeId,
                  tabId: activeTab 
                });
                
                // Clear any existing click delay timer
                if (clickDelayTimeoutRef.current) {
                  clearTimeout(clickDelayTimeoutRef.current);
                  clickDelayTimeoutRef.current = null;
                }
                
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
                setContextMenu(null);
                
                // Reset drag detection
                isDraggingRef.current = false;
                
                // Delay opening properties panel for edges too
                clickDelayTimeoutRef.current = setTimeout(() => {
                  if (!isDraggingRef.current) {
                    console.log(`📝 EDGE CLICK CONFIRMED (no drag detected) - opening properties panel for:`, edge.id);
                    setSelectedEdgeId(edge.id);
                  } else {
                    console.log(`📝 EDGE DRAG DETECTED - not opening properties panel for:`, edge.id);
                  }
                  clickDelayTimeoutRef.current = null;
                }, 150); // 150ms delay
                
                console.log(`🔗 EDGE SELECTED FOR RECONNECTION:`, { 
                  edgeId: edge.id, 
                  reconnectable: edge.reconnectable,
                  enableAllEdges: proFeaturesConfig.edgeReconnection?.enableAllEdges,
                  edgeReconnectionEnabled: proFeaturesConfig.edgeReconnection?.enabled
                });
                
                console.log(`📝 SELECTION STATE SET:`, { 
                  selectedNodeId: '',
                  selectedEdgeId: 'delayed for drag detection',
                  tabId: activeTab 
                });
              }}
              onCanvasClick={(e?: React.MouseEvent) => {
                // Don't deselect during drag operations to keep properties card open
                if (e && (e.target as HTMLElement)?.closest?.('.dragging')) {
                  console.log(`📝 CANVAS CLICK: Ignoring during drag operation`);
                  return;
                }
                
                console.log(`📝 CANVAS CLICK:`, { tabId: activeTab, clearing: 'all selections' });
                setNodes(prev => prev.map(n => ({ ...n, selected: false })));
                setEdges(prev => prev.map(e => ({ ...e, selected: false })));
                setSelectedNodeId('');
                setSelectedEdgeId('');
                setContextMenu(null);
                // Clear canvas objects selection too
                updateActiveTab({
                  canvasObjects: canvasObjects.map(obj => ({ ...obj, selected: false }))
                });
              }}
              onNodeRightClick={(e: React.MouseEvent, node: Node) => {
                setContextMenu({ x: e.clientX, y: e.clientY, node });
              }}
              onCanvasObjectRightClick={(e: React.MouseEvent, canvasObject: CanvasObject) => {
                setContextMenu({ x: e.clientX, y: e.clientY, canvasObject });
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
              onSelectionChange={(nodeIds: string[], edgeIds: string[]) => {
                console.log('🎯 Selection changed from FocusBus:', { nodeIds, edgeIds });
                
                // Update nodes selection
                if (nodeIds.length > 0) {
                  setNodes(prev => prev.map(node => ({
                    ...node,
                    selected: nodeIds.includes(node.id)
                  })));
                  setSelectedNodeId(nodeIds[0] || '');
                } else {
                  setNodes(prev => prev.map(node => ({
                    ...node,
                    selected: false
                  })));
                  setSelectedNodeId('');
                }
                
                // Update edges selection
                if (edgeIds.length > 0) {
                  setEdges(prev => prev.map(edge => ({
                    ...edge,
                    selected: edgeIds.includes(edge.id)
                  })));
                  setSelectedEdgeId(edgeIds[0] || '');
                } else {
                  setEdges(prev => prev.map(edge => ({
                    ...edge,
                    selected: false
                  })));
                  setSelectedEdgeId('');
                }
              }}
            />
                
                <FloatingLayersWidget
                  nodes={nodes}
                  edges={edges}
                  frames={[]}
                />
                
                {/* KiteAI Floating Chat */}
                <KiteAIChat
                  currentNodes={nodes}
                  currentEdges={edges}
                  currentCanvasObjects={canvasObjects}
                  onApplyWorkflow={(workflow) => {
                    console.log('📝 KITEAI APPLYING WORKFLOW:', { 
                      nodeCount: workflow.nodes.length, 
                      edgeCount: workflow.edges.length 
                    });
                    
                    // Calculate offset to avoid overlap with existing nodes
                    const offset = calculateWorkflowOffset(workflow.nodes);
                    
                    // Generate unique batch ID
                    const batchId = Date.now();
                    
                    // Map old IDs to new IDs
                    const nodeIdMapping: { [oldId: string]: string } = {};
                    
                    // Apply offset and create unique IDs
                    const offsetNodes = workflow.nodes.map((node: Node, index: number) => {
                      const oldId = node.id || `node-${index}`;
                      const newId = `${oldId}-kiteai-${batchId}-${index}`;
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

                    const offsetEdges = workflow.edges.map((edge: Edge, index: number) => ({
                      ...edge,
                      id: `${edge.id || `edge-${index}`}-kiteai-${batchId}-${index}`,
                      source: nodeIdMapping[edge.source] || edge.source,
                      target: nodeIdMapping[edge.target] || edge.target,
                      selected: false
                    }));

                    // Append to existing canvas
                    setNodes(prev => [...prev, ...offsetNodes]);
                    setEdges(prev => [...prev, ...offsetEdges]);
                    
                    // Handle canvas objects if present
                    if (workflow.canvasObjects && workflow.canvasObjects.length > 0) {
                      const offsetObjects = workflow.canvasObjects.map((obj: CanvasObject, index: number) => ({
                        ...obj,
                        id: `${obj.id || `obj-${index}`}-kiteai-${batchId}-${index}`,
                        position: {
                          x: obj.position.x + offset.x,
                          y: obj.position.y + offset.y
                        },
                        selected: false
                      }));
                      updateActiveTab({ canvasObjects: [...canvasObjects, ...offsetObjects] });
                    }
                    
                    // Save to history
                    setTimeout(() => saveToHistory(), 0);
                    
                    toast({
                      title: "Workflow Applied",
                      description: `Added ${offsetNodes.length} nodes and ${offsetEdges.length} connections.`
                    });
                  }}
                />
              </>
            ) : (
              <BlankCanvasState
                onCreateBlank={handleCreateBlankFromCanvas}
                onCreateWithTemplate={handleCreateWithTemplate}
                onCreateWithAI={handleCreateWithAI}
                onImportWorkflow={handleImportFromCanvas}
                onCreateTemplate={handleCreateTemplateFromCanvas}
              />
            )}
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
            onImport={(importedData: any) => {
              try {
                console.log('Importing from modal format:', importedData);
                
                // Handle comprehensive workflow format (direct JSON import)
                if (importedData.version && importedData.canvas && importedData.workflow) {
                  // New comprehensive format
                  const { workflow, canvas } = importedData;
                  
                  // Restore workflow metadata
                  if (activeTab) {
                    updateActiveTab({
                      name: workflow.name,
                      metadata: {
                        name: workflow.name,
                        description: workflow.description || '',
                        links: workflow.links || [],
                        linksFormat: activeTab.metadata.linksFormat || 'text',
                        categories: workflow.categories || []
                      }
                    });
                  }
                  
                  // Restore canvas content with all styling
                  if (canvas.nodes) {
                    setNodes(canvas.nodes.map((node: any) => ({
                      ...node,
                      data: { ...node.data },
                      style: node.style || {}
                    })));
                  }
                  
                  if (canvas.edges) {
                    setEdges(canvas.edges.map((edge: any) => ({
                      ...edge,
                      style: edge.style || {},
                      data: edge.data || {}
                    })));
                  }
                  
                  if (canvas.canvasObjects) {
                    updateActiveTab({
                      canvasObjects: canvas.canvasObjects.map((obj: any) => ({
                        ...obj,
                        data: { ...obj.data },
                        style: obj.style || {}
                      }))
                    });
                  }
                  
                  if (canvas.viewport) {
                    setViewport(canvas.viewport);
                  }
                  
                  toast({
                    title: "Workflow Imported",
                    description: `"${workflow.name}" imported with all content, styling, and metadata`,
                  });
                } else if (importedData.nodes || importedData.edges || importedData.canvasObjects) {
                  // New modal format - handle nodes, edges, canvasObjects, and metadata
                  const nodesCount = importedData.nodes ? importedData.nodes.length : 0;
                  const edgesCount = importedData.edges ? importedData.edges.length : 0;
                  const objectsCount = importedData.canvasObjects ? importedData.canvasObjects.length : 0;
                  
                  if (activeTab) {
                    // Apply workflow metadata if provided
                    const metadataUpdate = importedData.workflowMetadata ? {
                      name: importedData.workflowMetadata.name || activeTab.name,
                      metadata: {
                        name: importedData.workflowMetadata.name || activeTab.metadata.name,
                        description: importedData.workflowMetadata.description || activeTab.metadata.description,
                        links: importedData.workflowMetadata.links || activeTab.metadata.links,
                        linksFormat: activeTab.metadata.linksFormat || 'text',
                        categories: importedData.workflowMetadata.categories || activeTab.metadata.categories
                      }
                    } : {};

                    // Update tab with imported content and metadata
                    updateActiveTab({
                      ...metadataUpdate,
                      nodes: importedData.nodes ? importedData.nodes.map((node: Node) => ({ ...node, selected: false })) : activeTab.nodes,
                      edges: importedData.edges ? importedData.edges.map((edge: Edge) => ({ ...edge, selected: false })) : activeTab.edges,
                      canvasObjects: importedData.canvasObjects ? importedData.canvasObjects.map((obj: any) => ({ ...obj, selected: false })) : activeTab.canvasObjects,
                      viewport: importedData.viewport || activeTab.viewport
                    });
                    
                    toast({
                      title: "Workflow Imported",
                      description: `Imported ${nodesCount} nodes, ${edgesCount} connections, and ${objectsCount} canvas objects with metadata`,
                    });
                  }
                } else {
                  // Legacy format fallback
                  console.log('Using legacy import fallback');
                  if (importedData.nodes) {
                    setNodes(importedData.nodes);
                  }
                  if (importedData.edges) {
                    setEdges(importedData.edges);
                  }
                  if (importedData.canvasObjects) {
                    updateActiveTab({ canvasObjects: importedData.canvasObjects });
                  }
                  if (importedData.viewport) {
                    setViewport(importedData.viewport);
                  }
                  
                  toast({
                    title: "Workflow Imported",
                    description: "Legacy workflow format imported successfully",
                  });
                }
                
                // Clear selections and save to history
                setSelectedNodeId('');
                setSelectedEdgeId('');
                saveToHistory();
                
              } catch (error) {
                console.error('Import failed:', error);
                toast({
                  title: "Import Failed",
                  description: "Failed to import workflow. Please check the file format.",
                  variant: "destructive"
                });
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
            onCreateBlank={handleCreateBlankFromCanvas}
            onCreateFromPrompt={handleCreateFromPrompt}
            onCreateFromFile={handleCreateFromFile}
            onCreateFromTemplate={handleCreateFromTemplate}
            onCreateFromImage={(imageFile: File) => {
              // Image analysis is now handled directly in the modal
              console.log('Image file received:', imageFile);
            }}
          />
        )}

        {/* Bug Report Modal */}
        {showBugReportModal && (
          <BugReportModal
            onClose={() => setShowBugReportModal(false)}
          />
        )}

        {/* Image Upload Modal */}
        {showImageUploadModal && selectedImageNodeId && (
          <ImageUploadModal
            isOpen={showImageUploadModal}
            onClose={() => {
              setShowImageUploadModal(false);
              setSelectedImageNodeId(null);
            }}
            onImageUpload={async (file: File) => {
              // Convert file to data URL for local storage
              return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const dataUrl = reader.result as string;
                  // Update the node with the image
                  setNodes(prev => prev.map(n => 
                    n.id === selectedImageNodeId
                      ? { ...n, data: { ...n.data, src: dataUrl, filename: file.name, sourceType: 'upload' } }
                      : n
                  ));
                  resolve(dataUrl);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
            }}
            onImageUrlSet={(url: string) => {
              // Update the node with the URL
              setNodes(prev => prev.map(n => 
                n.id === selectedImageNodeId
                  ? { ...n, data: { ...n.data, src: url, sourceType: 'url' } }
                  : n
              ));
            }}
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
            onCopyProperties={() => {
              if (contextMenu.node) {
                // Copy node properties (colors, icon, iconColor, etc.) but not label/description
                const propertiesToCopy = {
                  colors: contextMenu.node.data?.colors,
                  data: {
                    icon: contextMenu.node.data?.icon,
                    iconColor: contextMenu.node.data?.iconColor,
                  }
                };
                setCopiedProperties(propertiesToCopy);
                console.log('📋 Node properties copied:', propertiesToCopy);
                setContextMenu(null);
              } else if (contextMenu.canvasObject) {
                // Copy canvas object properties (styling and data)
                const propertiesToCopy = {
                  data: { ...contextMenu.canvasObject.data },
                  style: { ...contextMenu.canvasObject.style }
                };
                setCopiedCanvasObjectProperties(propertiesToCopy);
                console.log('📋 Canvas object properties copied:', propertiesToCopy);
                setContextMenu(null);
              }
            }}
            onPasteProperties={(contextMenu.node && copiedProperties) || (contextMenu.canvasObject && copiedCanvasObjectProperties) ? () => {
              if (contextMenu.node && copiedProperties) {
                saveToHistory();
                updateActiveTab({
                  nodes: nodes.map(n => 
                    n.id === contextMenu.node!.id 
                      ? {
                          ...n,
                          data: {
                            ...n.data,
                            ...copiedProperties.data,
                            colors: copiedProperties.colors
                          }
                        }
                      : n
                  )
                });
                console.log('🎨 Properties pasted to node:', contextMenu.node.id);
                setContextMenu(null);
              } else if (contextMenu.canvasObject && copiedCanvasObjectProperties) {
                saveToHistory();
                const updatedObjects = canvasObjects.map(obj => 
                  obj.id === contextMenu.canvasObject!.id 
                    ? {
                        ...obj,
                        data: {
                          ...obj.data,
                          ...copiedCanvasObjectProperties.data
                        },
                        style: {
                          ...obj.style,
                          ...copiedCanvasObjectProperties.style
                        }
                      }
                    : obj
                );
                updateActiveTab({ canvasObjects: updatedObjects });
                console.log('🎨 Properties pasted to canvas object:', contextMenu.canvasObject.id);
                setContextMenu(null);
              }
            } : undefined}
            hasPropertiesInClipboard={!!(copiedProperties || copiedCanvasObjectProperties)}
            onBringToFront={() => {
              if (contextMenu.node) {
                const maxZIndex = Math.max(...nodes.map(n => n.zIndex || 0));
                saveToHistory();
                const updatedNodes = nodes.map(n => 
                  n.id === contextMenu.node!.id 
                    ? { ...n, zIndex: maxZIndex + 1 }
                    : n
                );
                // Recalculate edge z-indexes based on updated nodes
                const updatedEdges = recalculateAllEdgeZIndexes(edges, updatedNodes);
                updateActiveTab({
                  nodes: updatedNodes,
                  edges: updatedEdges
                });
              } else if (contextMenu.canvasObject) {
                const maxZIndex = Math.max(...canvasObjects.map(obj => obj.zIndex || 0));
                saveToHistory();
                updateActiveTab({
                  canvasObjects: canvasObjects.map(obj => 
                    obj.id === contextMenu.canvasObject!.id 
                      ? { ...obj, zIndex: maxZIndex + 1 }
                      : obj
                  )
                });
              }
              setContextMenu(null);
            }}
            onBringForward={() => {
              if (contextMenu.node) {
                const currentZIndex = contextMenu.node.zIndex || 0;
                saveToHistory();
                const updatedNodes = nodes.map(n => 
                  n.id === contextMenu.node!.id 
                    ? { ...n, zIndex: currentZIndex + 1 }
                    : n
                );
                // Recalculate edge z-indexes based on updated nodes
                const updatedEdges = recalculateAllEdgeZIndexes(edges, updatedNodes);
                updateActiveTab({
                  nodes: updatedNodes,
                  edges: updatedEdges
                });
              } else if (contextMenu.canvasObject) {
                const currentZIndex = contextMenu.canvasObject.zIndex || 0;
                saveToHistory();
                updateActiveTab({
                  canvasObjects: canvasObjects.map(obj => 
                    obj.id === contextMenu.canvasObject!.id 
                      ? { ...obj, zIndex: currentZIndex + 1 }
                      : obj
                  )
                });
              }
              setContextMenu(null);
            }}
            onSendBackward={() => {
              if (contextMenu.node) {
                const currentZIndex = contextMenu.node.zIndex || 0;
                saveToHistory();
                const updatedNodes = nodes.map(n => 
                  n.id === contextMenu.node!.id 
                    ? { ...n, zIndex: Math.max(0, currentZIndex - 1) }
                    : n
                );
                // Recalculate edge z-indexes based on updated nodes
                const updatedEdges = recalculateAllEdgeZIndexes(edges, updatedNodes);
                updateActiveTab({
                  nodes: updatedNodes,
                  edges: updatedEdges
                });
              } else if (contextMenu.canvasObject) {
                const currentZIndex = contextMenu.canvasObject.zIndex || 0;
                saveToHistory();
                updateActiveTab({
                  canvasObjects: canvasObjects.map(obj => 
                    obj.id === contextMenu.canvasObject!.id 
                      ? { ...obj, zIndex: Math.max(0, currentZIndex - 1) }
                      : obj
                  )
                });
              }
              setContextMenu(null);
            }}
            onSendToBack={() => {
              if (contextMenu.node) {
                saveToHistory();
                const updatedNodes = nodes.map(n => 
                  n.id === contextMenu.node!.id 
                    ? { ...n, zIndex: 0 }
                    : n
                );
                // Recalculate edge z-indexes based on updated nodes
                const updatedEdges = recalculateAllEdgeZIndexes(edges, updatedNodes);
                updateActiveTab({
                  nodes: updatedNodes,
                  edges: updatedEdges
                });
              } else if (contextMenu.canvasObject) {
                saveToHistory();
                updateActiveTab({
                  canvasObjects: canvasObjects.map(obj => 
                    obj.id === contextMenu.canvasObject!.id 
                      ? { ...obj, zIndex: 0 }
                      : obj
                  )
                });
              }
              setContextMenu(null);
            }}
            onDelete={() => {
              if (contextMenu.node) {
                saveToHistory();
                setNodes(prev => prev.filter(n => n.id !== contextMenu.node!.id));
                setEdges(prev => prev.filter(e => e.source !== contextMenu.node!.id && e.target !== contextMenu.node!.id));
                setContextMenu(null);
              } else if (contextMenu.canvasObject) {
                saveToHistory();
                const updatedObjects = canvasObjects.filter(obj => obj.id !== contextMenu.canvasObject!.id);
                updateActiveTab({ canvasObjects: updatedObjects });
                console.log('🗑️ Canvas object deleted:', contextMenu.canvasObject.id);
                setContextMenu(null);
              }
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
              } else if (contextMenu.canvasObject) {
                const newObject = {
                  ...contextMenu.canvasObject,
                  id: `canvas-object-${Date.now()}`,
                  position: {
                    x: contextMenu.canvasObject.position.x + 20,
                    y: contextMenu.canvasObject.position.y + 20
                  },
                  selected: false
                };
                const updatedObjects = [...canvasObjects, newObject];
                updateActiveTab({ canvasObjects: updatedObjects });
                saveToHistory();
                console.log('📋 Canvas object duplicated:', newObject.id);
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
      <PluginProvider>
        <WorkflowEditorContent onAiSettingsChange={updateAiClient} />
      </PluginProvider>
    </AiProvider>
  );
}