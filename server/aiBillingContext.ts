/**
 * Per-request record of Claude calls, kept on `req.aiBilling` by `requireCredits` and passed explicitly
 * to every call site. Refunds depend on it: a request is refunded only if no Claude call completed.
 */
export interface AiBilling {
  attempted: boolean;
  completed: boolean;
  /** Start times of calls still waiting for Claude's response. */
  inFlight?: number[];
}

export function markAiAttempt(b: AiBilling | undefined): number {
  const started = Date.now();
  if (b) {
    b.attempted = true;
    (b.inFlight ||= []).push(started);
  }
  return started;
}

export function markAiSettled(b: AiBilling | undefined, started: number, completed: boolean): void {
  if (!b) return;
  const i = b.inFlight?.indexOf(started) ?? -1;
  if (i >= 0) b.inFlight!.splice(i, 1);
  if (completed) b.completed = true;
}

export function oldestInFlight(b: AiBilling | undefined): number | undefined {
  return b?.inFlight?.length ? Math.min(...b.inFlight) : undefined;
}

/** Messages API call for routes that call Anthropic directly; records the call on `req.aiBilling`. */
export async function anthropicFetch(req: { aiBilling?: AiBilling } | undefined, init: RequestInit): Promise<Response> {
  const b = req?.aiBilling;
  const started = markAiAttempt(b);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', init);
    markAiSettled(b, started, response.ok);
    return response;
  } catch (error) {
    markAiSettled(b, started, false);
    throw error;
  }
}
