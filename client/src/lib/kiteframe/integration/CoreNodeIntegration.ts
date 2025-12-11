import type { KiteFramePlugin } from '../core/KiteFrameCore';
import { ImageNode } from '../components/ImageNode';

/**
 * Core Node Integration Plugin
 * Registers ImageNode as custom renderer in the KiteFrame system
 * Note: BasicNode was deprecated and removed - use 'process' type nodes instead
 */
export const coreNodeIntegrationPlugin: KiteFramePlugin = {
  name: 'core-node-integration',
  version: '1.0.0',
  dependencies: [],

  initialize: (core) => {
    // Note: ImageNode is now handled in main canvas rendering for selection, handles, and advanced features
    // No custom node renderers needed - all node types use the canvas fallback renderer
    const nodeRenderers = {};
    
    core.registerPluginHooks('core-node-integration', {
      nodeRenderers
    });
    
    // Emit success event
    core.emit('core-node-integration:initialized', {
      renderers: [],
      mainCanvasRenderers: ['image'],
      timestamp: new Date().toISOString()
    });
  },

  cleanup: () => {
    // Cleanup is handled by the core system when unregistering hooks
  }
};
