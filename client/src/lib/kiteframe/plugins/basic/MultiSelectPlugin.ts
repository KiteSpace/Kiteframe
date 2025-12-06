import type { KiteFramePlugin, PluginHooks } from '../../core/KiteFrameCore';

/**
 * Multi-Select Plugin
 * Enhances the core selection system with advanced multi-selection features
 */
export class MultiSelectPlugin implements KiteFramePlugin {
  name = 'multi-select';
  version = '1.0.0';

  private selectedNodes: Set<string> = new Set();
  private isSelecting = false;

  initialize(core: any): void {
    const context = core.getContext();
    
    // Register hooks for enhanced selection
    const hooks: PluginHooks = {
      onNodesSelected: (nodeIds: string[]) => {
        this.selectedNodes = new Set(nodeIds);
        this.broadcastSelection();
      },

      onCanvasClick: (event, worldPos) => {
        if (!event.shiftKey && !event.ctrlKey) {
          // Clear selection on normal click
          this.selectedNodes.clear();
          this.broadcastSelection();
        }
      }
    };

    core.registerHooks(hooks);

    // Listen for custom selection events
    core.on('selection:add', (nodeId: string) => {
      this.selectedNodes.add(nodeId);
      this.broadcastSelection();
    });

    core.on('selection:remove', (nodeId: string) => {
      this.selectedNodes.delete(nodeId);
      this.broadcastSelection();
    });

    core.on('selection:toggle', (nodeId: string) => {
      if (this.selectedNodes.has(nodeId)) {
        this.selectedNodes.delete(nodeId);
      } else {
        this.selectedNodes.add(nodeId);
      }
      this.broadcastSelection();
    });

    core.on('selection:clear', () => {
      this.selectedNodes.clear();
      this.broadcastSelection();
    });
  }

  cleanup(): void {
    this.selectedNodes.clear();
  }

  private broadcastSelection(): void {
    // Emit selection change event for other plugins
    const selectedArray = Array.from(this.selectedNodes);
    // Update core selection state
    // This would be connected to the actual canvas context
  }

  // Public API for other plugins
  getSelectedNodes(): string[] {
    return Array.from(this.selectedNodes);
  }

  selectNodes(nodeIds: string[]): void {
    this.selectedNodes = new Set(nodeIds);
    this.broadcastSelection();
  }

  addToSelection(nodeId: string): void {
    this.selectedNodes.add(nodeId);
    this.broadcastSelection();
  }

  removeFromSelection(nodeId: string): void {
    this.selectedNodes.delete(nodeId);
    this.broadcastSelection();
  }

  isSelected(nodeId: string): boolean {
    return this.selectedNodes.has(nodeId);
  }
}

// Plugin instance for easy import
export const multiSelectPlugin = new MultiSelectPlugin();