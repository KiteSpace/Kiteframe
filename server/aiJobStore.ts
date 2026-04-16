import { randomUUID } from 'crypto';

export type AiJobStatus = 'pending' | 'running' | 'completed' | 'failed';

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
  status: AiJobStatus;
  result?: AiJobResult;
  error?: string;
  errorStatus?: number;
  createdAt: number;
  updatedAt: number;
}

const jobs = new Map<string, AiJob>();
const userActiveCount = new Map<string, number>();

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
  for (const [id, job] of jobs) {
    if ((job.status === 'completed' || job.status === 'failed') && now - job.updatedAt > COMPLETED_TTL_MS) {
      jobs.delete(id);
    } else if ((job.status === 'pending' || job.status === 'running') && now - job.updatedAt > RUNNING_TIMEOUT_MS) {
      job.status = 'failed';
      job.error = 'AI operation timed out';
      job.errorStatus = 504;
      job.updatedAt = now;
      decActive(job.userIdentifier);
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
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(id, job);
  userActiveCount.set(opts.userIdentifier, (userActiveCount.get(opts.userIdentifier) || 0) + 1);
  return job;
}

export function getJob(id: string): AiJob | null {
  return jobs.get(id) || null;
}

export function setJobRunning(id: string): void {
  const job = jobs.get(id);
  if (!job || job.status !== 'pending') return;
  job.status = 'running';
  job.updatedAt = Date.now();
}

export function completeJob(id: string, result: AiJobResult): void {
  const job = jobs.get(id);
  if (!job) return;
  const wasActive = job.status === 'pending' || job.status === 'running';
  job.status = 'completed';
  job.result = result;
  job.updatedAt = Date.now();
  if (wasActive) decActive(job.userIdentifier);
}

export function failJob(id: string, error: string, errorStatus: number = 500): void {
  const job = jobs.get(id);
  if (!job) return;
  const wasActive = job.status === 'pending' || job.status === 'running';
  job.status = 'failed';
  job.error = error;
  job.errorStatus = errorStatus;
  job.updatedAt = Date.now();
  if (wasActive) decActive(job.userIdentifier);
}
