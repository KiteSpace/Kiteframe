/**
 * Browser-level (jsdom) test for the second half of the share/view
 * round-trip — the part the API integration test in
 * server/__tests__/shareViewRoundtrip.test.ts cannot reach.
 *
 * The view-only page (ViewOnlyViewer.tsx) takes the `detailsData` JSON
 * string returned by GET /api/view/:shareUuid and writes it back into
 * localStorage under `kiteframe-details-<shareId>`. ProjectOverviewSection
 * — the same component the editor uses — then reads that key on mount
 * and renders the project name, description, categories, and timestamps.
 *
 * This test mirrors that flow without spinning up the full ViewOnlyViewer
 * (which pulls in KiteFrameCanvas, websockets, AI providers, etc): we
 * pre-seed localStorage exactly the way the viewer's seeding effect
 * would, mount ProjectOverviewSection, and assert the overview details
 * appear.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiProvider } from '../../ai/AiProvider';
import { OpenAICompatClient } from '../../ai/OpenAICompatClient';
import { ProjectOverviewSection } from '../../components/panels/ProjectPanel/sections/ProjectOverviewSection';

type OverviewBlob = {
  name: string;
  description: string;
  categories: string[];
  createdAt: number;
  updatedAt: number;
};

// Mimics the seeding ViewOnlyViewer.tsx does inside its data useEffect:
//   localStorage.setItem(`kiteframe-details-${shareId}`, data.detailsData)
function seedFromShareResponse(shareId: string, detailsData: string | null) {
  if (detailsData) {
    localStorage.setItem(`kiteframe-details-${shareId}`, detailsData);
  } else {
    localStorage.removeItem(`kiteframe-details-${shareId}`);
  }
}

function renderWithProviders(ui: React.ReactElement) {
  const aiClient = new OpenAICompatClient({
    baseURL: '/api/ai',
    apiKey: '',
    defaultModel: 'test-model',
  });
  return render(<AiProvider client={aiClient}>{ui}</AiProvider>);
}

beforeEach(() => {
  localStorage.clear();
});

describe('ViewOnlyViewer Project Overview rendering (after share payload seeding)', () => {
  it('renders name, description, and every category from the shared detailsData blob', () => {
    const shareId = 'share-uuid-abc';
    const overview: OverviewBlob = {
      name: 'Shared Project Name',
      description: 'A shared workflow with full overview details',
      categories: ['research', 'product', 'launch-2026'],
      createdAt: Date.UTC(2026, 0, 15, 12, 0, 0),
      updatedAt: Date.UTC(2026, 0, 16, 9, 30, 0),
    };

    seedFromShareResponse(shareId, JSON.stringify(overview));

    renderWithProviders(
      <ProjectOverviewSection
        projectId={shareId}
        projectName={overview.name}
      />,
    );

    // Name + description surface as plain text inside the inline-edit divs.
    expect(screen.getByText(overview.name)).toBeInTheDocument();
    expect(screen.getByText(overview.description)).toBeInTheDocument();

    // Every category from the share payload is rendered as a badge.
    for (const cat of overview.categories) {
      expect(screen.getByText(cat)).toBeInTheDocument();
    }
  });

  it('reflects edited overview after a re-share (new categories replace the old ones in the rendered UI)', () => {
    const shareId = 'share-uuid-reshare';

    // First share — viewer would seed this on initial fetch.
    seedFromShareResponse(
      shareId,
      JSON.stringify({
        name: 'Workflow v1',
        description: 'first pass',
        categories: ['draft'],
        createdAt: 1,
        updatedAt: 1,
      } satisfies OverviewBlob),
    );

    // Author edited overview, re-saved, viewer refetched and reseeded.
    const edited: OverviewBlob = {
      name: 'Workflow v2',
      description: 'second pass with new categories',
      categories: ['draft', 'in-review', 'q2-2026'],
      createdAt: 1,
      updatedAt: 2,
    };
    seedFromShareResponse(shareId, JSON.stringify(edited));

    renderWithProviders(
      <ProjectOverviewSection
        projectId={shareId}
        projectName={edited.name}
      />,
    );

    expect(screen.getByText(edited.name)).toBeInTheDocument();
    expect(screen.getByText(edited.description)).toBeInTheDocument();
    for (const cat of edited.categories) {
      expect(screen.getByText(cat)).toBeInTheDocument();
    }
  });

  it('renders nothing about categories when the share payload had no detailsData (no leakage from prior session)', () => {
    const shareId = 'share-uuid-empty';
    // Pretend a previous session left stale data — the viewer's seeding
    // logic explicitly removes the key when detailsData is null, so this
    // simulates exactly that.
    localStorage.setItem(
      `kiteframe-details-${shareId}`,
      JSON.stringify({
        name: 'stale',
        description: 'stale',
        categories: ['stale-cat'],
      }),
    );
    seedFromShareResponse(shareId, null);

    renderWithProviders(
      <ProjectOverviewSection projectId={shareId} projectName="" />,
    );

    expect(screen.queryByText('stale-cat')).not.toBeInTheDocument();
  });
});
