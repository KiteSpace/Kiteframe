import { useState, useMemo } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, Workflow, Image, Bookmark, Loader2, Sparkles, ListTree, ListChecks } from 'lucide-react';
import type { Node } from '@/lib/kiteframe/types';
import { sortFrameNodesForWorkflow, getWorkflowFramesSummary } from '@/lib/kiteframe/utils/workflowOrdering';
import { getWorkflowPreview } from '@/lib/integration/semanticWorkflowGenerator';
import type { WorkflowGenerationMode } from '@/lib/integration/figmaSemanticTypes';

interface WorkflowGenerationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  frameNodes: Node[];
  onConfirm: (options: { useCleanLayout: boolean; mode: WorkflowGenerationMode }) => void;
  isGenerating?: boolean;
}

const MODE_INFO: Record<WorkflowGenerationMode, { label: string; description: string; icon: typeof ListChecks }> = {
  summary: {
    label: 'Summary',
    description: '7-10 steps, primary path only',
    icon: ListChecks,
  },
  detailed: {
    label: 'Detailed',
    description: '25-30 steps with branches',
    icon: ListTree,
  },
  ai_refined: {
    label: 'AI Refined',
    description: 'AI-optimized flow (requires API)',
    icon: Sparkles,
  },
};

export function WorkflowGenerationPreviewModal({
  isOpen,
  onClose,
  frameNodes,
  onConfirm,
  isGenerating = false,
}: WorkflowGenerationPreviewModalProps) {
  const [useCleanLayout, setUseCleanLayout] = useState(true);
  const [selectedMode, setSelectedMode] = useState<WorkflowGenerationMode>('summary');
  
  const sortedFrames = sortFrameNodesForWorkflow(frameNodes);
  const summary = getWorkflowFramesSummary(frameNodes);
  
  const validFrames = sortedFrames.filter(n => 
    n.data?.figmaSemantic && !n.data?.isReferenceFrame
  );
  const referenceFrames = sortedFrames.filter(n => n.data?.isReferenceFrame);

  const modePreview = useMemo(() => {
    if (validFrames.length === 0) return null;
    
    const firstValidFrame = validFrames[0];
    const semantic = firstValidFrame.data?.figmaSemantic;
    if (!semantic) return null;
    
    try {
      return getWorkflowPreview(semantic, selectedMode);
    } catch {
      return null;
    }
  }, [validFrames, selectedMode]);

  const handleConfirm = () => {
    onConfirm({ useCleanLayout, mode: selectedMode });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            Generate Workflow
          </DialogTitle>
          <DialogDescription>
            Select a generation mode and review the frames
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Generation Mode</Label>
            <RadioGroup
              value={selectedMode}
              onValueChange={(v) => setSelectedMode(v as WorkflowGenerationMode)}
              className="grid grid-cols-3 gap-2"
            >
              {(Object.keys(MODE_INFO) as WorkflowGenerationMode[]).map((mode) => {
                const info = MODE_INFO[mode];
                const Icon = info.icon;
                return (
                  <div key={mode} className="relative">
                    <RadioGroupItem
                      value={mode}
                      id={`mode-${mode}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`mode-${mode}`}
                      className="flex flex-col items-center gap-1.5 rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
                      data-testid={`radio-mode-${mode}`}
                    >
                      <Icon size={18} className={selectedMode === mode ? 'text-primary' : 'text-muted-foreground'} />
                      <span className="text-xs font-medium">{info.label}</span>
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">
                        {info.description}
                      </span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {modePreview && (
            <div className="text-xs bg-muted/50 rounded-md p-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated steps (per frame):</span>
                <span className="font-medium">{modePreview.estimatedNodes}</span>
              </div>
              {modePreview.stepLabels.length > 0 && (
                <div className="pt-1 border-t border-border/50">
                  <span className="text-muted-foreground">Preview: </span>
                  <span className="text-foreground">
                    {modePreview.stepLabels.slice(0, 3).join(' → ')}
                    {modePreview.stepLabels.length > 3 && ' ...'}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frames to process:</span>
              <span className="font-medium">{validFrames.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total estimated steps:</span>
              <span className="font-medium">
                {selectedMode === 'summary' 
                  ? `~${validFrames.length * 5}-${validFrames.length * 10}`
                  : selectedMode === 'detailed'
                    ? `~${validFrames.length * 15}-${validFrames.length * 30}`
                    : `~${validFrames.length * 10}-${validFrames.length * 20}`
                }
              </span>
            </div>
            {referenceFrames.length > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Reference frames (excluded):</span>
                <span>{referenceFrames.length}</span>
              </div>
            )}
          </div>

          {summary.estimatedSteps > 50 && selectedMode === 'detailed' && (
            <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>
                Large workflow detected. Consider using Summary mode or splitting into smaller workflows.
              </span>
            </div>
          )}

          <ScrollArea className="h-[160px] border rounded-md p-2">
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
