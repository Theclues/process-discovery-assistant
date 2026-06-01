/**
 * Per-organization memoization for expensive aggregate analyses (enterprise
 * network, employee relations, enterprise report). These recompute from every
 * org session, which is several seconds at 50-100 employees. We cache the
 * result and invalidate whenever a session for that org is saved, so the first
 * request after a change pays the cost and the rest are instant.
 *
 * Engineering cybernetics: bounded + observable — entries are dropped wholesale
 * per org on change (no stale reads), and the map is keyed only by active orgs.
 */

const cache = new Map<string, Map<string, unknown>>();

export function orgCacheGet<T>(orgId: string, key: string): T | undefined {
  return cache.get(orgId)?.get(key) as T | undefined;
}

export function orgCacheSet(orgId: string, key: string, value: unknown): void {
  let m = cache.get(orgId);
  if (!m) { m = new Map(); cache.set(orgId, m); }
  m.set(key, value);
}

/** Drop all cached analyses for an org (called when its data changes). */
export function invalidateOrg(orgId: string): void {
  cache.delete(orgId);
}
