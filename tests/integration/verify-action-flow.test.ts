/**
 * Integration test for runActionVerification (Cycle 4 Task 14) — the paid loop's
 * close: action completion → verification → outcomes moat + score movement.
 *
 * Runs in FIXTURES mode — no API keys. In fixtures, verify_action returns
 * { verified: true }, so a url-method action verifies deterministically.
 *
 * Verifies (against real Supabase):
 *   1. A url-method action verifies → verify_state="verified", status="done";
 *      an outcomes row exists for the action; a NEW score_snapshots row is
 *      written with total >= baseline (the score moved up or held).
 *   2. The outcomes-aware bump is real: seeding a verified CONTENT outcome makes
 *      gatherScoreComponents report contentSurfaces > the zero-outcome baseline.
 *   3. Idempotency — calling runActionVerification twice leaves exactly ONE
 *      outcomes row for the action (unique index on outcomes(action_id)).
 *   4. Baseline guard — an app with ZERO verified outcomes yields the SAME
 *      ScoreComponents as the documented first-scan baseline (no regression).
 *
 * Run with: pnpm test:int tests/integration/verify-action-flow.test.ts
 */

import { expect, test, vi, afterEach } from "vitest";
import { serverDb } from "@/lib/db/client";
import { ScanBudget } from "@/lib/tools/registry";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { Json } from "@/lib/db/types";

// Each test stubs fixtures ON + resetModules so the freshly-imported env proxy
// (which memoizes parseEnv on first access) re-reads REACHKIT_USE_FIXTURES=true,
// making verify_action / track_rank short-circuit keyless. (.env.local pins it
// to false otherwise.)
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SeedResult {
  appId: string;
  scanId: string;
  actionId: string;
  storeUrl: string;
}

const EXPECTED_OUTCOME = { scoreComponent: "content", delta: 8 } as const;

function makeFacts(): PreliminaryFacts {
  return {
    mode: "ios",
    listing: { name: "Habits", category: "Health & Fitness", description: "Build habits" },
    competitors: [{ name: "Habitify", url: "https://habitify.me", source: "test", rank: 1 }],
    reviewVolume: 1200,
    ratingTrend: 4.5,
    webProxy: null,
    themes: [
      { term: "ease of use", count: 40 },
      { term: "streaks", count: 30 },
    ],
    sourcesUsed: ["itunes"],
    coldStart: false,
  };
}

/** Seed app + scan (with preliminary_facts) + a url-method action + baseline snapshot. */
async function seed(suffix: string): Promise<SeedResult> {
  const db = serverDb();
  const storeUrl = `https://apps.apple.com/us/app/habits/id${suffix}`;

  const { data: appRow, error: appErr } = await db
    .from("apps")
    .insert({ store_url: storeUrl, platform: "ios" })
    .select("id")
    .single();
  if (appErr) throw appErr;
  const appId = appRow.id;

  const { data: scanRow, error: scanErr } = await db
    .from("scans")
    .insert({
      app_id: appId,
      status: "done",
      started_at: new Date().toISOString(),
      preliminary_facts: makeFacts() as unknown as Json,
    })
    .select("id")
    .single();
  if (scanErr) throw scanErr;
  const scanId = scanRow.id;

  const { data: actionRow, error: actErr } = await db
    .from("actions")
    .insert({
      app_id: appId,
      scan_id: scanId,
      category: "content",
      title: "Rewrite App Store description first paragraph",
      why: "Reviews cite streaks; lead with that.",
      verify_url: "https://example.com/shipped-page",
      verify_state: "pending",
      status: "pending",
      verification: { method: "url", state: "pending" } as unknown as Json,
      expected_outcome: EXPECTED_OUTCOME as unknown as Json,
      score_component: "content",
    })
    .select("id")
    .single();
  if (actErr) throw actErr;
  const actionId = actionRow.id;

  // Baseline score snapshot (the "before" the verified bump moves past).
  const { error: snapErr } = await db
    .from("score_snapshots")
    .insert({ app_id: appId, total: 5, breakdown: { content: 0, outreach: 0, seo: 11 } as unknown as Json });
  if (snapErr) throw snapErr;

  return { appId, scanId, actionId, storeUrl };
}

async function cleanup(appId: string): Promise<void> {
  const db = serverDb();
  // outcomes/actions/scans/snapshots all cascade on app delete, but delete
  // children explicitly first to be safe across FK on-delete differences.
  await db.from("outcomes").delete().eq("app_id", appId);
  await db.from("actions").delete().eq("app_id", appId);
  await db.from("score_snapshots").delete().eq("app_id", appId);
  await db.from("scans").delete().eq("app_id", appId);
  await db.from("apps").delete().eq("id", appId);
}

function makeCtx(appId: string, scanId: string, storeUrl: string): ScanContext {
  return {
    scanId,
    appId,
    storeUrl,
    mode: "ios",
    budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 150 }),
  };
}

