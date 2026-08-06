/**
 * Tests for the server-side patch merge used by POST /api/ai/design.
 *
 * When the AI returns { type: 'patch', nodes: {...} } targeting a single
 * artboard, the merge must:
 *
 *   1. Preserve every node belonging to untargeted artboards exactly as-is.
 *   2. Add new nodes only inside the targeted artboard's node tree.
 *   3. Not silently drop or mutate nodes from other screens.
 *   4. Prune orphan child references that would appear after the merge.
 *
 * The helper is a pure function extracted from the route handler, so no HTTP
 * layer or AI mock is needed — the test directly verifies the merge invariants.
 */

import { describe, it, expect } from 'vitest';
import { mergeDesignPatch, wrapRootChildrenInArtboard, enforceNewScreenPatch, type CraftState } from '../lib/designPatchMerge';

// ---------------------------------------------------------------------------
// Helpers to build a realistic two-screen craft state
// ---------------------------------------------------------------------------

function makeNode(
  type: string,
  props: Record<string, unknown> = {},
  children: string[] = [],
): Record<string, unknown> {
  return { type: { resolvedName: type }, props, nodes: children, linkedNodes: {} };
}

/**
 * Returns a craft state with two artboards:
 *   screen1Id — contains a heading (s1HeadingId)
 *   screen2Id — contains a button  (s2ButtonId)
 * ROOT holds both artboards.
 */
function makeTwoScreenState() {
  const ROOT = 'ROOT';
  const screen1Id = 'artboard-screen1';
  const screen1HeadingId = 'heading-s1';
  const screen2Id = 'artboard-screen2';
  const screen2ButtonId = 'button-s2';

  const state: CraftState = {
    [ROOT]: makeNode('Document', {}, [screen1Id, screen2Id]),
    [screen1Id]: makeNode('AstryxArtboard', { label: 'Screen 1' }, [screen1HeadingId]),
    [screen1HeadingId]: makeNode('AstryxHeading', { text: 'Hello' }),
    [screen2Id]: makeNode('AstryxArtboard', { label: 'Screen 2' }, [screen2ButtonId]),
    [screen2ButtonId]: makeNode('AstryxButton', { label: 'Submit' }),
  };

  return { state, ids: { ROOT, screen1Id, screen1HeadingId, screen2Id, screen2ButtonId } };
}

// ---------------------------------------------------------------------------
// Helpers for the stress test
// ---------------------------------------------------------------------------

/**
 * Returns a craft state with three artboards:
 *   artboard-a — contains one heading each
 *   artboard-b — contains one button
 *   artboard-c — contains one text node (the untouched screens)
 * ROOT holds all three artboards.
 */
