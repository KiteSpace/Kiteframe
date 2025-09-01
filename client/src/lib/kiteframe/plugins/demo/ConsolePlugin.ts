import type { KiteFramePlugin, PluginHooks } from '../../core/KiteFrameCore';

/**
 * Console Demo Plugin
 * Simple plugin to demonstrate basic functionality with console logging
 */
export class ConsolePlugin implements KiteFramePlugin {
  name = 'console-demo';
  version = '1.0.0';

  initialize(core: any): void {
    console.log('🔌 ConsolePlugin: Initializing...');
    
    // Register hooks to demonstrate plugin system
    const hooks: PluginHooks = {
      afterNodesChange: (nodes) => {
        console.log('🔌 ConsolePlugin: Node count changed to', nodes.length);
      },
      
      onCanvasClick: (event, worldPos) => {
        console.log('🔌 ConsolePlugin: Canvas clicked at', worldPos);
      }
    };

    core.registerHooks(hooks);

    // Listen to layout events
    core.on('layout:horizontal', () => {
      console.log('🔌 ConsolePlugin: Horizontal layout applied');
    });
    
    core.on('layout:vertical', () => {
      console.log('🔌 ConsolePlugin: Vertical layout applied');
    });

    console.log('🔌 ConsolePlugin: Ready! Watch the console for activity.');
  }

  cleanup(): void {
    console.log('🔌 ConsolePlugin: Cleaned up');
  }
}

// Plugin instance for easy import
export const consolePlugin = new ConsolePlugin();