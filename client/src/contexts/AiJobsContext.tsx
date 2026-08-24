import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';

export interface PendingAiJob {
  jobId: string;
  label: string;
  taskType?: string;
  startedAt: number;
  // Path the user was on when the job started. Used by the global indicator to
  // navigate back to the originating surface, and by remounted surfaces to
  // re-claim a result that completed while they were unmounted.
  originPath?: string;
}

export interface CompletedAiJob {
  jobId: string;
  label: string;
  taskType?: string;
  originPath?: string;
  status: 'completed' | 'failed';
  text?: string;
  error?: string;
  errorStatus?: number;
  completedAt: number;
}

interface AiJobsContextValue {
  pendingJobs: PendingAiJob[];
  registerJob: (job: PendingAiJob) => void;
  // Remove a jobId from the pending list and cancel its background watcher.
  // Does NOT touch completedJobs — completion records must survive so a
  // remounted surface can still claim them via takeCompletedJobsForOrigin.
  clearJob: (jobId: string) => void;
  // Called by the foreground caller (e.g. OpenAICompatClient) the moment it
  // hands the result to its awaiting consumer. Suppresses any later remount
  // replay for that jobId so the user doesn't see a duplicate "recovered"
  // assistant message for a result they already saw.
  markConsumed: (jobId: string) => void;
  // Result handoff: surfaces that initiated a job but unmounted (e.g. user
  // navigated to another tab) can read the completed result on remount via
  // these helpers. Results live for ~10 minutes or until consumed.
  takeCompletedJob: (jobId: string) => CompletedAiJob | null;
  takeCompletedJobsForOrigin: (originPath: string) => CompletedAiJob[];
  peekCompletedJobsForOrigin: (originPath: string) => CompletedAiJob[];
  // A mounted surface that renders its own in-thread progress row claims the
  // jobs it already reports, so the global floating pill can stand down for
  // those without going silent about unrelated work.
  claimInlineIndicator: (claim: InlineIndicatorClaim) => number;
  releaseInlineIndicator: (claimId: number) => void;
  // True when some mounted surface already reports this job inline.
  isJobClaimedInline: (job: PendingAiJob) => boolean;
}

// A claim is deliberately narrow: it covers only jobs started from the same
// path AND (when given) of the listed task types. A blanket claim would hide
// e.g. a PRD generation running alongside a chat request, leaving the user
// with no progress signal for it at all.
export interface InlineIndicatorClaim {
  originPath: string;
  taskTypes?: string[];
}

const AiJobsContext = createContext<AiJobsContextValue | null>(null);

const PENDING_KEY = 'kiteframe-pending-ai-jobs';
const COMPLETED_KEY = 'kiteframe-completed-ai-jobs';
const STALE_AFTER_MS = 6 * 60 * 1000;
const COMPLETED_TTL_MS = 10 * 60 * 1000;

function loadPending(): PendingAiJob[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((j: any) =>
      j && typeof j.jobId === 'string' && typeof j.label === 'string' &&
      typeof j.startedAt === 'number' && now - j.startedAt < STALE_AFTER_MS
    );
  } catch { return []; }
}

function loadCompleted(): CompletedAiJob[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(COMPLETED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((j: any) =>
      j && typeof j.jobId === 'string' && typeof j.completedAt === 'number' &&
      now - j.completedAt < COMPLETED_TTL_MS
    );
  } catch { return []; }
}

