# KiteFrame Plugin System

This directory contains the plugin architecture and plugin implementations for KiteFrame.

## Plugin Architecture

### Core System
- `core/KiteFrameCore.ts` - Plugin management and hook system
- `core/PluginProvider.tsx` - React integration for plugins

### Plugin Structure
```typescript
interface KiteFramePlugin {
  name: string;
  version: string;
  dependencies?: string[];
  initialize: (core: KiteFrameCore) => void;
  cleanup?: () => void;
  config?: Record<string, any>;
}
```

### Hook System
Plugins can extend functionality at specific points:
- `beforeNodesChange` / `afterNodesChange`
- `beforeEdgesChange` / `afterEdgesChange` 
- `onNodesSelected`
- `onCanvasClick`
- `onConnectionAttempt`
- Custom node/edge renderers

## Usage

```tsx
import { PluginProvider, layoutPlugin } from '@kiteline/core';

function App() {
  return (
    <PluginProvider>
      <KiteFrameCanvas enablePlugins={true} />
    </PluginProvider>
  );
}
```

## Available Plugins

### Basic Plugins (Free)
| Plugin | Export | Description |
|--------|--------|-------------|
| Layout Plugin | `layoutPlugin` | 5 auto-layout algorithms (horizontal, vertical, grid, circular, hierarchical) |
| Multi-Select Plugin | `multiSelectPlugin` | Enhanced multi-node selection management |

### Pro Plugins (Commercial - requires `proFeatures` config)
| Plugin | Export | Description |
|--------|--------|-------------|
| Advanced Interactions | `advancedInteractionsPlugin` | Quick-add handles, copy/paste, edge reconnection |
| Version Control | `versionControlPlugin` | Advanced history and rollback |
| Smart Connect | `smartConnectPlugin` | Intelligent edge connection suggestions |

**Required `proFeatures` configuration:**
```typescript
proFeatures={{
  quickAdd: { enabled: true },      // Quick-add node handles
  copyPaste: { enabled: true },     // Clipboard operations
  edgeReconnect: { enabled: true }, // Edge endpoint reconnection
  // versionControl, smartConnect, etc.
}}
```

> **Note:** Pro plugins require specific `proFeatures` toggles to be enabled on `KiteFrameCanvas`. Features are disabled by default.

### Demo Plugins (Development)
| Plugin | Export | Description |
|--------|--------|-------------|
| Test Plugin | `testPlugin` | Testing and development utilities |
| Console Plugin | `consolePlugin` | Console logging for debugging |

## Plugin Development

See individual plugin directories for implementation examples and documentation.

### Creating a Custom Plugin

```typescript
import { createPlugin, KiteFrameCore } from '@kiteline/core';

const myPlugin = createPlugin({
  name: 'my-custom-plugin',
  version: '1.0.0',
  initialize: (core: KiteFrameCore) => {
    core.on('afterNodesChange', (nodes) => {
      console.log('Nodes changed:', nodes);
    });
  },
  cleanup: () => {
    // Cleanup when plugin is removed
  }
});
```