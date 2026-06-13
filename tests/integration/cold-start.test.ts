/**
 * Integration test for the Cold Start sub-mode (§4.3) — Cycle 5 Task 5.
 *
 * Runs in FIXTURES mode — no API keys. Seeds an app + a low-review scan whose
 * preliminary facts carry coldStart=true, plus a findings_payload, then runs the
 * full scan and asserts the persisted actions are the validation-through-
 * distribution queue (all probability_based, all confidence ≤ 0.6, a pivot card
 * present, ≥1 survives the Critic → §11 gate, draft_requires_edit=true).
 *
 * A non-coldStart control still produces the standard action set.
 *
 * Run with: pnpm test:int tests/integration/cold-start.test.ts
 */

import { expect, test, vi } from "vitest";
import { serverDb } from "@/lib/db/client";
import { ScanBudget } from "@/lib/tools/registry";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { Json } from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Seed helper — app + scan with a findings_payload the full scan reads.
// ---------------------------------------------------------------------------
async function seedAppAndScan(storeUrl: string, platform: "ios" | "web"): Promise<ScanContext> {
  const db = serverDb();

  const { data: appRow, error: appErr } = await db
    .from("apps")
    .insert({ store_url: storeUrl, platform })
    .select("id")
    .single();
  if (appErr) throw appErr;
  if (!appRow) throw new Error("no app row");

  const findingsPayload = {
    positioningMirror: {
      listingSays: "A brand-new habit app",
      reviewsValue: "Too early to tell",
      gap: "No footprint yet — validate through distribution",
    },
    findings: [
      {
        category: "content",
        claim: "Pre-launch: demand is unproven",
        basis: "probability_based",
        confidence: 0.4,
        evidence: [{ excerpt: "habit tracking", source: "positioning" }],
      },
    ],
    score: { total: 2, breakdown: { content: 2, outreach: 1, seo: 1 } },
  };

  const { data: scanRow, error: scanErr } = await db
    .from("scans")
    .insert({
      app_id: appRow.id,
      status: "synthesizing",
      findings_payload: findingsPayload as unknown as Json,
    })
    .select("id")
    .single();
  if (scanErr) throw scanErr;
  if (!scanRow) throw new Error("no scan row");

  return {
    scanId: scanRow.id as string,
    appId: appRow.id as string,
    storeUrl,
    mode: platform,
    budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 150 }),
  };
}

// Cold Start facts: a brand-new app with almost no reviews.
function coldStartFacts(): PreliminaryFacts {
  return {
    mode: "ios",
    listing: { name: "Newhabit", category: "Health & Fitness", description: "A brand-new habit app" },
    competitors: [
      { name: "Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
      { name: "Streaks", url: "https://streaksapp.com", source: "dataforseo_serp", rank: 2 },
    ],
    reviewVolume: 4, // < 25 → Cold Start
    ratingTrend: 5,
    webProxy: null,
    themes: [{ term: "habit tracking", count: 3 }],
    sourcesUsed: ["itunes", "app_store_rss"],
    coldStart: true,
  };
}

// Established facts: a healthy app that must get the standard queue.
function establishedFacts(): PreliminaryFacts {
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
    ],
    sourcesUsed: ["app_store_rss", "itunes", "dataforseo_serp"],
    coldStart: false,
  };
}

// ---------------------------------------------------------------------------
// Cold Start scan → the §4.3 validation-through-distribution queue persists.
// ---------------------------------------------------------------------------
test(
  "Cold Start full scan persists the validation-through-distribution queue (prob_based, ≤0.6, pivot card, survives the gate)",
  async () => {
    vi.resetModules();
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");
    const { runFullScan } = await import("@/lib/scan/full-scan");

    const storeUrl = `https://apps.apple.com/us/app/newhabit/id${Date.now()}`;
    const ctx = await seedAppAndScan(storeUrl, "ios");

    await expect(runFullScan(ctx, coldStartFacts())).resolves.toBeUndefined();

    const db = serverDb();
    const { data: actions, error } = await db
      .from("actions")
      .select("category, basis, confidence, draft, draft_requires_edit, title, why")
      .eq("scan_id", ctx.scanId);
    expect(error).toBeNull();
    expect(actions).not.toBeNull();

    // ≥1 action survives the Critic → §11 gate.
    expect(actions!.length).toBeGreaterThanOrEqual(1);

    // Every persisted action is a Cold Start card: probability_based, ≤0.6, no-auto.
    for (const a of actions ?? []) {
      expect(a.basis).toBe("probability_based");
      expect(a.confidence).not.toBeNull();
      expect(a.confidence ?? 1).toBeLessThanOrEqual(0.6);
      expect(a.draft_requires_edit).toBe(true);
    }

    // A pivot-suggestion card survived and is in the same queue.
    const hasPivot = (actions ?? []).some(
      (a) => /pivot/i.test(a.title ?? "") || /pivot/i.test(a.why ?? ""),
    );
    expect(hasPivot).toBe(true);

    // The report payload's weekly plan also reflects Cold Start actions.
    const { data: scanRow } = await db
      .from("scans")
      .select("report_payload")
      .eq("id", ctx.scanId)
      .single();
    const report = (scanRow?.report_payload ?? {}) as Record<string, unknown>;
    const week = (report["whatToDoThisWeek"] ?? { quickWins: [], medium: [], longPlay: [] }) as {
      quickWins: unknown[];
      medium: unknown[];
      longPlay: unknown[];
    };
    const bucketed = week.quickWins.length + week.medium.length + week.longPlay.length;
    expect(bucketed).toBeGreaterThanOrEqual(1);
  },
  90_000,
);

// ---------------------------------------------------------------------------
// Control: a non-coldStart scan still gets the STANDARD action set.
// ---------------------------------------------------------------------------
test(
  "non-Cold-Start full scan still produces the standard action set (no pivot card)",
  async () => {
    vi.resetModules();
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");
    const { runFullScan } = await import("@/lib/scan/full-scan");

    const storeUrl = `https://apps.apple.com/us/app/habits/id${Date.now()}`;
    const ctx = await seedAppAndScan(storeUrl, "ios");

    await expect(runFullScan(ctx, establishedFacts())).resolves.toBeUndefined();

    const db = serverDb();
    const { data: actions, error } = await db
      .from("actions")
      .select("basis, confidence, draft_requires_edit, title, why")
      .eq("scan_id", ctx.scanId);
    expect(error).toBeNull();
    expect(actions).not.toBeNull();
    expect(actions!.length).toBeGreaterThanOrEqual(1);

    // The standard fixture set includes evidence_based cards above the 0.6 cap —
    // a clear tell it is NOT the Cold Start queue (which is all prob_based ≤0.6).
    const hasEvidenceBasedHighConfidence = (actions ?? []).some(
      (a) => a.basis === "evidence_based" && a.confidence !== null && a.confidence > 0.6,
    );
    expect(hasEvidenceBasedHighConfidence).toBe(true);

    // And no pivot-suggestion card in the standard set.
    const hasPivot = (actions ?? []).some(
      (a) => /pivot/i.test(a.title ?? "") || /pivot/i.test(a.why ?? ""),
    );
    expect(hasPivot).toBe(false);

    // §11 no-auto still holds for every persisted card.
    for (const a of actions ?? []) {
      expect(a.draft_requires_edit).toBe(true);
    }
  },
  90_000,
);
