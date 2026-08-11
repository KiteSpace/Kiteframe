/**
 * Route-level guarantee that no AI generation path can return a design that
 * renders blank.
 *
 * A craft.js ROOT node must resolve to a real *container* component AND carry
 * `isCanvas: true`. If either is wrong, craft.js renders nothing inside ROOT —
 * the canvas is completely blank — while every diagnostic still reports
 * success, because all the nodes and artboards are present and correctly
 * parented. They just have no container to draw them.
 *
 * This reached production once already, via a ROOT typed as the literal string
 * "Root". The helpers are unit-tested elsewhere; what this file covers is the
 * layer above them:
 *
 *   1. Every response-shaping path an AI design route uses produces a ROOT that
 *      satisfies the invariant, for every way ROOT can arrive broken.
 *   2. No route hands a craft state back to the client without running it
 *      through the sanitiser — including a route added later by someone who
 *      does not know the invariant exists.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  sanitizeRootType,
  layoutArtboards,
  wrapRootChildrenInArtboard,
  mergeDesignPatch,
  type CraftState,
} from '../lib/designPatchMerge';
import { ROOT_CONTAINER_COMPONENTS, repairCraftState } from '../lib/designSchema';

// ─── Invariant ───────────────────────────────────────────────────────────────

function expectRootRenders(state: unknown, context: string) {
  const root = (state as CraftState)?.['ROOT'] as Record<string, any> | undefined;
  expect(root, `${context}: ROOT missing entirely`).toBeTruthy();

  const resolvedName = root?.type?.resolvedName;
  expect(
    ROOT_CONTAINER_COMPONENTS.includes(resolvedName),
    `${context}: ROOT.type.resolvedName was ${JSON.stringify(resolvedName)}, which is not a container — the canvas would render blank`,
  ).toBe(true);

  expect(
    root?.isCanvas,
    `${context}: ROOT is a container but isCanvas is ${JSON.stringify(root?.isCanvas)} — it would render none of its children`,
  ).toBe(true);
}

// ─── Every way ROOT arrives broken ───────────────────────────────────────────

function artboard(label: string, parent = 'ROOT') {
  return {
    type: { resolvedName: 'AstryxArtboard' },
    isCanvas: true,
    props: { label },
    displayName: 'AstryxArtboard',
    custom: {},
    hidden: false,
    nodes: [],
    linkedNodes: {},
    parent,
  };
}

function stateWithRoot(root: Record<string, unknown>): CraftState {
  return {
    ROOT: { props: {}, custom: {}, hidden: false, nodes: ['ab1'], linkedNodes: {}, parent: null, ...root },
    ab1: artboard('Login'),
  } as unknown as CraftState;
}

const BROKEN_ROOTS: Array<{ name: string; state: CraftState }> = [
  {
    // The exact shape that shipped: craft.js's own reverse resolver emitting
    // the literal "Root", which is not a registered component name.
    name: 'ROOT typed as the literal string "Root"',
    state: stateWithRoot({ type: { resolvedName: 'Root' }, displayName: 'Root', isCanvas: true }),
  },
  {
    name: 'ROOT typed as AstryxArtboard (renders as a phantom screen)',
    state: stateWithRoot({ type: { resolvedName: 'AstryxArtboard' }, props: { label: 'Sales' }, isCanvas: true }),
  },
  {
    name: 'ROOT typed as the unknown-component placeholder (a leaf)',
    state: stateWithRoot({ type: { resolvedName: 'AstryxUnknown' }, isCanvas: true }),
  },
  {
    name: 'ROOT is a valid container but isCanvas is false',
    state: stateWithRoot({ type: { resolvedName: 'AstryxSection' }, isCanvas: false }),
  },
  {
    name: 'ROOT is a valid container but isCanvas is missing',
    state: stateWithRoot({ type: { resolvedName: 'AstryxStack' } }),
  },
  {
    name: 'ROOT has no type at all',
    state: stateWithRoot({ isCanvas: true }),
  },
  {
    name: 'ROOT.type is a bare string rather than a resolver object',
    state: stateWithRoot({ type: 'AstryxSection' as unknown as Record<string, unknown>, isCanvas: true }),
  },
  {
    name: 'ROOT.type.resolvedName is a hallucinated component',
    state: stateWithRoot({ type: { resolvedName: 'MyCustomDashboardRoot' }, isCanvas: true }),
  },
  {
    name: 'ROOT.type.resolvedName is null',
    state: stateWithRoot({ type: { resolvedName: null }, isCanvas: true }),
  },
];

// ─── Response paths ──────────────────────────────────────────────────────────
//
// Mirrors of the transforms routes.ts applies before returning a craft state.
// The source-level guard below is what keeps these in step with the routes.

const RESPONSE_PATHS: Array<{ name: string; run: (s: CraftState) => unknown }> = [
  {
    name: "/api/ai/design — full state",
    run: (s) => wrapRootChildrenInArtboard(layoutArtboards(sanitizeRootType(s))),
  },
  {
    name: "/api/ai/design — patch",
    run: (s) => sanitizeRootType(s),
  },
  {
    name: '/api/ai/design-from-image, -from-url, -from-figma — full state',
    run: (s) => sanitizeRootType(s),
  },
  {
    name: '/api/ai/design-edit-from-image — merged state',
    run: (s) => {
      const existing = stateWithRoot({ type: { resolvedName: 'AstryxSection' }, isCanvas: true });
      return sanitizeRootType(mergeDesignPatch(existing, s).merged);
    },
  },
  {
    name: 'persistence path — repairCraftState',
    run: (s) => repairCraftState(s),
  },
];

describe('ROOT invariant across every AI design response path', () => {
  for (const path of RESPONSE_PATHS) {
    for (const broken of BROKEN_ROOTS) {
      it(`${path.name}: repairs ${broken.name}`, () => {
        const out = path.run(structuredClone(broken.state));
        expectRootRenders(out, `${path.name} / ${broken.name}`);
      });
    }
  }

  it('leaves an already-valid ROOT untouched', () => {
    const valid = stateWithRoot({
      type: { resolvedName: 'AstryxSection' },
      displayName: 'AstryxSection',
      isCanvas: true,
    });
    expect(sanitizeRootType(valid)).toBe(valid);
  });

  it('preserves the artboards while repairing ROOT', () => {
    const broken = {
      ROOT: {
        type: { resolvedName: 'Root' },
        displayName: 'Root',
        isCanvas: true,
        props: {},
        custom: {},
        hidden: false,
        nodes: ['ab1', 'ab2'],
        linkedNodes: {},
        parent: null,
      },
      ab1: artboard('Login'),
      ab2: artboard('Dashboard'),
    } as unknown as CraftState;

    const out = sanitizeRootType(broken) as CraftState;
    expectRootRenders(out, 'artboard preservation');
    expect((out['ROOT'] as any).nodes).toEqual(['ab1', 'ab2']);
    expect((out['ab1'] as any).props.label).toBe('Login');
    expect((out['ab2'] as any).props.label).toBe('Dashboard');
  });

  it('keeps a mis-typed ROOT from leaving a stray screen label behind', () => {
    // A ROOT typed as an artboard carries a `label`; left in place it shows up
    // as a blank, undeletable extra screen tab.
    const out = sanitizeRootType(
      stateWithRoot({ type: { resolvedName: 'AstryxArtboard' }, props: { label: 'Ghost' }, isCanvas: true }),
    ) as CraftState;
    expect((out['ROOT'] as any).props.label).toBeUndefined();
  });

  it('does not invent a ROOT for a patch that legitimately has none', () => {
    // Patches describe a subset of nodes; most do not include ROOT at all.
    const patch = { ab9: artboard('New screen') } as unknown as CraftState;
    expect(sanitizeRootType(patch)).toEqual(patch);
  });
});

// ─── Source-level guard ──────────────────────────────────────────────────────

describe('no route returns a craft state without sanitising ROOT', () => {
  const routesSource = readFileSync(resolve(process.cwd(), 'server/routes.ts'), 'utf8');
  const lines = routesSource.split('\n');

  /**
   * Every `res.json(...)` call in the file, matched by balancing parentheses
   * rather than by a single-line regex — so a response split across lines, or
   * formatted differently by a future author, is still seen by this guard.
   */
  function extractResJsonCalls() {
    const needle = 'res.json(';
    const calls: Array<{ lineNo: number; text: string }> = [];
    let idx = 0;
    while ((idx = routesSource.indexOf(needle, idx)) !== -1) {
      let depth = 0;
      let end = -1;
      for (let i = idx + needle.length - 1; i < routesSource.length; i++) {
        const ch = routesSource[i];
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      if (end === -1) break;
      calls.push({
        lineNo: routesSource.slice(0, idx).split('\n').length,
        text: routesSource.slice(idx, end + 1),
      });
      idx = end + 1;
    }
    return calls;
  }

  // Any response that hands the client a craft state or a node patch.
  const responses = extractResJsonCalls().filter((c) => /type:\s*['"](state|patch)['"]/.test(c.text));

  it('finds the craft-state responses it is meant to be guarding', () => {
    // If this collapses to nothing, the extractor has drifted and every check
    // below would pass vacuously while inspecting no routes at all.
    expect(responses.length).toBeGreaterThanOrEqual(5);
  });

  for (const { lineNo, text } of responses) {
    const oneLine = text.replace(/\s+/g, ' ').slice(0, 160);

    it(`routes.ts:${lineNo} sanitises ROOT before responding`, () => {
      if (text.includes('sanitizeRootType')) return; // Applied inline.

      // Otherwise the state came from a variable — its declaration must apply
      // the sanitiser. An unrecognised shape fails rather than being skipped:
      // silently ignoring it is exactly how an unguarded route would slip in.
      const payload = text.match(/(?:craftState|nodes):\s*JSON\.stringify\(\s*([A-Za-z_$][\w$]*)\s*(?:as\s+\w+\s*)?\)/);
      expect(
        payload,
        `routes.ts:${lineNo} returns a craft state in a shape this guard cannot verify. Either apply sanitizeRootType inline or assign it to a local first.\n  ${oneLine}`,
      ).toBeTruthy();

      const identifier = payload![1];
      const declaration = lines
        .slice(Math.max(0, lineNo - 40), lineNo)
        .join('\n')
        .match(new RegExp(`(?:const|let)\\s+${identifier}\\s*=([\\s\\S]*?);`));

      expect(
        declaration?.[1]?.includes('sanitizeRootType'),
        `routes.ts:${lineNo} returns "${identifier}" without passing it through sanitizeRootType — a malformed ROOT would blank the client canvas.\n  ${oneLine}`,
      ).toBe(true);
    });
  }
});
