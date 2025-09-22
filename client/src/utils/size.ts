// src/utils/size.ts
export const toPxNumber = (v: unknown, fallback: number): number => {
  if (typeof v === 'number') return isNaN(v) ? fallback : v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
};