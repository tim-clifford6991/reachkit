/**
 * Integration test for the weekly delta-refresh pipeline (Cycle 4 Task 9).
 *
 * Runs against real Supabase. Three scenarios:
 *
 *  1. HAPPY PATH (fixtures mode) — seed app + completed scan (preliminary_facts +
 *     findings_payload) + 4 monitors with baseline watermarks; runWeeklyRefresh →
 *     assert: a score_snapshots row was written, monitor watermarks advanced,
 *     `changes` non-empty, newActions >= 0, the appended actions exist and are
 *     deduped on a 2nd run (no duplicate titles), and a pipeline_runs "refresh"
 *     row was recorded.
 *
 *  2. NO-OP PATH (fixtures mode) — monitors already at the latest fixture
 *     watermarks (so collectDeltas returns all-empty) → noOp:true, costCents:0,
 *     no new actions, still a "refresh" telemetry row, watermarks/last_run_at
 *     advanced.
 *
 *  3. DIVERGENCE SELF-MATCH REGRESSION — a second algorithmSafety run on the same
 *     app with the SAME drafts must NOT flag divergence (the app's own prior draft
 *     embeddings are deleted before the cross-customer search). Uses deterministic
 *     fixtureEmbed vectors against real pgvector with fixturesEnabled()=false so
 *     the search path actually runs; divergence flagging would trigger a callModel
 *     rewrite, so "callModel not called on the 2nd run" proves no self-match.
 *
 * Run with: pnpm test:int tests/integration/refresh.test.ts
 */

import { afterEach, expect, test, vi } from "vitest";
import { serverDb } from "@/lib/db/client";
import { ScanBudget } from "@/lib/tools/registry";
import {
  fixtureReviewDelta,
  fixtureRankDelta,
  fixtureThreadDelta,
  fixtureCompetitorDelta,
} from "@/lib/dev/fixtures";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts, WatermarkBody } from "@/lib/scan/types";
import type { Json } from "@/lib/db/types";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function makeFacts(): PreliminaryFacts {
  return {
    mode: "ios",
    listing: { name: "HabitKit", category: "Health & Fitness", description: "Build habits" },
    competitors: [
      { name: "Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
      { name: "Streaks", url: "https://streaksapp.com", source: "dataforseo_serp", rank: 2 },
    ],
    reviewVolume: 1500,
    ratingTrend: 4.6,
    webProxy: null,
    themes: [
      { term: "streaks", count: 38 },
      { term: "widget", count: 12 },
    ],
    sourcesUsed: ["app_store_rss", "itunes", "dataforseo_serp"],
  };
}

const FINDINGS_PAYLOAD = {
  positioningMirror: {
    listingSays: "Build habits in 21 days",
    reviewsValue: "Users prize streaks",
    gap: "Listing over-promises the timeline",
  },
  findings: [
    {
      category: "seo_aso",
      claim: "High-volume keyword 'habit tracker app' absent from the listing",
      basis: "evidence_based",
      confidence: 0.91,
      evidence: [{ excerpt: "habit tracker app", source: "keyword_data" }],
    },
  ],
  score: { total: 14, breakdown: { content: 10, outreach: 5, seo: 22 } },
};

async function seedAppAndScan(
  storeUrl: string,
  monitorWatermarks: Record<string, WatermarkBody>,
): Promise<ScanContext> {
  const db = serverDb();

  const { data: appRow, error: appErr } = await db
    .from("apps")
    .insert({ store_url: storeUrl, platform: "ios" })
    .select("id")
    .single();
  if (appErr) throw appErr;
  if (!appRow) throw new Error("no app row");

  const { data: scanRow, error: scanErr } = await db
    .from("scans")
    .insert({
      app_id: appRow.id,
      status: "done",
      started_at: new Date().toISOString(),
      preliminary_facts: makeFacts() as unknown as Json,
      findings_payload: FINDINGS_PAYLOAD as unknown as Json,
    })
    .select("id")
    .single();
  if (scanErr) throw scanErr;
  if (!scanRow) throw new Error("no scan row");

  // Seed the 4 monitors with the requested baseline watermarks.
  const rows = (["reviews", "rank", "threads", "competitors"] as const).map((kind) => ({
    app_id: appRow.id,
    kind,
    cadence: "weekly",
    last_run_at: null,
    query: null,
    watermark: (monitorWatermarks[kind] ?? {}) as unknown as Json,
  }));
  const { error: monErr } = await db.from("monitors").insert(rows);
  if (monErr) throw monErr;

  return {
    scanId: scanRow.id,
    appId: appRow.id,
    storeUrl,
    mode: "ios",
    budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 150 }),
  };
}

// Baseline (stale) watermarks → the fixture deltas are emitted on the first run.
function staleWatermarks(): Record<string, WatermarkBody> {
  return {
    reviews: { lastReviewId: "rk-old-id" },
    rank: { topRanks: { "habit tracker app": 99 } },
    threads: { lastThreadAt: "2000-01-01T00:00:00Z" },
    competitors: { knownCompetitors: ["Habitify"] },
  };
}

