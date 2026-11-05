import type { CraftState } from './designPatchMerge';

/** Merge per-page Craft.js states under one ROOT, prefixing ids per page (`fi${i}_`) so they never collide. */
export function mergePageStates(states: CraftState[]): CraftState {
  const combined: Record<string, any> = {
    ROOT: {
      type: { resolvedName: 'AstryxSection' }, isCanvas: true, props: { direction: 'row', gap: 80, padding: 0 },
      displayName: 'AstryxSection', custom: {}, parent: null, hidden: false, nodes: [], linkedNodes: {},
    },
  };
  states.forEach((state, i) => {
    const prefix = `fi${i}_`;
    const remap = (id: string) => (id === 'ROOT' ? 'ROOT' : prefix + id);
    const srcRoot = (state as any)?.ROOT;
    if (!srcRoot) return;
    for (const id of srcRoot.nodes || []) if ((state as any)[id]) combined.ROOT.nodes.push(remap(id));
    for (const [id, node] of Object.entries(state)) {
      if (id === 'ROOT' || !node || typeof node !== 'object') continue;
      const n = node as any;
      combined[remap(id)] = {
        ...n,
        parent: !n.parent || n.parent === 'ROOT' ? 'ROOT' : remap(n.parent),
        nodes: (n.nodes || []).map(remap),
        linkedNodes: Object.fromEntries(Object.entries(n.linkedNodes || {}).map(([k, v]) => [k, remap(v as string)])),
      };
    }
  });
  return combined as CraftState;
}