// ---------------------------------------------------------------------------
// 1 + 2. Verify a url action → done + outcome + snapshot, and the bump is real
// ---------------------------------------------------------------------------
test(
  "runActionVerification (fixtures) verifies a url action, writes an outcome, and moves the score",
  async () => {
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");
    vi.resetModules();
    const { runActionVerification } = await import("@/lib/scan/verify");
    const { gatherScoreComponents } = await import("@/lib/scan/score-full");

    const suffix = `verify-${Date.now()}`;
    const { appId, scanId, actionId, storeUrl } = await seed(suffix);
    const db = serverDb();

    try {
      // Baseline components BEFORE verification (zero verified outcomes).
      const before = await gatherScoreComponents(makeCtx(appId, scanId, storeUrl), makeFacts());
      expect(before.contentSurfaces).toBe(0);

      // Verify.
      const result = await runActionVerification(actionId);
      expect(result.verified).toBe(true);

      // Action flipped to verified + done.
      const { data: action } = await db
        .from("actions")
        .select("verify_state, status")
        .eq("id", actionId)
        .single();
      expect(action?.verify_state).toBe("verified");
      expect(action?.status).toBe("done");

      // An outcomes row exists for the action with the expected signal + delta.
      const { data: outcomes } = await db
        .from("outcomes")
        .select("action_id, verified_signal, observed_delta")
        .eq("action_id", actionId);
      expect(outcomes).not.toBeNull();
      expect(outcomes!.length).toBe(1);
      expect(outcomes![0]!.verified_signal).toBe("url_live");
      expect(outcomes![0]!.observed_delta).toMatchObject({ scoreComponent: "content" });

      // A NEW score_snapshots row was written; total held or moved up vs baseline (5).
      const { data: snaps } = await db
        .from("score_snapshots")
        .select("total, taken_at")
        .eq("app_id", appId)
        .order("taken_at", { ascending: true });
      expect(snaps).not.toBeNull();
      expect(snaps!.length).toBe(2); // baseline + the one written by verification
      const latest = snaps![snaps!.length - 1]!;
      expect(latest.total).toBeGreaterThanOrEqual(5);

      // The bump is real: AFTER a verified content outcome, contentSurfaces grew.
      const after = await gatherScoreComponents(makeCtx(appId, scanId, storeUrl), makeFacts());
      expect(after.contentSurfaces).toBeGreaterThan(before.contentSurfaces);
      expect(after.contentSurfaces).toBe(1);
    } finally {
      await cleanup(appId);
    }
  },
  60_000,
);

// ---------------------------------------------------------------------------
// 3. Idempotency — two runs leave exactly ONE outcomes row
// ---------------------------------------------------------------------------
test(
  "runActionVerification is idempotent — re-running writes no duplicate outcome",
  async () => {
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");
    vi.resetModules();
    const { runActionVerification } = await import("@/lib/scan/verify");

    const suffix = `idem-${Date.now()}`;
    const { appId, actionId } = await seed(suffix);
    const db = serverDb();

    try {
      const r1 = await runActionVerification(actionId);
      const r2 = await runActionVerification(actionId);
      expect(r1.verified).toBe(true);
      expect(r2.verified).toBe(true);

      const { data: outcomes } = await db
        .from("outcomes")
        .select("id")
        .eq("action_id", actionId);
      expect(outcomes).not.toBeNull();
      expect(outcomes!.length).toBe(1);
    } finally {
      await cleanup(appId);
    }
  },
  60_000,
);

// ---------------------------------------------------------------------------
// 4. Baseline guard — ZERO verified outcomes ⇒ documented first-scan components
// ---------------------------------------------------------------------------
test(
  "gatherScoreComponents preserves the zero-outcome baseline exactly",
  async () => {
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");
    vi.resetModules();
    const { gatherScoreComponents } = await import("@/lib/scan/score-full");

    const suffix = `baseline-${Date.now()}`;
    const { appId, scanId, storeUrl } = await seed(suffix);

    try {
      // The seeded action is NOT yet verified → zero verified outcomes for the app.
      const components = await gatherScoreComponents(makeCtx(appId, scanId, storeUrl), makeFacts());

      // First-scan baseline invariants (identical to the documented Cycle 3 behavior).
      expect(components.directoriesLive).toBe(0);
      expect(components.comparisonPagesLive).toBe(0);
      expect(components.contentSurfaces).toBe(0);
      expect(components.outreachSurfaces).toBe(0);
      // keywordsRanking / asoCoverage are proxy estimates in [0,100], untouched by outcomes.
      expect(components.keywordsRanking).toBeGreaterThanOrEqual(0);
      expect(components.keywordsRanking).toBeLessThanOrEqual(100);
      expect(components.asoCoverage).toBeGreaterThanOrEqual(0);
      expect(components.asoCoverage).toBeLessThanOrEqual(100);
    } finally {
      await cleanup(appId);
    }
  },
  60_000,
);
