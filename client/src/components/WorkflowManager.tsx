import { useState } from 'react';
import { useFirebaseWorkflows } from '../hooks/useFirebaseWorkflows';
import { Save, FolderOpen, Trash2, Cloud, HardDrive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WorkflowTab {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
}

interface WorkflowManagerProps {
  currentWorkflow: WorkflowTab;
  onLoadWorkflow: (workflow: WorkflowTab) => void;
  onSaveSuccess?: () => void;
}

export function WorkflowManager({ currentWorkflow, onLoadWorkflow, onSaveSuccess }: WorkflowManagerProps) {
  const { savedWorkflows, loading, error, isAuthenticated, saveWorkflow, deleteWorkflow, loadWorkflow } = useFirebaseWorkflows();
  const { toast } = useToast();
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSaveWorkflow = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save workflows to the cloud.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const workflowId = await saveWorkflow(currentWorkflow);
      if (workflowId) {
        toast({
          title: "Workflow Saved",
          description: `"${currentWorkflow.name}" has been saved to the cloud.`,
        });
        onSaveSuccess?.();
      }
    } catch (err) {
      toast({
        title: "Save Failed",
        description: error || "Failed to save workflow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLoadWorkflow = async (workflowId: string) => {
    try {
      const workflow = await loadWorkflow(workflowId);
      if (workflow) {
        onLoadWorkflow(workflow);
        setShowLoadModal(false);
        toast({
          title: "Workflow Loaded",
          description: `"${workflow.name}" has been loaded from the cloud.`,
        });
      }
    } catch (err) {
      toast({
        title: "Load Failed",
        description: error || "Failed to load workflow. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteWorkflow = async (workflowId: string, workflowName: string) => {
    if (confirm(`Are you sure you want to delete "${workflowName}"? This action cannot be undone.`)) {
      try {
        await deleteWorkflow(workflowId);
        toast({
          title: "Workflow Deleted",
          description: `"${workflowName}" has been deleted.`,
        });
      } catch (err) {
        toast({
          title: "Delete Failed",
          description: error || "Failed to delete workflow. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center gap-3 p-4 text-center">
        <HardDrive className="w-8 h-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Local Storage Only</p>
          <p className="text-xs text-muted-foreground">Sign in to save workflows to the cloud</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Save Current Workflow */}
      <button
        onClick={handleSaveWorkflow}
        disabled={saving}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm font-medium"
        data-testid="button-save-workflow"
      >
        {saving ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
            Saving...
          </>
        ) : (
          <>
            <Save size={16} />
            Save to Cloud
          </>
        )}
      </button>

      {/* Load Workflows */}
      <button
        onClick={() => setShowLoadModal(true)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-muted hover:bg-muted/80 transition-colors text-sm font-medium"
        data-testid="button-load-workflows"
      >
        <FolderOpen size={16} />
        Load from Cloud
      </button>

      {/* Load Workflows Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Load Workflow</h3>
              <button
                onClick={() => setShowLoadModal(false)}
                className="p-1 rounded-md hover:bg-accent transition-colors"
              >
                ×
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              </div>
            ) : savedWorkflows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Cloud className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No saved workflows found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedWorkflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{workflow.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {workflow.nodes.length} nodes • {new Date(workflow.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleLoadWorkflow(workflow.id)}
                        className="p-1 rounded-md hover:bg-accent transition-colors text-xs"
                        title="Load workflow"
                      >
                        <FolderOpen size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteWorkflow(workflow.id, workflow.name)}
                        className="p-1 rounded-md hover:bg-destructive hover:text-destructive-foreground transition-colors text-xs"
                        title="Delete workflow"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-md p-2">
          {error}
        </div>
      )}
    </div>
  );
}