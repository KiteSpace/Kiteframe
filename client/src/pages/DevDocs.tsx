import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Search, 
  ChevronRight, 
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ArrowLeft, 
  Copy, 
  Check,
  Code,
  Database,
  Shield,
  Zap,
  Layers,
  GitBranch,
  Box,
  Settings,
  Users,
  CreditCard,
  FileText,
  Cpu,
  Network,
  Workflow,
  Eye,
  Lock,
  Server,
  Monitor,
  Palette,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize
} from 'lucide-react';
import { Link } from 'wouter';
import { 
  ACTIONABILITY_RULES,
  BASE_SYSTEM_PROMPT,
  PM_MODE_PROMPT,
  DESIGNER_MODE_PROMPT,
  VISION_ANALYSIS_PROMPT
} from '@/ai/kiteaiPrompts';
import { 
  PM_SYSTEM_PROMPT,
  DESIGNER_SYSTEM_PROMPT,
  HYBRID_SYSTEM_PROMPT
} from '@/ai/systemPrompts';

interface AuthUser {
  id: string;
  isAdmin?: boolean;
}

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  subsections?: { id: string; title: string }[];
}

const docSections: DocSection[] = [
  { 
    id: 'overview', 
    title: 'Overview', 
    icon: <Eye className="w-4 h-4" />,
    subsections: [
      { id: 'overview-intro', title: 'Introduction' },
      { id: 'overview-goals', title: 'Project Goals' },
      { id: 'overview-services', title: 'Multi-Service Architecture' },
    ]
  },
  { 
    id: 'tech-stack', 
    title: 'Tech Stack', 
    icon: <Layers className="w-4 h-4" />,
    subsections: [
      { id: 'tech-frontend', title: 'Frontend' },
      { id: 'tech-backend', title: 'Backend' },
      { id: 'tech-database', title: 'Database' },
      { id: 'tech-ai', title: 'AI Services' },
      { id: 'tech-dependencies', title: 'Key Dependencies' },
    ]
  },
  { 
    id: 'architecture', 
    title: 'Architecture', 
    icon: <Network className="w-4 h-4" />,
    subsections: [
      { id: 'arch-system', title: 'System Overview' },
      { id: 'arch-frontend', title: 'Frontend Architecture' },
      { id: 'arch-backend', title: 'Backend Architecture' },
      { id: 'arch-data-flow', title: 'Data Flow' },
    ]
  },
  { 
    id: 'canvas', 
    title: 'Canvas Library (KiteFrame)', 
    icon: <Box className="w-4 h-4" />,
    subsections: [
      { id: 'canvas-overview', title: 'Overview' },
      { id: 'canvas-nodes', title: 'Node System' },
      { id: 'canvas-edges', title: 'Edge System' },
      { id: 'canvas-viewport', title: 'Viewport & Rendering' },
      { id: 'canvas-objects', title: 'Canvas Objects' },
      { id: 'canvas-layouts', title: 'Auto-Layout Algorithms' },
      { id: 'canvas-undo-redo', title: 'Undo/Redo System' },
    ]
  },
  { 
    id: 'plugins', 
    title: 'Plugin System', 
    icon: <Settings className="w-4 h-4" />,
    subsections: [
      { id: 'plugins-core', title: 'Core Architecture' },
      { id: 'plugins-hooks', title: 'Extension Points' },
      { id: 'plugins-creating', title: 'Creating Plugins' },
      { id: 'plugins-pro', title: 'Pro Plugins' },
    ]
  },
  { 
    id: 'ai', 
    title: 'AI Integration', 
    icon: <Cpu className="w-4 h-4" />,
    subsections: [
      { id: 'ai-overview', title: 'Overview' },
      { id: 'ai-kiteai', title: 'KiteAI Conversation' },
      { id: 'ai-vision', title: 'Vision Pipeline' },
      { id: 'ai-actionability', title: 'Actionability Scoring' },
      { id: 'ai-pm-guards', title: 'PM Depth Guards' },
      { id: 'ai-providers', title: 'AI Providers' },
    ]
  },
  { 
    id: 'auth', 
    title: 'Authentication', 
    icon: <Lock className="w-4 h-4" />,
    subsections: [
      { id: 'auth-overview', title: 'Overview' },
      { id: 'auth-oauth', title: 'OAuth Providers' },
      { id: 'auth-linking', title: 'Account Linking' },
      { id: 'auth-sessions', title: 'Session Management' },
      { id: 'auth-firebase', title: 'Firebase Sync' },
    ]
  },
  { 
    id: 'database', 
    title: 'Database', 
    icon: <Database className="w-4 h-4" />,
    subsections: [
      { id: 'db-schema', title: 'Schema Design' },
      { id: 'db-drizzle', title: 'Drizzle ORM' },
      { id: 'db-migrations', title: 'Migrations' },
      { id: 'db-storage', title: 'Storage Interface' },
    ]
  },
  { 
    id: 'subscriptions', 
    title: 'Subscription System', 
    icon: <CreditCard className="w-4 h-4" />,
    subsections: [
      { id: 'sub-tiers', title: 'Subscription Tiers' },
      { id: 'sub-credits', title: 'Credit System' },
      { id: 'sub-stripe', title: 'Stripe Integration' },
    ]
  },
  { 
    id: 'project-panel', 
    title: 'Project Panel', 
    icon: <FileText className="w-4 h-4" />,
    subsections: [
      { id: 'panel-kiteai', title: 'KiteAI Tab' },
      { id: 'panel-project', title: 'Project Tab' },
      { id: 'panel-layers', title: 'Layers Tab' },
      { id: 'panel-prd', title: 'PRD System' },
    ]
  },
  { 
    id: 'security', 
    title: 'Security', 
    icon: <Shield className="w-4 h-4" />,
    subsections: [
      { id: 'sec-validation', title: 'Input Validation' },
      { id: 'sec-xss', title: 'XSS Prevention' },
      { id: 'sec-boundaries', title: 'Error Boundaries' },
    ]
  },
  { 
    id: 'performance', 
    title: 'Performance', 
    icon: <Zap className="w-4 h-4" />,
    subsections: [
      { id: 'perf-virtualization', title: 'Virtualization' },
      { id: 'perf-batching', title: 'Batch Rendering' },
      { id: 'perf-optimization', title: 'React Optimization' },
    ]
  },
  { 
    id: 'demos', 
    title: 'Interactive Demos', 
    icon: <Palette className="w-4 h-4" />,
    subsections: [
      { id: 'demo-canvas', title: 'Canvas Playground' },
      { id: 'demo-nodes', title: 'Node Types' },
      { id: 'demo-edges', title: 'Edge Styling' },
      { id: 'demo-layouts', title: 'Auto-Layout' },
      { id: 'demo-undo', title: 'Undo/Redo' },
      { id: 'demo-selection', title: 'Selection' },
      { id: 'demo-minimap', title: 'Minimap & Navigation' },
      { id: 'demo-plugins', title: 'Plugin Hooks' },
    ]
  },
];

