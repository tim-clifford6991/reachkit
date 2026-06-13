/**
 * Integration test for runFullScan (Cycle 3 Task 13).
 *
 * Runs in FIXTURES mode — no API keys required. Exercises the full second pass:
 *   runFullCollect → runExtract → read findings → generateActions →
 *   Critic Gate → algorithmSafety → verifiedScore → assembleReport →
 *   persistReport → persist actions → emit "report".
 *
 * Verifies (against real Supabase):
 *   - a "report" scan_event is emitted
 *   - scans.report_payload holds the four questions (§5.6) + a verified score
 *   - scans.score_total / score_breakdown are set
 *   - the actions table has ≥1 row for the scan, bucketed into whatToDoThisWeek
 *   - running twice leaves the same action count (delete-before-insert idempotency)
 *
 * Run with: pnpm test:int tests/integration/full-scan.test.ts
 */

import { expect, test, vi } from "vitest";
import { serverDb } from "@/lib/db/client";
import { ScanBudget } from "@/lib/tools/registry";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { Json } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Seed helper — app + scan (with a findings_payload the full scan reads)
// ---------------------------------------------------------------------------
async function seedAppAndScan(storeUrl: string): Promise<ScanContext> {
  const db = serverDb();

  const { data: appRow, error: appErr } = await db
    .from("apps")
    .insert({ store_url: storeUrl, platform: "ios" })
    .select("id")
    .single();
  if (appErr) throw appErr;

  const findingsPayload = {
    positioningMirror: {
      listingSays: "Build habits in 21 days with science-backed streaks",
      reviewsValue: "Users prize the streak feature for consistency",
      gap: "Listing over-promises the 21-day timeline; users value persistence",
    },
    findings: [
      {
        category: "content",
        claim: "The 21-day headline is unsupported by review sentiment",
        basis: "evidence_based",
        confidence: 0.82,
        evidence: [{ excerpt: "the streak feature keeps me going", source: "review_themes" }],
      },
      {
        category: "seo_aso",
        claim: "High-volume keyword 'habit tracker app' absent from the listing",
        basis: "evidence_based",
        confidence: 0.91,
        evidence: [{ excerpt: "habit tracker app", source: "keyword_data" }],
      },
    ],
    score: { total: 12, breakdown: { content: 10, outreach: 5, seo: 20 } },
  };

  const { data: scanRow, error: scanErr } = await db
    .from("scans")
    .insert({
      app_id: appRow!.id,
      status: "synthesizing",
      findings_payload: findingsPayload as unknown as Json,
    })
    .select("id")
    .single();
  if (scanErr) throw scanErr;

  return {
    scanId: scanRow!.id as string,
    appId: appRow!.id as string,
    storeUrl,
    mode: "ios",
    budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 150 }),
  };
}

function makeFacts(): PreliminaryFacts {
  return {
    mode: "ios",
    listing: { name: "Habits", category: "Health & Fitness", description: "Build habits in 21 days" },
    competitors: [
      { name: "Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
      { name: "Streaks", url: "https://streaksapp.com", source: "dataforseo_serp", rank: 2 },
    ],
    reviewVolume: 1500,
    ratingTrend: 4.6,
    webProxy: null,
    themes: [
      { term: "ease of use", count: 45 },
      { term: "streaks", count: 38 },
      { term: "crashes", count: 12 },
    ],
    sourcesUsed: ["app_store_rss", "itunes", "dataforseo_serp"],
    coldStart: false,
  };
}

// ---------------------------------------------------------------------------
// Main test — fixtures mode, no keys
// ---------------------------------------------------------------------------
test(
  "runFullScan (fixtures mode) writes a four-question report + actions and is idempotent",
  async () => {
    vi.resetModules();
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");

    // Dynamic import so the env stub is picked up by fixturesEnabled()
    const { runFullScan } = await import("@/lib/scan/full-scan");

    const storeUrl = `https://apps.apple.com/us/app/habits/id${Date.now()}`;
    const ctx = await seedAppAndScan(storeUrl);
    const facts = makeFacts();

    // Full scan must complete without throwing
    await expect(runFullScan(ctx, facts)).resolves.toBeUndefined();

    const db = serverDb();

    // 1. A "report" scan_event was emitted
    const { data: events, error: evtErr } = await db
      .from("scan_events")
      .select("type, payload")
      .eq("scan_id", ctx.scanId)
      .eq("type", "report");
    expect(evtErr).toBeNull();
    expect(events).not.toBeNull();
    expect(events!.length).toBeGreaterThanOrEqual(1);
    const evtPayload = events![0]!.payload as Record<string, unknown>;
    expect(typeof evtPayload["actionCount"]).toBe("number");

    // 2. report_payload holds the four questions + a verified score
    const { data: scanRow, error: scanErr } = await db
      .from("scans")
      .select("report_payload, score_total, score_breakdown")
      .eq("id", ctx.scanId)
      .single();
    expect(scanErr).toBeNull();
    if (!scanRow) throw new Error("No scan row after full scan");

    const report = scanRow.report_payload as Record<string, unknown>;
    expect(report).not.toBeNull();
    expect(report["whatYouOffer"]).toBeDefined();
    expect(report["whoItsFor"]).toBeDefined();
    expect(report["whereTheyAre"]).toBeDefined();
    expect(report["whatToDoThisWeek"]).toBeDefined();

    // Verified score on the payload + on the scan row
    const score = report["score"] as Record<string, unknown>;
    expect(score["basis"]).toBe("verified");
    expect(typeof scanRow.score_total).toBe("number");
    expect(scanRow.score_breakdown).not.toBeNull();

    // Q1 mirror came from the seeded findings_payload
    const whatYouOffer = report["whatYouOffer"] as { positioningMirror: { listingSays: string } };
    expect(whatYouOffer.positioningMirror.listingSays).toContain("Build habits in 21 days");

    // Q3 surfaces (communities + creators written by runFullCollect) + competitor gap
    const where = report["whereTheyAre"] as { surfaces: unknown[]; competitorGap: unknown[] };
    expect(Array.isArray(where.surfaces)).toBe(true);
    expect(where.surfaces.length).toBeGreaterThan(0);
    expect(Array.isArray(where.competitorGap)).toBe(true);
    expect(where.competitorGap.length).toBeGreaterThan(0);

    // Q4 — at least one bucketed action
    const week = report["whatToDoThisWeek"] as {
      quickWins: unknown[];
      medium: unknown[];
      longPlay: unknown[];
    };
    const bucketed = week.quickWins.length + week.medium.length + week.longPlay.length;
    expect(bucketed).toBeGreaterThanOrEqual(1);

    // 3. The actions table has ≥1 row for the scan
    const { data: actions1, error: actErr } = await db
      .from("actions")
      .select("id, category, draft_requires_edit")
      .eq("scan_id", ctx.scanId);
    expect(actErr).toBeNull();
    expect(actions1).not.toBeNull();
    expect(actions1!.length).toBeGreaterThanOrEqual(1);
    // §11 no-auto invariant survives persistence
    for (const a of actions1 ?? []) {
      expect(a.draft_requires_edit).toBe(true);
    }
    const firstCount = actions1!.length;

    // 4. Idempotency — a second run leaves the same action count (no duplicates)
    await runFullScan(ctx, facts);
    const { data: actions2 } = await db
      .from("actions")
      .select("id")
      .eq("scan_id", ctx.scanId);
    expect(actions2).not.toBeNull();
    expect(actions2!.length).toBe(firstCount);
  },
  90_000,
);
