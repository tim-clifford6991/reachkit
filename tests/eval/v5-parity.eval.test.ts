/**
 * Invariant #1 END-TO-END: the persisted headline never moves on upgrade.
 *
 * `registry-score.test.ts` proves free↔paid parity at the function level; this
 * eval proves it on the REAL persisted path — the level PR #36's regression
 * actually shipped at (free 74 → paid 66 while every unit test stayed green).
 * One app, one site_fetch document, identical facts → `runFreeReport` and
 * `runFullScan` must persist the SAME `scans.score_total`, both `score_version 5`
 * (the unified Discoverability Score = geomean of on-page readiness × search
 * presence, both computed identically on both tiers).
 *
 * Fixture mode (deterministic search-visibility, no keys) + local Supabase.
 */
import { afterEach, expect, test, vi } from "vitest";
import { installFixtures, resetFixtures } from "@/lib/scan/fixture-seam";
import { makeFixtureProvider } from "@/lib/dev/fixtures";
import type { Json } from "@/lib/db/types";

installFixtures(makeFixtureProvider());

afterEach(() => resetFixtures());

const STORE_URL = `https://v5-parity.example.com/${Date.now()}`;

const SAMPLE_HTML = `
<!doctype html>
<html lang="en">
<head>
  <title>Parity Fixture — Habit Tracking for Teams</title>
  <meta name="description" content="Parity Fixture helps teams build daily habits with shared streaks, reminders, and lightweight analytics for busy managers." />
  <meta property="og:title" content="Parity Fixture" />
  <meta property="og:image" content="https://v5-parity.example.com/og.png" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
<body>
  <h1>Build better habits, together</h1>
  <h2>Why teams choose Parity Fixture</h2>
  <p>Parity Fixture is a habit-tracking product built for small teams who want to stay
     consistent without heavyweight project management. Managers get a weekly digest,
     teammates get daily nudges, and everyone can see the group's streak at a glance.</p>
  <img src="/hero.png" alt="Team habit dashboard screenshot" />
</body>
</html>
`;

const FINDINGS_PAYLOAD = {
  positioningMirror: {
    listingSays: "Build better habits, together — for small teams",
    reviewsValue: "Users value the shared accountability",
    gap: "Listing undersells the manager digest feature",
  },
  findings: [
    {
      category: "seo_aso",
      claim: "Listing doesn't mention 'team habit tracker' despite team-focused copy",
      basis: "evidence_based",
      confidence: 0.8,
      evidence: [{ excerpt: "built for small teams", source: "site_fetch" }],
    },
  ],
  score: { total: 0, breakdown: { content: 0, outreach: 0, seo: 0 } },
};

function makeFacts() {
  return {
    mode: "web" as const,
    listing: { name: "Parity Fixture", category: "Productivity", description: "Team habit tracking" },
    competitors: [{ name: "Habitica", url: "https://habitica.com", source: "dataforseo_serp", rank: 1 }],
    reviewVolume: 0,
    ratingTrend: null,
    webProxy: { score: 40, serpResultCount: 3, phUpvotes: 0, domainAgeYears: 2 },
    themes: [
      { term: "accountability", count: 5 },
      { term: "streaks", count: 3 },
    ],
    sourcesUsed: ["site_fetch"],
    coldStart: false,
  };
}

test(
  "v5 parity: runFreeReport and runFullScan persist the SAME unified score (version 5) for identical inputs",
  async () => {
    const { serverDb } = await import("@/lib/db/client");
    const { upsertRawDocument } = await import("@/lib/db/raw-documents");
    const { ScanBudget } = await import("@/lib/tools/registry");
    const db = serverDb();

    // One app → both scans share the same site_fetch doc + search caches, so
    // the two drivers (on-page readiness, search presence) are byte-identical.
    const { data: appRow, error: appErr } = await db
      .from("apps")
      .insert({ store_url: STORE_URL, platform: "web", name: "Parity Fixture" })
      .select("id")
      .single();
    expect(appErr).toBeNull();
    const appId = appRow!.id as string;

    await upsertRawDocument({
      subjectType: "web",
      subjectKey: STORE_URL,
      sourceType: "site_fetch",
      url: STORE_URL,
      body: SAMPLE_HTML,
      mode: "web",
    });

    const seedScan = async (tier: "free" | "full") => {
      const { data, error } = await db
        .from("scans")
        .insert({
          app_id: appId,
          tier,
          status: "synthesizing",
          findings_payload: FINDINGS_PAYLOAD as unknown as Json,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      return data!.id as string;
    };

    // FREE path.
    const freeScanId = await seedScan("free");
    const { runFreeReport } = await import("@/lib/scan/free-report");
    await runFreeReport(
      { scanId: freeScanId, appId, storeUrl: STORE_URL, mode: "web", budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 20 }) },
      makeFacts(),
    );

    // PAID path — same app, same facts.
    const fullScanId = await seedScan("full");
    const { runFullScan } = await import("@/lib/scan/full-scan");
    await runFullScan(
      { scanId: fullScanId, appId, storeUrl: STORE_URL, mode: "web", budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 250 }) },
      makeFacts(),
    );

    const { data: rows, error } = await db
      .from("scans")
      .select("id, tier, score_total, score_version")
      .in("id", [freeScanId, fullScanId]);
    expect(error).toBeNull();
    const free = rows!.find((r) => r.id === freeScanId)!;
    const full = rows!.find((r) => r.id === fullScanId)!;

    // Both tiers persist the v5 unified Discoverability Score…
    expect(free.score_version).toBe(5);
    expect(full.score_version).toBe(5);
    expect(typeof free.score_total).toBe("number");

    // …and the number is IDENTICAL free↔paid — it never moves on upgrade.
    expect(full.score_total, `free ${free.score_total} vs paid ${full.score_total} — invariant #1 broken`).toBe(
      free.score_total,
    );
  },
  120_000,
);
