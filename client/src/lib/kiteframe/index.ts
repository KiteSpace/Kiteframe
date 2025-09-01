// Main KiteFrame library exports

// Core components
export { KiteFrameCanvas } from './components/KiteFrameCanvas';
export { ConnectionEdge } from './components/ConnectionEdge';
export { NodeHandles } from './components/NodeHandles';

// Types
export type { Node, Edge, Position, EdgeStyle, EdgeMarker } from './types';

// Utilities
export { getBounds } from './utils/flowUtils';
export { clientToWorld, zoomAroundPoint, clamp } from './utils/geometry';

// Plugin system
export { KiteFrameCore, kiteFrameCore } from './core/KiteFrameCore';
export type { KiteFramePlugin, PluginHooks, PluginContext } from './core/KiteFrameCore';
export { PluginProvider, usePluginSystem, usePluginContext, usePlugin } from './core/PluginProvider';

// Basic plugins
export { multiSelectPlugin } from './plugins/basic/MultiSelectPlugin';
export { layoutPlugin } from './plugins/basic/LayoutPlugin';

// Demo plugins
export { testPlugin } from './plugins/demo/TestPlugin';
export { consolePlugin } from './plugins/demo/ConsolePlugin';

// Plugin development utilities
export const createPlugin = (config: {
  name: string;
  version: string;
  initialize: (core: any) => void;
  cleanup?: () => void;
  dependencies?: string[];
}) => config;