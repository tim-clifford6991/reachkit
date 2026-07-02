/**
 * Global external-data cache (storage layer, Phase 1).
 *
 * Domain-level data from DataForSEO (backlinks, ranked keywords, top pages, link
 * intersections) is IDENTICAL regardless of which user is looking — so we cache it
 * once, globally, keyed by a namespaced string, and share it across every user and
 * cohort. This is the single biggest cost lever (it stops the funnels re-burning
 * DataForSEO credit on every run). Backed by the generic `search_cache` table
 * (key / response jsonb / created_at); `created_at` drives the TTL.
 *
 * Cache-first, write-through, best-effort: a cache read/write failure never breaks
 * the call — it just falls back to the live fetch.
 */
import { serverDb } from "@/lib/db/client";
import type { Json } from "@/lib/db/types";

export const DAY_MS = 24 * 60 * 60 * 1000;

// In-flight de-duplication: concurrent calls for the SAME key (e.g. an onboarding
// pre-compute racing the page's own fetch) share ONE computation instead of both
// hitting DataForSEO. Scoped to the server instance — the cross-instance worst
// case is a rare double-compute, vs. every single load before.
const inflight = new Map<string, Promise<unknown>>();

/**
 * Options for {@link cachedJson}.
 */
export interface CachedJsonOptions<T> {
  /**
   * Predicate that flags a computed value as "empty" — a degraded/failure result
   * (e.g. `[]`, `0`, `""`, an all-"other" classification) that adapters return
   * on transient errors. When it returns true the value is RETURNED but NOT
   * persisted, so a 30s outage can't poison the cache with an empty result for
   * the full TTL. A genuinely-empty result simply recomputes next load — the
   * exception, not the norm, and strictly better than weeks of poison.
   */
  isEmpty?: (value: T) => boolean;
}

/**
 * Return the cached value for `key` if fresher than `ttlMs`, else run `fetchFn`
 * (de-duplicated across concurrent callers), persist the result, and return it.
 */
export async function cachedJson<T>(
  key: string,
  ttlMs: number,
  fetchFn: () => Promise<T>,
  opts?: CachedJsonOptions<T>,
): Promise<T> {
  const db = serverDb();
  try {
    const { data } = await db.from("search_cache").select("response, created_at").eq("key", key).maybeSingle();
    if (data?.created_at && Date.now() - new Date(data.created_at).getTime() < ttlMs) {
      return data.response as T;
    }
  } catch {
    /* cache miss / read error → fetch live */
  }

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const p = (async () => {
    const fresh = await fetchFn();
    // Don't cache degraded/empty results (transient-failure poison).
    if (opts?.isEmpty?.(fresh)) {
      console.warn(`[cache] skip empty ${key}`);
      return fresh;
    }
    try {
      // supabase-js does NOT throw on a write failure — it returns `{ error }`.
      // Surface a persistent cache-write failure (else every call silently
      // recomputes) while keeping caching best-effort (never throw).
      const { error } = await db.from("search_cache").upsert({ key, response: fresh as unknown as Json, created_at: new Date().toISOString() });
      if (error) console.warn(`[cache] write failed ${key}: ${error.message}`);
    } catch (err) {
      /* best-effort persist */
      console.warn(`[cache] write threw ${key}: ${err instanceof Error ? err.message : String(err)}`);
    }
    return fresh;
  })();

  inflight.set(key, p);
  try {
    return (await p) as T;
  } finally {
    inflight.delete(key);
  }
}
