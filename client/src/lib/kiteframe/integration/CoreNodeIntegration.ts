import type { KiteFramePlugin } from '../core/KiteFrameCore';
import { BasicNode } from '../components/BasicNode';
import { ImageNode } from '../components/ImageNode';

/**
 * Core Node Integration Plugin
 * Registers BasicNode and ImageNode as custom renderers in the KiteFrame system
 */
export const coreNodeIntegrationPlugin: KiteFramePlugin = {
  name: 'core-node-integration',
  version: '1.0.0',
  dependencies: [],

  initialize: (core) => {
    // Register BasicNode as custom node renderer for 'basic' type only
    // Other node types use the canvas fallback renderer which properly manages handles/toolbar
    // Note: ImageNode moved to main canvas rendering for advanced features
    const nodeRenderers = {
      'basic': BasicNode
      // 'image': ImageNode - Moved to main canvas rendering for selection, handles, and advanced imageSize modes
    };
    
    core.registerPluginHooks('core-node-integration', {
      nodeRenderers
    });
    
    // Verify registration was successful
    const hooks = core.getHooks();
    const registeredRenderers = hooks.nodeRenderers || {};
    
    // Verify our specific renderers
    const basicRegistered = registeredRenderers['basic'] === BasicNode;
    
    if (!basicRegistered) {
      console.error('Core Node Integration: FAILED - BasicNode renderer not registered properly');
      throw new Error('Core Node Integration failed to register BasicNode renderer');
    }
    
    // Emit success event
    core.emit('core-node-integration:initialized', {
      renderers: ['basic'],
      mainCanvasRenderers: ['image'],
      timestamp: new Date().toISOString()
    });
  },

  cleanup: () => {
    // Cleanup is handled by the core system when unregistering hooks
  }
};