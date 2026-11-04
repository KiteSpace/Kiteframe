import { describe, it, expect } from 'vitest';
import { buildWireframePrompt, validateWireframeSvg, fallbackWireframeSvg } from '../lib/wireframe';
import { createStageTimer } from '../lib/stageTiming';

const good = '<svg viewBox="0 0 400 300"><rect x="10" y="10" width="380" height="280" fill="#f5f5f5"/><text x="20" y="40">Sign up</text></svg>';

describe('validateWireframeSvg', () => {
  it('accepts a valid wireframe and adds the namespace', () => {
    const r = validateWireframeSvg(`Here you go:\n${good}\nThanks`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
  it('rejects truncated output', () => {
    expect(validateWireframeSvg('<svg viewBox="0 0 400 300"><g><rect width="1"/></svg>').ok).toBe(false);
    expect(validateWireframeSvg('<svg viewBox="0 0 400 300"><rect').ok).toBe(false);
  });
  it('rejects scripts, foreignObject, event handlers and external refs', () => {
    expect(validateWireframeSvg('<svg viewBox="0 0 400 300"><script>alert(1)</script></svg>').ok).toBe(false);
    expect(validateWireframeSvg('<svg viewBox="0 0 400 300"><foreignObject></foreignObject></svg>').ok).toBe(false);
    expect(validateWireframeSvg('<svg viewBox="0 0 400 300"><rect onclick="x()"/></svg>').ok).toBe(false);
    expect(validateWireframeSvg('<svg viewBox="0 0 400 300"><rect fill="url(http://x)"/></svg>').ok).toBe(false);
    expect(validateWireframeSvg('<svg viewBox="0 0 400 300"><image href="http://x"/></svg>').ok).toBe(false);
  });
  it('rejects the wrong viewBox', () => {
    expect(validateWireframeSvg('<svg viewBox="0 0 800 600"><rect/></svg>').ok).toBe(false);
    expect(validateWireframeSvg('<svg><rect/></svg>').ok).toBe(false);
  });
  it('fallback is itself valid and escapes the label', () => {
    const svg = fallbackWireframeSvg('<b>"Sign" & up</b>');
    expect(validateWireframeSvg(svg).ok).toBe(true);
    expect(svg).not.toContain('<b>');
  });
});

describe('buildWireframePrompt', () => {
  it('includes the current SVG and original step when refining', () => {
    const p = buildWireframePrompt({ label: 'Verify email', description: 'd', nodeType: 'process', refinementPrompt: 'add a resend link', currentSvg: good });
    expect(p).toContain(good);
    expect(p).toContain('"Verify email"');
    expect(p).toContain('add a resend link');
    expect(p).not.toContain('Verify email Mockup');
  });
  it('first generation has no current SVG block', () => {
    expect(buildWireframePrompt({ label: 'A', description: '', nodeType: 'process' })).not.toContain('<current_svg>');
  });
});

describe('createStageTimer', () => {
  it('records time since the previous mark', () => {
    let t = 1000;
    const lines: string[] = [];
    const timer = createStageTimer('wireframe', 'req1', (l) => lines.push(l), () => t);
    t = 1100; timer.mark('a');
    t = 1350; const e = timer.mark('b', { tokensOut: 5 });
    expect(e).toMatchObject({ evt: 'ai_stage', feature: 'wireframe', requestId: 'req1', stage: 'b', ms: 250, totalMs: 350, tokensOut: 5 });
    expect(JSON.parse(lines[0]).ms).toBe(100);
  });
});
