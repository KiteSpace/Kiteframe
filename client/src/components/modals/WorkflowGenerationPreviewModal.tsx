import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Workflow, Image, Bookmark, Loader2 } from 'lucide-react';
import type { Node } from '@/lib/kiteframe/types';
import { sortFrameNodesForWorkflow, getWorkflowFramesSummary } from '@/lib/kiteframe/utils/workflowOrdering';

interface WorkflowGenerationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  frameNodes: Node[];
  onConfirm: (options: { useCleanLayout: boolean }) => void;
  isGenerating?: boolean;
}

export function WorkflowGenerationPreviewModal({
  isOpen,
  onClose,
  frameNodes,
  onConfirm,
  isGenerating = false,
}: WorkflowGenerationPreviewModalProps) {
  const [useCleanLayout, setUseCleanLayout] = useState(true);
  
  const sortedFrames = sortFrameNodesForWorkflow(frameNodes);
  const summary = getWorkflowFramesSummary(frameNodes);
  
  const validFrames = sortedFrames.filter(n => 
    n.data?.figmaSemantic && !n.data?.isReferenceFrame
  );
  const referenceFrames = sortedFrames.filter(n => n.data?.isReferenceFrame);

  const handleConfirm = () => {
    onConfirm({ useCleanLayout });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            Generate Workflow
          </DialogTitle>
          <DialogDescription>
            Review the frames that will be used to generate workflow nodes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frames to process:</span>
              <span className="font-medium">{validFrames.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated workflow steps:</span>
              <span className="font-medium">{summary.estimatedSteps}</span>
            </div>
            {referenceFrames.length > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Reference frames (excluded):</span>
                <span>{referenceFrames.length}</span>
              </div>
            )}
          </div>

          {summary.estimatedSteps > 50 && (
            <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>
                Large workflow detected ({summary.estimatedSteps} steps). Consider splitting into smaller workflows for better performance.
              </span>
            </div>
          )}

          <ScrollArea className="h-[200px] border rounded-md p-2">
            <div className="space-y-1">
              {sortedFrames.map((frame, index) => {
                const isReference = frame.data?.isReferenceFrame;
                const hasSemantics = !!frame.data?.figmaSemantic;
                
                return (
                  <div
                    key={frame.id}
                    className={`flex items-center gap-3 p-2 rounded-md ${
                      isReference 
                        ? 'bg-gray-100 dark:bg-gray-800 opacity-60' 
                        : hasSemantics 
                          ? 'bg-primary/5' 
                          : 'bg-muted/30'
                    }`}
                    data-testid={`preview-frame-${frame.id}`}
                  >
                    <span className="text-xs text-muted-foreground w-6">
                      {isReference ? '—' : index + 1}
                    </span>
                    <div className="w-6 h-6 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      {isReference ? (
                        <Bookmark size={12} className="text-muted-foreground" />
                      ) : (
                        <Image size={12} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate ${isReference ? 'text-muted-foreground line-through' : ''}`}>
                        {frame.data?.label || 'Untitled Frame'}
                      </div>
                    </div>
                    {isReference && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        Reference
                      </span>
                    )}
                    {!hasSemantics && !isReference && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                        No data
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center space-x-2">
              <Switch
                id="clean-layout"
                checked={useCleanLayout}
                onCheckedChange={setUseCleanLayout}
                data-testid="switch-clean-layout"
              />
              <Label htmlFor="clean-layout" className="text-sm">
                Apply clean vertical layout
              </Label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isGenerating}
            data-testid="button-preview-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isGenerating || validFrames.length === 0}
            data-testid="button-confirm-generate"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Workflow size={16} className="mr-2" />
                Generate Workflow
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
