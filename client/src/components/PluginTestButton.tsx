import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TestTube } from 'lucide-react';
import { PluginTestPanel } from './PluginTestPanel';

interface PluginTestButtonProps {
  nodes: any[];
  edges: any[];
}

export function PluginTestButton({ nodes, edges }: PluginTestButtonProps) {
  const [showTestPanel, setShowTestPanel] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowTestPanel(true)}
        className="flex items-center gap-2"
        title="Test Plugin System"
      >
        <TestTube className="w-4 h-4" />
        Test Plugins
      </Button>

      {showTestPanel && (
        <PluginTestPanel
          onClose={() => setShowTestPanel(false)}
          nodes={nodes}
          edges={edges}
        />
      )}
    </>
  );
}