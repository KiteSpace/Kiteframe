import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrictMode, useEffect } from 'react';
import { render, screen, act } from '@testing-library/react';
import { AiJobsProvider, useAiJobs, type PendingAiJob } from '../AiJobsContext';
import { AiJobsIndicator } from '@/components/AiJobsIndicator';

const PENDING_KEY = 'kiteframe-pending-ai-jobs';

function seedPending(jobs: Array<Partial<PendingAiJob>>) {
  const full = jobs.map((j, i) => ({
    jobId: j.jobId ?? `job-${i}`,
    label: j.label ?? `Job ${i}`,
    taskType: j.taskType,
    originPath: j.originPath,
    startedAt: Date.now(),
  }));
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(full));
}

/**
 * Mirrors exactly what ChatMessageList does: claim while loading, release on
 * cleanup. Kept in the test rather than rendering the real component so the
 * claim lifecycle is isolated from chat rendering concerns.
 */
function Claimer({ isLoading, taskTypes, originPath }: {
  isLoading: boolean;
  taskTypes?: string[];
  originPath?: string;
}) {
  const { claimInlineIndicator, releaseInlineIndicator } = useAiJobs();
  useEffect(() => {
    if (!isLoading) return;
    const id = claimInlineIndicator({
      originPath: originPath ?? window.location.pathname,
      taskTypes,
    });
    return () => releaseInlineIndicator(id);
  }, [isLoading, claimInlineIndicator, releaseInlineIndicator, taskTypes, originPath]);
  return null;
}

const CHAT_TYPES = ['general_chat', 'workflow_reasoning', 'workflow_experiments', 'vision_ingestion'];

const pill = () => screen.queryByTestId('ai-jobs-indicator');

describe('AiJobs inline indicator claims', () => {
  beforeEach(() => {
    sessionStorage.clear();
    // The provider polls pending jobs in the background; keep it inert.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('hides the pill for a chat job the thread already reports inline', () => {
    seedPending([{ label: 'Thinking', taskType: 'general_chat', originPath: '/' }]);

    render(
      <AiJobsProvider>
        <Claimer isLoading taskTypes={CHAT_TYPES} />
        <AiJobsIndicator />
      </AiJobsProvider>,
    );

    expect(pill()).toBeNull();
  });

  it('keeps showing an unrelated PRD job running alongside a chat request', () => {
    seedPending([
      { jobId: 'chat', label: 'Thinking', taskType: 'general_chat', originPath: '/' },
      { jobId: 'prd', label: 'Generating PRD', taskType: 'prd_generation', originPath: '/' },
    ]);

    render(
      <AiJobsProvider>
        <Claimer isLoading taskTypes={CHAT_TYPES} />
        <AiJobsIndicator />
      </AiJobsProvider>,
    );

    // The chat job is claimed, the PRD job is not — so the pill must survive
    // and must report the PRD job, not the chat one.
    expect(pill()).not.toBeNull();
    expect(pill()!.textContent).toContain('Generating PRD');
    expect(pill()!.textContent).not.toContain('more');
  });

  it('does not claim a job that started on a different path', () => {
    seedPending([{ label: 'Thinking', taskType: 'general_chat', originPath: '/other-project' }]);

    render(
      <AiJobsProvider>
        <Claimer isLoading taskTypes={CHAT_TYPES} originPath="/" />
        <AiJobsIndicator />
      </AiJobsProvider>,
    );

    expect(pill()).not.toBeNull();
  });

  it('releases the claim when the thread stops loading', () => {
    seedPending([{ label: 'Thinking', taskType: 'general_chat', originPath: '/' }]);

    const { rerender } = render(
      <AiJobsProvider>
        <Claimer isLoading taskTypes={CHAT_TYPES} />
        <AiJobsIndicator />
      </AiJobsProvider>,
    );
    expect(pill()).toBeNull();

    rerender(
      <AiJobsProvider>
        <Claimer isLoading={false} taskTypes={CHAT_TYPES} />
        <AiJobsIndicator />
      </AiJobsProvider>,
    );
    expect(pill()).not.toBeNull();
  });

  it('releases the claim when the thread unmounts mid-flight', () => {
    seedPending([{ label: 'Thinking', taskType: 'general_chat', originPath: '/' }]);

    function Shell({ showThread }: { showThread: boolean }) {
      return (
        <AiJobsProvider>
          {showThread && <Claimer isLoading taskTypes={CHAT_TYPES} />}
          <AiJobsIndicator />
        </AiJobsProvider>
      );
    }

    const { rerender } = render(<Shell showThread />);
    expect(pill()).toBeNull();

    rerender(<Shell showThread={false} />);
    expect(pill()).not.toBeNull();
  });

  it('does not leave a stuck claim under StrictMode double-invocation', () => {
    seedPending([{ label: 'Thinking', taskType: 'general_chat', originPath: '/' }]);

    function Shell({ loading }: { loading: boolean }) {
      return (
        <StrictMode>
          <AiJobsProvider>
            <Claimer isLoading={loading} taskTypes={CHAT_TYPES} />
            <AiJobsIndicator />
          </AiJobsProvider>
        </StrictMode>
      );
    }

    const { rerender } = render(<Shell loading />);
    expect(pill()).toBeNull();

    // StrictMode runs setup/cleanup/setup. If cleanup released a claim it did
    // not own, the count would be stuck and the pill would stay hidden here.
    rerender(<Shell loading={false} />);
    expect(pill()).not.toBeNull();
  });

  it('survives rapid mount/unmount cycles without a stuck claim', () => {
    seedPending([{ label: 'Thinking', taskType: 'general_chat', originPath: '/' }]);

    function Shell({ n }: { n: number }) {
      return (
        <AiJobsProvider>
          {Array.from({ length: n }, (_, i) => (
            <Claimer key={i} isLoading taskTypes={CHAT_TYPES} />
          ))}
          <AiJobsIndicator />
        </AiJobsProvider>
      );
    }

    const { rerender } = render(<Shell n={3} />);
    expect(pill()).toBeNull();

    // Two of three threads go away — the remaining one still owns a claim.
    act(() => { rerender(<Shell n={1} />); });
    expect(pill()).toBeNull();

    // The last one goes away — every claim must have been released.
    act(() => { rerender(<Shell n={0} />); });
    expect(pill()).not.toBeNull();
  });
});
