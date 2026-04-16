import { Loader2 } from 'lucide-react';
import { useAiJobs } from '@/contexts/AiJobsContext';

export function AiJobsIndicator() {
  const { pendingJobs } = useAiJobs();
  if (pendingJobs.length === 0) return null;

  const primary = pendingJobs[0];
  const extra = pendingJobs.length - 1;
  const text = extra > 0
    ? `${primary.label} (+${extra} more)`
    : primary.label;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md border bg-background/95 px-3 py-2 text-sm shadow-md backdrop-blur"
      role="status"
      aria-live="polite"
      data-testid="ai-jobs-indicator"
    >
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <span className="text-foreground">{text}…</span>
    </div>
  );
}
