/**
 * Resize → single-step undo tests (task: make resize undo one event)
 *
 * A resize drag fires dozens of mousemove events. Previously every one of
 * them wrote a history entry, so undoing a resize required dozens of
 * Ctrl+Z presses. The fix routes intermediate moves through
 * actions.history.ignore() and commits the final geometry exactly once on
 * mouseup.
 *
 * These tests exercise the REAL craft.js Editor + Frame + resolver
 * components in jsdom:
 *
 *  1. Component resize with many mousemoves → exactly ONE undo entry.
 *  2. Undo restores the initial width; redo restores the final width.
 *  3. West-edge resize of an absolute node → undo restores BOTH width and x.
 *  4. Mousedown + mouseup without movement → NO history entry.
 *  5. Drag away and back to the origin → NO history entry.
 *  6. Artboard resize with many mousemoves → exactly ONE undo entry,
 *     undo restores initial width, redo restores final width.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { Editor, Frame, useEditor } from '@craftjs/core';
import {
  resolver,
  CanvasZoomContext,
  SnapGuideContext,
} from '../resolver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mutable holder the reporter fills with live editor state/actions. */
type EditorProbe = {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  getProps: (id: string) => Record<string, any>;
};

function makeProbe(): EditorProbe {
  return {
    canUndo: false,
    canRedo: false,
    undo: () => {},
    redo: () => {},
    getProps: () => ({}),
  };
}

/** Collects canUndo/canRedo plus imperative handles into the probe. */
function EditorReporter({ probe }: { probe: EditorProbe }) {
  const { actions, query, canUndo, canRedo } = useEditor((state, q) => ({
    canUndo: q.history.canUndo(),
    canRedo: q.history.canRedo(),
  }));
  probe.canUndo = canUndo;
  probe.canRedo = canRedo;
  probe.undo = () => actions.history.undo();
  probe.redo = () => actions.history.redo();
  probe.getProps = (id: string) => query.node(id).get().data.props;
  return (
    <div
      data-testid="history-reporter"
      data-can-undo={String(canUndo)}
      data-can-redo={String(canRedo)}
    />
  );
}

function CanvasProviders({ children }: { children: React.ReactNode }) {
  return (
    <CanvasZoomContext.Provider value={1}>
      <SnapGuideContext.Provider value={() => {}}>
        {children}
      </SnapGuideContext.Provider>
    </CanvasZoomContext.Provider>
  );
}

/**
 * Seeded state: one artboard with
 *  - button-1: flow leaf with explicit width/height
 *  - abs-1:    absolute-positioned leaf (west/north handles mount)
 */
