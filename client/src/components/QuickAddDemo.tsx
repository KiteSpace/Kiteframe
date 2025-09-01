import React, { useEffect } from 'react';

/**
 * Quick Add Demo Component
 * Demonstrates the advanced interactions quick-add functionality
 */
export function QuickAddDemo() {
  useEffect(() => {
    // Listen for quick-add events from the plugin
    const handleQuickAdd = (e: CustomEvent) => {
      console.log('🚀 QuickAdd Demo: Received quick-add request', e.detail);
      
      // This would integrate with the main workflow editor
      // For now, just log the request
      const { sourceNodeId, position, direction } = e.detail;
      console.log(`Creating new node from ${sourceNodeId} at ${direction} position`);
      
      // Simulate node creation
      setTimeout(() => {
        console.log(`✅ New node created and connected to ${sourceNodeId}`);
      }, 500);
    };

    window.addEventListener('kiteframe:quick-add-node', handleQuickAdd as EventListener);
    
    return () => {
      window.removeEventListener('kiteframe:quick-add-node', handleQuickAdd as EventListener);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-card p-4 rounded-lg shadow-lg border max-w-sm">
      <h3 className="font-semibold text-sm mb-2">🚀 Advanced Interactions Pro</h3>
      <p className="text-xs text-muted-foreground mb-2">
        Hover over nodes to see quick-add handles with (+) buttons
      </p>
      <div className="text-xs text-green-600">
        ✨ Premium feature active
      </div>
    </div>
  );
}