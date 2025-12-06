import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { KiteFrameCore, kiteFrameCore, PluginContext } from './KiteFrameCore';
import { coreNodeIntegrationPlugin } from '../integration/CoreNodeIntegration';
import { useTelemetry, TelemetryEventType } from '../utils/telemetry';

/**
 * Plugin Context for React components
 */
const PluginContextReact = createContext<{
  core: KiteFrameCore;
  context: PluginContext | null;
}>({
  core: kiteFrameCore,
  context: null
});

/**
 * Plugin Provider Props
 */
interface PluginProviderProps {
  children: ReactNode;
  core?: KiteFrameCore;
}

/**
 * Plugin Provider Component
 * Provides plugin system context to React components
 */
export const PluginProvider: React.FC<PluginProviderProps> = ({
  children,
  core = kiteFrameCore
}) => {
  const [context, setContext] = useState<PluginContext | null>(null);
  const telemetry = useTelemetry();

  useEffect(() => {
    const startTime = performance.now();
    
    // Auto-register core integration plugin
    const existingPlugin = core.getPlugin('core-node-integration');
    if (!existingPlugin) {
      try {
        core.use(coreNodeIntegrationPlugin);
        
        // Track plugin registration
        telemetry.track(TelemetryEventType.PLUGIN_ACTION, {
          category: 'plugin',
          action: 'register',
          label: 'core-node-integration',
          duration: performance.now() - startTime,
          metadata: {
            pluginName: 'core-node-integration',
            pluginVersion: coreNodeIntegrationPlugin.version
          }
        });
        
        // Verify the plugin was registered
        const plugin = core.getPlugin('core-node-integration');
        if (!plugin) {
          console.error('PluginProvider: Plugin registration verification failed');
        }
      } catch (error) {
        console.error('PluginProvider: Failed to register core node integration plugin:', error);
        
        // Track plugin registration error
        telemetry.track(TelemetryEventType.ERROR, {
          category: 'plugin',
          action: 'register-failed',
          label: 'core-node-integration',
          error: error as Error,
          metadata: {
            pluginName: 'core-node-integration'
          }
        });
      }
    }

    // Initialize context when provider mounts
    try {
      const pluginContext = core.getContext();
      setContext(pluginContext);
      
      // Track plugin system initialization
      telemetry.track(TelemetryEventType.INITIALIZATION, {
        category: 'plugin-system',
        action: 'initialized',
        duration: performance.now() - startTime,
        metadata: {
          totalPlugins: core.getPlugins().length,
          plugins: core.getPlugins().map(p => ({ name: p.name, version: p.version }))
        }
      });
    } catch (error) {
      console.warn('PluginProvider: Plugin context not yet initialized:', error);
      
      // Track context initialization warning
      telemetry.track(TelemetryEventType.WARNING, {
        category: 'plugin-system',
        action: 'context-init-warning',
        error: error as Error
      });
    }
    
    // Listen for core-node-integration events
    const unsubscribe = core.on('core-node-integration:initialized', (data) => {
      // Core node integration initialized
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      core.cleanup();
      
      // Track cleanup
      telemetry.track(TelemetryEventType.CLEANUP, {
        category: 'plugin-system',
        action: 'cleaned-up',
        metadata: {
          totalPlugins: core.getPlugins().length
        }
      });
    };
  }, [core, telemetry]);

  return (
    <PluginContextReact.Provider value={{ core, context }}>
      {children}
    </PluginContextReact.Provider>
  );
};

/**
 * Hook to access plugin system
 */
export const usePluginSystem = () => {
  const { core, context } = useContext(PluginContextReact);
  const telemetry = useTelemetry();
  
  return {
    core,
    context,
    /**
     * Register a plugin
     */
    usePlugin: (plugin: any) => {
      useEffect(() => {
        const startTime = performance.now();
        core.use(plugin);
        
        // Track plugin registration
        telemetry.track(TelemetryEventType.PLUGIN_ACTION, {
          category: 'plugin',
          action: 'use',
          label: plugin.name,
          duration: performance.now() - startTime,
          metadata: {
            pluginName: plugin.name,
            pluginVersion: plugin.version
          }
        });
        
        return () => {
          core.unuse(plugin.name);
          
          // Track plugin removal
          telemetry.track(TelemetryEventType.PLUGIN_ACTION, {
            category: 'plugin',
            action: 'unuse',
            label: plugin.name,
            metadata: {
              pluginName: plugin.name
            }
          });
        };
      }, [plugin, telemetry]);
    },
    /**
     * Get installed plugins
     */
    plugins: core.getPlugins(),
    /**
     * Check if plugin is installed
     */
    hasPlugin: (name: string) => core.getPlugin(name) !== undefined,
    /**
     * Emit plugin event
     */
    emit: (event: string, data?: any) => core.emit(event, data),
    /**
     * Listen to plugin events
     */
    on: (event: string, callback: (data?: any) => void) => {
      useEffect(() => {
        const unsubscribe = core.on(event, callback);
        return unsubscribe;
      }, [event, callback]);
    }
  };
};

/**
 * Hook to access plugin context
 */
export const usePluginContext = (): PluginContext | null => {
  const { context } = useContext(PluginContextReact);
  return context;
};

/**
 * Hook to use specific plugin
 */
export const usePlugin = <T = any>(pluginName: string): T | null => {
  const { core } = useContext(PluginContextReact);
  const [plugin, setPlugin] = useState<T | null>(null);

  useEffect(() => {
    const foundPlugin = core.getPlugin(pluginName);
    setPlugin(foundPlugin as T || null);
  }, [core, pluginName]);

  return plugin;
};