function CodeBlock({ code, language = 'typescript' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
        <code>{code}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
        onClick={handleCopy}
        data-testid="button-copy-code"
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function DiagramBox({ title, items, color = 'blue' }: { title: string; items: string[]; color?: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    pink: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800',
  };
  
  return (
    <div className={`p-4 rounded-lg border-2 ${colorClasses[color] || colorClasses.blue}`}>
      <h4 className="font-semibold text-sm mb-2">{title}</h4>
      <ul className="text-xs space-y-1 text-muted-foreground">
        {items.map((item, i) => (
          <li key={i}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function ArchitectureDiagram() {
  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border">
      <h4 className="text-lg font-semibold mb-6 text-center">System Architecture Overview</h4>
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <DiagramBox 
            title="Frontend (React)" 
            items={['React 18 + TypeScript', 'Vite Build', 'TanStack Query', 'Wouter Router']}
            color="blue"
          />
          <DiagramBox 
            title="Backend (Express)" 
            items={['Node.js + TypeScript', 'RESTful API', 'Passport.js Auth', 'Session Store']}
            color="green"
          />
          <DiagramBox 
            title="Database (PostgreSQL)" 
            items={['Drizzle ORM', 'Neon Serverless', 'Session Storage', 'User Data']}
            color="purple"
          />
        </div>
        
        <div className="flex justify-center">
          <div className="text-muted-foreground text-sm">↕ API Calls ↕</div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <DiagramBox 
            title="KiteFrame Canvas Library" 
            items={['12 Node Types', '6 Edge Types', 'Plugin Architecture', 'Undo/Redo System']}
            color="orange"
          />
          <DiagramBox 
            title="AI Services" 
            items={['OpenAI GPT-4o', 'Ollama (KitelineAI)', 'Vision Pipeline', 'Workflow Generation']}
            color="pink"
          />
        </div>
        
        <div className="flex justify-center">
          <div className="text-muted-foreground text-sm">↕ External Services ↕</div>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <DiagramBox 
            title="Stripe" 
            items={['Subscriptions', 'Checkout', 'Webhooks']}
            color="purple"
          />
          <DiagramBox 
            title="OAuth Providers" 
            items={['Google', 'GitHub', 'Replit']}
            color="blue"
          />
          <DiagramBox 
            title="Figma API" 
            items={['Design Import', 'MCP Server', 'Frame Analysis']}
            color="green"
          />
        </div>
      </div>
    </div>
  );
}

function DataFlowDiagram() {
  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border">
      <h4 className="text-lg font-semibold mb-6 text-center">Data Flow: AI Workflow Generation</h4>
      <div className="flex flex-col items-center space-y-4">
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-sm font-medium">User Input</div>
          <div className="text-muted-foreground">→</div>
          <div className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-sm font-medium">KiteAI State</div>
          <div className="text-muted-foreground">→</div>
          <div className="px-4 py-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-sm font-medium">Actionability Check</div>
        </div>
        <div className="text-muted-foreground">↓</div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg text-sm font-medium">PM Depth Guards</div>
          <div className="text-muted-foreground">→</div>
          <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-sm font-medium">AI Provider</div>
          <div className="text-muted-foreground">→</div>
          <div className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-sm font-medium">Workflow Output</div>
        </div>
      </div>
    </div>
  );
}

function PropControl({ 
  label, 
  type, 
  value, 
  onChange, 
  options 
}: { 
  label: string; 
  type: 'boolean' | 'select' | 'number' | 'color'; 
  value: any; 
  onChange: (value: any) => void; 
  options?: { label: string; value: string }[];
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <label className="text-sm font-medium">{label}</label>
      {type === 'boolean' && (
        <button
          onClick={() => onChange(!value)}
          className={`w-10 h-5 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-muted'}`}
          data-testid={`toggle-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      )}
      {type === 'select' && options && (
        <select 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="px-2 py-1 rounded border bg-background text-sm"
          data-testid={`select-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
      {type === 'number' && (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 px-2 py-1 rounded border bg-background text-sm"
          data-testid={`input-${label.toLowerCase().replace(/\s+/g, '-')}`}
        />
      )}
      {type === 'color' && (
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-6 rounded cursor-pointer"
          data-testid={`color-${label.toLowerCase().replace(/\s+/g, '-')}`}
        />
      )}
    </div>
  );
}

function DemoPreview({ children, title }: { children: React.ReactNode; title: string }) {
  const testId = `demo-preview-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="border rounded-lg overflow-hidden" data-testid={testId}>
      <div className="bg-muted px-4 py-2 border-b flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-sm font-medium ml-2">{title}</span>
      </div>
      <div className="bg-slate-100 dark:bg-slate-900 p-4 min-h-[300px]" data-testid={`${testId}-content`}>
        {children}
      </div>
    </div>
  );
}

function CanvasPlaygroundDemo() {
  const [showMinimap, setShowMinimap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [enableZoom, setEnableZoom] = useState(true);
  const [enablePan, setEnablePan] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  
  const codeSnippet = `<KiteFrameCanvas
  showMinimap={${showMinimap}}
  showGrid={${showGrid}}
  snapToGrid={${snapToGrid}}
  enableZoom={${enableZoom}}
  enablePan={${enablePan}}
  gridSize={${gridSize}}
  nodes={nodes}
  edges={edges}
  onNodeUpdate={handleNodeUpdate}
  onEdgeUpdate={handleEdgeUpdate}
/>`;

  return (
    <div className="space-y-6" data-testid="demo-canvas-playground">
      <h2 className="text-2xl font-bold mb-4">Canvas Playground</h2>
      
      <p className="text-muted-foreground mb-4">
        Interactive demo of the KiteFrame canvas. Toggle props to see how they affect the canvas behavior.
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DemoPreview title="Canvas Preview">
            <div className="relative w-full h-[400px] bg-white dark:bg-slate-800 rounded border overflow-hidden">
              {showGrid && (
                <div 
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                      linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                    `,
                    backgroundSize: `${gridSize}px ${gridSize}px`
                  }}
                />
              )}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-8">
                <div className="w-32 h-20 bg-blue-500 rounded-lg shadow-lg flex items-center justify-center text-white font-medium cursor-move">
                  Input Node
                </div>
                <div className="w-32 h-20 bg-purple-500 rounded-lg shadow-lg flex items-center justify-center text-white font-medium cursor-move">
                  Process Node
                </div>
                <div className="w-32 h-20 bg-green-500 rounded-lg shadow-lg flex items-center justify-center text-white font-medium cursor-move">
                  Output Node
                </div>
              </div>
              {showMinimap && (
                <div className="absolute bottom-4 right-4 w-32 h-24 bg-slate-200 dark:bg-slate-700 rounded border shadow-lg overflow-hidden">
                  <div className="p-1 text-[8px] text-muted-foreground">Minimap</div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1">
                    <div className="w-4 h-2 bg-blue-500 rounded-sm" />
                    <div className="w-4 h-2 bg-purple-500 rounded-sm" />
                    <div className="w-4 h-2 bg-green-500 rounded-sm" />
                  </div>
                </div>
              )}
              <div className="absolute top-4 left-4 flex gap-2">
                {enableZoom && (
                  <div className="bg-white dark:bg-slate-700 rounded shadow px-2 py-1 text-xs">Zoom: 100%</div>
                )}
                {enablePan && (
                  <div className="bg-white dark:bg-slate-700 rounded shadow px-2 py-1 text-xs">Pan enabled</div>
                )}
                {snapToGrid && (
                  <div className="bg-primary text-primary-foreground rounded shadow px-2 py-1 text-xs">Snap: ON</div>
                )}
              </div>
            </div>
          </DemoPreview>
        </div>
        
        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Props</CardTitle>
            </CardHeader>
            <CardContent>
              <PropControl label="Show Minimap" type="boolean" value={showMinimap} onChange={setShowMinimap} />
              <PropControl label="Show Grid" type="boolean" value={showGrid} onChange={setShowGrid} />
              <PropControl label="Snap to Grid" type="boolean" value={snapToGrid} onChange={setSnapToGrid} />
              <PropControl label="Enable Zoom" type="boolean" value={enableZoom} onChange={setEnableZoom} />
              <PropControl label="Enable Pan" type="boolean" value={enablePan} onChange={setEnablePan} />
              <PropControl label="Grid Size" type="number" value={gridSize} onChange={setGridSize} />
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Code className="w-4 h-4" />
            Generated Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={codeSnippet} />
        </CardContent>
      </Card>
    </div>
  );
}

function NodeTypesDemo() {
  const [nodeType, setNodeType] = useState('input');
  const [nodeColor, setNodeColor] = useState('#3b82f6');
  const [nodeWidth, setNodeWidth] = useState(160);
  const [nodeHeight, setNodeHeight] = useState(80);
  const [showIcon, setShowIcon] = useState(true);
  const [showHandles, setShowHandles] = useState(true);
  
  const nodeTypes: { value: string; label: string; color: string; icon: string }[] = [
    { value: 'input', label: 'Input', color: '#3b82f6', icon: '📥' },
    { value: 'process', label: 'Process', color: '#8b5cf6', icon: '⚙️' },
    { value: 'condition', label: 'Condition', color: '#f59e0b', icon: '❓' },
    { value: 'output', label: 'Output', color: '#22c55e', icon: '📤' },
    { value: 'ai', label: 'AI Task', color: '#ec4899', icon: '🤖' },
    { value: 'image', label: 'Image', color: '#06b6d4', icon: '🖼️' },
  ];
  
  const currentNode = nodeTypes.find(n => n.value === nodeType) || nodeTypes[0];
  
  const codeSnippet = `const node: KiteNode = {
  id: 'node-1',
  type: '${nodeType}',
  position: { x: 100, y: 100 },
  data: {
    label: '${currentNode.label} Node',
    color: '${nodeColor}',
  },
  width: ${nodeWidth},
  height: ${nodeHeight},
};`;

  return (
    <div className="space-y-6" data-testid="demo-node-types">
      <h2 className="text-2xl font-bold mb-4">Node Types</h2>
      
      <p className="text-muted-foreground mb-4">
        Explore the 6 built-in node types. Each type has specific styling and behavior for different workflow stages.
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DemoPreview title={`${currentNode.label} Node`}>
            <div className="flex items-center justify-center h-[300px]">
              <div 
                className="relative rounded-lg shadow-xl flex flex-col items-center justify-center text-white font-medium transition-all"
                style={{ 
                  backgroundColor: nodeColor, 
                  width: nodeWidth, 
                  height: nodeHeight 
                }}
              >
                {showIcon && <span className="text-2xl mb-1">{currentNode.icon}</span>}
                <span>{currentNode.label}</span>
                {showHandles && (
                  <>
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-slate-400" />
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-slate-400" />
                  </>
                )}
              </div>
            </div>
          </DemoPreview>
        </div>
        
        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Props</CardTitle>
            </CardHeader>
            <CardContent>
              <PropControl 
                label="Node Type" 
                type="select" 
                value={nodeType} 
                onChange={(v) => {
                  setNodeType(v);
                  const newNode = nodeTypes.find(n => n.value === v);
                  if (newNode) setNodeColor(newNode.color);
                }}
                options={nodeTypes.map(n => ({ value: n.value, label: n.label }))}
              />
              <PropControl label="Color" type="color" value={nodeColor} onChange={setNodeColor} />
              <PropControl label="Width" type="number" value={nodeWidth} onChange={setNodeWidth} />
              <PropControl label="Height" type="number" value={nodeHeight} onChange={setNodeHeight} />
              <PropControl label="Show Icon" type="boolean" value={showIcon} onChange={setShowIcon} />
              <PropControl label="Show Handles" type="boolean" value={showHandles} onChange={setShowHandles} />
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Code className="w-4 h-4" />
            Generated Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={codeSnippet} />
        </CardContent>
      </Card>
    </div>
  );
}

function EdgeStylingDemo() {
  const [edgeType, setEdgeType] = useState('bezier');
  const [edgeColor, setEdgeColor] = useState('#64748b');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [animated, setAnimated] = useState(false);
  const [showArrow, setShowArrow] = useState(true);
  const [dashed, setDashed] = useState(false);
  
  const edgeTypes = [
    { value: 'bezier', label: 'Bezier (Curved)' },
    { value: 'straight', label: 'Straight' },
    { value: 'step', label: 'Step (Right Angle)' },
    { value: 'smoothstep', label: 'Smooth Step' },
    { value: 'simplebezier', label: 'Simple Bezier' },
    { value: 'custom', label: 'Custom' },
  ];
  
  const codeSnippet = `const edge: KiteEdge = {
  id: 'edge-1',
  source: 'node-1',
  target: 'node-2',
  type: '${edgeType}',
  style: {
    stroke: '${edgeColor}',
    strokeWidth: ${strokeWidth},
    strokeDasharray: ${dashed ? "'5,5'" : 'undefined'},
  },
  animated: ${animated},
  markerEnd: ${showArrow ? "{ type: 'arrowclosed' }" : 'undefined'},
};`;

  const renderEdgePath = () => {
    const start = { x: 50, y: 100 };
    const end = { x: 250, y: 100 };
    
    switch (edgeType) {
      case 'straight':
        return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
      case 'step':
        const midX = (start.x + end.x) / 2;
        return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
      case 'smoothstep':
        const mx = (start.x + end.x) / 2;
        return `M ${start.x} ${start.y} L ${mx - 20} ${start.y} Q ${mx} ${start.y} ${mx} ${(start.y + end.y) / 2} Q ${mx} ${end.y} ${mx + 20} ${end.y} L ${end.x} ${end.y}`;
      case 'bezier':
      case 'simplebezier':
      default:
        const cx1 = start.x + 60;
        const cx2 = end.x - 60;
        return `M ${start.x} ${start.y} C ${cx1} ${start.y}, ${cx2} ${end.y}, ${end.x} ${end.y}`;
    }
  };

  return (
    <div className="space-y-6" data-testid="demo-edge-styling">
      <h2 className="text-2xl font-bold mb-4">Edge Styling</h2>
      
      <p className="text-muted-foreground mb-4">
        Configure edge appearance with different types, colors, and styles.
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DemoPreview title="Edge Preview">
            <div className="flex items-center justify-center h-[200px]">
              <svg width="300" height="200" className="overflow-visible">
                <defs>
                  {showArrow && (
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill={edgeColor} />
                    </marker>
                  )}
                </defs>
                <circle cx="50" cy="100" r="20" fill="#3b82f6" />
                <circle cx="250" cy="100" r="20" fill="#22c55e" />
                <path
                  d={renderEdgePath()}
                  stroke={edgeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashed ? '5,5' : undefined}
                  fill="none"
                  markerEnd={showArrow ? 'url(#arrowhead)' : undefined}
                  className={animated ? 'animate-pulse' : ''}
                />
                <text x="50" y="140" textAnchor="middle" className="text-xs fill-current">Source</text>
                <text x="250" y="140" textAnchor="middle" className="text-xs fill-current">Target</text>
              </svg>
            </div>
          </DemoPreview>
        </div>
        
        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Props</CardTitle>
            </CardHeader>
            <CardContent>
              <PropControl 
                label="Edge Type" 
                type="select" 
                value={edgeType} 
                onChange={setEdgeType}
                options={edgeTypes}
              />
              <PropControl label="Color" type="color" value={edgeColor} onChange={setEdgeColor} />
              <PropControl label="Stroke Width" type="number" value={strokeWidth} onChange={setStrokeWidth} />
              <PropControl label="Animated" type="boolean" value={animated} onChange={setAnimated} />
              <PropControl label="Show Arrow" type="boolean" value={showArrow} onChange={setShowArrow} />
              <PropControl label="Dashed" type="boolean" value={dashed} onChange={setDashed} />
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Code className="w-4 h-4" />
            Generated Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={codeSnippet} />
        </CardContent>
      </Card>
    </div>
  );
}

function AutoLayoutDemo() {
  const [layoutType, setLayoutType] = useState('horizontal');
  const [spacing, setSpacing] = useState(100);
  const [animate, setAnimate] = useState(true);
  
  const layoutTypes = [
    { value: 'horizontal', label: 'Horizontal Flow' },
    { value: 'vertical', label: 'Vertical Flow' },
    { value: 'grid', label: 'Grid' },
    { value: 'circular', label: 'Circular' },
    { value: 'hierarchical', label: 'Hierarchical' },
  ];
  
  const codeSnippet = `import { applyAutoLayout } from '@kiteline/core';

const layoutedNodes = applyAutoLayout(nodes, edges, {
  type: '${layoutType}',
  spacing: ${spacing},
  animate: ${animate},
});`;

  const renderLayout = () => {
    const nodeSize = 40;
    const nodes = [
      { id: 1, label: 'A' },
      { id: 2, label: 'B' },
      { id: 3, label: 'C' },
      { id: 4, label: 'D' },
      { id: 5, label: 'E' },
    ];
    
    const getPositions = () => {
      const s = spacing * 0.5;
      switch (layoutType) {
        case 'horizontal':
          return nodes.map((_, i) => ({ x: 30 + i * s, y: 80 }));
        case 'vertical':
          return nodes.map((_, i) => ({ x: 130, y: 20 + i * (s * 0.6) }));
        case 'grid':
          return nodes.map((_, i) => ({ 
            x: 50 + (i % 3) * s, 
            y: 40 + Math.floor(i / 3) * s 
          }));
        case 'circular':
          const cx = 130, cy = 90, r = 60;
          return nodes.map((_, i) => ({
            x: cx + r * Math.cos((i / nodes.length) * 2 * Math.PI - Math.PI/2),
            y: cy + r * Math.sin((i / nodes.length) * 2 * Math.PI - Math.PI/2),
          }));
        case 'hierarchical':
          return [
            { x: 130, y: 20 },
            { x: 70, y: 80 },
            { x: 190, y: 80 },
            { x: 40, y: 140 },
            { x: 100, y: 140 },
          ];
        default:
          return nodes.map((_, i) => ({ x: 30 + i * 50, y: 80 }));
      }
    };
    
    const positions = getPositions();
    
    return (
      <svg width="300" height="180" className="overflow-visible">
        {positions.map((pos, i) => (
          <g key={i} className={animate ? 'transition-all duration-500' : ''}>
            <rect 
              x={pos.x - nodeSize/2} 
              y={pos.y - nodeSize/2} 
              width={nodeSize} 
              height={nodeSize} 
              rx="8"
              fill={`hsl(${i * 60}, 70%, 50%)`}
              className="shadow-lg"
            />
            <text 
              x={pos.x} 
              y={pos.y + 5} 
              textAnchor="middle" 
              className="text-sm font-bold fill-white"
            >
              {nodes[i].label}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  return (
    <div className="space-y-6" data-testid="demo-auto-layout">
      <h2 className="text-2xl font-bold mb-4">Auto-Layout</h2>
      
      <p className="text-muted-foreground mb-4">
        Automatically arrange nodes using one of 5 layout algorithms.
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DemoPreview title={`${layoutTypes.find(l => l.value === layoutType)?.label || 'Layout'} Preview`}>
            <div className="flex items-center justify-center h-[200px]">
              {renderLayout()}
            </div>
          </DemoPreview>
        </div>
        
        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Props</CardTitle>
            </CardHeader>
            <CardContent>
              <PropControl 
                label="Layout Type" 
                type="select" 
                value={layoutType} 
                onChange={setLayoutType}
                options={layoutTypes}
              />
              <PropControl label="Spacing" type="number" value={spacing} onChange={setSpacing} />
              <PropControl label="Animate" type="boolean" value={animate} onChange={setAnimate} />
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Code className="w-4 h-4" />
            Generated Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={codeSnippet} />
        </CardContent>
      </Card>
    </div>
  );
}

function UndoRedoDemo() {
  const [history, setHistory] = useState<string[]>(['Initial state']);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(true);
  const [maxHistory, setMaxHistory] = useState(50);
  const [batchOperations, setBatchOperations] = useState(false);
  
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;
  
  const addAction = (action: string) => {
    const newHistory = [...history.slice(0, currentIndex + 1), action];
    if (newHistory.length > maxHistory) {
      newHistory.shift();
      setHistory(newHistory);
    } else {
      setHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
    }
  };
  
  const undo = () => {
    if (canUndo) setCurrentIndex(currentIndex - 1);
  };
  
  const redo = () => {
    if (canRedo) setCurrentIndex(currentIndex + 1);
  };
  
  const codeSnippet = `const undoRedoConfig = {
  maxHistorySize: ${maxHistory},
  batchOperations: ${batchOperations},
};

// Using the undo/redo system
const { undo, redo, canUndo, canRedo } = useUndoRedo(undoRedoConfig);

// Keyboard shortcuts (built-in)
// Ctrl/Cmd + Z = Undo
// Ctrl/Cmd + Shift + Z = Redo`;

  return (
    <div className="space-y-6" data-testid="demo-undo-redo">
      <h2 className="text-2xl font-bold mb-4">Undo/Redo System</h2>
      
      <p className="text-muted-foreground mb-4">
        The command pattern implementation provides robust undo/redo with batching support and configurable history limits.
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DemoPreview title="Undo/Redo Demo">
            <div className="flex flex-col h-[300px]">
              <div className="flex items-center gap-2 mb-4">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={undo} 
                  disabled={!canUndo}
                  data-testid="button-undo"
                >
                  <RotateCcw className="w-4 h-4 mr-1" /> Undo
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={redo} 
                  disabled={!canRedo}
                  data-testid="button-redo"
                >
                  <RotateCw className="w-4 h-4 mr-1" /> Redo
                </Button>
                <div className="flex gap-1 ml-auto">
                  <Button size="sm" onClick={() => addAction(`Add node ${history.length}`)} data-testid="button-add-node">
                    Add Node
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => addAction(`Move node ${history.length}`)} data-testid="button-move-node">
                    Move Node
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => addAction(`Delete node ${history.length}`)} data-testid="button-delete-node">
                    Delete
                  </Button>
                </div>
              </div>
              
              {showHistory && (
                <div className="flex-1 overflow-auto bg-white dark:bg-slate-800 rounded-lg p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Command History</div>
                  {history.map((action, i) => (
                    <div 
                      key={i}
                      className={`text-sm px-2 py-1 rounded mb-1 ${i === currentIndex ? 'bg-blue-100 dark:bg-blue-900 font-medium' : 'text-muted-foreground'} ${i > currentIndex ? 'opacity-40' : ''}`}
                      data-testid={`history-item-${i}`}
                    >
                      {i + 1}. {action}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DemoPreview>
        </div>
        
        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Props</CardTitle>
            </CardHeader>
            <CardContent>
              <PropControl label="Show History" type="boolean" value={showHistory} onChange={setShowHistory} />
              <PropControl label="Max History" type="number" value={maxHistory} onChange={setMaxHistory} />
              <PropControl label="Batch Operations" type="boolean" value={batchOperations} onChange={setBatchOperations} />
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Code className="w-4 h-4" />
            Generated Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={codeSnippet} />
        </CardContent>
      </Card>
    </div>
  );
}

function SelectionDemo() {
  const [selectedNodes, setSelectedNodes] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState<'click' | 'box' | 'lasso'>('click');
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(true);
  const [showSelectionBox, setShowSelectionBox] = useState(true);
  
  const nodes = [
    { id: 1, x: 50, y: 50, label: 'Node 1', color: '#3b82f6' },
    { id: 2, x: 150, y: 50, label: 'Node 2', color: '#8b5cf6' },
    { id: 3, x: 250, y: 50, label: 'Node 3', color: '#22c55e' },
    { id: 4, x: 100, y: 130, label: 'Node 4', color: '#f59e0b' },
    { id: 5, x: 200, y: 130, label: 'Node 5', color: '#ec4899' },
  ];
  
  const toggleSelection = (id: number) => {
    if (multiSelectEnabled) {
      setSelectedNodes(prev => 
        prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]
      );
    } else {
      setSelectedNodes([id]);
    }
  };
  
  const selectAll = () => setSelectedNodes(nodes.map(n => n.id));
  const clearSelection = () => setSelectedNodes([]);
  
  const codeSnippet = `<KiteFrameCanvas
  selectionMode="${selectionMode}"
  multiSelectEnabled={${multiSelectEnabled}}
  showSelectionBox={${showSelectionBox}}
  selectedNodes={selectedNodes}
  onSelectionChange={setSelectedNodes}
/>

// Keyboard shortcuts
// Click = Select single node
// Ctrl/Cmd + Click = Toggle selection
// Ctrl/Cmd + A = Select all
// Escape = Clear selection`;

  return (
    <div className="space-y-6" data-testid="demo-selection">
      <h2 className="text-2xl font-bold mb-4">Selection System</h2>
      
      <p className="text-muted-foreground mb-4">
        Multiple selection modes with keyboard modifiers and box/lasso selection support.
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DemoPreview title="Selection Demo">
            <div className="flex flex-col h-[300px]">
              <div className="flex items-center gap-2 mb-4">
                <Button size="sm" variant="outline" onClick={selectAll} data-testid="button-select-all">
                  Select All
                </Button>
                <Button size="sm" variant="outline" onClick={clearSelection} data-testid="button-clear-selection">
                  Clear
                </Button>
                <span className="text-sm text-muted-foreground ml-auto" data-testid="text-selection-count">
                  {selectedNodes.length} selected
                </span>
              </div>
              
              <div className="flex-1 relative bg-white dark:bg-slate-800 rounded-lg overflow-hidden">
                <svg width="100%" height="100%" viewBox="0 0 300 180">
                  {nodes.map(node => (
                    <g 
                      key={node.id} 
                      onClick={() => toggleSelection(node.id)}
                      className="cursor-pointer"
                      data-testid={`node-${node.id}`}
                    >
                      <rect
                        x={node.x - 30}
                        y={node.y - 20}
                        width={60}
                        height={40}
                        rx={8}
                        fill={node.color}
                        stroke={selectedNodes.includes(node.id) ? '#fff' : 'transparent'}
                        strokeWidth={3}
                        className="transition-all"
                      />
                      {selectedNodes.includes(node.id) && showSelectionBox && (
                        <rect
                          x={node.x - 34}
                          y={node.y - 24}
                          width={68}
                          height={48}
                          rx={10}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          strokeDasharray="4"
                          className="animate-pulse"
                        />
                      )}
                      <text x={node.x} y={node.y + 5} textAnchor="middle" className="text-xs fill-white font-medium pointer-events-none">
                        {node.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          </DemoPreview>
        </div>
        
        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Props</CardTitle>
            </CardHeader>
            <CardContent>
              <PropControl 
                label="Selection Mode" 
                type="select" 
                value={selectionMode} 
                onChange={(v) => setSelectionMode(v as 'click' | 'box' | 'lasso')}
                options={[
                  { value: 'click', label: 'Click' },
                  { value: 'box', label: 'Box Select' },
                  { value: 'lasso', label: 'Lasso' },
                ]}
              />
              <PropControl label="Multi-Select" type="boolean" value={multiSelectEnabled} onChange={setMultiSelectEnabled} />
              <PropControl label="Show Selection Box" type="boolean" value={showSelectionBox} onChange={setShowSelectionBox} />
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Code className="w-4 h-4" />
            Generated Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={codeSnippet} />
        </CardContent>
      </Card>
    </div>
  );
}

function MinimapDemo() {
  const [showMinimap, setShowMinimap] = useState(true);
  const [minimapPosition, setMinimapPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>('bottom-right');
  const [minimapSize, setMinimapSize] = useState(150);
  const [zoom, setZoom] = useState(100);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  
  const handleZoom = (delta: number) => {
    setZoom(Math.max(25, Math.min(200, zoom + delta)));
  };
  
  const codeSnippet = `<KiteFrameCanvas
  showMinimap={${showMinimap}}
  minimapPosition="${minimapPosition}"
  minimapSize={${minimapSize}}
  zoom={${zoom / 100}}
  pan={{ x: ${panX}, y: ${panY} }}
  onZoomChange={(newZoom) => setZoom(newZoom)}
  onPanChange={({ x, y }) => { setPanX(x); setPanY(y); }}
/>

// Zoom controls
// Mouse wheel = Zoom in/out
// Ctrl + 0 = Reset zoom
// Ctrl + + = Zoom in
// Ctrl + - = Zoom out`;

  const positionClasses: Record<string, string> = {
    'bottom-right': 'bottom-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'top-right': 'top-2 right-2',
    'top-left': 'top-2 left-2',
  };

  return (
    <div className="space-y-6" data-testid="demo-minimap">
      <h2 className="text-2xl font-bold mb-4">Minimap & Navigation</h2>
      
      <p className="text-muted-foreground mb-4">
        Navigate large canvases with the minimap overview and zoom/pan controls.
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DemoPreview title="Navigation Demo">
            <div className="flex flex-col h-[300px]">
              <div className="flex items-center gap-2 mb-4">
                <Button size="sm" variant="outline" onClick={() => handleZoom(-10)} data-testid="button-zoom-out">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm font-mono w-16 text-center" data-testid="text-zoom-level">{zoom}%</span>
                <Button size="sm" variant="outline" onClick={() => handleZoom(10)} data-testid="button-zoom-in">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setZoom(100); setPanX(0); setPanY(0); }} data-testid="button-reset-view">
                  <Maximize className="w-4 h-4 mr-1" /> Reset
                </Button>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setPanX(panX - 20)} data-testid="button-pan-left">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPanY(panY - 20)} data-testid="button-pan-up">
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPanY(panY + 20)} data-testid="button-pan-down">
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPanX(panX + 20)} data-testid="button-pan-right">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 relative bg-white dark:bg-slate-800 rounded-lg overflow-hidden">
                <svg 
                  width="100%" 
                  height="100%" 
                  viewBox={`${-panX} ${-panY} ${300 * (100/zoom)} ${200 * (100/zoom)}`}
                  className="transition-all"
                >
                  <defs>
                    <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="500" height="400" fill="url(#smallGrid)" />
                  <rect x="50" y="50" width="80" height="50" rx="8" fill="#3b82f6" />
                  <rect x="180" y="80" width="80" height="50" rx="8" fill="#22c55e" />
                  <rect x="100" y="150" width="80" height="50" rx="8" fill="#f59e0b" />
                  <path d="M 130 75 L 180 105" stroke="#94a3b8" strokeWidth="2" />
                  <path d="M 180 130 L 140 150" stroke="#94a3b8" strokeWidth="2" />
                </svg>
                
                {showMinimap && (
                  <div 
                    className={`absolute ${positionClasses[minimapPosition]} bg-slate-100 dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 shadow-lg`}
                    style={{ width: minimapSize, height: minimapSize * 0.66 }}
                    data-testid="minimap-container"
                  >
                    <svg width="100%" height="100%" viewBox="0 0 300 200">
                      <rect width="300" height="200" fill="#f1f5f9" />
                      <rect x="50" y="50" width="80" height="50" rx="4" fill="#3b82f6" opacity="0.5" />
                      <rect x="180" y="80" width="80" height="50" rx="4" fill="#22c55e" opacity="0.5" />
                      <rect x="100" y="150" width="80" height="50" rx="4" fill="#f59e0b" opacity="0.5" />
                      <rect 
                        x={panX} 
                        y={panY} 
                        width={300 * (100/zoom)} 
                        height={200 * (100/zoom)} 
                        fill="none" 
                        stroke="#3b82f6" 
                        strokeWidth="2"
                        rx="2"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </DemoPreview>
        </div>
        
        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Props</CardTitle>
            </CardHeader>
            <CardContent>
              <PropControl label="Show Minimap" type="boolean" value={showMinimap} onChange={setShowMinimap} />
              <PropControl 
                label="Position" 
                type="select" 
                value={minimapPosition} 
                onChange={(v) => setMinimapPosition(v as 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left')}
                options={[
                  { value: 'bottom-right', label: 'Bottom Right' },
                  { value: 'bottom-left', label: 'Bottom Left' },
                  { value: 'top-right', label: 'Top Right' },
                  { value: 'top-left', label: 'Top Left' },
                ]}
              />
              <PropControl label="Minimap Size" type="number" value={minimapSize} onChange={setMinimapSize} />
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Code className="w-4 h-4" />
            Generated Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={codeSnippet} />
        </CardContent>
      </Card>
    </div>
  );
}

function PluginHooksDemo() {
  const [activeHooks, setActiveHooks] = useState<string[]>(['onNodeClick', 'onEdgeCreate']);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [showEventLog, setShowEventLog] = useState(true);
  
  const hooks = [
    { id: 'onNodeClick', label: 'onNodeClick', description: 'Fired when a node is clicked' },
    { id: 'onNodeDrag', label: 'onNodeDrag', description: 'Fired during node drag' },
    { id: 'onNodeDrop', label: 'onNodeDrop', description: 'Fired when node drag ends' },
    { id: 'onEdgeCreate', label: 'onEdgeCreate', description: 'Fired when edge is created' },
    { id: 'onEdgeDelete', label: 'onEdgeDelete', description: 'Fired when edge is deleted' },
    { id: 'onCanvasClick', label: 'onCanvasClick', description: 'Fired on canvas background click' },
    { id: 'onSelectionChange', label: 'onSelectionChange', description: 'Fired when selection changes' },
    { id: 'onZoomChange', label: 'onZoomChange', description: 'Fired when zoom level changes' },
  ];
  
  const toggleHook = (hookId: string) => {
    setActiveHooks(prev => 
      prev.includes(hookId) ? prev.filter(h => h !== hookId) : [...prev, hookId]
    );
  };
  
  const simulateEvent = (hookId: string) => {
    if (activeHooks.includes(hookId)) {
      const timestamp = new Date().toLocaleTimeString();
      setEventLog(prev => [`[${timestamp}] ${hookId} triggered`, ...prev.slice(0, 9)]);
    }
  };
  
  const codeSnippet = `// Register plugin hooks
useKiteFramePlugin({
  id: 'my-plugin',
  hooks: {
${activeHooks.map(h => `    ${h}: (event) => {
      console.log('${h}', event);
    },`).join('\n')}
  }
});

// Or use the event emitter directly
kiteframe.on('${activeHooks[0] || 'onNodeClick'}', (event) => {
  // Handle event
});`;

  return (
    <div className="space-y-6" data-testid="demo-plugin-hooks">
      <h2 className="text-2xl font-bold mb-4">Plugin Hooks</h2>
      
      <p className="text-muted-foreground mb-4">
        Extend KiteFrame functionality with plugin hooks. Subscribe to events and add custom behavior.
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DemoPreview title="Event System Demo">
            <div className="flex flex-col h-[300px]">
              <div className="grid grid-cols-4 gap-2 mb-4">
                {hooks.slice(0, 4).map(hook => (
                  <Button 
                    key={hook.id}
                    size="sm" 
                    variant={activeHooks.includes(hook.id) ? 'default' : 'outline'}
                    onClick={() => simulateEvent(hook.id)}
                    className="text-xs"
                    data-testid={`button-trigger-${hook.id}`}
                  >
                    {hook.label}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {hooks.slice(4).map(hook => (
                  <Button 
                    key={hook.id}
                    size="sm" 
                    variant={activeHooks.includes(hook.id) ? 'default' : 'outline'}
                    onClick={() => simulateEvent(hook.id)}
                    className="text-xs"
                    data-testid={`button-trigger-${hook.id}`}
                  >
                    {hook.label}
                  </Button>
                ))}
              </div>
              
              {showEventLog && (
                <div className="flex-1 overflow-auto bg-slate-900 text-green-400 rounded-lg p-3 font-mono text-sm">
                  <div className="text-xs text-slate-500 mb-2">Event Log</div>
                  {eventLog.length === 0 ? (
                    <div className="text-slate-500">Click hooks above to simulate events...</div>
                  ) : (
                    eventLog.map((log, i) => (
                      <div key={i} className="opacity-90" data-testid={`event-log-${i}`}>{log}</div>
                    ))
                  )}
                </div>
              )}
            </div>
          </DemoPreview>
        </div>
        
        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Active Hooks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {hooks.map(hook => (
                <label 
                  key={hook.id} 
                  className="flex items-center gap-2 text-sm cursor-pointer"
                  data-testid={`label-hook-${hook.id}`}
                >
                  <input 
                    type="checkbox" 
                    checked={activeHooks.includes(hook.id)}
                    onChange={() => toggleHook(hook.id)}
                    className="rounded"
                    data-testid={`input-hook-${hook.id}`}
                  />
                  <span className={activeHooks.includes(hook.id) ? 'font-medium' : 'text-muted-foreground'}>
                    {hook.label}
                  </span>
                </label>
              ))}
              <Separator className="my-2" />
              <PropControl label="Show Event Log" type="boolean" value={showEventLog} onChange={setShowEventLog} />
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Code className="w-4 h-4" />
            Generated Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={codeSnippet} />
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentationContent({ sectionId }: { sectionId: string }) {
  switch (sectionId) {
    case 'overview':
    case 'overview-intro':
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">Introduction</h2>
            <p className="text-muted-foreground mb-4">
              Kiteframe is a visual workflow editor for creating and managing interactive diagrams with various node types. 
              It features a modern UI with drag-and-drop functionality, real-time canvas interactions, and AI integration 
              for workflow processing and generation.
            </p>
            <p className="text-muted-foreground">
              The project aims to provide core workflow editing capabilities with advanced features delivered through a 
              plugin architecture. The core canvas library has been extracted into an open-source npm package, 
              Kiteline (<code className="bg-muted px-1 rounded">@kiteline/core</code>).
            </p>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Key Capabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-2 gap-2">
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Visual workflow editing</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> AI-powered generation</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Figma import</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> PRD generation</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Multi-user collaboration</li>
                <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-green-500" /> Plugin architecture</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      );
      
    case 'overview-goals':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Project Goals</h2>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Workflow className="w-5 h-5 text-blue-500" />
                  Core Workflow Editing
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Provide intuitive drag-and-drop workflow creation with rich node types, edge connections, and automatic layout algorithms.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-purple-500" />
                  AI-First Design
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Enable users to generate workflows from natural language, analyze images/Figma designs, and auto-generate PRDs from workflow structure.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5 text-orange-500" />
                  Extensibility via Plugins
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Maintain a clean core with advanced features delivered through a plugin architecture, enabling customization without bloat.
              </CardContent>
            </Card>
          </div>
        </div>
      );
      
    case 'overview-services':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Multi-Service Architecture</h2>
          <p className="text-muted-foreground mb-6">
            Kiteframe consists of three main services that work together:
          </p>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Kiteframe (Main App)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                The main visual workflow editor web application. Handles user authentication, project management, canvas rendering, and AI interactions.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Kiteline Library (@kiteline/core)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Extracted standalone open-source npm package containing the core canvas library. Includes all node types, edge types, layouts, and plugin system.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">KitelineAI</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Dedicated Ollama service for privacy-focused AI processing. Runs on Replit Autoscale with optimized models (Gemma2 2B, Llama 3.2 3B).
              </CardContent>
            </Card>
          </div>
        </div>
      );
      
    case 'tech-stack':
    case 'tech-frontend':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Frontend Technology Stack</h2>
          
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-blue-500" />
                  Core Framework
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">React 18</div>
                    <div className="text-muted-foreground">UI library with concurrent features</div>
                  </div>
                  <div>
                    <div className="font-medium">TypeScript</div>
                    <div className="text-muted-foreground">Type-safe JavaScript</div>
                  </div>
                  <div>
                    <div className="font-medium">Vite</div>
                    <div className="text-muted-foreground">Fast build tool and dev server</div>
                  </div>
                  <div>
                    <div className="font-medium">Wouter</div>
                    <div className="text-muted-foreground">Lightweight routing (1.5kb)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="w-5 h-5 text-pink-500" />
                  UI & Styling
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Radix UI</div>
                    <div className="text-muted-foreground">Accessible component primitives</div>
                  </div>
                  <div>
                    <div className="font-medium">shadcn/ui</div>
                    <div className="text-muted-foreground">Pre-built component patterns</div>
                  </div>
                  <div>
                    <div className="font-medium">Tailwind CSS</div>
                    <div className="text-muted-foreground">Utility-first styling</div>
                  </div>
                  <div>
                    <div className="font-medium">Lucide Icons</div>
                    <div className="text-muted-foreground">Icon library</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-green-500" />
                  State Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">TanStack Query</div>
                    <div className="text-muted-foreground">Server state management</div>
                  </div>
                  <div>
                    <div className="font-medium">React Hooks</div>
                    <div className="text-muted-foreground">Local state (useState, useReducer)</div>
                  </div>
                  <div>
                    <div className="font-medium">React Context</div>
                    <div className="text-muted-foreground">Cross-component state sharing</div>
                  </div>
                  <div>
                    <div className="font-medium">localStorage</div>
                    <div className="text-muted-foreground">Persistence for preferences</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
      
    case 'tech-backend':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Backend Technology Stack</h2>
          
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Server className="w-5 h-5 text-green-500" />
                  Runtime & Framework
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Node.js</div>
                    <div className="text-muted-foreground">JavaScript runtime</div>
                  </div>
                  <div>
                    <div className="font-medium">Express.js</div>
                    <div className="text-muted-foreground">Web framework</div>
                  </div>
                  <div>
                    <div className="font-medium">TypeScript</div>
                    <div className="text-muted-foreground">ES modules</div>
                  </div>
                  <div>
                    <div className="font-medium">tsx</div>
                    <div className="text-muted-foreground">TypeScript execution</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="w-5 h-5 text-purple-500" />
                  Authentication
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Passport.js</div>
                    <div className="text-muted-foreground">Authentication middleware</div>
                  </div>
                  <div>
                    <div className="font-medium">express-session</div>
                    <div className="text-muted-foreground">Session management</div>
                  </div>
                  <div>
                    <div className="font-medium">connect-pg-simple</div>
                    <div className="text-muted-foreground">PostgreSQL session store</div>
                  </div>
                  <div>
                    <div className="font-medium">OAuth2</div>
                    <div className="text-muted-foreground">Google, GitHub, Replit</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">API Structure</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                RESTful API with <code className="bg-muted px-1 rounded">/api</code> prefix. Routes defined in <code className="bg-muted px-1 rounded">server/routes.ts</code> with thin route handlers delegating to storage interface.
              </CardContent>
            </Card>
          </div>
          
          <CodeBlock code={`// Example route structure
app.get('/api/auth/user', requireAuth, async (req, res) => {
  const user = await storage.getUser(req.session.userId);
  res.json(user);
});

app.post('/api/projects', requireAuth, async (req, res) => {
  const validated = projectSchema.parse(req.body);
  const project = await storage.createProject(validated);
  res.json(project);
});`} />
        </div>
      );
      
    case 'tech-database':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Database Stack</h2>
          
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-500" />
                  PostgreSQL (Neon)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Serverless PostgreSQL via Neon. Provides automatic scaling, branching for development, and built-in connection pooling.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Drizzle ORM</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Type-safe ORM with SQL-like syntax. Schema definitions in <code className="bg-muted px-1 rounded">shared/schema.ts</code> using Drizzle Kit for migrations.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Zod Validation</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Schema validation using <code className="bg-muted px-1 rounded">drizzle-zod</code> for automatic insert/select schema generation.
              </CardContent>
            </Card>
          </div>
          
          <CodeBlock code={`// shared/schema.ts example
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  isBeta: boolean('is_beta').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true 
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;`} />
        </div>
      );
      
    case 'tech-ai':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">AI Services</h2>
          
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-purple-500" />
                  OpenAI
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Primary AI provider using GPT-4o for workflow generation, PRD creation, and image analysis. Standard privacy tier.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">KitelineAI (Ollama)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Self-hosted Ollama service for maximum privacy. Runs on Replit Autoscale with Gemma2 2B and Llama 3.2 3B models optimized for fast startup.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">API Compatibility</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Both providers use OpenAI-compatible API format, allowing seamless switching between cloud and local AI.
              </CardContent>
            </Card>
          </div>
        </div>
      );
      
    case 'tech-dependencies':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Key Dependencies</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Frontend</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1 font-mono">
                <div>react: ^18.x</div>
                <div>@tanstack/react-query: ^5.x</div>
                <div>wouter: ^3.x</div>
                <div>tailwindcss: ^3.x</div>
                <div>@radix-ui/*: latest</div>
                <div>lucide-react: latest</div>
                <div>framer-motion: latest</div>
                <div>react-hook-form: latest</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Backend</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1 font-mono">
                <div>express: ^4.x</div>
                <div>drizzle-orm: latest</div>
                <div>@neondatabase/serverless</div>
                <div>passport: ^0.7.x</div>
                <div>stripe: latest</div>
                <div>openai: latest</div>
                <div>zod: ^3.x</div>
                <div>multer: latest</div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
      
    case 'architecture':
    case 'arch-system':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">System Architecture Overview</h2>
          <p className="text-muted-foreground mb-6">
            Kiteframe follows a modern full-stack architecture with clear separation between frontend, backend, and external services.
          </p>
          <ArchitectureDiagram />
        </div>
      );
      
    case 'arch-frontend':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Frontend Architecture</h2>
          
          <p className="text-muted-foreground mb-4">
            The frontend is structured around React with clear component organization:
          </p>
          
          <CodeBlock code={`client/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── landing/         # Landing page components
│   │   ├── project/         # Project panel components
│   │   └── workflow/        # Workflow-specific components
│   ├── pages/               # Route components
│   ├── hooks/               # Custom React hooks
│   ├── lib/
│   │   ├── kiteframe/       # Canvas library
│   │   └── queryClient.ts   # TanStack Query setup
│   ├── ai/                  # AI integration layer
│   │   ├── kiteaiState.ts   # State machine
│   │   ├── actionability.ts # Scoring logic
│   │   └── guards/          # PM depth guards
│   └── contexts/            # React contexts`} language="bash" />
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Key Patterns</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <div><strong>Lazy Loading:</strong> All pages use React.lazy() for code splitting</div>
              <div><strong>Server State:</strong> TanStack Query for all API data fetching</div>
              <div><strong>Form Handling:</strong> react-hook-form with Zod validation</div>
              <div><strong>Protected Routes:</strong> BetaProtectedRoute wrapper for access control</div>
            </CardContent>
          </Card>
        </div>
      );
      
    case 'arch-backend':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Backend Architecture</h2>
          
          <CodeBlock code={`server/
├── index.ts           # Entry point
├── routes.ts          # API route definitions
├── storage.ts         # IStorage interface + implementations
├── auth.ts            # Passport.js configuration
├── vite.ts            # Vite dev server integration
└── db.ts              # Database connection`} language="bash" />
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Storage Interface Pattern</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              All database operations go through the IStorage interface, allowing easy swapping between implementations (PostgreSQL, in-memory for testing).
            </CardContent>
          </Card>
          
          <CodeBlock code={`// server/storage.ts
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | null>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  
  // Project operations
  getProject(id: string): Promise<Project | null>;
  getProjectsByUser(userId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  
  // ... more CRUD operations
}

export class DatabaseStorage implements IStorage {
  // PostgreSQL implementation
}

export class MemStorage implements IStorage {
  // In-memory implementation for development
}`} />
        </div>
      );
      
    case 'arch-data-flow':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Data Flow</h2>
          
          <DataFlowDiagram />
          
          <div className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Request Flow</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Frontend makes API call via TanStack Query</li>
                  <li>Express middleware validates session/auth</li>
                  <li>Route handler validates request body with Zod</li>
                  <li>Storage interface performs database operation</li>
                  <li>Response returned, TanStack Query caches result</li>
                </ol>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI Generation Flow</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ol className="list-decimal list-inside space-y-1">
                  <li>User input enters KiteAI state machine</li>
                  <li>Actionability scoring evaluates completeness</li>
                  <li>PM depth guards validate reasoning quality</li>
                  <li>Request sent to AI provider (OpenAI/Ollama)</li>
                  <li>Response parsed into workflow nodes/edges</li>
                  <li>Canvas renders generated workflow</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      );
      
    case 'canvas':
    case 'canvas-overview':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Canvas Library Overview</h2>
          
          <p className="text-muted-foreground mb-4">
            KiteFrame is the core canvas library powering the workflow editor. It's designed as a standalone, 
            extensible React component with plugin architecture.
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Core Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 12 built-in node types</div>
                <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 6 edge types</div>
                <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> 5 auto-layout algorithms</div>
                <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Undo/redo system</div>
                <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Plugin architecture</div>
                <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Minimap navigation</div>
                <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Multi-selection</div>
                <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Keyboard shortcuts</div>
              </div>
            </CardContent>
          </Card>
          
          <CodeBlock code={`// Basic usage
import { KiteFrameCanvas, PluginProvider } from '@kiteline/core';

function Editor() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  return (
    <PluginProvider>
      <KiteFrameCanvas
        nodes={nodes}
        edges={edges}
        viewport={viewport}
        onNodesChange={setNodes}
        onEdgesChange={setEdges}
        onViewportChange={setViewport}
      />
    </PluginProvider>
  );
}`} />
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">File Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock code={`client/src/lib/kiteframe/
├── components/
│   ├── KiteFrameCanvas.tsx    # Main canvas component
│   ├── nodes/                 # Node type components
│   └── edges/                 # Edge rendering
├── core/
│   ├── KiteFrameCore.ts       # Plugin system
│   └── PluginProvider.tsx     # React integration
├── hooks/                     # Canvas hooks
├── plugins/                   # Built-in plugins
├── types.ts                   # TypeScript definitions
└── utils/                     # Helper functions`} language="bash" />
            </CardContent>
          </Card>
        </div>
      );
      
    case 'canvas-nodes':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Node System</h2>
          
          <p className="text-muted-foreground mb-4">
            KiteFrame provides 12 built-in node types organized into categories:
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Basic Nodes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <div><Badge variant="outline">input</Badge> Entry points</div>
                <div><Badge variant="outline">process</Badge> Processing steps</div>
                <div><Badge variant="outline">condition</Badge> Decision branches</div>
                <div><Badge variant="outline">output</Badge> Exit points</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">AI & Media</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <div><Badge variant="outline">ai</Badge> AI processing</div>
                <div><Badge variant="outline">image</Badge> Image content</div>
                <div><Badge variant="outline">webview</Badge> Embedded content</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Data Nodes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <div><Badge variant="outline">table</Badge> Data tables</div>
                <div><Badge variant="outline">form</Badge> Form inputs</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Advanced</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <div><Badge variant="outline">code</Badge> Code snippets</div>
                <div><Badge variant="outline">render</Badge> Custom render</div>
                <div><Badge variant="outline">compound</Badge> Nested nodes</div>
              </CardContent>
            </Card>
          </div>
          
          <CodeBlock code={`// Node type definition
interface Node {
  id: string;
  type: NodeType; // 'input' | 'process' | 'condition' | ...
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    colors?: NodeColors;
    status?: 'todo' | 'in-progress' | 'done';
    // ... type-specific data
  };
  width?: number;
  height?: number;
  selected?: boolean;
  draggable?: boolean;
}`} />
        </div>
      );
      
    case 'canvas-edges':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Edge System</h2>
          
          <p className="text-muted-foreground mb-4">
            Six edge types with extensive styling options:
          </p>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="font-medium mb-1">Bezier</div>
                <div className="text-xs text-muted-foreground">Smooth curves</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="font-medium mb-1">Straight</div>
                <div className="text-xs text-muted-foreground">Direct lines</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="font-medium mb-1">Step</div>
                <div className="text-xs text-muted-foreground">Right angles</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="font-medium mb-1">Smoothstep</div>
                <div className="text-xs text-muted-foreground">Rounded corners</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="font-medium mb-1">Curved</div>
                <div className="text-xs text-muted-foreground">Arc curves</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="font-medium mb-1">Orthogonal</div>
                <div className="text-xs text-muted-foreground">Smart routing</div>
              </CardContent>
            </Card>
          </div>
          
          <CodeBlock code={`// Edge type definition
interface Edge {
  id: string;
  source: string;
  target: string;
  type?: 'bezier' | 'straight' | 'step' | 'smoothstep' | 'curved' | 'orthogonal';
  animated?: boolean;
  label?: string;
  style?: {
    stroke?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
    gradient?: { type: 'linear' | 'radial', stops: [...] };
    glow?: { color: string, intensity: number };
  };
  markers?: {
    type: 'arrow' | 'circle' | 'square' | 'diamond';
    size?: number;
    position?: 'start' | 'end' | 'both';
  };
}`} />
        </div>
      );
      
    case 'canvas-viewport':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Viewport & Rendering</h2>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Viewport State</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              The viewport tracks pan position (x, y) and zoom level. Default zoom range is 0.1x to 3x.
            </CardContent>
          </Card>
          
          <CodeBlock code={`interface Viewport {
  x: number;      // Pan X offset
  y: number;      // Pan Y offset
  zoom: number;   // Zoom level (0.1 - 3.0)
}

// Canvas props
<KiteFrameCanvas
  viewport={viewport}
  onViewportChange={setViewport}
  minZoom={0.1}
  maxZoom={3}
  disablePan={false}
  disableWheelZoom={false}
/>`} />
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Rendering Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div><strong>1. Virtualization:</strong> Only visible nodes are rendered</div>
              <div><strong>2. Batch Rendering:</strong> RenderBatchManager coalesces updates at 60 FPS</div>
              <div><strong>3. Layer System:</strong> Edges → Nodes → Objects → Selection → UI</div>
              <div><strong>4. Transform:</strong> CSS transform for smooth pan/zoom</div>
            </CardContent>
          </Card>
        </div>
      );
      
    case 'canvas-objects':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Canvas Objects</h2>
          
          <p className="text-muted-foreground mb-4">
            Beyond nodes, KiteFrame supports canvas objects for annotations and visual organization:
          </p>
          
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="font-medium mb-1">Sticky Notes</div>
                <div className="text-xs text-muted-foreground">Quick annotations with color coding</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="font-medium mb-1">Shapes</div>
                <div className="text-xs text-muted-foreground">Rectangle, circle, hexagon</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="font-medium mb-1">Text</div>
                <div className="text-xs text-muted-foreground">Labels and headers</div>
              </CardContent>
            </Card>
          </div>
          
          <CodeBlock code={`interface CanvasObject {
  id: string;
  type: 'text' | 'sticky' | 'shape';
  position: { x: number; y: number };
  data: {
    content?: string;
    shapeType?: 'rectangle' | 'circle' | 'hexagon';
    color?: string;
    fontSize?: number;
  };
  width?: number;
  height?: number;
}`} />
        </div>
      );
      
    case 'canvas-layouts':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Auto-Layout Algorithms</h2>
          
          <p className="text-muted-foreground mb-4">
            Five built-in layout algorithms for organizing workflows:
          </p>
          
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Horizontal Flow</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Left-to-right organization following edge direction. Best for linear processes.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Vertical Flow</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Top-to-bottom structure. Good for hierarchical workflows.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Grid Layout</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Neat grid arrangement with configurable columns. Best for many parallel nodes.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Circular</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Radial placement around a center point. Good for hub-and-spoke patterns.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Hierarchical</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Tree-based organization following parent-child relationships.
              </CardContent>
            </Card>
          </div>
          
          <CodeBlock code={`import { applyLayout } from '@kiteline/core';

// Apply layout to nodes
const layoutedNodes = applyLayout(nodes, edges, {
  algorithm: 'horizontal', // | 'vertical' | 'grid' | 'circular' | 'hierarchical'
  spacing: { x: 200, y: 150 },
  origin: { x: 100, y: 100 },
});`} />
        </div>
      );
      
    case 'canvas-undo-redo':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Undo/Redo System</h2>
          
          <p className="text-muted-foreground mb-4">
            Command pattern implementation with batching and debouncing for efficient history management.
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Key Features</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <div><strong>Command Pattern:</strong> Each action is encapsulated as a reversible command</div>
              <div><strong>Batching:</strong> Multiple rapid changes are grouped into single undo steps</div>
              <div><strong>Debouncing:</strong> Prevents history spam during continuous operations (drag, resize)</div>
              <div><strong>Memory Limits:</strong> Configurable history depth (default: 50 steps)</div>
            </CardContent>
          </Card>
          
          <CodeBlock code={`// Using undo/redo hooks
import { useUndoRedo } from '@kiteline/core';

function Editor() {
  const { 
    canUndo, 
    canRedo, 
    undo, 
    redo, 
    pushState,
    clearHistory 
  } = useUndoRedo();

  // Keyboard shortcuts are built-in
  // Ctrl/Cmd + Z = Undo
  // Ctrl/Cmd + Y = Redo
}`} />
        </div>
      );
      
    case 'plugins':
    case 'plugins-core':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Plugin Core Architecture</h2>
          
          <p className="text-muted-foreground mb-4">
            The plugin system is managed by KiteFrameCore, which handles registration, lifecycle, and event communication.
          </p>
          
          <CodeBlock code={`// core/KiteFrameCore.ts
class KiteFrameCore {
  private plugins: Map<string, KiteFramePlugin>;
  private hooks: PluginHooks;
  private eventListeners: Map<string, Callback[]>;
  
  // Register a plugin
  use(plugin: KiteFramePlugin): this {
    if (plugin.dependencies) {
      // Verify dependencies are loaded
    }
    this.plugins.set(plugin.name, plugin);
    plugin.initialize(this);
    return this;
  }
  
  // Unregister a plugin
  unuse(pluginName: string): this {
    const plugin = this.plugins.get(pluginName);
    plugin?.cleanup?.();
    this.plugins.delete(pluginName);
    return this;
  }
  
  // Event system
  emit(event: string, data?: any): void;
  on(event: string, callback: Callback): () => void;
}`} />
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Plugin Interface</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock code={`interface KiteFramePlugin {
  name: string;           // Unique identifier
  version: string;        // For compatibility
  dependencies?: string[]; // Required plugins
  initialize: (core: KiteFrameCore) => void;
  cleanup?: () => void;
  config?: Record<string, any>;
}`} />
            </CardContent>
          </Card>
        </div>
      );
      
    case 'plugins-hooks':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Extension Points (Hooks)</h2>
          
          <p className="text-muted-foreground mb-4">
            Plugins can tap into 8 extension points to modify canvas behavior:
          </p>
          
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-mono">beforeNodesChange / afterNodesChange</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Intercept or react to node modifications. beforeNodesChange can transform nodes before they're applied.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-mono">beforeEdgesChange / afterEdgesChange</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Same pattern for edge modifications.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-mono">onNodesSelected</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Called when selection changes. Receives array of selected node IDs.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-mono">onCanvasClick</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Called on canvas background clicks with mouse event and world coordinates.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-mono">onConnectionAttempt</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Validate or block new connections. Return false to prevent the connection.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-mono">nodeRenderers / edgeRenderers</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Register custom React components for new node/edge types.
              </CardContent>
            </Card>
          </div>
        </div>
      );
      
    case 'plugins-creating':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Creating Plugins</h2>
          
          <p className="text-muted-foreground mb-4">
            Example of creating a custom plugin:
          </p>
          
          <CodeBlock code={`// plugins/my-custom-plugin.ts
import { KiteFramePlugin, KiteFrameCore } from '@kiteline/core';

export const myCustomPlugin: KiteFramePlugin = {
  name: 'my-custom-plugin',
  version: '1.0.0',
  dependencies: [], // Optional: require other plugins
  
  initialize(core: KiteFrameCore) {
    // Register hooks
    core.registerPluginHooks('my-custom-plugin', {
      beforeNodesChange: (nodes) => {
        // Transform nodes before they're applied
        return nodes.map(node => ({
          ...node,
          data: { ...node.data, modifiedByPlugin: true }
        }));
      },
      
      onNodesSelected: (nodeIds) => {
        console.log('Selected:', nodeIds);
        // Emit custom event
        core.emit('my-plugin:selection', { nodeIds });
      },
      
      onConnectionAttempt: (sourceId, targetId) => {
        // Validate connections
        if (sourceId === targetId) return false;
        return true;
      },
    });
    
    // Listen to events
    core.on('canvas:ready', () => {
      console.log('Canvas is ready!');
    });
  },
  
  cleanup() {
    // Clean up subscriptions, timers, etc.
  }
};

// Register the plugin
import { kiteFrameCore } from '@kiteline/core';
kiteFrameCore.use(myCustomPlugin);`} />
        </div>
      );
      
    case 'plugins-pro':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Pro Plugins</h2>
          
          <p className="text-muted-foreground mb-4">
            Premium plugins with advanced functionality:
          </p>
          
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge className="bg-purple-500">Pro</Badge>
                  Advanced Interactions
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <div>• Quick-add node handles with (+) buttons</div>
                <div>• Smart positioning for new nodes</div>
                <div>• Ghost previews during creation</div>
                <div>• Enhanced multi-selection with rubber-band</div>
                <div>• Copy/paste with smart positioning</div>
                <div>• Edge endpoint reconnection</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge className="bg-purple-500">Pro</Badge>
                  Collaboration
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <div>• Real-time collaborative editing</div>
                <div>• Live cursors showing other users</div>
                <div>• Comment threads on nodes</div>
                <div>• Presence indicators</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge className="bg-purple-500">Pro</Badge>
                  Version Control
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <div>• Full history tracking</div>
                <div>• Visual diff comparison</div>
                <div>• Rollback to any version</div>
                <div>• Branch and merge workflows</div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
      
    case 'ai':
    case 'ai-overview':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">AI Integration Overview</h2>
          
          <p className="text-muted-foreground mb-4">
            Kiteframe's AI layer enables workflow generation from natural language, image analysis, and PRD creation.
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Key Components</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <div><strong>KiteAI State Machine:</strong> Manages conversation flow and generation triggers</div>
              <div><strong>Vision Pipeline:</strong> Unified processing for images, Figma, and text</div>
              <div><strong>Actionability Scoring:</strong> Evaluates input completeness for generation</div>
              <div><strong>PM Depth Guards:</strong> Ensures meaningful product decisions in workflows</div>
              <div><strong>Provider System:</strong> Abstracts OpenAI and Ollama behind common interface</div>
            </CardContent>
          </Card>
          
          <CodeBlock code={`// File locations
client/src/ai/
├── kiteaiState.ts        # State machine
├── actionability.ts      # Scoring logic
├── kiteaiPrompts.ts      # System prompts
├── guards/
│   └── pmDepthGuards.ts  # PM validation
├── prompts/
│   └── system.pm.txt     # PM system prompt
└── providers/
    └── AIProvider.tsx    # Provider context`} language="bash" />
        </div>
      );
      
    case 'ai-kiteai':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">KiteAI Conversation System</h2>
          
          <p className="text-muted-foreground mb-4">
            KiteAI manages the conversational interface for workflow generation. It tracks conversation state,
            sources (text, images, Figma), and determines when to generate workflows.
          </p>
          
          <CodeBlock code={`// kiteaiState.ts
interface KiteAIState {
  phase: 'pre-project' | 'chat' | 'generating';
  conversationHistory: Message[];
  sources: ConversationSource[];
  actionabilityScore: ActionabilityScore;
  visionSignals?: VisionExtractedSignals;
}

interface ConversationSource {
  type: 'text' | 'image' | 'figma';
  content: string;
  metadata?: {
    fileName?: string;
    figmaNodeId?: string;
    extractedSignals?: VisionExtractedSignals;
  };
}`} />
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">State Transitions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ol className="list-decimal list-inside space-y-1">
                <li><strong>pre-project:</strong> Gathering requirements through conversation</li>
                <li><strong>chat:</strong> Refining details, actionability score building</li>
                <li><strong>generating:</strong> Score threshold met, creating workflow</li>
              </ol>
            </CardContent>
          </Card>
          
          <Separator className="my-6" />
          
          <h3 className="text-xl font-semibold mb-4">System Prompts</h3>
          <p className="text-muted-foreground mb-4">
            These prompts define KiteAI's behavior. They are imported directly from the source files,
            so changes to the prompts are automatically reflected here.
          </p>
          
          <div className="space-y-4">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <ChevronRight className="w-4 h-4 transition-transform data-[state=open]:rotate-90" />
                <span className="font-medium">Actionability Rules</span>
                <Badge variant="secondary" className="ml-auto">Hard Gate</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <CodeBlock code={ACTIONABILITY_RULES.trim()} language="text" />
              </CollapsibleContent>
            </Collapsible>
            
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <ChevronRight className="w-4 h-4 transition-transform data-[state=open]:rotate-90" />
                <span className="font-medium">Base System Prompt</span>
                <Badge variant="outline" className="ml-auto">Core</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <CodeBlock code={BASE_SYSTEM_PROMPT.trim()} language="text" />
              </CollapsibleContent>
            </Collapsible>
            
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <ChevronRight className="w-4 h-4 transition-transform data-[state=open]:rotate-90" />
                <span className="font-medium">PM Mode Prompt</span>
                <Badge variant="outline" className="ml-auto">Role</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <CodeBlock code={PM_MODE_PROMPT.trim()} language="text" />
              </CollapsibleContent>
            </Collapsible>
            
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <ChevronRight className="w-4 h-4 transition-transform data-[state=open]:rotate-90" />
                <span className="font-medium">Designer Mode Prompt</span>
                <Badge variant="outline" className="ml-auto">Role</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <CodeBlock code={DESIGNER_MODE_PROMPT.trim()} language="text" />
              </CollapsibleContent>
            </Collapsible>
            
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <ChevronRight className="w-4 h-4 transition-transform data-[state=open]:rotate-90" />
                <span className="font-medium">Vision Analysis Prompt</span>
                <Badge variant="outline" className="ml-auto">Vision</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <CodeBlock code={VISION_ANALYSIS_PROMPT.trim()} language="text" />
              </CollapsibleContent>
            </Collapsible>
          </div>
          
          <Separator className="my-6" />
          
          <h3 className="text-xl font-semibold mb-4">Role System Prompts</h3>
          <p className="text-muted-foreground mb-4">
            These prompts are used by the role selector system (systemPrompts.ts) for specialized reasoning modes.
          </p>
          
          <div className="space-y-4">
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <ChevronRight className="w-4 h-4 transition-transform data-[state=open]:rotate-90" />
                <span className="font-medium">PM System Prompt</span>
                <Badge className="ml-auto bg-blue-500">PM</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <CodeBlock code={PM_SYSTEM_PROMPT.trim()} language="text" />
              </CollapsibleContent>
            </Collapsible>
            
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <ChevronRight className="w-4 h-4 transition-transform data-[state=open]:rotate-90" />
                <span className="font-medium">Designer System Prompt</span>
                <Badge className="ml-auto bg-purple-500">Designer</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <CodeBlock code={DESIGNER_SYSTEM_PROMPT.trim()} language="text" />
              </CollapsibleContent>
            </Collapsible>
            
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <ChevronRight className="w-4 h-4 transition-transform data-[state=open]:rotate-90" />
                <span className="font-medium">Hybrid System Prompt</span>
                <Badge className="ml-auto bg-green-500">Hybrid</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <CodeBlock code={HYBRID_SYSTEM_PROMPT.trim()} language="text" />
              </CollapsibleContent>
            </Collapsible>
          </div>
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Source Files</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc list-inside space-y-1">
                <li><code>client/src/ai/kiteaiPrompts.ts</code> — Main KiteAI prompts</li>
                <li><code>client/src/ai/systemPrompts.ts</code> — Role-based system prompts</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      );
      
    case 'ai-vision':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Unified Vision Pipeline</h2>
          
          <p className="text-muted-foreground mb-4">
            All visual inputs (images, Figma frames) flow through the same processing pipeline as text prompts.
          </p>
          
          <CodeBlock code={`// Vision signals extracted from AI analysis
interface VisionExtractedSignals {
  flowsDetected: number;      // Number of distinct flows
  branching: boolean;         // Has decision points
  screensDetected: number;    // UI screens found
  primaryCTA?: string;        // Main call-to-action
  decisionPoints: string[];   // List of decision points
  entryPoints: string[];      // Flow entry points
}

// Signal extraction via regex from AI response
function extractVisionSignals(response: string): VisionExtractedSignals {
  return {
    flowsDetected: extractNumber(response, /(\d+)\s*flows?/i),
    branching: /branch|decision|if|condition/i.test(response),
    screensDetected: extractNumber(response, /(\d+)\s*screens?/i),
    // ...
  };
}`} />
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Vision Signal Boost</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Vision signals enhance actionability scores by up to 0.3, helping images and Figma imports 
              reach the generation threshold faster than pure text prompts.
            </CardContent>
          </Card>
        </div>
      );
      
    case 'ai-actionability':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Actionability Scoring</h2>
          
          <p className="text-muted-foreground mb-4">
            The actionability system evaluates whether a prompt has enough detail to generate a meaningful workflow.
          </p>
          
          <CodeBlock code={`// actionability.ts
interface ActionabilityScore {
  score: number;           // 0-1, threshold is 0.7
  confidence: 'low' | 'medium' | 'high';
  dimensions: {
    flowSignal: boolean;   // Clear user journey
    scope: boolean;        // Bounded problem
    trigger: boolean;      // Entry point defined
    goal: boolean;         // Success criteria
  };
  missingDimensions: string[];
}

function computeActionabilityWithVision(
  baseScore: ActionabilityScore,
  visionSignals?: VisionExtractedSignals
): ActionabilityScore {
  if (!visionSignals) return baseScore;
  
  let boost = 0;
  if (visionSignals.flowsDetected > 0) boost += 0.1;
  if (visionSignals.branching) boost += 0.1;
  if (visionSignals.screensDetected > 1) boost += 0.1;
  
  return {
    ...baseScore,
    score: Math.min(1, baseScore.score + boost),
  };
}`} />
        </div>
      );
      
    case 'ai-pm-guards':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">PM Depth Guards</h2>
          
          <p className="text-muted-foreground mb-4">
            PM Depth Guards enforce meaningful product decisions in generated workflows, blocking structurally 
            valid but shallow outputs.
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gate Conditions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              At least ONE of the following must be present:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Tradeoff:</strong> Speed vs accuracy, friction vs conversion</li>
                <li><strong>Risk:</strong> Fraud, churn, abuse with mitigations</li>
                <li><strong>Irreversible action:</strong> Account creation, payments, data submission</li>
                <li><strong>Meaningful branching:</strong> Branches lead to different outcomes</li>
              </ul>
            </CardContent>
          </Card>
          
          <CodeBlock code={`// guards/pmDepthGuards.ts
export function detectTradeoff(text: string): boolean {
  const patterns = [
    /speed\s+(vs|versus|or)\s+accuracy/i,
    /friction\s+(vs|versus|or)\s+conversion/i,
    /option\s+[AB]/i,
    /tradeoff|trade-off/i,
  ];
  return patterns.some(p => p.test(text));
}

export function validatePMDepth(workflow: Workflow): ValidationResult {
  const hasTradeoff = detectTradeoff(workflow.semanticModel);
  const hasRisk = detectRisk(workflow.semanticModel);
  const hasIrreversible = detectIrreversible(workflow.semanticModel);
  const hasBranching = detectNonRetryBranches(workflow.edges);
  
  const passes = hasTradeoff || hasRisk || hasIrreversible || hasBranching;
  
  return {
    valid: passes,
    reason: passes ? null : 'Workflow lacks PM-level depth',
  };
}`} />
        </div>
      );
      
    case 'ai-providers':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">AI Providers</h2>
          
          <p className="text-muted-foreground mb-4">
            The AI provider system abstracts different AI services behind a common interface.
          </p>
          
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">OpenAI (Standard Privacy)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Uses GPT-4o for highest quality generation. Data processed by OpenAI servers.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">KitelineAI (Maximum Privacy)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Self-hosted Ollama on Replit Autoscale. Data processed but never stored.
                Uses Gemma2 2B and Llama 3.2 3B optimized for fast cold starts.
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Local Ollama</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Connect to locally-running Ollama instance. Full data sovereignty.
              </CardContent>
            </Card>
          </div>
          
          <CodeBlock code={`// AI Provider Context
interface AIProviderConfig {
  type: 'openai' | 'ollama-kitelineai' | 'ollama-local' | 'ollama-custom';
  model?: string;
  endpoint?: string;
  apiKey?: string;
}

// All providers use OpenAI-compatible API
const response = await fetch(\`\${endpoint}/v1/chat/completions\`, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${apiKey}\`
  },
  body: JSON.stringify({
    model,
    messages,
    stream: true,
  }),
});`} />
        </div>
      );
      
    case 'auth':
    case 'auth-overview':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Authentication Overview</h2>
          
          <p className="text-muted-foreground mb-4">
            Kiteframe uses Passport.js with multiple OAuth providers and PostgreSQL-backed sessions.
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Authentication Flow</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ol className="list-decimal list-inside space-y-1">
                <li>User clicks OAuth provider button</li>
                <li>Redirect to provider (Google/GitHub/Replit)</li>
                <li>Provider callback with user info</li>
                <li>Account linking by email (or create new)</li>
                <li>Session created in PostgreSQL</li>
                <li>Cookie set with session ID</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      );
      
    case 'auth-oauth':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">OAuth Providers</h2>
          
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Google OAuth</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Primary provider. Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
                Callback: /api/auth/google/callback
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">GitHub OAuth</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Secondary provider. Requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.
                Callback: /api/auth/github/callback
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Replit OAuth</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Uses OpenID Connect. Configured via Replit integration.
                Callback: /api/callback
              </CardContent>
            </Card>
          </div>
        </div>
      );
      
    case 'auth-linking':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Account Linking</h2>
          
          <p className="text-muted-foreground mb-4">
            Users can link multiple OAuth providers to a single account using email matching.
          </p>
          
          <CodeBlock code={`// Account linking logic
async function findOrCreateUser(profile: OAuthProfile): Promise<User> {
  // Check if user exists by email
  let user = await storage.getUserByEmail(profile.email);
  
  if (user) {
    // Link this provider to existing account
    await storage.linkProvider(user.id, {
      provider: profile.provider,
      providerId: profile.id,
    });
    return user;
  }
  
  // Create new user
  return storage.createUser({
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
  });
}`} />
        </div>
      );
      
    case 'auth-sessions':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Session Management</h2>
          
          <p className="text-muted-foreground mb-4">
            Sessions are stored in PostgreSQL using connect-pg-simple for persistence and scalability.
          </p>
          
          <CodeBlock code={`// server/auth.ts
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

const PgSession = connectPgSimple(session);

app.use(session({
  store: new PgSession({
    pool: db,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));`} />
        </div>
      );
      
    case 'auth-firebase':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Firebase Sync</h2>
          
          <p className="text-muted-foreground mb-4">
            Frontend Firebase authentication syncs to backend Passport sessions for cloud project access.
          </p>
          
          <CodeBlock code={`// POST /api/auth/firebase-sync
// Syncs Firebase auth token to backend session

async function firebaseSync(req, res) {
  const { idToken } = req.body;
  
  // Verify Firebase token using Admin SDK
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  
  // Find or create user
  const user = await findOrCreateUser({
    email: decodedToken.email,
    provider: 'firebase',
    providerId: decodedToken.uid,
  });
  
  // Create session
  req.session.userId = user.id;
  
  res.json({ success: true, user });
}`} />
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Requirements</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Firebase Admin SDK credentials (FIREBASE_SERVICE_ACCOUNT) required for token verification.
            </CardContent>
          </Card>
        </div>
      );
      
    case 'database':
    case 'db-schema':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Database Schema</h2>
          
          <p className="text-muted-foreground mb-4">
            Core tables in the PostgreSQL database:
          </p>
          
          <CodeBlock code={`// shared/schema.ts - Key tables

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  isBeta: boolean('is_beta').default(false),
  isAdmin: boolean('is_admin').default(false),
  subscriptionTier: text('subscription_tier').default('free'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  name: text('name').notNull(),
  data: jsonb('data'), // Workflow nodes, edges, objects
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at'),
});

export const userCredits = pgTable('user_credits', {
  userId: text('user_id').primaryKey().references(() => users.id),
  credits: integer('credits').default(0),
  isUnlimited: boolean('is_unlimited').default(false),
  lastResetAt: timestamp('last_reset_at'),
});

export const userGroups = pgTable('user_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  accessControls: jsonb('access_controls'),
});`} />
        </div>
      );
      
    case 'db-drizzle':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Drizzle ORM Usage</h2>
          
          <p className="text-muted-foreground mb-4">
            Drizzle provides type-safe database queries with SQL-like syntax.
          </p>
          
          <CodeBlock code={`// Query examples
import { db } from './db';
import { users, projects } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

// Select with conditions
const user = await db.query.users.findFirst({
  where: eq(users.email, email),
  with: {
    projects: true,
    credits: true,
  },
});

// Insert
const [newProject] = await db.insert(projects)
  .values({
    id: crypto.randomUUID(),
    userId: user.id,
    name: 'New Project',
    data: { nodes: [], edges: [] },
  })
  .returning();

// Update
await db.update(users)
  .set({ isBeta: true })
  .where(eq(users.id, userId));

// Delete
await db.delete(projects)
  .where(and(
    eq(projects.id, projectId),
    eq(projects.userId, userId)
  ));`} />
        </div>
      );
      
    case 'db-migrations':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Database Migrations</h2>
          
          <p className="text-muted-foreground mb-4">
            Drizzle Kit handles schema migrations with automatic SQL generation.
          </p>
          
          <CodeBlock code={`# Generate migration from schema changes
npm run db:generate

# Apply pending migrations
npm run db:migrate

# Open Drizzle Studio for visual database management
npm run db:studio`} language="bash" />
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Migration Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>• Always generate migrations after schema changes</div>
              <div>• Review generated SQL before applying</div>
              <div>• Test migrations in development first</div>
              <div>• Never manually edit migration files</div>
            </CardContent>
          </Card>
        </div>
      );
      
    case 'db-storage':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Storage Interface</h2>
          
          <p className="text-muted-foreground mb-4">
            The IStorage interface abstracts database operations, enabling easy testing and implementation swapping.
          </p>
          
          <CodeBlock code={`// server/storage.ts
export interface IStorage {
  // Users
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(data: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  
  // Projects
  getProject(id: string): Promise<Project | null>;
  getProjectsByUser(userId: string): Promise<Project[]>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<Project>): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  
  // Credits
  getUserCredits(userId: string): Promise<UserCredits | null>;
  updateUserCredits(userId: string, credits: number): Promise<void>;
  
  // Groups
  getUserGroups(userId: string): Promise<UserGroup[]>;
  // ... more operations
}

// Implementations
export class DatabaseStorage implements IStorage { /* PostgreSQL */ }
export class MemStorage implements IStorage { /* In-memory for dev */ }`} />
        </div>
      );
      
    case 'subscriptions':
    case 'sub-tiers':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Subscription Tiers</h2>
          
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Free Tier</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="space-y-1">
                  <li>• 50 AI credits/month</li>
                  <li>• Local project storage only</li>
                  <li>• Basic node types</li>
                  <li>• Community support</li>
                </ul>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Advanced Tier - $10/mo</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="space-y-1">
                  <li>• 500 AI credits/month</li>
                  <li>• Local project storage</li>
                  <li>• All node types</li>
                  <li>• Priority support</li>
                </ul>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pro Tier - $25/mo</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="space-y-1">
                  <li>• Unlimited AI credits</li>
                  <li>• Cloud project storage</li>
                  <li>• All node types + Pro plugins</li>
                  <li>• Dedicated support</li>
                  <li>• Team collaboration</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      );
      
    case 'sub-credits':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Credit System</h2>
          
          <p className="text-muted-foreground mb-4">
            AI operations consume credits based on complexity:
          </p>
          
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Workflow generation: <strong>5 credits</strong></div>
                <div>PRD generation: <strong>10 credits</strong></div>
                <div>Image analysis: <strong>3 credits</strong></div>
                <div>Figma import: <strong>5 credits</strong></div>
              </div>
            </CardContent>
          </Card>
          
          <CodeBlock code={`// Credit deduction flow
async function generateWorkflow(userId: string, prompt: string) {
  const credits = await storage.getUserCredits(userId);
  const cost = 5;
  
  if (!credits.isUnlimited && credits.credits < cost) {
    throw new InsufficientCreditsError();
  }
  
  // Generate workflow...
  const workflow = await aiProvider.generate(prompt);
  
  // Deduct credits
  if (!credits.isUnlimited) {
    await storage.updateUserCredits(userId, credits.credits - cost);
  }
  
  return workflow;
}`} />
        </div>
      );
      
    case 'sub-stripe':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Stripe Integration</h2>
          
          <p className="text-muted-foreground mb-4">
            Stripe handles all payment processing, subscription management, and billing.
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Key Endpoints</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div><code className="bg-muted px-1 rounded">POST /api/stripe/create-checkout</code> - Create checkout session</div>
              <div><code className="bg-muted px-1 rounded">POST /api/stripe/portal</code> - Customer portal link</div>
              <div><code className="bg-muted px-1 rounded">POST /api/stripe/webhook</code> - Stripe event handler</div>
            </CardContent>
          </Card>
          
          <CodeBlock code={`// Webhook events handled
switch (event.type) {
  case 'checkout.session.completed':
    // Activate subscription
    await storage.updateUser(userId, {
      subscriptionTier: tier,
      stripeCustomerId: customerId,
    });
    break;
    
  case 'customer.subscription.updated':
    // Handle plan changes
    break;
    
  case 'customer.subscription.deleted':
    // Downgrade to free
    await storage.updateUser(userId, {
      subscriptionTier: 'free',
    });
    break;
    
  case 'invoice.payment_failed':
    // Handle payment failure
    break;
}`} />
        </div>
      );
      
    case 'project-panel':
    case 'panel-kiteai':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">KiteAI Tab</h2>
          
          <p className="text-muted-foreground mb-4">
            The KiteAI tab provides the conversational interface for AI-powered workflow generation.
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Features</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>• Natural language prompts for workflow generation</div>
              <div>• Image upload and analysis</div>
              <div>• Figma design import</div>
              <div>• Conversation history</div>
              <div>• Actionability score display</div>
              <div>• AI provider selection</div>
            </CardContent>
          </Card>
        </div>
      );
      
    case 'panel-project':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Project Tab</h2>
          
          <p className="text-muted-foreground mb-4">
            Unified document combining project overview, workflow selection, and notes.
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sections</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div><strong>Project Overview:</strong> Name, description, metadata</div>
              <div><strong>Workflows:</strong> List with inline PRD generation</div>
              <div><strong>Notes:</strong> Markdown editor for documentation</div>
              <div><strong>External Sources:</strong> Links to Figma, docs, etc.</div>
            </CardContent>
          </Card>
        </div>
      );
      
    case 'panel-layers':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Layers Tab</h2>
          
          <p className="text-muted-foreground mb-4">
            Hierarchical view of canvas elements with search and visibility controls.
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Features</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>• Workflow-first organization</div>
              <div>• Nested nodes and edges</div>
              <div>• Search/filter by name</div>
              <div>• Toggle visibility per element</div>
              <div>• Click to select on canvas</div>
            </CardContent>
          </Card>
        </div>
      );
      
    case 'panel-prd':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">PRD System</h2>
          
          <p className="text-muted-foreground mb-4">
            AI-powered Product Requirements Document generation from workflow structure.
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Key Features</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div><strong>Auto-Generation:</strong> Creates PRD from workflow semantic model</div>
              <div><strong>Stale Detection:</strong> Identifies when workflow changed since last PRD</div>
              <div><strong>Edit Preservation:</strong> Keeps manual edits during regeneration</div>
              <div><strong>Backup System:</strong> Auto-backup before regeneration</div>
            </CardContent>
          </Card>
          
          <CodeBlock code={`// PRD generation flow
async function generatePRD(workflowId: string) {
  const workflow = await getWorkflow(workflowId);
  const semanticModel = extractSemanticModel(workflow);
  
  // Check for existing PRD
  const existingPRD = await getPRD(workflowId);
  if (existingPRD) {
    await backupPRD(existingPRD);
  }
  
  // Generate new PRD
  const prd = await aiProvider.generatePRD({
    semanticModel,
    preserveEdits: existingPRD?.manualEdits,
  });
  
  await savePRD(workflowId, prd);
  return prd;
}`} />
        </div>
      );
      
    case 'security':
    case 'sec-validation':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Input Validation</h2>
          
          <p className="text-muted-foreground mb-4">
            All user input is validated using Zod schemas before processing.
          </p>
          
          <CodeBlock code={`// Route-level validation
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  data: z.object({
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
  }).optional(),
});

app.post('/api/projects', requireAuth, async (req, res) => {
  const result = createProjectSchema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.flatten(),
    });
  }
  
  const project = await storage.createProject(result.data);
  res.json(project);
});`} />
        </div>
      );
      
    case 'sec-xss':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">XSS Prevention</h2>
          
          <p className="text-muted-foreground mb-4">
            Text content is sanitized to prevent cross-site scripting attacks.
          </p>
          
          <CodeBlock code={`// Text sanitization for node labels
import sanitizeHtml from 'sanitize-html';
import DOMPurify from 'dompurify';

function sanitizeNodeData(data: NodeData): NodeData {
  return {
    ...data,
    label: sanitizeHtml(data.label, {
      allowedTags: [], // Strip all HTML
      allowedAttributes: {},
    }),
    description: data.description 
      ? DOMPurify.sanitize(data.description)
      : undefined,
  };
}

// Applied before saving to database
const sanitizedNode = {
  ...node,
  data: sanitizeNodeData(node.data),
};`} />
        </div>
      );
      
    case 'sec-boundaries':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Error Boundaries</h2>
          
          <p className="text-muted-foreground mb-4">
            React error boundaries prevent component crashes from breaking the entire app.
          </p>
          
          <CodeBlock code={`// ErrorBoundary component
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error tracking service
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Usage
<ErrorBoundary>
  <KiteFrameCanvas {...props} />
</ErrorBoundary>`} />
        </div>
      );
      
    case 'performance':
    case 'perf-virtualization':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Virtualization</h2>
          
          <p className="text-muted-foreground mb-4">
            Only nodes visible in the viewport are rendered, enabling smooth performance with 1000+ nodes.
          </p>
          
          <CodeBlock code={`// Visibility calculation
function getVisibleNodes(
  nodes: Node[],
  viewport: Viewport,
  containerSize: { width: number; height: number }
): Node[] {
  const visibleBounds = {
    left: -viewport.x / viewport.zoom,
    top: -viewport.y / viewport.zoom,
    right: (-viewport.x + containerSize.width) / viewport.zoom,
    bottom: (-viewport.y + containerSize.height) / viewport.zoom,
  };
  
  // Add padding for smooth scrolling
  const padding = 200;
  
  return nodes.filter(node => {
    const nodeRight = node.position.x + (node.width || 200);
    const nodeBottom = node.position.y + (node.height || 100);
    
    return (
      node.position.x < visibleBounds.right + padding &&
      nodeRight > visibleBounds.left - padding &&
      node.position.y < visibleBounds.bottom + padding &&
      nodeBottom > visibleBounds.top - padding
    );
  });
}`} />
        </div>
      );
      
    case 'perf-batching':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Batch Rendering</h2>
          
          <p className="text-muted-foreground mb-4">
            RenderBatchManager coalesces rapid state updates to maintain 60 FPS.
          </p>
          
          <CodeBlock code={`// RenderBatchManager
class RenderBatchManager {
  private pendingUpdates: Update[] = [];
  private frameId: number | null = null;
  
  schedule(update: Update) {
    this.pendingUpdates.push(update);
    
    if (!this.frameId) {
      this.frameId = requestAnimationFrame(() => {
        this.flush();
      });
    }
  }
  
  private flush() {
    // Merge all pending updates
    const merged = this.mergeUpdates(this.pendingUpdates);
    
    // Apply single batched update
    this.applyUpdate(merged);
    
    // Reset
    this.pendingUpdates = [];
    this.frameId = null;
  }
  
  private mergeUpdates(updates: Update[]): Update {
    // Coalesce node position changes, selection changes, etc.
    return updates.reduce((acc, update) => ({
      ...acc,
      ...update,
    }), {});
  }
}`} />
        </div>
      );
      
    case 'perf-optimization':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">React Optimization</h2>
          
          <p className="text-muted-foreground mb-4">
            Standard React optimization patterns used throughout the codebase:
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Optimization Patterns</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div><strong>React.memo:</strong> Prevent re-renders of unchanged components</div>
              <div><strong>useCallback:</strong> Stable function references for event handlers</div>
              <div><strong>useMemo:</strong> Cache expensive calculations</div>
              <div><strong>Lazy loading:</strong> Code-split pages with React.lazy()</div>
            </CardContent>
          </Card>
          
          <CodeBlock code={`// Example: Memoized node component
const NodeComponent = React.memo(function NodeComponent({
  node,
  onUpdate,
  onSelect,
}: NodeProps) {
  // Stable callback references
  const handleClick = useCallback(() => {
    onSelect(node.id);
  }, [node.id, onSelect]);
  
  const handleUpdate = useCallback((data: Partial<NodeData>) => {
    onUpdate(node.id, data);
  }, [node.id, onUpdate]);
  
  // Memoized derived values
  const style = useMemo(() => ({
    transform: \`translate(\${node.position.x}px, \${node.position.y}px)\`,
    width: node.width,
    height: node.height,
  }), [node.position, node.width, node.height]);
  
  return (
    <div style={style} onClick={handleClick}>
      {/* Node content */}
    </div>
  );
});`} />
        </div>
      );
      
    case 'demos':
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Interactive Demos</h2>
          
          <p className="text-muted-foreground mb-4">
            Live, interactive demos of KiteFrame canvas features. Use the controls to toggle props
            and see real-time changes. Code snippets update automatically to reflect current settings.
          </p>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Demos</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <div><strong>Canvas Playground:</strong> Full-featured canvas with all controls</div>
              <div><strong>Node Types:</strong> Explore all 6 node types with customizable props</div>
              <div><strong>Edge Styling:</strong> Configure edge types, colors, and animations</div>
              <div><strong>Auto-Layout:</strong> Test the 5 layout algorithms</div>
              <div><strong>Undo/Redo:</strong> Command history and state management</div>
              <div><strong>Selection:</strong> Multi-select, box selection, keyboard shortcuts</div>
              <div><strong>Minimap & Navigation:</strong> Zoom/pan controls and minimap</div>
              <div><strong>Plugin Hooks:</strong> Event system and extension points</div>
            </CardContent>
          </Card>
          
          <p className="text-sm text-muted-foreground italic">
            Select a subsection from the sidebar to explore interactive demos.
          </p>
        </div>
      );
      
    case 'demo-canvas':
      return <CanvasPlaygroundDemo />;
      
    case 'demo-nodes':
      return <NodeTypesDemo />;
      
    case 'demo-edges':
      return <EdgeStylingDemo />;
      
    case 'demo-layouts':
      return <AutoLayoutDemo />;
      
    case 'demo-undo':
      return <UndoRedoDemo />;
      
    case 'demo-selection':
      return <SelectionDemo />;
      
    case 'demo-minimap':
      return <MinimapDemo />;
      
    case 'demo-plugins':
      return <PluginHooksDemo />;
      
    default:
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold mb-4">Section Not Found</h2>
          <p className="text-muted-foreground">
            The requested documentation section could not be found.
          </p>
        </div>
      );
  }
}

export default function DevDocs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'tech-stack', 'architecture']));
  
  const { data: user, isLoading: userLoading } = useQuery<AuthUser | null>({
    queryKey: ['/api/auth/user'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
  });
  
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return docSections;
    
    const query = searchQuery.toLowerCase();
    return docSections.filter(section => {
      const matchesTitle = section.title.toLowerCase().includes(query);
      const matchesSubsections = section.subsections?.some(
        sub => sub.title.toLowerCase().includes(query)
      );
      return matchesTitle || matchesSubsections;
    });
  }, [searchQuery]);
  
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };
  
  useEffect(() => {
    const section = docSections.find(s => 
      s.id === activeSection || s.subsections?.some(sub => sub.id === activeSection)
    );
    if (section && !expandedSections.has(section.id)) {
      setExpandedSections(prev => new Set(Array.from(prev).concat(section.id)));
    }
  }, [activeSection]);
  
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This documentation is only available to admin users.
            </p>
            <Link href="/app">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to App
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background" data-testid="dev-docs-page">
      <div className="flex h-screen">
        <aside className="w-72 border-r bg-muted/30 flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-4">
              <Link href="/internal/x9k7m2p4">
                <Button variant="ghost" size="sm" data-testid="button-back-admin">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Admin
                </Button>
              </Link>
            </div>
            <h1 className="text-lg font-bold mb-2">Developer Docs</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-docs"
              />
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <nav className="p-2">
              {filteredSections.map((section) => (
                <div key={section.id} className="mb-1">
                  <Collapsible
                    open={expandedSections.has(section.id)}
                    onOpenChange={() => toggleSection(section.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className={`w-full justify-start gap-2 ${
                          activeSection === section.id ? 'bg-accent' : ''
                        }`}
                        onClick={() => {
                          setActiveSection(section.id);
                          if (!section.subsections) {
                            toggleSection(section.id);
                          }
                        }}
                        data-testid={`nav-${section.id}`}
                      >
                        {section.icon}
                        <span className="flex-1 text-left">{section.title}</span>
                        {section.subsections && (
                          expandedSections.has(section.id) 
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    
                    {section.subsections && (
                      <CollapsibleContent>
                        <div className="ml-6 border-l pl-2 mt-1 space-y-1">
                          {section.subsections.map((sub) => (
                            <Button
                              key={sub.id}
                              variant="ghost"
                              size="sm"
                              className={`w-full justify-start text-sm ${
                                activeSection === sub.id ? 'bg-accent' : ''
                              }`}
                              onClick={() => setActiveSection(sub.id)}
                              data-testid={`nav-${sub.id}`}
                            >
                              {sub.title}
                            </Button>
                          ))}
                        </div>
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                </div>
              ))}
            </nav>
          </ScrollArea>
        </aside>
        
        <main className="flex-1 overflow-auto">
          <div className="max-w-4xl mx-auto p-8">
            <DocumentationContent sectionId={activeSection} />
          </div>
        </main>
      </div>
    </div>
  );
}
