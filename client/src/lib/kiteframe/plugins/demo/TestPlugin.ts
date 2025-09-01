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
        console.log('🔧 TestPlugin: beforeNodesChange called with', nodes.length, 'nodes');
        return nodes; // Pass through unchanged
      },
      
      afterNodesChange: (nodes) => {
        console.log('🔧 TestPlugin: afterNodesChange called with', nodes.length, 'nodes');
      },
      
      onNodesSelected: (nodeIds) => {
        console.log('🔧 TestPlugin: onNodesSelected called with', nodeIds);
      },
      
      onCanvasClick: (event, worldPos) => {
        this.canvasClickCount++;
        console.log('🔧 TestPlugin: Canvas clicked!', {
          count: this.canvasClickCount,
          position: worldPos
        });
      },
      
      onConnectionAttempt: (source, target) => {
        console.log('🔧 TestPlugin: Connection attempt', source, '->', target);
        return true; // Allow all connections
      }
    };

    core.registerHooks(hooks);

    // Listen to custom events
    core.on('test:nodeCount', (count: number) => {
      console.log('🔧 TestPlugin: Received node count event:', count);
    });

    core.on('test:layoutApplied', (layoutType: string) => {
      console.log('🔧 TestPlugin: Layout applied:', layoutType);
    });

    // Add test methods to core for external access
    core.testPlugin = {
      getStats: this.getStats.bind(this),
      triggerTestEvent: this.triggerTestEvent.bind(this),
      simulateNodeClick: this.simulateNodeClick.bind(this)
    };

    console.log('🔧 TestPlugin initialized successfully');
  }

  cleanup(): void {
    console.log('🔧 TestPlugin cleaned up');
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
    console.log('🔧 TestPlugin: Triggering test event:', eventName, data);
    core.emit(eventName, data);
  }

  simulateNodeClick() {
    this.nodeClickCount++;
    console.log('🔧 TestPlugin: Simulated node click, count:', this.nodeClickCount);
  }
}

// Plugin instance for easy import
export const testPlugin = new TestPlugin();