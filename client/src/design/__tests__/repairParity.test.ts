import { describe, it, expect } from 'vitest';
import {
  ALLOWED_CRAFT_COMPONENTS,
  PLACEHOLDER_COMPONENT,
  repairCraftStateWithReport as repairClient,
  sanitizeCraftState,
  suggestAlternativeComponent,
} from '../craftValidator';
import {
  SERVER_ALLOWED_CRAFT_COMPONENTS,
  repairCraftStateWithReport as repairServer,
} from '../../../../server/lib/designSchema';

/**
 * The client and the server each own a copy of repairCraftState, and both run
 * on the same AI output — the server on generation, the client on apply. When
 * they drift, a design that one side salvages the other discards, which is
 * exactly the bug this suite exists to prevent: the client copy had neither the
 * missing-type backfill nor the unknown-name substitution, so an AI design
 * naming a component the library doesn't have was thrown away wholesale instead
 * of landing with a placeholder.
 *
 * These tests run the SAME fixture through both implementations and compare the
 * fields that decide whether a node renders. Incidental differences (which
 * defaults each side hydrates) are deliberately not compared.
 */

type Node = Record<string, unknown>;

/** A well-formed ROOT → Artboard → content state, so neither repair pass
 *  restructures the tree and the comparison stays on the node under test. */
function stateWith(node: Node): Record<string, unknown> {
  return {
    ROOT: {
      type: { resolvedName: 'AstryxSection' },
      isCanvas: true,
      props: {},
      displayName: 'AstryxSection',
      custom: {},
      hidden: false,
      nodes: ['ab1'],
      linkedNodes: {},
      parent: null,
    },
    ab1: {
      type: { resolvedName: 'AstryxArtboard' },
      isCanvas: true,
      props: { label: 'Screen 1' },
      displayName: 'AstryxArtboard',
      custom: {},
      hidden: false,
      nodes: ['n1'],
      linkedNodes: {},
      parent: 'ROOT',
    },
    n1: node,
  };
}

/** Only the fields that decide what craft.js renders for a node. */
function renderShape(state: unknown, id: string) {
  const n = (state as Record<string, Node>)[id];
  if (!n) return null;
  const props = (n['props'] ?? {}) as Record<string, unknown>;
  return {
    resolvedName: (n['type'] as Record<string, unknown> | undefined)?.['resolvedName'],
    astryxComponent: props['astryxComponent'],
    displayName: n['displayName'],
  };
}

function bothRepairs(node: Node) {
  const input = stateWith(node);
  // Deep-clone per side: a repair that mutates its input would otherwise let
  // the first call contaminate the second and hide a real difference.
  const client = repairClient(structuredClone(input));
  const server = repairServer(structuredClone(input));
  return { client, server, input };
}

