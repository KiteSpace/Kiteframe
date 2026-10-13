import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../creditService', () => ({
  creditService: { getUserIdentifier: (req: any) => req.headers['x-test-owner'] || 'navigation-tests' },
}));
import { postBackgroundAi } from '../backgroundAiRoute';
import { cancelJob, getJob, getActiveJobCount } from '../aiJobStore';

const servers: Server[] = [], jobs: string[] = [];
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
};
async function host(app: express.Express) {
  const server = app.listen(0, '127.0.0.1'); servers.push(server);
  await new Promise<void>(r => server.once('listening', r));
  return `http://127.0.0.1:${(server.address() as any).port}`;
}
afterEach(async () => {
  jobs.splice(0).forEach(id => cancelJob(id));
  await Promise.all(servers.splice(0).map(server => new Promise<void>(r => server.close(() => r()))));
});

describe('detached structured AI HTTP jobs', () => {
  it('returns 202 without cancelling the worker and retains the structured result', async () => {
    const app = express(); app.use(express.json());
    const gate = deferred();
    let admitted = 0, executed = 0;
    postBackgroundAi(app, '/action', (_req, _res, next) => { admitted++; next(); }, async (req, res) => {
      executed++; await gate.promise; res.json({ plan: { title: req.body.title } });
    });
    const base = await host(app);
    const accepted = await fetch(`${base}/action`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'X-AI-Background': '1' }, body: '{"title":"Original"}' });
    expect(accepted.status).toBe(202);
    const { jobId } = await accepted.json(); jobs.push(jobId);
    expect(getJob(jobId)?.status).toBe('running');
    gate.resolve();
    await vi.waitFor(() => expect(getJob(jobId)?.status).toBe('completed'));
    expect(getJob(jobId)?.result).toEqual({ text: '', payload: { plan: { title: 'Original' } } });
    expect(admitted).toBe(1); expect(executed).toBe(1);
    expect(getActiveJobCount('navigation-tests')).toBe(0);
  });

  it('propagates explicit cancellation upstream and rejects late completion', async () => {
    const app = express(); app.use(express.json());
    const gate = deferred();
    let workerSignal!: AbortSignal;
    postBackgroundAi(app, '/action', async (req, res) => {
      workerSignal = (req as any).aiOperationSignal;
      await gate.promise;
      res.json({ shouldNotAppear: true });
    });
    const base = await host(app);
    const accepted = await fetch(`${base}/action`, { method: 'POST', headers: { 'X-AI-Background': '1' } });
    const { jobId } = await accepted.json(); jobs.push(jobId);
    cancelJob(jobId);
    expect(workerSignal.aborted).toBe(true);
    gate.resolve(); await new Promise(r => setTimeout(r, 10));
    expect(getJob(jobId)?.status).toBe('cancelled');
    expect(getJob(jobId)?.result).toBeUndefined();
    expect(getActiveJobCount('navigation-tests')).toBe(0);
  });

  it('preserves legacy responses, middleware rejection, and structured failure status', async () => {
    const app = express(); app.use(express.json());
    postBackgroundAi(app, '/legacy', (_req, res) => { res.json({ legacy: true }); });
    postBackgroundAi(app, '/blocked', (_req, res) => { res.status(403).json({ error: 'No access' }); },
      () => { throw new Error('Must not execute'); });
    postBackgroundAi(app, '/failure', (_req, res) => { res.status(422).json({ error: 'Invalid result' }); });
    const base = await host(app);
    expect(await (await fetch(`${base}/legacy`, { method: 'POST' })).json()).toEqual({ legacy: true });
    expect((await fetch(`${base}/blocked`, { method: 'POST', headers: { 'X-AI-Background': '1' } })).status).toBe(403);
    const accepted = await fetch(`${base}/failure`, { method: 'POST', headers: { 'X-AI-Background': '1' } });
    const { jobId } = await accepted.json(); jobs.push(jobId);
    await vi.waitFor(() => expect(getJob(jobId)?.status).toBe('failed'));
    expect(getJob(jobId)).toMatchObject({ error: 'Invalid result', errorStatus: 422 });
  });
});
