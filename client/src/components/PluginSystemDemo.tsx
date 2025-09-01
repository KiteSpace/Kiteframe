import React, { useEffect } from 'react';
import { usePluginSystem } from '@/lib/kiteframe';

/**
 * Plugin System Demo Component
 * Demonstrates how to test the plugin system is working
 */
export function PluginSystemDemo() {
  const { core, plugins, emit } = usePluginSystem();

  useEffect(() => {
    // Simple plugin test on mount
    console.log('🔌 Plugin System Demo: Starting tests...');
    
    // Log installed plugins
    console.log('📦 Installed plugins:', plugins.map(p => `${p.name} v${p.version}`));
    
    // Test event system
    setTimeout(() => {
      emit('demo:test-event', { message: 'Plugin system working!' });
      console.log('📡 Event emitted: demo:test-event');
    }, 1000);

    // Test plugin hooks (if available)
    if (plugins.length > 0) {
      console.log('✅ Plugin system is operational');
    } else {
      console.log('⚠️ No plugins installed');
    }
  }, [plugins, emit]);

  return null; // This is a demo component that only logs to console
}

export function withPluginDemo<T extends {}>(Component: React.ComponentType<T>) {
  return function WrappedComponent(props: T) {
    return (
      <>
        <PluginSystemDemo />
        <Component {...props} />
      </>
    );
  };
}