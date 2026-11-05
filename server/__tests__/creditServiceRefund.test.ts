import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const { captured } = vi.hoisted(() => ({ captured: [] as unknown[] }));
vi.mock('../db', () => ({
  db: { update: () => ({ set: (v: any) => { captured.push(v.credits); return { where: (w: unknown) => { captured.push(w); return Promise.resolve(); } }; } }) },
}));

import { creditService } from '../creditService';

describe('creditService.refundCredit', () => {
  it('caps the refunded balance at the tier allowance and only refunds if the daily reset has not run since the deduction', async () => {
    vi.spyOn(creditService as any, 'resolveDailyCredits').mockResolvedValue(150);
    const deductedAt = new Date('2026-11-03T10:00:00.000Z');
    await creditService.refundCredit('user:1', 1, deductedAt);
    const dialect = new PgDialect();
    const q = dialect.sqlToQuery(captured.pop() as any);
    expect(q.sql).toContain('"last_reset_at" <= ');
    expect(q.params).toEqual(expect.arrayContaining(['user:1', deductedAt.toISOString()]));
    const credits = dialect.sqlToQuery(captured.pop() as any);
    expect(credits.sql).toMatch(/^LEAST\(.*"credits" \+ \$1, GREATEST\(\$2::integer, .*"credits"\)\)$/);
    expect(credits.params).toEqual([1, 150]);
  });

  it('lets a balance above the tier allowance (a code bonus) get its credit back', async () => {
    vi.spyOn(creditService as any, 'resolveDailyCredits').mockResolvedValue(3);
    await creditService.refundCredit('user:1', 1, new Date(), true, 13);
    captured.pop();
    const credits = new PgDialect().sqlToQuery(captured.pop() as any);
    expect(credits.sql).toMatch(/^LEAST\(.*"credits" \+ \$1, GREATEST\(\$2::integer, .*"credits"\)\)$/);
    expect(credits.params).toEqual([1, 13]);
  });
});
