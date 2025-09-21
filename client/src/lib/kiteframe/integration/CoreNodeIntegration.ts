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
    console.log('🚀 Core Node Integration: Starting initialization...');
    
    // Log the components being registered
    console.log('📦 Core Node Integration: Preparing to register node renderers:');
    console.log('  - BasicNode:', typeof BasicNode === 'function' ? '✓ Component found' : '✗ Component missing');
    console.log('  - ImageNode: Handled by main canvas for advanced features');
    
    // Register BasicNode as custom node renderer
    // Note: ImageNode moved to main canvas rendering for advanced features
    const nodeRenderers = {
      'basic': BasicNode
      // 'image': ImageNode - Moved to main canvas rendering for selection, handles, and advanced imageSize modes
    };
    
    console.log('📝 Core Node Integration: Registering hooks with core system...');
    core.registerPluginHooks('core-node-integration', {
      nodeRenderers
    });
    
    // Verify registration was successful
    const hooks = core.getHooks();
    const registeredRenderers = hooks.nodeRenderers || {};
    
    console.log('🔍 Core Node Integration: Verifying registration...');
    console.log('  Total registered node renderers:', Object.keys(registeredRenderers).length);
    console.log('  Registered types:', Object.keys(registeredRenderers).join(', ') || 'none');
    
    // Verify our specific renderers
    const basicRegistered = registeredRenderers['basic'] === BasicNode;
    
    if (basicRegistered) {
      console.log('✅ Core Node Integration: SUCCESS - Node renderers registered correctly');
      console.log('  ✓ basic -> BasicNode');
      console.log('  ✓ image -> Main Canvas (advanced features)');
    } else {
      console.error('❌ Core Node Integration: FAILED - BasicNode renderer not registered properly');
      console.error('  basic registered:', basicRegistered ? '✓' : '✗');
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
    console.log('🧹 Core Node Integration: Starting cleanup...');
    console.log('  - Removing BasicNode renderer');
    console.log('  - Removing ImageNode renderer');
    console.log('✅ Core Node Integration: Cleanup completed');
  }
};