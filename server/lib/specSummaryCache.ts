/** Per-user Specs summary caches: a user only evicts their own entries. */
export function createSpecSummaryCaches(maxUsers = 200, maxPerUser = 64) {
  const caches = new Map<string, Map<string, string>>();
  return (userId: string): Map<string, string> => {
    let cache = caches.get(userId);
    if (cache) caches.delete(userId);
    else cache = new Map();
    caches.set(userId, cache);
    if (caches.size > maxUsers) caches.delete(caches.keys().next().value as string);
    for (const key of Array.from(cache.keys())) {
      if (cache.size <= maxPerUser) break;
      cache.delete(key);
    }
    return cache;
  };
}
