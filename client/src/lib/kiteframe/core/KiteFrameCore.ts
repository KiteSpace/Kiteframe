import React from 'react';
import type { Node, Edge } from '../types';

/**
 * KiteFrame Plugin Interface
 * Defines the contract that all plugins must implement
 */
export interface KiteFramePlugin {
  /** Unique plugin identifier */
  name: string;
  /** Plugin version for compatibility checking */
  version: string;
  /** Optional dependencies on other plugins */
  dependencies?: string[];
  /** Plugin initialization function */
  initialize: (core: KiteFrameCore) => void;
  /** Optional cleanup function */
  cleanup?: () => void;
  /** Plugin configuration */
  config?: Record<string, any>;
}

/**
 * Plugin Hook System
 * Allows plugins to extend core functionality at specific points
 */
export interface PluginHooks {
  /** Called before node changes are applied */
  beforeNodesChange?: (nodes: Node[]) => Node[];
  /** Called after node changes are applied */
  afterNodesChange?: (nodes: Node[]) => void;
  /** Called before edge changes are applied */
  beforeEdgesChange?: (edges: Edge[]) => Edge[];
  /** Called after edge changes are applied */
  afterEdgesChange?: (edges: Edge[]) => void;
  /** Called when nodes are selected */
  onNodesSelected?: (nodeIds: string[]) => void;
  /** Called when canvas is clicked */
  onCanvasClick?: (event: React.MouseEvent, worldPos: {x: number, y: number}) => void;
  /** Called when connection is attempted */
  onConnectionAttempt?: (source: string, target: string) => boolean;
  /** Custom node renderers */
  nodeRenderers?: Record<string, React.ComponentType<any>>;
  /** Custom edge renderers */
  edgeRenderers?: Record<string, React.ComponentType<any>>;
}

/**
 * Plugin Context
 * Provides plugins access to core functionality and state
 */
export interface PluginContext {
  /** Get current nodes */
  getNodes: () => Node[];
  /** Get current edges */
  getEdges: () => Edge[];
  /** Update nodes */
  updateNodes: (nodes: Node[]) => void;
  /** Update edges */
  updateEdges: (edges: Edge[]) => void;
  /** Get current viewport */
  getViewport: () => {x: number, y: number, zoom: number};
  /** Set viewport */
  setViewport: (viewport: {x: number, y: number, zoom: number}) => void;
  /** Get selected nodes */
  getSelectedNodes: () => string[];
  /** Set selected nodes */
  setSelectedNodes: (nodeIds: string[]) => void;
  /** Emit custom events */
  emit: (event: string, data?: any) => void;
  /** Listen to custom events */
  on: (event: string, callback: (data?: any) => void) => () => void;
}

/**
 * KiteFrame Core Class
 * Manages the plugin system and provides core functionality
 */
export class KiteFrameCore {
  private plugins: Map<string, KiteFramePlugin> = new Map();
  private hooks: PluginHooks = {};
  private pluginHooks: Map<string, Partial<PluginHooks>> = new Map(); // Track hooks by plugin
  private eventListeners: Map<string, Array<(data?: any) => void>> = new Map();
  private context: PluginContext | null = null;

  constructor() {
    this.setupContext();
  }

