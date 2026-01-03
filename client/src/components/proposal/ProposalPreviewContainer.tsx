import { memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Lightbulb } from 'lucide-react';
import { KiteFrameCanvas } from '@/lib/kiteframe/components/KiteFrameCanvas';
import type { ProposedWorkflow } from '@/hooks/useProposalState';
import type { Node, Edge } from '@/lib/kiteframe/types';

interface ProposalPreviewContainerProps {
  proposal: ProposedWorkflow;
  onCancel: () => void;
}

/**
 * ProposalPreviewContainer
 * 
 * Two-column layout for displaying a proposed workflow preview.
 * 
 * Left column (~35-40%): Proposal details (title, description)
 * Right column (~60-65%): Read-only canvas preview
 * 
 * Constraints (Locked):
 * - Preview uses readOnly={true}
 * - Preview uses cloned nodes/edges only
 * - No withUndo() or saveToHistory() calls
 * - No visual changes to nodes or edges
 * - Distinction lives entirely in container chrome
 */
export const ProposalPreviewContainer = memo(function ProposalPreviewContainer({
  proposal,
  onCancel,
}: ProposalPreviewContainerProps) {
  // No-op handlers for read-only canvas (required props but never called in readOnly mode)
  const handleNodesChange = useCallback((_nodes: Node[]) => {
    // Intentionally empty - read-only preview never mutates state
  }, []);
  
  const handleEdgesChange = useCallback((_edges: Edge[]) => {
    // Intentionally empty - read-only preview never mutates state
  }, []);

  return (
    <div 
      className="flex flex-col h-full bg-white dark:bg-gray-900"
      data-testid="proposal-preview-container"
    >
      {/* Main content - two column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left column - Proposal details (~35-40%) */}
        <div className="w-[38%] flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/30">
                <Lightbulb className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Proposed Solution
              </h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Here's what I recommend based on what you have so far.
            </p>
          </div>
          
          <ScrollArea className="flex-1 px-5 py-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {proposal.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {proposal.description}
                </p>
              </div>
              
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Generated {new Date(proposal.generatedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </ScrollArea>
        </div>
        
        {/* Right column - Preview canvas (~60-65%) */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Proposed workflow
            </h3>
          </div>
          
          <div className="flex-1 relative bg-gray-50 dark:bg-gray-950">
            <KiteFrameCanvas
              nodes={proposal.nodes}
              edges={proposal.edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              readOnly={true}
              showMiniMap={false}
              className="w-full h-full"
            />
          </div>
          
          {/* Helper text below canvas */}
          <div className="px-5 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              You can edit this workflow after accepting it.
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer with Cancel button */}
      <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900">
        <Button
          variant="outline"
          onClick={onCancel}
          data-testid="btn-cancel-proposal"
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        {/* Accept button will be added in Phase 3 */}
      </div>
    </div>
  );
});