// Watermarks already at the latest fixture values → collectDeltas returns all-empty.
function latestWatermarks(): Record<string, WatermarkBody> {
  return {
    reviews: { lastReviewId: fixtureReviewDelta().newestId },
    rank: { topRanks: fixtureRankDelta({}).fresh },
    threads: { lastThreadAt: fixtureThreadDelta().newestAt },
    competitors: { knownCompetitors: fixtureCompetitorDelta([]).found },
  };
}

// ---------------------------------------------------------------------------
// 1. Happy path
// ---------------------------------------------------------------------------

test(
  "runWeeklyRefresh (fixtures) writes a score snapshot, advances watermarks, appends deduped actions, logs a refresh run",
  async () => {
    vi.resetModules();
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");

    const { runWeeklyRefresh } = await import("@/lib/scan/refresh");

    const storeUrl = `https://apps.apple.com/us/app/habitkit/id${Date.now()}`;
    const ctx = await seedAppAndScan(storeUrl, staleWatermarks());
    const db = serverDb();

    const result = await runWeeklyRefresh(ctx, { weekOf: "2026-06-08" });

    // Not a no-op: the stale fixtures produce real deltas.
    expect(result.noOp).toBe(false);
    expect(result.weekOf).toBe("2026-06-08");
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.newActions).toBeGreaterThanOrEqual(0);
    // Every change carries a non-empty summary + a boolean novelty flag.
    for (const c of result.changes) {
      expect(typeof c.summary).toBe("string");
      expect(c.summary.length).toBeGreaterThan(0);
      expect(typeof c.novel).toBe("boolean");
    }

    // A score_snapshots row was written for the app.
    const { data: snaps, error: snapErr } = await db
      .from("score_snapshots")
      .select("total, breakdown, taken_at")
      .eq("app_id", ctx.appId);
    expect(snapErr).toBeNull();
    expect(snaps).not.toBeNull();
    expect(snaps!.length).toBeGreaterThanOrEqual(1);
    expect(typeof snaps![0]!.total).toBe("number");

    // Monitor watermarks advanced + last_run_at set on every monitor.
    const { data: monitors, error: monErr } = await db
      .from("monitors")
      .select("kind, watermark, last_run_at")
      .eq("app_id", ctx.appId);
    expect(monErr).toBeNull();
    expect(monitors!.length).toBe(4);
    for (const m of monitors ?? []) {
      expect(m.last_run_at).not.toBeNull();
    }
    const reviews = monitors!.find((m) => m.kind === "reviews");
    const reviewsWm = reviews!.watermark as { lastReviewId?: unknown };
    // advanced past the stale "rk-old-id" to the fixture's newest id
    expect(reviewsWm.lastReviewId).toBe(fixtureReviewDelta().newestId);

    // A pipeline_runs "refresh" row was recorded.
    const { data: runs, error: runErr } = await db
      .from("pipeline_runs")
      .select("stage, cost_cents")
      .eq("scan_id", ctx.scanId)
      .eq("stage", "refresh");
    expect(runErr).toBeNull();
    expect(runs!.length).toBeGreaterThanOrEqual(1);

    // Appended actions exist for the app.
    const { data: actions1, error: actErr } = await db
      .from("actions")
      .select("title")
      .eq("app_id", ctx.appId);
    expect(actErr).toBeNull();
    const titlesAfter1 = (actions1 ?? []).map((a) => a.title);
    expect(titlesAfter1.length).toBe(result.newActions);

    // Idempotency — a 2nd refresh in the same week must not duplicate action titles.
    // (Re-seed the stale watermarks so the same fixture deltas re-fire.)
    const { error: resetErr } = await db
      .from("monitors")
      .update({ watermark: { lastReviewId: "rk-old-id" } as unknown as Json })
      .eq("app_id", ctx.appId)
      .eq("kind", "reviews");
    expect(resetErr).toBeNull();

    await runWeeklyRefresh(ctx, { weekOf: "2026-06-08" });

    const { data: actions2 } = await db
      .from("actions")
      .select("title")
      .eq("app_id", ctx.appId);
    const titlesAfter2 = (actions2 ?? []).map((a) => a.title);
    // No duplicate titles introduced.
    const uniqueTitles = new Set(titlesAfter2);
    expect(uniqueTitles.size).toBe(titlesAfter2.length);
  },
  90_000,
);

// ---------------------------------------------------------------------------
// 2. No-op path
// ---------------------------------------------------------------------------

