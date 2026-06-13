/**
 * Integration test for seedMonitors (Cycle 4 Task 7) — the watermark-baseline
 * step that the weekly delta refresh builds on.
 *
 * Verifies (against real Supabase):
 *   - exactly 4 monitor rows are seeded for the app, kinds
 *     {reviews, rank, threads, competitors}, all cadence="weekly"
 *   - the competitors watermark carries the seeded competitor names
 *   - calling seedMonitors twice stays at exactly 4 rows (upsert idempotency)
 *
 * Run with: pnpm test:int tests/integration/monitors.test.ts
 */

import { expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import { seedMonitors } from "@/lib/scan/monitors";
import { ScanBudget } from "@/lib/tools/registry";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";

const COMPETITOR_NAMES = ["Habitify", "Streaks"];

async function seedAppAndScan(storeUrl: string): Promise<ScanContext> {
  const db = serverDb();

  const { data: appRow, error: appErr } = await db
    .from("apps")
    .insert({ store_url: storeUrl, platform: "ios" })
    .select("id")
    .single();
  if (appErr) throw appErr;
  if (!appRow) throw new Error("No app row");

  const { data: scanRow, error: scanErr } = await db
    .from("scans")
    .insert({ app_id: appRow.id, status: "synthesizing" })
    .select("id")
    .single();
  if (scanErr) throw scanErr;
  if (!scanRow) throw new Error("No scan row");

  return {
    scanId: scanRow.id,
    appId: appRow.id,
    storeUrl,
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
      { name: "Streaks", url: "https://streaksapp.com", source: "dataforseo_serp", rank: 2 },
      // empty-name competitor must be filtered out of the watermark
      { name: "", url: "https://example.com", source: "dataforseo_serp", rank: 3 },
    ],
    reviewVolume: 1500,
    ratingTrend: 4.6,
    webProxy: null,
    themes: [{ term: "streaks", count: 38 }],
    sourcesUsed: ["app_store_rss", "itunes", "dataforseo_serp"],
    coldStart: false,
  };
}

test(
  "seedMonitors seeds 4 weekly monitors with watermarks and is idempotent",
  async () => {
    const db = serverDb();
    const storeUrl = `https://apps.apple.com/us/app/habits/id${Date.now()}`;
    const ctx = await seedAppAndScan(storeUrl);
    const facts = makeFacts();

    // First seed — best-effort, returns void
    await expect(seedMonitors(ctx, facts)).resolves.toBeUndefined();

    const { data: rows1, error: err1 } = await db
      .from("monitors")
      .select("kind, cadence, last_run_at, query, watermark")
      .eq("app_id", ctx.appId);
    expect(err1).toBeNull();
    expect(rows1).not.toBeNull();
    if (!rows1) throw new Error("No monitor rows after seeding");

    // Exactly 4 rows, the expected kinds
    expect(rows1.length).toBe(4);
    const kinds = rows1.map((r) => r.kind).sort();
    expect(kinds).toEqual(["competitors", "rank", "reviews", "threads"]);

    // All weekly, never run, no query
    for (const r of rows1) {
      expect(r.cadence).toBe("weekly");
      expect(r.last_run_at).toBeNull();
      expect(r.query).toBeNull();
    }

    // competitors watermark carries the (non-empty) seeded names
    const competitorsRow = rows1.find((r) => r.kind === "competitors");
    expect(competitorsRow).toBeDefined();
    const watermark = competitorsRow!.watermark as { knownCompetitors?: unknown };
    expect(Array.isArray(watermark.knownCompetitors)).toBe(true);
    const known = watermark.knownCompetitors as string[];
    expect(known.sort()).toEqual([...COMPETITOR_NAMES].sort());
    expect(known).not.toContain("");

    // reviews baseline watermark
    const reviewsRow = rows1.find((r) => r.kind === "reviews");
    expect(reviewsRow).toBeDefined();
    const reviewWatermark = reviewsRow!.watermark as { lastReviewId?: unknown };
    expect(reviewWatermark.lastReviewId).toBeNull();

    // Idempotency — a second seed must not duplicate (still exactly 4 rows)
    await seedMonitors(ctx, facts);
    const { data: rows2, error: err2 } = await db
      .from("monitors")
      .select("kind")
      .eq("app_id", ctx.appId);
    expect(err2).toBeNull();
    expect(rows2).not.toBeNull();
    expect(rows2!.length).toBe(4);
  },
  60_000,
);
