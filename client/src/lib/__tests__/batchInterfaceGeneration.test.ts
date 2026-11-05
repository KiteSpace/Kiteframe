import { describe, expect, it, vi } from 'vitest';
import type { InterfacePlan } from '@shared/interfacePlan';
import { generateInterfacePages, pagesToGenerate, type PageResult } from '../batchInterfaceGeneration';

function makePlan(pageCount = 1, extraPages: InterfacePlan['screens'] = []): InterfacePlan {
  const pages = Array.from({ length: pageCount }, (_, index) => ({
    id: `page-${index + 1}`,
    name: `Page ${index + 1}`,
    kind: 'page' as const,
    parentScreenId: '',
    actor: 'Analyst',
    goal: 'Review the work',
    description: `Page description ${index + 1}`,
    rationale: `Because source step ${index + 1} needs review`,
    nodeIds: index === 0 ? ['step-a'] : [],
    origin: index === 0 ? 'workflow' as const : 'user' as const,
    dataRequirements: [{ label: `Metric ${index + 1}`, kind: 'display' as const, required: true, origin: 'spec' as const }],
    actions: [{ label: 'Continue', targetScreenId: '', edgeIds: ['transition-a'], origin: 'workflow' as const }],
    states: [{ name: 'Ready', kind: 'success' as const, description: 'Results are ready', nodeIds: ['step-a'], edgeIds: ['transition-a'] }],
    selected: index < 6,
  }));
  return {
    version: 1,
    workflow: {
      name: 'Analytics',
      description: 'A detailed workflow overview',
      context: 'Use the product specification for terminology.',
      nodes: [{ id: 'step-a', label: 'Load report', description: 'Retrieve the report details', type: 'process', actor: 'Analyst' }],
      edges: [{ id: 'transition-a', source: 'step-a', target: 'step-a', label: 'Report loaded' }],
    },
    summary: 'Inspect report status and key metrics.',
    screens: [...pages, ...extraPages],
    backgroundSteps: [],
    assumptions: [{
      text: 'The report is already available to the analyst.',
      question: 'Should unavailable reports be selectable here?',
      nodeIds: ['step-a'],
    }],
  };
}

const state = (screenId: string) => JSON.stringify({ ROOT: { nodes: ['ab'] }, ab: { type: { resolvedName: 'AstryxArtboard' }, custom: { interfaceScreenId: screenId }, parent: 'ROOT', nodes: [] } });

describe('generateInterfacePages', () => {
  it('generates one page per call with the shared brief, then retries only the failed page', async () => {
    const plan = makePlan(4);
    const completed = new Map<string, PageResult>();
    let failPage3 = true;
    const generatePage = vi.fn(async (pagePlan: InterfacePlan, brief: any) => {
      const page = pagePlan.screens.filter((s) => s.selected && s.kind === 'page');
      expect(page).toHaveLength(1);
      expect(brief.navLabels).toEqual(['Page 1', 'Page 2', 'Page 3', 'Page 4']);
      if (page[0].id === 'page-3' && failPage3) throw new Error('max_tokens');
      return { craftState: state(page[0].id), warnings: [] };
    });
    const first = await generateInterfacePages(plan, { generatePage, completed });
    expect(generatePage).toHaveBeenCalledTimes(4);
    expect(first.failed.map((r) => [r.name, r.status, r.error])).toEqual([['Page 3', 'failed', 'max_tokens']]);
    expect(first.pages.map((p) => p.screenId)).toEqual(['page-1', 'page-2', 'page-4']);
    failPage3 = false;
    const progress: string[][] = [];
    const second = await generateInterfacePages(plan, { generatePage, completed, onProgress: (runs) => progress.push(runs.map((r) => r.status)) });
    expect(generatePage).toHaveBeenCalledTimes(5);
    expect(second.failed).toEqual([]);
    expect(second.pages.map((p) => p.screenId)).toEqual(['page-1', 'page-2', 'page-3', 'page-4']);
    expect(progress.at(-1)).toEqual(['done', 'done', 'done', 'done']);
  });

  it('cancel leaves remaining pages unstarted', async () => {
    const plan = makePlan(5);
    const controller = new AbortController();
    const generatePage = vi.fn(async (pagePlan: InterfacePlan) => {
      controller.abort();
      return { craftState: state(pagePlan.screens.find((s) => s.selected)!.id), warnings: [] };
    });
    const out = await generateInterfacePages(plan, { generatePage, completed: new Map(), signal: controller.signal });
    expect(generatePage).toHaveBeenCalledTimes(1);
    expect(out.cancelled).toBe(true);
    expect(out.failed.every((r) => r.status === 'cancelled')).toBe(true);
  });
});

describe('pagesToGenerate', () => {
  it('counts 1 credit per selected page, and only the unfinished pages on a retry', () => {
    const plan = makePlan(4);
    const pages = plan.screens.filter((s) => s.kind === 'page');
    expect(pagesToGenerate(plan)).toBe(pages.length);
    const completed = new Map<string, PageResult>([[pages[0].id, { craftState: '{}', warnings: [] }]]);
    expect(pagesToGenerate(plan, completed)).toBe(pages.length - 1);
  });
});
