import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KiteFrameCore } from '../../core/KiteFrameCore';
import type { KiteFramePlugin } from '../../core/KiteFrameCore';

describe('KiteFrameCore', () => {
  let core: KiteFrameCore;

  beforeEach(() => {
    core = new KiteFrameCore();
  });

  describe('Plugin Management', () => {
    it('initializes with empty plugin list', () => {
      expect(core.getPlugins()).toEqual([]);
    });

    it('registers a plugin successfully', () => {
      const mockPlugin: KiteFramePlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        initialize: vi.fn()
      };

      core.use(mockPlugin);
      
      expect(core.getPlugins()).toContain('test-plugin');
      expect(mockPlugin.initialize).toHaveBeenCalledWith(core);
    });

    it('prevents duplicate plugin registration', () => {
      const mockPlugin: KiteFramePlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        initialize: vi.fn()
      };

      core.use(mockPlugin);
      core.use(mockPlugin);
      
      expect(mockPlugin.initialize).toHaveBeenCalledTimes(1);
    });

    it('handles plugin with dependencies', () => {
      const dependency: KiteFramePlugin = {
        name: 'dependency',
        version: '1.0.0',
        initialize: vi.fn()
      };

      const dependent: KiteFramePlugin = {
        name: 'dependent',
        version: '1.0.0',
        dependencies: ['dependency'],
        initialize: vi.fn()
      };

      // Should throw if dependency not met
      expect(() => core.use(dependent)).toThrow();

      // Should work after dependency installed
      core.use(dependency);
      core.use(dependent);
      
      expect(core.getPlugins()).toEqual(['dependency', 'dependent']);
    });

    it('uninstalls a plugin and calls cleanup', () => {
      const mockCleanup = vi.fn();
      const mockPlugin: KiteFramePlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        initialize: vi.fn(),
        cleanup: mockCleanup
      };

      core.use(mockPlugin);
      core.unuse('test-plugin');
      
      expect(mockCleanup).toHaveBeenCalled();
      expect(core.getPlugins()).not.toContain('test-plugin');
    });

    it('handles plugin initialization errors gracefully', () => {
      const mockPlugin: KiteFramePlugin = {
        name: 'error-plugin',
        version: '1.0.0',
        initialize: vi.fn(() => {
          throw new Error('Plugin init failed');
        })
      };

      expect(() => core.use(mockPlugin)).toThrow('Plugin init failed');
      expect(core.getPlugins()).not.toContain('error-plugin');
    });
  });

  describe('Hook System', () => {
    it('registers and retrieves hooks', () => {
      const hooks = {
        beforeNodesChange: vi.fn((nodes) => nodes),
        afterNodesChange: vi.fn()
      };

      core.registerHooks(hooks);
      const retrievedHooks = core.getHooks();
      
      expect(retrievedHooks.beforeNodesChange).toBe(hooks.beforeNodesChange);
      expect(retrievedHooks.afterNodesChange).toBe(hooks.afterNodesChange);
    });

    it('merges hooks from multiple sources', () => {
      const hooks1 = {
        beforeNodesChange: vi.fn((nodes) => nodes)
      };
      
      const hooks2 = {
        afterNodesChange: vi.fn()
      };

      core.registerHooks(hooks1);
      core.registerHooks(hooks2);
      
      const merged = core.getHooks();
      expect(merged.beforeNodesChange).toBe(hooks1.beforeNodesChange);
      expect(merged.afterNodesChange).toBe(hooks2.afterNodesChange);
    });

    it('tracks plugin-specific hooks', () => {
      const mockPlugin: KiteFramePlugin = {
        name: 'hook-plugin',
        version: '1.0.0',
        initialize: (core) => {
          core.registerPluginHooks('hook-plugin', {
            onCanvasClick: vi.fn()
          });
        }
      };

      core.use(mockPlugin);
      const hooks = core.getHooks();
      
      expect(hooks.onCanvasClick).toBeDefined();
      
      // Uninstall should remove hooks
      core.unuse('hook-plugin');
      const clearedHooks = core.getHooks();
      expect(clearedHooks.onCanvasClick).toBeUndefined();
    });

    it('handles node renderers registration', () => {
      const CustomNode = () => null;
      
      core.registerPluginHooks('test', {
        nodeRenderers: {
          custom: CustomNode as any
        }
      });
      
      const hooks = core.getHooks();
      expect(hooks.nodeRenderers?.custom).toBe(CustomNode);
    });
  });

  describe('Event System', () => {
    it('emits and listens to events', () => {
      const listener = vi.fn();
      
      core.on('test-event', listener);
      core.emit('test-event', { data: 'test' });
      
      expect(listener).toHaveBeenCalledWith({ data: 'test' });
    });

    it('removes event listeners', () => {
      const listener = vi.fn();
      
      const unsubscribe = core.on('test-event', listener);
      unsubscribe();
      
      core.emit('test-event', { data: 'test' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('handles multiple listeners for same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      core.on('test-event', listener1);
      core.on('test-event', listener2);
      core.emit('test-event', 'data');
      
      expect(listener1).toHaveBeenCalledWith('data');
      expect(listener2).toHaveBeenCalledWith('data');
    });

    it('handles listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();
      
      core.on('test-event', errorListener);
      core.on('test-event', normalListener);
      
      // Should not throw and should call second listener
      expect(() => core.emit('test-event', 'data')).not.toThrow();
      expect(normalListener).toHaveBeenCalledWith('data');
    });
  });

  describe('Context System', () => {
    it('provides context object', () => {
      const context = core.getContext();
      
      expect(context).toHaveProperty('getNodes');
      expect(context).toHaveProperty('getEdges');
      expect(context).toHaveProperty('updateNodes');
      expect(context).toHaveProperty('updateEdges');
      expect(context).toHaveProperty('emit');
      expect(context).toHaveProperty('on');
    });

    it('context methods interact with core', () => {
      const context = core.getContext();
      const listener = vi.fn();
      
      context.on('test', listener);
      context.emit('test', 'data');
      
      expect(listener).toHaveBeenCalledWith('data');
    });
  });

  describe('Cleanup', () => {
    it('clears all plugins and listeners on cleanup', () => {
      const mockPlugin: KiteFramePlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        initialize: vi.fn(),
        cleanup: vi.fn()
      };
      
      const listener = vi.fn();
      
      core.use(mockPlugin);
      core.on('test-event', listener);
      core.registerHooks({ onCanvasClick: vi.fn() });
      
      core.cleanup();
      
      expect(core.getPlugins()).toEqual([]);
      expect(core.getHooks()).toEqual({});
      
      // Events should not fire after cleanup
      core.emit('test-event', 'data');
      expect(listener).not.toHaveBeenCalled();
    });
  });
});