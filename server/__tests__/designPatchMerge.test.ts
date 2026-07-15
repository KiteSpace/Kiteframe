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
import { mergeDesignPatch, type CraftState } from '../lib/designPatchMerge';

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
