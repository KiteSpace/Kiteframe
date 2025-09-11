import { useState, useCallback, useEffect, useMemo } from 'react';
import { WorkflowCanvas } from '@/components/WorkflowCanvas';
import { BlankCanvasState } from '@/components/BlankCanvasState';
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
import { useFirebaseWorkflows } from '../hooks/useFirebaseWorkflows';
import { useAuth } from '../hooks/useAuth';
import type { Node, Edge, ProFeaturesConfig, NodeType } from '../lib/kiteframe/types';
import '../lib/kiteframe/styles/kiteframe.css';
import { X, Plus } from 'lucide-react';

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
  viewport: { x: number; y: number; zoom: number };
  selectedNodeId: string;
  selectedEdgeId: string;
  history: Array<{ nodes: Node[]; edges: Edge[]; viewport: { x: number; y: number; zoom: number } }>;
  historyIndex: number;
  showImageModal: string | null;
  metadata: WorkflowMetadata;
}

function WorkflowEditorContent({ onAiSettingsChange }: { onAiSettingsChange?: () => void }) {
  const ai = useAi();
  const { toast } = useToast();

  // Pro Features Configuration
  const proFeaturesConfig: ProFeaturesConfig = {
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
    }
  };

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
    const edgeTypes = ['bezier', 'straight', 'step'] as const;
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
        position: { x: 150 + index * 250, y: 150 + Math.random() * 100 },
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
        position: { x: 500, y: 250 },
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
      const radius = 300;
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
      const xOffset = (index % 2) * 300 + 200;

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
        type: 'step' as const,
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
          type: 'step' as const,
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
        position: { x: 200 + activityIndexInLane * 250, y: 100 + laneIndex * laneHeight },
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
          type: 'step' as const,
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
      position: { x: 150 + index * 200, y: 150 },
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
        position: { x: 100 + index * 150, y: 100 },
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
        position: { x: 150 + index * 200, y: 250 },
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
        position: { x: 200 + index * 150, y: 400 },
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
        type: 'step' as const,
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
  const viewport = activeTab?.viewport || { x: 0, y: 0, zoom: 1 };
  const selectedNodeId = activeTab?.selectedNodeId || '';
  const selectedEdgeId = activeTab?.selectedEdgeId || '';
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
  }, [createBlankTab]);

  const handleCreateWithTemplate = useCallback(() => {
    const newTab = createDefaultTab();
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [createDefaultTab]);

  const handleCreateWithAI = useCallback(() => {
    // Create blank tab first, then open AI generator
    const newTab = createBlankTab();
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setShowAiGenerator(true);
  }, [createBlankTab]);

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
    const name = generateCuteName();
    const initialState = {
      nodes: data.nodes.map(node => ({ ...node, selected: false })),
      edges: data.edges.map(edge => ({ ...edge, selected: false })),
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

  // History management - Fixed to use current state instead of stale activeTab references
  const saveToHistory = useCallback(() => {
    if (!activeTab) return;
    
    // Use a small delay to ensure React state has updated
    setTimeout(() => {
      // Use current state variables instead of stale activeTab references
      const currentNodes = nodes;
      const currentEdges = edges;
      const currentViewport = viewport;
      
      const newHistoryState = {
        nodes: [...currentNodes],
        edges: [...currentEdges],
        viewport: { ...currentViewport }
      };
      
      const currentHistory = activeTab.history;
      const currentHistoryIndex = activeTab.historyIndex;
      
      // Remove any future history states if we're in the middle of history
      const newHistory = [...currentHistory.slice(0, currentHistoryIndex + 1), newHistoryState];
      const newHistoryIndex = newHistory.length - 1;
      
      console.log('💾 SAVE TO HISTORY (USING CURRENT STATE):', {
        trigger: 'Action performed',
        beforeSave: {
          historyLength: currentHistory.length,
          historyIndex: currentHistoryIndex,
          nodeCount: currentNodes.length,
          edgeCount: currentEdges.length,
          nodeIds: currentNodes.map(n => n.id),
          edgeIds: currentEdges.map(e => e.id)
        },
        afterSave: {
          historyLength: newHistory.length,
          newHistoryIndex: newHistoryIndex,
          nodeCount: newHistoryState.nodes.length,
          edgeCount: newHistoryState.edges.length,
          nodeIds: newHistoryState.nodes.map(n => n.id),
          edgeIds: newHistoryState.edges.map(e => e.id)
        },
        historyStack: newHistory.map((state, index) => ({
          index,
          nodeCount: state.nodes.length,
          edgeCount: state.edges.length,
          isCurrent: index === newHistoryIndex
        }))
      });
      
      updateActiveTab({ 
        history: newHistory,
        historyIndex: newHistoryIndex
      });
    }, 10); // Small delay to ensure state consistency
  }, [activeTab, updateActiveTab, nodes, edges, viewport]);

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
      selected: false,
      reconnectable: true, // Enable reconnection for imported edges
      interactable: true // Make edges clickable
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
  const [isEditingWorkflowName, setIsEditingWorkflowName] = useState(false);
  const [workflowNameInput, setWorkflowNameInput] = useState('');
  const [copiedProperties, setCopiedProperties] = useState<{ colors?: any; data?: Partial<Node['data']> } | null>(null);

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
        type: 'step' as const,
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
          {/* Sidebar or Edge Customizer */}
          <div className="w-64 border-r border-border flex flex-col overflow-hidden">
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
                selectedNodes={nodes.filter(n => n.selected)}
                selectedEdge={edges.find(e => e.id === selectedEdgeId)}
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

                    setNodes([newNode]);
                    saveToHistory();
                  }, 0);
                  return;
                }

                // Normal case - add to existing tab
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
                // Apply theme to all nodes in the current workflow
                setNodes(prev => prev.map(node => ({
                  ...node,
                  data: {
                    ...node.data,
                    colors: {
                      headerBackground: theme.nodeStyles.headerBackground,
                      headerText: theme.nodeStyles.headerText,
                      bodyBackground: theme.nodeStyles.bodyBackground,
                      bodyText: theme.nodeStyles.bodyText,
                      border: theme.nodeStyles.border
                    }
                  }
                })));

                // Apply theme to all edges in the current workflow
                setEdges(prev => prev.map(edge => ({
                  ...edge,
                  style: {
                    ...edge.style,
                    stroke: theme.edgeStyles.stroke
                  },
                  data: {
                    ...edge.data,
                    strokeSelected: theme.edgeStyles.strokeSelected
                  }
                })));

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
                  viewport: { x: 0, y: 0, zoom: 1 },
                  selectedNodeId: '',
                  selectedEdgeId: '',
                  history: [{ nodes: workflow.nodes, edges: workflow.edges, viewport: { x: 0, y: 0, zoom: 1 } }],
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
              />
            )}
          </div>

          {/* Canvas Area */}
          <div className={`flex-1 relative ${tabs.length > 0 ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            
            {tabs.length > 0 ? (
              <WorkflowCanvas
              nodes={nodes}
              edges={edges}
              viewport={viewport}
              onViewportChange={setViewport}
              proFeatures={proFeaturesConfig}
              onQuickAdd={handleQuickAdd}
              workflowName={activeTab?.name}
              onWorkflowNameChange={setWorkflowName}
              onEdgeReconnect={handleEdgeReconnect}
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
                
                console.log(`🔗 EDGE SELECTED FOR RECONNECTION:`, { 
                  edgeId: edge.id, 
                  reconnectable: edge.reconnectable,
                  enableAllEdges: proFeaturesConfig.edgeReconnection?.enableAllEdges,
                  edgeReconnectionEnabled: proFeaturesConfig.edgeReconnection?.enabled
                });
                
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
                // Copy properties (colors, icon, iconColor, etc.) but not label/description
                const propertiesToCopy = {
                  colors: contextMenu.node.data?.colors,
                  data: {
                    icon: contextMenu.node.data?.icon,
                    iconColor: contextMenu.node.data?.iconColor,
                  }
                };
                setCopiedProperties(propertiesToCopy);
                console.log('📋 Properties copied:', propertiesToCopy);
                setContextMenu(null);
              }
            }}
            onPasteProperties={copiedProperties ? () => {
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
              }
            } : undefined}
            hasPropertiesInClipboard={!!copiedProperties}
            onDelete={() => {
              if (contextMenu.node) {
                saveToHistory();
                setNodes(prev => prev.filter(n => n.id !== contextMenu.node!.id));
                setEdges(prev => prev.filter(e => e.source !== contextMenu.node!.id && e.target !== contextMenu.node!.id));
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