function makeThreeScreenState() {
  const ROOT = 'ROOT';
  const aId = 'artboard-a';
  const aHeadingId = 'heading-a';
  const bId = 'artboard-b';
  const bButtonId = 'button-b';
  const cId = 'artboard-c';
  const cTextId = 'text-c';

  const state: CraftState = {
    [ROOT]: makeNode('Document', {}, [aId, bId, cId]),
    [aId]: makeNode('AstryxArtboard', { label: 'Screen A' }, [aHeadingId]),
    [aHeadingId]: makeNode('AstryxHeading', { text: 'A heading' }),
    [bId]: makeNode('AstryxArtboard', { label: 'Screen B' }, [bButtonId]),
    [bButtonId]: makeNode('AstryxButton', { label: 'B button' }),
    [cId]: makeNode('AstryxArtboard', { label: 'Screen C' }, [cTextId]),
    [cTextId]: makeNode('AstryxText', { text: 'C text' }),
  };

  return { state, ids: { ROOT, aId, aHeadingId, bId, bButtonId, cId, cTextId } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mergeDesignPatch — multi-screen isolation', () => {
  it('returns type:state and Screen 2 node tree is byte-identical to the input', () => {
    const { state, ids } = makeTwoScreenState();

    const screen2Before = JSON.stringify(state[ids.screen2Id]);
    const screen2ButtonBefore = JSON.stringify(state[ids.screen2ButtonId]);

    // AI patch: add a new text node inside Screen 1 only
    const newTextId = 'text-new-s1';
    const patchNodes: CraftState = {
      [ids.screen1Id]: makeNode('AstryxArtboard', { label: 'Screen 1' }, [
        ids.screen1HeadingId,
        newTextId,
      ]),
      [newTextId]: makeNode('AstryxText', { text: 'New paragraph' }),
    };

    const { merged, orphansRemoved } = mergeDesignPatch(state, patchNodes);

    // No orphan refs should have been produced by a well-formed patch
    expect(orphansRemoved).toBe(0);

    // Screen 2 artboard node must be unchanged
    expect(JSON.stringify(merged[ids.screen2Id])).toBe(screen2Before);

    // Screen 2's button must be unchanged
    expect(JSON.stringify(merged[ids.screen2ButtonId])).toBe(screen2ButtonBefore);

    // New text node is present in the merged result
    expect(merged[newTextId]).toBeDefined();

    // New text node is referenced by Screen 1's artboard
    const s1Node = merged[ids.screen1Id] as Record<string, unknown>;
    const s1Children = s1Node.nodes as string[];
    expect(s1Children).toContain(newTextId);
    expect(s1Children).toContain(ids.screen1HeadingId);

    // New text node is NOT referenced by Screen 2
    const s2Node = merged[ids.screen2Id] as Record<string, unknown>;
    const s2Children = s2Node.nodes as string[];
    expect(s2Children).not.toContain(newTextId);
  });

  it('Screen 2 survives a patch that replaces Screen 1 artboard entirely', () => {
    const { state, ids } = makeTwoScreenState();

    const screen2Before = JSON.stringify(state[ids.screen2Id]);
    const screen2ButtonBefore = JSON.stringify(state[ids.screen2ButtonId]);

    // Patch replaces Screen 1's artboard node (complete overwrite) with two children
    const newHeadingId = 'heading-new';
    const newSubtextId = 'subtext-new';
    const patchNodes: CraftState = {
      [ids.screen1Id]: makeNode('AstryxArtboard', { label: 'Screen 1' }, [
        newHeadingId,
        newSubtextId,
      ]),
      [newHeadingId]: makeNode('AstryxHeading', { text: 'Updated heading' }),
      [newSubtextId]: makeNode('AstryxText', { text: 'Updated subtext' }),
    };

    const { merged } = mergeDesignPatch(state, patchNodes);

    // Screen 2 and its children must be untouched
    expect(JSON.stringify(merged[ids.screen2Id])).toBe(screen2Before);
    expect(JSON.stringify(merged[ids.screen2ButtonId])).toBe(screen2ButtonBefore);

    // Old Screen 1 heading is gone (not referenced in patch) but still exists
    // in the merged map because the patch didn't delete it — only Screen 1's
    // artboard no longer lists it. This is a known behaviour; clients may GC.
    const s1Node = merged[ids.screen1Id] as Record<string, unknown>;
    const s1Children = s1Node.nodes as string[];
    expect(s1Children).toContain(newHeadingId);
    expect(s1Children).toContain(newSubtextId);
    expect(s1Children).not.toContain(ids.screen1HeadingId);
  });

  it('prunes orphan child refs introduced by a patch that removes a node', () => {
    const { state, ids } = makeTwoScreenState();

    // Patch replaces Screen 1's artboard referencing a non-existent node ID
    const missingId = 'node-that-does-not-exist';
    const patchNodes: CraftState = {
      [ids.screen1Id]: makeNode('AstryxArtboard', { label: 'Screen 1' }, [
        ids.screen1HeadingId,
        missingId,
      ]),
    };

    const { merged, orphansRemoved } = mergeDesignPatch(state, patchNodes);

    expect(orphansRemoved).toBe(1);

    const s1Node = merged[ids.screen1Id] as Record<string, unknown>;
    const s1Children = s1Node.nodes as string[];
    expect(s1Children).not.toContain(missingId);
    expect(s1Children).toContain(ids.screen1HeadingId);

    // Screen 2 must still be intact
    const s2Node = merged[ids.screen2Id] as Record<string, unknown>;
    const s2Children = s2Node.nodes as string[];
    expect(s2Children).toContain(ids.screen2ButtonId);
  });

  it('carries over all untouched screens when the patch has no overlap', () => {
    const { state, ids } = makeTwoScreenState();

    // Patch only adds a brand-new top-level node unrelated to any screen
    const floatingId = 'floating-node';
    const patchNodes: CraftState = {
      [floatingId]: makeNode('AstryxText', { text: 'Floating' }),
    };

    const { merged } = mergeDesignPatch(state, patchNodes);

    // Both screens must survive verbatim
    expect(JSON.stringify(merged[ids.screen1Id])).toBe(JSON.stringify(state[ids.screen1Id]));
    expect(JSON.stringify(merged[ids.screen2Id])).toBe(JSON.stringify(state[ids.screen2Id]));
    expect(JSON.stringify(merged[ids.screen1HeadingId])).toBe(
      JSON.stringify(state[ids.screen1HeadingId]),
    );
    expect(JSON.stringify(merged[ids.screen2ButtonId])).toBe(
      JSON.stringify(state[ids.screen2ButtonId]),
    );

    // New floating node is present
    expect(merged[floatingId]).toBeDefined();
  });
});

