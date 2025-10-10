import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KiteFrameCanvas, type Node, type Edge } from "@/lib/kiteframe";
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
  Book
} from "lucide-react";
import kiteframeLogo from "@assets/kiteframe@2x_1758226635607.png";

export default function KitelineDemo() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Sample nodes for the interactive demo
  const [demoNodes, setDemoNodes] = useState<Node[]>([
    {
      id: "1",
      type: "basic",
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
      style: { width: 200, height: 100 }
    },
    {
      id: "2",
      type: "basic",
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
      style: { width: 200, height: 100 }
    },
    {
      id: "3",
      type: "basic",
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
      style: { width: 200, height: 100 }
    },
    {
      id: "4",
      type: "basic",
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
      style: { width: 200, height: 100 }
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
      language: "bash"
    },
    {
      title: "Quick Start",
      code: `import { KiteFrameCanvas } from '@kiteline/core';
import type { Node, Edge } from '@kiteline/core';

function MyWorkflow() {
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: '1',
      type: 'basic',
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
      language: "tsx"
    },
    {
      title: "Node API",
      code: `// Create a custom node
const customNode: Node = {
  id: 'node-1',
  type: 'basic',
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
      language: "typescript"
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
    fontColor: '#374151',
    backgroundColor: '#ffffff'
  },
  markerEnd: {
    type: 'arrow',
    size: 8,
    color: '#3b82f6'
  }
};`,
      language: "typescript"
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
      language: "typescript"
    }
  ];

  const copyToClipboard = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
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
              <Button size="lg" variant="outline" data-testid="button-view-docs">
                <Book className="mr-2" />
                Documentation
              </Button>
              <Button size="lg" variant="outline" data-testid="button-github">
                <Github className="mr-2" />
                GitHub
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
            />
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl" data-testid={`text-code-title-${index}`}>
                      <Code className="inline-block w-5 h-5 mr-2" />
                      {example.title}
                    </CardTitle>
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
                </CardHeader>
                <CardContent>
                  <pre 
                    className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm"
                    data-testid={`code-example-${index}`}
                  >
                    <code>{example.code}</code>
                  </pre>
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
                <li><a href="#" className="hover:text-white transition-colors" data-testid="link-github">GitHub</a></li>
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
