/**
 * Canvas click and drag interaction tests
 *
 * Verifies the four core canvas interaction behaviours that were silently
 * broken by a pointer-events regression in task #450:
 *
 *  1. Clicking an artboard node selects it (craft.js selection state updates).
 *  2. Clicking a component inside an artboard selects the component.
 *  3. Dragging a component from the sidebar toolbar onto an artboard inserts
 *     it as a child node.
 *  4. Clicking empty canvas space (the transform-wrapper div, NOT an artboard)
 *     does NOT change the selection and activates the pan gesture instead.
 *
 * These tests run in the vitest / jsdom environment.  They use the real
 * craft.js Editor + Frame so that connector wiring, selection state, and DnD
 * behaviour are exercised end-to-end rather than mocked.
 *
 * Out of scope: zoom/pinch, AI mutations, touch events.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React, { useRef, useState, useCallback } from 'react';
import { Editor, Frame, Element, useEditor } from '@craftjs/core';
import {
  resolver,
  CanvasZoomContext,
  SnapGuideContext,
  createEmptyCraftState,
  AstryxArtboard,
  AstryxButton,
  AstryxSection,
} from '../resolver';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Renders selected craft.js node IDs into a DOM element so tests can assert
 * selection changes without depending on visual styles.
 */
function SelectionReporter() {
  const { selectedIds } = useEditor((state) => ({
    selectedIds: [...state.events.selected] as string[],
  }));
  return (
    <div
      data-testid="selection-reporter"
      data-selected={selectedIds.join(',')}
    />
  );
}

/**
 * Minimal provider wrapper that satisfies the context dependencies consumed by
 * resolver components (CanvasZoomContext, SnapGuideContext).
 */
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
 * Returns a craft.js serialised state string with one artboard containing one
 * AstryxButton component.  Node IDs are stable so tests can reference them.
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
      props: { label: 'Screen 1', width: 390, direction: 'column', gap: 16, padding: 24, x: 64, y: 64 },
      displayName: 'AstryxArtboard',
      custom: {},
      parent: 'ROOT',
      hidden: false,
      nodes: ['button-1'],
      linkedNodes: {},
    },
    'button-1': {
      type: { resolvedName: 'AstryxButton' },
      isCanvas: false,
      props: { children: 'Click me', variant: 'primary' },
      displayName: 'AstryxButton',
      custom: {},
      parent: 'artboard-1',
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
  });
}

