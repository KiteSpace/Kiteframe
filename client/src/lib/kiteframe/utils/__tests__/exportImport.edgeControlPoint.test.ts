/**
 * Tests verifying that edge `controlPoint` survives the export → import round-trip.
 *
 * Covers:
 *  1. Zod EdgeSchema accepts and preserves a valid `controlPoint`
 *  2. exportWorkflow keeps `controlPoint` intact in the serialised payload
 *  3. importWorkflow restores `controlPoint` on the returned edges after a
 *     full JSON serialise / deserialise cycle (simulating a .kiteframe file
 *     save and re-open, or a Firebase cloud save and load)
 *  4. Edges WITHOUT a `controlPoint` are unaffected by the round-trip
 *  5. Sanitisation (speculative-edge filtering) does not strip `controlPoint`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Mock heavy / side-effectful modules that exportImport.ts pulls in so that
// tests remain self-contained and don't touch localStorage or external stores.
// ---------------------------------------------------------------------------

vi.mock('../prdStorage', () => ({
  loadProjectPRD: vi.fn().mockReturnValue(null),
  loadWorkflowPRD: vi.fn().mockReturnValue(null),
  saveProjectPRD: vi.fn(),
  saveWorkflowPRD: vi.fn(),
  listWorkflowPRDs: vi.fn().mockReturnValue([]),
}));

vi.mock('../validation', () => ({
  sanitizeText: (t: string) => t,
  validateColor: () => true,
}));

vi.mock('../../../../stores/workflowIntentStore', () => ({
  workflowIntentStore: {
    getAll: vi.fn().mockReturnValue({}),
    set: vi.fn(),
  },
}));

// Import AFTER mocks are registered
import { exportWorkflow, importWorkflow } from '../exportImport';
import type { Node, Edge } from '../../types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function makeNode(id: string): Node {
  return {
    id,
    type: 'process',
    position: { x: 0, y: 0 },
    data: { label: `Node ${id}` },
  };
}

function makeBentEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
    type: 'bezier',
    controlPoint: { x: 150, y: 75 },
  };
}

function makeStraightEdge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
    type: 'straight',
  };
}

const BASE_METADATA = { name: 'Test Workflow' };

// ---------------------------------------------------------------------------
// 1. Zod schema accepts a valid controlPoint
// ---------------------------------------------------------------------------

describe('EdgeSchema Zod validation', () => {
  const EdgeSchema = z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
    type: z.string().optional(),
    label: z.string().optional(),
    data: z.record(z.any()).optional(),
    style: z.record(z.any()).optional(),
    animated: z.boolean().optional(),
    selected: z.boolean().optional(),
    hidden: z.boolean().optional(),
    controlPoint: z.object({ x: z.number(), y: z.number() }).optional(),
  });

  it('accepts an edge with a valid controlPoint', () => {
    const result = EdgeSchema.safeParse({
      id: 'e1',
      source: 'n1',
      target: 'n2',
      controlPoint: { x: 100, y: 50 },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.controlPoint).toEqual({ x: 100, y: 50 });
    }
  });

  it('accepts an edge without a controlPoint (optional)', () => {
    const result = EdgeSchema.safeParse({
      id: 'e2',
      source: 'n1',
      target: 'n2',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.controlPoint).toBeUndefined();
    }
  });

  it('rejects a controlPoint with a missing axis', () => {
    const result = EdgeSchema.safeParse({
      id: 'e3',
      source: 'n1',
      target: 'n2',
      controlPoint: { x: 100 }, // missing y
    });

    expect(result.success).toBe(false);
  });

  it('rejects a controlPoint with non-numeric values', () => {
    const result = EdgeSchema.safeParse({
      id: 'e4',
      source: 'n1',
      target: 'n2',
      controlPoint: { x: 'bad', y: 50 },
    });

    expect(result.success).toBe(false);
  });

  it('passes through controlPoint values without mutation', () => {
    const result = EdgeSchema.safeParse({
      id: 'e5',
      source: 'n1',
      target: 'n2',
      controlPoint: { x: -42.5, y: 999.123 },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.controlPoint).toEqual({ x: -42.5, y: 999.123 });
    }
  });
});

// ---------------------------------------------------------------------------
// 2. exportWorkflow preserves controlPoint in the payload
// ---------------------------------------------------------------------------

describe('exportWorkflow — controlPoint preservation', () => {
  it('retains controlPoint on a bent edge in the exported payload', () => {
    const nodes: Node[] = [makeNode('n1'), makeNode('n2')];
    const edges: Edge[] = [makeBentEdge('e1', 'n1', 'n2')];

    const exported = exportWorkflow({ nodes, edges }, BASE_METADATA);

    expect(exported.workflow.edges).toHaveLength(1);
    expect(exported.workflow.edges[0].controlPoint).toEqual({ x: 150, y: 75 });
  });

  it('does not add controlPoint to an edge that had none', () => {
    const nodes: Node[] = [makeNode('n1'), makeNode('n2')];
    const edges: Edge[] = [makeStraightEdge('e1', 'n1', 'n2')];

    const exported = exportWorkflow({ nodes, edges }, BASE_METADATA);

    expect(exported.workflow.edges[0].controlPoint).toBeUndefined();
  });

  it('preserves multiple edges — bent and straight — independently', () => {
    const nodes: Node[] = [makeNode('n1'), makeNode('n2'), makeNode('n3')];
    const edges: Edge[] = [
      makeBentEdge('e1', 'n1', 'n2'),
      makeStraightEdge('e2', 'n2', 'n3'),
    ];

    const exported = exportWorkflow({ nodes, edges }, BASE_METADATA);

    expect(exported.workflow.edges).toHaveLength(2);
    const bent = exported.workflow.edges.find((e: any) => e.id === 'e1');
    const straight = exported.workflow.edges.find((e: any) => e.id === 'e2');

    expect(bent?.controlPoint).toEqual({ x: 150, y: 75 });
    expect(straight?.controlPoint).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Full export → JSON serialise → importWorkflow round-trip
// ---------------------------------------------------------------------------

describe('export → import round-trip — controlPoint survives', () => {
  beforeEach(() => {
    // Provide minimal localStorage stub so exportWorkflow doesn't throw
    if (typeof global.localStorage === 'undefined') {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: vi.fn().mockReturnValue(null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn(),
        },
        writable: true,
      });
    }
  });

  it('restores controlPoint after a full JSON serialise/deserialise cycle', () => {
    const nodes: Node[] = [makeNode('n1'), makeNode('n2')];
    const edges: Edge[] = [makeBentEdge('e1', 'n1', 'n2')];

    const exported = exportWorkflow({ nodes, edges }, BASE_METADATA);
    const json = JSON.stringify(exported);

    const result = importWorkflow(json);

    expect(result.success).toBe(true);
    expect(result.data?.edges).toHaveLength(1);
    expect(result.data?.edges[0].controlPoint).toEqual({ x: 150, y: 75 });
  });

  it('preserves exact floating-point controlPoint coordinates', () => {
    const nodes: Node[] = [makeNode('n1'), makeNode('n2')];
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n2', controlPoint: { x: 12.34, y: -56.78 } },
    ];

    const exported = exportWorkflow({ nodes, edges }, BASE_METADATA);
    const result = importWorkflow(JSON.stringify(exported));

    expect(result.success).toBe(true);
    expect(result.data?.edges[0].controlPoint).toEqual({ x: 12.34, y: -56.78 });
  });

  it('round-trips edges without controlPoint without adding one', () => {
    const nodes: Node[] = [makeNode('n1'), makeNode('n2')];
    const edges: Edge[] = [makeStraightEdge('e1', 'n1', 'n2')];

    const exported = exportWorkflow({ nodes, edges }, BASE_METADATA);
    const result = importWorkflow(JSON.stringify(exported));

    expect(result.success).toBe(true);
    expect(result.data?.edges[0].controlPoint).toBeUndefined();
  });

  it('preserves controlPoint when importing a workflow that was passed as an object (not JSON string)', () => {
    const nodes: Node[] = [makeNode('n1'), makeNode('n2')];
    const edges: Edge[] = [makeBentEdge('e1', 'n1', 'n2')];

    const exported = exportWorkflow({ nodes, edges }, BASE_METADATA);

    // Pass the object directly (simulates Firebase document hydration)
    const result = importWorkflow(exported);

    expect(result.success).toBe(true);
    expect(result.data?.edges[0].controlPoint).toEqual({ x: 150, y: 75 });
  });

  it('preserves all other edge fields alongside controlPoint', () => {
    const nodes: Node[] = [makeNode('n1'), makeNode('n2')];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n2',
        type: 'bezier',
        label: 'my-label',
        animated: true,
        controlPoint: { x: 200, y: 100 },
      },
    ];

    const exported = exportWorkflow({ nodes, edges }, BASE_METADATA);
    const result = importWorkflow(JSON.stringify(exported));

    expect(result.success).toBe(true);
    const edge = result.data?.edges[0];
    expect(edge?.id).toBe('e1');
    expect(edge?.type).toBe('bezier');
    expect(edge?.label).toBe('my-label');
    expect(edge?.animated).toBe(true);
    expect(edge?.controlPoint).toEqual({ x: 200, y: 100 });
  });
});

// ---------------------------------------------------------------------------
// 4. Speculative-edge filtering does not touch non-speculative bent edges
// ---------------------------------------------------------------------------

describe('speculative-edge sanitisation does not strip controlPoint', () => {
  it('keeps controlPoint on committed (non-speculative) edges', () => {
    const nodes: Node[] = [makeNode('n1'), makeNode('n2')];
    const bentEdge: Edge = {
      ...makeBentEdge('e1', 'n1', 'n2'),
      meta: { speculative: false },
    };

    const exported = exportWorkflow({ nodes, edges: [bentEdge] }, BASE_METADATA);
    const result = importWorkflow(JSON.stringify(exported));

    expect(result.success).toBe(true);
    expect(result.data?.edges[0].controlPoint).toEqual({ x: 150, y: 75 });
  });

  it('removes speculative edges entirely (controlPoint irrelevant)', () => {
    const nodes: Node[] = [makeNode('n1'), makeNode('n2')];
    const speculativeEdge: Edge = {
      ...makeBentEdge('e1', 'n1', 'n2'),
      meta: { speculative: true },
    };

    const exported = exportWorkflow({ nodes, edges: [speculativeEdge] }, BASE_METADATA);
    // Speculative edges are stripped during sanitisation
    expect(exported.workflow.edges).toHaveLength(0);
  });
});
