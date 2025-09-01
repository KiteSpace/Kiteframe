import type { KiteFramePlugin } from '../../core/KiteFrameCore';

/**
 * Quick Test Plugin
 * Minimal plugin for immediate testing
 */
export class QuickTestPlugin implements KiteFramePlugin {
  name = 'quick-test';
  version = '1.0.0';

  initialize(core: any): void {
    console.log('⚡ QuickTest Plugin: Initialized!');
    
    // Simple canvas click counter
    let clickCount = 0;
    core.registerHooks({
      onCanvasClick: () => {
        clickCount++;
        console.log(`⚡ QuickTest Plugin: Canvas clicked ${clickCount} times`);
      }
    });
    
    console.log('⚡ QuickTest Plugin: Ready! Click the canvas to test.');
  }

  cleanup(): void {
    console.log('⚡ QuickTest Plugin: Cleaned up');
  }
}

export const quickTestPlugin = new QuickTestPlugin();