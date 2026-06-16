/**
 * Deep domain profiling (M2) — publish cadence (PURE).
 *
 * Turns a set of post dates into a recency-first cadence: how much, how recent,
 * and is it still active. Recency is the headline — a blog that last posted 2
 * years ago is a dead channel, not a live one.
 */

import type { Cadence } from "./types";

const DAY_MS = 86_400_000;

const EMPTY: Cadence = {
  totalPosts: 0,
  postsLast30: 0,
  postsLast90: 0,
  lastPublishedAt: null,
  postsPerMonth: 0,
  active: false,
};

/** Compute cadence from raw date strings. Invalid dates and future dates are
 *  dropped. `nowMs` is injectable for deterministic tests. PURE. */
export function computeCadence(dates: ReadonlyArray<string>, nowMs: number): Cadence {
  const times: number[] = [];
  for (const d of dates) {
    const t = Date.parse(d);
    if (Number.isNaN(t)) continue;
    if (t > nowMs) continue; // ignore future-dated noise
    times.push(t);
  }
  if (times.length === 0) return { ...EMPTY };

  times.sort((a, b) => a - b);
  const last = times[times.length - 1]!;
  const first = times[0]!;

  const postsLast30 = times.filter((t) => nowMs - t <= 30 * DAY_MS).length;
  const postsLast90 = times.filter((t) => nowMs - t <= 90 * DAY_MS).length;

  // Posts per month over the observed span (min 1 month to avoid div blow-up).
  const spanMonths = Math.max(1, (last - first) / (30 * DAY_MS));
  const postsPerMonth = times.length / spanMonths;

  return {
    totalPosts: times.length,
    postsLast30,
    postsLast90,
    lastPublishedAt: new Date(last).toISOString(),
    postsPerMonth: Math.round(postsPerMonth * 10) / 10,
    active: nowMs - last <= 90 * DAY_MS,
  };
}
