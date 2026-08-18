import type { Node, Position, NodeTemplate } from '../types';
import { nodeRegistry, generateNodeId } from './NodeFactory.ts';

// Utility to get all available node types with metadata
export const getAvailableNodeTypes = () => {
  return nodeRegistry.getAllEntries().map(entry => ({
    type: entry.type,
    displayName: entry.displayName || entry.type,
    description: entry.description || `${entry.type} node`,
    category: entry.category || 'custom'
  }));
};

// Utility to create multiple nodes in a grid layout
export const createNodeGrid = (
  type: string,
  count: number,
  startPosition: Position,
  spacing: { x: number; y: number } = { x: 250, y: 150 },
  columns: number = 3
): Node[] => {
  const nodes: Node[] = [];
  
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    
    const position = {
      x: startPosition.x + (col * spacing.x),
      y: startPosition.y + (row * spacing.y)
    };
    
    const node = nodeRegistry.getFactory(type)?.(
      generateNodeId(),
      position,
      {}
    );
    
    if (node) {
      nodes.push(node);
    }
  }
  
  return nodes;
};

// Utility to create a node from a template
export const createFromTemplate = <TData = any>(
  template: NodeTemplate<TData>,
  position?: Position,
  customData?: Partial<TData>
): Node & { data: TData } | null => {
  const factory = nodeRegistry.getFactory<TData>(template.type);
  if (!factory) {
    console.error(`No factory registered for node type: ${template.type}`);
    return null;
  }
  
  const nodePosition = position || template.defaultPosition || { x: 0, y: 0 };
  const nodeData = { ...template.defaultData, ...customData };
  
  return factory(generateNodeId(), nodePosition, nodeData);
};

// Utility to clone a node with a new ID and optional position offset
export const cloneNode = <TData = any>(
  sourceNode: Node & { data: TData },
  positionOffset: Position = { x: 50, y: 50 }
): Node & { data: TData } | null => {
  const factory = nodeRegistry.getFactory<TData>(sourceNode.type || 'process');
  if (!factory) {
    console.error(`No factory registered for node type: ${sourceNode.type}`);
    return null;
  }
  
  const newPosition = {
    x: sourceNode.position.x + positionOffset.x,
    y: sourceNode.position.y + positionOffset.y
  };
  
  return factory(generateNodeId(), newPosition, sourceNode.data);
};

// Utility to validate node data against its template
export const validateNodeData = <TData = any>(
  type: string,
  data: TData
): { isValid: boolean; errors: string[] } => {
  const template = nodeRegistry.getTemplate<TData>(type);
  if (!template) {
    return {
      isValid: false,
      errors: [`No template found for node type: ${type}`]
    };
  }
  
  const errors: string[] = [];
  const defaultData = template.defaultData;
  
  // Basic validation - check if required fields exist
  if (typeof defaultData === 'object' && defaultData !== null) {
    Object.keys(defaultData).forEach(key => {
      const defaultValue = (defaultData as any)[key];
      const dataValue = (data as any)[key];
      if (defaultValue !== undefined && dataValue === undefined) {
        errors.push(`Missing required field: ${key}`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Utility to get node types by category
export const getNodeTypesByCategory = () => {
  const entries = nodeRegistry.getAllEntries();
  const categories: { [category: string]: string[] } = {};
  
  entries.forEach(entry => {
    const category = entry.category || 'uncategorized';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(entry.type);
  });
  
  return categories;
};

// Utility to get default dimensions for a node type
export const getDefaultDimensions = (type: string): { width: number; height: number } => {
  const template = nodeRegistry.getTemplate(type);
  return {
    width: template?.defaultStyle?.width || 200,
    height: template?.defaultStyle?.height || 120
  };
};