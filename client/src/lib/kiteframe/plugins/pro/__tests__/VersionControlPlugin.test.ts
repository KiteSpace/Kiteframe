import { describe, it, expect } from 'vitest';
import { VersionControlPlugin } from '../VersionControlPlugin';

describe('VersionControlPlugin.patchTabFromResponse', () => {
  const makeRes = (body: any, ok = true): Response =>
    ({
      ok,
      json: async () => body,
    }) as unknown as Response;

  const callPatch = async (tab: any, res: Response) => {
    const plugin = new VersionControlPlugin();
    await (plugin as any).patchTabFromResponse(tab, res);
  };

  it('adopts cloudProjectId on a tab that had none', async () => {
    const tab: any = { cloudProjectId: undefined };
    await callPatch(tab, makeRes({ cloudProjectId: 'proj-fresh' }));
    expect(tab.cloudProjectId).toBe('proj-fresh');
  });

  it('replaces a stale cloudProjectId with the server-resolved id', async () => {
    const tab: any = { cloudProjectId: 'proj-stale-or-foreign' };
    await callPatch(tab, makeRes({ cloudProjectId: 'proj-correct' }));
    expect(tab.cloudProjectId).toBe('proj-correct');
  });

  it('leaves the tab alone when ids match', async () => {
    const tab: any = { cloudProjectId: 'proj-same' };
    await callPatch(tab, makeRes({ cloudProjectId: 'proj-same' }));
    expect(tab.cloudProjectId).toBe('proj-same');
  });

  it('does not clobber the tab when server returns null', async () => {
    const tab: any = { cloudProjectId: 'proj-keep' };
    await callPatch(tab, makeRes({ cloudProjectId: null }));
    expect(tab.cloudProjectId).toBe('proj-keep');
  });

  it('skips patching on a non-OK response', async () => {
    const tab: any = { cloudProjectId: 'proj-keep' };
    await callPatch(tab, makeRes({ cloudProjectId: 'proj-other' }, false));
    expect(tab.cloudProjectId).toBe('proj-keep');
  });

  it('tolerates a body that is not valid JSON without throwing', async () => {
    const tab: any = { cloudProjectId: 'proj-keep' };
    const res = {
      ok: true,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response;
    await callPatch(tab, res);
    expect(tab.cloudProjectId).toBe('proj-keep');
  });
});
