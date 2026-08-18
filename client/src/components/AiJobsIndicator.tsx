import { Loader2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { useAiJobs } from '@/contexts/AiJobsContext';

export function AiJobsIndicator() {
  const { pendingJobs } = useAiJobs();
  const [, setLocation] = useLocation();

  if (pendingJobs.length === 0) return null;

  const primary = pendingJobs[0];
  const extra = pendingJobs.length - 1;
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
