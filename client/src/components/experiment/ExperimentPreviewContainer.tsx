import { memo, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, FlaskConical, Link2, Check, Beaker } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KiteFrameCanvas } from '@/lib/kiteframe/components/KiteFrameCanvas';
import type { ExperimentSession } from '@/hooks/useExperimentState';
import { composeExperimentPreviewData } from '@/hooks/useExperimentState';
import type { Node, Edge } from '@/lib/kiteframe/types';

interface ExperimentPreviewContainerProps {
  session: ExperimentSession;
  onCancel: () => void;
  onAccept: () => void;
  onSelectExperiment: (experimentId: string) => void;
}

/**
 * ExperimentPreviewContainer
 * 
 * Phase 3: Two-column layout for pressure-testing via experiments.
 * 
 * Left column (~35-40%): 4 experiment cards with selection
 * Right column (~60-65%): Read-only canvas preview showing ONLY:
 *   - Existing origin nodes (affected by the insight)
 *   - Additions from the ACTIVE experiment
 *   - NOT the full workflow
 *   - NOT multiple experiments simultaneously
 * 
 * Constraints (Locked):
 * - Preview uses readOnly={true}
 * - Preview shows origin + active experiment additions only
 * - Clicking cards never triggers AI regeneration
 * - No withUndo() or saveToHistory() during preview
 * - Accept commits only the currently selected experiment
 */
export const ExperimentPreviewContainer = memo(function ExperimentPreviewContainer({
  session,
  onCancel,
  onAccept,
  onSelectExperiment,
}: ExperimentPreviewContainerProps) {
  const handleNodesChange = useCallback((_nodes: Node[]) => {
    // Read-only preview - no-op
  }, []);
  
  const handleEdgesChange = useCallback((_edges: Edge[]) => {
    // Read-only preview - no-op
  }, []);

  const previewData = useMemo(() => composeExperimentPreviewData(session), [session]);
  
  const activeExperiment = session.experiments.find(e => e.id === session.activeExperimentId);
  const hasSelection = session.activeExperimentId !== null;

  return (
    <div 
      className="flex flex-col h-full bg-white dark:bg-gray-900"
      data-testid="experiment-preview-container"
    >
      <div className="flex flex-1 min-h-0">
        {/* Left Column - Experiment Cards */}
        <div className="w-[38%] flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/30">
                <FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Experiments
              </h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Pressure-test your workflow with these what-if scenarios.
            </p>
          </div>
          
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-900/10">
            <div className="flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Testing Insight
              </span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 truncate">
              {session.insightTitle}
            </p>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {session.experiments.map((experiment, index) => (
                <button
                  key={experiment.id}
                  onClick={() => onSelectExperiment(experiment.id)}
                  className={cn(
                    'w-full p-3 rounded-lg border text-left transition-all',
                    experiment.id === session.activeExperimentId
                      ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-400 dark:ring-amber-500'
                      : 'border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                  data-testid={`experiment-card-${index}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      'mt-0.5 p-1 rounded',
                      experiment.id === session.activeExperimentId
                        ? 'bg-amber-200 dark:bg-amber-800'
                        : 'bg-gray-100 dark:bg-gray-700'
                    )}>
                      <Beaker className={cn(
                        'w-3 h-3',
                        experiment.id === session.activeExperimentId
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-gray-500 dark:text-gray-400'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={cn(
                        'text-sm font-medium truncate',
                        experiment.id === session.activeExperimentId
                          ? 'text-amber-900 dark:text-amber-100'
                          : 'text-gray-900 dark:text-gray-100'
                      )}>
                        {experiment.title}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {experiment.description}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {experiment.variant.nodes.length} node{experiment.variant.nodes.length !== 1 ? 's' : ''}, {experiment.variant.edges.length} connection{experiment.variant.edges.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
        
        {/* Right Column - Preview Canvas */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Preview
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hasSelection 
                  ? `Showing origin nodes + experiment additions`
                  : 'Select an experiment to preview'
                }
              </p>
            </div>
          </div>
          
          <div className="flex-1 relative bg-gray-50 dark:bg-gray-950">
            {previewData ? (
              <KiteFrameCanvas
                nodes={previewData.nodes}
                edges={previewData.edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                readOnly={true}
                showMiniMap={false}
                className="w-full h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                    <Beaker className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select an experiment to see a preview
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <div className="px-5 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              This preview shows only the hypothetical change, not your full workflow.
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer with Accept and Cancel */}
      <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900">
        <Button
          variant="outline"
          onClick={onCancel}
          data-testid="btn-cancel-experiment"
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button
          onClick={onAccept}
          disabled={!hasSelection}
          className="bg-amber-600 hover:bg-amber-700 text-white disabled:bg-gray-400"
          data-testid="btn-accept-experiment"
        >
          <Check className="w-4 h-4 mr-2" />
          Accept
        </Button>
      </div>
    </div>
  );
});
