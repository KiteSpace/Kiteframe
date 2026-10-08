import { describe, expect, it } from 'vitest';
import {
  buildApprovedInterfacePrompt, inspectGeneratedInterface, inspectInterfacePlan,
  interfacePlanSchema, selectInterfacePages,
} from '../interfacePlan';
import { interfacePlanningFixtures, userAddedPagePlan } from './fixtures/interfacePlanningFixtures';

describe('authoritative workflow interface plans', () => {
  for (const [name, { plan }] of Object.entries(interfacePlanningFixtures)) {
    it(`keeps valid source and branch mappings for ${name}`, () => {
      expect(inspectInterfacePlan(plan)).toEqual({ errors: [], warnings: [] });
      expect(buildApprovedInterfacePrompt(plan)).toContain(plan.screens[0].goal);
    });
  }
  it('rejects invented source ids and navigation destinations', () => {
    const plan = structuredClone(interfacePlanningFixtures.short.plan);
    plan.screens[0].nodeIds = ['invented'];
    plan.screens[0].actions[0].targetScreenId = 'missing-page';
    expect(inspectInterfacePlan(plan).errors).toHaveLength(2);
    expect(() => buildApprovedInterfacePrompt(plan)).toThrow('unknown workflow node');
  });
  it('reports missing coverage without vetoing structurally valid content', () => {
    const plan = structuredClone(interfacePlanningFixtures.approval.plan);
    plan.screens[1].actions = [];
    expect(inspectInterfacePlan(plan).errors).toEqual([]);
    expect(inspectInterfacePlan(plan).warnings.join(' ')).toContain('Branch "Approve"');
    expect(() => buildApprovedInterfacePrompt(plan)).not.toThrow();
  });
  it('preserves complete refined requirements and a page without source nodes', () => {
    const selected = selectInterfacePages(userAddedPagePlan, ['reports-page']);
    const prompt = buildApprovedInterfacePrompt(selected);
    expect(prompt).toContain('Download CSV');
    expect(prompt).toContain('Report results');
    expect(prompt).toContain('Reports');
    expect(inspectInterfacePlan(selected).errors).toEqual([]);
  });
  it('never silently drops pages beyond the generation limit', () => {
    const base = interfacePlanningFixtures.short.plan;
    const plan = interfacePlanSchema.parse({ ...base, screens: Array.from({ length: 8 }, (_, i) => ({
      ...base.screens[1], id: `page-${i}`, name: `Page ${i}`, actions: [],
    })) });
    expect(() => buildApprovedInterfacePrompt(plan)).toThrow('one to 6');
    expect(() => selectInterfacePages(plan, plan.screens.map(s => s.id))).toThrow('one and 6');
    const selected = selectInterfacePages(plan, ['page-0', 'page-7']);
    expect(buildApprovedInterfacePrompt(selected)).toContain('"omittedPages"');
    expect(selected.screens.filter(s => s.selected)).toHaveLength(2);
  });
  it('attaches dialogs to a selected page instead of generating extra artboards', () => {
    const base = interfacePlanningFixtures.short.plan;
    const plan = interfacePlanSchema.parse({ ...base, screens: [...base.screens, {
      ...base.screens[0], id: 'confirm', name: 'Confirm sign in', kind: 'dialog', parentScreenId: 'login-page',
    }] });
    const selected = selectInterfacePages(plan, ['login-page']);
    expect(selected.screens.find(s => s.id === 'confirm')?.selected).toBe(true);
    expect(buildApprovedInterfacePrompt(selected)).toContain('Dialog and inline surfaces belong INSIDE');
  });
  it('detects missing artboards as errors and missing control labels as advisory', () => {
    const plan = selectInterfacePages(userAddedPagePlan, ['reports-page']);
    const state = {
      ROOT: { type: { resolvedName: 'AstryxContainer' }, nodes: ['report'] },
      report: { type: { resolvedName: 'AstryxArtboard' }, props: { label: 'Reports' }, nodes: ['text'] },
      text: { type: { resolvedName: 'AstryxText' }, props: { children: 'Report results' }, nodes: [] },
    };
    const check = inspectGeneratedInterface(plan, state);
    expect(check.errors).toEqual([]);
    expect(check.warnings.join(' ')).toContain('Download CSV');
    expect(inspectGeneratedInterface(plan, {}).errors.join(' ')).toContain('found 0');
  });
  it('fails explicitly on oversized approved plans instead of truncating fields', () => {
    const plan = structuredClone(interfacePlanningFixtures.short.plan);
    plan.workflow.context = 'x'.repeat(50000);
    expect(() => buildApprovedInterfacePrompt(plan)).toThrow('too large');
  });
});
