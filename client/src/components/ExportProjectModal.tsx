import { useState, useMemo, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Download, FileText, Package, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { assembleProjectPRD, getAvailableWorkflowsForExport, type WorkflowCanvasData } from '@/lib/prd/assembleProjectPRD';
import { 
  type ExportOption, 
  type ExportSelection,
  type ExportArtifact,
  INDIVIDUAL_EXPORTS, 
  BUNDLE_EXPORTS,
  getArtifactsForSelection,
  ARTIFACT_FILENAMES,
  ARTIFACT_LABELS,
} from '@/lib/export/exportConfig';
import { exportToMarkdown } from '@/lib/prd/exporters/exportToMarkdown';
import { exportToPdf } from '@/lib/prd/exporters/exportToPdf';
import { exportToPrototypingPrompt } from '@/lib/prd/exporters/exportToPrototypingPrompt';
import { exportToKiteframeJSON } from '@/lib/prd/exporters/exportToKiteframeJSON';
import { exportFigmaMakePrompt } from '@/lib/prd/exporters/exportFigmaMakePrompt';
import { exportJiraCsv } from '@/lib/prd/exporters/exportJiraCsv';
import { exportWorkflowOutline } from '@/lib/prd/exporters/exportWorkflowOutline';
import { exportAiBuildInstructions } from '@/lib/prd/exporters/exportAiBuildInstructions';
import { exportAgentSystemPrompt, exportConstraintsAndNonGoals, exportExpectedOutputs } from '@/lib/prd/exporters/exportAgentPrompt';
import { exportWorkflowDiagram } from '@/lib/prd/exporters/exportWorkflowDiagram';
import type { Node, Edge, CanvasObject } from '@/lib/kiteframe/types';
import JSZip from 'jszip';

interface WorkflowData {
  id: string;
  name: string;
  nodes?: Node[];
  edges?: Edge[];
  canvasObjects?: CanvasObject[];
}

interface ExportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  projectDescription?: string;
  workflows: WorkflowData[];
  shareUuid?: string;
}

interface WorkflowWithPRD {
  id: string;
  name: string;
  hasPRD: boolean;
}

