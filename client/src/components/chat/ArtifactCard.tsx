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
  const isOpen = useIsOpenInReader(artifact.docKind, artifact.workflowId);

  const meta = [
    artifact.kindLabel,
    `${artifact.sectionCount} section${artifact.sectionCount === 1 ? '' : 's'}`,
    `${artifact.wordCount.toLocaleString()} words`,
  ].join(' · ');

  return (
    <button
      type="button"
      onClick={() =>
        openInReader({ docKind: artifact.docKind, workflowId: artifact.workflowId })
      }
      className={cn(
        'mt-2 w-full text-left rounded-lg border bg-card transition-colors',
        'hover:border-violet-400/60 hover:bg-accent/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50',
        isOpen ? 'border-violet-500/70 bg-violet-500/[0.06]' : 'border-border',
      )}
      data-testid={`artifact-card-${artifact.docId}`}
      data-artifact-open={isOpen ? 'true' : 'false'}
      aria-label={`Open ${artifact.title} in the reader`}
    >
      <div className="flex items-start gap-3 p-3">
        <span
          className={cn(
            'flex-none w-9 h-9 rounded-md flex items-center justify-center',
            isOpen ? 'bg-violet-500/15 text-violet-500' : 'bg-muted text-muted-foreground',
          )}
        >
          <FileText size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium truncate" data-testid="artifact-card-title">
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
      <div
        className={cn(
          'px-3 py-1.5 border-t text-[10px] flex items-center gap-1.5',
          isOpen ? 'border-violet-500/30 text-violet-500' : 'border-border text-muted-foreground',
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', isOpen ? 'bg-violet-500' : 'bg-muted-foreground/50')} />
        {isOpen ? 'Showing in the reader' : 'Open in the reader'}
      </div>
    </button>
  );
}

export default ArtifactCard;
