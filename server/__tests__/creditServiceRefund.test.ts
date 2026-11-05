import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const { captured } = vi.hoisted(() => ({ captured: [] as unknown[] }));
vi.mock('../db', () => ({
  db: { update: () => ({ set: () => ({ where: (w: unknown) => { captured.push(w); return Promise.resolve(); } }) }) },
}));

import { creditService } from '../creditService';

describe('creditService.refundCredit', () => {
  it('only refunds if the daily reset has not run since the deduction', async () => {
    const deductedAt = new Date('2026-11-03T10:00:00.000Z');
    await creditService.refundCredit('user:1', 1, deductedAt);
    const q = new PgDialect().sqlToQuery(captured.pop() as any);
    expect(q.sql).toContain('"last_reset_at" <= ');
    expect(q.params).toEqual(expect.arrayContaining(['user:1', deductedAt.toISOString()]));
  });
});