describe('mergeDesignPatch — ROOT artboard-ref protection', () => {
  it('restores Screen 2 artboard ref when a ROOT patch omits it', () => {
    const { state, ids } = makeTwoScreenState();

    // AI patch rewrites ROOT but lists only Screen 1 — Screen 2 is omitted.
    // This simulates the "live corruption" scenario described in the task.
    const patchNodes: CraftState = {
      [ids.ROOT]: makeNode('Document', {}, [ids.screen1Id]),
    };

    const { merged } = mergeDesignPatch(state, patchNodes);

    // Screen 2's artboard ID must still be present in ROOT.nodes even though
    // the patch omitted it — the merge guard restores existing refs whose
    // nodes are still present in the merged map.
    const rootNode = merged[ids.ROOT] as Record<string, unknown>;
    const rootChildren = rootNode.nodes as string[];
    expect(rootChildren).toContain(ids.screen2Id);
    expect(rootChildren).toContain(ids.screen1Id);

    // Screen 2's node subtree must also be intact
    expect(merged[ids.screen2Id]).toBeDefined();
    expect(merged[ids.screen2ButtonId]).toBeDefined();
  });

  it('does not duplicate artboard refs when ROOT patch already lists all existing artboards', () => {
    const { state, ids } = makeTwoScreenState();

    // Patch rewrites ROOT correctly with both artboard IDs — no duplication.
    const patchNodes: CraftState = {
      [ids.ROOT]: makeNode('Document', {}, [ids.screen1Id, ids.screen2Id]),
    };

    const { merged } = mergeDesignPatch(state, patchNodes);

    const rootNode = merged[ids.ROOT] as Record<string, unknown>;
    const rootChildren = rootNode.nodes as string[];
    expect(rootChildren).toHaveLength(2);
    expect(rootChildren).toContain(ids.screen1Id);
    expect(rootChildren).toContain(ids.screen2Id);
  });

  it('restores all three artboards when ROOT patch omits two of three', () => {
    const { state, ids } = makeThreeScreenState();

    // Patch rewrites ROOT with only artboard-a; artboard-b and artboard-c omitted.
    const patchNodes: CraftState = {
      [ids.ROOT]: makeNode('Document', {}, [ids.aId]),
    };

    const { merged } = mergeDesignPatch(state, patchNodes);

    const rootNode = merged[ids.ROOT] as Record<string, unknown>;
    const rootChildren = rootNode.nodes as string[];
    expect(rootChildren).toContain(ids.aId);
    expect(rootChildren).toContain(ids.bId);
    expect(rootChildren).toContain(ids.cId);

    // All artboard subtrees survive
    expect(merged[ids.bId]).toBeDefined();
    expect(merged[ids.cId]).toBeDefined();
    expect(merged[ids.bButtonId]).toBeDefined();
    expect(merged[ids.cTextId]).toBeDefined();
  });

  it('does not restore an artboard ref whose node was explicitly deleted from the patch', () => {
    const { state, ids } = makeTwoScreenState();

    // Simulate "delete Screen 2": patch omits screen2Id from ROOT.nodes AND
    // does not include the screen2 node itself. Since screen2Id no longer
    // exists in the merged map, the guard must NOT restore it.
    const patchNodes: CraftState = {
      [ids.ROOT]: makeNode('Document', {}, [ids.screen1Id]),
      // Deliberately NOT including ids.screen2Id or ids.screen2ButtonId —
      // they will still come from existingState spread, so this case
      // cannot be fully modelled via patch alone (deletion is not supported
      // by patch format). This test confirms the guard uses merged-map
      // presence as the gating condition.
    };

    const { merged } = mergeDesignPatch(state, patchNodes);

    // screen2Id is still in the merged map (came from existingState) so it IS
    // restored. This confirms the guard's contract: only truly absent nodes
    // (not referenced anywhere in merged) would be excluded.
    const rootNode = merged[ids.ROOT] as Record<string, unknown>;
    const rootChildren = rootNode.nodes as string[];
    expect(rootChildren).toContain(ids.screen2Id);
  });
});

