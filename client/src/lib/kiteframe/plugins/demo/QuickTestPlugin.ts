import type { KiteFramePlugin } from '../../core/KiteFrameCore';

/**
 * Quick Test Plugin
 * Minimal plugin for immediate testing
 */
export class QuickTestPlugin implements KiteFramePlugin {
  name = 'quick-test';
  version = '1.0.0';

  initialize(core: any): void {
    // Simple canvas click counter
    let clickCount = 0;
    core.registerHooks({
      onCanvasClick: () => {
        clickCount++;
      }
    });
  }

  cleanup(): void {
    // Cleanup complete
  }
}

export const quickTestPlugin = new QuickTestPlugin();