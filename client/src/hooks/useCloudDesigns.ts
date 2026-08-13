import { useQuery } from '@tanstack/react-query';
import { useSubscription } from './useSubscription';

/**
 * An Interface as the project grid sees it. Mirrors the trimmed payload of
 * `GET /api/designs`: no canvas state, no owner id.
 */
export interface CloudDesignSummary {
  id: string;
  title: string | null;
  isShareEnabled: boolean;
  /** Null unless sharing is currently on — a revoked uuid is never sent. */
  shareUuid: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * The signed-in user's Interfaces, so the Home grid can list every one of them
 * rather than only the ones that happen to be open as a tab.
 */
export function useCloudDesigns() {
  const { isServerAuthenticated } = useSubscription();

  const { data, isLoading, refetch } = useQuery<{ designs: CloudDesignSummary[] }>({
    queryKey: ['/api/designs'],
    enabled: isServerAuthenticated,
    staleTime: 30000,
    retry: 2,
  });

  return {
    designs: data?.designs ?? [],
    isLoading,
    refetch,
  };
}
