/**
 * Navigation, display-primitive & selectable-card palette regression tests.
 *
 * Same shape as the overlay suite, for the same reason: a component missing
 * from any one of the ~8 registries does not error — it degrades silently to
 * AstryxUnknown, or (for the two cards) becomes a container the AI generates
 * but nothing can be dropped into. Every registry gets a guard here.
 *
 * The two pieces of real logic in this family — relative-time formatting and
 * the pagination page window — are pure functions, so they are unit-tested
 * directly rather than through the DOM.
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { ALLOWED_CRAFT_COMPONENTS, ALWAYS_CANVAS_COMPONENTS } from '../craftValidator';
import { DESIGN_SYSTEM_PROMPT_CLIENT } from '../../lib/designGeneration';
import {
  NAV_DISPLAY_DEFAULTS,
  formatRelativeTime,
  paginationPages,
} from '../../components/astryx/components';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const NAVIGATION = ['AstryxNavMenu', 'AstryxMobileNav', 'AstryxNavIcon', 'AstryxPagination', 'AstryxLink'];
const DISPLAY = ['AstryxTimestamp', 'AstryxIndicator', 'AstryxThumbnail', 'AstryxAvatarGroup'];
const CARDS = ['AstryxClickableCard', 'AstryxSelectableCard'];
const ALL_NEW = [...NAVIGATION, ...DISPLAY, ...CARDS];

describe('every new navigation/display component is registered everywhere', () => {
  it('appears in the client craft validator allow-list', () => {
    for (const name of ALL_NEW) expect(ALLOWED_CRAFT_COMPONENTS).toContain(name);
  });

  it('appears in the server craft validator allow-list', () => {
    const src = read('server/lib/designSchema.ts');
    for (const name of ALL_NEW) expect(src).toContain(`"${name}"`);
  });

  it('appears in the resolver map and has a craft config', () => {
    const src = read('client/src/design/resolver.tsx');
    for (const name of ALL_NEW) {
      expect(src, `${name} missing from resolver`).toContain(`(${name} as any).craft`);
      expect(src, `${name} missing displayName`).toContain(`displayName: "${name}"`);
    }
  });

  it('appears in the base component registry', () => {
    const src = read('client/src/components/astryx/components.tsx');
    for (const name of ALL_NEW) expect(src).toContain(`export function ${name}(`);
    for (const name of ALL_NEW) {
      const shortName = name.replace('Astryx', '');
      expect(src, `${name} missing its COMPONENT_REGISTRY entry`)
        .toMatch(new RegExp(`\\b${shortName}:\\s+${name},`));
    }
  });

  it('appears in the toolbox and the inspector', () => {
    const src = read('client/src/design/DesignEditor.tsx');
    for (const name of ALL_NEW) {
      expect(src, `${name} missing an inspector branch`).toContain(`displayName === "${name}"`);
      expect(src, `${name} missing a toolbox tile`).toContain(`NAV_DISPLAY_DEFAULTS.${name}`);
    }
  });

  it('appears in both copies of the AI prompt', () => {
    const server = read('server/lib/designPrompt.ts');
    for (const name of ALL_NEW) {
      expect(server, `${name} missing from the server prompt`).toContain(name);
      expect(DESIGN_SYSTEM_PROMPT_CLIENT, `${name} missing from the client prompt`).toContain(name);
    }
  });

  it('has a defaults entry backing every component', () => {
    for (const name of ALL_NEW) {
      expect(Object.keys(NAV_DISPLAY_DEFAULTS)).toContain(name);
    }
  });
});

describe('only the two cards are containers', () => {
  it('lists both cards in the client and server ALWAYS_CANVAS lists', () => {
    const serverSrc = read('server/lib/designSchema.ts');
    const serverList = serverSrc.slice(
      serverSrc.indexOf('export const ALWAYS_CANVAS_COMPONENTS'),
      serverSrc.indexOf('export const SERVER_ALLOWED_CRAFT_COMPONENTS'),
    );
    for (const name of CARDS) {
      expect(ALWAYS_CANVAS_COMPONENTS).toContain(name);
      expect(serverList, `${name} missing from the server ALWAYS_CANVAS list`).toContain(`"${name}"`);
    }
  });

  it('declares isCanvas:true in the craft config of both cards, and of nothing else here', () => {
    const src = read('client/src/design/resolver.tsx');
    for (const name of ALL_NEW) {
      const decl = `(${name} as any).craft = {`;
      const line = src.slice(src.indexOf(decl), src.indexOf(decl) + 200).split('\n')[0];
      if (CARDS.includes(name)) {
        expect(line, `${name} must declare isCanvas`).toContain('isCanvas: true');
        expect(line, `${name} must accept children`).toContain('canMoveIn: () => true');
      } else {
        expect(line, `${name} is a leaf and must refuse children`).toContain('canMoveIn: () => false');
        expect(line, `${name} is a leaf and must not be a canvas`).not.toContain('isCanvas');
      }
    }
  });

  it('describes both cards as containers in both prompt copies', () => {
    const server = read('server/lib/designPrompt.ts');
    for (const name of CARDS) {
      // The prompt's container sentence and the validator must agree, or the AI
      // emits isCanvas:false and the card renders none of its children.
      expect(server, `${name} missing from the server container list`)
        .toMatch(new RegExp(`Containers \\(isCanvas:true\\)[^\\n]*${name}`));
      expect(DESIGN_SYSTEM_PROMPT_CLIENT, `${name} missing from the client container list`)
        .toMatch(new RegExp(`CONTAINERS \\(isCanvas=true[^\\n]*${name}`));
    }
  });

  it('keeps the leaves out of the container lists', () => {
    for (const name of [...NAVIGATION, ...DISPLAY]) {
      expect(ALWAYS_CANVAS_COMPONENTS).not.toContain(name);
    }
  });
});

describe('nothing in this family escapes its own box', () => {
  const src = () => read('client/src/components/astryx/components.tsx');

  it('uses no position:fixed and no portal', () => {
    // The canvas pan/zoom transform becomes the containing block for fixed
    // descendants, so a fixed element lands somewhere unrelated on screen.
    const section = src().slice(src().indexOf('export const NAV_DISPLAY_DEFAULTS'));
    expect(section).not.toContain('position: "fixed"');
    expect(section).not.toContain('createPortal');
  });

  it('never disables pointer events inside a craft-connected subtree', () => {
    const resolverSrc = read('client/src/design/resolver.tsx');
    const section = resolverSrc.slice(resolverSrc.indexOf('// ─── Navigation, display primitives'));
    expect(section).not.toContain('pointerEvents: "none"');
    expect(section).not.toContain('pointer-events-none');
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-08-16T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('passes non-date text through verbatim, so a design can pin any wording', () => {
    expect(formatRelativeTime('2 hours ago', now)).toBe('2 hours ago');
    expect(formatRelativeTime('Last Tuesday', now)).toBe('Last Tuesday');
    expect(formatRelativeTime('', now)).toBe('');
    expect(formatRelativeTime(undefined, now)).toBe('');
  });

  it('renders a parseable date relative to the supplied instant', () => {
    expect(formatRelativeTime(ago(5_000), now)).toBe('just now');
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe('5 minutes ago');
    expect(formatRelativeTime(ago(60 * 60_000), now)).toBe('1 hour ago');
    expect(formatRelativeTime(ago(2 * 3600_000), now)).toBe('2 hours ago');
    expect(formatRelativeTime(ago(3 * 86_400_000), now)).toBe('3 days ago');
    expect(formatRelativeTime(ago(14 * 86_400_000), now)).toBe('2 weeks ago');
    expect(formatRelativeTime(ago(400 * 86_400_000), now)).toBe('1 year ago');
  });

  it('handles future dates', () => {
    expect(formatRelativeTime(new Date(now + 3 * 3600_000).toISOString(), now)).toBe('in 3 hours');
    expect(formatRelativeTime(new Date(now + 5_000).toISOString(), now)).toBe('in a moment');
  });

  it('is pure — same inputs, same output, and no dependence on the wall clock', () => {
    const value = ago(2 * 3600_000);
    expect(formatRelativeTime(value, now)).toBe(formatRelativeTime(value, now));
  });

  it('does not tick: the component reads the value once per render, no timer', () => {
    const componentsSrc = read('client/src/components/astryx/components.tsx');
    const section = componentsSrc.slice(componentsSrc.indexOf('export function AstryxTimestamp('));
    const body = section.slice(0, section.indexOf('export function AstryxIndicator('));
    expect(body).not.toContain('setInterval');
    expect(body).not.toContain('setTimeout');
  });
});

describe('paginationPages', () => {
  it('lists every page when the count is small enough to fit', () => {
    expect(paginationPages(5, 2)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationPages(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('elides the middle with a single window around the current page', () => {
    expect(paginationPages(20, 10)).toEqual([1, '…', 9, 10, 11, '…', 20]);
  });

  it('always shows the first and last page', () => {
    for (const current of [1, 5, 12, 20]) {
      const pages = paginationPages(20, current);
      expect(pages[0]).toBe(1);
      expect(pages[pages.length - 1]).toBe(20);
    }
  });

  it('drops the leading ellipsis near the start and the trailing one near the end', () => {
    expect(paginationPages(20, 2)).toEqual([1, 2, 3, '…', 20]);
    expect(paginationPages(20, 19)).toEqual([1, '…', 18, 19, 20]);
  });

  it('clamps nonsense input instead of rendering a broken control', () => {
    expect(paginationPages(0, 0)).toEqual([1]);
    expect(paginationPages(-4, 99)).toEqual([1]);
    expect(paginationPages(5, 99)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationPages('8', '3')).toEqual([1, 2, 3, 4, '…', 8]);
  });
});

describe('inspector fallbacks cannot drift from component defaults', () => {
  it('reads every fallback from NAV_DISPLAY_DEFAULTS', () => {
    // A fallback that differs from the component default silently deletes the
    // prop on the first inspector interaction — see inspector-default-drift.
    const src = read('client/src/design/DesignEditor.tsx');
    for (const name of ALL_NEW) {
      const start = src.indexOf(`displayName === "${name}"`);
      expect(start, `${name} has no inspector branch`).toBeGreaterThan(-1);
      const branch = src.slice(start, src.indexOf('</>\n  );', start));
      const fallbacks = branch.match(/\?\?\s*[^\s)]+/g) ?? [];
      for (const fallback of fallbacks) {
        expect(fallback, `${name} inspector fallback not sourced from defaults: ${fallback}`)
          .toMatch(/NAV_DISPLAY_DEFAULTS|props\./);
      }
    }
  });
});