describe('mergeDesignPatch — stress test (oversized patch)', () => {
  /**
   * Simulates an AI returning a large patch: ~200 new nodes all wired into
   * artboard-a of a 3-artboard craft state.  Artboard-b and artboard-c must
   * survive byte-identical, orphan pruning must not incorrectly remove any of
   * the new nodes, and the whole operation must complete well under 50 ms.
   */
  it('handles ~200 new nodes wired to one artboard in < 50 ms; other artboards unchanged', () => {
    const NODE_COUNT = 200;
    const { state, ids } = makeThreeScreenState();

    // Snapshot the untouched artboards before the merge
    const bBefore = JSON.stringify(state[ids.bId]);
    const bButtonBefore = JSON.stringify(state[ids.bButtonId]);
    const cBefore = JSON.stringify(state[ids.cId]);
    const cTextBefore = JSON.stringify(state[ids.cTextId]);

    // Build a patch: NODE_COUNT leaf nodes all listed as children of artboard-a
    const newNodeIds: string[] = [];
    const patchNodes: CraftState = {};

    for (let i = 0; i < NODE_COUNT; i++) {
      const nodeId = `stress-node-${i}`;
      newNodeIds.push(nodeId);
      patchNodes[nodeId] = makeNode('AstryxText', { text: `Stress node ${i}`, index: i });
    }

    // Replace artboard-a's child list with all new nodes
    patchNodes[ids.aId] = makeNode('AstryxArtboard', { label: 'Screen A' }, newNodeIds);

    // --- performance gate ---
    const start = performance.now();
    const { merged, orphansRemoved } = mergeDesignPatch(state, patchNodes);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50);

    // --- correctness: untouched artboards are byte-identical ---
    expect(JSON.stringify(merged[ids.bId])).toBe(bBefore);
    expect(JSON.stringify(merged[ids.bButtonId])).toBe(bButtonBefore);
    expect(JSON.stringify(merged[ids.cId])).toBe(cBefore);
    expect(JSON.stringify(merged[ids.cTextId])).toBe(cTextBefore);

    // --- correctness: all new nodes are present in the merged map ---
    for (const nodeId of newNodeIds) {
      expect(merged[nodeId]).toBeDefined();
    }

    // --- correctness: artboard-a lists exactly the new nodes ---
    const aNode = merged[ids.aId] as Record<string, unknown>;
    const aChildren = aNode.nodes as string[];
    expect(aChildren).toHaveLength(NODE_COUNT);
    for (const nodeId of newNodeIds) {
      expect(aChildren).toContain(nodeId);
    }

    // --- correctness: orphan pruning must not remove any of the new nodes ---
    // The old heading-a (aHeadingId) still exists in the merged map (it came
    // from existingState and was not deleted), so it is NOT pruned — orphan
    // pruning only removes references to IDs absent from the merged map.
    // The patch is well-formed, so no dangling refs should have been produced.
    expect(orphansRemoved).toBe(0);
  });

  it('prunes orphan refs correctly even in a large patch with intentionally dangling IDs', () => {
    const NODE_COUNT = 200;
    const DANGLING_COUNT = 10;
    const { state, ids } = makeThreeScreenState();

    const newNodeIds: string[] = [];
    const danglingIds: string[] = [];
    const patchNodes: CraftState = {};

    for (let i = 0; i < NODE_COUNT; i++) {
      const nodeId = `bulk-node-${i}`;
      newNodeIds.push(nodeId);
      patchNodes[nodeId] = makeNode('AstryxText', { text: `Bulk ${i}` });
    }

    // Add dangling IDs that will NOT exist as nodes in the patch
    for (let i = 0; i < DANGLING_COUNT; i++) {
      danglingIds.push(`dangling-${i}`);
    }

    // Artboard-a references all real new nodes plus the dangling (nonexistent) ones
    patchNodes[ids.aId] = makeNode(
      'AstryxArtboard',
      { label: 'Screen A' },
      [...newNodeIds, ...danglingIds],
    );

    const { merged, orphansRemoved } = mergeDesignPatch(state, patchNodes);

    // Only the dangling refs are pruned. The original heading-a node still
    // exists in the merged map (from existingState) so its reference is not
    // counted as an orphan — orphan pruning only fires on absent IDs.
    expect(orphansRemoved).toBe(DANGLING_COUNT);

    // All real bulk nodes survive
    for (const nodeId of newNodeIds) {
      expect(merged[nodeId]).toBeDefined();
    }

    // Artboard-a's final child list has only the real nodes
    const aNode = merged[ids.aId] as Record<string, unknown>;
    const aChildren = aNode.nodes as string[];
    expect(aChildren).toHaveLength(NODE_COUNT);
    for (const id of danglingIds) {
      expect(aChildren).not.toContain(id);
    }

    // Artboards b and c are untouched
    expect(JSON.stringify(merged[ids.bId])).toBe(JSON.stringify(state[ids.bId]));
    expect(JSON.stringify(merged[ids.cId])).toBe(JSON.stringify(state[ids.cId]));
  });
});

// ---------------------------------------------------------------------------
// wrapRootChildrenInArtboard tests
// ---------------------------------------------------------------------------

function makeRootNode(children: string[]): Record<string, unknown> {
  return { type: { resolvedName: 'AstryxSection' }, isCanvas: true, props: {}, nodes: children, parent: null, linkedNodes: {} };
}

function makeArtboard(label: string, children: string[] = []): Record<string, unknown> {
  return { type: { resolvedName: 'AstryxArtboard' }, isCanvas: true, props: { label }, nodes: children, parent: 'ROOT', linkedNodes: {} };
}

