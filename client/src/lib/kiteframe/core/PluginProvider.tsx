import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { KiteFrameCore, kiteFrameCore, PluginContext } from './KiteFrameCore';

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

  useEffect(() => {
    // Initialize context when provider mounts
    try {
      const pluginContext = core.getContext();
      setContext(pluginContext);
    } catch (error) {
      console.warn('Plugin context not yet initialized:', error);
    }

    // Cleanup on unmount
    return () => {
      core.cleanup();
    };
  }, [core]);

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
  
  return {
    core,
    context,
    /**
     * Register a plugin
     */
    usePlugin: (plugin: any) => {
      useEffect(() => {
        core.use(plugin);
        return () => core.unuse(plugin.name);
      }, [plugin]);
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