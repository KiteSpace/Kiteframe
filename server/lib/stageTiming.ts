import { randomUUID } from 'crypto';

export interface StageEntry {
  evt: 'ai_stage';
  feature: string;
  requestId: string;
  stage: string;
  ms: number;
  totalMs: number;
  [key: string]: unknown;
}

/** Structured per-stage timing logs: each mark() records time since the previous mark. */
export function createStageTimer(
  feature: string,
  requestId: string = randomUUID().slice(0, 8),
  log: (line: string) => void = (line) => console.log(line),
  now: () => number = Date.now,
) {
  const start = now();
  let last = start;
  return {
    requestId,
    mark(stage: string, extra: Record<string, unknown> = {}): StageEntry {
      const t = now();
      const entry: StageEntry = { evt: 'ai_stage', feature, requestId, stage, ms: t - last, totalMs: t - start, ...extra };
      last = t;
      log(JSON.stringify(entry));
      return entry;
    },
  };
}
