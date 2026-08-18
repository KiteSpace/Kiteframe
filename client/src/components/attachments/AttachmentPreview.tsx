import { useState } from 'react';
import { X, Loader2, AlertCircle, Maximize2 } from 'lucide-react';
import { SiFigma } from 'react-icons/si';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PromptAttachment } from '@/types/promptContext';

type PreviewSize = 'compact' | 'expanded';

interface AttachmentPreviewProps {
  attachment: PromptAttachment;
  size?: PreviewSize;
  onRemove?: (id: string) => void;
  onExpand?: () => void;
  showExpandButton?: boolean;
}

export function AttachmentPreview({
  attachment,
  size = 'compact',
  onRemove,
  onExpand,
  showExpandButton = true,
}: AttachmentPreviewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const isLoading = attachment.status === 'loading';
  const hasError = attachment.status === 'error';
  const hasThumbnail = !!attachment.thumbnailUrl;

  const handleExpand = () => {
    if (onExpand) {
      onExpand();
    } else {
      setDialogOpen(true);
    }
  };

  const previewHeight = size === 'compact' ? 200 : 400;

  const renderPlaceholder = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Loading preview...</span>
        </div>
      );
    }

    if (hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 text-destructive">
          <AlertCircle className="w-8 h-8" />
          <span className="text-sm">{attachment.errorMessage || 'Failed to load'}</span>
        </div>
      );
    }

    if (attachment.type === 'figma') {
      return (
        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <SiFigma className="w-12 h-12 text-[#F24E1E]" />
          <span className="text-sm font-medium">{attachment.displayName}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <span className="text-sm">{attachment.displayName}</span>
      </div>
    );
  };

  const previewContent = (
    <div
      className={`
        relative rounded-lg border overflow-hidden bg-muted/30
        ${hasError ? 'border-destructive/30' : 'border-border/50'}
      `}
      style={{ height: previewHeight }}
      data-testid={`attachment-preview-${attachment.id}`}
    >
      {hasThumbnail ? (
        <img
          src={attachment.thumbnailUrl}
          alt={attachment.displayName}
          className="w-full h-full object-contain bg-background"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {renderPlaceholder()}
        </div>
      )}

      <div className="absolute top-2 right-2 flex gap-1">
        {showExpandButton && hasThumbnail && !isLoading && !hasError && (
          <button
            onClick={handleExpand}
            className="p-1.5 rounded-md bg-background/80 hover:bg-background border border-border/50 transition-colors"
            data-testid={`button-expand-${attachment.id}`}
          >
            <Maximize2 className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        {onRemove && (
          <button
            onClick={() => onRemove(attachment.id)}
            disabled={isLoading}
            className="p-1.5 rounded-md bg-background/80 hover:bg-destructive/10 border border-border/50 transition-colors"
            data-testid={`button-remove-preview-${attachment.id}`}
          >
            <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
          </button>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-background/90 to-transparent">
        <div className="flex items-center gap-2">
          {attachment.type === 'figma' && (
            <SiFigma className="w-4 h-4 text-[#F24E1E] flex-shrink-0" />
          )}
          <span className="text-xs font-medium truncate">{attachment.displayName}</span>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {attachment.type === 'figma' && (
                <SiFigma className="w-5 h-5 text-[#F24E1E]" />
              )}
              {attachment.displayName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {hasThumbnail ? (
              <img
                src={attachment.thumbnailUrl}
                alt={attachment.displayName}
                className="w-full h-auto object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-[400px] bg-muted/30 rounded-lg">
                {renderPlaceholder()}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return previewContent;
}

interface AttachmentPreviewListProps {
  attachments: PromptAttachment[];
  onRemove?: (id: string) => void;
  size?: PreviewSize;
  columns?: 1 | 2 | 3;
}

export function AttachmentPreviewList({
  attachments,
  onRemove,
  size = 'compact',
  columns = 2,
}: AttachmentPreviewListProps) {
  if (attachments.length === 0) {
    return null;
  }

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  };

  return (
    <div className={`grid gap-4 ${gridCols[columns]}`} data-testid="attachment-preview-list">
      {attachments.map((attachment) => (
        <AttachmentPreview
          key={attachment.id}
          attachment={attachment}
          size={size}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
