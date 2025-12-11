// Main KiteFrame library exports

// Core components
export { KiteFrameCanvas } from './components/KiteFrameCanvas';
export { ConnectionEdge } from './components/ConnectionEdge';
export { NodeHandles } from './components/NodeHandles';

// Library node components
export { ImageNode } from './components/ImageNode';
export { WebviewNode } from './components/WebviewNode';
export { TableNode, createTableNode } from './components/TableNode';
export { TablePanel } from './components/TablePanel';
export { FormNode, createFormNode } from './components/FormNode';
export { default as CodeNode, createCodeNode } from './components/CodeNode';
export { default as RenderNode, createRenderNode } from './components/RenderNode';
export type { RenderNodeData, RenderNode as RenderNodeType, RenderNodeComponentProps } from './components/RenderNode';
export { DataLinkPicker } from './components/DataLinkPicker';
export { NodeGalleryPanel } from './components/NodeGalleryPanel';

// Edge components and utilities
export { EdgeProperties } from './components/EdgeProperties';
export { EdgeFactory } from './components/EdgeFactory';
export { EdgeTemplatesList, defaultEdgeTemplates } from './components/EdgeTemplates';
export type { EdgeTemplate } from './components/EdgeTemplates';
export { EdgeValidator } from './utils/EdgeValidation';
export type { EdgeValidationResult, EdgeValidationRules } from './utils/EdgeValidation';

// UI components
export { ContextMenu } from './components/ContextMenu';
export type { ContextMenuItem } from './components/ContextMenu';
export { Minimap } from './components/Minimap';
export { ZoomControls } from './components/ZoomControls';
export { CanvasToolbar, ToolbarIcons } from './components/CanvasToolbar';
export type { ToolbarAction } from './components/CanvasToolbar';
export { RadialMenu } from './components/RadialMenu';
export { QuickCreateRadialMenu } from './components/QuickCreateRadialMenu';
export type { QuickCreateType, ShapeType } from './components/QuickCreateRadialMenu';

// Hooks
export { useContextMenu } from './hooks/useContextMenu';
export { useKeyboardShortcuts, defaultKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
export type { KeyboardShortcut } from './hooks/useKeyboardShortcuts';
export { useUndoRedo } from './hooks/useUndoRedo';
export type { UseUndoRedoOptions, UseUndoRedoCallbacks } from './hooks/useUndoRedo';

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
  NodeType,
  DataTable,
  DataTableColumn,
  DataTableRow,
  DataTableMeta,
  TableNodeData,
  DataBackedNodeData,
  TableRowBinding,
  NodeFieldBinding,
  DataBindingsState,
  FormNodeData,
  FormNodeField,
  FormFieldDataLink,
  FormFieldType,
  FormFieldOption,
  WebviewNodeData,
  WebviewNodeComponentProps,
  CodeNodeData,
  CodeExecutionResult,
  CodeLanguage,
  CodeNode as CodeNodeType,
  CodeNodeComponentProps
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

// Error Handling
export { ErrorBoundary, withErrorBoundary, useErrorHandler } from './components/ErrorBoundary';

// Undo/Redo System
export { UndoRedoManager, CommandFactory } from './core/UndoRedoManager';
export type { Command, CanvasState, UndoRedoOptions } from './core/UndoRedoManager';

// Validation
export { 
  validateColor, 
  sanitizeText, 
  validateNodeData, 
  validateEdgeData,
  colorSchema,
  safeTextSchema,
  nodeDataSchema,
  edgeDataSchema
} from './utils/validation';

// Telemetry and Monitoring
export {
  TelemetryManager,
  TelemetryEventType,
  useTelemetry,
  getGlobalTelemetry,
  initializeTelemetry,
  withTelemetry,
  type TelemetryEvent,
  type TelemetryConfig
} from './utils/telemetry';

// Export/Import utilities
export {
  exportWorkflow,
  importWorkflow,
  downloadWorkflow,
  importWorkflowFromFile,
  validateWorkflowFile,
  CURRENT_VERSION as EXPORT_VERSION,
  type WorkflowExport
} from './utils/exportImport';

// Data Import utilities for Table Nodes
export {
  parseCSV,
  parseJSON,
  createDataTableFromCSV,
  createDataTableFromJSON,
  importFromFile,
  createSampleTable
} from './utils/dataImport';

// Error Recovery & Resilience
export {
  ErrorRecoveryManager,
  errorRecovery,
  useErrorRecovery,
  retryWithBackoff,
  withGracefulDegradation,
  CircuitBreaker
} from './utils/errorRecovery';

// Scale Optimizations
export {
  MemoryManager,
  memoryManager,
  ProgressiveLoader,
  WorkerManager,
  workerManager,
  useMemoryMonitor,
  useProgressiveLoader,
  useWorkerManager
} from './utils/scaleOptimizations';

// Security Hardening
export {
  RateLimiter,
  createRateLimiter,
  inputValidator,
  cspManager,
  securityMonitor,
  useRateLimiter,
  useSecurityMonitor,
  useInputValidator,
  type RateLimitConfig,
  type SecurityEvent
} from './utils/securityHardening';

// Edge Validation Constants
export {
  DEFAULT_EDGE_VALIDATION_RULES,
  mergeEdgeValidationRules
} from './constants/edgeValidation';

// Code Execution
export {
  executeInSandbox,
  executeCodeInSandbox,
  cleanupSandbox
} from './utils/sandboxExecutor';