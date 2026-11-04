import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { cancelOperationsForTarget } from '@/ai/backgroundOperations';
import { useSubscription } from './useSubscription';
import type { SavedProject } from '@shared/schema';

interface WorkflowData {
  nodes: any[];
  edges: any[];
  canvasObjects?: any[];
  viewport?: { x: number; y: number; zoom: number };
  flowSettings?: Record<string, any>;
  sketchStrokes?: any[];
}

interface CreateProjectParams {
  name: string;
  description?: string;
  workflowData: WorkflowData;
  thumbnail?: string;
  folderId?: string;
  tags?: string[];
  isPublic?: boolean;
}

interface UpdateProjectParams {
  id: string;
  name?: string;
  description?: string;
  workflowData?: WorkflowData;
  thumbnail?: string;
  folderId?: string;
  tags?: string[];
  isPublic?: boolean;
}

export function useCloudProjects() {
  const { isPro, isAdmin, isServerAuthenticated } = useSubscription();
  const [isCloudConnected, setIsCloudConnected] = useState(true);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const hasCloudAccess = isServerAuthenticated;

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<{ projects: SavedProject[] }>({
    queryKey: ['/api/projects'],
    enabled: hasCloudAccess,
    retry: 2,
    staleTime: 30000,
  });

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        setIsCloudConnected(false);
        setLastSyncError('Network connection failed');
      } else if (!errorMessage.includes('403')) {
        setIsCloudConnected(false);
        setLastSyncError(errorMessage);
      }
    } else if (data) {
      setIsCloudConnected(true);
      setLastSyncError(null);
    }
  }, [error, data]);

  useEffect(() => {
    if (!isCloudConnected) {
      retryTimeoutRef.current = setTimeout(() => {
        refetch();
      }, 30000);
    }
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [isCloudConnected, refetch]);

  const createProjectMutation = useMutation({
    mutationFn: async (params: CreateProjectParams) => {
      const res = await apiRequest('POST', '/api/projects', params);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setIsCloudConnected(true);
      setLastSyncError(null);
    },
    onError: (error: Error) => {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        setIsCloudConnected(false);
        setLastSyncError('Failed to save project - check your network');
      }
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (params: UpdateProjectParams) => {
      const { id, ...data } = params;
      const res = await apiRequest('PUT', `/api/projects/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setIsCloudConnected(true);
      setLastSyncError(null);
    },
    onError: (error: Error) => {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        setIsCloudConnected(false);
        setLastSyncError('Failed to update project - check your network');
      } else if (error.message.startsWith('409')) {
        setLastSyncError('This project was changed somewhere else. Reload to get the latest version.');
      } else {
        setLastSyncError(`Failed to save project: ${error.message}`);
      }
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const data: any = queryClient.getQueryData(['/api/projects']);
      const projects = Array.isArray(data) ? data : data?.projects;
      const original = projects?.find((project: any) => project.id === projectId || project.projectUuid === projectId);
      [projectId, original?.projectUuid].filter(Boolean).forEach(cancelOperationsForTarget);
      await apiRequest('DELETE', `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: (error: Error) => {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        setIsCloudConnected(false);
        setLastSyncError('Failed to delete project - check your network');
      }
    },
  });

  const createProject = useCallback(async (params: CreateProjectParams): Promise<SavedProject | null> => {
    if (!hasCloudAccess) return null;
    try {
      const result = await createProjectMutation.mutateAsync(params);
      return result.project;
    } catch (e) {
      console.error('Failed to create project:', e);
      return null;
    }
  }, [hasCloudAccess, createProjectMutation]);

  // Project revision this tab last saw per project, sent back so the server rejects saves over newer work.
  // Taken from the first project list we load, then only from our own saves.
  const knownRev = useRef(new Map<string, number>());
  useEffect(() => {
    for (const project of data?.projects ?? []) {
      if (!knownRev.current.has(project.id) && typeof project.rev === 'number') {
        knownRev.current.set(project.id, project.rev);
      }
    }
  }, [data?.projects]);
  const updateProject = useCallback(async (params: UpdateProjectParams): Promise<SavedProject | null> => {
    if (!hasCloudAccess) return null;
    try {
      const baseRev = knownRev.current.get(String(params.id));
      const result = await updateProjectMutation.mutateAsync(
        baseRev !== undefined ? ({ ...params, baseRev } as UpdateProjectParams) : params,
      );
      if (typeof result?.project?.rev === 'number') {
        knownRev.current.set(String(params.id), result.project.rev);
      }
      return result.project;
    } catch (e) {
      console.error('Failed to update project:', e);
      return null;
    }
  }, [hasCloudAccess, updateProjectMutation]);

  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    if (!hasCloudAccess) return false;
    try {
      await deleteProjectMutation.mutateAsync(projectId);
      return true;
    } catch (e) {
      console.error('Failed to delete project:', e);
      return false;
    }
  }, [hasCloudAccess, deleteProjectMutation]);

  const retryConnection = useCallback(() => {
    refetch();
  }, [refetch]);

  const projects = data?.projects || [];

  return {
    projects,
    isLoading,
    isFetching,
    error,
    hasCloudAccess,
    isCloudConnected,
    lastSyncError,
    createProject,
    updateProject,
    deleteProject,
    refetch,
    retryConnection,
    isSaving: createProjectMutation.isPending || updateProjectMutation.isPending,
    isDeleting: deleteProjectMutation.isPending,
  };
}
