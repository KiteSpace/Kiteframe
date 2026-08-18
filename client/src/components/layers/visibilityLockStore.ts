export type FlagMap = {
  hidden: Record<string, boolean>;
  locked: Record<string, boolean>;
};

export const VLStore = (() => {
  let state: FlagMap = { hidden: {}, locked: {} };
  const listeners = new Set<() => void>();
  const get = () => state;
  const set = (next: Partial<FlagMap>) => {
    state = {
      hidden: { ...state.hidden, ...(next.hidden ?? {}) },
      locked: { ...state.locked, ...(next.locked ?? {}) },
    };
    listeners.forEach(l => l());
  };
  const subscribe = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));
  const toggle = (flag:'hidden'|'locked', id:string) => set({ [flag]: { [id]: !state[flag][id] } as any });
  return { get, set, toggle, subscribe };
})();