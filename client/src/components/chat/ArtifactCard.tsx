/**
 * A generated document, shown in the chat as a card.
 *
 * The document itself lives in the reader, where it can be read at a sane
 * measure and edited section by section. This card is only the handle: enough
 * metadata to recognise which document it is and how substantial, plus the
 * first lines so it is not an anonymous box. Clicking it opens the real thing.
 *
 * The card reports whether its document is the one currently open, because a
 * thread can accumulate several of these and "which of these am I looking at"
 * is otherwise unanswerable.
 */

import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { openInReader, useIsOpenInReader } from '@/stores/readerStore';
import type { ChatArtifact } from '@/lib/kiteaiTranscript';

interface ArtifactCardProps {
  artifact: ChatArtifact;
}

export function ArtifactCard({ artifact }: ArtifactCardProps) {
  const isOpen = useIsOpenInReader(
    artifact.docKind,
    artifact.workflowId,
    undefined,
    artifact.conversationId,
  );

  const meta = artifact.kindLabel;

  return (
    <button
      type="button"
      onClick={() =>
        openInReader({
          docKind: artifact.docKind,
          workflowId: artifact.workflowId,
          conversationId: artifact.conversationId,
        })
      }
      className={cn(
        'mt-2 w-full text-left rounded-lg border bg-card transition-colors',
        'hover:border-input',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isOpen ? 'border-[color:var(--brand)] bg-[color:var(--brand-wash)] shadow-[0_0_0_3px_rgba(155,107,255,.14)]' : 'border-border',
      )}
      data-testid={`artifact-card-${artifact.docId}`}
      data-artifact-open={isOpen ? 'true' : 'false'}
      aria-label={`Open ${artifact.title} in the reader`}
    >
       <div className="flex items-start gap-2 p-[10px]">
        <span
          className={cn(
             'flex-none w-[26px] h-[26px] rounded-md flex items-center justify-center',
             isOpen ? 'bg-brand-soft text-[color:var(--brand-strong)]' : 'bg-brand-soft text-[color:var(--brand-strong)]',
          )}
        >
           <FileText size={14} />
        </span>
        <div className="min-w-0 flex-1">
           <div className="text-[13px] font-semibold truncate" data-testid="artifact-card-title">
            {artifact.title}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground tabular-nums mt-0.5 truncate">
            {meta}
          </div>
          {artifact.excerpt && (
            <p className="text-[11px] leading-relaxed text-muted-foreground mt-1.5 line-clamp-2">
              {artifact.excerpt}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export default ArtifactCard;
