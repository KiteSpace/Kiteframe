/**
 * Mock-generation eval: runs the prompts in server/__tests__/fixtures/design-prompts
 * against Anthropic and reports validity, latency and tokens per prompt.
 *
 *   (from the repo root) ANTHROPIC_API_KEY=... npm run eval:mocks -- [--kind wireframe|design] [--limit N] [--v2] [--out file.json]
 *
 * --v2 runs the design prompts the way flag design_ai_v2 does: current model, no prefill,
 * cached system prompt. Only imports pure modules so it never boots the server.
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { buildWireframePrompt, validateWireframeSvg, WIREFRAME_SYSTEM_PROMPT } from '../server/lib/wireframe';
import { DESIGN_SYSTEM_PROMPT } from '../server/lib/designPrompt';
import { parseDesignJson, readUsage } from '../server/lib/designJson';

const JSON_ONLY = 'Respond with only the JSON object described above: no prose before or after it and no markdown code fences.';
const LEGACY_MODEL = 'claude-sonnet-4-5-20250929';
const V2_MODEL = 'claude-sonnet-5-5';

type Fixture =
  | { id: string; kind: 'wireframe'; label: string; nodeType: string; description: string }
  | { id: string; kind: 'design'; prompt: string };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function callClaude(body: Record<string, unknown>) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${json?.error?.message ?? 'error'}`);
  const text = (json.content || []).filter((b: any) => b?.type === 'text').map((b: any) => b.text || '').join('');
  return { text, json };
}

async function runOne(f: Fixture, v2: boolean) {
  const t = Date.now();
  if (f.kind === 'wireframe') {
    const { text, json } = await callClaude({
      model: LEGACY_MODEL,
      max_tokens: 4000,
      temperature: 0.2,
      system: WIREFRAME_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildWireframePrompt({ label: f.label, nodeType: f.nodeType, description: f.description }) }],
    });
    const v = validateWireframeSvg(text);
    return { id: f.id, kind: f.kind, ok: v.ok, reason: v.ok ? undefined : v.error, stop: json.stop_reason, ms: Date.now() - t, ...readUsage(json) };
  }
  const prefill = !v2;
  const { text, json } = await callClaude({
    model: v2 ? V2_MODEL : LEGACY_MODEL,
    max_tokens: 12000,
    system: v2
      ? [{ type: 'text', text: DESIGN_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }, { type: 'text', text: JSON_ONLY }]
      : DESIGN_SYSTEM_PROMPT,
    messages: prefill
      ? [{ role: 'user', content: f.prompt }, { role: 'assistant', content: '{' }]
      : [{ role: 'user', content: f.prompt }],
  });
  const parsed = parseDesignJson(text, prefill);
  const craft = parsed.ok ? parsed.value?.craftState : undefined;
  const nodes = craft && typeof craft === 'object' ? Object.keys(craft).length : typeof craft === 'string' ? Object.keys(JSON.parse(craft)).length : 0;
  const ok = parsed.ok && json.stop_reason !== 'max_tokens' && (parsed.value?.type !== 'state' || nodes > 1);
  return { id: f.id, kind: f.kind, ok, reason: parsed.ok ? undefined : parsed.error, stop: json.stop_reason, ms: Date.now() - t, nodes, ...readUsage(json) };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required');
  const v2 = process.argv.includes('--v2');
  const kind = arg('kind');
  const limit = Number(arg('limit') ?? Infinity);
  const all: Fixture[] = JSON.parse(readFileSync(path.resolve(process.cwd(), 'server/__tests__/fixtures/design-prompts/prompts.json'), 'utf8'));
  const byKind = (k: string) => all.filter((f) => f.kind === k).slice(0, limit);
  const fixtures = kind ? byKind(kind) : [...byKind('wireframe'), ...byKind('design')];
  const results = [];
  for (const f of fixtures) {
    try {
      const r = await runOne(f, v2);
      results.push(r);
      console.log(JSON.stringify(r));
    } catch (e: any) {
      results.push({ id: f.id, kind: f.kind, ok: false, reason: String(e?.message ?? e).slice(0, 200) });
      console.log(JSON.stringify(results[results.length - 1]));
    }
  }
  for (const k of ['wireframe', 'design']) {
    const rs: any[] = results.filter((r) => r.kind === k);
    if (!rs.length) continue;
    const ms = rs.filter((r) => r.ms).map((r) => r.ms).sort((a, b) => a - b);
    const p = (q: number) => ms[Math.min(ms.length - 1, Math.floor(q * ms.length))] ?? 0;
    console.log(`${k}${k === 'design' && v2 ? ' (v2)' : ''}: ${rs.filter((r) => r.ok).length}/${rs.length} valid, p50 ${(p(0.5) / 1000).toFixed(1)}s, p90 ${(p(0.9) / 1000).toFixed(1)}s, ` +
      `out tokens ${rs.reduce((n, r) => n + (r.outputTokens || 0), 0)}, cache read ${rs.reduce((n, r) => n + (r.cacheReadTokens || 0), 0)}`);
  }
  const out = arg('out');
  if (out) writeFileSync(out, JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