describe('client and server repair agree on component substitution', () => {
  it('declares the same allowed component list on both sides', () => {
    expect([...ALLOWED_CRAFT_COMPONENTS].sort()).toEqual(
      [...SERVER_ALLOWED_CRAFT_COMPONENTS].sort(),
    );
  });

  it('replaces an unknown component name with the labelled placeholder', () => {
    const { client, server } = bothRepairs({
      type: { resolvedName: 'AstryxDatePicker' },
      props: { label: 'Pick a date' },
      displayName: 'AstryxDatePicker',
      custom: {},
      hidden: false,
      nodes: [],
      linkedNodes: {},
      parent: 'ab1',
    });

    const expected = {
      resolvedName: PLACEHOLDER_COMPONENT,
      astryxComponent: 'AstryxDatePicker',
      displayName: PLACEHOLDER_COMPONENT,
    };
    expect(renderShape(client.state, 'n1')).toEqual(expected);
    expect(renderShape(server.state, 'n1')).toEqual(expected);

    // Both must report the substitution, or only one side can tell the user.
    expect(client.report.substitutedComponents).toEqual(['AstryxDatePicker']);
    expect(server.report.substitutedComponents).toEqual(['AstryxDatePicker']);
  });

  it('keeps the original props alongside the placeholder label', () => {
    const { client, server } = bothRepairs({
      type: { resolvedName: 'AstryxFancyThing' },
      props: { label: 'Keep me', size: 3 },
      parent: 'ab1',
    });
    for (const out of [client.state, server.state]) {
      const props = ((out as Record<string, Node>)['n1']['props']) as Record<string, unknown>;
      expect(props['label']).toBe('Keep me');
      expect(props['size']).toBe(3);
      expect(props['astryxComponent']).toBe('AstryxFancyThing');
    }
  });

  it.each([
    ['no type key at all', {}],
    ['a string type', { type: 'AstryxButton' }],
    ['an array type', { type: [] }],
    ['a type with no resolvedName', { type: {} }],
    ['a type with a non-string resolvedName', { type: { resolvedName: 42 } }],
    ['a type with an empty resolvedName', { type: { resolvedName: '' } }],
  ])('backfills %s with the placeholder', (_label, partial) => {
    const { client, server } = bothRepairs({ ...partial, props: {}, parent: 'ab1' } as Node);

    expect(renderShape(client.state, 'n1')?.resolvedName).toBe(PLACEHOLDER_COMPONENT);
    expect(renderShape(server.state, 'n1')?.resolvedName).toBe(PLACEHOLDER_COMPONENT);
    expect(client.report.typelessNodeIds).toEqual(['n1']);
    expect(server.report.typelessNodeIds).toEqual(['n1']);
  });

  // ── Containers ─────────────────────────────────────────────────────────────
  // The placeholder used to be forced to a leaf. That meant swapping an
  // unresolved CONTAINER hid every node beneath it: the same "the design got
  // discarded" failure, one level down, and invisible because the node count
  // stayed healthy.

  function stateWithContainer(containerNode: Node) {
    return {
      ROOT: {
        type: { resolvedName: 'AstryxSection' },
        isCanvas: true,
        props: {},
        nodes: ['ab1'],
        parent: null,
      },
      ab1: {
        type: { resolvedName: 'AstryxArtboard' },
        isCanvas: true,
        props: {},
        nodes: ['box'],
        parent: 'ROOT',
      },
      box: { props: {}, parent: 'ab1', nodes: ['kid'], ...containerNode },
      kid: {
        type: { resolvedName: 'AstryxHeading' },
        props: { children: 'INNER' },
        parent: 'box',
        nodes: [],
      },
    };
  }

  it.each([
    [
      'an unknown container',
      { type: { resolvedName: 'AstryxDataGrid' }, isCanvas: true },
    ],
    // A typeless node that nonetheless has children is a container in all but
    // name; backfilling its type must not quietly orphan them.
    ['a typeless container', { isCanvas: true }],
    // Saved while the placeholder was leaf-only: reopening must restore it.
    [
      'a placeholder already stored as a leaf',
      { type: { resolvedName: 'AstryxUnknown' }, isCanvas: false },
    ],
  ])('keeps %s able to render its children', (_label, containerNode) => {
    const input = stateWithContainer(containerNode as Node);
    for (const out of [repairClient(structuredClone(input)), repairServer(structuredClone(input))]) {
      const state = out.state as Record<string, Node>;
      const box = state['box'];
      expect((box['type'] as Record<string, unknown>)['resolvedName']).toBe(PLACEHOLDER_COMPONENT);
      // isCanvas is what decides whether craft.js draws the subtree at all.
      expect(box['isCanvas']).toBe(true);
      // The child must survive, still attached to the placeholder.
      expect(box['nodes']).toContain('kid');
      expect(state['kid']).toBeTruthy();
      expect(state['kid']['parent']).toBe('box');
    }
  });

  it('still marks a childless placeholder as a leaf', () => {
    const { client, server } = bothRepairs({
      type: { resolvedName: 'AstryxDataGrid' },
      isCanvas: true,
      props: {},
      nodes: [],
      parent: 'ab1',
    });
    for (const out of [client, server]) {
      expect((out.state as Record<string, Node>)['n1']['isCanvas']).toBe(false);
    }
  });

  it('leaves a known component completely alone', () => {
    const { client, server } = bothRepairs({
      type: { resolvedName: 'AstryxButton' },
      props: { label: 'Save' },
      displayName: 'AstryxButton',
      custom: {},
      hidden: false,
      nodes: [],
      linkedNodes: {},
      parent: 'ab1',
    });

    const expected = {
      resolvedName: 'AstryxButton',
      astryxComponent: undefined,
      displayName: 'AstryxButton',
    };
    expect(renderShape(client.state, 'n1')).toEqual(expected);
    expect(renderShape(server.state, 'n1')).toEqual(expected);
    expect(client.report.substitutedComponents).toEqual([]);
    expect(server.report.substitutedComponents).toEqual([]);
  });

  it('reports each substituted name once, however many nodes used it', () => {
    const base = (id: string, name: string) => ({
      type: { resolvedName: name },
      props: {},
      parent: 'ab1',
      nodes: [],
    });
    const input = {
      ROOT: {
        type: { resolvedName: 'AstryxSection' },
        isCanvas: true,
        props: {},
        nodes: ['ab1'],
        parent: null,
      },
      ab1: {
        type: { resolvedName: 'AstryxArtboard' },
        isCanvas: true,
        props: {},
        nodes: ['a', 'b', 'c'],
        parent: 'ROOT',
      },
      a: base('a', 'AstryxDatePicker'),
      b: base('b', 'AstryxDatePicker'),
      c: base('c', 'AstryxRating'),
    };
    const client = repairClient(structuredClone(input));
    const server = repairServer(structuredClone(input));

    for (const r of [client.report, server.report]) {
      expect([...r.substitutedComponents].sort()).toEqual(['AstryxDatePicker', 'AstryxRating']);
    }
  });
});

