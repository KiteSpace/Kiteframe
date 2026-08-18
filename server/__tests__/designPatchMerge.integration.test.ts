/**
 * HTTP-level integration test for POST /api/ai/design — patch merge isolation.
 *
 * Verifies that when the AI returns a patch targeting only Screen 1:
 *   1. The HTTP response type is 'state' (not 'patch').
 *   2. Screen 2's node tree is byte-identical to the input craft state.
 *   3. New nodes appear only inside Screen 1's artboard child list.
 *
 * executeAiChat is mocked so no real AI call is made. The rest of the
 * handler — JSON reconstruction, mergeDesignPatch invocation, and HTTP
 * response shaping — runs through the real designGenerationHandler code.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { designGenerationHandler } from '../designHandlers';

// ---------------------------------------------------------------------------
// Mock executeAiChat — controlled per-test via `mockAiText`
// ---------------------------------------------------------------------------
let mockAiText: string = '';

vi.mock('../aiChatExecutor', () => ({
  executeAiChat: vi.fn(async () => ({
    ok: true,
    text: mockAiText,
    json: {},
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(
  resolvedName: string,
  props: Record<string, unknown> = {},
  children: string[] = [],
) {
  return { type: { resolvedName }, props, nodes: children, linkedNodes: {} };
}

/**
 * Build a craft state with two artboards and return both the JSON string
 * (to send as currentCraftState) and the parsed object (for assertions).
 */
function makeTwoScreenCraftState() {
  const ROOT = 'ROOT';
  const screen1Id = 'artboard-screen1';
  const screen1HeadingId = 'heading-s1';
  const screen2Id = 'artboard-screen2';
  const screen2ButtonId = 'button-s2';

  const state: Record<string, unknown> = {
    [ROOT]: makeNode('Document', {}, [screen1Id, screen2Id]),
    [screen1Id]: makeNode('AstryxArtboard', { label: 'Screen 1' }, [screen1HeadingId]),
    [screen1HeadingId]: makeNode('AstryxHeading', { text: 'Hello' }),
    [screen2Id]: makeNode('AstryxArtboard', { label: 'Screen 2' }, [screen2ButtonId]),
    [screen2ButtonId]: makeNode('AstryxButton', { label: 'Submit' }),
  };

  return { state, stateJson: JSON.stringify(state), ids: { ROOT, screen1Id, screen1HeadingId, screen2Id, screen2ButtonId } };
}

/**
 * Build the mock AI text for a patch response.
 *
 * The route prepends '{' before calling JSON.parse, so the text returned by
 * the mock must be the JSON body WITHOUT the opening '{'.
 */
function makePatchText(nodes: Record<string, unknown>): string {
  const full = JSON.stringify({ type: 'patch', nodes });
  return full.slice(1); // strip leading '{'
}

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.post('/api/ai/design', designGenerationHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/ai/design — Screen 2 isolation after patch merge', () => {
  beforeEach(() => {
    mockAiText = '';
  });

  it('returns type:state and Screen 2 node tree is byte-identical to the input', async () => {
    const { state, stateJson, ids } = makeTwoScreenCraftState();

    const screen2Before = JSON.stringify(state[ids.screen2Id]);
    const screen2ButtonBefore = JSON.stringify(state[ids.screen2ButtonId]);

    const newBtnId = 'button-new-s1';

    // AI patch: add one button to Screen 1 only
    mockAiText = makePatchText({
      [ids.screen1Id]: makeNode('AstryxArtboard', { label: 'Screen 1' }, [
        ids.screen1HeadingId,
        newBtnId,
      ]),
      [newBtnId]: makeNode('AstryxButton', { label: 'Add item' }),
    });

    const res = await request(createApp())
      .post('/api/ai/design')
      .send({
        prompt: 'Add a button to Screen 1',
        currentCraftState: stateJson,
        targetArtboardLabel: 'Screen 1',
      })
      .expect(200);

    // HTTP contract: response type must be 'state'
    expect(res.body.type).toBe('state');
    expect(typeof res.body.craftState).toBe('string');

    const merged = JSON.parse(res.body.craftState) as Record<string, unknown>;

    // Screen 2 artboard and its child must be byte-identical to the input
    expect(JSON.stringify(merged[ids.screen2Id])).toBe(screen2Before);
    expect(JSON.stringify(merged[ids.screen2ButtonId])).toBe(screen2ButtonBefore);

    // New node exists in the merged state
    expect(merged[newBtnId]).toBeDefined();

    // New node is referenced by Screen 1's artboard
    const s1 = merged[ids.screen1Id] as Record<string, unknown>;
    expect((s1.nodes as string[])).toContain(newBtnId);

    // New node is NOT referenced by Screen 2's artboard
    const s2 = merged[ids.screen2Id] as Record<string, unknown>;
    expect((s2.nodes as string[])).not.toContain(newBtnId);
  });

  it('returns 400 for an empty prompt', async () => {
    const { stateJson } = makeTwoScreenCraftState();

    const res = await request(createApp())
      .post('/api/ai/design')
      .send({ prompt: '', currentCraftState: stateJson })
      .expect(400);

    expect(res.body.error).toMatch(/prompt/i);
  });

  it('returns type:state with all nodes intact when AI replaces Screen 1 artboard entirely', async () => {
    const { state, stateJson, ids } = makeTwoScreenCraftState();

    const screen2Before = JSON.stringify(state[ids.screen2Id]);
    const newHeadingId = 'heading-new';

    mockAiText = makePatchText({
      [ids.screen1Id]: makeNode('AstryxArtboard', { label: 'Screen 1' }, [newHeadingId]),
      [newHeadingId]: makeNode('AstryxHeading', { text: 'Replaced heading' }),
    });

    const res = await request(createApp())
      .post('/api/ai/design')
      .send({
        prompt: 'Replace the heading on Screen 1',
        currentCraftState: stateJson,
        targetArtboardLabel: 'Screen 1',
      })
      .expect(200);

    expect(res.body.type).toBe('state');

    const merged = JSON.parse(res.body.craftState) as Record<string, unknown>;

    // Screen 2 untouched
    expect(JSON.stringify(merged[ids.screen2Id])).toBe(screen2Before);

    // New heading appears in Screen 1
    const s1 = merged[ids.screen1Id] as Record<string, unknown>;
    expect((s1.nodes as string[])).toContain(newHeadingId);
    expect((s1.nodes as string[])).not.toContain(ids.screen1HeadingId);
  });
});
