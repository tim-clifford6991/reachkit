/**
 * Demand discovery (M3) — clustering + ranking (PURE).
 *
 * Groups classified hits into "demand pockets" (a community/surface where the
 * problem is being discussed) and ranks them by intent density × reach, so the
 * strongest places to show up float to the top. No I/O — fully unit-testable.
 */

import type { ClassifiedHit, DemandPocket } from "./types";

const DAY_MS = 86_400_000;

/** Group key for a hit: its subreddit, else the URL's host. */
export function pocketKey(hit: ClassifiedHit): string {
  if (hit.subreddit) return hit.subreddit;
  try {
    return new URL(hit.url).host.replace(/^www\./, "");
  } catch {
    return "other";
  }
}

/**
 * Recency multiplier for a hit (0..1). Fresh problem-talk is worth far more than
 * a stale thread. Unknown dates get a mild penalty (could be old) rather than a
 * zero, so dateless-but-relevant hits still surface. PURE.
 */
export function recencyWeight(publishedAt: string | null, nowMs: number): number {
  if (!publishedAt) return 0.7;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return 0.7;
  const ageDays = (nowMs - t) / DAY_MS;
  if (ageDays <= 30) return 1;
  if (ageDays <= 90) return 0.9;
  if (ageDays <= 180) return 0.75;
  if (ageDays <= 365) return 0.55;
  if (ageDays <= 730) return 0.35;
  return 0.2;
}

/**
 * Pocket score: total buyer-intent scaled by a gentle diminishing-returns reach
 * factor (log) so a surface with many medium-intent threads can outrank a single
 * hot thread, without letting raw volume dominate.
 */
export function pocketScore(intentSum: number, count: number): number {
  return intentSum * (1 + Math.log10(count));
}

/**
 * Cluster classified hits into ranked demand pockets. Only buyer-pain hits count
 * toward a pocket (discussion/noise is dropped). Each hit's intent is weighted by
 * recency, so a pocket full of fresh threads outranks one of stale ones, and the
 * freshest threads surface first. Pockets with no buyer-pain hits are omitted.
 * `nowMs` is injectable for deterministic tests. Sorted by descending score.
 */
export function clusterIntoPockets(
  classified: ClassifiedHit[],
  nowMs: number = Date.now(),
): DemandPocket[] {
  const groups = new Map<string, ClassifiedHit[]>();
  for (const hit of classified) {
    if (!hit.isBuyerPain) continue;
    const key = pocketKey(hit);
    const arr = groups.get(key);
    if (arr) arr.push(hit);
    else groups.set(key, [hit]);
  }

  const eff = (h: ClassifiedHit) => h.intent * recencyWeight(h.publishedAt, nowMs);

  const pockets: DemandPocket[] = [];
  for (const [key, hits] of groups) {
    const intentSum = hits.reduce((s, h) => s + eff(h), 0);
    const topThreads = [...hits]
      .sort((a, b) => eff(b) - eff(a))
      .slice(0, 5)
      .map((h) => ({ title: h.title, url: h.url, intent: h.intent, publishedAt: h.publishedAt }));
    pockets.push({
      surface: key,
      subreddit: hits[0]?.subreddit ?? null,
      count: hits.length,
      intentSum,
      score: pocketScore(intentSum, hits.length),
      topThreads,
    });
  }

  return pockets.sort((a, b) => b.score - a.score);
}
