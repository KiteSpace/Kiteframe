import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useSubscription } from './useSubscription';
import type { SavedProject } from '@shared/schema';

interface WorkflowData {
  nodes: any[];
  edges: any[];
  canvasObjects?: any[];
  viewport?: { x: number; y: number; zoom: number };
  flowSettings?: Record<string, any>;
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
  const { isPro, isAdmin, hasActiveSubscription } = useSubscription();
  const [isCloudConnected, setIsCloudConnected] = useState(true);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const hasCloudAccess = isPro || isAdmin;

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<{ projects: SavedProject[] }>({
    queryKey: ['/api/projects'],
    enabled: hasCloudAccess && hasActiveSubscription,
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
      }
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
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

  const updateProject = useCallback(async (params: UpdateProjectParams): Promise<SavedProject | null> => {
    if (!hasCloudAccess) return null;
    try {
      const result = await updateProjectMutation.mutateAsync(params);
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