test(
  "runWeeklyRefresh (fixtures, monitors at latest) is a cheap no-op: noOp:true, costCents:0, no actions",
  async () => {
    vi.resetModules();
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");

    const { runWeeklyRefresh } = await import("@/lib/scan/refresh");

    const storeUrl = `https://apps.apple.com/us/app/habitkit/id${Date.now()}-noop`;
    const ctx = await seedAppAndScan(storeUrl, latestWatermarks());
    const db = serverDb();

    const result = await runWeeklyRefresh(ctx);

    expect(result.noOp).toBe(true);
    expect(result.costCents).toBe(0);
    expect(result.changes).toHaveLength(0);
    expect(result.newActions).toBe(0);

    // No actions appended.
    const { data: actions } = await db.from("actions").select("id").eq("app_id", ctx.appId);
    expect((actions ?? []).length).toBe(0);

    // A zero-cost "refresh" telemetry row was still recorded.
    const { data: runs } = await db
      .from("pipeline_runs")
      .select("stage, cost_cents")
      .eq("scan_id", ctx.scanId)
      .eq("stage", "refresh");
    expect(runs!.length).toBeGreaterThanOrEqual(1);
    expect(Number(runs![0]!.cost_cents)).toBe(0);

    // Watermarks + last_run_at still advanced (idempotent advance even on no-op).
    const { data: monitors } = await db
      .from("monitors")
      .select("kind, last_run_at")
      .eq("app_id", ctx.appId);
    for (const m of monitors ?? []) {
      expect(m.last_run_at).not.toBeNull();
    }
  },
  60_000,
);

// ---------------------------------------------------------------------------
// 3. Divergence self-match regression
// ---------------------------------------------------------------------------

test(
  "algorithmSafety: a 2nd run on the same app with the same drafts does NOT self-flag divergence",
  async () => {
    vi.resetModules();
    // NON-fixtures so applyDivergenceCheck actually runs searchSimilar against
    // real pgvector. We mock callEmbed (deterministic fixture vectors → a guaranteed
    // ~1.0 self-match if the app's own drafts were left in the index) and callModel
    // (so a divergence-triggered rewrite is observable and never hits Anthropic).
    vi.stubEnv("REACHKIT_USE_FIXTURES", "false");

    const { fixtureEmbed } = await import("@/lib/dev/fixtures");

    vi.doMock("@/lib/llm/embed", () => ({
      callEmbed: vi.fn(async (texts: string[]) => fixtureEmbed(texts)),
    }));

    const callModelMock = vi.fn(async () => ({
      text: "REWRITTEN",
      usage: { inputTokens: 1, outputTokens: 1 },
    }));
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));

    const { algorithmSafety } = await import("@/lib/scan/algorithm-safety");
    const db = serverDb();

    // Seed a real app row (embeddings.app_id FK is enforced).
    const storeUrl = `https://apps.apple.com/us/app/habitkit/id${Date.now()}-div`;
    const { data: appRow, error: appErr } = await db
      .from("apps")
      .insert({ store_url: storeUrl, platform: "ios" })
      .select("id")
      .single();
    if (appErr) throw appErr;
    if (!appRow) throw new Error("no app row");

    const ctx: ScanContext = {
      scanId: `div-regression-${Date.now()}`,
      appId: appRow.id,
      storeUrl,
      mode: "ios",
      budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 150 }),
    };

    // A specific, non-generic draft (so genericTellScore < threshold → the ONLY
    // thing that could call callModel here is a divergence-triggered rewrite).
    const cards = [
      {
        category: "content" as const,
        title: "Lead the listing with streak consistency",
        why: "Reviews cite the streak feature as the reason users stay.",
        evidenceIds: [],
        evidence: [
          { excerpt: "the streak feature keeps me going", source: "review_themes", sourceType: "app_store_rss" },
          { excerpt: "habit tracker app", source: "keyword_data", sourceType: "dataforseo_keywords" },
        ],
        effortMin: 45,
        suggestedDeadline: "2026-07-15",
        expectedOutcome: { scoreComponent: "content", delta: 8 },
        draft:
          "I built HabitKit because the streak was the only thing that kept me consistent. Our users say the same — the streak feature keeps them going.",
        draftRequiresEdit: true as const,
        verification: { method: "url" as const, state: "pending" as const },
        basis: "evidence_based" as const,
        confidence: 0.87,
      },
    ];

    // Clean slate for this app's draft embeddings.
    await db.from("embeddings").delete().eq("app_id", ctx.appId).eq("subject_type", "draft");

    // First run: inserts this app's draft embeddings; no prior set → no divergence.
    await algorithmSafety(ctx, cards);
    const firstRunModelCalls = callModelMock.mock.calls.length;

    // Second run with the SAME drafts. With the self-match fix the app's own prior
    // draft embeddings are deleted before the search, so the deterministic ~1.0
    // self-match is gone and NO divergence rewrite fires.
    callModelMock.mockClear();
    await algorithmSafety(ctx, cards);

    // The regression: no divergence rewrite was triggered on the 2nd run.
    expect(callModelMock).not.toHaveBeenCalled();
    // (And the first run also didn't self-flag — there was nothing to match.)
    expect(firstRunModelCalls).toBe(0);

    // Cleanup.
    await db.from("embeddings").delete().eq("app_id", ctx.appId).eq("subject_type", "draft");
  },
  60_000,
);
