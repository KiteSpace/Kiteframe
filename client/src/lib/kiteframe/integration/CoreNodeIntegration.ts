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
    // Register BasicNode and ImageNode as custom node renderers
    core.registerPluginHooks('core-node-integration', {
      nodeRenderers: {
        'basic': BasicNode,
        'image': ImageNode
      }
    });

    console.log('✅ Core Node Integration: BasicNode and ImageNode registered as custom renderers');
  },

  cleanup: () => {
    // Cleanup is handled by the core system when unregistering hooks
    console.log('🧹 Core Node Integration: Cleaned up node renderers');
  }
};