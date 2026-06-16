/**
 * Demand discovery (M3) — clustering + ranking (PURE).
 *
 * Groups classified hits into "demand pockets" (a community/surface where the
 * problem is being discussed) and ranks them by intent density × reach, so the
 * strongest places to show up float to the top. No I/O — fully unit-testable.
 */

import type { ClassifiedHit, DemandPocket } from "./types";

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
 * Pocket score: total buyer-intent scaled by a gentle diminishing-returns reach
 * factor (log) so a surface with many medium-intent threads can outrank a single
 * hot thread, without letting raw volume dominate.
 */
export function pocketScore(intentSum: number, count: number): number {
  return intentSum * (1 + Math.log10(count));
}

/**
 * Cluster classified hits into ranked demand pockets. Only buyer-pain hits count
 * toward a pocket (discussion/noise is dropped). Pockets with no buyer-pain hits
 * are omitted. Returns pockets sorted by descending score.
 */
export function clusterIntoPockets(classified: ClassifiedHit[]): DemandPocket[] {
  const groups = new Map<string, ClassifiedHit[]>();
  for (const hit of classified) {
    if (!hit.isBuyerPain) continue;
    const key = pocketKey(hit);
    const arr = groups.get(key);
    if (arr) arr.push(hit);
    else groups.set(key, [hit]);
  }

  const pockets: DemandPocket[] = [];
  for (const [key, hits] of groups) {
    const intentSum = hits.reduce((s, h) => s + h.intent, 0);
    const topThreads = [...hits]
      .sort((a, b) => b.intent - a.intent)
      .slice(0, 5)
      .map((h) => ({ title: h.title, url: h.url, intent: h.intent }));
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