  /**
   * Register a plugin with the core system
   */
  use(plugin: KiteFramePlugin): this {
    // Check dependencies
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Plugin "${plugin.name}" requires dependency "${dep}" which is not installed`);
        }
      }
    }

    // Check for conflicts
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin "${plugin.name}" is already installed, replacing...`);
    }

    // Register plugin
    this.plugins.set(plugin.name, plugin);
    
    // Initialize plugin
    try {
      plugin.initialize(this);
    } catch (error) {
      console.error(`Failed to initialize plugin "${plugin.name}":`, error);
      this.plugins.delete(plugin.name);
      throw error;
    }

    return this;
  }

  /**
   * Unregister a plugin
   */
  unuse(pluginName: string): this {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      try {
        plugin.cleanup?.();
        // Remove hooks registered by this plugin
        this.removePluginHooks(pluginName);
        this.plugins.delete(pluginName);
      } catch (error) {
        console.error(`Failed to cleanup plugin "${pluginName}":`, error);
      }
    }
    return this;
  }

  /**
   * Get installed plugin
   */
  getPlugin(name: string): KiteFramePlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all installed plugins
   */
  getPlugins(): KiteFramePlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Register plugin hooks
   */
  registerHooks(hooks: Partial<PluginHooks>): void {
    Object.assign(this.hooks, hooks);
  }

  /**
   * Register hooks for a specific plugin
   */
  registerPluginHooks(pluginName: string, hooks: Partial<PluginHooks>): void {
    // Store hooks for this plugin
    this.pluginHooks.set(pluginName, hooks);
    
    // Merge hooks into global hooks, with special handling for object-based hooks
    Object.entries(hooks).forEach(([key, value]) => {
      if (key === 'nodeRenderers' || key === 'edgeRenderers') {
        // For renderer hooks, merge objects
        const currentRenderers = this.hooks[key as keyof PluginHooks] as Record<string, any> || {};
        this.hooks[key as keyof PluginHooks] = {
          ...currentRenderers,
          ...value as Record<string, any>
        } as any;
      } else {
        // For function hooks, directly assign (last one wins)
        (this.hooks as any)[key] = value;
      }
    });
  }

  /**
   * Remove hooks registered by a specific plugin
   */
  private removePluginHooks(pluginName: string): void {
    const pluginHooks = this.pluginHooks.get(pluginName);
    if (!pluginHooks) return;

    // Rebuild hooks from remaining plugins
    this.hooks = {};
    this.pluginHooks.delete(pluginName);
    
    // Re-register all remaining plugin hooks
    Array.from(this.pluginHooks.entries()).forEach(([name, hooks]) => {
      Object.entries(hooks).forEach(([key, value]) => {
        if (key === 'nodeRenderers' || key === 'edgeRenderers') {
          // For renderer hooks, merge objects
          const currentRenderers = this.hooks[key as keyof PluginHooks] as Record<string, any> || {};
          this.hooks[key as keyof PluginHooks] = {
            ...currentRenderers,
            ...value as Record<string, any>
          } as any;
        } else {
          // For function hooks, directly assign
          (this.hooks as any)[key] = value;
        }
      });
    });
  }

  /**
   * Get registered hooks
   */
  getHooks(): PluginHooks {
    return this.hooks;
  }

  /**
   * Execute hook with data
   */
  executeHook<T>(hookName: keyof PluginHooks, data: T): T {
    const hook = this.hooks[hookName] as any;
    if (hook && typeof hook === 'function') {
      try {
        const result = hook(data);
        return result !== undefined ? result : data;
      } catch (error) {
        console.error(`Error executing hook "${hookName}":`, error);
        return data;
      }
    }
    return data;
  }

  /**
   * Execute void hooks (no return value)
   */
  executeVoidHook(hookName: keyof PluginHooks, ...args: any[]): void {
    const hook = this.hooks[hookName] as any;
    if (hook && typeof hook === 'function') {
      try {
        hook(...args);
      } catch (error) {
        console.error(`Error executing hook "${hookName}":`, error);
      }
    }
  }

  /**
   * Emit custom event
   */
  emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for "${event}":`, error);
        }
      });
    }
  }

  /**
   * Listen to custom event
   */
  on(event: string, callback: (data?: any) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get plugin context for use by plugins
   */
  getContext(): PluginContext {
    if (!this.context) {
      throw new Error('Plugin context not initialized');
    }
    return this.context;
  }

  /**
   * Set up plugin context (called by KiteFrameCanvas)
   */
  private setupContext(): void {
    this.context = {
      getNodes: () => [],
      getEdges: () => [],
      updateNodes: () => {},
      updateEdges: () => {},
      getViewport: () => ({x: 0, y: 0, zoom: 1}),
      setViewport: () => {},
      getSelectedNodes: () => [],
      setSelectedNodes: () => {},
      emit: this.emit.bind(this),
      on: this.on.bind(this)
    };
  }

  /**
   * Update context with actual canvas methods (called by KiteFrameCanvas)
   */
  updateContext(context: Partial<PluginContext>): void {
    if (this.context) {
      Object.assign(this.context, context);
    }
  }

  /**
   * Cleanup all plugins
   */
  cleanup(): void {
    Array.from(this.plugins.values()).forEach(plugin => {
      try {
        plugin.cleanup?.();
      } catch (error) {
        console.error(`Error cleaning up plugin "${plugin.name}":`, error);
      }
    });
    this.plugins.clear();
    this.pluginHooks.clear();
    this.hooks = {}; // Reset all hooks
    this.eventListeners.clear();
  }
}

/**
 * Global core instance
 */
export const kiteFrameCore = new KiteFrameCore();