export function ExportProjectModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  projectDescription,
  workflows,
  shareUuid
}: ExportProjectModalProps) {
  const { toast } = useToast();
  const [selectedExports, setSelectedExports] = useState<Set<ExportOption>>(new Set());
  const [selectedWorkflows, setSelectedWorkflows] = useState<Set<string>>(new Set());
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
  const hasPRDs = selectableWorkflows.length > 0;

  useEffect(() => {
    if (isOpen) {
      setSelectedExports(new Set());
      if (selectableWorkflows.length > 0) {
        setSelectedWorkflows(new Set(selectableWorkflows.map(w => w.id)));
      }
    }
  }, [isOpen, selectableWorkflows.length]);

  const handleToggleExport = useCallback((exportId: ExportOption, checked: boolean) => {
    setSelectedExports(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(exportId);
      } else {
        newSet.delete(exportId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAllWorkflows = (checked: boolean) => {
    if (checked) {
      setSelectedWorkflows(new Set(selectableWorkflows.map(w => w.id)));
    } else {
      setSelectedWorkflows(new Set());
    }
  };

  const handleToggleWorkflow = (workflowId: string, checked: boolean) => {
    setSelectedWorkflows(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(workflowId);
      } else {
        newSet.delete(workflowId);
      }
      return newSet;
    });
  };

  const allWorkflowsSelected = selectableWorkflows.length > 0 && 
    selectableWorkflows.every(w => selectedWorkflows.has(w.id));

  const canExport = selectedExports.size > 0;

  const generateArtifactContent = useCallback((artifact: ExportArtifact, assembled: any): string | Blob => {
    switch (artifact) {
      case 'prd_document':
      case 'prd_markdown':
        return exportToMarkdown(assembled);
      case 'prd_pdf':
        return exportToPdf(assembled);
      case 'prototype_prompt':
        return exportToPrototypingPrompt(assembled);
      case 'figma_make_prompt':
        return exportFigmaMakePrompt(assembled);
      case 'jira_csv':
        return exportJiraCsv(assembled);
      case 'kiteframe_project':
        return exportToKiteframeJSON(assembled);
      case 'workflow_markdown_outline':
        return exportWorkflowOutline(assembled);
      case 'ai_build_instructions':
        return exportAiBuildInstructions(assembled);
      case 'agent_system_prompt':
        return exportAgentSystemPrompt(assembled);
      case 'constraints_and_non_goals':
        return exportConstraintsAndNonGoals(assembled);
      case 'expected_outputs':
        return exportExpectedOutputs(assembled);
      case 'workflow_diagram':
        return exportWorkflowDiagram(assembled);
      default:
        return '';
    }
  }, []);

  const handleExport = async () => {
    if (selectedExports.size === 0) {
      toast({
        title: 'No exports selected',
        description: 'Please select at least one item to export.',
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
        const hasNodes = w.nodes && w.nodes.length > 0;
        const hasEdges = w.edges && w.edges.length > 0;
        if (hasNodes || hasEdges) {
          workflowCanvasData[w.id] = {
            nodes: w.nodes || [],
            edges: w.edges || [],
            canvasObjects: w.canvasObjects
          };
        }
      });

      const workflowShareUrls: Record<string, string> = {};
      if (shareUuid) {
        const baseShareUrl = `${window.location.origin}/view/${shareUuid}`;
        Array.from(selectedWorkflows).forEach(wfId => {
          workflowShareUrls[wfId] = `${baseShareUrl}?workflow=${wfId}`;
        });
      }

      const assembled = assembleProjectPRD({
        projectId,
        projectName,
        projectDescription,
        selectedWorkflowIds: Array.from(selectedWorkflows),
        workflowNames,
        workflowCanvasData,
        workflowShareUrls
      });

      const selection = Array.from(selectedExports) as ExportSelection;
      const artifacts = getArtifactsForSelection(selection);

      if (artifacts.length === 1) {
        const artifact = artifacts[0];
        const content = generateArtifactContent(artifact, assembled);
        const filename = `${sanitizeFilename(projectName)}-${ARTIFACT_FILENAMES[artifact]}`;
        downloadFile(content, filename, getMimeType(artifact));
        
        toast({ 
          title: 'Export complete', 
          description: `Downloaded ${ARTIFACT_FILENAMES[artifact]}` 
        });
      } else {
        const zip = new JSZip();
        
        const filesInZip: Array<{ path: string; description: string }> = [];
        
        for (const artifact of artifacts) {
          const content = generateArtifactContent(artifact, assembled);
          const filename = ARTIFACT_FILENAMES[artifact];
          zip.file(filename, content);
          filesInZip.push({
            path: filename,
            description: ARTIFACT_LABELS[artifact]
          });
        }

        const bundleType = determineBundleType(selection);
        const hasBundle = bundleType !== null;
        
        if (hasBundle) {
          const manifest = generateBundleManifest({
            bundleType,
            projectId,
            projectName,
            files: filesInZip,
          });
          zip.file('bundle-manifest.json', JSON.stringify(manifest, null, 2));
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitizeFilename(projectName)}-export.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const fileCount = hasBundle ? artifacts.length + 1 : artifacts.length;
        const manifestNote = hasBundle ? ' (includes manifest)' : '';
        toast({ 
          title: 'Export complete', 
          description: `Downloaded ${fileCount} files as ZIP${manifestNote}` 
        });
      }

      onClose();
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'An error occurred during export.',
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const prdRequiredOptions = ['prd_document', 'prd_markdown', 'bundle_project'];
  const optionRequiresPRD = (id: ExportOption) => prdRequiredOptions.includes(id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Project
          </DialogTitle>
          <DialogDescription>
            Select what you want to export
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Individual Files</Label>
            </div>
            
            <div className="border rounded-lg divide-y">
              {INDIVIDUAL_EXPORTS.map(option => {
                const needsPRD = optionRequiresPRD(option.id);
                const isDisabled = needsPRD && !hasPRDs;
                
                return (
                  <div 
                    key={option.id} 
                    className={`flex items-start gap-3 px-3 py-3 ${isDisabled ? 'opacity-50' : ''}`}
                  >
                    <Checkbox
                      id={`export-${option.id}`}
                      checked={selectedExports.has(option.id)}
                      onCheckedChange={(checked) => handleToggleExport(option.id, !!checked)}
                      disabled={isDisabled}
                      className="mt-0.5"
                      data-testid={`checkbox-export-${option.id}`}
                    />
                    <Label 
                      htmlFor={`export-${option.id}`} 
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium text-sm">{option.label}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {option.description}
                      </p>
                      {isDisabled && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Requires generated PRD
                        </p>
                      )}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Bundles</Label>
            </div>
            
            <div className="border rounded-lg divide-y">
              {BUNDLE_EXPORTS.map(option => {
                const needsPRD = optionRequiresPRD(option.id);
                const isDisabled = needsPRD && !hasPRDs;
                
                return (
                  <div 
                    key={option.id} 
                    className={`flex items-start gap-3 px-3 py-3 ${isDisabled ? 'opacity-50' : ''}`}
                  >
                    <Checkbox
                      id={`export-${option.id}`}
                      checked={selectedExports.has(option.id)}
                      onCheckedChange={(checked) => handleToggleExport(option.id, !!checked)}
                      disabled={isDisabled}
                      className="mt-0.5"
                      data-testid={`checkbox-export-${option.id}`}
                    />
                    <Label 
                      htmlFor={`export-${option.id}`} 
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium text-sm">{option.label}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {option.description}
                      </p>
                      {isDisabled && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Requires generated PRD
                        </p>
                      )}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          {selectableWorkflows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Workflows to include</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all-workflows"
                    checked={allWorkflowsSelected}
                    onCheckedChange={handleSelectAllWorkflows}
                    data-testid="checkbox-select-all-workflows"
                  />
                  <Label htmlFor="select-all-workflows" className="text-xs text-muted-foreground cursor-pointer">
                    Select all
                  </Label>
                </div>
              </div>

              <div className="border rounded-lg max-h-32 overflow-y-auto">
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
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!canExport && (
            <p className="text-xs text-muted-foreground mr-auto">
              Select at least one item to export.
            </p>
          )}
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-export">
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={isExporting || !canExport}
            data-testid="button-export-project"
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

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getMimeType(artifact: ExportArtifact): string {
  if (artifact === 'prd_pdf') return 'application/pdf';
  if (artifact === 'jira_csv') return 'text/csv;charset=utf-8';
  if (artifact === 'kiteframe_project') return 'application/json;charset=utf-8';
  if (artifact.endsWith('_prompt')) return 'text/plain;charset=utf-8';
  return 'text/markdown;charset=utf-8';
}

type BundleType = 'design' | 'builder' | 'project' | 'ai_agent' | 'mixed';

interface BundleManifest {
  bundleType: BundleType;
  createdAt: string;
  projectId: string | null;
  projectName: string | null;
  intendedImports: string[];
  files: Array<{ path: string; description: string }>;
}

function determineBundleType(selection: ExportSelection): BundleType | null {
  const bundleTypes: BundleType[] = [];
  if (selection.includes('bundle_design')) bundleTypes.push('design');
  if (selection.includes('bundle_builder')) bundleTypes.push('builder');
  if (selection.includes('bundle_project')) bundleTypes.push('project');
  if (selection.includes('bundle_ai_agent')) bundleTypes.push('ai_agent');
  
  if (bundleTypes.length === 0) return null;
  if (bundleTypes.length === 1) return bundleTypes[0];
  return 'mixed';
}

const INTENDED_IMPORTS: Record<BundleType, string[]> = {
  design: ['AI prototyping tools', 'Design review'],
  builder: ['AI coding assistants', 'Engineering handoff'],
  project: ['Jira', 'PRD review', 'Kiteframe re-import'],
  ai_agent: ['AI agent setup', 'Context injection'],
  mixed: ['Various tools and workflows'],
};

function generateBundleManifest({
  bundleType,
  projectId,
  projectName,
  files,
}: {
  bundleType: BundleType;
  projectId: string;
  projectName: string;
  files: Array<{ path: string; description: string }>;
}): BundleManifest {
  return {
    bundleType,
    createdAt: new Date().toISOString(),
    projectId: projectId || null,
    projectName: projectName || null,
    intendedImports: INTENDED_IMPORTS[bundleType],
    files,
  };
}
