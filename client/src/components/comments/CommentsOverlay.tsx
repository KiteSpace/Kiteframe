import { useEffect, useRef, useState, useCallback } from 'react';
import { MessageSquarePlus, MessageCircle, Check, Trash2, Send, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useComments, type CommentWithAuthor } from '@/hooks/useComments';

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface CommentsOverlayProps {
  /** Project UUID — shared comment key. When absent, the overlay is inert. */
  workflowId?: string | null;
  /** Present in the view-only viewer; lets unauthenticated viewers post. */
  shareId?: string | null;
  /** Whether the current user is signed in (controls delete + author label). */
  isAuthenticated?: boolean;
  viewport: Viewport;
  onViewportChange?: (vp: Viewport) => void;
  containerRef: React.RefObject<HTMLDivElement>;
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

function AuthorRow({ comment }: { comment: CommentWithAuthor }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        {comment.authorImageUrl && <AvatarImage src={comment.authorImageUrl} alt={comment.authorName} />}
        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
          {getInitials(comment.authorName)}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs font-medium truncate">{comment.authorName}</span>
      <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(comment.createdAt)}</span>
    </div>
  );
}

export function CommentsOverlay({
  workflowId,
  shareId,
  isAuthenticated = false,
  viewport,
  onViewportChange,
  containerRef,
}: CommentsOverlayProps) {
  const { threads, createComment, resolveComment, deleteComment } = useComments({
    workflowId,
    shareId,
  });

  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [draftText, setDraftText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Convert a world coordinate to a screen position within the canvas container.
  const toScreen = useCallback(
    (wx: number, wy: number) => ({
      x: wx * viewport.zoom + viewport.x,
      y: wy * viewport.zoom + viewport.y,
    }),
    [viewport],
  );

  // Center the viewport on a world point (used when focusing a comment).
  const centerOn = useCallback(
    (wx: number, wy: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !onViewportChange) return;
      onViewportChange({
        x: rect.width / 2 - wx * viewport.zoom,
        y: rect.height / 2 - wy * viewport.zoom,
        zoom: viewport.zoom,
      });
    },
    [containerRef, onViewportChange, viewport.zoom],
  );

  // Listen for "focus this comment" requests from the Comments panel tab.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string; x: number; y: number } | undefined;
      if (!detail) return;
      setSelectedId(detail.id);
      if (typeof detail.x === 'number' && typeof detail.y === 'number') {
        centerOn(detail.x, detail.y);
      }
    };
    window.addEventListener('kiteframe:focusComment', handler);
    return () => window.removeEventListener('kiteframe:focusComment', handler);
  }, [centerOn]);

  const handlePlaceClick = (e: React.MouseEvent) => {
    if (!placing) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const wx = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const wy = (e.clientY - rect.top - viewport.y) / viewport.zoom;
    setDraft({ x: wx, y: wy });
    setDraftText('');
    setPlacing(false);
    setSelectedId(null);
  };

  const submitDraft = async () => {
    if (!draft || !draftText.trim()) return;
    await createComment({ content: draftText.trim(), positionX: Math.round(draft.x), positionY: Math.round(draft.y) });
    setDraft(null);
    setDraftText('');
  };

  const submitReply = async (parentId: string) => {
    if (!replyText.trim()) return;
    await createComment({ content: replyText.trim(), parentCommentId: parentId });
    setReplyText('');
  };

  if (!workflowId) return null;

  const selectedThread = threads.find((t) => t.root.id === selectedId) || null;
  const containerRect = containerRef.current?.getBoundingClientRect();
  const containerW = containerRect?.width ?? 0;
  const containerH = containerRect?.height ?? 0;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ pointerEvents: placing ? 'auto' : 'none', cursor: placing ? 'crosshair' : 'default' }}
      onClick={handlePlaceClick}
      data-testid="comments-overlay"
    >
      {/* Comment pins */}
      {threads.map(({ root, replies }) => {
        if (root.positionX == null || root.positionY == null) return null;
        const pos = toScreen(root.positionX, root.positionY);
        if (pos.x < -40 || pos.y < -40 || pos.x > containerW + 40 || pos.y > containerH + 40) {
          return null;
        }
        const resolved = !!root.isResolved;
        const isSelected = selectedId === root.id;
        return (
          <button
            key={root.id}
            type="button"
            className={`absolute flex items-center justify-center rounded-full rounded-bl-none shadow-md transition-transform hover:scale-110 ${
              resolved ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
            } ${isSelected ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
            style={{
              left: pos.x,
              top: pos.y,
              width: 28,
              height: 28,
              transform: 'translate(-2px, -28px)',
              pointerEvents: 'auto',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedId(isSelected ? null : root.id);
              setDraft(null);
            }}
            data-testid={`comment-pin-${root.id}`}
          >
            {resolved ? (
              <Check size={14} />
            ) : replies.length > 0 ? (
              <span className="text-[11px] font-semibold">{replies.length + 1}</span>
            ) : (
              <MessageCircle size={14} />
            )}
          </button>
        );
      })}

      {/* Draft new-comment input */}
      {draft && (() => {
        const pos = toScreen(draft.x, draft.y);
        const left = Math.min(Math.max(8, pos.x), Math.max(8, containerW - 280));
        const top = Math.min(Math.max(8, pos.y), Math.max(8, containerH - 160));
        return (
          <div
            className="absolute z-50 w-64 rounded-lg border border-border bg-popover shadow-xl p-3"
            style={{ left, top, pointerEvents: 'auto' }}
            onClick={(e) => e.stopPropagation()}
            data-testid="comment-draft"
          >
            <Textarea
              autoFocus
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Add a comment..."
              className="min-h-[64px] text-sm resize-none"
              data-testid="comment-draft-input"
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" size="sm" onClick={() => setDraft(null)} data-testid="comment-draft-cancel">
                Cancel
              </Button>
              <Button size="sm" onClick={submitDraft} disabled={!draftText.trim()} data-testid="comment-draft-submit">
                <Send size={14} className="mr-1" /> Comment
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Thread popup */}
      {selectedThread && selectedThread.root.positionX != null && selectedThread.root.positionY != null && (() => {
        const pos = toScreen(selectedThread.root.positionX, selectedThread.root.positionY);
        const left = Math.min(Math.max(8, pos.x + 16), Math.max(8, containerW - 312));
        const top = Math.min(Math.max(8, pos.y - 16), Math.max(8, containerH - 320));
        const root = selectedThread.root;
        return (
          <div
            className="absolute z-50 w-72 rounded-lg border border-border bg-popover shadow-xl flex flex-col max-h-[360px]"
            style={{ left, top, pointerEvents: 'auto' }}
            onClick={(e) => e.stopPropagation()}
            data-testid={`comment-thread-${root.id}`}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-semibold">
                {root.isResolved ? 'Resolved' : 'Comment'}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title={root.isResolved ? 'Reopen' : 'Resolve'}
                  onClick={() => resolveComment({ id: root.id, isResolved: !root.isResolved })}
                  data-testid={`comment-resolve-${root.id}`}
                >
                  <Check size={14} className={root.isResolved ? 'text-green-600' : ''} />
                </Button>
                {isAuthenticated && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    title="Delete"
                    onClick={async () => {
                      await deleteComment(root.id);
                      setSelectedId(null);
                    }}
                    data-testid={`comment-delete-${root.id}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="Close"
                  onClick={() => setSelectedId(null)}
                  data-testid={`comment-close-${root.id}`}
                >
                  <X size={14} />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
              <div className="space-y-1">
                <AuthorRow comment={root} />
                <p className="text-sm whitespace-pre-wrap break-words pl-8">{root.content}</p>
              </div>
              {selectedThread.replies.map((reply) => (
                <div key={reply.id} className="space-y-1">
                  <AuthorRow comment={reply} />
                  <p className="text-sm whitespace-pre-wrap break-words pl-8">{reply.content}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-2 flex items-end gap-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Reply..."
                className="min-h-[36px] max-h-24 text-sm resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    submitReply(root.id);
                  }
                }}
                data-testid={`comment-reply-input-${root.id}`}
              />
              <Button
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                disabled={!replyText.trim()}
                onClick={() => submitReply(root.id)}
                data-testid={`comment-reply-submit-${root.id}`}
              >
                <Send size={14} />
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Place-comment toggle button */}
      <Button
        variant={placing ? 'default' : 'secondary'}
        size="sm"
        className="absolute left-4 bottom-4 shadow-md gap-1.5"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => {
          e.stopPropagation();
          setPlacing((p) => !p);
          setDraft(null);
        }}
        data-testid="comment-mode-toggle"
      >
        <MessageSquarePlus size={16} />
        {placing ? 'Click canvas to place' : 'Comment'}
      </Button>
    </div>
  );
}

export default CommentsOverlay;
