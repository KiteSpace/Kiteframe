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
    console.log('  - ImageNode:', typeof ImageNode === 'function' ? '✓ Component found' : '✗ Component missing');
    
    // Register BasicNode and ImageNode as custom node renderers
    const nodeRenderers = {
      'basic': BasicNode,
      'image': ImageNode
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
    const imageRegistered = registeredRenderers['image'] === ImageNode;
    
    if (basicRegistered && imageRegistered) {
      console.log('✅ Core Node Integration: SUCCESS - All node renderers registered correctly');
      console.log('  ✓ basic -> BasicNode');
      console.log('  ✓ image -> ImageNode');
    } else {
      console.error('❌ Core Node Integration: FAILED - Some renderers not registered properly');
      console.error('  basic registered:', basicRegistered ? '✓' : '✗');
      console.error('  image registered:', imageRegistered ? '✓' : '✗');
      throw new Error('Core Node Integration failed to register all required renderers');
    }
    
    // Emit success event
    core.emit('core-node-integration:initialized', {
      renderers: ['basic', 'image'],
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