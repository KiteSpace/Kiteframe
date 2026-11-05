import { describe, it, expect } from 'vitest';
import { findFreeRect, resolveMockSource, nodeRect, decodeSvgDataUrl, encodeSvgDataUrl, withId, withoutId } from '../mockPlacement';

const n = (id: string, x: number, y: number, w = 200, h = 100, data: any = {}) => ({ id, position: { x, y }, width: w, height: h, data });
const size = { width: 400, height: 340 };
const overlaps = (a: any, b: any) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

describe('findFreeRect', () => {
  it('places below the source when free', () => {
    const src = n('a', 0, 0);
    expect(findFreeRect([src, n('b', 300, 0)], src, size)).toEqual({ x: 0, y: 148 });
  });
  it('never overlaps nodes in a horizontal workflow, including the next step', () => {
    const nodes: any[] = Array.from({ length: 6 }, (_, i) => n(`s${i}`, i * 260, 0));
    for (let i = 0; i < 4; i++) {
      const pos = findFreeRect(nodes, nodes[i], size);
      const r = { ...pos, ...size };
      for (const other of nodes) expect(overlaps(r, nodeRect(other))).toBe(false);
      nodes.push(n(`m${i}`, pos.x, pos.y, size.width, size.height));
    }
  });
  it('falls back to a free column right of everything when boxed in', () => {
    const src = n('a', 500, 500);
    const blockers = [n('t', 0, 0, 1400, 480), n('b', 0, 620, 1400, 500), n('l', 0, 480, 480, 140), n('r', 720, 480, 680, 140)];
    const pos = findFreeRect([src, ...blockers], src, size);
    const r = { ...pos, ...size };
    for (const o of [src, ...blockers]) expect(overlaps(r, nodeRect(o))).toBe(false);
  });
});

describe('resolveMockSource', () => {
  it('follows the mockup edge back to the original step', () => {
    const nodes = [n('step', 0, 0, 200, 100, { label: 'Verify email', description: 'Check inbox' }), n('mock', 0, 200, 400, 340, { label: 'Verify email Mockup' })];
    (nodes[0] as any).type = 'process';
    expect(resolveMockSource(nodes, [{ source: 'step', target: 'mock', label: 'mockup' }], 'mock'))
      .toEqual({ label: 'Verify email', description: 'Check inbox', nodeType: 'process' });
  });
  it('strips the Mockup suffix when the edge is gone', () => {
    expect(resolveMockSource([n('mock', 0, 0, 1, 1, { label: 'Verify email Mockup' })], [], 'mock').label).toBe('Verify email');
  });
});

describe('svg data urls and id sets', () => {
  it('round-trips non-ASCII SVG', () => {
    const svg = '<svg viewBox="0 0 400 300"><text>Café ✓</text></svg>';
    expect(decodeSvgDataUrl(encodeSvgDataUrl(svg))).toBe(svg);
    expect(decodeSvgDataUrl('data:image/png;base64,AAAA')).toBeNull();
  });
  it('adds and removes ids without duplicates', () => {
    expect(withId(withId([], 'a'), 'a')).toEqual(['a']);
    expect(withoutId(['a', 'b'], 'a')).toEqual(['b']);
  });
});
