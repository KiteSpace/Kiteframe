/**
 * Integration test (task #513): the designs API must never delete valid
 * AI-generated artboards that are missing from ROOT's `nodes` array.
 *
 * The POST/PATCH design handlers run repairCraftState → pruneUnreachableCraftNodes
 * → validateCraftState before persisting. Before the fix, repair did NOT
 * reattach orphaned nodes, so pruning silently deleted content-bearing
 * artboards and users saw a blank canvas while the layers panel showed data.
 *
 * The handler below is a faithful copy of the craftState pipeline in
 * server/routes.ts (POST /api/designs and PATCH /api/designs/:id) using the
 * REAL designSchema functions — only auth and storage are stubbed (routes.ts
 * cannot be imported directly due to heavy top-level side effects; see
 * designRename.integration.test.ts for the same pattern).
 *
 * The REGISTERED production routes are additionally verified against the live
 * server by scripts/e2e-orphan-artboard.mjs (forged-session browser + API
 * e2e), which asserts POST and PATCH both persist reattached artboards and
 * prune empty ghosts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import {
  repairCraftState,
  pruneUnreachableCraftNodes,
  validateCraftState,
} from '../lib/designSchema';

// ─── In-memory store ──────────────────────────────────────────────────────────

const designStore = new Map<string, { craftState: unknown }>();
let nextId = 1;

function buildApp() {
  const app = express();
  app.use(express.json());

  // Same pipeline as POST /api/designs in server/routes.ts
  app.post('/api/designs', (req: Request, res: Response) => {
    let state: unknown = req.body?.craftState;
    if (typeof state === 'string') {
      try { state = JSON.parse(state); } catch {
        return res.status(400).json({ error: 'craftState is not valid JSON' });
      }
    }
    const repairedState = repairCraftState(state);
    const prunedState = pruneUnreachableCraftNodes(repairedState);
    const { valid, errors } = validateCraftState(repairCraftState(prunedState));
    if (!valid) return res.status(422).json({ error: 'craftState failed validation.', details: errors });
    const id = `design-${nextId++}`;
    designStore.set(id, { craftState: prunedState });
    res.status(201).json({ id, craftState: prunedState });
  });

  // Same pipeline as PATCH /api/designs/:id in server/routes.ts
  app.patch('/api/designs/:id', (req: Request, res: Response) => {
    const design = designStore.get(req.params.id);
    if (!design) return res.status(404).json({ error: 'Design not found.' });
    let state: unknown = req.body?.craftState;
    if (typeof state === 'string') {
      try { state = JSON.parse(state); } catch {
        return res.status(400).json({ error: 'craftState is not valid JSON' });
      }
    }
    const repairedState = repairCraftState(state);
    const prunedState = pruneUnreachableCraftNodes(repairedState);
    const { valid, errors } = validateCraftState(repairCraftState(prunedState));
    if (!valid) return res.status(422).json({ error: 'craftState failed validation.', details: errors });
    design.craftState = prunedState;
    res.json({ id: req.params.id, craftState: prunedState });
  });

  return app;
}

// ─── Fixture: AI output where "dashboard" artboard is missing from ROOT.nodes ─

const node = (over: Record<string, unknown>) => ({
  isCanvas: false, props: {}, displayName: '', custom: {}, hidden: false,
  nodes: [], linkedNodes: {}, ...over,
});

function orphanedArtboardState() {
  return {
    ROOT: node({
      type: { resolvedName: 'AstryxSection' }, isCanvas: true, parent: null,
      displayName: 'AstryxSection', nodes: ['login'],
    }),
    login: node({
      type: { resolvedName: 'AstryxArtboard' }, isCanvas: true, parent: 'ROOT',
      props: { label: 'Login' }, displayName: 'AstryxArtboard', nodes: ['btn'],
    }),
    btn: node({
      type: { resolvedName: 'AstryxButton' }, parent: 'login',
      props: { children: 'Sign in' }, displayName: 'AstryxButton',
    }),
    // Orphan: parent says ROOT, but ROOT.nodes does not list it.
    dashboard: node({
      type: { resolvedName: 'AstryxArtboard' }, isCanvas: true, parent: 'ROOT',
      props: { label: 'Dashboard' }, displayName: 'AstryxArtboard', nodes: ['heading'],
    }),
    heading: node({
      type: { resolvedName: 'AstryxHeading' }, parent: 'dashboard',
      props: { children: 'Overview' }, displayName: 'AstryxHeading',
    }),
    // Genuinely empty ghost — must still be pruned.
    ghost: node({
      type: { resolvedName: 'AstryxArtboard' }, isCanvas: true, parent: 'ROOT',
      props: { label: 'Ghost' }, displayName: 'AstryxArtboard',
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('designs API — orphaned artboard repair before pruning', () => {
  beforeEach(() => { designStore.clear(); });

  it('POST keeps a content-bearing artboard missing from ROOT.nodes', async () => {
    const res = await request(buildApp())
      .post('/api/designs')
      .send({ craftState: JSON.stringify(orphanedArtboardState()) });
    expect(res.status).toBe(201);
    const persisted = res.body.craftState as Record<string, any>;
    expect(persisted.dashboard).toBeDefined();
    expect(persisted.heading).toBeDefined();
    expect(persisted.ROOT.nodes).toContain('dashboard');
  });

  it('POST still prunes a genuinely empty ghost artboard', async () => {
    const res = await request(buildApp())
      .post('/api/designs')
      .send({ craftState: JSON.stringify(orphanedArtboardState()) });
    expect(res.status).toBe(201);
    expect((res.body.craftState as Record<string, any>).ghost).toBeUndefined();
  });

  it('PATCH keeps orphaned artboards when saving over an existing design', async () => {
    const app = buildApp();
    const created = await request(app)
      .post('/api/designs')
      .send({ craftState: { ROOT: node({ type: { resolvedName: 'AstryxSection' }, isCanvas: true, parent: null, nodes: [] }) } });
    const res = await request(app)
      .patch(`/api/designs/${created.body.id}`)
      .send({ craftState: orphanedArtboardState() });
    expect(res.status).toBe(200);
    const persisted = res.body.craftState as Record<string, any>;
    expect(persisted.dashboard).toBeDefined();
    expect(persisted.ROOT.nodes).toContain('dashboard');
    expect(persisted.ghost).toBeUndefined();
  });

  it('reattaches a node to its declared non-ROOT parent when only the parent link is broken', async () => {
    const state = orphanedArtboardState() as Record<string, any>;
    state.dashboard.nodes = []; // heading now orphaned too — declared parent is dashboard
    const res = await request(buildApp())
      .post('/api/designs')
      .send({ craftState: state });
    expect(res.status).toBe(201);
    const persisted = res.body.craftState as Record<string, any>;
    expect(persisted.dashboard.nodes).toContain('heading');
    expect(persisted.heading).toBeDefined();
  });
});
