import type { KiteFramePlugin, PluginHooks } from '../../core/KiteFrameCore';
import type { Node, Edge, CanvasObject, ProFeaturesConfig } from '../../types';
import { ProFeaturesManager } from './ProFeaturesManager';

/**
 * Advanced Interactions Pro Plugin - Refactored for Prop-Based Configuration
 * Premium features for enhanced workflow creation UX with clean API design
 * 
 * Features:
 * - Quick-add node handles with (+) buttons
 * - Smart node positioning and ghost previews  
 * - Enhanced multi-selection capabilities
 * - Copy/paste functionality (Cmd+C/V for Mac, Ctrl+C/V for Windows/Linux)
 * - Edge reconnection handles
 * 
 * Architecture: Uses ProFeaturesManager for centralized feature logic
 */
export class AdvancedInteractionsPlugin implements KiteFramePlugin {
  name = 'advanced-interactions-pro';
  version = '2.0.0';
  isPro = true;

  private proFeaturesManager: ProFeaturesManager | null = null;
  private currentNodes: Node[] = [];
  private currentCanvasObjects: CanvasObject[] = [];
  private onNodesChange: ((nodes: Node[]) => void) | null = null;
  private onCanvasObjectsChange: ((canvasObjects: CanvasObject[]) => void) | null | undefined = null;
  private onConnect: ((connection: { source: string; target: string }) => void) | undefined | null = null;

  initialize(core: any): void {
    // Register hooks for enhanced interactions
    const hooks: PluginHooks = {
      onCanvasClick: (event, worldPos) => {
        // Handle canvas interactions for quick-add functionality
      }
    };

    core.registerHooks(hooks);

    // Setup event listeners for keyboard shortcuts
    this.setupEventListeners();

    // Register core events for feature handling
    core.on('quickAdd', this.handleQuickAdd);
    core.on('copyNode', this.handleCopyNode);
    core.on('pasteNode', this.handlePasteNode);
  }

  // Configure the plugin with pro features configuration
  configure(
    config: ProFeaturesConfig,
    nodes: Node[],
    edges: Edge[],
    onNodesChange: (nodes: Node[]) => void,
    onEdgesChange?: (edges: Edge[]) => void,
    onConnect?: (connection: { source: string; target: string }) => void,
    canvasObjects: CanvasObject[] = [],
    onCanvasObjectsChange?: (canvasObjects: CanvasObject[]) => void
  ): void {
    this.currentNodes = nodes;
    this.currentCanvasObjects = canvasObjects;
    this.onNodesChange = onNodesChange;
    this.onCanvasObjectsChange = onCanvasObjectsChange;
    this.onConnect = onConnect;
    
    this.proFeaturesManager = new ProFeaturesManager(
      config,
      nodes,
      edges || [],
      onNodesChange,
      onEdgesChange,
      onConnect,
      canvasObjects,
      onCanvasObjectsChange
    );

  }

  // Update configuration when props change
  updateConfiguration(config: ProFeaturesConfig, nodes: Node[], canvasObjects: CanvasObject[] = []): void {
    this.currentNodes = nodes;
    this.currentCanvasObjects = canvasObjects;
    
    if (this.proFeaturesManager) {
      this.proFeaturesManager.updateConfig(config);
      this.proFeaturesManager.updateNodes(nodes);
      this.proFeaturesManager.updateCanvasObjects(canvasObjects);
    }
  }

  private setupEventListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private removeEventListeners(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.proFeaturesManager) return;

    // Only handle shortcuts when focused on the canvas
    const target = event.target as HTMLElement;
    
    // Skip if user is in an input field, textarea, or contenteditable element
    // This allows normal text editing (including paste) in form fields
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }
    
    if (target.closest('.kiteframe-canvas')) {
      const selectedNodes = this.getSelectedNodes();
      const selectedCanvasObjects = this.getSelectedCanvasObjects();
      const handled = this.proFeaturesManager.handleKeyboardShortcut(event, selectedNodes, selectedCanvasObjects);
      
    }
  };

  private getSelectedNodes(): Node[] {
    // Get selected nodes from current node data
    return this.currentNodes.filter(node => node.selected === true);
  }

  private getSelectedCanvasObjects(): CanvasObject[] {
    // Get selected canvas objects from current canvas object data
    return this.currentCanvasObjects.filter(obj => obj.selected === true);
  }



  // Event handlers for core events
  private handleQuickAdd = (data: { sourceNode: Node; position: 'top' | 'right' | 'bottom' | 'left' }): void => {
    if (!this.proFeaturesManager) return;
    this.proFeaturesManager.handleQuickAdd(data.sourceNode, data.position);
  };

  private handleCopyNode = (node: Node): void => {
    if (!this.proFeaturesManager) return;
    this.proFeaturesManager.copyNode(node);
  };

  private handlePasteNode = (): void => {
    if (!this.proFeaturesManager) return;
    this.proFeaturesManager.pasteNode();
  };

  // Public API for external access
  public getProFeaturesManager(): ProFeaturesManager | null {
    return this.proFeaturesManager;
  }

  // Update viewport information for centered paste functionality
  public updateViewportInfo(viewport: { x: number; y: number; zoom: number }, containerDimensions: { width: number; height: number }): void {
    if (this.proFeaturesManager) {
      this.proFeaturesManager.setViewportInfo(viewport, containerDimensions);
    }
  }

  public triggerQuickAdd(sourceNode: Node, position: 'top' | 'right' | 'bottom' | 'left'): void {
    if (this.proFeaturesManager) {
      this.proFeaturesManager.handleQuickAdd(sourceNode, position);
    }
  }

  public triggerCopyNode(node: Node): void {
    if (this.proFeaturesManager) {
      this.proFeaturesManager.copyNode(node);
    }
  }

  public triggerPasteNode(): void {
    if (this.proFeaturesManager) {
      this.proFeaturesManager.pasteNode();
    }
  }

  cleanup(): void {
    // Remove event listeners to prevent memory leaks
    this.removeEventListeners();
    
    // Clear manager reference
    this.proFeaturesManager = null;
    this.onNodesChange = null;
    this.onCanvasObjectsChange = null;
    this.onConnect = null;
  }
}

export const advancedInteractionsPlugin = new AdvancedInteractionsPlugin();