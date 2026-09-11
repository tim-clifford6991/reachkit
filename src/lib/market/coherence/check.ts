// src/lib/market/coherence/check.ts — WO-080, BP-028
//
// Three verdicts, not two: `coherent`, `incoherent`, `unjudgeable` — never
// two. Below `COHERENCE.minMeasuredSearches` (3) the check has no input:
// with fewer than three measured top-tens no domain can reach the
// threshold whatever they contain, so a coherent and an incoherent market
// would produce the identical result. `unjudgeable` says so instead of
// guessing — REQ-094 criterion 2's promise, and this WO's whole reason to
// exist (BP-028 `## Error & edge behavior`).
//
// The threshold is a pinned *expression*, never a pinned number
// (BP-028 decision 1: "The threshold is a pinned expression, not a pinned
// number"). Neither `2` nor `4` appears as a literal in this file
// (`structure.md` rule 5) — both operands are read from `COHERENCE`.
import { COHERENCE } from "@/lib/config/constants";
import { registrableDomain } from "@/lib/market/rivals/domains";
import type { MarketSerpOrganic } from "../views";

/**
 * The organic-only read of a bought SERP, re-exported under the name this
 * module's callers already use. It is `src/lib/market/views.ts`' shared
 * declaration now, not a second copy of one: this file used to declare its
 * own and flagged the duplication for resolution, because a pure consumer
 * that must resolve no import into `src/lib/vendors/` had nowhere neutral
 * to read the shape from. `views.ts` is that place; the type is unchanged.
 */
export type { MarketSerpOrganic as SerpResult } from "../views";

export type CoherenceVerdict =
  | { verdict: "coherent" }
  | { verdict: "incoherent"; threshold: number; best: number }
  | { verdict: "unjudgeable"; measuredCount: number };

/** max(2, ceil(n / 4)) — a share of what was measured, never an absolute
 *  count. Rescales with the denominator: 3 at n = 12 (SPEC.md §6.7 step
 *  5's literal, at that one denominator), 2 at n = 4, never the whole
 *  number measured (REQ-094 criterion 2; REQ-006 criterion 1's variable
 *  denominator). */
export function coherenceThreshold(measuredCount: number): number {
  return Math.max(
    COHERENCE.minAppearances,
    Math.ceil(measuredCount / COHERENCE.shareDivisor)
  );
}

/**
 * Judges a report's market coherent, incoherent, or unjudgeable against a
 * threshold that rescales with what was actually measured.
 *
 * Below `COHERENCE.minMeasuredSearches`, returns `unjudgeable` before
 * counting anything: with that few measured top-tens no domain can reach
 * the threshold whatever they contain, so a coherent and an incoherent
 * market would produce the identical result — the boundary this WO is
 * mutation-tested against (doctrine 0.13.2).
 */
export function checkCoherence(a: {
  serps: readonly MarketSerpOrganic[];
  measuredCount: number;
}): CoherenceVerdict {
  const { serps, measuredCount } = a;

  if (measuredCount < COHERENCE.minMeasuredSearches) {
    return { verdict: "unjudgeable", measuredCount };
  }

  // Per registrable domain, in how many of the supplied SERPs' top tens it
  // appears — once per SERP, however many results on that SERP share the
  // domain.
  const appearances = new Map<string, number>();
  for (const serp of serps) {
    const seenOnThisSerp = new Set<string>();
    for (const result of serp.organic) {
      const domain = registrableDomain(result.domain);
      if (domain === null || seenOnThisSerp.has(domain)) continue;
      seenOnThisSerp.add(domain);
      appearances.set(domain, (appearances.get(domain) ?? 0) + 1);
    }
  }

  let best = 0;
  for (const count of appearances.values()) {
    if (count > best) best = count;
  }

  const threshold = coherenceThreshold(measuredCount);
  return best >= threshold
    ? { verdict: "coherent" }
    : { verdict: "incoherent", threshold, best };
}
