import type { 
  Node, 
  Position, 
  NodeTemplate, 
  BasicNodeData, 
  ImageNodeData,
  WebviewNodeData,
  CodeNodeData,
  ImageNode,
  CodeNode,
} from '../types';
import { createCodeNode } from '../components/CodeNode';

// Factory function type for creating nodes
export type NodeFactoryFunction<TData = any> = (
  id: string,
  position: Position,
  data?: Partial<TData>
) => Node & { data: TData };

// Registry entry for a node type
export interface NodeRegistryEntry<TData = any> {
  type: string;
  factory: NodeFactoryFunction<TData>;
  template: NodeTemplate<TData>;
  displayName?: string;
  description?: string;
  category?: string;
}

// Global node factory registry
class NodeFactoryRegistry {
  private registry = new Map<string, NodeRegistryEntry>();

  // Register a new node type
  register<TData = any>(entry: NodeRegistryEntry<TData>): void {
    if (this.registry.has(entry.type)) {
      console.warn(`Node type "${entry.type}" is already registered. Overwriting.`);
    }
    this.registry.set(entry.type, entry);
  }

  // Unregister a node type
  unregister(type: string): boolean {
    return this.registry.delete(type);
  }

  // Get factory function for a node type
  getFactory<TData = any>(type: string): NodeFactoryFunction<TData> | null {
    const entry = this.registry.get(type);
    return entry ? entry.factory as NodeFactoryFunction<TData> : null;
  }

  // Get template for a node type
  getTemplate<TData = any>(type: string): NodeTemplate<TData> | null {
    const entry = this.registry.get(type);
    return entry ? entry.template as NodeTemplate<TData> : null;
  }

  // Get all registered node types
  getRegisteredTypes(): string[] {
    return Array.from(this.registry.keys());
  }

  // Get all registry entries
  getAllEntries(): NodeRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  // Get entries by category
  getByCategory(category: string): NodeRegistryEntry[] {
    return Array.from(this.registry.values()).filter(
      entry => entry.category === category
    );
  }

  // Check if a type is registered
  isRegistered(type: string): boolean {
    return this.registry.has(type);
  }
}

// Create singleton instance
export const nodeRegistry = new NodeFactoryRegistry();

// Process node type - the standard workflow node type
export type ProcessNode = Node & { type: 'process'; data: BasicNodeData };

export const createProcessNode = (
  id: string,
  position: Position,
  data: Partial<BasicNodeData> = {}
): ProcessNode => ({
  id,
  type: 'process',
  position,
  data: {
    label: data.label || 'Process Node',
    description: data.description || '',
    colors: data.colors || {}
  },
  width: 200,
  height: 120,
  draggable: true,
  selectable: true,
  doubleClickable: true,
  resizable: true,
  showHandles: true
});

export const createImageNode = (
  id: string,
  position: Position,
  data: Partial<ImageNodeData> = {}
): ImageNode => ({
  id,
  type: 'image',
  position,
  data: {
    label: data.label || 'Image',
    description: data.description || '',
    src: data.src || '',
    filename: data.filename || '',
    sourceType: data.sourceType || 'upload',
    isImageBroken: data.isImageBroken || false,
    displayText: data.displayText || 'Double-click to upload',
    colors: data.colors || {}
  },
  width: 250,
  height: 200,
  draggable: true,
  selectable: true,
  doubleClickable: true,
  resizable: true,
  showHandles: true
});

export type WebviewNode = Node & { data: WebviewNodeData };

export const createWebviewNode = (
  id: string,
  position: Position,
  data: Partial<WebviewNodeData> = {}
): WebviewNode => ({
  id,
  type: 'webview',
  position,
  data: {
    label: data.label || 'Web View',
    description: data.description || '',
    url: data.url || '',
    title: data.title || 'Web View',
    favicon: data.favicon || '',
    serviceName: data.serviceName || '',
    serviceIcon: data.serviceIcon || '',
    isLoading: false,
    loadError: undefined,
    showControls: true,
    colors: data.colors || {
      headerBackground: '#06b6d4',
      bodyBackground: '#ffffff',
      headerTextColor: '#ffffff',
    }
  },
  width: 480,
  height: 360,
  draggable: true,
  selectable: true,
  doubleClickable: true,
  resizable: true,
  showHandles: true
});

// Universal node factory function
export const createNode = <TData = any>(
  type: string,
  id: string,
  position: Position,
  data?: Partial<TData>
): Node & { data: TData } | null => {
  const factory = nodeRegistry.getFactory<TData>(type);
  if (!factory) {
    console.error(`No factory registered for node type: ${type}`);
    return null;
  }
  return factory(id, position, data);
};

// Generate unique node ID
export const generateNodeId = (): string => {
  return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Create node with auto-generated ID
export const createNodeWithId = <TData = any>(
  type: string,
  position: Position,
  data?: Partial<TData>
): Node & { data: TData } | null => {
  return createNode(type, generateNodeId(), position, data);
};

// Register built-in node types
nodeRegistry.register({
  type: 'process',
  factory: createProcessNode,
  template: {
    type: 'process',
    defaultData: {
      label: 'Process Node',
      description: '',
      colors: {}
    },
    defaultStyle: { width: 200, height: 120 },
    defaultPosition: { x: 0, y: 0 }
  },
  displayName: 'Process Node',
  description: 'A standard workflow node for processes and steps',
  category: 'core'
});

nodeRegistry.register({
  type: 'image',
  factory: createImageNode,
  template: {
    type: 'image',
    defaultData: {
      label: 'Image',
      description: '',
      src: '',
      filename: '',
      sourceType: 'upload' as const,
      isImageBroken: false,
      displayText: 'Double-click to upload',
      colors: {}
    },
    defaultStyle: { width: 250, height: 200 },
    defaultPosition: { x: 0, y: 0 }
  },
  displayName: 'Image Node',
  description: 'A node that displays images with upload support',
  category: 'core'
});

nodeRegistry.register({
  type: 'webview',
  factory: createWebviewNode,
  template: {
    type: 'webview',
    defaultData: {
      label: 'Web View',
      description: '',
      url: '',
      title: 'Web View',
      favicon: '',
      serviceName: '',
      serviceIcon: '',
      isLoading: false,
      showControls: true,
      colors: {
        headerBackground: '#06b6d4',
        bodyBackground: '#ffffff',
        headerTextColor: '#ffffff',
      }
    },
    defaultStyle: { width: 480, height: 360 },
    defaultPosition: { x: 0, y: 0 }
  },
  displayName: 'Web View',
  description: 'Embed external web content like Figma, Replit, or any website',
  category: 'core'
});

nodeRegistry.register({
  type: 'code',
  factory: createCodeNode,
  template: {
    type: 'code',
    defaultData: {
      label: 'Code',
      code: '',
      language: 'javascript' as const,
      showOutput: true,
      outputHeight: 120,
      colors: {
        headerBackground: '#1e1e1e',
        bodyBackground: '#252526',
        headerTextColor: '#d4d4d4',
      }
    },
    defaultStyle: { width: 400, height: 350 },
    defaultPosition: { x: 0, y: 0 }
  },
  displayName: 'Code Node',
  description: 'Execute JavaScript or Python code with inputs from connected Form/Table nodes',
  category: 'core'
});

// Types are already exported above, no need to re-export