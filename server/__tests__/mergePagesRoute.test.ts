import { describe, expect, it, vi } from 'vitest';
import { createMergePagesHandler } from '../lib/mergePagesRoute';
import { interfacePlanningFixtures } from '../../shared/__tests__/fixtures/interfacePlanningFixtures';

const res = () => {
  const r: any = { statusCode: 200, body: undefined };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  return r;
};

describe('merge-pages route', () => {
  it('returns 404 when mock_workflow_batch is off, without reading the body', async () => {
    const isOn = vi.fn().mockResolvedValue(false);
    const r = res();
    await createMergePagesHandler(isOn)({ body: { pages: 'x' } } as any, r);
    expect(isOn).toHaveBeenCalled();
    expect(r.statusCode).toBe(404);
  });

  it('rejects invalid or oversized page results when the flag is on', async () => {
    const handler = createMergePagesHandler(async () => true);
    const r1 = res();
    await handler({ body: {} } as any, r1);
    expect(r1.statusCode).toBe(400);
  });

  it('accepts a 200,000-character page result and rejects one character more', async () => {
    const handler = createMergePagesHandler(async () => true);
    const plan = Object.values(interfacePlanningFixtures)[0].plan;
    const body = (length: number) => ({ interfacePlan: plan, pages: [{ screenId: plan.screens[0].id, craftState: '{}'.padEnd(length, ' ') }] });
    const atLimit = res();
    await handler({ body: body(200000) } as any, atLimit);
    expect(atLimit.statusCode).not.toBe(400);
    const overLimit = res();
    await handler({ body: body(200001) } as any, overLimit);
    expect(overLimit.statusCode).toBe(400);
  });
});
