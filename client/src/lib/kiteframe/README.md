# 🪁 Kiteline

**A powerful, extensible React canvas library for building workflow editors and node-based UIs**

[![npm version](https://img.shields.io/npm/v/@kiteline/core.svg)](https://www.npmjs.com/package/@kiteline/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

[Website](https://kiteline.dev) • [Documentation](https://kiteline.dev/docs) • [Examples](https://kiteline.dev/examples) • [Playground](https://kiteline.dev/playground)

---

## ✨ Features

### 🎨 **Interactive Canvas**
- **Smooth zoom & pan** - Intuitive viewport navigation with mouse/trackpad
- **Pixel-perfect rendering** - Crisp text and edges at all zoom levels
- **Minimap navigation** - Bird's-eye view for large workflows
- **Responsive design** - Works seamlessly on desktop and tablet

### 📦 **Rich Node System**
- **6 built-in node types** - Input, Process, Condition, Output, AI, and Image nodes
- **Dynamic text wrapping** - Automatic height adjustment for content
- **Custom styling** - Full control over colors, icons, and appearance
- **Connection handles** - Smart positioning with visual feedback

### 🔗 **Flexible Edge System**
- **6 edge types** - Bezier, Straight, Step, Smoothstep, Curved, Orthogonal
- **Rich styling options** - Colors, widths, dash patterns, opacity, gradients
- **Edge markers** - Arrows, circles, squares, diamonds at start/end
- **Edge validation** - Built-in rules to prevent invalid connections
- **Edge templates** - Reusable styled connection presets

### 🎯 **Smart Layouts**
- **5 auto-layout algorithms**:
  - Horizontal Flow - Left-to-right organization
  - Vertical Flow - Top-to-bottom structure
  - Grid Layout - Neat grid arrangement
  - Circular - Radial node placement
  - Hierarchical - Tree-based organization
- **Collision detection** - Smart spacing for AI-generated workflows
- **Snap-to-grid** - Precise alignment tools

### ♻️ **Undo/Redo System**
- **Command pattern** - Robust history management
- **Batching & debouncing** - Efficient history tracking
- **Keyboard shortcuts** - Ctrl/Cmd + Z/Y support
- **Memory optimization** - Configurable history limits

### 🔌 **Plugin Architecture**
- **Extensible core** - Build custom functionality
- **8 extension points** - Hook into key canvas events
- **React integration** - Seamless plugin system via context
- **Dependency management** - Automatic plugin ordering

### 🛡️ **Enterprise-Ready**
- **Input validation** - Zod-based schema validation
- **XSS prevention** - Automatic text sanitization
- **Error boundaries** - Graceful degradation
- **Rate limiting** - Client-side protection
- **Memory management** - Automatic cleanup
- **TypeScript** - Full type safety

### 📁 **Import/Export**
- **JSON workflows** - Standard export format
- **Validation** - Automatic format checking
- **AI-powered error correction** - Fix incompatible imports
- **File upload & paste** - Multiple import methods

---

## 📦 Installation

```bash
npm install @kiteline/core
```

```bash
yarn add @kiteline/core
```

```bash
pnpm add @kiteline/core
```

### Peer Dependencies

Kiteline requires React 18+:

```bash
npm install react react-dom
```

---

## 🚀 Quick Start

```tsx
import { KiteFrameCanvas, PluginProvider } from '@kiteline/core';
import '@kiteline/core/styles/kiteframe.css';
import { useState } from 'react';

function App() {
  const [nodes, setNodes] = useState([
    {
      id: '1',
      type: 'input',
      position: { x: 100, y: 100 },
      data: { label: 'Start', description: 'Begin workflow' },
      width: 200,
      height: 100
    },
    {
      id: '2',
      type: 'output',
      position: { x: 400, y: 100 },
      data: { label: 'End', description: 'Complete workflow' },
      width: 200,
      height: 100
    }
  ]);

  const [edges, setEdges] = useState([
    {
      id: 'e1-2',
      source: '1',
      target: '2',
      type: 'bezier',
      style: { strokeColor: '#3b82f6', strokeWidth: 2 }
    }
  ]);

  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  return (
    <PluginProvider>
      <div style={{ width: '100vw', height: '100vh' }}>
        <KiteFrameCanvas
          nodes={nodes}
          edges={edges}
          viewport={viewport}
          onNodesChange={setNodes}
          onEdgesChange={setEdges}
          onViewportChange={setViewport}
        />
      </div>
    </PluginProvider>
  );
}
```

---

## 🎯 Core Concepts

### Nodes

Nodes are the building blocks of your workflow. Each node has:

```typescript
interface Node {
  id: string;
  type: 'input' | 'process' | 'condition' | 'output' | 'ai' | 'image';
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    icon?: string;
    iconColor?: string;
  };
  width?: number;
  height?: number;
  style?: NodeStyle;
}
```

### Edges

Edges connect nodes together:

```typescript
interface Edge {
  id: string;
  source: string;
  target: string;
  type?: 'bezier' | 'straight' | 'step' | 'smoothstep' | 'curved' | 'orthogonal';
  style?: EdgeStyle;
  markers?: EdgeMarker;
}
```

### Viewport

Control the canvas view:

```typescript
interface Viewport {
  x: number;        // Pan X offset
  y: number;        // Pan Y offset
  zoom: number;     // Zoom level (0.1 - 2.0)
}
```

---

## 📚 API Reference

### Components

#### `<KiteFrameCanvas />`

The main canvas component.

**Props:**
```typescript
{
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onViewportChange: (viewport: Viewport) => void;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  onCanvasClick?: () => void;
  enablePlugins?: boolean;
  showMinimap?: boolean;
  showZoomControls?: boolean;
  snapToGrid?: boolean;
  gridSize?: number;
}
```

#### `<PluginProvider />`

Wraps your app to enable the plugin system.

```tsx
<PluginProvider>
  <YourApp />
</PluginProvider>
```

### Hooks

#### `useKeyboardShortcuts()`

Add custom keyboard shortcuts:

```typescript
const { addShortcut, removeShortcut } = useKeyboardShortcuts();

addShortcut({
  key: 's',
  ctrl: true,
  action: () => saveWorkflow()
});
```

#### `useUndoRedo()`

Manage undo/redo state:

```typescript
const { undo, redo, canUndo, canRedo, clearHistory } = useUndoRedo({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange
});
```

#### `useContextMenu()`

Add custom context menus:

```typescript
const { showContextMenu } = useContextMenu();

const handleRightClick = (e: React.MouseEvent, nodeId: string) => {
  showContextMenu(e, [
    { label: 'Delete', onClick: () => deleteNode(nodeId) },
    { label: 'Duplicate', onClick: () => duplicateNode(nodeId) }
  ]);
};
```

### Utilities

#### Layout Helpers

```typescript
import { layoutPlugin } from '@kiteline/core';

// Auto-arrange nodes
layoutPlugin.applyLayout(nodes, 'horizontal'); // or 'vertical', 'grid', 'circular', 'hierarchical'
```

#### Edge Validation

```typescript
import { EdgeValidator } from '@kiteline/core';

const validator = new EdgeValidator();
const result = validator.validate(edge, nodes, edges, {
  allowSelfConnection: false,
  allowDuplicates: false
});

if (!result.valid) {
  console.log(result.errors); // Array of error messages
}
```

#### Export/Import

```typescript
import { exportWorkflow, importWorkflow } from '@kiteline/core';

// Export
const workflowData = exportWorkflow({ nodes, edges, viewport });
downloadWorkflow(workflowData, 'my-workflow.json');

// Import
const imported = await importWorkflowFromFile(file);
setNodes(imported.nodes);
setEdges(imported.edges);
```

---

## 🔌 Plugin System

Create custom plugins to extend functionality:

```typescript
import { createPlugin, KiteFrameCore } from '@kiteline/core';

const myPlugin = createPlugin({
  name: 'my-custom-plugin',
  version: '1.0.0',
  initialize: (core: KiteFrameCore) => {
    // Hook into canvas events
    core.on('afterNodesChange', (nodes) => {
      console.log('Nodes changed:', nodes);
    });

    // Add custom node renderer
    core.registerNodeRenderer('custom', CustomNodeComponent);

    // Extend toolbar
    core.registerToolbarAction({
      id: 'custom-action',
      label: 'My Action',
      icon: 'star',
      onClick: () => console.log('Custom action!')
    });
  },
  cleanup: () => {
    // Cleanup when plugin is removed
  }
});

// Use in your app
import { usePluginSystem } from '@kiteline/core';

function App() {
  const { usePlugin } = usePluginSystem();
  usePlugin(myPlugin);
  
  return <KiteFrameCanvas {...props} enablePlugins />;
}
```

### Extension Points

- `beforeNodesChange` / `afterNodesChange`
- `beforeEdgesChange` / `afterEdgesChange`
- `onNodesSelected`
- `onCanvasClick`
- `onConnectionAttempt`
- `registerNodeRenderer`
- `registerToolbarAction`
- `registerContextMenuItem`

---

## 💡 Examples

### Custom Node Renderer

```tsx
import { BasicNode } from '@kiteline/core';

const CustomNode = ({ node, isSelected, onUpdate }) => {
  return (
    <div className={`custom-node ${isSelected ? 'selected' : ''}`}>
      <h3>{node.data.label}</h3>
      <p>{node.data.description}</p>
      <button onClick={() => onUpdate({ ...node, data: { ...node.data, clicked: true }})}>
        Click me!
      </button>
    </div>
  );
};

// Register it
core.registerNodeRenderer('custom', CustomNode);
```

### Edge Templates

```tsx
import { EdgeTemplatesList, defaultEdgeTemplates } from '@kiteline/core';

const customTemplates = [
  {
    id: 'success',
    name: 'Success Flow',
    style: { strokeColor: '#10b981', strokeWidth: 3 },
    type: 'bezier',
    markers: { type: 'arrow', position: 'end' }
  },
  {
    id: 'error',
    name: 'Error Flow',
    style: { strokeColor: '#ef4444', strokeWidth: 3, dashArray: '5,5' },
    type: 'bezier',
    markers: { type: 'arrow', position: 'end' }
  }
];

<EdgeTemplatesList
  templates={[...defaultEdgeTemplates, ...customTemplates]}
  onApplyTemplate={(template) => applyToSelectedEdges(template)}
/>
```

### Auto-Layout on Add

```tsx
import { layoutPlugin } from '@kiteline/core';

const addNodeWithLayout = (newNode) => {
  const updatedNodes = [...nodes, newNode];
  const layouted = layoutPlugin.applyLayout(updatedNodes, 'hierarchical');
  setNodes(layouted);
};
```

---

## 🎨 Styling

Kiteline uses CSS custom properties for theming:

```css
:root {
  --kiteframe-bg: #ffffff;
  --kiteframe-grid-color: #e5e7eb;
  --kiteframe-node-bg: #f9fafb;
  --kiteframe-node-border: #d1d5db;
  --kiteframe-node-selected: #3b82f6;
  --kiteframe-edge-color: #6b7280;
  --kiteframe-edge-selected: #3b82f6;
}

.dark {
  --kiteframe-bg: #111827;
  --kiteframe-grid-color: #374151;
  --kiteframe-node-bg: #1f2937;
  --kiteframe-node-border: #4b5563;
}
```

---

## 🛠️ TypeScript

Kiteline is built with TypeScript and provides full type definitions:

```typescript
import type { 
  Node, 
  Edge, 
  Viewport, 
  KiteFramePlugin,
  EdgeValidationRules,
  NodeType 
} from '@kiteline/core';
```

---

## 📖 Documentation

- [Getting Started](https://kiteline.dev/docs/getting-started)
- [API Reference](https://kiteline.dev/docs/api)
- [Examples](https://kiteline.dev/examples)
- [Plugin Development](https://kiteline.dev/docs/plugins)
- [Migration Guide](https://kiteline.dev/docs/migration)

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT © [Kiteline Team](https://github.com/kiteline)

---

## 🙏 Acknowledgments

Built with ❤️ by the Kiteline team. Inspired by the amazing work of React Flow and other node-based editors.

---

**[⭐ Star us on GitHub](https://github.com/kiteline/kiteline)** | **[🐛 Report Bug](https://github.com/kiteline/kiteline/issues)** | **[✨ Request Feature](https://github.com/kiteline/kiteline/issues)**
