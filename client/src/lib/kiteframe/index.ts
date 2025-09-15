// Main KiteFrame library exports

// Core components
export { KiteFrameCanvas } from './components/KiteFrameCanvas';
export { ConnectionEdge } from './components/ConnectionEdge';
export { NodeHandles } from './components/NodeHandles';

// Library node components
export { BasicNode } from './components/BasicNode';
export { ImageNode } from './components/ImageNode';

// Edge components and utilities
export { EdgeProperties } from './components/EdgeProperties';
export { EdgeFactory } from './components/EdgeFactory';
export { EdgeTemplatesList, defaultEdgeTemplates } from './components/EdgeTemplates';
export type { EdgeTemplate } from './components/EdgeTemplates';
export { EdgeValidator } from './utils/EdgeValidation';
export type { EdgeValidationResult, EdgeValidationRules } from './utils/EdgeValidation';

// Types
export type { 
  Node, 
  Edge, 
  Position, 
  EdgeStyle, 
  EdgeMarker,
  ProFeaturesConfig,
  QuickAddConfig,
  CopyPasteConfig,
  AdvancedSelectionConfig,
  VersionControlConfig,
  NodeType
} from './types';

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

// Pro plugins
export { advancedInteractionsPlugin } from './plugins/pro/AdvancedInteractionsPlugin';
export { versionControlPlugin } from './plugins/pro/VersionControlPlugin';
export { smartConnectPlugin } from './plugins/pro/SmartConnectPlugin';

// Integration plugins
export { coreNodeIntegrationPlugin } from './integration';

// Plugin development utilities
export const createPlugin = (config: {
  name: string;
  version: string;
  initialize: (core: any) => void;
  cleanup?: () => void;
  dependencies?: string[];
}) => config;