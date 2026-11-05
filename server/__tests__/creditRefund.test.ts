import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { refundCredit } = vi.hoisted(() => ({ refundCredit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../db', () => ({ db: {} }));
vi.mock('../creditService', () => ({
  creditService: { refundCredit, getUserIdentifier: () => 'user:1' },
  getCreditCost: () => 1,
}));

import { CANCEL_REFUND_WINDOW_MS, MAX_CANCEL_REFUNDS_PER_DAY, refundDeductedCredit } from '../middleware/creditCheck';

describe('refundDeductedCredit', () => {
  beforeEach(() => refundCredit.mockClear());
  const deducted = (extra: object = {}) => ({ userIdentifier: 'user:1', remainingCredits: 4, creditCost: 1, deductedAt: new Date(0), isAuthenticated: true, ...extra });

  it('refunds once when Claude was called and never returned a response', async () => {
    const req: any = { creditDeducted: deducted(), aiBilling: { attempted: true, completed: false } };
    await refundDeductedCredit(req);
    await refundDeductedCredit(req);
    expect(refundCredit).toHaveBeenCalledTimes(1);
    expect(refundCredit).toHaveBeenCalledWith('user:1', 1, new Date(0), true);
  });

  it('keeps the charge when Claude replied and we rejected the output, or the cancel came after the reply', async () => {
    await refundDeductedCredit({ creditDeducted: deducted(), aiBilling: { attempted: true, completed: true } } as any);
    await refundDeductedCredit({ creditDeducted: deducted(), aiBilling: { attempted: true, completed: true } } as any, { cancelled: true });
    expect(refundCredit).not.toHaveBeenCalled();
  });

  it('refunds a cancel before any model call, but not a plain error before one', async () => {
    await refundDeductedCredit({ creditDeducted: deducted(), aiBilling: { attempted: false, completed: false } } as any);
    expect(refundCredit).not.toHaveBeenCalled();
    await refundDeductedCredit({ creditDeducted: deducted(), aiBilling: { attempted: false, completed: false } } as any, { cancelled: true });
    expect(refundCredit).toHaveBeenCalledTimes(1);
  });

  it('refunds a Stop only while the Claude call in flight is younger than the window', async () => {
    const now = Date.now();
    const pending = () => ({ attempted: true, completed: false });
    await refundDeductedCredit({ creditDeducted: deducted({ userIdentifier: 'user:late' }), aiBilling: pending() } as any,
      { cancelled: true, cancelledAt: now, inFlightSince: now - CANCEL_REFUND_WINDOW_MS });
    expect(refundCredit).not.toHaveBeenCalled();
    await refundDeductedCredit({ creditDeducted: deducted({ userIdentifier: 'user:early' }), aiBilling: pending() } as any,
      { cancelled: true, cancelledAt: now, inFlightSince: now - 5_000 });
    expect(refundCredit).toHaveBeenCalledTimes(1);
  });

  it('caps Stop refunds per user per day, but not refunds for failed calls', async () => {
    for (let i = 0; i < MAX_CANCEL_REFUNDS_PER_DAY + 2; i++) {
      await refundDeductedCredit({ creditDeducted: deducted({ userIdentifier: 'user:stopper' }), aiBilling: { attempted: false, completed: false } } as any, { cancelled: true });
    }
    expect(refundCredit).toHaveBeenCalledTimes(MAX_CANCEL_REFUNDS_PER_DAY);
    await refundDeductedCredit({ creditDeducted: deducted({ userIdentifier: 'user:stopper' }), aiBilling: { attempted: true, completed: false } } as any);
    expect(refundCredit).toHaveBeenCalledTimes(MAX_CANCEL_REFUNDS_PER_DAY + 1);
  });

  it('skips requests with nothing deducted, zero cost, unlimited credits or no billing state', async () => {
    const billing = { attempted: true, completed: false };
    await refundDeductedCredit({ aiBilling: billing } as any);
    await refundDeductedCredit({ creditDeducted: deducted({ creditCost: 0 }), aiBilling: billing } as any);
    await refundDeductedCredit({ creditDeducted: deducted({ remainingCredits: 999999 }), aiBilling: billing } as any);
    await refundDeductedCredit({ creditDeducted: deducted() } as any);
    expect(refundCredit).not.toHaveBeenCalled();
  });
});

describe('postBackgroundAi refunds', () => {
  it('refunds when the wrapped handler fails, not when it succeeds', async () => {
    vi.resetModules();
    const refund = vi.fn();
    const controllers: AbortController[] = [];
    vi.doMock('../middleware/creditCheck', () => ({ refundDeductedCredit: refund }));
    vi.doMock('../aiJobStore', () => ({
      createJob: () => ({ id: 'job-1' }),
      attachJobAbortController: (_id: string, c: AbortController) => { controllers.push(c); },
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
    let finishSlow!: () => void;
    postBackgroundAi(app, '/slow', async () => { await new Promise<void>((r) => { finishSlow = r; }); });

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

    const slowReq = await run('/slow');
    controllers[controllers.length - 1].abort();
    await new Promise((r) => setTimeout(r, 10));
    expect(refund).not.toHaveBeenCalled();
    finishSlow();
    await new Promise((r) => setTimeout(r, 10));
    expect(refund).toHaveBeenCalledWith(slowReq, expect.objectContaining({ cancelled: true }));
  });
});