function makeSeededState(): string {
  return JSON.stringify({
    ROOT: {
      type: { resolvedName: 'AstryxSection' },
      isCanvas: true,
      props: { direction: 'row', gap: 80, padding: 40, align: 'start', justify: 'start' },
      displayName: 'AstryxSection',
      custom: {},
      parent: null,
      hidden: false,
      nodes: ['artboard-1'],
      linkedNodes: {},
    },
    'artboard-1': {
      type: { resolvedName: 'AstryxArtboard' },
      isCanvas: true,
      props: { label: 'Screen 1', width: 390, height: 600, direction: 'column', gap: 16, padding: 24, x: 64, y: 64 },
      displayName: 'AstryxArtboard',
      custom: {},
      parent: 'ROOT',
      hidden: false,
      nodes: ['button-1', 'abs-1'],
      linkedNodes: {},
    },
    'button-1': {
      type: { resolvedName: 'AstryxButton' },
      isCanvas: false,
      props: { children: 'Click me', variant: 'primary', width: 120, height: 40 },
      displayName: 'AstryxButton',
      custom: {},
      parent: 'artboard-1',
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
    'abs-1': {
      type: { resolvedName: 'AstryxButton' },
      isCanvas: false,
      props: { children: 'Abs button', variant: 'secondary', position: 'absolute', x: 50, y: 80, width: 120, height: 40 },
      displayName: 'AstryxButton',
      custom: {},
      parent: 'artboard-1',
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
  });
}

function renderEditor() {
  const probe = makeProbe();
  const utils = render(
    <CanvasProviders>
      <Editor resolver={resolver} enabled>
        <EditorReporter probe={probe} />
        <Frame data={makeSeededState()} />
      </Editor>
    </CanvasProviders>,
  );
  return { probe, ...utils };
}

/** Select a leaf by firing mousedown+mouseup+click on its rendered text. */
async function selectLeaf(text: string): Promise<HTMLElement> {
  const el = await screen.findByText(text);
  const target = el.closest('div')!.parentElement as HTMLElement;
  await act(async () => {
    fireEvent.mouseDown(target);
    fireEvent.mouseUp(target);
  });
  return target;
}

/**
 * Finds a resize handle inside/after the wrapper by cursor style.
 * `index` disambiguates when several handles share a cursor
 * (e.g. ew-resize is used by both E and W).
 */
function findHandle(wrapper: HTMLElement, cursor: string, index = 0): HTMLElement {
  const handles = Array.from(
    wrapper.querySelectorAll<HTMLElement>(`div[style*="${cursor}"]`),
  );
  if (handles.length <= index) {
    throw new Error(`No handle with cursor ${cursor} at index ${index} (found ${handles.length})`);
  }
  return handles[index];
}

/** Simulates a full resize drag: mousedown on handle, N moves on window, mouseup. */
async function dragResize(
  handle: HTMLElement,
  steps: Array<{ x: number; y: number }>,
  start = { x: 200, y: 200 },
) {
  await act(async () => {
    fireEvent.mouseDown(handle, { clientX: start.x, clientY: start.y });
  });
  for (const s of steps) {
    await act(async () => {
      fireEvent.mouseMove(window, { clientX: s.x, clientY: s.y });
    });
  }
  await act(async () => {
    fireEvent.mouseUp(window);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Suite 1 – Component resize produces exactly one undo entry
// ---------------------------------------------------------------------------

describe('Component resize → single undo entry', () => {
  it('many mousemoves during an east resize produce exactly one undo step', async () => {
    const { probe } = renderEditor();
    const wrapper = await selectLeaf('Click me');

    // Wait for resize handles to mount after selection.
    await waitFor(() => findHandle(wrapper, 'ew-resize'));
    expect(probe.canUndo).toBe(false); // pristine history

    // Drag east handle right by +60px in 12 small steps (5px each).
    const eHandle = findHandle(wrapper, 'ew-resize', 0);
    const steps = Array.from({ length: 12 }, (_, i) => ({ x: 200 + (i + 1) * 5, y: 200 }));
    await dragResize(eHandle, steps);

    // Final width applied.
    await waitFor(() => {
      expect(probe.getProps('button-1').width).toBe(180);
    });

    // Exactly ONE undo entry: undo once → back to initial → nothing left.
    expect(probe.canUndo).toBe(true);
    await act(async () => probe.undo());
    await waitFor(() => {
      expect(probe.getProps('button-1').width).toBe(120);
    });
    expect(probe.canUndo).toBe(false);

    // Redo restores the final width in one step.
    expect(probe.canRedo).toBe(true);
    await act(async () => probe.redo());
    await waitFor(() => {
      expect(probe.getProps('button-1').width).toBe(180);
    });
  });

  it('south resize changes only height and undoes in one step', async () => {
    const { probe } = renderEditor();
    const wrapper = await selectLeaf('Click me');
    await waitFor(() => findHandle(wrapper, 'ns-resize'));

    const sHandle = findHandle(wrapper, 'ns-resize', 0);
    const steps = Array.from({ length: 8 }, (_, i) => ({ x: 200, y: 200 + (i + 1) * 5 }));
    await dragResize(sHandle, steps);

    await waitFor(() => {
      expect(probe.getProps('button-1').height).toBe(80);
    });
    expect(probe.getProps('button-1').width).toBe(120); // untouched

    await act(async () => probe.undo());
    await waitFor(() => {
      expect(probe.getProps('button-1').height).toBe(40);
    });
    expect(probe.canUndo).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 – West resize of an absolute node restores width AND x
// ---------------------------------------------------------------------------

describe('Absolute node west resize → undo restores width and x together', () => {
  it('west drag shifts x; single undo restores both', async () => {
    const { probe } = renderEditor();
    const wrapper = await selectLeaf('Abs button');

    // Absolute nodes mount all 8 handles; ew-resize index 1 is the W handle.
    await waitFor(() => findHandle(wrapper, 'ew-resize', 1));
    const wHandle = findHandle(wrapper, 'ew-resize', 1);

    // Drag left by -40px in 10 steps → width 120→160, x 50→10.
    const steps = Array.from({ length: 10 }, (_, i) => ({ x: 200 - (i + 1) * 4, y: 200 }));
    await dragResize(wHandle, steps);

    await waitFor(() => {
      const p = probe.getProps('abs-1');
      expect(p.width).toBe(160);
      expect(p.x).toBe(10);
    });

    // ONE undo restores both properties.
    await act(async () => probe.undo());
    await waitFor(() => {
      const p = probe.getProps('abs-1');
      expect(p.width).toBe(120);
      expect(p.x).toBe(50);
    });
    expect(probe.canUndo).toBe(false);

    // Redo restores both.
    await act(async () => probe.redo());
    await waitFor(() => {
      const p = probe.getProps('abs-1');
      expect(p.width).toBe(160);
      expect(p.x).toBe(10);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 3 – No-op gestures add no history entry
// ---------------------------------------------------------------------------

describe('No-op resize gestures → no history entry', () => {
  it('mousedown + mouseup without movement adds nothing', async () => {
    const { probe } = renderEditor();
    const wrapper = await selectLeaf('Click me');
    await waitFor(() => findHandle(wrapper, 'ew-resize'));

    const eHandle = findHandle(wrapper, 'ew-resize', 0);
    await dragResize(eHandle, []); // no moves

    expect(probe.getProps('button-1').width).toBe(120);
    expect(probe.canUndo).toBe(false);
  });

  it('dragging away and back to the origin adds nothing', async () => {
    const { probe } = renderEditor();
    const wrapper = await selectLeaf('Click me');
    await waitFor(() => findHandle(wrapper, 'ew-resize'));

    const eHandle = findHandle(wrapper, 'ew-resize', 0);
    // Out +30 then back to the exact start position.
    await dragResize(eHandle, [
      { x: 230, y: 200 },
      { x: 215, y: 200 },
      { x: 200, y: 200 },
    ]);

    expect(probe.getProps('button-1').width).toBe(120);
    expect(probe.canUndo).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suite 4 – Artboard resize produces exactly one undo entry
// ---------------------------------------------------------------------------

describe('Artboard resize → single undo entry', () => {
  it('many mousemoves during an east resize of the artboard produce one undo step', async () => {
    const { probe } = renderEditor();

    // Artboard frame: sibling of its label. Handles are always rendered.
    const label = await screen.findByText('Screen 1');
    const frame = label.nextElementSibling as HTMLElement;
    expect(frame).toBeTruthy();

    await waitFor(() => findHandle(frame, 'ew-resize'));
    expect(probe.canUndo).toBe(false);

    // ew-resize index 0 = right/E handle for the artboard.
    const eHandle = findHandle(frame, 'ew-resize', 0);
    const steps = Array.from({ length: 15 }, (_, i) => ({ x: 300 + (i + 1) * 4, y: 300 }));
    await dragResize(eHandle, steps, { x: 300, y: 300 });

    await waitFor(() => {
      expect(probe.getProps('artboard-1').width).toBe(450);
    });

    // Single undo restores the initial width; history is then empty.
    expect(probe.canUndo).toBe(true);
    await act(async () => probe.undo());
    await waitFor(() => {
      expect(probe.getProps('artboard-1').width).toBe(390);
    });
    expect(probe.canUndo).toBe(false);

    // Redo restores the final width.
    await act(async () => probe.redo());
    await waitFor(() => {
      expect(probe.getProps('artboard-1').width).toBe(450);
    });
  });

  it('west resize of the artboard restores width and x together on undo', async () => {
    const { probe } = renderEditor();
    const label = await screen.findByText('Screen 1');
    const frame = label.nextElementSibling as HTMLElement;

    await waitFor(() => findHandle(frame, 'ew-resize', 1));
    const wHandle = findHandle(frame, 'ew-resize', 1);

    // Drag left -50px → width 390→440, x 64→14.
    const steps = Array.from({ length: 10 }, (_, i) => ({ x: 300 - (i + 1) * 5, y: 300 }));
    await dragResize(wHandle, steps, { x: 300, y: 300 });

    await waitFor(() => {
      const p = probe.getProps('artboard-1');
      expect(p.width).toBe(440);
      expect(p.x).toBe(14);
    });

    await act(async () => probe.undo());
    await waitFor(() => {
      const p = probe.getProps('artboard-1');
      expect(p.width).toBe(390);
      expect(p.x).toBe(64);
    });
    expect(probe.canUndo).toBe(false);
  });

  it('artboard mousedown + mouseup without movement adds nothing', async () => {
    const { probe } = renderEditor();
    const label = await screen.findByText('Screen 1');
    const frame = label.nextElementSibling as HTMLElement;
    await waitFor(() => findHandle(frame, 'ew-resize'));

    const eHandle = findHandle(frame, 'ew-resize', 0);
    await dragResize(eHandle, [], { x: 300, y: 300 });

    expect(probe.getProps('artboard-1').width).toBe(390);
    expect(probe.canUndo).toBe(false);
  });
});
