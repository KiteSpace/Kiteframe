import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, FileText, FileJson, FileCode, ExternalLink, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { assembleProjectPRD, getAvailableWorkflowsForExport, type WorkflowCanvasData } from '@/lib/prd/assembleProjectPRD';
import { downloadPrototypingPrompt } from '@/lib/prd/exporters/exportToPrototypingPrompt';
import { downloadKiteframeJSON } from '@/lib/prd/exporters/exportToKiteframeJSON';
import { downloadMarkdown } from '@/lib/prd/exporters/exportToMarkdown';
import { exportToGoogleDocs } from '@/lib/prd/exporters/exportToGoogleDocs';
import type { WorkflowPRD } from '@/ai/prdEngine';
import { loadWorkflowPRD } from '@/lib/kiteframe/utils/prdStorage';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';

type ExportFormat = 'prototyping-prompt' | 'kiteframe-json' | 'markdown' | 'google-docs';

interface WorkflowData {
  id: string;
  name: string;
  nodes?: Node[];
  edges?: Edge[];
  canvasObjects?: CanvasObject[];
}

interface ExportPRDModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  projectDescription?: string;
  workflows: WorkflowData[];
}

interface WorkflowWithPRD {
  id: string;
  name: string;
  hasPRD: boolean;
}

export function ExportPRDModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  projectDescription,
  workflows
}: ExportPRDModalProps) {
  const { toast } = useToast();
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ExportFormat>('prototyping-prompt');
  const [isExporting, setIsExporting] = useState(false);

  const workflowsWithPRD = useMemo<WorkflowWithPRD[]>(() => {
    const availableIds = new Set(getAvailableWorkflowsForExport(projectId));
    return workflows.map(w => ({
      id: w.id,
      name: w.name,
      hasPRD: availableIds.has(w.id)
    }));
  }, [projectId, workflows]);

  const selectableWorkflows = workflowsWithPRD.filter(w => w.hasPRD);

  useEffect(() => {
    if (isOpen && selectableWorkflows.length > 0) {
      setSelectedWorkflows(new Set(selectableWorkflows.map(w => w.id)));
    }
  }, [isOpen, selectableWorkflows.length]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedWorkflows(new Set(selectableWorkflows.map(w => w.id)));
    } else {
      setSelectedWorkflows(new Set());
    }
  };

  const handleToggleWorkflow = (workflowId: string, checked: boolean) => {
    const newSet = new Set(selectedWorkflows);
    if (checked) {
      newSet.add(workflowId);
    } else {
      newSet.delete(workflowId);
    }
    setSelectedWorkflows(newSet);
  };

  const allSelected = selectableWorkflows.length > 0 && 
    selectableWorkflows.every(w => selectedWorkflows.has(w.id));

  const handleExport = async () => {
    if (selectedWorkflows.size === 0) {
      toast({
        title: 'No workflows selected',
        description: 'Please select at least one workflow to export.',
        variant: 'destructive'
      });
      return;
    }

    setIsExporting(true);

    try {
      const workflowNames: Record<string, string> = {};
      const workflowCanvasData: Record<string, WorkflowCanvasData> = {};
      
      workflows.forEach(w => {
        workflowNames[w.id] = w.name;
        if (w.nodes || w.edges) {
          workflowCanvasData[w.id] = {
            nodes: w.nodes || [],
            edges: w.edges || [],
            canvasObjects: w.canvasObjects
          };
        }
      });

      const assembled = assembleProjectPRD({
        projectId,
        projectName,
        projectDescription,
        selectedWorkflowIds: Array.from(selectedWorkflows),
        workflowNames,
        workflowCanvasData
      });

      switch (format) {
        case 'prototyping-prompt':
          downloadPrototypingPrompt(assembled);
          toast({ title: 'Export complete', description: 'Prototyping prompt downloaded.' });
          break;
        case 'kiteframe-json':
          downloadKiteframeJSON(assembled);
          toast({ title: 'Export complete', description: 'JSON file downloaded.' });
          break;
        case 'markdown':
          downloadMarkdown(assembled);
          toast({ title: 'Export complete', description: 'Markdown file downloaded.' });
          break;
        case 'google-docs':
          const result = await exportToGoogleDocs(assembled);
          if (result.success && result.documentUrl) {
            window.open(result.documentUrl, '_blank');
            toast({ title: 'Export complete', description: 'Document created in Google Docs.' });
          } else {
            toast({ 
              title: 'Export failed', 
              description: result.error || 'Failed to export to Google Docs.',
              variant: 'destructive'
            });
          }
          break;
      }

      onClose();
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'An error occurred during export.',
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const formatOptions = [
    {
      value: 'prototyping-prompt' as const,
      label: 'Prototyping Prompt',
      description: 'Structured text for Cursor, Claude, or GPT',
      icon: FileCode
    },
    {
      value: 'kiteframe-json' as const,
      label: 'Kiteframe PRD',
      description: 'Full JSON export for reimport',
      icon: FileJson
    },
    {
      value: 'markdown' as const,
      label: 'Markdown',
      description: 'Clean portable markdown file',
      icon: FileText
    },
    {
      value: 'google-docs' as const,
      label: 'Google Docs',
      description: 'Create a new Google Doc (requires auth)',
      icon: ExternalLink
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Project PRD
          </DialogTitle>
          <DialogDescription>
            Select workflows and choose an export format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Workflows</Label>
              {selectableWorkflows.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                  <Label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">
                    Select all
                  </Label>
                </div>
              )}
            </div>

            <div className="border rounded-lg max-h-48 overflow-y-auto">
              {workflowsWithPRD.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No workflows found in this project.
                </div>
              ) : selectableWorkflows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No workflows have generated PRDs yet. Generate PRDs for your workflows first.
                </div>
              ) : (
                <div className="divide-y">
                  {workflowsWithPRD.map(workflow => (
                    <div 
                      key={workflow.id} 
                      className={`flex items-center gap-3 px-3 py-2 ${!workflow.hasPRD ? 'opacity-50' : ''}`}
                    >
                      <Checkbox
                        id={`workflow-${workflow.id}`}
                        checked={selectedWorkflows.has(workflow.id)}
                        onCheckedChange={(checked) => handleToggleWorkflow(workflow.id, !!checked)}
                        disabled={!workflow.hasPRD}
                        data-testid={`checkbox-workflow-${workflow.id}`}
                      />
                      <Label 
                        htmlFor={`workflow-${workflow.id}`} 
                        className="flex-1 text-sm cursor-pointer"
                      >
                        {workflow.name}
                      </Label>
                      {!workflow.hasPRD && (
                        <span className="text-xs text-muted-foreground">No PRD</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <div className="grid gap-2">
                {formatOptions.map(option => (
                  <div key={option.value} className="flex items-start gap-3">
                    <RadioGroupItem 
                      value={option.value} 
                      id={`format-${option.value}`}
                      className="mt-1"
                      data-testid={`radio-format-${option.value}`}
                    />
                    <Label 
                      htmlFor={`format-${option.value}`} 
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <option.icon className="w-4 h-4" />
                        <span className="font-medium">{option.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {option.description}
                      </p>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-export">
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={isExporting || selectedWorkflows.size === 0}
            data-testid="button-export-prd"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
