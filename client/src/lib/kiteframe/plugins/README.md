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
import { PluginProvider, usePluginSystem } from './core/PluginProvider';
import { collaborationPlugin } from './collaboration';

function App() {
  const { usePlugin } = usePluginSystem();
  
  // Register plugin
  usePlugin(collaborationPlugin);
  
  return (
    <PluginProvider>
      <KiteFrameCanvas enablePlugins={true} />
    </PluginProvider>
  );
}
```

## Available Plugins

### Core Plugins (Free)
- Basic interaction plugins
- Layout helpers
- Style utilities

### Pro Plugins (Paid)
- `@kiteframe/collaboration` - Real-time multi-user features
- `@kiteframe/version-control` - History and versioning
- `@kiteframe/advanced-interactions` - Enhanced UX features
- `@kiteframe/ai-pro` - Advanced AI integration

## Plugin Development

See individual plugin directories for implementation examples and documentation.