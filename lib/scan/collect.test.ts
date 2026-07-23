/**
 * Phase S (R-1.5, 2026-07-21) — the FREE scan gathers only its own page.
 *
 * Behavioural proof that the collect tier gate holds: a `tier: "free"` scan
 * makes NEITHER the review fetch NOR competitor discovery (both off the free
 * contract), and a `tier: "full"` scan makes both. Mutation-proven: flipping
 * the `gatherOffContract` predicate in collect.ts flips these assertions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const getListingRun = vi.fn(async (..._a: unknown[]) => ({
  listing: { name: "Acme", category: "widgets", description: "We sell widgets" },
  extras: {},
}));
const getReviewsRun = vi.fn(async (..._a: unknown[]) => ({ reviews: [{ id: "a", rating: 5, title: "t", body: "b" }] }));
const fetchWebReviews = vi.fn(async (..._a: unknown[]) => ({ snippets: ["great tool"], raw: {} }));
const discoverScanCompetitors = vi.fn(async (..._a: unknown[]) => ({
  competitors: [{ name: "Rival", url: "https://rival.com", rank: 1 }],
  extras: {},
}));
const persistCompetitors = vi.fn(async (..._a: unknown[]) => undefined);

vi.mock("@/lib/scan/tools/index", () => ({
  getListing: { run: (...a: unknown[]) => getListingRun(...a) },
  getReviews: { run: (...a: unknown[]) => getReviewsRun(...a) },
}));
vi.mock("@/lib/scan/adapters/web-reviews", () => ({
  fetchWebReviews: (...a: unknown[]) => fetchWebReviews(...a),
  reviewCountFromSnippets: () => 0,
}));
vi.mock("@/lib/scan/scan-competitors", () => ({
  discoverScanCompetitors: (...a: unknown[]) => discoverScanCompetitors(...a),
}));
vi.mock("@/lib/scan/competitors", () => ({
  persistCompetitors: (...a: unknown[]) => persistCompetitors(...a),
}));
vi.mock("@/lib/scan/progress", () => ({ emitScanEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/db/raw-documents", () => ({ upsertRawDocument: vi.fn(async () => undefined) }));
vi.mock("@/lib/scan/facts", () => ({
  // Pass the collected inputs straight through so the test can assert on them.
  assembleFacts: (_ctx: unknown, input: unknown) => input,
}));

import { collect } from "@/lib/scan/collect";
import type { ScanContext } from "@/lib/scan/pipeline";

function ctx(tier: "free" | "full"): ScanContext {
  return {
    scanId: "s1",
    appId: "a1",
    storeUrl: "https://acme.com",
    mode: "web",
    budget: { charge: vi.fn(), remaining: () => 100 } as never,
    tier,
  };
}

describe("collect tier gate (Phase S — free gathers only its own page)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("free scan skips the review fetch AND competitor discovery", async () => {
    const facts = (await collect(ctx("free"))) as unknown as { reviews: unknown[]; competitors: unknown[] };
    expect(fetchWebReviews).not.toHaveBeenCalled();
    expect(discoverScanCompetitors).not.toHaveBeenCalled();
    expect(facts.reviews).toEqual([]);
    expect(facts.competitors).toEqual([]);
    // The listing (the free contract's own-page read) is always gathered.
    expect(getListingRun).toHaveBeenCalledTimes(1);
  });

  it("full scan gathers reviews AND competitors", async () => {
    const facts = (await collect(ctx("full"))) as unknown as { reviews: unknown[]; competitors: unknown[] };
    expect(fetchWebReviews).toHaveBeenCalledTimes(1);
    expect(discoverScanCompetitors).toHaveBeenCalledTimes(1);
    expect(facts.reviews.length).toBe(1);
    expect(facts.competitors.length).toBe(1);
  });

  it("defaults to full when tier is absent (an un-updated caller never skips data)", async () => {
    const { tier: _drop, ...noTier } = ctx("full");
    await collect(noTier as ScanContext);
    expect(discoverScanCompetitors).toHaveBeenCalledTimes(1);
    expect(fetchWebReviews).toHaveBeenCalledTimes(1);
  });
});
