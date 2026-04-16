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
  clearJob: (jobId: string) => void;
  // Result handoff: surfaces that initiated a job but unmounted (e.g. user
  // navigated to another tab) can read the completed result on remount via
  // these helpers. Results live for ~10 minutes or until consumed.
  takeCompletedJob: (jobId: string) => CompletedAiJob | null;
  takeCompletedJobsForOrigin: (originPath: string) => CompletedAiJob[];
  peekCompletedJobsForOrigin: (originPath: string) => CompletedAiJob[];
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

  const recordCompleted = useCallback((entry: CompletedAiJob) => {
    setCompletedJobs(prev => {
      if (prev.some(j => j.jobId === entry.jobId)) return prev;
      const now = Date.now();
      const fresh = prev.filter(j => now - j.completedAt < COMPLETED_TTL_MS);
      return [...fresh, entry];
    });
  }, []);

  const clearJob = useCallback((jobId: string) => {
    setPendingJobs(prev => prev.filter(j => j.jobId !== jobId));
    const handle = watcherRef.current.get(jobId);
    if (handle) {
      window.clearTimeout(handle);
      watcherRef.current.delete(jobId);
    }
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

  return (
    <AiJobsContext.Provider value={{
      pendingJobs, registerJob, clearJob,
      takeCompletedJob, takeCompletedJobsForOrigin, peekCompletedJobsForOrigin,
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
      takeCompletedJob: () => null,
      takeCompletedJobsForOrigin: () => [],
      peekCompletedJobsForOrigin: () => [],
    };
  }
  return ctx;
}