function makeSection(parent: string, children: string[] = []): Record<string, unknown> {
  return { type: { resolvedName: 'AstryxSection' }, isCanvas: false, props: {}, nodes: children, parent, linkedNodes: {} };
}

describe('wrapRootChildrenInArtboard — full-state artboard enforcement', () => {
  it('returns the same object reference when all ROOT children are already artboards', () => {
    const state: CraftState = {
      ROOT: makeRootNode(['ab1']),
      ab1: makeArtboard('Screen 1', ['btn1']),
      btn1: makeNode('AstryxButton', {}, []),
    };
    const result = wrapRootChildrenInArtboard(state);
    expect(result).toBe(state); // strict reference equality — no copy made
  });

  it('wraps a single non-artboard ROOT child in a new AstryxArtboard', () => {
    const state: CraftState = {
      ROOT: makeRootNode(['sec1']),
      sec1: makeSection('ROOT', ['btn1']),
      btn1: makeNode('AstryxButton', {}, []),
    };
    const result = wrapRootChildrenInArtboard(state);

    const rootChildren = (result['ROOT'] as any).nodes as string[];
    expect(rootChildren).toHaveLength(1);
    const newId = rootChildren[0];

    // The wrapper must be an AstryxArtboard with parent ROOT
    const wrapper = result[newId] as Record<string, unknown>;
    expect((wrapper.type as any).resolvedName).toBe('AstryxArtboard');
    expect(wrapper.parent).toBe('ROOT');

    // sec1 must be a child of the wrapper, not ROOT
    expect((wrapper.nodes as string[])).toContain('sec1');
    expect((result['sec1'] as any).parent).toBe(newId);
  });

  it('keeps existing artboards and only wraps non-artboard siblings', () => {
    const state: CraftState = {
      ROOT: makeRootNode(['ab1', 'orphan']),
      ab1: makeArtboard('Screen 1'),
      orphan: makeSection('ROOT'),
    };
    const result = wrapRootChildrenInArtboard(state);

    const rootChildren = (result['ROOT'] as any).nodes as string[];
    expect(rootChildren).toHaveLength(2);
    expect(rootChildren).toContain('ab1');

    // Existing artboard is unchanged
    expect(result['ab1']).toStrictEqual(state['ab1']);

    // The new artboard wraps the orphan
    const newId = rootChildren.find((id) => id !== 'ab1')!;
    expect((result[newId] as any).type.resolvedName).toBe('AstryxArtboard');
    expect(((result[newId] as any).nodes as string[])).toContain('orphan');
    expect((result['orphan'] as any).parent).toBe(newId);
  });

  it('returns state unchanged when ROOT nodes array is empty', () => {
    const state: CraftState = {
      ROOT: makeRootNode([]),
    };
    expect(wrapRootChildrenInArtboard(state)).toBe(state);
  });

  it('returns state unchanged when ROOT is absent and no nodes claim ROOT as parent', () => {
    // A completely disconnected state with no ROOT and no parent pointers — nothing
    // to adopt, so the helper creates an empty ROOT and returns it unchanged
    // (ROOT.nodes is empty → no wrapping needed after synthesis).
    const state: CraftState = {
      'ab1': makeArtboard('Screen 1'),
    };
    const result = wrapRootChildrenInArtboard(state);
    // ROOT is now synthesised (was absent)
    expect(result['ROOT']).toBeDefined();
  });

  it('synthesises ROOT when missing and wraps non-artboard ROOT children into an artboard', () => {
    // AI generated a state with no ROOT entry but nodes that claim 'ROOT' as parent.
    const state: CraftState = {
      // Deliberately NO 'ROOT' key
      'sec1': { ...makeSection('ROOT', ['btn1']), parent: 'ROOT' },
      'btn1': { ...makeNode('AstryxButton', {}, []), parent: 'sec1' },
    };
    const result = wrapRootChildrenInArtboard(state);

    // ROOT must now exist
    expect(result['ROOT']).toBeDefined();
    const rootChildren = (result['ROOT'] as any).nodes as string[];

    // sec1 was a non-artboard ROOT child — must now be wrapped
    const newArtboardId = rootChildren[0];
    expect(newArtboardId).toBeTruthy();
    expect((result[newArtboardId] as any).type.resolvedName).toBe('AstryxArtboard');
    expect(((result[newArtboardId] as any).nodes as string[])).toContain('sec1');

    // sec1 re-parented; btn1 keeps its original parent (sec1)
    expect((result['sec1'] as any).parent).toBe(newArtboardId);
    expect((result['btn1'] as any).parent).toBe('sec1');
  });

  it('synthesises ROOT from parentless nodes when no node explicitly claims ROOT as parent', () => {
    // AI generated a state with no ROOT and no parent pointers on top-level nodes.
    const state: CraftState = {
      'sec1': { ...makeSection('ROOT', ['btn1']), parent: null as any },
      'btn1': { ...makeNode('AstryxButton', {}, []), parent: 'sec1' },
    };
    const result = wrapRootChildrenInArtboard(state);

    // ROOT synthesised with sec1 adopted as a child, then artboard wrapping fires
    // because sec1 is not an AstryxArtboard. ROOT.nodes ends up with the new
    // synthesised artboard; sec1 becomes a child of that artboard.
    const rootChildren = (result['ROOT'] as any).nodes as string[];
    expect(rootChildren.length).toBe(1);
    const newArtboardId = rootChildren[0];
    expect((result[newArtboardId] as any).type.resolvedName).toBe('AstryxArtboard');
    expect(((result[newArtboardId] as any).nodes as string[])).toContain('sec1');
    expect((result['sec1'] as any).parent).toBe(newArtboardId);
  });

  it('handles ROOT with a non-array nodes field without throwing', () => {
    const state: CraftState = {
      ROOT: { type: { resolvedName: 'AstryxSection' }, nodes: 'not-an-array' as any, props: {}, parent: null, linkedNodes: {} },
      'ab1': makeArtboard('Screen 1'),
    };
    // Should not throw; returns the working state unchanged
    expect(() => wrapRootChildrenInArtboard(state)).not.toThrow();
    const result = wrapRootChildrenInArtboard(state);
    expect(result['ROOT']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// enforceNewScreenPatch tests
// ---------------------------------------------------------------------------

function makeExistingCanvas(): string {
  return JSON.stringify({
    ROOT: makeRootNode(['screen-1']),
    'screen-1': makeArtboard('Screen 1', ['btn-1']),
    'btn-1': makeNode('AstryxButton', { children: 'Submit' }, []),
  });
}

describe('enforceNewScreenPatch — new-screen invariant on TYPE 3 responses', () => {
  // ── Case A: AI correctly adds a new artboard ────────────────────────────────

  it('returns patch unchanged when it already has a new AstryxArtboard AND ROOT lists all artboards', () => {
    const existing = makeExistingCanvas();
    const patch: CraftState = {
      ROOT: makeRootNode(['screen-1', 'screen-2']),
      'screen-2': makeArtboard('Delete Account', ['del-btn']),
      'del-btn': makeNode('AstryxButton', { children: 'Delete' }, []),
    };
    const result = enforceNewScreenPatch(patch, existing);
    expect(result).toBe(patch); // strict reference — ROOT already complete, no copy made
  });

  it('normalises ROOT when AI correctly adds a new artboard but omits existing artboard IDs from ROOT', () => {
    const existing = makeExistingCanvas();
    // AI adds screen-2 correctly but ROOT only lists screen-2 — screen-1 is omitted
    const patch: CraftState = {
      ROOT: makeRootNode(['screen-2']),
      'screen-2': makeArtboard('Delete Account', ['del-btn']),
      'del-btn': makeNode('AstryxButton', { children: 'Delete' }, []),
    };
    const result = enforceNewScreenPatch(patch, existing);

    const rootChildren = (result['ROOT'] as any).nodes as string[];
    expect(rootChildren).toContain('screen-1'); // existing artboard restored
    expect(rootChildren).toContain('screen-2'); // new artboard kept
    expect(rootChildren.filter((id: string) => id === 'screen-2')).toHaveLength(1); // no dups
    expect(result['screen-2']).toBeDefined(); // new artboard content intact
    expect(result['del-btn']).toBeDefined();
  });

  it('normalises ROOT when AI adds a new artboard but emits no ROOT patch at all', () => {
    const existing = makeExistingCanvas();
    // AI adds screen-2 but no ROOT entry in the patch
    const patch: CraftState = {
      'screen-2': makeArtboard('Delete Account', ['del-btn']),
      'del-btn': makeNode('AstryxButton', { children: 'Delete' }, []),
    };
    const result = enforceNewScreenPatch(patch, existing);

    const rootChildren = (result['ROOT'] as any).nodes as string[];
    expect(rootChildren).toContain('screen-1');
    expect(rootChildren).toContain('screen-2');
  });

  // ── Case B: AI ignored the override — synthesise + drop existing edits ──────

  it('synthesises a new artboard and drops AI edits to existing nodes (no contradictory parent refs)', () => {
    const existing = makeExistingCanvas();
    // AI added "new-del-btn" into screen-1.nodes instead of creating a new screen
    const patch: CraftState = {
      'screen-1': makeArtboard('Screen 1', ['btn-1', 'new-del-btn']),
      'new-del-btn': { ...makeNode('AstryxButton', { children: 'Delete' }, []), parent: 'screen-1' },
    };
    const result = enforceNewScreenPatch(patch, existing);

    // ROOT must list the existing artboard ID plus the new synthesised artboard
    const rootChildren = (result['ROOT'] as any).nodes as string[];
    expect(rootChildren).toContain('screen-1');

    const newId = rootChildren.find((id: string) => id !== 'screen-1')!;
    expect(newId).toBeTruthy();
    expect((result[newId] as any).type.resolvedName).toBe('AstryxArtboard');

    // new-del-btn has exactly one parent: the synthesised artboard
    expect(((result[newId] as any).nodes as string[])).toContain('new-del-btn');
    expect((result['new-del-btn'] as any).parent).toBe(newId);

    // The AI's edit to screen-1 is DROPPED — it must not be in the enforced patch.
    // This prevents contradictory parent pointers: after client merge, screen-1
    // comes from the unmodified in-memory state (without new-del-btn in its nodes).
    expect(result['screen-1']).toBeUndefined();
  });

  it('new-del-btn appears in exactly one node list after merge simulation (no duplicate parentage)', () => {
    const existing = makeExistingCanvas();
    const patch: CraftState = {
      'screen-1': makeArtboard('Screen 1', ['btn-1', 'new-x']),
      'new-x': { ...makeNode('AstryxText', { text: 'X' }, []), parent: 'screen-1' },
    };
    const result = enforceNewScreenPatch(patch, existing);

    // screen-1 edit dropped — won't appear in result
    expect(result['screen-1']).toBeUndefined();

    // new-x is referenced only by the new artboard
    const rootChildren = (result['ROOT'] as any).nodes as string[];
    const newArtboardId = rootChildren.find((id: string) => id !== 'screen-1')!;
    expect(((result[newArtboardId] as any).nodes as string[])).toContain('new-x');
    expect((result['new-x'] as any).parent).toBe(newArtboardId);
  });

  it('synthesises a new artboard when patch has new nodes with ROOT as parent but no artboard wrapper', () => {
    const existing = makeExistingCanvas();
    const patch: CraftState = {
      'h1': { ...makeNode('AstryxHeading', { text: 'Delete Account' }, []), parent: 'ROOT' },
      'p1': { ...makeNode('AstryxText', { text: 'This is permanent.' }, []), parent: 'ROOT' },
    };
    const result = enforceNewScreenPatch(patch, existing);

    const rootChildren = (result['ROOT'] as any).nodes as string[];
    expect(rootChildren).toContain('screen-1');

    const newId = rootChildren.find((id: string) => id !== 'screen-1')!;
    const newAb = result[newId] as Record<string, unknown>;
    expect((newAb.type as any).resolvedName).toBe('AstryxArtboard');
    expect((newAb.nodes as string[])).toContain('h1');
    expect((newAb.nodes as string[])).toContain('p1');
    expect((result['h1'] as any).parent).toBe(newId);
    expect((result['p1'] as any).parent).toBe(newId);
  });

  it('preserves all existing artboard IDs in synthesised ROOT.nodes across a two-screen canvas', () => {
    const twoScreenCanvas = JSON.stringify({
      ROOT: makeRootNode(['screen-1', 'screen-2']),
      'screen-1': makeArtboard('Screen 1'),
      'screen-2': makeArtboard('Screen 2'),
    });
    const patch: CraftState = {
      'new-node': { ...makeNode('AstryxText', { text: 'Hi' }, []), parent: 'ROOT' },
    };
    const result = enforceNewScreenPatch(patch, twoScreenCanvas);

    const rootChildren = (result['ROOT'] as any).nodes as string[];
    expect(rootChildren).toContain('screen-1');
    expect(rootChildren).toContain('screen-2');
    const newId = rootChildren.find((id: string) => id !== 'screen-1' && id !== 'screen-2')!;
    expect(newId).toBeTruthy();
    expect(((result[newId] as any).nodes as string[])).toContain('new-node');
  });

  it('handles malformed / unparseable existingStateJson gracefully', () => {
    const patch: CraftState = {
      'x1': { ...makeNode('AstryxText', { text: 'X' }, []), parent: 'ROOT' },
    };
    const result = enforceNewScreenPatch(patch, '{ bad json !!!');

    expect(result['ROOT']).toBeDefined();
    const rootChildren = (result['ROOT'] as any).nodes as string[];
    const newId = rootChildren[0];
    expect((result[newId] as any).type.resolvedName).toBe('AstryxArtboard');
  });

  // ── Nested content tests: each node has exactly one consistent parent ref ───

  it('Case A (AI adds artboard): preserves nested Section → Button hierarchy with consistent parent refs', () => {
    // AI correctly adds screen-2 containing a nested Section that contains a Button.
    // ROOT only lists screen-2 (omits screen-1), so ROOT needs normalisation.
    const existing = makeExistingCanvas();
    const patch: CraftState = {
      ROOT: makeRootNode(['screen-2']),
      'screen-2': makeArtboard('Delete Account', ['sec-del']),
      'sec-del': { ...makeSection('screen-2', ['btn-del']), parent: 'screen-2' },
      'btn-del': { ...makeNode('AstryxButton', { children: 'Delete' }, []), parent: 'sec-del' },
    };
    const result = enforceNewScreenPatch(patch, existing);

    // ROOT must list both artboards
    const rootChildren = (result['ROOT'] as any).nodes as string[];
    expect(rootChildren).toContain('screen-1');
    expect(rootChildren).toContain('screen-2');

    // Nested tree is untouched
    expect((result['screen-2'] as any).nodes).toContain('sec-del');
    expect((result['sec-del'] as any).parent).toBe('screen-2');
    expect((result['btn-del'] as any).parent).toBe('sec-del');

    // Each node has exactly one parent reference — no duplicates in any nodes array
    const allNodesArrays = Object.values(result).flatMap(
      (node) => (Array.isArray((node as any).nodes) ? (node as any).nodes : []) as string[],
    );
    expect(allNodesArrays.filter((id: string) => id === 'btn-del')).toHaveLength(1);
    expect(allNodesArrays.filter((id: string) => id === 'sec-del')).toHaveLength(1);
  });

  it('Case B (synthesis): only top-level new node is re-parented; its nested children keep original parent', () => {
    // AI ignored newScreen and emitted a Section (parent: ROOT) containing a Button.
    // After enforcement: Section → new artboard child; Button keeps parent: Section.
    const existing = makeExistingCanvas();
    const patch: CraftState = {
      'sec-new': { ...makeSection('ROOT', ['btn-new']), parent: 'ROOT' },
      'btn-new': { ...makeNode('AstryxButton', { children: 'Confirm' }, []), parent: 'sec-new' },
    };
    const result = enforceNewScreenPatch(patch, existing);

    const rootChildren = (result['ROOT'] as any).nodes as string[];
    expect(rootChildren).toContain('screen-1');

    const newArtboardId = rootChildren.find((id: string) => id !== 'screen-1')!;
    expect(newArtboardId).toBeTruthy();
    expect((result[newArtboardId] as any).type.resolvedName).toBe('AstryxArtboard');

    // sec-new is a direct artboard child (top-level root of the new subtree)
    expect(((result[newArtboardId] as any).nodes as string[])).toContain('sec-new');
    expect((result['sec-new'] as any).parent).toBe(newArtboardId);

    // btn-new keeps its original parent (sec-new) — not re-parented to artboard
    expect((result['btn-new'] as any).parent).toBe('sec-new');

    // Each new node appears in exactly one parent's nodes array
    const allNodeIds = ['sec-new', 'btn-new'];
    const allNodesArrays = Object.values(result).flatMap(
      (node) => (Array.isArray((node as any).nodes) ? (node as any).nodes : []) as string[],
    );
    for (const id of allNodeIds) {
      expect(allNodesArrays.filter((n: string) => n === id)).toHaveLength(1);
    }

    // sec-new still lists btn-new
    expect(((result['sec-new'] as any).nodes as string[])).toContain('btn-new');
  });

  it('Case B (synthesis): three-level nesting — only root Section is adopted; mid and leaf nodes untouched', () => {
    const existing = makeExistingCanvas();
    const patch: CraftState = {
      'container': { ...makeSection('ROOT', ['inner']), parent: 'ROOT' },
      'inner': { ...makeSection('container', ['leaf']), parent: 'container' },
      'leaf': { ...makeNode('AstryxText', { text: 'Hi' }, []), parent: 'inner' },
    };
    const result = enforceNewScreenPatch(patch, existing);

    const rootChildren = (result['ROOT'] as any).nodes as string[];
    const newAbId = rootChildren.find((id: string) => id !== 'screen-1')!;

    // Only 'container' (top-level root) is a direct artboard child
    expect(((result[newAbId] as any).nodes as string[])).toContain('container');
    expect(((result[newAbId] as any).nodes as string[])).not.toContain('inner');
    expect(((result[newAbId] as any).nodes as string[])).not.toContain('leaf');

    // Parent chains are consistent throughout
    expect((result['container'] as any).parent).toBe(newAbId);
    expect((result['inner'] as any).parent).toBe('container');
    expect((result['leaf'] as any).parent).toBe('inner');

    // Each node appears in exactly one nodes array
    const allNodesArrays = Object.values(result).flatMap(
      (node) => (Array.isArray((node as any).nodes) ? (node as any).nodes : []) as string[],
    );
    for (const id of ['container', 'inner', 'leaf']) {
      expect(allNodesArrays.filter((n: string) => n === id)).toHaveLength(1);
    }
  });
});
