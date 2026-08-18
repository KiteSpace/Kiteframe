/**
 * Unit tests for DesignCanvasViewer.tsx
 *
 * Verifies:
 *   1. Unknown `astryxComponent` values render the `[ComponentName]` placeholder
 *      instead of crashing.
 *   2. The ComponentCountBadge shows the correct colour tier:
 *        - Grey  (bg-gray-100)  when count < 120
 *        - Amber (bg-amber-100) when 120 ≤ count < 150
 *        - Red   (bg-red-100)   at count = 150 (limit reached)
 *
 * The TanStack Query client is pre-seeded with fixture data so no real fetch
 * requests are made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any non-mock imports
// ---------------------------------------------------------------------------

vi.mock('wouter', () => ({
  useParams: vi.fn(() => ({ id: 'test-design-abc' })),
  useLocation: vi.fn(() => ['/designs/test-design-abc', vi.fn()]),
}));

vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
  queryClient: new QueryClient(),
  getQueryFn: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Lazy imports after mocks
// ---------------------------------------------------------------------------
import DesignCanvasViewer from '../DesignCanvasViewer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DESIGN_ID = 'test-design-abc';
const QUERY_KEY = ['/api/public/entities/designs', DESIGN_ID];

const DESIGN_MAX = 150;
const DESIGN_WARN = 120;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function makeComponent(i: number) {
  return { id: `c${i}`, astryxComponent: 'Button', x: i * 20, y: 0 };
}

function makeDesignData(components: Array<{ id: string; astryxComponent: string; x: number; y: number; props?: Record<string, unknown> }>) {
  return {
    id: DESIGN_ID,
    entity_type: 'design',
    data: { title: 'Test Design', components },
    expires_at: null,
  };
}

function renderWithQuery(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <DesignCanvasViewer />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({ status: 401 } as Response);
});

afterEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Unknown component fallback
// ---------------------------------------------------------------------------

describe('Unknown astryxComponent — placeholder rendering', () => {
  it('renders [ComponentName] placeholder for an unrecognised component name', async () => {
    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, makeDesignData([
      { id: 'u1', astryxComponent: 'UnknownWidget', x: 0, y: 0 },
    ]));

    renderWithQuery(qc);

    const placeholder = await screen.findByText('[UnknownWidget]');
    expect(placeholder).toBeInTheDocument();
  });

  it('does not crash when multiple unrecognised components are present', async () => {
    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, makeDesignData([
      { id: 'u1', astryxComponent: 'GizmoA', x: 0, y: 0 },
      { id: 'u2', astryxComponent: 'GizmoB', x: 200, y: 0 },
      { id: 'u3', astryxComponent: 'GizmoC', x: 400, y: 0 },
    ]));

    renderWithQuery(qc);

    expect(await screen.findByText('[GizmoA]')).toBeInTheDocument();
    expect(screen.getByText('[GizmoB]')).toBeInTheDocument();
    expect(screen.getByText('[GizmoC]')).toBeInTheDocument();
  });

  it('renders known components normally alongside unknown ones', async () => {
    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, makeDesignData([
      { id: 'k1', astryxComponent: 'Button', x: 0, y: 0 },
      { id: 'u1', astryxComponent: 'NotInRegistry', x: 200, y: 0 },
    ]));

    renderWithQuery(qc);

    await screen.findByTestId('design-component-k1');
    expect(screen.getByTestId('design-component-u1')).toBeInTheDocument();
    expect(screen.getByText('[NotInRegistry]')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ComponentCountBadge colour tiers
// ---------------------------------------------------------------------------

describe('ComponentCountBadge — colour tiers', () => {
  it('shows grey badge when component count is below the warning threshold (< 120)', async () => {
    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, makeDesignData(
      Array.from({ length: 5 }, (_, i) => makeComponent(i)),
    ));

    renderWithQuery(qc);

    const badge = await screen.findByTestId('component-count-badge');
    expect(badge).toHaveClass('bg-gray-100');
    expect(badge).not.toHaveClass('bg-amber-100');
    expect(badge).not.toHaveClass('bg-red-100');
    expect(badge).toHaveTextContent('5/150 components');
  });

  it(`shows amber badge when component count is at the warning threshold (= ${DESIGN_WARN})`, async () => {
    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, makeDesignData(
      Array.from({ length: DESIGN_WARN }, (_, i) => makeComponent(i)),
    ));

    renderWithQuery(qc);

    const badge = await screen.findByTestId('component-count-badge');
    expect(badge).toHaveClass('bg-amber-100');
    expect(badge).not.toHaveClass('bg-gray-100');
    expect(badge).not.toHaveClass('bg-red-100');
    expect(badge).toHaveTextContent('approaching limit');
  });

  it('shows amber badge at 149 components (one below limit)', async () => {
    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, makeDesignData(
      Array.from({ length: 149 }, (_, i) => makeComponent(i)),
    ));

    renderWithQuery(qc);

    const badge = await screen.findByTestId('component-count-badge');
    expect(badge).toHaveClass('bg-amber-100');
    expect(badge).not.toHaveClass('bg-red-100');
  });

  it(`shows red badge when component count reaches the hard limit (= ${DESIGN_MAX})`, async () => {
    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, makeDesignData(
      Array.from({ length: DESIGN_MAX }, (_, i) => makeComponent(i)),
    ));

    renderWithQuery(qc);

    const badge = await screen.findByTestId('component-count-badge');
    expect(badge).toHaveClass('bg-red-100');
    expect(badge).not.toHaveClass('bg-amber-100');
    expect(badge).not.toHaveClass('bg-gray-100');
    expect(badge).toHaveTextContent('Limit reached');
  });
});

// ---------------------------------------------------------------------------
// Viewer shell behaviour
// ---------------------------------------------------------------------------

describe('DesignCanvasViewer — loading and error states', () => {
  it('shows a loading screen while the query is in flight', () => {
    const qc = makeQueryClient();
    renderWithQuery(qc);

    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('design-canvas-viewer')).not.toBeInTheDocument();
  });

  it('shows the canvas viewer once data is loaded', async () => {
    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, makeDesignData([makeComponent(0)]));

    renderWithQuery(qc);

    expect(await screen.findByTestId('design-canvas-viewer')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
  });
});
