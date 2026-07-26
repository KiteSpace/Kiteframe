import { randomUUID } from 'crypto';

export type AiJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AiJobResult {
  text: string;
  credits?: { remaining: number; cost: number };
}

export interface AiJob {
  id: string;
  userIdentifier: string;
  taskType?: string;
  label?: string;
  creditCost: number;
  // Credits reserved (held) for this job at admission. Released on success
  // (atomically converted to a deduction), on failure, or on stale-timeout
  // cleanup. Zero for exempt users / verified free-turn requests.
  reservedAmount: number;
  status: AiJobStatus;
  result?: AiJobResult;
  error?: string;
  errorStatus?: number;
  createdAt: number;
  updatedAt: number;
  // AbortController used to signal upstream provider fetch to cancel when the
  // owning client aborts the request (e.g. project switch). Not serialized.
  abortController?: AbortController;
}

export function attachJobAbortController(id: string, controller: AbortController): void {
  const job = jobs.get(id);
  if (!job) return;
  job.abortController = controller;
}

// Cancel a still-active job: signal the upstream provider call to abort and
// transition the job to `cancelled` so the reservation is released and no
// credits are deducted. Returns the released reservedAmount when ok.
export function cancelJob(id: string): { ok: true; reservedAmount: number } | { ok: false; reason: 'unknown' | 'already-terminal' } {
  const job = jobs.get(id);
  if (!job) return { ok: false, reason: 'unknown' };
  if (job.status !== 'pending' && job.status !== 'running') {
    return { ok: false, reason: 'already-terminal' };
  }
  try { job.abortController?.abort(); } catch {}
  const reservedAmount = job.reservedAmount;
  job.reservedAmount = 0;
  job.status = 'cancelled';
  job.error = 'Cancelled by client';
  job.errorStatus = 499;
  job.updatedAt = Date.now();
  decActive(job.userIdentifier);
  return { ok: true, reservedAmount };
}

const jobs = new Map<string, AiJob>();
const userActiveCount = new Map<string, number>();

// Callback the route layer registers so the store can release reservations
// during stale-job cleanup without importing the credit service (avoids a
// circular dep between aiJobStore <-> creditCheck <-> creditService).
let releaseReservationCallback: ((userIdentifier: string, amount: number) => void) | null = null;
export function setReservationReleaseCallback(cb: (userIdentifier: string, amount: number) => void): void {
  releaseReservationCallback = cb;
}

const COMPLETED_TTL_MS = 10 * 60 * 1000;
const RUNNING_TIMEOUT_MS = 5 * 60 * 1000;

export const MAX_CONCURRENT_JOBS_PER_USER = 3;

function decActive(userIdentifier: string) {
  const c = userActiveCount.get(userIdentifier) || 0;
  if (c <= 1) userActiveCount.delete(userIdentifier);
  else userActiveCount.set(userIdentifier, c - 1);
}

function cleanStale() {
  const now = Date.now();
  for (const [id, job] of Array.from(jobs)) {
    if ((job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && now - job.updatedAt > COMPLETED_TTL_MS) {
      jobs.delete(id);
    } else if ((job.status === 'pending' || job.status === 'running') && now - job.updatedAt > RUNNING_TIMEOUT_MS) {
      job.status = 'failed';
      job.error = 'AI operation timed out';
      job.errorStatus = 504;
      job.updatedAt = now;
      decActive(job.userIdentifier);
      // Release any held reservation so a hung job doesn't permanently consume
      // the user's available balance. Set reservedAmount=0 so the route layer
      // doesn't double-release if its own catch path also runs later.
      if (job.reservedAmount > 0 && releaseReservationCallback) {
        try { releaseReservationCallback(job.userIdentifier, job.reservedAmount); } catch (e) {
          console.error('[aiJobStore] reservation release on stale-fail threw:', e);
        }
        job.reservedAmount = 0;
      }
    }
  }
}

export function getActiveJobCount(userIdentifier: string): number {
  cleanStale();
  return userActiveCount.get(userIdentifier) || 0;
}

export function createJob(opts: {
  userIdentifier: string;
  taskType?: string;
  label?: string;
  creditCost: number;
  reservedAmount: number;
}): AiJob {
  cleanStale();
  const id = randomUUID();
  const now = Date.now();
  const job: AiJob = {
    id,
    userIdentifier: opts.userIdentifier,
    taskType: opts.taskType,
    label: opts.label,
    creditCost: opts.creditCost,
    reservedAmount: opts.reservedAmount,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(id, job);
  userActiveCount.set(opts.userIdentifier, (userActiveCount.get(opts.userIdentifier) || 0) + 1);
  return job;
}

export function getJob(id: string): AiJob | null {
  // Run stale cleanup on every read so a hung pending/running job is force-failed
  // by the time the client polls it (otherwise GET-only flows would never trigger
  // cleanup and a stuck job would appear to hang forever from the client's POV).
  cleanStale();
  return jobs.get(id) || null;
}

export function setJobRunning(id: string): void {
  const job = jobs.get(id);
  if (!job || job.status !== 'pending') return;
  job.status = 'running';
  job.updatedAt = Date.now();
}

// Atomically transition a still-active job to `completed` and return its
// remaining reservedAmount (which the caller should release/deduct). Returns
// ok:false when the job is already terminal — e.g. cleanStale() timed it out
// while the worker was still running. The caller MUST treat ok:false as "do
// not deduct credits, do not record success" so timed-out jobs cannot be
// resurrected and charged.
export function tryFinalizeSuccess(id: string, result: AiJobResult): { ok: true; reservedAmount: number } | { ok: false; reason: 'unknown' | 'already-terminal' } {
  const job = jobs.get(id);
  if (!job) return { ok: false, reason: 'unknown' };
  if (job.status !== 'pending' && job.status !== 'running') {
    return { ok: false, reason: 'already-terminal' };
  }
  const reservedAmount = job.reservedAmount;
  job.reservedAmount = 0;
  job.status = 'completed';
  job.result = result;
  job.updatedAt = Date.now();
  decActive(job.userIdentifier);
  return { ok: true, reservedAmount };
}

// Atomically transition a still-active job to `failed` and return its
// reservedAmount. ok:false when the job is already terminal (cleanStale beat
// us) — caller must NOT release reservation again in that case (cleanStale
// already did).
export function tryFinalizeFailure(id: string, error: string, errorStatus: number = 500): { ok: true; reservedAmount: number } | { ok: false; reason: 'unknown' | 'already-terminal' } {
  const job = jobs.get(id);
  if (!job) return { ok: false, reason: 'unknown' };
  if (job.status !== 'pending' && job.status !== 'running') {
    return { ok: false, reason: 'already-terminal' };
  }
  const reservedAmount = job.reservedAmount;
  job.reservedAmount = 0;
  job.status = 'failed';
  job.error = error;
  job.errorStatus = errorStatus;
  job.updatedAt = Date.now();
  decActive(job.userIdentifier);
  return { ok: true, reservedAmount };
}

// Legacy entry points retained for callers that don't care about the
// terminal-safety guarantee. Prefer the tryFinalize* variants above.
export function completeJob(id: string, result: AiJobResult): void {
  tryFinalizeSuccess(id, result);
}

export function failJob(id: string, error: string, errorStatus: number = 500): void {
  tryFinalizeFailure(id, error, errorStatus);
}
