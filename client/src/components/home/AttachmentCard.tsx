import { X, Loader2, AlertCircle, Image, FileText } from 'lucide-react';
import { SiFigma } from 'react-icons/si';
import type { PromptAttachment } from '@/types/promptContext';

interface AttachmentCardProps {
  attachment: PromptAttachment;
  onRemove: (id: string) => void;
}

export function AttachmentCard({ attachment, onRemove }: AttachmentCardProps) {
  const getIcon = () => {
    switch (attachment.type) {
      case 'figma':
        return <SiFigma className="w-4 h-4 text-[#F24E1E]" />;
      case 'image':
        return <Image className="w-4 h-4 text-blue-500" />;
      case 'document':
        return <FileText className="w-4 h-4 text-orange-500" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const isLoading = attachment.status === 'loading';
  const hasError = attachment.status === 'error';

  return (
    <div
      className={`
        relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm
        ${hasError 
          ? 'bg-destructive/10 border-destructive/30' 
          : 'bg-muted/50 border-border/50'
        }
      `}
      data-testid={`attachment-card-${attachment.id}`}
    >
      {attachment.thumbnailUrl ? (
        <img
          src={attachment.thumbnailUrl}
          alt={attachment.displayName}
          className="w-6 h-6 rounded object-cover flex-shrink-0"
        />
      ) : (
        <div className="flex-shrink-0">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : hasError ? (
            <AlertCircle className="w-4 h-4 text-destructive" />
          ) : (
            getIcon()
          )}
        </div>
      )}

      <span className="truncate max-w-[120px] text-xs font-medium">
        {attachment.displayName}
      </span>

      {hasError && attachment.errorMessage && (
        <span className="text-xs text-destructive truncate max-w-[100px]" title={attachment.errorMessage}>
          {attachment.errorMessage}
        </span>
      )}

      <button
        onClick={() => onRemove(attachment.id)}
        className="ml-auto p-0.5 rounded hover:bg-background/80 transition-colors flex-shrink-0"
        disabled={isLoading}
        data-testid={`button-remove-attachment-${attachment.id}`}
      >
        <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
      </button>
    </div>
  );
}

interface AttachmentListProps {
  attachments: PromptAttachment[];
  onRemove: (id: string) => void;
}

export function AttachmentList({ attachments, onRemove }: AttachmentListProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="attachment-list">
      {attachments.map((attachment) => (
        <AttachmentCard
          key={attachment.id}
          attachment={attachment}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
