import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { refundCredit } = vi.hoisted(() => ({ refundCredit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../db', () => ({ db: {} }));
vi.mock('../creditService', () => ({
  creditService: { refundCredit, getUserIdentifier: () => 'user:1' },
  getCreditCost: () => 1,
}));

import { refundDeductedCredit } from '../middleware/creditCheck';

describe('refundDeductedCredit', () => {
  beforeEach(() => refundCredit.mockClear());

  it('refunds the deducted cost once', async () => {
    const req: any = { creditDeducted: { userIdentifier: 'user:1', remainingCredits: 4, creditCost: 1 } };
    await refundDeductedCredit(req);
    await refundDeductedCredit(req);
    expect(refundCredit).toHaveBeenCalledTimes(1);
    expect(refundCredit).toHaveBeenCalledWith('user:1', 1);
  });

  it('skips requests with nothing deducted, zero cost or unlimited credits', async () => {
    await refundDeductedCredit({} as any);
    await refundDeductedCredit({ creditDeducted: { userIdentifier: 'u', remainingCredits: 3, creditCost: 0 } } as any);
    await refundDeductedCredit({ creditDeducted: { userIdentifier: 'u', remainingCredits: 999999, creditCost: 1 } } as any);
    expect(refundCredit).not.toHaveBeenCalled();
  });
});

describe('postBackgroundAi refunds', () => {
  it('refunds when the wrapped handler fails, not when it succeeds', async () => {
    vi.resetModules();
    const refund = vi.fn();
    vi.doMock('../middleware/creditCheck', () => ({ refundDeductedCredit: refund }));
    vi.doMock('../aiJobStore', () => ({
      createJob: () => ({ id: 'job-1' }),
      attachJobAbortController: vi.fn(),
      setJobRunning: vi.fn(),
      tryFinalizeSuccess: vi.fn(),
      tryFinalizeFailure: vi.fn(),
      cancelJob: vi.fn(),
      getActiveJobCount: () => 0,
      getActiveJobCountShared: vi.fn().mockResolvedValue(0),
      MAX_CONCURRENT_JOBS_PER_USER: 3,
    }));
    const { postBackgroundAi } = await import('../backgroundAiRoute');
    const routes: Record<string, any[]> = {};
    const app: any = { post: (path: string, ...handlers: any[]) => { routes[path] = handlers; } };
    postBackgroundAi(app, '/fail', async (_req: any, res: any) => { res.status(502).json({ error: 'bad' }); });
    postBackgroundAi(app, '/ok', async (_req: any, res: any) => { res.json({ ok: true }); });

    const run = async (path: string) => {
      const req: any = { get: (h: string) => (h === 'X-AI-Background' ? '1' : undefined), headers: { 'x-ai-background': '1' }, body: {} };
      const res: any = Object.assign(new EventEmitter(), {
        statusCode: 200,
        status(c: number) { res.statusCode = c; return res; },
        json() { return res; },
        setHeader() {},
      });
      const handlers = routes[path];
      for (const h of handlers) await new Promise<void>((resolve) => { const r = h(req, res, () => resolve()); Promise.resolve(r).then(() => resolve()); });
      await new Promise((r) => setTimeout(r, 10));
      return req;
    };
    const failedReq = await run('/fail');
    expect(refund).toHaveBeenCalledWith(failedReq);
    refund.mockClear();
    await run('/ok');
    expect(refund).not.toHaveBeenCalled();
  });
});
