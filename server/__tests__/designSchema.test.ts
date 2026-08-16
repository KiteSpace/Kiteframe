/**
 * Unit tests for server/lib/designSchema.ts
 *
 * Verifies:
 *   1. The 150-component hard cap — submitting 151 components is rejected with a
 *      human-readable "Too many components" error message.
 *   2. The minItems:1 rule — submitting 0 components is rejected.
 *   3. Happy-path boundaries — exactly 1 and exactly 150 components are accepted.
 *
 * These tests exercise `validateExternalDesign` directly (pure function, no HTTP
 * layer needed). The HTTP route unconditionally returns 422 whenever
 * `valid === false`, so these unit tests fully confirm the server-side behaviour.
 */
import { describe, it, expect } from 'vitest';
import {
  validateExternalDesign,
  DESIGN_MAX_COMPONENTS,
  ALWAYS_CANVAS_COMPONENTS,
  repairCraftState,
} from '../lib/designSchema';

function makeComponent(i: number) {
  return { id: `c${i}`, astryxComponent: 'Button', x: i * 10, y: 0 };
}

function makeComponents(count: number) {
  return Array.from({ length: count }, (_, i) => makeComponent(i));
}

describe('validateExternalDesign — component count boundaries', () => {
  it('accepts exactly 1 component (lower boundary)', () => {
    const result = validateExternalDesign({ components: [makeComponent(0)] });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it(`accepts exactly ${DESIGN_MAX_COMPONENTS} components (upper boundary)`, () => {
    const result = validateExternalDesign({ components: makeComponents(DESIGN_MAX_COMPONENTS) });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects 151 components with a "Too many components" error', () => {
    const result = validateExternalDesign({ components: makeComponents(151) });
    expect(result.valid).toBe(false);
    const errorText = result.errors.join(' ');
    expect(errorText).toContain('Too many components');
    expect(errorText).toContain('150');
    expect(errorText).toContain('151');
  });

  it('rejects 0 components (violates minItems: 1)', () => {
    const result = validateExternalDesign({ components: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a payload with no components field at all', () => {
    const result = validateExternalDesign({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-object payload', () => {
    const result = validateExternalDesign(null);
    expect(result.valid).toBe(false);
  });
});

describe('validateExternalDesign — individual component schema', () => {
  it('rejects a component missing the required astryxComponent field', () => {
    const result = validateExternalDesign({
      components: [{ id: 'c1', x: 0, y: 0 }],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects a component with an empty-string id', () => {
    const result = validateExternalDesign({
      components: [{ id: '', astryxComponent: 'Button', x: 0, y: 0 }],
    });
    expect(result.valid).toBe(false);
  });

  it('accepts a component with optional props', () => {
    const result = validateExternalDesign({
      components: [{ id: 'c1', astryxComponent: 'Button', x: 0, y: 0, props: { label: 'Click me' } }],
    });
    expect(result.valid).toBe(true);
  });

  it('accepts a design with an optional title', () => {
    const result = validateExternalDesign({
      title: 'My Design',
      components: [makeComponent(0)],
    });
    expect(result.valid).toBe(true);
  });
});

// ─── isCanvas enforcement for container components ───────────────────────────
// craft.js reads `isCanvas` from the STORED node state, not from the component's
// static .craft config. A container persisted with isCanvas false/absent renders
// none of its children: the nodes survive in the map and in the layers panel, but
// the canvas shows an empty box. Externally generated designs (workflow bridge)
// and imperfect AI responses both hit this, so repairCraftState must coerce it.
describe('repairCraftState — isCanvas enforcement for containers', () => {
  const stateWith = (name: string, isCanvas: unknown) => {
    const node: Record<string, unknown> = {
      type: { resolvedName: name },
      displayName: name,
      props: {},
      parent: 'ROOT',
      nodes: ['child'],
      linkedNodes: {},
    };
    if (isCanvas !== undefined) node['isCanvas'] = isCanvas;
    return {
      ROOT: {
        type: { resolvedName: 'AstryxSection' },
        displayName: 'AstryxSection',
        isCanvas: true,
        props: {},
        parent: null,
        nodes: ['container'],
        linkedNodes: {},
      },
      container: node,
      child: {
        type: { resolvedName: 'AstryxText' },
        displayName: 'AstryxText',
        isCanvas: false,
        props: { children: 'Inner content' },
        parent: 'container',
        nodes: [],
        linkedNodes: {},
      },
    };
  };

  const canvasOf = (state: unknown) =>
    ((state as Record<string, Record<string, unknown>>)['container'])['isCanvas'];

  for (const name of ALWAYS_CANVAS_COMPONENTS) {
    it(`coerces isCanvas:false to true on ${name}`, () => {
      expect(canvasOf(repairCraftState(stateWith(name, false)))).toBe(true);
    });

    it(`adds a missing isCanvas on ${name}`, () => {
      expect(canvasOf(repairCraftState(stateWith(name, undefined)))).toBe(true);
    });
  }

  it('preserves the children of a container repaired this way', () => {
    const repaired = repairCraftState(stateWith('AstryxField', false)) as Record<string, Record<string, unknown>>;
    expect(repaired['container']['nodes']).toEqual(['child']);
    expect(repaired['child']).toBeDefined();
  });

  it('leaves genuine leaf components as non-canvas', () => {
    const repaired = repairCraftState({
      ROOT: {
        type: { resolvedName: 'AstryxSection' }, displayName: 'AstryxSection', isCanvas: true,
        props: {}, parent: null, nodes: ['leaf'], linkedNodes: {},
      },
      leaf: {
        type: { resolvedName: 'AstryxSwitch' }, displayName: 'AstryxSwitch', isCanvas: false,
        props: { label: 'Enabled' }, parent: 'ROOT', nodes: [], linkedNodes: {},
      },
    }) as Record<string, Record<string, unknown>>;
    expect(repaired['leaf']['isCanvas']).toBe(false);
  });

  it('covers every new form-structure container', () => {
    for (const name of ['AstryxField', 'AstryxFieldStatus', 'AstryxFormLayout', 'AstryxInputGroup', 'AstryxGrid']) {
      expect(ALWAYS_CANVAS_COMPONENTS, `${name} must be enforced as a canvas`).toContain(name);
    }
  });
});
