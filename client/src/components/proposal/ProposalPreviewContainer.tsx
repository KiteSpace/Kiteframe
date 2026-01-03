import { memo, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Lightbulb, Link2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KiteFrameCanvas } from '@/lib/kiteframe/components/KiteFrameCanvas';
import type { ProposedWorkflow } from '@/hooks/useProposalState';
import { composePreviewData } from '@/hooks/useProposalState';
import type { Node, Edge } from '@/lib/kiteframe/types';

interface ProposalPreviewContainerProps {
  proposal: ProposedWorkflow;
  onCancel: () => void;
  onAccept: () => void;
  onVariantChange: (variant: 'proposed' | 'alternative') => void;
}

/**
 * ProposalPreviewContainer
 * 
 * Phase 2: Two-column layout with variant toggle for comparison.
 * 
 * Left column (~35-40%): Proposal details, variant tabs, insight context
 * Right column (~60-65%): Read-only canvas preview showing ONLY:
 *   - Existing origin nodes (affected by the insight)
 *   - Additions from the ACTIVE variant
 *   - NOT the full workflow
 *   - NOT both variants simultaneously
 * 
 * Constraints (Locked):
 * - Preview uses readOnly={true}
 * - Preview shows origin + active variant additions only
 * - Switching tabs never triggers AI regeneration
 * - No withUndo() or saveToHistory() during preview
 * - Accept commits only the currently active variant
 */
export const ProposalPreviewContainer = memo(function ProposalPreviewContainer({
  proposal,
  onCancel,
  onAccept,
  onVariantChange,
}: ProposalPreviewContainerProps) {
  const handleNodesChange = useCallback((_nodes: Node[]) => {
  }, []);
  
  const handleEdgesChange = useCallback((_edges: Edge[]) => {
  }, []);

  const previewData = useMemo(() => composePreviewData(proposal), [proposal]);
  
  const activeVariant = proposal.activeVariant;
  const currentVariantData = activeVariant === 'proposed' ? proposal.proposed : proposal.alternative;

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
              Compare options and choose which to apply.
            </p>
          </div>
          
          {/* Variant Toggle Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => onVariantChange('proposed')}
              className={cn(
                'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                activeVariant === 'proposed'
                  ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-purple-50/50 dark:bg-purple-900/10'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
              data-testid="tab-proposed"
            >
              Proposed
            </button>
            <button
              onClick={() => onVariantChange('alternative')}
              className={cn(
                'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                activeVariant === 'alternative'
                  ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-purple-50/50 dark:bg-purple-900/10'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
              data-testid="tab-alternative"
            >
              Alternative
            </button>
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
                  {currentVariantData.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {currentVariantData.description}
                </p>
              </div>
              
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    Adding {currentVariantData.nodes.length} node{currentVariantData.nodes.length !== 1 ? 's' : ''}, {currentVariantData.edges.length} connection{currentVariantData.edges.length !== 1 ? 's' : ''}
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
                Showing origin nodes + {activeVariant} additions
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
      
      {/* Footer with Accept and Cancel */}
      <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900">
        <Button
          variant="outline"
          onClick={onCancel}
          data-testid="btn-cancel-proposal"
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button
          onClick={onAccept}
          className="bg-purple-600 hover:bg-purple-700 text-white"
          data-testid="btn-accept-proposal"
        >
          <Check className="w-4 h-4 mr-2" />
          Accept
        </Button>
      </div>
    </div>
  );
});
