import type { KiteFramePlugin, PluginHooks } from '../../core/KiteFrameCore';

/**
 * Console Demo Plugin
 * Simple plugin to demonstrate basic functionality with console logging
 */
export class ConsolePlugin implements KiteFramePlugin {
  name = 'console-demo';
  version = '1.0.0';

  initialize(core: any): void {
    // Register hooks to demonstrate plugin system
    const hooks: PluginHooks = {
      afterNodesChange: (nodes) => {
        // Node count changed
      },
      
      onCanvasClick: (event, worldPos) => {
        // Canvas clicked
      }
    };

    core.registerHooks(hooks);

    // Listen to layout events
    core.on('layout:horizontal', () => {
      // Horizontal layout applied
    });
    
    core.on('layout:vertical', () => {
      // Vertical layout applied
    });
  }

  cleanup(): void {
    // Cleanup complete
  }
}

// Plugin instance for easy import
export const consolePlugin = new ConsolePlugin();