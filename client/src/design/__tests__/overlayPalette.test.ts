/**
 * Overlay & menu palette regression tests.
 *
 * The overlay family is the one group in this palette where the *design-time*
 * behaviour, not the visual, is the thing that breaks. Three failure modes have
 * bitten this codebase before and each has a guard here:
 *
 *   1. A component missing from one of the ~8 registries degrades silently to
 *      AstryxUnknown instead of erroring. Checked against every registry.
 *   2. An overlay that portals or uses `position: fixed` escapes its artboard,
 *      because the canvas pan/zoom transform becomes the containing block for
 *      fixed descendants. Checked as a source-level guard — the geometric proof
 *      lives in scripts/e2e-overlays-and-menus.mjs, which needs real layout.
 *   3. `pointer-events: none` anywhere in a craft-connected subtree silently
 *      kills selection and drag-drop. Also a source-level guard.
 *
 * Plus the menu item mini-syntax, which is the one piece of parsing here.
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { ALLOWED_CRAFT_COMPONENTS, ALWAYS_CANVAS_COMPONENTS } from '../craftValidator';
import { DESIGN_SYSTEM_PROMPT_CLIENT } from '../../lib/designGeneration';
import { parseMenuItems, OVERLAY_DEFAULTS } from '../../components/astryx/components';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const ANCHORED_OVERLAYS = ['AstryxPopover', 'AstryxTooltip', 'AstryxHoverCard'];
const MENUS = ['AstryxDropdownMenu', 'AstryxContextMenu', 'AstryxMoreMenu'];
const SURFACES = ['AstryxAlertDialog', 'AstryxToast', 'AstryxLightbox', 'AstryxOverlay'];
const NEW_OVERLAYS = [...ANCHORED_OVERLAYS, ...MENUS, ...SURFACES];

describe('every new overlay is registered everywhere', () => {
  it('appears in the client craft validator allow-list', () => {
    for (const name of NEW_OVERLAYS) expect(ALLOWED_CRAFT_COMPONENTS).toContain(name);
  });

  it('appears in the server craft validator allow-list', () => {
    const src = read('server/lib/designSchema.ts');
    for (const name of NEW_OVERLAYS) expect(src).toContain(`"${name}"`);
  });

  it('appears in the resolver map and has a craft config', () => {
    const src = read('client/src/design/resolver.tsx');
    for (const name of NEW_OVERLAYS) {
      expect(src, `${name} missing from resolver`).toContain(`(${name} as any).craft`);
      expect(src, `${name} missing displayName`).toContain(`displayName: "${name}"`);
    }
  });

  it('appears in the base component registry', () => {
    const src = read('client/src/components/astryx/components.tsx');
    for (const name of NEW_OVERLAYS) expect(src).toContain(`export function ${name}(`);
  });

  it('appears in the toolbox and the inspector', () => {
    const src = read('client/src/design/DesignEditor.tsx');
    for (const name of NEW_OVERLAYS) {
      expect(src, `${name} has no inspector rows`).toContain(`displayName === "${name}"`);
      // Leaves are dropped as <AstryxX …/>, containers as <Element canvas is={AstryxX} …/>.
      expect(src, `${name} has no toolbox tile`).toMatch(
        new RegExp(`<${name}\\s|is=\\{${name}\\}`),
      );
      expect(src, `${name} tile does not drop its full default prop set`)
        .toContain(`{...OVERLAY_DEFAULTS.${name}}`);
    }
  });

  it('is documented in both copies of the AI prompt', () => {
    const server = read('server/lib/designPrompt.ts');
    for (const name of NEW_OVERLAYS) {
      expect(DESIGN_SYSTEM_PROMPT_CLIENT, `${name} missing from client prompt`).toContain(name);
      expect(server, `${name} missing from server prompt`).toContain(name);
    }
  });
});

describe('only AstryxOverlay is a container', () => {
  it('is in the always-canvas list on both client and server', () => {
    expect(ALWAYS_CANVAS_COMPONENTS).toContain('AstryxOverlay');
    expect(read('server/lib/designSchema.ts')).toMatch(/ALWAYS_CANVAS_COMPONENTS[\s\S]*?"AstryxOverlay"/);
  });

  it('declares isCanvas in its own craft config', () => {
    const src = read('client/src/design/resolver.tsx');
    expect(src).toMatch(/\(AstryxOverlay as any\)\.craft = \{[^}]*isCanvas: true/);
  });

  it('leaves the other nine as leaves', () => {
    const src = read('client/src/design/resolver.tsx');
    for (const name of NEW_OVERLAYS.filter((n) => n !== 'AstryxOverlay')) {
      const config = src.match(new RegExp(`\\(${name} as any\\)\\.craft = \\{[^\\n]*`))?.[0] ?? '';
      expect(config, `${name} should be a leaf`).not.toContain('isCanvas: true');
      expect(config, `${name} should refuse children`).toContain('canMoveIn: () => false');
      expect(ALWAYS_CANVAS_COMPONENTS).not.toContain(name);
    }
  });

  it('agrees with both prompt copies about which overlay is a container', () => {
    const server = read('server/lib/designPrompt.ts');
    expect(server).toMatch(/Containers \(isCanvas:true\)[^\n]*AstryxOverlay/);
    expect(DESIGN_SYSTEM_PROMPT_CLIENT).toMatch(/CONTAINERS \(isCanvas=true[^\n]*AstryxOverlay/);
  });
});

describe('overlays render inline, never portalled or fixed', () => {
  // The geometric proof needs a browser; this is the cheap structural guard that
  // catches the mistake being reintroduced in source.
  // Comments in this section *describe* the mistakes being guarded against
  // ("a real library portals to document.body…"), so they have to come out
  // before scanning or the guard trips on its own explanation.
  const stripComments = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');

  const section = (rel: string, startMarker: string, endMarker: string) => {
    const src = read(rel);
    const start = src.indexOf(startMarker);
    const end = src.indexOf(endMarker, start + 1);
    expect(start, `section marker moved in ${rel}: ${startMarker}`).toBeGreaterThan(-1);
    expect(end, `section end marker moved in ${rel}: ${endMarker}`).toBeGreaterThan(start);
    return stripComments(src.slice(start, end));
  };

  const overlaySource = () =>
    section('client/src/components/astryx/components.tsx',
      '// ─── Overlays, menus & surfaces', 'export const COMPONENT_REGISTRY');

  const overlayWrapperSource = () =>
    section('client/src/design/resolver.tsx',
      '// ─── Anchored overlays, menus & surfaces', '// ─── Charts');

  it('does not portal', () => {
    for (const src of [overlaySource(), overlayWrapperSource()]) {
      expect(src).not.toMatch(/createPortal|ReactDOM\.render|document\.body/);
    }
  });

  it('does not use fixed positioning', () => {
    for (const src of [overlaySource(), overlayWrapperSource()]) {
      expect(src).not.toMatch(/position:\s*["']fixed["']|\bfixed\s+inset-0/);
    }
  });

  it('never disables pointer events, which would break craft.js selection', () => {
    expect(overlaySource()).not.toMatch(/pointer-events-none|pointerEvents:\s*["']none["']/);
    expect(overlayWrapperSource()).not.toMatch(/pointer-events-none|pointerEvents:\s*["']none["']/);
  });

  it('caps every panel at the space available so it cannot overflow sideways', () => {
    const src = overlaySource();
    expect(src).toContain('maxWidth: "100%"');
    expect(src).toContain('minWidth: 0');
    // Anchors carry user text too, and a long unbroken value would push the
    // whole component past the artboard edge if it could not shrink or wrap.
    expect(src).toMatch(/const anchorStyle: CSSProperties = \{[^}]*flexShrink: 1[^}]*overflowWrap: "anywhere"/);
    // Every anchor, including the ones with bespoke markup, routes through it —
    // an anchor pinned at flexShrink: 0 is exactly how the guarantee breaks.
    const anchorProps = src.match(/anchor=\{[\s\S]*?\n\s*\}?\s*>/g) ?? [];
    expect(anchorProps.length).toBeGreaterThanOrEqual(6);
    for (const a of anchorProps) {
      if (!/<span/.test(a)) continue;
      expect(a, `an anchor does not use the shared anchorStyle: ${a.slice(0, 120)}`)
        .toMatch(/style=\{anchorStyle\}|max-w-full/);
    }
    expect(src).not.toContain("flexShrink: 0 }}>{anchorLabel}");
  });

  it('gives the scrim stage its own containing block', () => {
    // relative + explicit height + overflow hidden is what keeps the absolutely
    // positioned scrim resolving against the stage rather than the canvas.
    expect(overlaySource()).toContain('relative w-full overflow-hidden');
  });
});

describe('menu item syntax', () => {
  it('splits a plain comma-separated list', () => {
    expect(parseMenuItems('Edit,Duplicate,Delete').map((i) => i.label))
      .toEqual(['Edit', 'Duplicate', 'Delete']);
  });

  it('treats --- as a separator rather than an item', () => {
    const parsed = parseMenuItems('Edit,---,Delete');
    expect(parsed.map((i) => i.kind)).toEqual(['item', 'separator', 'item']);
    expect(parsed[1].label).toBe('');
  });

  it('splits "Label:Shortcut" pairs', () => {
    const [item] = parseMenuItems('Duplicate:⌘D');
    expect(item.label).toBe('Duplicate');
    expect(item.shortcut).toBe('⌘D');
  });

  it('marks a leading "!" item as destructive', () => {
    const [plain, danger] = parseMenuItems('Rename,!Delete');
    expect(plain.destructive).toBe(false);
    expect(danger.label).toBe('Delete');
    expect(danger.destructive).toBe(true);
  });

  it('combines destructive and shortcut', () => {
    const [item] = parseMenuItems('!Delete:⌫');
    expect(item).toMatchObject({ label: 'Delete', shortcut: '⌫', destructive: true });
  });

  it('drops blanks and tolerates empty input', () => {
    expect(parseMenuItems('')).toEqual([]);
    expect(parseMenuItems(undefined)).toEqual([]);
    expect(parseMenuItems('Edit, ,  ,Delete').map((i) => i.label)).toEqual(['Edit', 'Delete']);
  });

  it('parses every default menu string the palette ships with', () => {
    for (const key of MENUS as Array<keyof typeof OVERLAY_DEFAULTS>) {
      const items = parseMenuItems((OVERLAY_DEFAULTS[key] as any).items);
      expect(items.length, `${key} default items`).toBeGreaterThan(1);
      expect(items.some((i) => i.kind === 'separator')).toBe(true);
      expect(items.some((i) => i.destructive)).toBe(true);
    }
  });
});

describe('inspector fallbacks cannot drift from component defaults', () => {
  // The inspector rows are controlled inputs seeded from a fallback: if a
  // fallback disagrees with the component default, editing any field in that
  // panel writes the wrong value back and silently deletes a real prop.
  const editor = read('client/src/design/DesignEditor.tsx');
  const components = read('client/src/components/astryx/components.tsx');

  it('routes every overlay inspector fallback through OVERLAY_DEFAULTS', () => {
    for (const name of NEW_OVERLAYS) {
      const block = editor.slice(
        editor.indexOf(`displayName === "${name}"`),
        editor.indexOf('</>', editor.indexOf(`displayName === "${name}"`)),
      );
      const literalFallbacks = block.match(/\?\?\s*(?!OVERLAY_DEFAULTS)["'][^"']+["']/g) ?? [];
      // "" is the one allowed literal: it means "genuinely empty by default".
      const nonEmpty = literalFallbacks.filter((f) => !/\?\?\s*""/.test(f));
      expect(nonEmpty, `${name} has hand-written inspector fallbacks: ${nonEmpty.join(', ')}`).toEqual([]);
    }
  });

  it('routes every overlay component default through the same constant', () => {
    for (const name of NEW_OVERLAYS) {
      const start = components.indexOf(`export function ${name}(`);
      const signature = components.slice(start, components.indexOf('}: AstryxProps)', start));
      const literals = signature.match(/=\s*(?!OVERLAY_DEFAULTS)["'\d][^,\n]*/g) ?? [];
      expect(literals, `${name} has hand-written defaults: ${literals.join(', ')}`).toEqual([]);
    }
  });
});
