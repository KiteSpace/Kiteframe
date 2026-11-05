import express from 'express';
import multer from 'multer';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { refundCredit, deductCreditAtomic } = vi.hoisted(() => ({
  refundCredit: vi.fn().mockResolvedValue(undefined),
  deductCreditAtomic: vi.fn().mockResolvedValue({ success: true, remainingCredits: 4 }),
}));
vi.mock('../db', () => {
  const chain: any = new Proxy(function () {}, {
    get: (_t, prop) => (prop === 'then' ? (resolve: (v: unknown) => void) => resolve([]) : chain),
    apply: () => chain,
  });
  return { db: chain };
});
vi.mock('../creditService', () => ({
  creditService: {
    refundCredit,
    deductCreditAtomic,
    getUserIdentifier: () => 'user:u1',
    isAuthenticatedUser: () => true,
    getOrCreateUserCredits: vi.fn().mockResolvedValue({}),
  },
  getCreditCost: () => 1,
}));

import { anthropicFetch } from '../aiBillingContext';
import { requireCredits } from '../middleware/creditCheck';

// Same order as /api/ai/analyze-workflow-image: credits are taken before the upload middleware runs.
const app = express();
app.use((req: any, _res, next) => { req.user = { id: 'u1' }; next(); });
app.post('/analyze', requireCredits, multer({ storage: multer.memoryStorage() }).single('image'), async (req: any, res) => {
  const response = await anthropicFetch(req, { method: 'POST', body: '{}' });
  if (!response.ok) { res.status(502).json({ error: 'AI service error' }); return; }
  res.status(req.body.reject ? 422 : 200).json({ ok: true });
});

const post = (fields: Record<string, string> = {}) => {
  let r = request(app).post('/analyze').attach('image', Buffer.from('png'), 'a.png');
  for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
  return r;
};
const settle = () => new Promise((r) => setTimeout(r, 20));

describe('requireCredits → upload middleware → direct Anthropic call → refund', () => {
  beforeEach(() => { refundCredit.mockClear(); deductCreditAtomic.mockClear(); });
  afterEach(() => vi.unstubAllGlobals());

  it('refunds when Claude returns a 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 529 })));
    expect((await post()).status).toBe(502);
    await settle();
    expect(deductCreditAtomic).toHaveBeenCalledTimes(1);
    expect(refundCredit).toHaveBeenCalledWith('user:u1', 1, expect.any(Date), true);
  });

  it('keeps the charge when Claude replied and the route rejected the result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
    expect((await post({ reject: '1' })).status).toBe(422);
    await settle();
    expect(refundCredit).not.toHaveBeenCalled();
  });
});
