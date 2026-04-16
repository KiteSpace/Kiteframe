import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';

export interface PendingAiJob {
  jobId: string;
  label: string;
  taskType?: string;
  startedAt: number;
}

interface AiJobsContextValue {
  pendingJobs: PendingAiJob[];
  registerJob: (job: PendingAiJob) => void;
  clearJob: (jobId: string) => void;
}

const AiJobsContext = createContext<AiJobsContextValue | null>(null);

const STORAGE_KEY = 'kiteframe-pending-ai-jobs';
const STALE_AFTER_MS = 6 * 60 * 1000;

function loadFromStorage(): PendingAiJob[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((j: any) =>
      j && typeof j.jobId === 'string' && typeof j.label === 'string' &&
      typeof j.startedAt === 'number' && now - j.startedAt < STALE_AFTER_MS
    );
  } catch {
    return [];
  }
}

function saveToStorage(jobs: PendingAiJob[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {}
}

export function AiJobsProvider({ children }: { children: ReactNode }) {
  const [pendingJobs, setPendingJobs] = useState<PendingAiJob[]>(() => loadFromStorage());
  const watcherRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    saveToStorage(pendingJobs);
  }, [pendingJobs]);

  const clearJob = useCallback((jobId: string) => {
    setPendingJobs(prev => prev.filter(j => j.jobId !== jobId));
    const handle = watcherRef.current.get(jobId);
    if (handle) {
      window.clearTimeout(handle);
      watcherRef.current.delete(jobId);
    }
  }, []);

  // Background watcher: for jobs we know about (e.g., rehydrated after navigation),
  // poll the server until they finish so the indicator clears itself even if no
  // component is actively awaiting the result.
  useEffect(() => {
    pendingJobs.forEach(job => {
      if (watcherRef.current.has(job.jobId)) return;
      const startedAt = Date.now();
      const tick = async () => {
        try {
          const res = await fetch(`/api/ai/jobs/${job.jobId}`);
          if (!res.ok) {
            clearJob(job.jobId);
            return;
          }
          const data = await res.json();
          if (data.status === 'completed' || data.status === 'failed') {
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

  // Cleanup all timers on unmount.
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

  return (
    <AiJobsContext.Provider value={{ pendingJobs, registerJob, clearJob }}>
      {children}
    </AiJobsContext.Provider>
  );
}

export function useAiJobs(): AiJobsContextValue {
  const ctx = useContext(AiJobsContext);
  if (!ctx) {
    // Allow hook usage outside provider for safety — falls back to a no-op shim.
    return {
      pendingJobs: [],
      registerJob: () => {},
      clearJob: () => {},
    };
  }
  return ctx;
}
