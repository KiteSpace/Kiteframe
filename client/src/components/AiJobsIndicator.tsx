import { Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAiJobs } from '@/contexts/AiJobsContext';
import { useSyncExternalStore } from 'react';
import { subscribeOperations, getOperations, cancelOperation, dismissOperation } from '@/ai/backgroundOperations';

export function AiJobsIndicator() {
  const { pendingJobs, isJobClaimedInline } = useAiJobs();
  const [, setLocation] = useLocation();
  const operations = useSyncExternalStore(subscribeOperations, getOperations, getOperations);
  const activeOperations = operations.filter(op => op.status !== 'completed');

  // Drop only the jobs a visible thread already reports with its own inline
  // "Thinking…" row — showing those here would announce one operation twice.
  // Anything unclaimed (a PRD generation running in the background, say) still
  // gets a pill, so the user never loses sight of it.
  const visibleJobs = pendingJobs.filter(job => !job.operationKey && !isJobClaimedInline(job));
  if (activeOperations.length) {
    return <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-md border bg-background/95 p-3 text-sm shadow-md"
      data-testid="ai-jobs-indicator" role="status" aria-live="polite">
      {activeOperations.map(op => <div key={op.key} className="mb-1 flex items-center gap-2">
        {op.status === 'running' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
        <button type="button" className="text-left" onClick={() => setLocation(op.originPath)}>
          {op.label}{op.status === 'running' ? '…' : op.status === 'cancelled' ? ' — cancelled' : ` — ${op.error || 'failed'}`}
        </button>
        {op.status === 'running'
          ? <button type="button" className="underline" disabled={op.committing} aria-label={`Stop ${op.label}`} onClick={() => cancelOperation(op.key)}>Stop</button>
          : <><button type="button" className="underline" disabled={!op.settled} onClick={() => void op.retry()}>Retry</button>
            <button type="button" aria-label={`Dismiss ${op.label}`} onClick={() => dismissOperation(op.key)}>×</button></>}
      </div>)}
      {visibleJobs.map(job => <div key={job.jobId}>{job.label}…</div>)}
    </div>;
  }
  if (visibleJobs.length === 0) return null;

  const primary = visibleJobs[0];
  const extra = visibleJobs.length - 1;
  const text = extra > 0 ? `${primary.label} (+${extra} more)` : primary.label;

  // Click navigates back to the surface that started the first pending job, if
  // we know it. Falls back to a no-op if no origin was recorded. Pressing the
  // pill while already on the origin path is harmless (wouter no-ops).
  const canNavigate = !!primary.originPath;
  const onClick = () => {
    if (primary.originPath) setLocation(primary.originPath);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canNavigate}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md border bg-background/95 px-3 py-2 text-sm shadow-md backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-default disabled:hover:bg-background/95 disabled:hover:text-foreground"
      role="status"
      aria-live="polite"
      title={canNavigate ? `Click to return to ${primary.originPath}` : undefined}
      data-testid="ai-jobs-indicator"
    >
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <span className="text-foreground">{text}…</span>
    </button>
  );
}
