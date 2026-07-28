import { describe, expect, it } from "vitest";
import { classificationDegraded } from "@/lib/scan/referral/funnel";

/**
 * Guard for the funnel cache's don't-cache-empties predicate (invariant #3,
 * applied to the funnel2 blob). Root case (LIVE, 2026-07-28): trustmrr's funnel2
 * row cached `byCategory = {"other": 120}` for the subject AND all 5 competitors
 * — the competitors tab read all-"None" for 7 days. classifyReferrers had
 * truncated a single 400-host Haiku call and returned an EMPTY map, so every host
 * defaulted to "other". The chunking fix stops the truncation; THIS predicate
 * stops any future wholesale classify failure from poisoning the cache regardless.
 *
 * classificationDegraded IS the production isEmpty predicate (funnel.ts wires it
 * onto gatherFullFunnel's cachedJson) — this tests the real logic, not a replica.
 */
describe("classificationDegraded (funnel cache poison guard)", () => {
  it("flags the trustmrr signature: a real host set, nothing classified", () => {
    // 120 hosts in, classifyReferrers returned an empty map → all fell to "other".
    expect(classificationDegraded(120, 0)).toBe(true);
  });

  it("does NOT flag a referrer-less site (0 hosts → legitimately empty matrix)", () => {
    // reachkit.app (unlaunched) has no referrers — its empty byCategory is honest
    // and must cache normally, never recompute forever.
    expect(classificationDegraded(0, 0)).toBe(false);
  });

  it("does NOT flag a PARTIAL classification (some batch succeeded)", () => {
    // Chunked classify: one batch failed, another classified 5 hosts → keep it.
    expect(classificationDegraded(120, 5)).toBe(false);
  });

  it("does NOT flag a tiny host set that could legitimately all be 'other'", () => {
    // Below the floor: a 3-host cohort returning nothing is within noise, not the
    // wholesale-truncation signature.
    expect(classificationDegraded(3, 0)).toBe(false);
  });

  it("flags exactly at the floor boundary", () => {
    // Mutation tripwire: flipping `>=` to `>` or the floor value breaks this.
    expect(classificationDegraded(8, 0)).toBe(true);
    expect(classificationDegraded(7, 0)).toBe(false);
  });
});
