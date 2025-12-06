import type { KiteFramePlugin, PluginHooks } from '../../core/KiteFrameCore';

/**
 * Demo Test Plugin
 * Demonstrates plugin functionality and provides testing capabilities
 */
export class TestPlugin implements KiteFramePlugin {
  name = 'test-demo';
  version = '1.0.0';

  private nodeClickCount = 0;
  private canvasClickCount = 0;

  initialize(core: any): void {
    const context = core.getContext();
    
    // Register hooks to demonstrate plugin system
    const hooks: PluginHooks = {
      beforeNodesChange: (nodes) => {
        return nodes; // Pass through unchanged
      },
      
      afterNodesChange: (nodes) => {
        // Nodes changed
      },
      
      onNodesSelected: (nodeIds) => {
        // Nodes selected
      },
      
      onCanvasClick: (event, worldPos) => {
        this.canvasClickCount++;
      },
      
      onConnectionAttempt: (source, target) => {
        return true; // Allow all connections
      }
    };

    core.registerHooks(hooks);

    // Listen to custom events
    core.on('test:nodeCount', (count: number) => {
      // Node count event received
    });

    core.on('test:layoutApplied', (layoutType: string) => {
      // Layout applied
    });

    // Add test methods to core for external access
    core.testPlugin = {
      getStats: this.getStats.bind(this),
      triggerTestEvent: this.triggerTestEvent.bind(this),
      simulateNodeClick: this.simulateNodeClick.bind(this)
    };
  }

  cleanup(): void {
    // Cleanup complete
  }

  // Test methods
  getStats() {
    return {
      nodeClickCount: this.nodeClickCount,
      canvasClickCount: this.canvasClickCount,
      pluginName: this.name,
      version: this.version
    };
  }

  triggerTestEvent(core: any, eventName: string, data?: any) {
    core.emit(eventName, data);
  }

  simulateNodeClick() {
    this.nodeClickCount++;
  }
}

// Plugin instance for easy import
export const testPlugin = new TestPlugin();