function save(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function AiJobsProvider({ children }: { children: ReactNode }) {
  const [pendingJobs, setPendingJobs] = useState<PendingAiJob[]>(() => loadPending());
  const [completedJobs, setCompletedJobs] = useState<CompletedAiJob[]>(() => loadCompleted());
  const watcherRef = useRef<Map<string, number>>(new Map());

  useEffect(() => { save(PENDING_KEY, pendingJobs); }, [pendingJobs]);
  useEffect(() => { save(COMPLETED_KEY, completedJobs); }, [completedJobs]);

  // Tracks job ids whose result was already handed to the foreground caller
  // inline. Only `markConsumed` adds to this set — `clearJob` does NOT, so a
  // job whose initiating UI unmounted before completion still gets persisted
  // for remount handoff.
  const consumedRef = useRef<Set<string>>(new Set());

  const recordCompleted = useCallback((entry: CompletedAiJob) => {
    if (consumedRef.current.has(entry.jobId)) return;
    setCompletedJobs(prev => {
      if (prev.some(j => j.jobId === entry.jobId)) return prev;
      const now = Date.now();
      const fresh = prev.filter(j => now - j.completedAt < COMPLETED_TTL_MS);
      return [...fresh, entry];
    });
  }, []);

  const clearJob = useCallback((jobId: string) => {
    // Only remove from pending and cancel the watcher. NEVER drop completed
    // records here — that would break remount handoff (a watcher would record
    // completion and then immediately wipe it).
    setPendingJobs(prev => prev.filter(j => j.jobId !== jobId));
    const handle = watcherRef.current.get(jobId);
    if (handle) {
      window.clearTimeout(handle);
      watcherRef.current.delete(jobId);
    }
  }, []);

  const markConsumed = useCallback((jobId: string) => {
    consumedRef.current.add(jobId);
    // If the watcher already persisted a completion for this job (race), drop
    // it now so the foreground caller's inline result isn't duplicated by a
    // remount replay.
    setCompletedJobs(prev => prev.filter(j => j.jobId !== jobId));
  }, []);

  // Background watcher: poll the server until a known job finishes, then move it
  // from pending → completed. This way a job that completes while the initiating
  // surface is unmounted still gets its result captured for later consumption.
  useEffect(() => {
    pendingJobs.forEach(job => {
      if (watcherRef.current.has(job.jobId)) return;
      const startedAt = Date.now();
      const tick = async () => {
        try {
          const res = await fetch(`/api/ai/jobs/${job.jobId}`);
          if (!res.ok) {
            recordCompleted({
              jobId: job.jobId, label: job.label, taskType: job.taskType,
              originPath: job.originPath, status: 'failed',
              error: `HTTP ${res.status}`, errorStatus: res.status,
              completedAt: Date.now(),
            });
            clearJob(job.jobId);
            return;
          }
          const data = await res.json();
          if (data.status === 'completed') {
            recordCompleted({
              jobId: job.jobId, label: job.label, taskType: job.taskType,
              originPath: job.originPath, status: 'completed',
              text: data.text ?? '', completedAt: Date.now(),
            });
            clearJob(job.jobId);
            return;
          }
          if (data.status === 'failed') {
            recordCompleted({
              jobId: job.jobId, label: job.label, taskType: job.taskType,
              originPath: job.originPath, status: 'failed',
              error: data.error, errorStatus: data.errorStatus,
              completedAt: Date.now(),
            });
            clearJob(job.jobId);
            return;
          }
        } catch {
          // network blip — keep polling
        }
        if (Date.now() - startedAt > STALE_AFTER_MS) {
          clearJob(job.jobId);
          return;
        }
        const handle = window.setTimeout(tick, 2500);
        watcherRef.current.set(job.jobId, handle);
      };
      const handle = window.setTimeout(tick, 1500);
      watcherRef.current.set(job.jobId, handle);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJobs.length]);

  useEffect(() => {
    return () => {
      watcherRef.current.forEach(h => window.clearTimeout(h));
      watcherRef.current.clear();
    };
  }, []);

  const registerJob = useCallback((job: PendingAiJob) => {
    setPendingJobs(prev => {
      if (prev.some(j => j.jobId === job.jobId)) return prev;
      return [...prev, job];
    });
  }, []);

  const takeCompletedJob = useCallback((jobId: string): CompletedAiJob | null => {
    let found: CompletedAiJob | null = null;
    setCompletedJobs(prev => {
      const match = prev.find(j => j.jobId === jobId);
      if (!match) return prev;
      found = match;
      return prev.filter(j => j.jobId !== jobId);
    });
    return found;
  }, []);

  const takeCompletedJobsForOrigin = useCallback((originPath: string): CompletedAiJob[] => {
    let claimed: CompletedAiJob[] = [];
    setCompletedJobs(prev => {
      claimed = prev.filter(j => j.originPath === originPath);
      if (claimed.length === 0) return prev;
      return prev.filter(j => j.originPath !== originPath);
    });
    return claimed;
  }, []);

  const peekCompletedJobsForOrigin = useCallback((originPath: string): CompletedAiJob[] => {
    return completedJobs.filter(j => j.originPath === originPath);
  }, [completedJobs]);

  // Keyed by an opaque incrementing id rather than refcounted per shape, so a
  // StrictMode setup/cleanup/setup cycle or two chat surfaces mounted at once
  // (panel + fullscreen) each release exactly their own claim.
  const [inlineClaims, setInlineClaims] = useState<Map<number, InlineIndicatorClaim>>(() => new Map());
  const nextClaimIdRef = useRef(1);

  const claimInlineIndicator = useCallback((claim: InlineIndicatorClaim) => {
    const id = nextClaimIdRef.current++;
    setInlineClaims(prev => {
      const next = new Map(prev);
      next.set(id, claim);
      return next;
    });
    return id;
  }, []);

  const releaseInlineIndicator = useCallback((claimId: number) => {
    setInlineClaims(prev => {
      if (!prev.has(claimId)) return prev;
      const next = new Map(prev);
      next.delete(claimId);
      return next;
    });
  }, []);

  const isJobClaimedInline = useCallback((job: PendingAiJob) => {
    // Array.from rather than iterating the Map directly — this project's TS
    // target predates downlevel iteration of map iterators.
    return Array.from(inlineClaims.values()).some(claim =>
      job.originPath === claim.originPath &&
      (!claim.taskTypes || claim.taskTypes.includes(job.taskType ?? ''))
    );
  }, [inlineClaims]);

  return (
    <AiJobsContext.Provider value={{
      pendingJobs, registerJob, clearJob, markConsumed,
      takeCompletedJob, takeCompletedJobsForOrigin, peekCompletedJobsForOrigin,
      claimInlineIndicator, releaseInlineIndicator, isJobClaimedInline,
    }}>
      {children}
    </AiJobsContext.Provider>
  );
}

export function useAiJobs(): AiJobsContextValue {
  const ctx = useContext(AiJobsContext);
  if (!ctx) {
    return {
      pendingJobs: [],
      registerJob: () => {},
      clearJob: () => {},
      markConsumed: () => {},
      takeCompletedJob: () => null,
      takeCompletedJobsForOrigin: () => [],
      peekCompletedJobsForOrigin: () => [],
      claimInlineIndicator: () => 0,
      releaseInlineIndicator: () => {},
      isJobClaimedInline: () => false,
    };
  }
  return ctx;
}
