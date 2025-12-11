import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KiteFrameCanvas, type Node, type Edge } from "@/lib/kiteframe";
import { ZoomControls } from "@/lib/kiteframe/components/ZoomControls";
import { 
  Copy, 
  Check, 
  Workflow, 
  Shapes, 
  GitBranch, 
  Layout, 
  RotateCcw, 
  Plug, 
  Shield, 
  Download,
  Code,
  Zap,
  Github,
  Book,
  Eye,
  Settings,
  Plus
} from "lucide-react";
import kiteframeLogo from "@assets/kiteframe@2x_1758226635607.png";

export default function KitelineDemo() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // State for demo canvases
  const [quickStartDemoNodes, setQuickStartDemoNodes] = useState<Node[]>([]);
  const [quickStartDemoEdges, setQuickStartDemoEdges] = useState<Edge[]>([]);
  const [quickStartViewport, setQuickStartViewport] = useState({ x: 0, y: 0, zoom: 1 });
  
  const [nodeApiDemoNodes, setNodeApiDemoNodes] = useState<Node[]>([]);
  const [nodeApiDemoEdges, setNodeApiDemoEdges] = useState<Edge[]>([]);
  const [nodeApiViewport, setNodeApiViewport] = useState({ x: 0, y: 0, zoom: 1 });
  
  const [edgeApiDemoNodes, setEdgeApiDemoNodes] = useState<Node[]>([]);
  const [edgeApiDemoEdges, setEdgeApiDemoEdges] = useState<Edge[]>([]);
  const [edgeApiViewport, setEdgeApiViewport] = useState({ x: 0, y: 0, zoom: 1 });

  // Hero demo viewport
  const [heroViewport, setHeroViewport] = useState({ x: 0, y: 0, zoom: 1 });

  // Initialize demo canvas data
  useEffect(() => {
    // Quick Start demo
    setQuickStartDemoNodes([
      {
        id: '1',
        type: 'process',
        position: { x: 150, y: 80 },
        data: { 
          label: 'Start Node',
          colors: {
            headerBackground: '#3b82f6',
            bodyBackground: '#eff6ff',
            borderColor: '#3b82f6',
            headerTextColor: '#ffffff',
            bodyTextColor: '#1e40af'
          }
        },
        style: { width: 180, height: 80 }
      }
    ]);
    
    // Node API demo
    setNodeApiDemoNodes([
      {
        id: 'node-1',
        type: 'process',
        position: { x: 120, y: 70 },
        data: {
          label: 'My Node',
          description: 'Node description',
          colors: {
            headerBackground: '#3b82f6',
            bodyBackground: '#eff6ff',
            borderColor: '#3b82f6',
            headerTextColor: '#ffffff',
            bodyTextColor: '#1e40af'
          }
        },
        style: { width: 200, height: 100 },
        draggable: true,
        selectable: true,
        resizable: true
      }
    ]);
    
    // Edge API demo
    setEdgeApiDemoNodes([
      {
        id: 'node-1',
        type: 'process',
        position: { x: 50, y: 70 },
        data: {
          label: 'Source',
          colors: {
            headerBackground: '#3b82f6',
            bodyBackground: '#eff6ff',
            borderColor: '#3b82f6',
            headerTextColor: '#ffffff',
            bodyTextColor: '#1e40af'
          }
        },
        style: { width: 140, height: 80 }
      },
      {
        id: 'node-2',
        type: 'process',
        position: { x: 430, y: 70 },
        data: {
          label: 'Target',
          colors: {
            headerBackground: '#8b5cf6',
            bodyBackground: '#f5f3ff',
            borderColor: '#8b5cf6',
            headerTextColor: '#ffffff',
            bodyTextColor: '#6b21a8'
          }
        },
        style: { width: 140, height: 80 }
      }
    ]);
    
    setEdgeApiDemoEdges([
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'bezier',
        animated: true,
        label: 'Connection',
        style: {
          strokeWidth: 2,
          stroke: '#3b82f6'
        },
        labelStyle: {
          fontSize: 12,
          color: '#374151',
          backgroundColor: '#ffffff'
        },
        markerEnd: {
          type: 'arrow',
          size: 8,
          color: '#3b82f6'
        }
      }
    ]);
  }, []);

  // Sample nodes for the interactive demo
  const [demoNodes, setDemoNodes] = useState<Node[]>([
    {
      id: "1",
      type: "process",
      position: { x: 100, y: 100 },
      data: { 
        label: "Start",
        description: "Begin your workflow",
        colors: {
          headerBackground: "#3b82f6",
          bodyBackground: "#eff6ff",
          borderColor: "#3b82f6",
          headerTextColor: "#ffffff",
          bodyTextColor: "#1e40af"
        }
      },
      width: 200, 
      height: 100
    },
    {
      id: "2",
      type: "process",
      position: { x: 400, y: 80 },
      data: { 
        label: "Process",
        description: "Handle the data",
        colors: {
          headerBackground: "#8b5cf6",
          bodyBackground: "#f5f3ff",
          borderColor: "#8b5cf6",
          headerTextColor: "#ffffff",
          bodyTextColor: "#6b21a8"
        }
      },
      width: 200, 
      height: 100
    },
    {
      id: "3",
      type: "process",
      position: { x: 700, y: 100 },
      data: { 
        label: "Validate",
        description: "Check results",
        colors: {
          headerBackground: "#ec4899",
          bodyBackground: "#fdf2f8",
          borderColor: "#ec4899",
          headerTextColor: "#ffffff",
          bodyTextColor: "#9f1239"
        }
      },
      width: 200, 
      height: 100
    },
    {
      id: "4",
      type: "process",
      position: { x: 400, y: 280 },
      data: { 
        label: "Complete",
        description: "Finish workflow",
        colors: {
          headerBackground: "#10b981",
          bodyBackground: "#ecfdf5",
          borderColor: "#10b981",
          headerTextColor: "#ffffff",
          bodyTextColor: "#065f46"
        }
      },
      width: 200, 
      height: 100
    }
  ]);

  const [demoEdges, setDemoEdges] = useState<Edge[]>([
    {
      id: "e1-2",
      source: "1",
      target: "2",
      type: "bezier",
      animated: true,
      style: { strokeWidth: 2, stroke: "#3b82f6" }
    },
    {
      id: "e2-3",
      source: "2",
      target: "3",
      type: "bezier",
      animated: true,
      style: { strokeWidth: 2, stroke: "#8b5cf6" }
    },
    {
      id: "e3-4",
      source: "3",
      target: "4",
      type: "bezier",
      animated: true,
      style: { strokeWidth: 2, stroke: "#ec4899" }
    }
  ]);

  const features = [
    {
      icon: <Workflow className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
      title: "Interactive Canvas",
      description: "Drag, drop, and connect nodes with smooth animations and intuitive controls."
    },
    {
      icon: <Shapes className="w-8 h-8 text-purple-600 dark:text-purple-400" />,
      title: "Rich Nodes",
      description: "Customizable nodes with colors, styles, and support for images and custom content."
    },
    {
      icon: <GitBranch className="w-8 h-8 text-pink-600 dark:text-pink-400" />,
      title: "Flexible Edges",
      description: "Multiple edge types including bezier, straight, step, and animated connections."
    },
    {
      icon: <Layout className="w-8 h-8 text-green-600 dark:text-green-400" />,
      title: "Auto Layouts",
      description: "Smart alignment, snapping, and automatic layout algorithms for clean diagrams."
    },
    {
      icon: <RotateCcw className="w-8 h-8 text-orange-600 dark:text-orange-400" />,
      title: "Undo/Redo",
      description: "Built-in command history with keyboard shortcuts for seamless editing."
    },
    {
      icon: <Plug className="w-8 h-8 text-teal-600 dark:text-teal-400" />,
      title: "Plugin System",
      description: "Extensible architecture with hooks for custom functionality and integrations."
    },
    {
      icon: <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />,
      title: "Enterprise Security",
      description: "Rate limiting, input validation, CSP management, and security monitoring."
    },
    {
      icon: <Download className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />,
      title: "Import/Export",
      description: "Save and load workflows with JSON export/import and version compatibility."
    }
  ];

  const codeExamples = [
    {
      title: "Installation",
      code: `npm install @kiteline/core
# or
yarn add @kiteline/core
# or
pnpm add @kiteline/core`,
      language: "bash",
      hasDemo: false,
      hasProperties: false
    },
    {
      title: "Quick Start",
      code: `import { KiteFrameCanvas } from '@kiteline/core';
import type { Node, Edge } from '@kiteline/core';

function MyWorkflow() {
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: '1',
      type: 'process',
      position: { x: 100, y: 100 },
      data: { label: 'Start Node' }
    }
  ]);
  
  const [edges, setEdges] = useState<Edge[]>([]);

  return (
    <KiteFrameCanvas
      nodes={nodes}
      edges={edges}
      onNodesChange={setNodes}
      onEdgesChange={setEdges}
    />
  );
}`,
      language: "tsx",
      hasDemo: true,
      demoNodes: [
        {
          id: '1',
          type: 'process',
          position: { x: 150, y: 80 },
          data: { 
            label: 'Start Node',
            colors: {
              headerBackground: '#3b82f6',
              bodyBackground: '#eff6ff',
              borderColor: '#3b82f6',
              headerTextColor: '#ffffff',
              bodyTextColor: '#1e40af'
            }
          },
          style: { width: 180, height: 80 }
        }
      ],
      demoEdges: [],
      hasProperties: true,
      properties: [
        { name: 'nodes', type: 'Node[]', description: 'Array of node objects to render on the canvas' },
        { name: 'edges', type: 'Edge[]', description: 'Array of edge objects connecting nodes' },
        { name: 'onNodesChange', type: '(nodes: Node[]) => void', description: 'Callback when nodes are updated' },
        { name: 'onEdgesChange', type: '(edges: Edge[]) => void', description: 'Callback when edges are updated' }
      ]
    },
    {
      title: "Node API",
      code: `// Create a custom node
const customNode: Node = {
  id: 'node-1',
  type: 'process',
  position: { x: 100, y: 100 },
  data: {
    label: 'My Node',
    description: 'Node description',
    colors: {
      headerBackground: '#3b82f6',
      bodyBackground: '#eff6ff',
      borderColor: '#3b82f6',
      headerTextColor: '#ffffff'
    }
  },
  style: { width: 200, height: 100 },
  draggable: true,
  selectable: true,
  resizable: true
};`,
      language: "typescript",
      hasDemo: true,
      demoNodes: [
        {
          id: 'node-1',
          type: 'process',
          position: { x: 120, y: 70 },
          data: {
            label: 'My Node',
            description: 'Node description',
            colors: {
              headerBackground: '#3b82f6',
              bodyBackground: '#eff6ff',
              borderColor: '#3b82f6',
              headerTextColor: '#ffffff',
              bodyTextColor: '#1e40af'
            }
          },
          width: 200, 
          height: 100,
          draggable: true,
          selectable: true,
          resizable: true
        }
      ],
      demoEdges: [],
      hasProperties: true,
      properties: [
        { name: 'id', type: 'string', description: 'Unique identifier for the node' },
        { name: 'type', type: 'string', description: 'Node type: "process", "input", "output", "ai", "image", etc.' },
        { name: 'position', type: '{ x: number, y: number }', description: 'Node position on canvas' },
        { name: 'data.label', type: 'string', description: 'Primary text displayed in node header' },
        { name: 'data.description', type: 'string', description: 'Secondary text displayed in node body' },
        { name: 'data.colors.headerBackground', type: 'string', description: 'Header background color (hex)' },
        { name: 'data.colors.bodyBackground', type: 'string', description: 'Body background color (hex)' },
        { name: 'data.colors.borderColor', type: 'string', description: 'Border color (hex)' },
        { name: 'data.colors.headerTextColor', type: 'string', description: 'Header text color (hex)' },
        { name: 'data.colors.bodyTextColor', type: 'string', description: 'Body text color (hex)' },
        { name: 'style.width', type: 'number', description: 'Node width in pixels' },
        { name: 'style.height', type: 'number', description: 'Node height in pixels' },
        { name: 'draggable', type: 'boolean', description: 'Whether node can be dragged (default: true)' },
        { name: 'selectable', type: 'boolean', description: 'Whether node can be selected (default: true)' },
        { name: 'resizable', type: 'boolean', description: 'Whether node can be resized (default: true)' },
        { name: 'hidden', type: 'boolean', description: 'Whether node is hidden (default: false)' }
      ]
    },
    {
      title: "Edge API",
      code: `// Create a custom edge
const customEdge: Edge = {
  id: 'edge-1',
  source: 'node-1',
  target: 'node-2',
  type: 'bezier',
  animated: true,
  label: 'Connection',
  style: {
    strokeWidth: 2,
    stroke: '#3b82f6'
  },
  labelStyle: {
    fontSize: 12,
    color: '#374151',
    backgroundColor: '#ffffff'
  },
  markerEnd: {
    type: 'arrow',
    size: 8,
    color: '#3b82f6'
  }
};`,
      language: "typescript",
      hasDemo: true,
      demoNodes: [
        {
          id: 'node-1',
          type: 'process',
          position: { x: 50, y: 70 },
          data: {
            label: 'Source',
            colors: {
              headerBackground: '#3b82f6',
              bodyBackground: '#eff6ff',
              borderColor: '#3b82f6',
              headerTextColor: '#ffffff',
              bodyTextColor: '#1e40af'
            }
          },
          style: { width: 140, height: 80 }
        },
        {
          id: 'node-2',
          type: 'process',
          position: { x: 430, y: 70 },
          data: {
            label: 'Target',
            colors: {
              headerBackground: '#8b5cf6',
              bodyBackground: '#f5f3ff',
              borderColor: '#8b5cf6',
              headerTextColor: '#ffffff',
              bodyTextColor: '#6b21a8'
            }
          },
          style: { width: 140, height: 80 }
        }
      ],
      demoEdges: [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          type: 'bezier' as const,
          animated: true,
          label: 'Connection',
          style: {
            strokeWidth: 2,
            stroke: '#3b82f6'
          },
          labelStyle: {
            fontSize: 12,
            color: '#374151',
            backgroundColor: '#ffffff'
          },
          markerEnd: {
            type: 'arrow' as const,
            size: 8,
            color: '#3b82f6'
          }
        }
      ] as Edge[],
      hasProperties: true,
      properties: [
        { name: 'id', type: 'string', description: 'Unique identifier for the edge' },
        { name: 'source', type: 'string', description: 'ID of the source node' },
        { name: 'target', type: 'string', description: 'ID of the target node' },
        { name: 'type', type: 'string', description: 'Edge type: "bezier", "straight", "step", "curved", "orthogonal", "smoothstep"' },
        { name: 'animated', type: 'boolean', description: 'Whether edge is animated (default: false)' },
        { name: 'label', type: 'string', description: 'Text label displayed on edge' },
        { name: 'style.strokeWidth', type: 'number', description: 'Edge line thickness in pixels' },
        { name: 'style.stroke', type: 'string', description: 'Edge line color (hex)' },
        { name: 'style.strokeDasharray', type: 'string', description: 'Dash pattern (e.g., "5,5")' },
        { name: 'labelStyle.fontSize', type: 'number', description: 'Label font size in pixels' },
        { name: 'labelStyle.color', type: 'string', description: 'Label text color (hex)' },
        { name: 'labelStyle.backgroundColor', type: 'string', description: 'Label background color (hex)' },
        { name: 'markerEnd.type', type: 'string', description: 'End marker type: "arrow", "circle", "square", "diamond", "triangle"' },
        { name: 'markerEnd.size', type: 'number', description: 'End marker size in pixels' },
        { name: 'markerEnd.color', type: 'string', description: 'End marker color (hex)' },
        { name: 'markerStart', type: 'object', description: 'Start marker configuration (same as markerEnd)' },
        { name: 'hidden', type: 'boolean', description: 'Whether edge is hidden (default: false)' }
      ]
    },
    {
      title: "Plugin System",
      code: `import { kiteFrameCore, createPlugin } from '@kiteline/core';

// Create a custom plugin
const myPlugin = createPlugin({
  name: 'my-custom-plugin',
  version: '1.0.0',
  initialize: (core) => {
    console.log('Plugin initialized!');
    
    // Add custom behavior
    core.on('nodeClick', (node) => {
      console.log('Node clicked:', node);
    });
  },
  cleanup: () => {
    console.log('Plugin cleaned up');
  }
});

// Register the plugin
kiteFrameCore.installPlugin(myPlugin);`,
      language: "typescript",
      hasDemo: false,
      hasProperties: false
    }
  ];

  const copyToClipboard = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Helper function to add a new node at the center of the viewport
  const addNewNode = (
    nodes: Node[],
    setNodes: (nodes: Node[]) => void,
    viewport: { x: number; y: number; zoom: number },
    canvasWidth = 800,
    canvasHeight = 500
  ) => {
    // Calculate the center of the viewport in world coordinates
    const centerX = (canvasWidth / 2 - viewport.x) / viewport.zoom;
    const centerY = (canvasHeight / 2 - viewport.y) / viewport.zoom;

    // Generate a unique ID
    const newId = `node-${Date.now()}`;

    const newNode: Node = {
      id: newId,
      type: 'process',
      position: { x: centerX - 100, y: centerY - 50 }, // Center the node (200x100)
      data: {
        label: 'New Node',
        description: 'Click to edit',
        colors: {
          headerBackground: '#10b981',
          bodyBackground: '#ecfdf5',
          borderColor: '#10b981',
          headerTextColor: '#ffffff',
          bodyTextColor: '#065f46'
        }
      },
      style: { width: 200, height: 100 },
      draggable: true,
      selectable: true,
      resizable: true
    };

    setNodes([...nodes, newNode]);
  };

  // Zoom control functions
  const createZoomHandlers = (viewport: typeof quickStartViewport, setViewport: typeof setQuickStartViewport, nodes: Node[]) => {
    const handleZoomIn = () => {
      setViewport(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 2) }));
    };

    const handleZoomOut = () => {
      setViewport(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.1) }));
    };

    const handleZoomReset = () => {
      setViewport({ x: 0, y: 0, zoom: 1 });
    };

    const handleZoomToFit = () => {
      if (nodes.length === 0) return;
      
      // Calculate bounding box of all nodes
      const padding = 50;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      nodes.forEach(node => {
        const width = node.style?.width || 200;
        const height = node.style?.height || 100;
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + width);
        maxY = Math.max(maxY, node.position.y + height);
      });

      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      const canvasWidth = 450; // approximate canvas width
      const canvasHeight = 250; // approximate canvas height

      const zoomX = (canvasWidth - 2 * padding) / contentWidth;
      const zoomY = (canvasHeight - 2 * padding) / contentHeight;
      const zoom = Math.min(zoomX, zoomY, 1);

      const x = (canvasWidth - (minX + contentWidth / 2) * zoom) / 2;
      const y = (canvasHeight - (minY + contentHeight / 2) * zoom) / 2;

      setViewport({ x, y, zoom });
    };

    return { handleZoomIn, handleZoomOut, handleZoomReset, handleZoomToFit };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-4 overflow-hidden" data-testid="section-hero">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <img 
              src={kiteframeLogo} 
              alt="Kiteline Logo" 
              className="w-24 h-24 mx-auto mb-6"
              data-testid="img-logo"
            />
            <h1 
              className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 mb-4"
              data-testid="text-hero-title"
            >
              Kiteline Canvas
            </h1>
            <p 
              className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8"
              data-testid="text-hero-tagline"
            >
              Build powerful workflow diagrams and interactive node-based editors with ease. 
              Enterprise-grade features, developer-friendly API.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" data-testid="button-get-started">
                <Zap className="mr-2" />
                Get Started
              </Button>
              <Button size="lg" variant="outline" data-testid="button-view-docs" asChild>
                <a href="/docs">
                  <Book className="mr-2" />
                  Documentation
                </a>
              </Button>
              <Button size="lg" variant="outline" data-testid="button-github" asChild>
                <a href="https://github.com/KiteSpace/Kiteline.git" target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2" />
                  GitHub
                </a>
              </Button>
            </div>
          </div>

          {/* Interactive Demo Canvas */}
          <div 
            className="relative rounded-xl overflow-hidden shadow-2xl border-2 border-gray-200 dark:border-gray-700"
            style={{ height: "500px" }}
            data-testid="container-demo-canvas"
          >
            <KiteFrameCanvas
              nodes={demoNodes}
              edges={demoEdges}
              onNodesChange={setDemoNodes}
              onEdgesChange={setDemoEdges}
              viewport={heroViewport}
              onViewportChange={setHeroViewport}
              disableWheelZoom={true}
              proFeatures={{
                quickAdd: { enabled: false }
              }}
            />
            {/* New Node Button */}
            <div className="absolute top-4 right-4 z-10">
              <Button
                size="sm"
                onClick={() => addNewNode(demoNodes, setDemoNodes, heroViewport, 800, 500)}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-lg"
                data-testid="button-new-node-hero"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Node
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-white/50 dark:bg-gray-800/50" data-testid="section-features">
        <div className="max-w-7xl mx-auto">
          <h2 
            className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-gray-100"
            data-testid="text-features-title"
          >
            Powerful Features
          </h2>
          <p 
            className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto"
            data-testid="text-features-subtitle"
          >
            Everything you need to build professional workflow diagrams and interactive canvas applications
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="hover:shadow-lg transition-shadow"
                data-testid={`card-feature-${index}`}
              >
                <CardHeader>
                  <div className="mb-4" data-testid={`icon-feature-${index}`}>
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg" data-testid={`text-feature-title-${index}`}>
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription data-testid={`text-feature-description-${index}`}>
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Code Examples */}
      <section className="py-20 px-4" data-testid="section-code-examples">
        <div className="max-w-6xl mx-auto">
          <h2 
            className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-gray-100"
            data-testid="text-examples-title"
          >
            Quick to Get Started
          </h2>
          <p 
            className="text-center text-gray-600 dark:text-gray-400 mb-12"
            data-testid="text-examples-subtitle"
          >
            Simple API with TypeScript support out of the box
          </p>

          <div className="space-y-6">
            {codeExamples.map((example, index) => (
              <Card key={index} data-testid={`card-code-example-${index}`}>
                <CardHeader>
                  <CardTitle className="text-xl" data-testid={`text-code-title-${index}`}>
                    <Code className="inline-block w-5 h-5 mr-2" />
                    {example.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!example.hasDemo && !example.hasProperties ? (
                    // Simple code-only display for Installation
                    <>
                      <div className="flex justify-end mb-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(example.code, index)}
                          data-testid={`button-copy-code-${index}`}
                        >
                          {copiedIndex === index ? (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 mr-2" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <pre 
                        className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm"
                        data-testid={`code-example-${index}`}
                      >
                        <code>{example.code}</code>
                      </pre>
                    </>
                  ) : (
                    // Tabs for examples with demo/properties
                    <Tabs defaultValue="code" className="w-full">
                      <TabsList className="grid w-full" style={{ gridTemplateColumns: example.hasDemo && example.hasProperties ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)' }}>
                        <TabsTrigger value="code" data-testid={`tab-code-${index}`}>
                          <Code className="w-4 h-4 mr-2" />
                          Code
                        </TabsTrigger>
                        {example.hasDemo && (
                          <TabsTrigger value="demo" data-testid={`tab-demo-${index}`}>
                            <Eye className="w-4 h-4 mr-2" />
                            Demo
                          </TabsTrigger>
                        )}
                        {example.hasProperties && (
                          <TabsTrigger value="properties" data-testid={`tab-properties-${index}`}>
                            <Settings className="w-4 h-4 mr-2" />
                            Properties
                          </TabsTrigger>
                        )}
                      </TabsList>
                      
                      <TabsContent value="code" className="mt-4">
                        <div className="flex justify-end mb-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(example.code, index)}
                            data-testid={`button-copy-code-${index}`}
                          >
                            {copiedIndex === index ? (
                              <>
                                <Check className="w-4 h-4 mr-2" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4 mr-2" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <pre 
                          className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm"
                          data-testid={`code-example-${index}`}
                        >
                          <code>{example.code}</code>
                        </pre>
                      </TabsContent>

                    {example.hasDemo && example.demoNodes && (
                      <TabsContent value="demo" className="mt-4">
                        <div 
                          className="relative rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                          style={{ height: example.title === "Node API" || example.title === "Edge API" ? "600px" : "250px" }}
                          data-testid={`demo-canvas-${index}`}
                        >
                          <KiteFrameCanvas
                            nodes={
                              example.title === "Quick Start" ? quickStartDemoNodes :
                              example.title === "Node API" ? nodeApiDemoNodes :
                              example.title === "Edge API" ? edgeApiDemoNodes :
                              []
                            }
                            edges={
                              example.title === "Quick Start" ? quickStartDemoEdges :
                              example.title === "Node API" ? nodeApiDemoEdges :
                              example.title === "Edge API" ? edgeApiDemoEdges :
                              []
                            }
                            onNodesChange={
                              example.title === "Quick Start" ? setQuickStartDemoNodes :
                              example.title === "Node API" ? setNodeApiDemoNodes :
                              example.title === "Edge API" ? setEdgeApiDemoNodes :
                              () => {}
                            }
                            onEdgesChange={
                              example.title === "Quick Start" ? setQuickStartDemoEdges :
                              example.title === "Node API" ? setNodeApiDemoEdges :
                              example.title === "Edge API" ? setEdgeApiDemoEdges :
                              () => {}
                            }
                            viewport={
                              example.title === "Quick Start" ? quickStartViewport :
                              example.title === "Node API" ? nodeApiViewport :
                              example.title === "Edge API" ? edgeApiViewport :
                              { x: 0, y: 0, zoom: 1 }
                            }
                            onViewportChange={
                              example.title === "Quick Start" ? setQuickStartViewport :
                              example.title === "Node API" ? setNodeApiViewport :
                              example.title === "Edge API" ? setEdgeApiViewport :
                              () => {}
                            }
                            proFeatures={{
                              quickAdd: { enabled: false }
                            }}
                          />
                          {(() => {
                            const viewport = example.title === "Quick Start" ? quickStartViewport :
                                           example.title === "Node API" ? nodeApiViewport :
                                           example.title === "Edge API" ? edgeApiViewport :
                                           { x: 0, y: 0, zoom: 1 };
                            const nodes = example.title === "Quick Start" ? quickStartDemoNodes :
                                        example.title === "Node API" ? nodeApiDemoNodes :
                                        example.title === "Edge API" ? edgeApiDemoNodes : [];
                            const edges = example.title === "Edge API" ? edgeApiDemoEdges : [];
                            const setNodes = example.title === "Quick Start" ? setQuickStartDemoNodes :
                                           example.title === "Node API" ? setNodeApiDemoNodes :
                                           example.title === "Edge API" ? setEdgeApiDemoNodes :
                                           () => {};
                            const setEdges = example.title === "Edge API" ? setEdgeApiDemoEdges : () => {};
                            const setViewport = example.title === "Quick Start" ? setQuickStartViewport :
                                              example.title === "Node API" ? setNodeApiViewport :
                                              example.title === "Edge API" ? setEdgeApiViewport :
                                              () => {};
                            const { handleZoomIn, handleZoomOut, handleZoomReset, handleZoomToFit } = createZoomHandlers(viewport, setViewport, nodes);
                            
                            return (
                              <>
                                {/* New Node Button */}
                                <div className={`absolute top-4 z-10 ${(example.title === "Node API" || example.title === "Edge API") ? 'left-4' : 'right-4'}`}>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      const canvasHeight = example.title === "Node API" || example.title === "Edge API" ? 600 : 250;
                                      addNewNode(nodes, setNodes, viewport, 450, canvasHeight);
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-lg"
                                    data-testid={`button-new-node-${example.title.toLowerCase().replace(/ /g, '-')}`}
                                  >
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Node
                                  </Button>
                                </div>

                                <ZoomControls
                                  zoom={viewport.zoom}
                                  onZoomIn={handleZoomIn}
                                  onZoomOut={handleZoomOut}
                                  onZoomReset={handleZoomReset}
                                  onZoomToFit={handleZoomToFit}
                                  position="bottom-right"
                                  className="dark:bg-gray-800 dark:border-gray-600"
                                />
                                
                                {/* Floating Property Editor */}
                                {(example.title === "Node API" || example.title === "Edge API") && (
                                  <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-xs z-10 pointer-events-auto">
                                    <h3 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">
                                      <Settings className="inline w-4 h-4 mr-1" />
                                      Edit Properties
                                    </h3>
                                    <div className="space-y-3 pointer-events-auto">
                                      {example.title === "Node API" && nodes[0] && (
                                        <>
                                          <div>
                                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Label</label>
                                            <input
                                              type="text"
                                              value={nodes[0].data.label || ''}
                                              onChange={(e) => setNodes([{ ...nodes[0], data: { ...nodes[0].data, label: e.target.value } }])}
                                              className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Description</label>
                                            <input
                                              type="text"
                                              value={nodes[0].data.description || ''}
                                              onChange={(e) => setNodes([{ ...nodes[0], data: { ...nodes[0].data, description: e.target.value } }])}
                                              className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Header Color</label>
                                            <input
                                              type="color"
                                              value={nodes[0].data.colors?.headerBackground || '#3b82f6'}
                                              onChange={(e) => setNodes([{ 
                                                ...nodes[0], 
                                                data: { 
                                                  ...nodes[0].data, 
                                                  colors: { ...nodes[0].data.colors, headerBackground: e.target.value }
                                                }
                                              }])}
                                              className="mt-1 w-full h-8 rounded border border-gray-300 dark:border-gray-600"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Body Color</label>
                                            <input
                                              type="color"
                                              value={nodes[0].data.colors?.bodyBackground || '#eff6ff'}
                                              onChange={(e) => setNodes([{ 
                                                ...nodes[0], 
                                                data: { 
                                                  ...nodes[0].data, 
                                                  colors: { ...nodes[0].data.colors, bodyBackground: e.target.value }
                                                }
                                              }])}
                                              className="mt-1 w-full h-8 rounded border border-gray-300 dark:border-gray-600"
                                            />
                                          </div>
                                        </>
                                      )}
                                      
                                      {example.title === "Edge API" && edges[0] && (
                                        <>
                                          <div>
                                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Label</label>
                                            <input
                                              type="text"
                                              value={edges[0].label || ''}
                                              onChange={(e) => setEdges([{ ...edges[0], label: e.target.value }])}
                                              className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                            />
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={edges[0].animated || false}
                                              onChange={(e) => setEdges([{ ...edges[0], animated: e.target.checked }])}
                                              className="w-4 h-4"
                                            />
                                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Animated</label>
                                          </div>
                                          <div>
                                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Stroke Color</label>
                                            <input
                                              type="color"
                                              value={edges[0].style?.stroke || '#3b82f6'}
                                              onChange={(e) => setEdges([{ 
                                                ...edges[0], 
                                                style: { ...edges[0].style, stroke: e.target.value }
                                              }])}
                                              className="mt-1 w-full h-8 rounded border border-gray-300 dark:border-gray-600"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Stroke Width</label>
                                            <input
                                              type="range"
                                              min="1"
                                              max="10"
                                              value={edges[0].style?.strokeWidth || 2}
                                              onChange={(e) => setEdges([{ 
                                                ...edges[0], 
                                                style: { ...edges[0].style, strokeWidth: Number(e.target.value) }
                                              }])}
                                              className="mt-1 w-full"
                                            />
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{edges[0].style?.strokeWidth || 2}px</span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-center">
                          Interactive demo - try dragging nodes! Tip: Option+Scroll to zoom
                        </p>
                      </TabsContent>
                    )}

                    {example.hasProperties && example.properties && (
                      <TabsContent value="properties" className="mt-4">
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-800">
                              <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Property</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Type</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {example.properties.map((prop, propIndex) => (
                                <tr key={propIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800/50" data-testid={`property-row-${index}-${propIndex}`}>
                                  <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">{prop.name}</td>
                                  <td className="px-4 py-3 font-mono text-purple-600 dark:text-purple-400">{prop.type}</td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{prop.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </TabsContent>
                    )}
                  </Tabs>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Getting Started Steps */}
      <section className="py-20 px-4 bg-white/50 dark:bg-gray-800/50" data-testid="section-getting-started">
        <div className="max-w-4xl mx-auto">
          <h2 
            className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-gray-100"
            data-testid="text-steps-title"
          >
            Get Started in 3 Steps
          </h2>
          <p 
            className="text-center text-gray-600 dark:text-gray-400 mb-12"
            data-testid="text-steps-subtitle"
          >
            From installation to your first interactive canvas in minutes
          </p>

          <div className="space-y-8">
            <div className="flex gap-6" data-testid="step-1">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100" data-testid="text-step-1-title">
                  Install the Package
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-3" data-testid="text-step-1-description">
                  Add Kiteline Canvas to your project with your favorite package manager
                </p>
                <div className="bg-gray-900 dark:bg-black text-gray-100 p-3 rounded-lg font-mono text-sm">
                  npm install @kiteline/core
                </div>
              </div>
            </div>

            <div className="flex gap-6" data-testid="step-2">
              <div className="flex-shrink-0 w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100" data-testid="text-step-2-title">
                  Import Components
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-3" data-testid="text-step-2-description">
                  Import the canvas component and TypeScript types
                </p>
                <div className="bg-gray-900 dark:bg-black text-gray-100 p-3 rounded-lg font-mono text-sm">
                  {`import { KiteFrameCanvas } from '@kiteline/core';`}
                  <br />
                  {`import type { Node, Edge } from '@kiteline/core';`}
                </div>
              </div>
            </div>

            <div className="flex gap-6" data-testid="step-3">
              <div className="flex-shrink-0 w-12 h-12 bg-pink-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100" data-testid="text-step-3-title">
                  Build Your Canvas
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-3" data-testid="text-step-3-description">
                  Create nodes and edges, then render your interactive workflow
                </p>
                <div className="bg-gray-900 dark:bg-black text-gray-100 p-3 rounded-lg font-mono text-sm">
                  {`<KiteFrameCanvas`}
                  <br />
                  {`  nodes={nodes}`}
                  <br />
                  {`  edges={edges}`}
                  <br />
                  {`  onNodesChange={setNodes}`}
                  <br />
                  {`  onEdgesChange={setEdges}`}
                  <br />
                  {`/>`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4" data-testid="section-cta">
        <div className="max-w-4xl mx-auto text-center">
          <h2 
            className="text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100"
            data-testid="text-cta-title"
          >
            Ready to Build Something Amazing?
          </h2>
          <p 
            className="text-xl text-gray-600 dark:text-gray-400 mb-8"
            data-testid="text-cta-description"
          >
            Join developers building the next generation of visual workflow tools
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" data-testid="button-cta-primary">
              <Zap className="mr-2" />
              Start Building Now
            </Button>
            <Button size="lg" variant="outline" data-testid="button-cta-secondary">
              <Book className="mr-2" />
              Read the Docs
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-gray-900 text-gray-300" data-testid="section-footer">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div data-testid="footer-about">
              <h3 className="text-lg font-semibold mb-4 text-white" data-testid="text-footer-brand">
                Kiteline Canvas
              </h3>
              <p className="text-sm" data-testid="text-footer-description">
                Professional workflow diagramming and node-based editing for modern web applications.
              </p>
            </div>
            <div data-testid="footer-links">
              <h3 className="text-lg font-semibold mb-4 text-white" data-testid="text-footer-links-title">
                Resources
              </h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors" data-testid="link-documentation">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors" data-testid="link-examples">Examples</a></li>
                <li><a href="#" className="hover:text-white transition-colors" data-testid="link-api">API Reference</a></li>
                <li><a href="#" className="hover:text-white transition-colors" data-testid="link-plugins">Plugins</a></li>
              </ul>
            </div>
            <div data-testid="footer-community">
              <h3 className="text-lg font-semibold mb-4 text-white" data-testid="text-footer-community-title">
                Community
              </h3>
              <ul className="space-y-2 text-sm">
                <li><a href="https://github.com/KiteSpace/Kiteline.git" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" data-testid="link-github">GitHub</a></li>
                <li><a href="#" className="hover:text-white transition-colors" data-testid="link-discord">Discord</a></li>
                <li><a href="#" className="hover:text-white transition-colors" data-testid="link-twitter">Twitter</a></li>
                <li><a href="#" className="hover:text-white transition-colors" data-testid="link-blog">Blog</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm" data-testid="footer-copyright">
            <p data-testid="text-copyright">
              © 2025 Kiteline Canvas. Built with ❤️ for developers.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
