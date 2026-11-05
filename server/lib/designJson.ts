/** Pure helpers for design model responses (no server imports, safe for scripts). */

export type DesignJsonResult =
  | { ok: true; value: any }
  | { ok: false; error: 'incomplete' | 'invalid' };

/** Index of the bracket that closes the object opened at `start`, skipping string contents; -1 if never closed. */
function findBalancedEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Parses a design model response. With prefill the model's text continues after
 * an injected '{'; without it the text may carry code fences or stray prose.
 */
export function parseDesignJson(text: string, prefilled: boolean): DesignJsonResult {
  const raw = (prefilled ? '{' + text : text)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return { ok: false, error: 'incomplete' };
  const balancedEnd = findBalancedEnd(raw, start);
  if (balancedEnd !== -1) {
    try { return { ok: true, value: JSON.parse(raw.slice(start, balancedEnd + 1)) }; } catch { /* fall back */ }
  }
  const body = raw.slice(start, end + 1);
  try { return { ok: true, value: JSON.parse(body) }; } catch { /* try repair */ }
  try { return { ok: true, value: JSON.parse(body.replace(/,(\s*[}\]])/g, '$1')) }; } catch { /* invalid */ }
  return { ok: false, error: 'invalid' };
}

export interface DesignModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export function readUsage(json: any): DesignModelUsage {
  const u = json?.usage || {};
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    inputTokens: n(u.input_tokens),
    outputTokens: n(u.output_tokens),
    cacheReadTokens: n(u.cache_read_input_tokens),
    cacheCreationTokens: n(u.cache_creation_input_tokens),
  };
}