describe('ROOT is never demoted to the leaf placeholder', () => {
  /**
   * AstryxUnknown renders no children. Demoting ROOT to it blanks the entire
   * canvas while every node still sits in the state map and every count looks
   * healthy — the failure mode is invisible until someone opens the design.
   */
  it.each([
    ['an unknown component name', { resolvedName: 'AstryxMysteryBox' }],
    ['a leaf component name', { resolvedName: 'AstryxButton' }],
  ])('coerces a ROOT carrying %s to a real container', (_label, type) => {
    const input = {
      ROOT: { type, isCanvas: true, props: {}, nodes: ['ab1'], parent: null },
      ab1: {
        type: { resolvedName: 'AstryxArtboard' },
        isCanvas: true,
        props: {},
        nodes: [],
        parent: 'ROOT',
      },
    };
    for (const out of [repairClient(structuredClone(input)), repairServer(structuredClone(input))]) {
      const root = (out.state as Record<string, Node>)['ROOT'];
      const name = (root['type'] as Record<string, unknown>)['resolvedName'];
      expect(name).not.toBe(PLACEHOLDER_COMPONENT);
      expect(ALLOWED_CRAFT_COMPONENTS).toContain(name as string);
      expect(root['isCanvas']).toBe(true);
      // ROOT is not a user-visible substitution, so it must not be reported.
      expect(out.report.substitutedComponents).not.toContain('AstryxMysteryBox');
    }
  });

  it('does not demote a ROOT that has no usable type', () => {
    const input = {
      ROOT: { props: {}, nodes: ['ab1'], parent: null },
      ab1: {
        type: { resolvedName: 'AstryxArtboard' },
        isCanvas: true,
        props: {},
        nodes: [],
        parent: 'ROOT',
      },
    };
    for (const out of [repairClient(structuredClone(input)), repairServer(structuredClone(input))]) {
      const root = (out.state as Record<string, Node>)['ROOT'];
      expect((root['type'] as Record<string, unknown>)['resolvedName']).not.toBe(
        PLACEHOLDER_COMPONENT,
      );
      expect(root['isCanvas']).toBe(true);
    }
  });
});

