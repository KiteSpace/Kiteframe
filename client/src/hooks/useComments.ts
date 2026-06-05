import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { CommentWithAuthor } from '@shared/schema';

export type { CommentWithAuthor };

export interface CommentThread {
  root: CommentWithAuthor;
  replies: CommentWithAuthor[];
}

interface UseCommentsOptions {
  /** Project UUID — the shared key for comments across editor + viewer. */
  workflowId?: string | null;
  /** Present on the view-only page; lets unauthenticated viewers post. */
  shareId?: string | null;
  enabled?: boolean;
}

interface CreateCommentInput {
  content: string;
  positionX?: number | null;
  positionY?: number | null;
  nodeId?: string | null;
  parentCommentId?: string | null;
}

/**
 * Shared comments data layer used by both the editor and the view-only viewer.
 * Handles fetching, live WebSocket sync (keyed by project UUID), and the
 * create / reply / resolve / delete mutations.
 */
export function useComments({ workflowId, shareId, enabled = true }: UseCommentsOptions) {
  const isEnabled = enabled && !!workflowId;
  const queryKey = ['/api/comments', workflowId] as const;

  const { data: comments = [], isLoading } = useQuery<CommentWithAuthor[]>({
    queryKey: [...queryKey, shareId ?? null],
    enabled: isEnabled,
    queryFn: async () => {
      const url = shareId
        ? `/api/comments/${workflowId}?shareId=${encodeURIComponent(shareId)}`
        : `/api/comments/${workflowId}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to load comments: ${res.status}`);
      return res.json();
    },
  });

  // Build top-level threads (root comment + its replies, oldest first).
  const threads = useMemo<CommentThread[]>(() => {
    const roots = comments.filter((c) => !c.parentCommentId);
    const repliesByParent = new Map<string, CommentWithAuthor[]>();
    for (const c of comments) {
      if (c.parentCommentId) {
        const list = repliesByParent.get(c.parentCommentId) || [];
        list.push(c);
        repliesByParent.set(c.parentCommentId, list);
      }
    }
    const byTime = (a: CommentWithAuthor, b: CommentWithAuthor) =>
      new Date(a.createdAt as any).getTime() - new Date(b.createdAt as any).getTime();
    return roots
      .slice()
      .sort(byTime)
      .map((root) => ({
        root,
        replies: (repliesByParent.get(root.id) || []).slice().sort(byTime),
      }));
  }, [comments]);

  // Live updates via WebSocket, keyed by project UUID.
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    if (!isEnabled || !workflowId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe_comments', projectId: workflowId }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'comment_event' && message.projectId === workflowId) {
          queryClient.invalidateQueries({ queryKey: ['/api/comments', workflowId] });
        }
      } catch {
        // Ignore malformed messages
      }
    };

    return () => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'unsubscribe_comments', projectId: workflowId }));
        }
      } catch {
        // Ignore
      }
      ws.close();
      wsRef.current = null;
    };
  }, [isEnabled, workflowId]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/comments', workflowId] });
  }, [workflowId]);

  const createMutation = useMutation({
    mutationFn: async (input: CreateCommentInput) => {
      const res = await apiRequest('POST', '/api/comments', {
        workflowId,
        content: input.content,
        positionX: input.positionX ?? null,
        positionY: input.positionY ?? null,
        nodeId: input.nodeId ?? null,
        parentCommentId: input.parentCommentId ?? null,
        ...(shareId ? { shareId } : {}),
      });
      return res.json();
    },
    onSuccess: invalidate,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, isResolved }: { id: string; isResolved: boolean }) => {
      const res = await apiRequest('PATCH', `/api/comments/${id}/resolve`, {
        isResolved,
        ...(shareId ? { shareId } : {}),
      });
      return res.json();
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/comments/${id}`, {
        ...(shareId ? { shareId } : {}),
      });
      return res.json();
    },
    onSuccess: invalidate,
  });

  return {
    comments,
    threads,
    isLoading,
    createComment: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    resolveComment: resolveMutation.mutateAsync,
    deleteComment: deleteMutation.mutateAsync,
  };
}
