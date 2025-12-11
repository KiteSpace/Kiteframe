// Export the main factory system
export {
  nodeRegistry,
  createNode,
  createNodeWithId,
  generateNodeId,
  createProcessNode,
  createImageNode,
  createWebviewNode
} from './NodeFactory.ts';

// Export factory types
export type {
  NodeFactoryFunction,
  NodeRegistryEntry
} from './NodeFactory.ts';

// Export utility functions (explicit exports to avoid module resolution issues)
export {
  getAvailableNodeTypes,
  createNodeGrid,
  createFromTemplate,
  cloneNode,
  validateNodeData,
  getNodeTypesByCategory,
  getDefaultDimensions
} from './utils.ts';