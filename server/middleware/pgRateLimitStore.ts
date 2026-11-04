import type { Store, Options, ClientRateLimitInfo } from 'express-rate-limit';
import { pool } from '../db';

// Shared rate-limit counters in Postgres so limits hold across server instances.
let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  tableReady ??= pool
    .query(
      `CREATE TABLE IF NOT EXISTS rate_limit_hits (
        key text PRIMARY KEY,
        hits integer NOT NULL,
        reset_at timestamptz NOT NULL
      )`,
    )
    .then(() => undefined)
    .catch((error: unknown) => {
      tableReady = null;
      throw error;
    });
  return tableReady!;
}

let cleanupTimer: ReturnType<typeof setInterval> | null = null;
function scheduleCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    pool.query(`DELETE FROM rate_limit_hits WHERE reset_at < now()`).catch(() => {});
  }, 10 * 60 * 1000);
  cleanupTimer.unref?.();
}

export class PgRateLimitStore implements Store {
  windowMs = 60_000;
  localKeys = false;

  constructor(public prefix: string) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
    scheduleCleanup();
  }

  private k(key: string) {
    return `${this.prefix}:${key}`;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    await ensureTable();
    const { rows } = await pool.query(
      `INSERT INTO rate_limit_hits (key, hits, reset_at)
       VALUES ($1, 1, now() + ($2::bigint * interval '1 millisecond'))
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN rate_limit_hits.reset_at <= now() THEN 1 ELSE rate_limit_hits.hits + 1 END,
         reset_at = CASE WHEN rate_limit_hits.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limit_hits.reset_at END
       RETURNING hits, reset_at`,
      [this.k(key), this.windowMs],
    );
    return { totalHits: Number(rows[0].hits), resetTime: new Date(rows[0].reset_at) };
  }

  async decrement(key: string): Promise<void> {
    await ensureTable();
    await pool.query(`UPDATE rate_limit_hits SET hits = GREATEST(hits - 1, 0) WHERE key = $1`, [this.k(key)]);
  }

  async resetKey(key: string): Promise<void> {
    await ensureTable();
    await pool.query(`DELETE FROM rate_limit_hits WHERE key = $1`, [this.k(key)]);
  }
}

// Tests run without a database, so they keep express-rate-limit's in-memory store.
export function pgStore(prefix: string): Store | undefined {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return undefined;
  return new PgRateLimitStore(prefix);
}
