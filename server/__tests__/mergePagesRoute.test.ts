import { describe, expect, it, vi } from 'vitest';
import { createMergePagesHandler } from '../lib/mergePagesRoute';

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
    const r2 = res();
    await handler({ body: { interfacePlan: {}, pages: [{ screenId: 's', craftState: 'x'.repeat(200001) }] } } as any, r2);
    expect(r2.statusCode).toBe(400);
  });
});
