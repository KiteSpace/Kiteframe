import type { KiteFramePlugin, PluginHooks } from '../../core/KiteFrameCore';
import type { Node, ProFeaturesConfig } from '../../types';
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
  private onNodesChange: ((nodes: Node[]) => void) | null = null;
  private onConnect: ((connection: { source: string; target: string }) => void) | undefined | null = null;

  initialize(core: any): void {
    console.log('🚀 AdvancedInteractions Pro Plugin v2.0: Initializing with prop-based configuration...');
    
    // Register hooks for enhanced interactions
    const hooks: PluginHooks = {
      onCanvasClick: (event, worldPos) => {
        // Handle canvas interactions for quick-add functionality
        console.log('🚀 AdvancedInteractions: Canvas clicked', worldPos);
      }
    };

    core.registerHooks(hooks);

    // Setup event listeners for keyboard shortcuts
    this.setupEventListeners();

    // Register core events for feature handling
    core.on('quickAdd', this.handleQuickAdd);
    core.on('copyNode', this.handleCopyNode);
    core.on('pasteNode', this.handlePasteNode);

    console.log('🚀 AdvancedInteractions Pro Plugin v2.0: Ready!');
    console.log('   ✨ Prop-based configuration enabled');
    console.log('   ✨ ProFeaturesManager integration active');
    console.log('   ✨ Cross-platform copy/paste support (Cmd/Ctrl)');
  }

  // Configure the plugin with pro features configuration
  configure(
    config: ProFeaturesConfig,
    nodes: Node[],
    onNodesChange: (nodes: Node[]) => void,
    onConnect?: (connection: { source: string; target: string }) => void
  ): void {
    this.currentNodes = nodes;
    this.onNodesChange = onNodesChange;
    this.onConnect = onConnect;
    
    this.proFeaturesManager = new ProFeaturesManager(
      config,
      nodes,
      onNodesChange,
      onConnect
    );

    console.log('🔧 AdvancedInteractions configured with pro features:', {
      quickAdd: config.quickAdd?.enabled !== false,
      copyPaste: config.copyPaste?.enabled !== false,
      advancedSelection: config.advancedSelection?.enabled !== false
    });
  }

  // Update configuration when props change
  updateConfiguration(config: ProFeaturesConfig, nodes: Node[]): void {
    this.currentNodes = nodes;
    
    if (this.proFeaturesManager) {
      this.proFeaturesManager.updateConfig(config);
      this.proFeaturesManager.updateNodes(nodes);
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
    if (target.closest('.kiteframe-canvas')) {
      const selectedNodes = this.getSelectedNodes();
      const handled = this.proFeaturesManager.handleKeyboardShortcut(event, selectedNodes);
      
      if (handled) {
        console.log('⌨️ Keyboard shortcut handled by pro features');
      }
    }
  };

  private getSelectedNodes(): Node[] {
    // Get selected nodes from current node data
    return this.currentNodes.filter(node => node.selected === true);
  }



  // Event handlers for core events
  private handleQuickAdd = (data: { sourceNode: Node; position: 'top' | 'right' | 'bottom' | 'left' }): void => {
    if (!this.proFeaturesManager) return;
    
    console.log('⚡ Quick-add triggered:', data.sourceNode.id, data.position);
    this.proFeaturesManager.handleQuickAdd(data.sourceNode, data.position);
  };

  private handleCopyNode = (node: Node): void => {
    if (!this.proFeaturesManager) return;
    
    console.log('📋 Copy node triggered:', node.id);
    this.proFeaturesManager.copyNode(node);
  };

  private handlePasteNode = (): void => {
    if (!this.proFeaturesManager) return;
    
    console.log('📋 Paste node triggered');
    const pastedNode = this.proFeaturesManager.pasteNode();
    
    if (pastedNode) {
      console.log('📋 Node pasted successfully:', pastedNode.id);
    }
  };

  // Public API for external access
  public getProFeaturesManager(): ProFeaturesManager | null {
    return this.proFeaturesManager;
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
    this.onConnect = null;
    
    console.log('🚀 AdvancedInteractions Pro Plugin v2.0: Cleaned up');
  }
}

export const advancedInteractionsPlugin = new AdvancedInteractionsPlugin();