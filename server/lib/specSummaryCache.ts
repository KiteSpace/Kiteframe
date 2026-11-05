/** A Map that moves an entry to the back on every hit, so eviction from the front is least recently used. */
class LruMap<K, V> extends Map<K, V> {
  get(key: K): V | undefined {
    if (!super.has(key)) return undefined;
    const value = super.get(key) as V;
    super.delete(key);
    super.set(key, value);
    return value;
  }
}

/** Per-user Specs summary caches: a user only evicts their own entries. */
export function createSpecSummaryCaches(maxUsers = 200, maxPerUser = 64) {
  const caches = new LruMap<string, Map<string, string>>();
  return (userId: string): Map<string, string> => {
    let cache = caches.get(userId);
    if (!cache) {
      cache = new LruMap<string, string>();
      caches.set(userId, cache);
      if (caches.size > maxUsers) caches.delete(caches.keys().next().value as string);
    }
    for (const key of Array.from(cache.keys())) {
      if (cache.size <= maxPerUser) break;
      cache.delete(key);
    }
    return cache;
  };
}
