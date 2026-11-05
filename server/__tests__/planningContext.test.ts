import { describe, it, expect, vi } from 'vitest';
import {
  buildPlanningContext, buildPlanningContextWithSummaries, parseContextReport, specSectionHash, MAX_INTERFACE_CONTEXT_CHARS,
} from '@shared/interfacePlan';

const para = (word: string, n: number) => Array.from({ length: n }, (_, i) => `${word} rule ${i} applies here.`).join(' ');
const project = (sections: Array<[string, string]>) => ({ projectName: 'Billing', version: 3, hash: 'h', sections: sections.map(([title, content]) => ({ id: title, title, content })) });
const workflow = (sections: Array<[string, string]>) => ({ workflowName: 'Invoices', generatedAt: 1, sections: sections.map(([title, content]) => ({ id: title, title, content })) });
const body = (context: string) => JSON.parse(context.slice(context.indexOf('\n') + 1));

describe('buildPlanningContext', () => {
  it('is unchanged under budget', () => {
    const { context, report } = buildPlanningContext(project([['Overview', 'Invoices and members.']]), [workflow([['Fields', 'Number, due date.']])]);
    expect(context).toBe(JSON.stringify({
      workflowSpecs: [{ name: 'Invoices', sections: [{ title: 'Fields', content: 'Number, due date.' }] }],
      projectSpec: { name: 'Billing', sections: [{ title: 'Overview', content: 'Invoices and members.' }] },
    }));
    expect(report).toEqual({ included: ['Invoices › Fields', 'Billing › Overview'], condensed: [], dropped: [] });
  });

  it('returns empty context without Specs', () => {
    expect(buildPlanningContext(null, []).context).toBe('');
  });

  it('over budget: valid JSON, every heading kept, project spec not dropped first', () => {
    const wf = [workflow([['Fields', para('Field', 400)], ['States', para('State', 400)]])];
    const proj = project([['Pricing', para('Price', 400)], ['Roles', para('Role', 400)]]);
    const { context, report } = buildPlanningContext(proj, wf);
    expect(context.length).toBeLessThanOrEqual(MAX_INTERFACE_CONTEXT_CHARS);
    expect(context.startsWith('[CONTEXT CONDENSED')).toBe(true);
    const parsed = body(context);
    expect(parsed.workflowSpecs[0].sections.map((s: any) => s.title)).toEqual(['Fields', 'States']);
    expect(parsed.projectSpec.sections.map((s: any) => s.title)).toEqual(['Pricing', 'Roles']);
    expect(report.dropped).toEqual([]);
    expect(report.condensed.length + report.included.length).toBe(4);
    for (const s of [...parsed.workflowSpecs[0].sections, ...parsed.projectSpec.sections]) {
      if (s.condensed) expect(s.content.endsWith('applies here.…')).toBe(true);
    }
    expect(parseContextReport(context)).toEqual({ condensed: report.condensed, dropped: report.dropped });
  });

  it('is deterministic for the same input', () => {
    const args = [project([['Pricing', para('Price', 900)]]), [workflow([['Fields', para('Field', 900)]])]] as const;
    expect(buildPlanningContext(...args).context).toBe(buildPlanningContext(...args).context);
  });

  it('keeps sections that mention workflow steps in full first', () => {
    const proj = project([['Pricing', para('Price', 200)], ['Approvals', `Invoice Review happens here. ${para('Approval', 200)}`]]);
    const { report } = buildPlanningContext(proj, [], { nodeLabels: ['Invoice Review'], budget: 9000 });
    expect(report.included).toEqual(['Billing › Approvals']);
    expect(report.condensed).toEqual(['Billing › Pricing']);
  });

  it('drops to headings only when condensed text does not fit', () => {
    const many = project(Array.from({ length: 40 }, (_, i) => [`Section ${i}`, para(`S${i}`, 60)] as [string, string]));
    const { context, report } = buildPlanningContext(many, [], { budget: 6000 });
    expect(context.length).toBeLessThanOrEqual(6000);
    expect(report.dropped.length).toBeGreaterThan(0);
    expect(body(context).projectSpec.sections).toHaveLength(40);
  });
});

describe('buildPlanningContextWithSummaries', () => {
  it('summarises long sections in parallel, uses the summaries and caches by content hash', async () => {
    const proj = project([['Pricing', para('Price', 900)], ['Roles', para('Role', 900)]]);
    const summarise = vi.fn(async (content: string) => `Summary of ${content.slice(0, 5)}.`);
    const cache = new Map<string, string>();
    const first = await buildPlanningContextWithSummaries(proj, [], { summarise, cache });
    expect(summarise).toHaveBeenCalledTimes(2);
    expect(first.context).toContain('Summary of Price.');
    expect(cache.has(specSectionHash(para('Price', 900)))).toBe(true);
    await buildPlanningContextWithSummaries(proj, [], { summarise, cache });
    expect(summarise).toHaveBeenCalledTimes(2);
  });

  it('falls back to deterministic condensing when the summariser fails', async () => {
    const proj = project([['Pricing', para('Price', 900)]]);
    const { report } = await buildPlanningContextWithSummaries(proj, [], { summarise: async () => { throw new Error('x'); } });
    expect(report.condensed).toEqual(['Billing › Pricing']);
  });

  it('skips the summariser under budget', async () => {
    const summarise = vi.fn(async () => 's');
    await buildPlanningContextWithSummaries(project([['Overview', 'Short.']]), [], { summarise });
    expect(summarise).not.toHaveBeenCalled();
  });
});
