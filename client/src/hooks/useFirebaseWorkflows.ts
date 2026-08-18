import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { 
  saveWorkflow, 
  loadWorkflow, 
  getUserWorkflows, 
  updateWorkflow, 
  deleteWorkflow,
  SavedWorkflow 
} from '../lib/firebase';

export interface WorkflowTab {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
}

export function useFirebaseWorkflows() {
  const { isAuthenticated, user } = useAuth();
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user's workflows when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserWorkflows();
    } else {
      setSavedWorkflows([]);
    }
  }, [isAuthenticated, user]);

  const loadUserWorkflows = async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      setError(null);
      const workflows = await getUserWorkflows();
      setSavedWorkflows(workflows);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveWorkflowToFirebase = async (workflow: WorkflowTab): Promise<string | null> => {
    if (!isAuthenticated) {
      setError('You must be signed in to save workflows');
      return null;
    }

    try {
      setError(null);
      const workflowId = await saveWorkflow({
        id: workflow.id,
        name: workflow.name,
        nodes: workflow.nodes,
        edges: workflow.edges,
      });
      
      // Refresh the workflows list
      await loadUserWorkflows();
      return workflowId;
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to save workflow:', err);
      return null;
    }
  };

  const updateWorkflowInFirebase = async (workflowId: string, updates: Partial<Pick<SavedWorkflow, 'name' | 'nodes' | 'edges'>>): Promise<boolean> => {
    if (!isAuthenticated) {
      setError('You must be signed in to update workflows');
      return false;
    }

    try {
      setError(null);
      await updateWorkflow(workflowId, updates);
      
      // Refresh the workflows list
      await loadUserWorkflows();
      return true;
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to update workflow:', err);
      return false;
    }
  };

  const deleteWorkflowFromFirebase = async (workflowId: string): Promise<boolean> => {
    if (!isAuthenticated) {
      setError('You must be signed in to delete workflows');
      return false;
    }

    try {
      setError(null);
      await deleteWorkflow(workflowId);
      
      // Refresh the workflows list
      await loadUserWorkflows();
      return true;
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to delete workflow:', err);
      return false;
    }
  };

  const loadWorkflowFromFirebase = async (workflowId: string): Promise<WorkflowTab | null> => {
    if (!isAuthenticated) {
      setError('You must be signed in to load workflows');
      return null;
    }

    try {
      setError(null);
      const workflow = await loadWorkflow(workflowId);
      if (workflow) {
        return {
          id: workflow.id,
          name: workflow.name,
          nodes: workflow.nodes,
          edges: workflow.edges,
        };
      }
      return null;
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load workflow:', err);
      return null;
    }
  };

  return {
    savedWorkflows,
    loading,
    error,
    isAuthenticated,
    saveWorkflow: saveWorkflowToFirebase,
    updateWorkflow: updateWorkflowInFirebase,
    deleteWorkflow: deleteWorkflowFromFirebase,
    loadWorkflow: loadWorkflowFromFirebase,
    refreshWorkflows: loadUserWorkflows,
  };
}