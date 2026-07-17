/**
 * G9 — the paid-data ledger (N1: "never pay for data you don't render").
 *
 * Every cost-bearing cached adapter wrapper in `cached-adapters.ts` must have a
 * LIVE consumer that actually CALLS it. A wrapper nobody calls is spend with no
 * possible payoff — the exact defect that shipped as `cachedDiscoverCompetitors`
 * (a `dc:*` size-banded cohort fetched, cached, and rendered nowhere; the prod
 * pipeline + every intel route use the closeness-ranked cohort instead). Deleted
 * 2026-07-17.
 *
 * Same idiom as `app/api/costed-routes.test.ts`, which pins the exact costed-route
 * list — this pins the exact consumer list. Two ways it bites:
 *   - a consumer that stops calling its wrapper → `expectCallsSymbol` fails;
 *   - a NEW exported wrapper added without a ledger entry → the coverage check fails
 *     (so you must name its live consumer, or it's dead and must not exist).
 * `expectCallsSymbol` proves a real call — an import, comment, or type-ref cannot
 * satisfy it, so a wrapper that is merely re-exported but never used still fails.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expectCallsSymbol } from "@/lib/testing/tripwire";

/** wrapper → one file that CALLS it (its consume/render target). */
const LEDGER: Array<{ wrapper: string; consumer: string }> = [
  { wrapper: "cachedBacklinks", consumer: "lib/scan/referral/funnel.ts" },
  { wrapper: "cachedRankedKeywords", consumer: "lib/scan/search-visibility.ts" },
  { wrapper: "cachedDomainOverview", consumer: "lib/scan/search-visibility.ts" },
  { wrapper: "cachedRelevantPages", consumer: "lib/scan/content/gather.ts" },
  { wrapper: "cachedKeywordIdeas", consumer: "lib/scan/demand/gather.ts" },
  { wrapper: "cachedKeywordVolumes", consumer: "lib/scan/search-visibility.ts" },
  { wrapper: "cachedDomainIntersection", consumer: "lib/scan/referral/discover.ts" },
  { wrapper: "cachedClosestCompetitors", consumer: "app/api/competitors/candidates/route.ts" },
  { wrapper: "cachedBrandedSearch", consumer: "lib/scan/referral/intel.ts" },
  { wrapper: "cachedBrandedSearchBatch", consumer: "lib/scan/referral/funnel.ts" },
  { wrapper: "cohortFor", consumer: "lib/scan/referral/funnel.ts" },
];

describe("G9 — paid-data ledger (never pay for data you don't render)", () => {
  for (const { wrapper, consumer } of LEDGER) {
    it(`${wrapper} has a live consumer that calls it (${consumer})`, () => {
      expectCallsSymbol(consumer, wrapper);
    });
  }

  it("every exported cost-bearing wrapper is in the ledger (no wrapper without a live consumer)", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/scan/cache/cached-adapters.ts"), "utf8");
    const exported = [...src.matchAll(/export\s+(?:async\s+)?function\s+(cached\w+|cohortFor)\b/g)].map((m) => m[1]!);
    const pinned = new Set(LEDGER.map((l) => l.wrapper));
    const missing = exported.filter((name) => !pinned.has(name));
    expect(
      missing,
      `cost-bearing wrapper(s) with no ledger entry — add one naming the live consumer, or delete the dead wrapper: ${missing.join(", ")}`,
    ).toEqual([]);
    // The deleted dead wrapper must never reappear without a consumer.
    expect(exported).not.toContain("cachedDiscoverCompetitors");
  });
});
