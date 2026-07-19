import { describe, expect, it, vi, beforeEach } from "vitest";
import { expectCallsSymbol } from "@/lib/testing/tripwire";

// The warm MUST use the identical cache key as the gather, or it's wasted spend
// (a cache MISS → the free-report step re-fetches → double DataForSEO cost, the
// known cache-key-drift landmine). Spy on the cached-adapters to pin the args.
const rankedSpy = vi.fn(async (..._a: unknown[]) => [] as unknown[]);
const overviewSpy = vi.fn(async (..._a: unknown[]) => null);
vi.mock("@/lib/scan/cache/cached-adapters", () => ({
  cachedRankedKeywords: (...a: unknown[]) => rankedSpy(...a),
  cachedDomainOverview: (...a: unknown[]) => overviewSpy(...a),
  cachedKeywordVolumes: vi.fn(async () => []),
}));

import { warmFootprintCache } from "./search-visibility";

beforeEach(() => {
  rankedSpy.mockClear();
  overviewSpy.mockClear();
  rankedSpy.mockResolvedValue([]);
  overviewSpy.mockResolvedValue(null);
});

describe("warmFootprintCache (L1 overlap)", () => {
  it("warms ranked_keywords + domain_overview with the SAME key as the gather (normalizeHost + limit 50)", async () => {
    // gatherFreeSearchVisibility calls cachedRankedKeywords(normalizeHost(url), 50)
    // and cachedDomainOverview(normalizeHost(url)) — the warm must match exactly.
    await warmFootprintCache("https://Example.com/path");
    expect(rankedSpy).toHaveBeenCalledWith("example.com", 50);
    expect(overviewSpy).toHaveBeenCalledWith("example.com");
  });

  it("never throws (best-effort) even if a cache call rejects", async () => {
    rankedSpy.mockRejectedValueOnce(new Error("dfs down"));
    await expect(warmFootprintCache("https://x.com/")).resolves.toBeUndefined();
  });
});

describe("the findings step actually wires the overlap", () => {
  it("scan-requested's findings step calls warmFootprintCache", () => {
    expectCallsSymbol("lib/inngest/functions/scan-requested.ts", "warmFootprintCache");
  });
});
