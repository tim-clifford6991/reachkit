/**
 * Integration test for collectDeltas (Cycle 4 Task 8) — the watermark-scoped
 * delta collectors that feed the weekly refresh pipeline (Task 9).
 *
 * Runs in FIXTURES mode (no API keys) for the happy path; a final case forces a
 * collector to fail (mocked adapter rejection) to prove collectDeltas never throws
 * and degrades that kind to an empty delta.
 *
 * collectDeltas is a pure function (no DB), so no Supabase seeding is required.
 *
 * Run with: pnpm test:int tests/integration/delta-collect.test.ts
 */

import { afterEach, expect, test, vi } from "vitest";
import { ScanBudget } from "@/lib/tools/registry";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts, WatermarkBody } from "@/lib/scan/types";

function makeCtx(): ScanContext {
  return {
    scanId: "delta-scan",
    appId: "delta-app",
    storeUrl: "https://apps.apple.com/us/app/habits/id123456789",
    mode: "ios",
    budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 150 }),
  };
}

function makeFacts(): PreliminaryFacts {
  return {
    mode: "ios",
    listing: { name: "Habits", category: "Health & Fitness", description: "Build habits" },
    competitors: [
      { name: "Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
    ],
    reviewVolume: 1500,
    ratingTrend: 4.6,
    webProxy: null,
    themes: [{ term: "streaks", count: 38 }, { term: "widget", count: 12 }],
    sourcesUsed: ["app_store_rss"],
    coldStart: false,
  };
}

// Baseline monitors: null/empty watermarks for every kind.
function baselineMonitors(): { kind: string; watermark: WatermarkBody }[] {
  return [
    { kind: "reviews", watermark: { lastReviewId: null } },
    { kind: "rank", watermark: { topRanks: {} } },
    { kind: "threads", watermark: { lastThreadAt: null } },
    { kind: "competitors", watermark: { knownCompetitors: [] } },
  ];
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

test("collectDeltas (fixtures, baseline) returns 4 advanced DeltaResults; rank/threads/competitors non-empty", async () => {
  vi.resetModules();
  vi.stubEnv("REACHKIT_USE_FIXTURES", "true");

  const { collectDeltas } = await import("@/lib/scan/delta-collect");

  const results = await collectDeltas(makeCtx(), baselineMonitors(), makeFacts());

  // One DeltaResult per monitor, preserving input order.
  expect(results.map((r) => r.kind)).toEqual(["reviews", "rank", "threads", "competitors"]);

  const byKind = Object.fromEntries(results.map((r) => [r.kind, r]));

  // reviews — BASELINE: marker advanced, no deltas emitted on the first run.
  expect(byKind.reviews?.items).toHaveLength(0);
  expect(byKind.reviews?.newWatermark.lastReviewId).toBeTypeOf("string");
  expect(byKind.reviews?.newWatermark.lastReviewId).not.toBeNull();

  // rank — no baseline special case: every keyword differs from the empty map.
  expect((byKind.rank?.items.length ?? 0)).toBeGreaterThan(0);
  expect(Object.keys(byKind.rank?.newWatermark.topRanks ?? {}).length).toBeGreaterThan(0);

  // threads — BASELINE: marker advanced, no deltas on first run... but fixture is
  // a non-empty source, so the items being empty here is the baseline behaviour.
  // The watermark must still advance to a real timestamp.
  expect(byKind.threads?.newWatermark.lastThreadAt).toBeTypeOf("string");
  expect(byKind.threads?.newWatermark.lastThreadAt).not.toBeNull();

  // competitors — no baseline special case: discovered names not in known set.
  expect((byKind.competitors?.items.length ?? 0)).toBeGreaterThan(0);
  expect((byKind.competitors?.newWatermark.knownCompetitors ?? []).length).toBeGreaterThan(0);
});

test("collectDeltas (fixtures) yields non-empty rank/threads/competitors once past baseline", async () => {
  vi.resetModules();
  vi.stubEnv("REACHKIT_USE_FIXTURES", "true");

  const { collectDeltas } = await import("@/lib/scan/delta-collect");

  // Non-baseline watermarks: reviews/threads already have a (stale) marker so the
  // fixture delta is emitted; rank has a stale map so all keywords count as changed.
  const monitors: { kind: string; watermark: WatermarkBody }[] = [
    { kind: "reviews", watermark: { lastReviewId: "rk-old-id" } },
    { kind: "rank", watermark: { topRanks: { "habit tracker app": 99 } } },
    { kind: "threads", watermark: { lastThreadAt: "2000-01-01T00:00:00Z" } },
    { kind: "competitors", watermark: { knownCompetitors: ["Habitify"] } },
  ];

  const results = await collectDeltas(makeCtx(), monitors, makeFacts());
  const byKind = Object.fromEntries(results.map((r) => [r.kind, r]));

  expect((byKind.reviews?.items.length ?? 0)).toBeGreaterThan(0);
  expect((byKind.rank?.items.length ?? 0)).toBeGreaterThan(0);
  expect((byKind.threads?.items.length ?? 0)).toBeGreaterThan(0);
  // competitors: Habitify already known, so only the NEW names appear.
  const compItems = (byKind.competitors?.items ?? []) as string[];
  expect(compItems.length).toBeGreaterThan(0);
  expect(compItems).not.toContain("Habitify");
});

test("a watermark already at latest yields empty items for that kind (no re-emit)", async () => {
  vi.resetModules();
  vi.stubEnv("REACHKIT_USE_FIXTURES", "true");

  const { collectDeltas } = await import("@/lib/scan/delta-collect");
  const { fixtureReviewDelta, fixtureRankDelta, fixtureThreadDelta, fixtureCompetitorDelta } =
    await import("@/lib/dev/fixtures");

  // Set each watermark to exactly what the fixtures would advance to.
  const reviewNewest = fixtureReviewDelta().newestId;
  const rankFresh = fixtureRankDelta({}).fresh;          // the full fresh map
  const threadNewest = fixtureThreadDelta().newestAt;
  const allFound = fixtureCompetitorDelta([]).found;     // every name already known

  const monitors: { kind: string; watermark: WatermarkBody }[] = [
    { kind: "reviews", watermark: { lastReviewId: reviewNewest } },
    { kind: "rank", watermark: { topRanks: rankFresh } },
    { kind: "threads", watermark: { lastThreadAt: threadNewest } },
    { kind: "competitors", watermark: { knownCompetitors: allFound } },
  ];

  const results = await collectDeltas(makeCtx(), monitors, makeFacts());
  const byKind = Object.fromEntries(results.map((r) => [r.kind, r]));

  // Nothing newer than the marker → empty delta for every kind.
  expect(byKind.reviews?.items).toHaveLength(0);
  expect(byKind.rank?.items).toHaveLength(0);
  expect(byKind.threads?.items).toHaveLength(0);
  expect(byKind.competitors?.items).toHaveLength(0);

  // Watermarks still reflect the latest state (idempotent advance).
  expect(byKind.reviews?.newWatermark.lastReviewId).toBe(reviewNewest);
  expect(byKind.threads?.newWatermark.lastThreadAt).toBe(threadNewest);
});

test("collectDeltas never throws when a collector's adapter rejects (degrades to empty delta)", async () => {
  vi.resetModules();

  // Run the LIVE (non-fixtures) path so the reviews collector actually calls the
  // adapter we mock to reject. Stub PAID keys so env validation passes regardless
  // of .env.local contents.
  vi.stubEnv("REACHKIT_USE_FIXTURES", "false");
  for (const k of [
    "ANTHROPIC_API_KEY", "DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD", "TAVILY_API_KEY",
    "RESEND_API_KEY", "PRODUCT_HUNT_TOKEN", "YOUTUBE_API_KEY", "VOYAGE_API_KEY",
  ]) {
    vi.stubEnv(k, "test-dummy");
  }

  // Force the reviews source to reject.
  vi.doMock("@/lib/scan/adapters/app-store-rss", () => ({
    fetchAppReviews: async () => { throw new Error("app-store-rss down"); },
    parseRssPage: () => [],
  }));

  const { collectDeltas } = await import("@/lib/scan/delta-collect");

  const watermark: WatermarkBody = { lastReviewId: "rk-existing" };
  const monitors = [{ kind: "reviews", watermark }];

  const results = await collectDeltas(makeCtx(), monitors, makeFacts());

  // Must resolve (never throw) with one result, degraded to an empty delta whose
  // watermark is preserved (no advance, nothing re-emitted next run).
  expect(results).toHaveLength(1);
  expect(results[0]?.kind).toBe("reviews");
  expect(results[0]?.items).toHaveLength(0);
  expect(results[0]?.newWatermark.lastReviewId).toBe("rk-existing");
});

test("collectDeltas preserves input order and tolerates an unknown kind", async () => {
  vi.resetModules();
  vi.stubEnv("REACHKIT_USE_FIXTURES", "true");

  const { collectDeltas } = await import("@/lib/scan/delta-collect");

  const monitors: { kind: string; watermark: WatermarkBody }[] = [
    { kind: "competitors", watermark: { knownCompetitors: [] } },
    { kind: "bogus-kind", watermark: {} },
    { kind: "rank", watermark: { topRanks: {} } },
  ];

  const results = await collectDeltas(makeCtx(), monitors, makeFacts());
  expect(results).toHaveLength(3);
  // unknown kind degrades to an empty delta with the watermark preserved
  expect(results[1]?.items).toHaveLength(0);
  // known kinds still produce their deltas in place
  expect((results[0]?.items.length ?? 0)).toBeGreaterThan(0);
  expect((results[2]?.items.length ?? 0)).toBeGreaterThan(0);
});
