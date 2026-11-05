import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Runs refundCredit's real SQL on Postgres (a temp table shadows user_credits). Needs DATABASE_URL; skipped without it.
vi.mock('../db', async () => {
  if (!process.env.DATABASE_URL) return { db: {}, client: null };
  const pg = (await import('pg')).default;
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`CREATE TEMP TABLE user_credits (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_identifier varchar NOT NULL UNIQUE,
    credits integer NOT NULL, is_unlimited boolean DEFAULT false, last_reset_at timestamp, created_at timestamp DEFAULT now(), updated_at timestamp)`);
  return { db: drizzle(client), client };
});

import * as dbModule from '../db';
import { creditService } from '../creditService';

const client = (dbModule as any).client;
const CAP = 3;
const resetAt = new Date('2026-11-03T00:00:00Z');
const chargedAt = new Date('2026-11-03T10:00:00Z');
const setBalance = (credits: number) => client.query('UPDATE user_credits SET credits = $1 WHERE user_identifier = $2', [credits, 'user:1']);
const balance = async () => (await client.query('SELECT credits FROM user_credits WHERE user_identifier = $1', ['user:1'])).rows[0].credits;

describe.skipIf(!process.env.DATABASE_URL)('creditService.refundCredit on Postgres', () => {
  beforeEach(async () => {
    vi.spyOn(creditService as any, 'resolveDailyCredits').mockResolvedValue(CAP);
    await client.query('DELETE FROM user_credits');
    await client.query('INSERT INTO user_credits (user_identifier, credits, last_reset_at) VALUES ($1, $2, $3)', ['user:1', CAP, resetAt]);
  });
  afterAll(async () => { await client?.end(); });

  it('never lowers a balance topped up by a code after the charge', async () => {
    await setBalance(CAP - 1); // charged 1
    await setBalance(CAP - 1 + 10); // redeemed +10
    await creditService.refundCredit('user:1', 1, chargedAt, true, CAP);
    expect(await balance()).toBe(CAP - 1 + 10);
  });

  it('gives a bonus balance above the cap its credit back', async () => {
    await setBalance(13 - 1);
    await creditService.refundCredit('user:1', 1, chargedAt, true, 13);
    expect(await balance()).toBe(13);
  });

  it('never lifts a normal balance above the cap', async () => {
    await creditService.refundCredit('user:1', 1, chargedAt, true, CAP); // e.g. a duplicate refund
    expect(await balance()).toBe(CAP);
  });

  it('skips the refund if the daily reset ran after the charge', async () => {
    await setBalance(CAP - 1);
    await creditService.refundCredit('user:1', 1, new Date(resetAt.getTime() - 60_000), true, CAP);
    expect(await balance()).toBe(CAP - 1);
  });
});