describe('repairCraftState does not mutate its input', () => {
  it('leaves the caller\'s state object untouched', () => {
    const input = stateWith({
      type: { resolvedName: 'AstryxDatePicker' },
      props: { label: 'x' },
      parent: 'ab1',
    });
    const snapshot = JSON.stringify(input);
    repairClient(input);
    repairServer(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('sanitizeCraftState agrees with repair about placeholders', () => {
  // sanitizeCraftState runs directly before <Frame data={...}> on paths that
  // skip repair, so it must reach the same conclusion rather than undoing it.
  const withPlaceholder = (isCanvas: boolean, name: string) => ({
    ROOT: {
      type: { resolvedName: 'AstryxSection' },
      isCanvas: true,
      props: {},
      nodes: ['ab1'],
      parent: null,
    },
    ab1: {
      type: { resolvedName: 'AstryxArtboard' },
      isCanvas: true,
      props: {},
      nodes: ['box'],
      parent: 'ROOT',
    },
    box: { type: { resolvedName: name }, isCanvas, props: {}, nodes: ['kid'], parent: 'ab1' },
    kid: {
      type: { resolvedName: 'AstryxHeading' },
      props: { children: 'INNER' },
      nodes: [],
      parent: 'box',
    },
  });

  it('promotes a legacy leaf-only placeholder so its children render again', () => {
    const out = JSON.parse(sanitizeCraftState(JSON.stringify(withPlaceholder(false, 'AstryxUnknown'))));
    expect(out.box.isCanvas).toBe(true);
    expect(out.box.nodes).toContain('kid');
  });

  it('marks a substituted container as a canvas, like repair does', () => {
    const input = withPlaceholder(true, 'AstryxDataGrid');
    const sanitized = JSON.parse(sanitizeCraftState(JSON.stringify(input)));
    const repaired = repairClient(structuredClone(input)).state as Record<string, Node>;
    expect(sanitized.box.isCanvas).toBe(true);
    expect(sanitized.box.isCanvas).toBe(repaired['box']['isCanvas']);
    expect(sanitized.box.props.astryxComponent).toBe('AstryxDataGrid');
  });

  it('leaves a childless placeholder as a leaf', () => {
    const input = withPlaceholder(true, 'AstryxUnknown') as any;
    input.box.nodes = [];
    delete input.kid;
    expect(JSON.parse(sanitizeCraftState(JSON.stringify(input))).box.isCanvas).toBe(false);
  });
});

describe('suggestAlternativeComponent', () => {
  it.each([
    ['AstryxDatePicker', 'AstryxCalendar'],
    ['AstryxTimePicker', 'AstryxCalendar'],
    ['AstryxDropdown', 'AstryxSelect'],
    ['AstryxToggle', 'AstryxSwitch'],
    ['AstryxDialog', 'AstryxModal'],
    ['AstryxToast', 'AstryxBanner'],
    ['AstryxDonutChart', 'AstryxBarChart'],
    ['AstryxChip', 'AstryxToken'],
  ])('maps %s to %s', (unknown, expected) => {
    expect(suggestAlternativeComponent(unknown)).toBe(expected);
  });

  it('resolves a decorated name to the component it contains', () => {
    expect(suggestAlternativeComponent('AstryxPrimaryActionButton')).toBe('AstryxButton');
  });

  it('only ever suggests a component that actually exists', () => {
    for (const name of ['AstryxWidget', 'AstryxFoo', 'AstryxDataGrid', 'Astryx3DViewer']) {
      const suggestion = suggestAlternativeComponent(name);
      if (suggestion !== null) expect(ALLOWED_CRAFT_COMPONENTS).toContain(suggestion);
    }
  });

  it('returns null rather than guessing at a name with nothing close', () => {
    expect(suggestAlternativeComponent('AstryxZzzyqwxvb')).toBeNull();
  });

  it('never suggests the placeholder itself', () => {
    expect(suggestAlternativeComponent('AstryxUnknownish')).not.toBe(PLACEHOLDER_COMPONENT);
  });
});
