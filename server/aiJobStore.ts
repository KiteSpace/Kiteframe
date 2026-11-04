import { randomUUID } from 'crypto';

export type AiJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AiJobResult {
  text: string;
  /** Structured design/proposal responses; never replayed as chat text. */
  payload?: unknown;
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
function cancelJobLocal(id: string): { ok: true; reservedAmount: number } | { ok: false; reason: 'unknown' | 'already-terminal' } {
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

function createJobLocal(opts: {
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

function setJobRunningLocal(id: string): void {
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
function tryFinalizeSuccessLocal(id: string, result: AiJobResult): { ok: true; reservedAmount: number } | { ok: false; reason: 'unknown' | 'already-terminal' } {
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
function tryFinalizeFailureLocal(id: string, error: string, errorStatus: number = 500): { ok: true; reservedAmount: number } | { ok: false; reason: 'unknown' | 'already-terminal' } {
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
function completeJobLocal(id: string, result: AiJobResult): void {
  tryFinalizeSuccess(id, result);
}

function failJobLocal(id: string, error: string, errorStatus: number = 500): void {
  tryFinalizeFailure(id, error, errorStatus);
}

// ---- Shared job state (Postgres) ----
// The instance that admitted a job owns its in-memory record and upstream call.
// Every state change is written through to ai_jobs so polls, concurrency limits
// and cancels work from any instance. Tests have no database and stay in memory.
const useMemoryStore = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
// Loaded lazily so importing the job store never requires DATABASE_URL (unit tests).
const pool = {
  query: async (text: string, params?: unknown[]) => (await import('./db')).pool.query(text, params),
};
let jobsTableReady: Promise<unknown> | null = null;
function ensureJobsTable(): Promise<unknown> {
  jobsTableReady ??= pool
    .query(
      `CREATE TABLE IF NOT EXISTS ai_jobs (
        id text PRIMARY KEY,
        user_identifier text NOT NULL,
        status text NOT NULL,
        result jsonb,
        error text,
        error_status integer,
        cancel_requested boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
    )
    .then(() => pool.query(`CREATE INDEX IF NOT EXISTS ai_jobs_updated_at_idx ON ai_jobs (updated_at)`))
    .catch((error: unknown) => {
      jobsTableReady = null;
      throw error;
    });
  return jobsTableReady!;
}

function persistJob(job: AiJob | null | undefined): void {
  if (useMemoryStore || !job) return;
  const snapshot = {
    id: job.id,
    user: job.userIdentifier,
    status: job.status,
    result: job.result ? JSON.stringify(job.result) : null,
    error: job.error ?? null,
    errorStatus: job.errorStatus ?? null,
  };
  ensureJobsTable()
    .then(() =>
      pool.query(
        `INSERT INTO ai_jobs (id, user_identifier, status, result, error, error_status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, result = EXCLUDED.result,
           error = EXCLUDED.error, error_status = EXCLUDED.error_status, updated_at = now()`,
        [snapshot.id, snapshot.user, snapshot.status, snapshot.result, snapshot.error, snapshot.errorStatus],
      ),
    )
    .catch((error) => console.error('[aiJobStore] persist failed:', error));
}

export const createJob = (...args: Parameters<typeof createJobLocal>) => {
  const job = createJobLocal(...args);
  persistJob(job);
  return job;
};
export const setJobRunning = (id: string) => { setJobRunningLocal(id); persistJob(jobs.get(id)); };
export const tryFinalizeSuccess = (...args: Parameters<typeof tryFinalizeSuccessLocal>) => {
  const r = tryFinalizeSuccessLocal(...args); persistJob(jobs.get(args[0])); return r;
};
export const tryFinalizeFailure = (...args: Parameters<typeof tryFinalizeFailureLocal>) => {
  const r = tryFinalizeFailureLocal(...args); persistJob(jobs.get(args[0])); return r;
};
export const completeJob = (...args: Parameters<typeof completeJobLocal>) => {
  completeJobLocal(...args); persistJob(jobs.get(args[0]));
};
export const failJob = (...args: Parameters<typeof failJobLocal>) => {
  failJobLocal(...args); persistJob(jobs.get(args[0]));
};
export const cancelJob = (...args: Parameters<typeof cancelJobLocal>) => {
  const r = cancelJobLocal(...args); persistJob(jobs.get(args[0])); return r;
};

export function isLocalJob(id: string): boolean {
  return jobs.has(id);
}

/** Looks up a job on this instance, then in Postgres for jobs owned by another instance. */
export async function getJobShared(id: string): Promise<AiJob | null> {
  const local = getJob(id);
  if (local || useMemoryStore) return local;
  await ensureJobsTable();
  const { rows } = await pool.query(
    `SELECT id, user_identifier, status, result, error, error_status, created_at, updated_at FROM ai_jobs WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  const updatedAt = new Date(row.updated_at).getTime();
  const stale = (row.status === 'pending' || row.status === 'running') && Date.now() - updatedAt > RUNNING_TIMEOUT_MS;
  return {
    id: row.id,
    userIdentifier: row.user_identifier,
    creditCost: 0,
    reservedAmount: 0,
    status: stale ? 'failed' : row.status,
    result: row.result ?? undefined,
    error: stale ? 'AI operation timed out' : row.error ?? undefined,
    errorStatus: stale ? 504 : row.error_status ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt,
  };
}

/** Active (pending/running) jobs for a user across all instances. */
export async function getActiveJobCountShared(userIdentifier: string): Promise<number> {
  const local = getActiveJobCount(userIdentifier);
  if (useMemoryStore) return local;
  await ensureJobsTable();
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM ai_jobs
     WHERE user_identifier = $1 AND status IN ('pending', 'running')
       AND updated_at > now() - ($2::bigint * interval '1 millisecond')`,
    [userIdentifier, RUNNING_TIMEOUT_MS],
  );
  return Math.max(local, rows[0]?.n ?? 0);
}

/** Asks the owning instance to cancel a job it is running. */
export async function requestRemoteCancel(id: string): Promise<void> {
  await ensureJobsTable();
  await pool.query(`UPDATE ai_jobs SET cancel_requested = true WHERE id = $1`, [id]);
}

// Owners poll for cancels requested on other instances, only while they run jobs.
// Old rows are cleaned every 10 minutes.
if (!useMemoryStore) {
  setInterval(async () => {
    try {
      const running = Array.from(jobs.values())
        .filter((j) => j.status === 'pending' || j.status === 'running')
        .map((j) => j.id);
      if (running.length > 0) {
        await ensureJobsTable();
        const { rows } = await pool.query(
          `SELECT id FROM ai_jobs WHERE cancel_requested AND id = ANY($1::text[])`,
          [running],
        );
        for (const { id } of rows) {
          const job = jobs.get(id);
          const result = cancelJob(id);
          if (result.ok && result.reservedAmount > 0 && job && releaseReservationCallback) {
            releaseReservationCallback(job.userIdentifier, result.reservedAmount);
          }
        }
      }
    } catch (error) {
      console.error('[aiJobStore] shared job sync failed:', error);
    }
  }, 2000).unref?.();

  setInterval(async () => {
    try {
      await ensureJobsTable();
      await pool.query(`DELETE FROM ai_jobs WHERE updated_at < now() - interval '1 day'`);
    } catch (error) {
      console.error('[aiJobStore] old job cleanup failed:', error);
    }
  }, 10 * 60 * 1000).unref?.();
}
