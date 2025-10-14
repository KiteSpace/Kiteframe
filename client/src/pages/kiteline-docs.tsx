import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { KiteFrameCanvas, type Node, type Edge } from "@/lib/kiteframe";
import {
  Book,
  ArrowLeft,
  Home,
  Package,
  Rocket,
  Code2,
  Settings,
  Plug2,
  ChevronRight,
  Terminal,
  FileCode,
  Layers,
  GitBranch,
  Zap,
  Copy,
  Check
} from "lucide-react";
import kiteframeLogo from "@assets/kiteframe@2x_1758226635607.png";

export default function KitelineDocs() {
  const [activeSection, setActiveSection] = useState("getting-started");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Demo nodes and edges for examples
  const [basicDemoNodes, setBasicDemoNodes] = useState<Node[]>([
    {
      id: '1',
      type: 'basic',
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
  const [basicDemoEdges, setBasicDemoEdges] = useState<Edge[]>([]);
  const [basicDemoViewport, setBasicDemoViewport] = useState({ x: 0, y: 0, zoom: 1 });

  const [edgeDemoNodes, setEdgeDemoNodes] = useState<Node[]>([
    {
      id: 'node-1',
      type: 'basic',
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
      type: 'basic',
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
  const [edgeDemoEdges, setEdgeDemoEdges] = useState<Edge[]>([
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
  const [edgeDemoViewport, setEdgeDemoViewport] = useState({ x: 0, y: 0, zoom: 1 });

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const sections = [
    { id: "getting-started", label: "Getting Started", icon: <Rocket className="w-4 h-4" /> },
    { id: "installation", label: "Installation", icon: <Package className="w-4 h-4" /> },
    { id: "basic-usage", label: "Basic Usage", icon: <Code2 className="w-4 h-4" /> },
    { id: "api-reference", label: "API Reference", icon: <FileCode className="w-4 h-4" /> },
    { id: "configuration", label: "Configuration", icon: <Settings className="w-4 h-4" /> },
    { id: "plugins", label: "Plugin System", icon: <Plug2 className="w-4 h-4" /> }
  ];

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700" data-testid="header-docs">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/demo">
              <Button variant="ghost" size="sm" data-testid="button-back-demo">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Demo
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-3">
              <img src={kiteframeLogo} alt="Kiteline" className="w-8 h-8" data-testid="img-logo" />
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100" data-testid="text-title">
                  Kiteline Docs
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="text-version">
                  v1.0.0
                </p>
              </div>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-home">
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-64 shrink-0 sticky top-24 self-start hidden lg:block" data-testid="sidebar-navigation">
          <Card className="bg-white/50 dark:bg-gray-800/50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                <Book className="w-4 h-4 inline mr-2" />
                Contents
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    }`}
                    data-testid={`nav-${section.id}`}
                  >
                    {section.icon}
                    {section.label}
                    {activeSection === section.id && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </aside>

        {/* Main Content */}
        <main className="flex-1 space-y-12" data-testid="main-content">
          {/* Getting Started */}
          <section id="getting-started" className="scroll-mt-24">
            <Card className="bg-white/50 dark:bg-gray-800/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Rocket className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <CardTitle className="text-2xl" data-testid="heading-getting-started">Getting Started</CardTitle>
                </div>
                <CardDescription data-testid="text-getting-started-description">
                  Learn how to set up Kiteline Canvas in your React application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-700 dark:text-gray-300" data-testid="text-intro">
                  Kiteline Canvas is a powerful, extensible React library for building interactive workflow editors, 
                  node-based UIs, and visual programming tools. It provides a rich set of features including drag-and-drop 
                  nodes, flexible edge connections, auto-layouts, undo/redo, and a robust plugin system.
                </p>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                    <Zap className="inline w-4 h-4 mr-2" />
                    Key Features
                  </h4>
                  <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200" data-testid="list-key-features">
                    <li>• Interactive canvas with smooth zoom and pan</li>
                    <li>• Rich node system with 6+ built-in types</li>
                    <li>• Flexible edge system with multiple styles</li>
                    <li>• Auto-layout algorithms</li>
                    <li>• Undo/Redo with keyboard shortcuts</li>
                    <li>• Extensible plugin architecture</li>
                    <li>• Enterprise-grade security features</li>
                    <li>• TypeScript support out of the box</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Installation */}
          <section id="installation" className="scroll-mt-24">
            <Card className="bg-white/50 dark:bg-gray-800/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Package className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  <CardTitle className="text-2xl" data-testid="heading-installation">Installation</CardTitle>
                </div>
                <CardDescription data-testid="text-installation-description">
                  Add Kiteline to your project using your preferred package manager
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs defaultValue="npm" className="w-full">
                  <TabsList className="grid w-full grid-cols-3" data-testid="tabs-package-manager">
                    <TabsTrigger value="npm" data-testid="tab-npm">npm</TabsTrigger>
                    <TabsTrigger value="yarn" data-testid="tab-yarn">yarn</TabsTrigger>
                    <TabsTrigger value="pnpm" data-testid="tab-pnpm">pnpm</TabsTrigger>
                  </TabsList>
                  <TabsContent value="npm" className="mt-4">
                    <div className="relative">
                      <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-install-npm">
                        <code>npm install @kiteline/core</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard('npm install @kiteline/core', 'npm-install')}
                        data-testid="button-copy-npm"
                      >
                        {copiedCode === 'npm-install' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="yarn" className="mt-4">
                    <div className="relative">
                      <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-install-yarn">
                        <code>yarn add @kiteline/core</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard('yarn add @kiteline/core', 'yarn-install')}
                        data-testid="button-copy-yarn"
                      >
                        {copiedCode === 'yarn-install' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="pnpm" className="mt-4">
                    <div className="relative">
                      <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-install-pnpm">
                        <code>pnpm add @kiteline/core</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard('pnpm add @kiteline/core', 'pnpm-install')}
                        data-testid="button-copy-pnpm"
                      >
                        {copiedCode === 'pnpm-install' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-300 mb-2">
                    <Terminal className="inline w-4 h-4 mr-2" />
                    Peer Dependencies
                  </h4>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                    Kiteline requires React 18 or higher:
                  </p>
                  <pre className="bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 p-3 rounded text-sm" data-testid="code-peer-deps">
                    <code>npm install react react-dom</code>
                  </pre>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Import Styles
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Don't forget to import the CSS file in your application:
                  </p>
                  <div className="relative">
                    <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-import-css">
                      <code>import '@kiteline/core/styles/kiteframe.css';</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard("import '@kiteline/core/styles/kiteframe.css';", 'import-css')}
                      data-testid="button-copy-import-css"
                    >
                      {copiedCode === 'import-css' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Basic Usage */}
          <section id="basic-usage" className="scroll-mt-24">
            <Card className="bg-white/50 dark:bg-gray-800/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Code2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <CardTitle className="text-2xl" data-testid="heading-basic-usage">Basic Usage</CardTitle>
                </div>
                <CardDescription data-testid="text-basic-usage-description">
                  Create your first workflow canvas with nodes and edges
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    Minimal Example
                  </h3>
                  <div className="relative">
                    <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-basic-example">
                      <code>{`import { KiteFrameCanvas } from '@kiteline/core';
import '@kiteline/core/styles/kiteframe.css';
import { useState } from 'react';

function MyWorkflow() {
  const [nodes, setNodes] = useState([
    {
      id: '1',
      type: 'basic',
      position: { x: 100, y: 100 },
      data: { 
        label: 'Start Node',
        colors: {
          headerBackground: '#3b82f6',
          bodyBackground: '#eff6ff',
          borderColor: '#3b82f6',
          headerTextColor: '#ffffff'
        }
      },
      style: { width: 200, height: 100 }
    }
  ]);
  
  const [edges, setEdges] = useState([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  return (
    <div style={{ width: '100%', height: '500px' }}>
      <KiteFrameCanvas
        nodes={nodes}
        edges={edges}
        viewport={viewport}
        onNodesChange={setNodes}
        onEdgesChange={setEdges}
        onViewportChange={setViewport}
      />
    </div>
  );
}`}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(`import { KiteFrameCanvas } from '@kiteline/core';
import '@kiteline/core/styles/kiteframe.css';
import { useState } from 'react';

function MyWorkflow() {
  const [nodes, setNodes] = useState([
    {
      id: '1',
      type: 'basic',
      position: { x: 100, y: 100 },
      data: { 
        label: 'Start Node',
        colors: {
          headerBackground: '#3b82f6',
          bodyBackground: '#eff6ff',
          borderColor: '#3b82f6',
          headerTextColor: '#ffffff'
        }
      },
      style: { width: 200, height: 100 }
    }
  ]);
  
  const [edges, setEdges] = useState([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  return (
    <div style={{ width: '100%', height: '500px' }}>
      <KiteFrameCanvas
        nodes={nodes}
        edges={edges}
        viewport={viewport}
        onNodesChange={setNodes}
        onEdgesChange={setEdges}
        onViewportChange={setViewport}
      />
    </div>
  );
}`, 'basic-example')}
                      data-testid="button-copy-basic-example"
                    >
                      {copiedCode === 'basic-example' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    Live Demo
                  </h3>
                  <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden" style={{ height: '250px' }} data-testid="demo-basic-usage">
                    <KiteFrameCanvas
                      nodes={basicDemoNodes}
                      edges={basicDemoEdges}
                      viewport={basicDemoViewport}
                      onNodesChange={setBasicDemoNodes}
                      onEdgesChange={setBasicDemoEdges}
                      onViewportChange={setBasicDemoViewport}
                      disableWheelZoom={true}
                      proFeatures={{ quickAdd: { enabled: false } }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* API Reference */}
          <section id="api-reference" className="scroll-mt-24">
            <Card className="bg-white/50 dark:bg-gray-800/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileCode className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                  <CardTitle className="text-2xl" data-testid="heading-api-reference">API Reference</CardTitle>
                </div>
                <CardDescription data-testid="text-api-description">
                  Complete reference for components, types, and interfaces
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* KiteFrameCanvas Props */}
                <div>
                  <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    KiteFrameCanvas Props
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse bg-white dark:bg-gray-900 rounded-lg overflow-hidden" data-testid="table-canvas-props">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Prop</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Type</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Required</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        <tr>
                          <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400">nodes</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">Node[]</td>
                          <td className="px-4 py-3 text-sm"><Badge variant="destructive">Yes</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Array of node objects to render</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400">edges</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">Edge[]</td>
                          <td className="px-4 py-3 text-sm"><Badge variant="destructive">Yes</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Array of edge objects connecting nodes</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400">viewport</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">Viewport</td>
                          <td className="px-4 py-3 text-sm"><Badge variant="destructive">Yes</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Current viewport state (x, y, zoom)</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400">onNodesChange</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">(nodes: Node[]) =&gt; void</td>
                          <td className="px-4 py-3 text-sm"><Badge variant="destructive">Yes</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Callback when nodes are updated</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400">onEdgesChange</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">(edges: Edge[]) =&gt; void</td>
                          <td className="px-4 py-3 text-sm"><Badge variant="destructive">Yes</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Callback when edges are updated</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400">onViewportChange</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">(viewport: Viewport) =&gt; void</td>
                          <td className="px-4 py-3 text-sm"><Badge variant="destructive">Yes</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Callback when viewport changes</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400">onNodeClick</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">(nodeId: string) =&gt; void</td>
                          <td className="px-4 py-3 text-sm"><Badge variant="secondary">No</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Callback when a node is clicked</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400">onEdgeClick</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">(edgeId: string) =&gt; void</td>
                          <td className="px-4 py-3 text-sm"><Badge variant="secondary">No</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Callback when an edge is clicked</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400">showMinimap</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">boolean</td>
                          <td className="px-4 py-3 text-sm"><Badge variant="secondary">No</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Show minimap for navigation</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400">snapToGrid</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">boolean</td>
                          <td className="px-4 py-3 text-sm"><Badge variant="secondary">No</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Enable grid snapping</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400">gridSize</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">number</td>
                          <td className="px-4 py-3 text-sm"><Badge variant="secondary">No</Badge></td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Grid size in pixels (default: 20)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Node Type */}
                <div>
                  <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Node Type
                  </h3>
                  <div className="relative">
                    <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-node-type">
                      <code>{`interface Node {
  id: string;                    // Unique identifier
  type?: string;                 // Node type: 'basic', 'image', etc.
  position: { x: number; y: number };
  data: {
    label?: string;              // Primary text
    description?: string;        // Secondary text
    colors?: {
      headerBackground?: string;
      bodyBackground?: string;
      borderColor?: string;
      headerTextColor?: string;
      bodyTextColor?: string;
    };
  };
  style?: {
    width?: number;              // Width in pixels
    height?: number;             // Height in pixels
  };
  draggable?: boolean;           // Can be dragged (default: true)
  selectable?: boolean;          // Can be selected (default: true)
  resizable?: boolean;           // Can be resized (default: true)
  hidden?: boolean;              // Is hidden (default: false)
  zIndex?: number;               // Stacking order
}`}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(`interface Node {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: {
    label?: string;
    description?: string;
    colors?: {
      headerBackground?: string;
      bodyBackground?: string;
      borderColor?: string;
      headerTextColor?: string;
      bodyTextColor?: string;
    };
  };
  style?: {
    width?: number;
    height?: number;
  };
  draggable?: boolean;
  selectable?: boolean;
  resizable?: boolean;
  hidden?: boolean;
  zIndex?: number;
}`, 'node-type')}
                      data-testid="button-copy-node-type"
                    >
                      {copiedCode === 'node-type' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Edge Type */}
                <div>
                  <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-green-600 dark:text-green-400" />
                    Edge Type
                  </h3>
                  <div className="relative">
                    <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-edge-type">
                      <code>{`interface Edge {
  id: string;                    // Unique identifier
  source: string;                // Source node ID
  target: string;                // Target node ID
  type?: 'bezier' | 'straight' | 'step' | 'curved' | 'orthogonal' | 'smoothstep';
  animated?: boolean;            // Animated flow (default: false)
  label?: string;                // Edge label text
  labelStyle?: {
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    padding?: number;
    borderRadius?: number;
  };
  style?: {
    stroke?: string;             // Line color
    strokeWidth?: number;        // Line thickness
    strokeDasharray?: string;    // Dash pattern (e.g., '5,5')
  };
  markerEnd?: {
    type: 'arrow' | 'circle' | 'square' | 'diamond' | 'triangle';
    size?: number;
    color?: string;
  };
  markerStart?: {               // Same as markerEnd
    type: 'arrow' | 'circle' | 'square' | 'diamond' | 'triangle';
    size?: number;
    color?: string;
  };
  hidden?: boolean;             // Is hidden (default: false)
  zIndex?: number;              // Stacking order
}`}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(`interface Edge {
  id: string;
  source: string;
  target: string;
  type?: 'bezier' | 'straight' | 'step' | 'curved' | 'orthogonal' | 'smoothstep';
  animated?: boolean;
  label?: string;
  labelStyle?: {
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    padding?: number;
    borderRadius?: number;
  };
  style?: {
    stroke?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
  };
  markerEnd?: {
    type: 'arrow' | 'circle' | 'square' | 'diamond' | 'triangle';
    size?: number;
    color?: string;
  };
  markerStart?: {
    type: 'arrow' | 'circle' | 'square' | 'diamond' | 'triangle';
    size?: number;
    color?: string;
  };
  hidden?: boolean;
  zIndex?: number;
}`, 'edge-type')}
                      data-testid="button-copy-edge-type"
                    >
                      {copiedCode === 'edge-type' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Edge Demo */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    Edge Example
                  </h3>
                  <div className="border-2 border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden" style={{ height: '250px' }} data-testid="demo-edge-example">
                    <KiteFrameCanvas
                      nodes={edgeDemoNodes}
                      edges={edgeDemoEdges}
                      viewport={edgeDemoViewport}
                      onNodesChange={setEdgeDemoNodes}
                      onEdgesChange={setEdgeDemoEdges}
                      onViewportChange={setEdgeDemoViewport}
                      disableWheelZoom={true}
                      proFeatures={{ quickAdd: { enabled: false } }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Configuration */}
          <section id="configuration" className="scroll-mt-24">
            <Card className="bg-white/50 dark:bg-gray-800/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Settings className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  <CardTitle className="text-2xl" data-testid="heading-configuration">Configuration</CardTitle>
                </div>
                <CardDescription data-testid="text-configuration-description">
                  Customize the canvas behavior and appearance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    Canvas Options
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Viewport Control</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                        <ul className="space-y-1">
                          <li>• <code className="text-blue-600 dark:text-blue-400">disableWheelZoom</code> - Disable mouse wheel zoom</li>
                          <li>• <code className="text-blue-600 dark:text-blue-400">disablePan</code> - Disable panning</li>
                          <li>• <code className="text-blue-600 dark:text-blue-400">minZoom</code> - Minimum zoom level (default: 0.1)</li>
                          <li>• <code className="text-blue-600 dark:text-blue-400">maxZoom</code> - Maximum zoom level (default: 2)</li>
                        </ul>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Grid & Snapping</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                        <ul className="space-y-1">
                          <li>• <code className="text-blue-600 dark:text-blue-400">snapToGrid</code> - Enable grid snapping</li>
                          <li>• <code className="text-blue-600 dark:text-blue-400">gridSize</code> - Grid cell size in pixels</li>
                          <li>• <code className="text-blue-600 dark:text-blue-400">showGrid</code> - Display grid background</li>
                        </ul>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">UI Elements</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                        <ul className="space-y-1">
                          <li>• <code className="text-blue-600 dark:text-blue-400">showMinimap</code> - Show minimap navigation</li>
                          <li>• <code className="text-blue-600 dark:text-blue-400">showZoomControls</code> - Show zoom buttons</li>
                          <li>• <code className="text-blue-600 dark:text-blue-400">showSnapGuides</code> - Show alignment guides</li>
                        </ul>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Interactions</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                        <ul className="space-y-1">
                          <li>• <code className="text-blue-600 dark:text-blue-400">nodesDraggable</code> - Enable node dragging</li>
                          <li>• <code className="text-blue-600 dark:text-blue-400">nodesConnectable</code> - Enable node connections</li>
                          <li>• <code className="text-blue-600 dark:text-blue-400">elementsSelectable</code> - Enable selection</li>
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    Pro Features
                  </h3>
                  <div className="relative">
                    <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-pro-features">
                      <code>{`<KiteFrameCanvas
  nodes={nodes}
  edges={edges}
  viewport={viewport}
  onNodesChange={setNodes}
  onEdgesChange={setEdges}
  onViewportChange={setViewport}
  proFeatures={{
    quickAdd: {
      enabled: true,
      showGhostPreview: true,
      defaultSpacing: 200
    },
    smartGuides: {
      enabled: true,
      snapThreshold: 10
    },
    versionControl: {
      enabled: true,
      maxSnapshots: 50
    }
  }}
/>`}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(`<KiteFrameCanvas
  nodes={nodes}
  edges={edges}
  viewport={viewport}
  onNodesChange={setNodes}
  onEdgesChange={setEdges}
  onViewportChange={setViewport}
  proFeatures={{
    quickAdd: {
      enabled: true,
      showGhostPreview: true,
      defaultSpacing: 200
    },
    smartGuides: {
      enabled: true,
      snapThreshold: 10
    },
    versionControl: {
      enabled: true,
      maxSnapshots: 50
    }
  }}
/>`, 'pro-features')}
                      data-testid="button-copy-pro-features"
                    >
                      {copiedCode === 'pro-features' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Plugin System */}
          <section id="plugins" className="scroll-mt-24">
            <Card className="bg-white/50 dark:bg-gray-800/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Plug2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  <CardTitle className="text-2xl" data-testid="heading-plugins">Plugin System</CardTitle>
                </div>
                <CardDescription data-testid="text-plugins-description">
                  Extend Kiteline with custom functionality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-gray-700 dark:text-gray-300">
                  Kiteline's plugin system allows you to extend the canvas with custom behaviors, tools, and integrations. 
                  Plugins can hook into various lifecycle events and add new capabilities to your workflow editor.
                </p>

                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    Creating a Plugin
                  </h3>
                  <div className="relative">
                    <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-create-plugin">
                      <code>{`import { kiteFrameCore, createPlugin } from '@kiteline/core';

const myPlugin = createPlugin({
  name: 'my-custom-plugin',
  version: '1.0.0',
  
  initialize: (core) => {
    console.log('Plugin initialized!');
    
    // Hook into events
    core.on('nodeClick', (node) => {
      console.log('Node clicked:', node);
    });
    
    core.on('edgeCreate', (edge) => {
      console.log('Edge created:', edge);
    });
  },
  
  cleanup: () => {
    console.log('Plugin cleaned up');
  }
});

// Register the plugin
kiteFrameCore.installPlugin(myPlugin);`}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(`import { kiteFrameCore, createPlugin } from '@kiteline/core';

const myPlugin = createPlugin({
  name: 'my-custom-plugin',
  version: '1.0.0',
  
  initialize: (core) => {
    console.log('Plugin initialized!');
    
    // Hook into events
    core.on('nodeClick', (node) => {
      console.log('Node clicked:', node);
    });
    
    core.on('edgeCreate', (edge) => {
      console.log('Edge created:', edge);
    });
  },
  
  cleanup: () => {
    console.log('Plugin cleaned up');
  }
});

// Register the plugin
kiteFrameCore.installPlugin(myPlugin);`, 'create-plugin')}
                      data-testid="button-copy-create-plugin"
                    >
                      {copiedCode === 'create-plugin' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    Available Hooks
                  </h3>
                  <div className="grid gap-3">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-mono text-blue-600 dark:text-blue-400">nodeClick</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                        Fired when a node is clicked. Receives the node object.
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-mono text-blue-600 dark:text-blue-400">edgeCreate</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                        Fired when a new edge is created. Receives the edge object.
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-mono text-blue-600 dark:text-blue-400">nodeMove</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                        Fired when a node is moved. Receives the node and new position.
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-mono text-blue-600 dark:text-blue-400">viewportChange</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                        Fired when the viewport changes. Receives the new viewport state.
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                  <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-2">
                    Built-in Plugins
                  </h4>
                  <ul className="space-y-1 text-sm text-indigo-800 dark:text-indigo-200">
                    <li>• <strong>LayoutPlugin</strong> - Auto-layout algorithms (horizontal, vertical, grid, etc.)</li>
                    <li>• <strong>MultiSelectPlugin</strong> - Multi-node selection and group operations</li>
                    <li>• <strong>SmartGuidesPlugin</strong> - Alignment guides and smart snapping</li>
                    <li>• <strong>SmartConnectPlugin</strong> - Intelligent edge routing and connections</li>
                    <li>• <strong>VersionControlPlugin</strong> - Snapshot and version management</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-20 py-8 px-4 border-t border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50" data-testid="footer-docs">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            © 2025 Kiteline Canvas. Built with ❤️ for the developer community.
          </p>
          <div className="mt-4 flex justify-center gap-6">
            <Link href="/demo">
              <Button variant="link" size="sm" data-testid="link-demo">
                Interactive Demo
              </Button>
            </Link>
            <a href="https://github.com/KiteSpace/Kiteline.git" target="_blank" rel="noopener noreferrer">
              <Button variant="link" size="sm" data-testid="link-github">
                GitHub
              </Button>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
