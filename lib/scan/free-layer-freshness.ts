/**
 * Free-layer freshness policy (owner rule, 2026-07-24).
 *
 * When a free scan is DEEPENED (promoted to paid), the deep pass reuses the free
 * scan's persisted "free layer" — the identity + search-visibility footprint —
 * rather than re-fetching it, so the unified Discoverability Score is IDENTICAL
 * free↔paid (invariant #1: it never moves on upgrade).
 *
 * The bug this fixes: the deep pass used to unconditionally re-run
 * `gatherFreeSearchVisibility`. Its cache-hit assumption held only while the free
 * pass's `ranked_keywords` was still warm; once the free scan was more than a
 * cache-TTL old, the re-fetch returned DIFFERENT footprint data, which (a) moved
 * the score on upgrade (free total 10 → paid 19 for plausible.io, same v5 + same
 * pillars) and (b) surfaced that move as a false "▲ +9 since last scan" — a
 * re-measurement artifact, not a real gain.
 *
 * The policy is a single freshness gate:
 *   - free layer ≤ FREE_LAYER_MAX_AGE_DAYS old  → REUSE the persisted layer
 *       (stable score, honest delta, no wasted DataForSEO call).
 *   - free layer > FREE_LAYER_MAX_AGE_DAYS old  → RECOMPUTE (the stored footprint
 *       is stale; fresh data is the honest choice even though the score may move).
 *
 * A user can free-scan, come back weeks later and upgrade — and must never be
 * served a week-old free layer. Equally, a same-week upgrade must never see its
 * score jump because a cache expired between the two runs.
 */

/** Max age of a free scan's layer before a deepen must recompute it. */
export const FREE_LAYER_MAX_AGE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Should the deep pass REUSE the free scan's persisted search-visibility layer
 * (true) or RECOMPUTE it from a fresh footprint fetch (false)?
 *
 * Reuse requires BOTH: a persisted layer exists, AND the free scan is fresh
 * (≤ FREE_LAYER_MAX_AGE_DAYS). Missing layer or a bad/absent timestamp → recompute
 * (fail toward fresh data, never toward serving something stale/unknown).
 *
 * PURE — `now` injected for tests.
 */
export function shouldReuseFreeLayer(
  freeScanCreatedAt: string | Date | null | undefined,
  hasPersistedLayer: boolean,
  now: number = Date.now(),
): boolean {
  if (!hasPersistedLayer) return false;
  if (freeScanCreatedAt == null) return false;
  const created = new Date(freeScanCreatedAt).getTime();
  if (!Number.isFinite(created)) return false;
  const ageDays = (now - created) / DAY_MS;
  return ageDays <= FREE_LAYER_MAX_AGE_DAYS;
}