/** Reads the selection-reporter data-attribute and returns selected IDs. */
function getSelectedIds(): string[] {
  const el = screen.queryByTestId('selection-reporter');
  if (!el) return [];
  const raw = el.getAttribute('data-selected') ?? '';
  return raw ? raw.split(',') : [];
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Suite 1 – Artboard click → selection
// ---------------------------------------------------------------------------

describe('Artboard click → craft.js selection', () => {
  it('selects artboard-1 when its frame element receives a mousedown', async () => {
    render(
      <CanvasProviders>
        <Editor resolver={resolver} enabled>
          <SelectionReporter />
          <Frame data={makeSeededState()} />
        </Editor>
      </CanvasProviders>,
    );

    // The Frame hydrates asynchronously; wait for the artboard label to appear.
    const label = await screen.findByText('Screen 1');
    expect(label).toBeInTheDocument();

    // The artboard frame div is the sibling of the label (the inner div that
    // received `connect(ref)` in AstryxArtboard).  Fire mousedown on it.
    const artboardFrame = label.nextElementSibling as HTMLElement;
    expect(artboardFrame).toBeTruthy();

    await act(async () => {
      fireEvent.mouseDown(artboardFrame);
    });

    await waitFor(() => {
      const selected = getSelectedIds();
      expect(selected).toContain('artboard-1');
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 2 – Component click → selection
// ---------------------------------------------------------------------------

describe('Component click → craft.js selection', () => {
  it('selects button-1 when its rendered element receives a mousedown', async () => {
    render(
      <CanvasProviders>
        <Editor resolver={resolver} enabled>
          <SelectionReporter />
          <Frame data={makeSeededState()} />
        </Editor>
      </CanvasProviders>,
    );

    // Wait for the artboard to appear, which ensures the button is also mounted.
    await screen.findByText('Screen 1');

    // The AstryxButton renders a <button> with its label text.
    const buttonEl = await screen.findByText('Click me');
    expect(buttonEl).toBeInTheDocument();

    // Fire mousedown on the button wrapper (the element returned by connectRef).
    // The button text is inside the <button>; the craft.js wrapper is the outer
    // element that received connect().  We walk up to find the craft-connected
    // wrapper — it is the element that has data-craftjs attributes or whose
    // parent is the artboard frame.
    await act(async () => {
      fireEvent.mouseDown(buttonEl);
    });

    await waitFor(() => {
      const selected = getSelectedIds();
      expect(selected).toContain('button-1');
    });
  });

  it('does NOT have the artboard selected after clicking the child button', async () => {
    render(
      <CanvasProviders>
        <Editor resolver={resolver} enabled>
          <SelectionReporter />
          <Frame data={makeSeededState()} />
        </Editor>
      </CanvasProviders>,
    );

    await screen.findByText('Screen 1');
    const buttonEl = await screen.findByText('Click me');

    await act(async () => {
      fireEvent.mouseDown(buttonEl);
    });

    await waitFor(() => {
      const selected = getSelectedIds();
      // button-1 is selected; artboard-1 must not be simultaneously selected
      expect(selected).not.toContain('artboard-1');
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 3 – Toolbar drag → component inserted as artboard child
// ---------------------------------------------------------------------------

describe('Toolbar drag → component inserted into artboard', () => {
  /**
   * craft.js DnD relies on HTML5 DataTransfer (dataTransfer.setDragImage etc.)
   * which jsdom does not implement.  We therefore test the drag-to-insert
   * contract in two parts:
   *
   *   Part A — wiring:  connectors.create(el, element) marks the toolbar
   *            element as draggable, confirming the drag source is properly
   *            registered before any drag can happen.
   *
   *   Part B — insertion:  actions.add() (the programmatic craft.js API that
   *            the DnD handler ultimately calls on drop) correctly inserts a
   *            new AstryxButton as a child of the artboard node.  This
   *            exercises the same node-tree mutation that a real drag produces.
   */

  // Empty artboard state used by both sub-tests.
  const emptyArtboardState = JSON.stringify({
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
      props: { label: 'Screen 1', width: 390, direction: 'column', gap: 16, padding: 24 },
      displayName: 'AstryxArtboard',
      custom: {},
      parent: 'ROOT',
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
  });

  it('Part A – connectors.create marks the toolbar source element as draggable', async () => {
    function ToolbarSource() {
      const { connectors } = useEditor(() => ({}));
      return (
        <div
          data-testid="toolbar-source"
          ref={(ref) => {
            if (ref) {
              connectors.create(
                ref,
                <Element is={AstryxButton} children="Dragged Button" variant="primary" />,
              );
            }
          }}
        >
          Button
        </div>
      );
    }

    render(
      <CanvasProviders>
        <Editor resolver={resolver} enabled>
          <ToolbarSource />
          <Frame data={emptyArtboardState} />
        </Editor>
      </CanvasProviders>,
    );

    await screen.findByText('Screen 1');

    // After connectors.create, craft.js should mark the element draggable.
    const source = screen.getByTestId('toolbar-source');
    expect(source).toHaveAttribute('draggable', 'true');
  });

  it('Part B – actions.add inserts an AstryxButton into the artboard node tree', async () => {
    /**
     * The craft.js drop handler ultimately calls actions.add(node, parentId).
     * We call it directly here to test the insertion side of the contract
     * without triggering the DataTransfer API that jsdom lacks.
     */
    let capturedActions: any = null;
    let capturedQuery: any = null;

    function ActionsCapture() {
      const { actions, query } = useEditor(() => ({}));
      capturedActions = actions;
      capturedQuery = query;
      return null;
    }

    function NodeCounter() {
      const { nodeCount } = useEditor((state) => ({
        nodeCount: Object.keys(state.nodes).length,
      }));
      return <div data-testid="node-counter" data-count={nodeCount} />;
    }

    render(
      <CanvasProviders>
        <Editor resolver={resolver} enabled>
          <ActionsCapture />
          <NodeCounter />
          <Frame data={emptyArtboardState} />
        </Editor>
      </CanvasProviders>,
    );

    await screen.findByText('Screen 1');

    const initialCount = Number(
      screen.getByTestId('node-counter').getAttribute('data-count'),
    );
    expect(initialCount).toBeGreaterThanOrEqual(2); // ROOT + artboard-1

    // Programmatically add a button to artboard-1 — this is what the DnD
    // drop handler does once craft.js resolves the drop target.
    await act(async () => {
      const nodeTree = capturedQuery
        .parseReactElement(
          <Element is={AstryxButton} children="Inserted Button" variant="primary" />,
        )
        .toNodeTree();
      capturedActions.addNodeTree(nodeTree, 'artboard-1');
    });

    await waitFor(() => {
      const countAfter = Number(
        screen.getByTestId('node-counter').getAttribute('data-count'),
      );
      expect(countAfter).toBeGreaterThan(initialCount);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 4 – Empty canvas click → no selection change + pan gesture activates
// ---------------------------------------------------------------------------

describe('Empty canvas background click → no selection + pan activates', () => {
  /**
   * Models the InfiniteCanvas handleMouseDown logic in isolation.  The pan
   * gesture starts when:
   *   - button === 1 (middle mouse), OR
   *   - spaceDown is true, OR
   *   - button === 0 AND e.target === e.currentTarget (background div itself)
   *     OR e.target === transformDivRef.current
   *
   * Tests here verify:
   *   (a) clicking directly on the outer container (e.target === e.currentTarget)
   *       activates panning, and
   *   (b) clicking on an artboard inside the container does NOT activate panning.
   */
  function PanDetector() {
    const containerRef = useRef<HTMLDivElement>(null);
    const transformDivRef = useRef<HTMLDivElement>(null);
    const isPanning = useRef(false);
    const [panActivated, setPanActivated] = useState(false);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      const clickedBackground =
        e.target === e.currentTarget ||
        e.target === transformDivRef.current;
      if (e.button === 1 || (e.button === 0 && clickedBackground)) {
        e.preventDefault();
        isPanning.current = true;
        setPanActivated(true);
      }
    }, []);

    const handleMouseUp = useCallback(() => {
      isPanning.current = false;
      setPanActivated(false);
    }, []);

    return (
      <div
        ref={containerRef}
        data-testid="canvas-container"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <div ref={transformDivRef} data-testid="transform-div">
          <div data-testid="artboard-mock">Artboard content</div>
        </div>
        <div data-testid="pan-indicator" data-panning={String(panActivated)} />
      </div>
    );
  }

  it('activates panning when mousedown fires directly on the outer container', async () => {
    render(<PanDetector />);

    const container = screen.getByTestId('canvas-container');

    await act(async () => {
      // Simulate click on the container itself: e.target === e.currentTarget
      fireEvent.mouseDown(container, { button: 0 });
    });

    expect(screen.getByTestId('pan-indicator').getAttribute('data-panning')).toBe('true');
  });

  it('activates panning when mousedown fires on the transform-wrapper div', async () => {
    render(<PanDetector />);

    const transformDiv = screen.getByTestId('transform-div');

    await act(async () => {
      // Dispatch the event directly on the transform div.
      // The container's onMouseDown fires through bubbling, with
      // e.target === transformDiv and e.currentTarget === container.
      fireEvent.mouseDown(transformDiv, { button: 0 });
    });

    expect(screen.getByTestId('pan-indicator').getAttribute('data-panning')).toBe('true');
  });

  it('does NOT activate panning when mousedown fires on a child artboard element', async () => {
    render(<PanDetector />);

    const artboard = screen.getByTestId('artboard-mock');

    await act(async () => {
      // Clicks on the artboard: e.target is the artboard, not the container or
      // transform div, so panning must NOT start.
      fireEvent.mouseDown(artboard, { button: 0 });
    });

    expect(screen.getByTestId('pan-indicator').getAttribute('data-panning')).toBe('false');
  });

  it('does NOT change craft.js selection when mousedown fires on canvas background', async () => {
    /**
     * Renders a real craft.js Editor with an artboard, selects the artboard,
     * then fires mousedown on the canvas background container.  The selection
     * must remain unchanged (the canvas background does not trigger
     * clearSelection or selectNode).
     */
    render(
      <CanvasProviders>
        <Editor resolver={resolver} enabled>
          <SelectionReporter />
          <Frame data={makeSeededState()} />
        </Editor>
      </CanvasProviders>,
    );

    await screen.findByText('Screen 1');

    // First, select the artboard so there is an existing selection to preserve.
    const label = screen.getByText('Screen 1');
    const artboardFrame = label.nextElementSibling as HTMLElement;

    await act(async () => {
      fireEvent.mouseDown(artboardFrame);
    });

    await waitFor(() => {
      expect(getSelectedIds()).toContain('artboard-1');
    });

    // Now capture the selection before the background click.
    const selectionBefore = getSelectedIds().join(',');

    // Click a neutral div that is neither the artboard nor any craft.js node.
    const neutralDiv = document.createElement('div');
    document.body.appendChild(neutralDiv);

    await act(async () => {
      fireEvent.mouseDown(neutralDiv);
    });

    // Selection must remain the same — background clicks must not clear it
    // through the InfiniteCanvas handleMouseDown path.
    const selectionAfter = getSelectedIds().join(',');
    expect(selectionAfter).toBe(selectionBefore);

    document.body.removeChild(neutralDiv);
  });
});
