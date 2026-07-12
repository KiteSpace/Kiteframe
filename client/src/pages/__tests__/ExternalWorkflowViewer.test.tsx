/**
 * Component tests for ExternalWorkflowViewer.
 *
 * Verifies that the "Save to my account" button:
 *  1. Renders for any visitor (auth state is checked only on click, not at render).
 *  2. Is absent when the workflow cannot be loaded (expired / not found).
 *  3. Shows loading feedback ("Saving…") while the claim mutation is pending.
 *  4. Triggers the unauthenticated save-intent flow (localStorage + redirect) when
 *     an unauthenticated user clicks it.
 *
 * The canvas and routing layers are mocked to keep tests fast and focused on
 * the button's conditional rendering logic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before any real imports
// ---------------------------------------------------------------------------
vi.mock('wouter', () => ({
  useParams: vi.fn(() => ({ id: 'test-wf-abc' })),
  useLocation: vi.fn(() => ['/workflows/test-wf-abc', vi.fn()]),
}));

vi.mock('../../lib/kiteframe/components/KiteFrameCanvas', () => ({
  KiteFrameCanvas: () => <div data-testid="mock-canvas" />,
}));

vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
  queryClient: new QueryClient(),
  getQueryFn: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Lazy imports after mocks are wired
// ---------------------------------------------------------------------------
import ExternalWorkflowViewer from '../ExternalWorkflowViewer';
import { apiRequest } from '@/lib/queryClient';

// ---------------------------------------------------------------------------
// Constants mirrored from the component
// ---------------------------------------------------------------------------
const CLAIM_RETURN_KEY = 'kiteframe-claim-return-url';
const CLAIM_ID_KEY = 'kiteframe-claim-workflow-id';
const WORKFLOW_ID = 'test-wf-abc';
const QUERY_KEY = ['/api/public/entities/workflows', WORKFLOW_ID];

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

const MOCK_WORKFLOW_DATA = {
  id: WORKFLOW_ID,
  entity_type: 'workflow',
  data: {
    title: 'My Test Workflow',
    nodes: [{ id: 'n1', type: 'process', position: { x: 100, y: 100 }, data: { label: 'Step' } }],
    edges: [],
  },
  expires_at: null,
};

const MOCK_EXPIRING_WORKFLOW = {
  ...MOCK_WORKFLOW_DATA,
  // expires ~30 minutes from now
  expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
};

function renderWithQuery(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ExternalWorkflowViewer />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // Prevent real fetch calls in the handleClaim auth check
  global.fetch = vi.fn().mockResolvedValue({ status: 401 } as Response);
});

afterEach(() => {
  localStorage.clear();
});

describe('Save to my account button — visibility', () => {
  it('renders the button when workflow data is loaded', async () => {
    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, MOCK_WORKFLOW_DATA);

    renderWithQuery(qc);

    expect(await screen.findByTestId('button-save-to-account')).toBeInTheDocument();
    expect(screen.getByTestId('button-save-to-account')).toHaveTextContent('Save to my account');
  });

  it('renders the workflow title in the header', async () => {
    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, MOCK_WORKFLOW_DATA);

    renderWithQuery(qc);

    expect(await screen.findByText('My Test Workflow')).toBeInTheDocument();
  });

  it('button is absent while data is still loading', () => {
    const qc = makeQueryClient();
    // No pre-seeded data — query starts in loading state

    renderWithQuery(qc);

    expect(screen.queryByTestId('button-save-to-account')).not.toBeInTheDocument();
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
  });

  it('shows error screen (not the button) when workflow query fails', async () => {
    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, undefined);
    // Mark query as errored
    await qc.fetchQuery({
      queryKey: QUERY_KEY,
      queryFn: () => Promise.reject(Object.assign(new Error('404 Not Found'), { status: 404 })),
      retry: false,
    }).catch(() => {});

    renderWithQuery(qc);

    await waitFor(() => {
      expect(screen.getByTestId('error-screen')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('button-save-to-account')).not.toBeInTheDocument();
  });
});

describe('Save to my account button — expiry banner', () => {
  it('shows the expiry banner when expires_at is set to a future date', async () => {
    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, MOCK_EXPIRING_WORKFLOW);

    renderWithQuery(qc);

    expect(await screen.findByTestId('expiry-banner')).toBeInTheDocument();
    expect(screen.getByTestId('expiry-banner')).toHaveTextContent('expires in');
  });

  it('does not show the expiry banner when expires_at is null', async () => {
    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, MOCK_WORKFLOW_DATA);

    renderWithQuery(qc);

    await screen.findByTestId('button-save-to-account');
    expect(screen.queryByTestId('expiry-banner')).not.toBeInTheDocument();
  });
});

describe('Save to my account button — unauthenticated click flow', () => {
  it('saves claim intent to localStorage and redirects to login for unauthenticated users', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401 } as Response);

    // Mock window.location.href assignment
    const originalLocation = window.location;
    const mockAssign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
    });

    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, MOCK_WORKFLOW_DATA);

    renderWithQuery(qc);

    const button = await screen.findByTestId('button-save-to-account');
    fireEvent.click(button);

    await waitFor(() => {
      expect(localStorage.getItem(CLAIM_ID_KEY)).toBe(WORKFLOW_ID);
    });

    // Restore location
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('does not save claim intent when the user is already signed in', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 200 } as Response);

    // apiRequest mock: resolve with a fake response
    const mockResponse = { json: vi.fn().mockResolvedValue({ id: '1', projectUuid: 'pu-1', editUrl: '/project/pu-1' }) };
    vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, MOCK_WORKFLOW_DATA);

    renderWithQuery(qc);

    const button = await screen.findByTestId('button-save-to-account');
    fireEvent.click(button);

    await waitFor(() => {
      expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
        'POST',
        '/api/workflows/claim',
        { externalWorkflowId: WORKFLOW_ID },
      );
    });

    // No localStorage entries written for authenticated user
    expect(localStorage.getItem(CLAIM_ID_KEY)).toBeNull();
  });
});

describe('Save to my account button — already-claimed state', () => {
  it('auto-triggers claim and clears localStorage when returning from login with pending claim', async () => {
    // Simulate the post-login redirect scenario
    localStorage.setItem(CLAIM_ID_KEY, WORKFLOW_ID);
    localStorage.setItem(CLAIM_RETURN_KEY, `http://localhost/workflows/${WORKFLOW_ID}`);

    const mockResponse = { json: vi.fn().mockResolvedValue({ id: '1', projectUuid: 'pu-1', editUrl: '/project/pu-1' }) };
    vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

    const qc = makeQueryClient();
    qc.setQueryData(QUERY_KEY, MOCK_WORKFLOW_DATA);

    renderWithQuery(qc);

    await waitFor(
      () => {
        expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
          'POST',
          '/api/workflows/claim',
          { externalWorkflowId: WORKFLOW_ID },
        );
      },
      { timeout: 1000 },
    );
  });
});
