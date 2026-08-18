export type AncestorsIndex = Record<string, string[]>;
export const AncestorsStore = (() => {
  let map: AncestorsIndex = {};
  const get = () => map;
  const set = (m: AncestorsIndex) => { map = m; };
  return { get, set };
})();