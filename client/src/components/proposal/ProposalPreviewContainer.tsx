import { memo, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Lightbulb, Link2 } from 'lucide-react';
import { KiteFrameCanvas } from '@/lib/kiteframe/components/KiteFrameCanvas';
import type { ProposedWorkflow } from '@/hooks/useProposalState';
import { composePreviewData } from '@/hooks/useProposalState';
import type { Node, Edge } from '@/lib/kiteframe/types';

interface ProposalPreviewContainerProps {
  proposal: ProposedWorkflow;
  onCancel: () => void;
}

/**
 * ProposalPreviewContainer
 * 
 * Two-column layout for displaying a surgical proposal preview.
 * 
 * Left column (~35-40%): Proposal details (insight context, title, description)
 * Right column (~60-65%): Read-only canvas preview showing ONLY:
 *   - Existing origin nodes (affected by the insight)
 *   - Proposed new nodes and edges
 *   - NOT the full workflow
 * 
 * Constraints (Locked):
 * - Preview uses readOnly={true}
 * - Preview shows origin + additions only (not full workflow)
 * - No withUndo() or saveToHistory() calls
 * - No visual changes to nodes or edges
 * - Distinction lives entirely in container chrome
 */
export const ProposalPreviewContainer = memo(function ProposalPreviewContainer({
  proposal,
  onCancel,
}: ProposalPreviewContainerProps) {
  const handleNodesChange = useCallback((_nodes: Node[]) => {
  }, []);
  
  const handleEdgesChange = useCallback((_edges: Edge[]) => {
  }, []);

  const previewData = useMemo(() => composePreviewData(proposal), [proposal]);

  return (
    <div 
      className="flex flex-col h-full bg-white dark:bg-gray-900"
      data-testid="proposal-preview-container"
    >
      <div className="flex flex-1 min-h-0">
        <div className="w-[38%] flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/30">
                <Lightbulb className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Proposed Addition
              </h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Here is a surgical change I'm proposing to address your insight.
            </p>
          </div>
          
          <ScrollArea className="flex-1 px-5 py-4">
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-1">
                  <Link2 className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                    Addressing Insight
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {proposal.insightTitle}
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {proposal.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {proposal.description}
                </p>
              </div>
              
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    Adding {proposal.proposedNodes.length} node{proposal.proposedNodes.length !== 1 ? 's' : ''}, {proposal.proposedEdges.length} connection{proposal.proposedEdges.length !== 1 ? 's' : ''}
                  </span>
                  <span>
                    {new Date(proposal.generatedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
        
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Preview
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing origin nodes + proposed additions
              </p>
            </div>
          </div>
          
          <div className="flex-1 relative bg-gray-50 dark:bg-gray-950">
            <KiteFrameCanvas
              nodes={previewData.nodes}
              edges={previewData.edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              readOnly={true}
              showMiniMap={false}
              className="w-full h-full"
            />
          </div>
          
          <div className="px-5 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              This preview shows only the proposed change, not your full workflow.
            </p>
          </div>
        </div>
      </div>
      
      <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900">
        <Button
          variant="outline"
          onClick={onCancel}
          data-testid="btn-cancel-proposal"
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
      </div>
    </div>
  );
});
