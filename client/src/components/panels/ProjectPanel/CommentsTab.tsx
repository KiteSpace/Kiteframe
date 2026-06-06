import { useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageCircle,
  Check,
  Trash2,
  Send,
  Reply,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useComments, type CommentThread, type CommentWithAuthor } from '@/hooks/useComments';
import { useAuth } from '@/hooks/useAuth';
import { useReplitAuth } from '@/hooks/useReplitAuth';

const REPLIES_PREVIEW_COUNT = 2;

interface CommentsTabProps {
  workflowId?: string | null;
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

interface CommentRowProps {
  comment: CommentWithAuthor;
  onDelete: (id: string) => void;
  indented?: boolean;
}

function CommentRow({ comment, onDelete, indented = false }: CommentRowProps) {
  return (
    <div className={indented ? 'pl-5 border-l-2 border-border ml-3' : ''}>
      <div className="flex items-start gap-2">
        <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
          {comment.authorImageUrl && (
            <AvatarImage src={comment.authorImageUrl} alt={comment.authorName} />
          )}
          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
            {getInitials(comment.authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium leading-tight truncate max-w-[120px]">
              {comment.authorName}
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              {timeAgo(comment.createdAt)}
            </span>
            <div className="ml-auto flex items-center gap-0.5 flex-shrink-0">
              {comment.canDelete && (
                <button
                  type="button"
                  className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                  onClick={() => onDelete(comment.id)}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-foreground/90 mt-0.5 break-words whitespace-pre-wrap leading-snug">
            {comment.content}
          </p>
        </div>
      </div>
    </div>
  );
}

interface ThreadCardProps {
  thread: CommentThread;
  shareId?: string | null;
  onResolve: (id: string, isResolved: boolean) => void;
  onDelete: (id: string) => void;
  onCreate: (input: { content: string; parentCommentId: string }) => Promise<void>;
}

function ThreadCard({
  thread,
  onResolve,
  onDelete,
  onCreate,
}: ThreadCardProps) {
  const { root, replies } = thread;
  const [expanded, setExpanded] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hiddenCount = replies.length - REPLIES_PREVIEW_COUNT;
  const visibleReplies = expanded ? replies : replies.slice(0, REPLIES_PREVIEW_COUNT);

  const handleSubmitReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({ content: replyText.trim(), parentCommentId: root.id });
      setReplyText('');
      setReplyOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-3 py-3 space-y-2.5">
      {/* Root comment */}
      <div>
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="flex-1 min-w-0 text-left"
            onClick={() => focusComment(root)}
            title="Jump to comment on canvas"
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <Avatar className="h-6 w-6 flex-shrink-0">
                {root.authorImageUrl && (
                  <AvatarImage src={root.authorImageUrl} alt={root.authorName} />
                )}
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {getInitials(root.authorName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium truncate max-w-[110px]">{root.authorName}</span>
              <span className="text-[10px] text-muted-foreground">{timeAgo(root.createdAt)}</span>
              {root.isResolved && (
                <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5">
                  <Check size={10} /> Resolved
                </span>
              )}
            </div>
            <p className="text-sm text-foreground/90 mt-0.5 pl-7 break-words whitespace-pre-wrap leading-snug">
              {root.content}
            </p>
          </button>

          {/* Root actions */}
          <div className="flex items-center gap-0.5 flex-shrink-0 pt-0.5">
            <button
              type="button"
              className={`p-0.5 rounded transition-colors ${
                root.isResolved
                  ? 'text-green-600 hover:bg-green-100/20'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              title={root.isResolved ? 'Reopen' : 'Resolve'}
              onClick={() => onResolve(root.id, !root.isResolved)}
            >
              <Check size={13} />
            </button>
            {root.canDelete && (
              <button
                type="button"
                className="p-0.5 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Delete thread"
                onClick={() => onDelete(root.id)}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {visibleReplies.length > 0 && (
        <div className="space-y-2.5 ml-1">
          {visibleReplies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              onDelete={onDelete}
              indented
            />
          ))}
        </div>
      )}

      {/* Show more / less toggle */}
      {replies.length > REPLIES_PREVIEW_COUNT && (
        <button
          type="button"
          className="text-[11px] text-primary hover:underline flex items-center gap-0.5 pl-4"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? (
            <>
              <ChevronUp size={12} /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={12} /> Show {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}
            </>
          )}
        </button>
      )}

      {/* Reply input */}
      {replyOpen ? (
        <div className="pl-4 space-y-1.5">
          <Textarea
            autoFocus
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply…"
            className="min-h-[56px] text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmitReply();
              }
              if (e.key === 'Escape') {
                setReplyOpen(false);
                setReplyText('');
              }
            }}
          />
          <div className="flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setReplyOpen(false);
                setReplyText('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={!replyText.trim() || submitting}
              onClick={handleSubmitReply}
            >
              <Send size={11} /> Send
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 pl-4 transition-colors"
          onClick={() => setReplyOpen(true)}
        >
          <Reply size={12} /> Reply
        </button>
      )}
    </div>
  );
}

export function CommentsTab({ workflowId, shareId }: CommentsTabProps) {
  const { threads, isLoading, resolveComment, deleteComment, createComment } = useComments({
    workflowId,
    shareId,
  });
  const { isAuthenticated: firebaseAuth } = useAuth();
  const { isAuthenticated: sessionAuth } = useReplitAuth();
  const isAuthenticated = firebaseAuth || sessionAuth;
  const [showResolved, setShowResolved] = useState(false);

  const visible = threads.filter((t) => showResolved || !t.root.isResolved);
  const resolvedCount = threads.filter((t) => t.root.isResolved).length;

  const handleResolve = useCallback(
    (id: string, isResolved: boolean) => resolveComment({ id, isResolved }),
    [resolveComment],
  );

  const handleDelete = useCallback(
    (id: string) => deleteComment(id),
    [deleteComment],
  );

  const handleCreate = useCallback(
    (input: { content: string; parentCommentId: string }) => createComment(input),
    [createComment],
  );

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
            {visible.map((thread: CommentThread) => (
              <ThreadCard
                key={thread.root.id}
                thread={thread}
                shareId={shareId}
                onResolve={handleResolve}
                onDelete={handleDelete}
                onCreate={handleCreate}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default CommentsTab;
