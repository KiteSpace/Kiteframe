import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAi } from '../ai/AiProvider';
import type { Node, Edge } from '../lib/kiteframe/types';
import { Upload, FileText, Bot, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ProjectImportData {
  projectName?: string;
  projectId?: string;
  projectPRD?: any;
  workflows?: any[];
}

interface WorkflowImportModalProps {
  onClose: () => void;
  onImport: (importData: { 
    nodes: Node[], 
    edges: Edge[], 
    canvasObjects: any[], 
    viewport?: { x: number; y: number; zoom: number }, 
    workflowMetadata?: { 
      name: string, 
      description: string, 
      links: any[], 
      categories: any[] 
    },
    projectData?: ProjectImportData
  }) => void;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  correctedData?: any;
  cleanedData?: any; // Data with orphan edges automatically removed
}

export function WorkflowImportModal({ onClose, onImport }: WorkflowImportModalProps) {
  const [importData, setImportData] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showCorrectionPreview, setShowCorrectionPreview] = useState(false);
  const [allowClose, setAllowClose] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const aiContext = useAi();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a JSON file (.json)",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      console.log('File loaded, setting import data and validating...');
      setImportData(content);
      validateWorkflowData(content);
      console.log('File upload complete, modal should remain open');
    };
    reader.readAsText(file);
  };

  const validateWorkflowData = async (jsonData: string) => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch('/api/workflow/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: jsonData })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('Validation API response:', result);
        
        // If orphan edges were auto-cleaned, update import data with cleaned version
        if (result.cleanedData) {
          // Use cleaned data (orphan edges removed)
          const cleanedJson = JSON.stringify(result.cleanedData, null, 2);
          setImportData(cleanedJson);
          setValidationResult({
            ...result,
            isValid: true, // Mark as valid since we cleaned the orphan edges
          });
          toast({
            title: "Orphan Edges Removed",
            description: `Automatically removed edges pointing to non-existent nodes. Data is ready to import.`,
            variant: "default"
          });
        } else {
          setValidationResult(result);
          
          if (!result.isValid && result.errors.length > 0) {
            toast({
              title: "Validation Issues Found",
              description: `Found ${result.errors.length} errors and ${result.warnings.length} warnings. AI correction available.`,
              variant: "destructive"
            });
          } else if (result.warnings.length > 0) {
            toast({
              title: "Validation Warnings",
              description: `Found ${result.warnings.length} warnings. Data is importable.`,
              variant: "default"
            });
          } else {
            toast({
              title: "Validation Successful",
              description: "Workflow data is valid and ready to import.",
              variant: "default"
            });
          }
        }
      } else {
        throw new Error(result.error || 'Validation failed');
      }
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult({
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed'],
        warnings: []
      });
      toast({
        title: "Validation Failed",
        description: "Could not validate workflow data. Please check the format.",
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleAiCorrection = async () => {
    if (!validationResult || validationResult.isValid) return;

    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/workflow/ai-correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: importData,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setValidationResult({
          isValid: true,
          errors: [],
          warnings: result.warnings || [],
          correctedData: result.correctedData
        });
        setImportData(JSON.stringify(result.correctedData, null, 2));
        setShowCorrectionPreview(true);
        
        toast({
          title: "AI Correction Complete",
          description: "Workflow data has been automatically corrected and is now valid.",
          variant: "default"
        });
      } else {
        throw new Error(result.error || 'AI correction failed');
      }
    } catch (error) {
      console.error('AI correction error:', error);
      toast({
        title: "AI Correction Failed",
        description: error instanceof Error ? error.message : "Could not automatically correct workflow data.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = () => {
    console.log('handleImport called, validationResult:', validationResult);
    
    if (!validationResult?.isValid) {
      console.log('Import blocked: validation not valid');
      toast({
        title: "Cannot Import",
        description: "Please fix validation errors before importing.",
        variant: "destructive"
      });
      return;
    }

    console.log('Starting import process...');
    try {
      const workflowData = JSON.parse(importData);
      console.log('Importing workflow data:', workflowData);
      
      // Extract nodes, edges, canvasObjects, and viewport using the same logic as server validation
      const extractWorkflowData = (data: any) => {
        // Check if this is an AssembledProjectPRD format (Kiteframe PRD JSON export)
        if (data.version && data.workflows && Array.isArray(data.workflows)) {
          console.log('Detected AssembledProjectPRD format with', data.workflows.length, 'workflows');
          
          // Find the first workflow with canvas data to use as the primary import
          const primaryWorkflow = data.workflows.find((w: any) => 
            w.canvas && (Array.isArray(w.canvas.nodes) || Array.isArray(w.canvas.edges))
          );
          
          if (primaryWorkflow?.canvas) {
            const nodes = primaryWorkflow.canvas.nodes || [];
            const edges = primaryWorkflow.canvas.edges || [];
            const canvasObjects = primaryWorkflow.canvas.canvasObjects || [];
            const viewport = primaryWorkflow.canvas.viewport || { x: 0, y: 0, zoom: 1 };
            
            console.log('Using primary workflow:', primaryWorkflow.workflowName, 'with', nodes.length, 'nodes');
            
            return {
              nodes,
              edges,
              canvasObjects,
              viewport,
              format: 'assembled-project-prd',
              projectData: {
                projectName: data.project?.name,
                projectId: data.project?.id,
                projectPRD: data.projectPRD,
                workflows: data.workflows
              }
            };
          }
        }
        
        const paths = [
          // Comprehensive format variations
          { 
            nodes: data.canvas?.nodes, 
            edges: data.canvas?.edges, 
            canvasObjects: data.canvas?.canvasObjects,
            viewport: data.canvas?.viewport, 
            type: 'comprehensive' 
          },
          { 
            nodes: data.workflow?.canvas?.nodes, 
            edges: data.workflow?.canvas?.edges, 
            canvasObjects: data.workflow?.canvas?.canvasObjects,
            viewport: data.workflow?.canvas?.viewport, 
            type: 'workflow.canvas' 
          },
          { 
            nodes: data.workflow?.nodes, 
            edges: data.workflow?.edges, 
            canvasObjects: data.workflow?.canvasObjects,
            viewport: data.workflow?.viewport, 
            type: 'workflow' 
          },
          { 
            nodes: data.flow?.nodes, 
            edges: data.flow?.edges, 
            canvasObjects: data.flow?.canvasObjects,
            viewport: data.flow?.viewport, 
            type: 'flow' 
          },
          // Legacy format
          { 
            nodes: data.nodes, 
            edges: data.edges, 
            canvasObjects: data.canvasObjects,
            viewport: data.viewport, 
            type: 'legacy' 
          }
        ];
        
        for (const path of paths) {
          if (Array.isArray(path.nodes) || Array.isArray(path.edges) || Array.isArray(path.canvasObjects)) {
            return {
              nodes: path.nodes || [],
              edges: path.edges || [],
              canvasObjects: path.canvasObjects || [],
              viewport: path.viewport || { x: 0, y: 0, zoom: 1 },
              format: path.type
            };
          }
        }
        
        // Fallback to empty arrays
        return {
          nodes: [],
          edges: [],
          canvasObjects: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          format: 'unknown'
        };
      };

      const extracted = extractWorkflowData(workflowData);
      const nodes = extracted.nodes;
      const edges = extracted.edges;
      const canvasObjects = extracted.canvasObjects;
      const viewport = extracted.viewport;
      const projectData = extracted.projectData;
      
      console.log('Extracted data:', { nodes, edges, canvasObjects, viewport, format: extracted.format });
      console.log('Calling onImport with:', nodes.length, 'nodes,', edges.length, 'edges, and', canvasObjects.length, 'canvas objects');
      if (projectData) {
        console.log('Project data included:', projectData.projectName, 'with', projectData.workflows?.length, 'workflows');
      }

      // Extract full workflow metadata from multiple possible formats
      const workflowMetadata = {
        name: projectData?.projectName || workflowData.metadata?.name || workflowData.workflowName || workflowData.workflow?.name || workflowData.project?.name || '',
        description: workflowData.metadata?.description || workflowData.workflow?.description || workflowData.project?.description || '',
        links: workflowData.metadata?.links || workflowData.workflow?.links || [],
        categories: workflowData.metadata?.categories || workflowData.workflow?.categories || []
      };
      
      // Allow close after successful import
      setAllowClose(true);
      onImport({ nodes, edges, canvasObjects, viewport, workflowMetadata, projectData });
      
      const toastDescription = projectData 
        ? `Imported project "${projectData.projectName}" with ${nodes.length} nodes and ${edges.length} connections.`
        : `Imported ${nodes.length} nodes, ${edges.length} connections, and ${canvasObjects.length} canvas objects.`;
      
      toast({
        title: "Import Successful",
        description: toastDescription,
        variant: "default"
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: "Could not parse workflow data.",
        variant: "destructive"
      });
    }
  };

  const canCorrect = validationResult && !validationResult.isValid && validationResult.errors.length > 0;
  const canImport = validationResult?.isValid;
  
  console.log('Component render - validationResult:', validationResult);
  console.log('Component render - canImport:', canImport);
  console.log('Component render - canCorrect:', canCorrect);

  return (
    <Dialog open={true} onOpenChange={(open) => {
      console.log('Dialog onOpenChange called with:', open, 'allowClose:', allowClose);
      if (!open) {
        console.log('Dialog close triggered, calling onClose');
        onClose();
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="modal-workflow-import" aria-describedby="import-workflow-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="text-primary" size={20} />
            Import Workflow
          </DialogTitle>
        </DialogHeader>
        <div id="import-workflow-description" className="sr-only">
          Import workflow data from JSON files with validation and AI-powered error correction
        </div>
        
        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Upload button clicked');
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-2"
                data-testid="button-upload-file"
              >
                <FileText size={16} />
                Choose JSON File
              </Button>
              <span className="text-sm text-muted-foreground">
                or paste JSON data below
              </span>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('File input onChange triggered');
                handleFileUpload(e);
              }}
              className="hidden"
              data-testid="input-file-upload"
            />
          </div>

          {/* JSON Data Input */}
          <div className="space-y-2">
            <Label htmlFor="import-data">Workflow JSON Data</Label>
            <Textarea
              id="import-data"
              value={importData}
              onChange={(e) => {
                setImportData(e.target.value);
                setValidationResult(null);
              }}
              placeholder="Paste your workflow JSON data here..."
              className="min-h-[300px] font-mono text-sm"
              data-testid="textarea-import-data"
            />
          </div>

          {/* Validation Section */}
          {importData && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => validateWorkflowData(importData)}
                  disabled={isValidating}
                  variant="outline"
                  className="flex items-center gap-2"
                  data-testid="button-validate"
                >
                  {isValidating ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  {isValidating ? 'Validating...' : 'Validate Data'}
                </Button>

                {canCorrect && (
                  <div className="flex flex-col gap-1">
                    <Button
                      onClick={handleAiCorrection}
                      disabled={isProcessing}
                      className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                      data-testid="button-ai-correct"
                    >
                      {isProcessing ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Bot size={16} />
                      )}
                      {isProcessing ? 'Correcting...' : 'AI Auto-Fix'}
                    </Button>
                    <span className="text-xs text-muted-foreground">Uses AI tokens • Need more? Contact info@kiteframe.space</span>
                  </div>
                )}
              </div>

              {/* Validation Results */}
              {validationResult && (
                <div className="space-y-3">
                  {validationResult.isValid ? (
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                      <CheckCircle2 className="text-green-600" size={16} />
                      <span className="text-green-800 dark:text-green-200 text-sm font-medium">
                        Validation Successful - Ready to Import
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                      <AlertTriangle className="text-red-600" size={16} />
                      <span className="text-red-800 dark:text-red-200 text-sm font-medium">
                        Validation Failed - {validationResult.errors.length} Errors Found
                      </span>
                    </div>
                  )}

                  {validationResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-red-800 dark:text-red-200">Errors:</h4>
                      <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                        {validationResult.errors.map((error, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-red-500 mt-0.5">•</span>
                            <span>{error}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResult.warnings.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Warnings:</h4>
                      <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                        {validationResult.warnings.map((warning, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-yellow-500 mt-0.5">•</span>
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {showCorrectionPreview && validationResult.correctedData && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">AI Corrections Applied:</h4>
                      <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border">
                        The AI has automatically corrected structural issues and validated the workflow data.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                console.log('Cancel button clicked, allowing close');
                setAllowClose(true);
                onClose();
              }}
              className="flex-1"
              data-testid="button-cancel-import"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                console.log('Import button clicked, canImport:', canImport);
                console.log('validationResult:', validationResult);
                console.log('importData length:', importData.length);
                handleImport();
              }}
              disabled={!canImport}
              className={`flex-1 ${!canImport ? 'opacity-50 cursor-not-allowed' : ''}`}
              data-testid="button-import-workflow"
            >
              Import Workflow {!canImport ? '(Disabled)' : '(Enabled)'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}