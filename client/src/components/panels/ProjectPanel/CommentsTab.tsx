import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Check } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useComments, type CommentThread, type CommentWithAuthor } from '@/hooks/useComments';

interface CommentsTabProps {
  /** Project UUID — shared comment key. */
  workflowId?: string | null;
  /** Present in the view-only viewer. */
  shareId?: string | null;
}

function getInitials(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function timeAgo(date: unknown): string {
  try {
    return formatDistanceToNow(new Date(date as any), { addSuffix: true });
  } catch {
    return '';
  }
}

function focusComment(comment: CommentWithAuthor) {
  window.dispatchEvent(
    new CustomEvent('kiteframe:focusComment', {
      detail: { id: comment.id, x: comment.positionX, y: comment.positionY },
    }),
  );
}

export function CommentsTab({ workflowId, shareId }: CommentsTabProps) {
  const { threads, isLoading } = useComments({ workflowId, shareId });
  const [showResolved, setShowResolved] = useState(false);

  const visible = threads.filter((t) => showResolved || !t.root.isResolved);
  const resolvedCount = threads.filter((t) => t.root.isResolved).length;

  if (!workflowId) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Save or share this project to start adding comments.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="comments-tab">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium">
          {visible.length} {visible.length === 1 ? 'comment' : 'comments'}
        </span>
        {resolvedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => setShowResolved((s) => !s)}
            data-testid="comments-toggle-resolved"
          >
            {showResolved ? 'Hide resolved' : `Show resolved (${resolvedCount})`}
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading comments…</div>
        ) : visible.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <MessageCircle size={28} className="opacity-40" />
            <span>No comments yet. Use the Comment button on the canvas to add one.</span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((thread: CommentThread) => {
              const { root, replies } = thread;
              return (
                <button
                  key={root.id}
                  type="button"
                  className="w-full text-left px-3 py-3 hover:bg-accent/50 transition-colors"
                  onClick={() => focusComment(root)}
                  data-testid={`comment-list-item-${root.id}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-6 w-6">
                      {root.authorImageUrl && <AvatarImage src={root.authorImageUrl} alt={root.authorName} />}
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {getInitials(root.authorName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium truncate">{root.authorName}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-auto">
                      {timeAgo(root.createdAt)}
                    </span>
                    {root.isResolved && <Check size={13} className="text-green-600 flex-shrink-0" />}
                  </div>
                  <p className="text-sm text-foreground/90 line-clamp-3 pl-8 break-words">{root.content}</p>
                  {replies.length > 0 && (
                    <span className="text-[11px] text-muted-foreground pl-8 mt-1 inline-block">
                      {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default CommentsTab;
