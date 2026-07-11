/**
 * Task 6 — free-report e2e.
 *
 * Proves `runFreeReport` (lib/scan/free-report.ts) persists a valid lightweight
 * `report_payload` for a FREE web scan: the fixed-basis 7-axis score (identical
 * signal set the paid pipeline uses for its headline), all deep (paid-only)
 * sections left empty, and score parity between `report_payload.score.total`
 * and the persisted `scans.score_total`.
 *
 * Does NOT drive the full Inngest pipeline (see scan-requested-e2e.test.ts for
 * that) — seeds exactly the two upstream artifacts `runFreeReport` reads
 * (a site_fetch raw_documents row + scans.findings_payload) and calls the
 * function directly against real local Supabase.
 *
 * LOCAL ONLY (needs local Supabase). Run with:
 *   pnpm test:int tests/integration/free-report-e2e.test.ts
 */
import { beforeEach, expect, test, vi } from "vitest";
import type { Finding, PositioningMirror, ScoreResult } from "@/lib/llm/types";
import type { Json } from "@/lib/db/types";

// Fixture mode ON, matching sibling integration tests — no code path here
// actually calls the LLM, but this keeps the file consistent with the rest
// of the suite in case a transitive import ever grows a fixtures check.
vi.stubEnv("REACHKIT_USE_FIXTURES", "true");

const STORE_URL = `https://freereport-e2e.example.com/${Date.now()}`;

const SAMPLE_HTML = `
<!doctype html>
<html lang="en">
<head>
  <title>FreeReport Fixture — Habit Tracking for Teams</title>
  <meta name="description" content="FreeReport Fixture helps teams build daily habits with shared streaks, reminders, and lightweight analytics for busy managers." />
  <meta property="og:title" content="FreeReport Fixture" />
  <meta property="og:image" content="https://freereport-e2e.example.com/og.png" />
  <meta name="twitter:card" content="summary_large_image" />
</head>
<body>
  <h1>Build better habits, together</h1>
  <h2>Why teams choose FreeReport Fixture</h2>
  <p>FreeReport Fixture is a habit-tracking product built for small teams who want to stay
     consistent without heavyweight project management. Managers get a weekly digest,
     teammates get daily nudges, and everyone can see the group's streak at a glance.
     Our customers tell us the shared accountability is what finally made habits stick,
     more than any solo app they tried before switching to FreeReport Fixture.</p>
  <img src="/hero.png" alt="Team habit dashboard screenshot" />
</body>
</html>
`;

beforeEach(() => {
  vi.resetModules();
});

test(
  "runFreeReport (web): persists a lightweight report_payload with fixed-basis score, empty deep sections, and score parity",
  async () => {
    const { serverDb } = await import("@/lib/db/client");
    const { upsertRawDocument } = await import("@/lib/db/raw-documents");
    const db = serverDb();

    // 1. Seed an app (web).
    const { data: appRow, error: appErr } = await db
      .from("apps")
      .insert({ store_url: STORE_URL, platform: "web", name: "FreeReport Fixture" })
      .select("id")
      .single();
    expect(appErr).toBeNull();
    if (!appRow) throw new Error("No app row returned");
    const appId = appRow.id as string;

    // 2. Seed a raw_documents "site_fetch" row via the real persistence path
    // (same function get_listing calls) so the exact body shape matches prod.
    await upsertRawDocument({
      subjectType: "web",
      subjectKey: STORE_URL,
      sourceType: "site_fetch",
      url: STORE_URL,
      body: SAMPLE_HTML,
      mode: "web",
    });

    // 3. Seed a scan (tier "free", status "synthesizing") with a findings_payload
    // (the upstream artifact runFindings would have written).
    const { data: scanRow, error: scanErr } = await db
      .from("scans")
      .insert({ app_id: appId, tier: "free", status: "synthesizing" })
      .select("id")
      .single();
    expect(scanErr).toBeNull();
    if (!scanRow) throw new Error("No scan row returned");
    const scanId = scanRow.id as string;

    const finding: Finding = {
      category: "seo_aso",
      claim: "Listing doesn't mention 'team habit tracker' despite team-focused copy",
      basis: "evidence_based",
      confidence: 0.8,
      evidence: [{ excerpt: "built for small teams", source: "site_fetch" }],
    };
    const positioningMirror: PositioningMirror = {
      listingSays: "Build better habits, together — for small teams",
      reviewsValue: "Users value the shared accountability",
      gap: "Listing undersells the manager digest feature",
    };
    const score: ScoreResult = { total: 0, breakdown: { content: 0, outreach: 0, seo: 0 } };

    const { error: fpErr } = await db
      .from("scans")
      .update({
        findings_payload: { findings: [finding], positioningMirror, score } as unknown as Json,
      })
      .eq("id", scanId);
    expect(fpErr).toBeNull();

    // 4. Build ScanContext + a minimal PreliminaryFacts, then run runFreeReport.
    const { ScanBudget } = await import("@/lib/tools/registry");
    const { runFreeReport } = await import("@/lib/scan/free-report");

    const ctx = {
      scanId,
      appId,
      storeUrl: STORE_URL,
      mode: "web" as const,
      budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 15 }),
    };

    const facts = {
      mode: "web" as const,
      listing: { name: "FreeReport Fixture", category: "Productivity", description: "Team habit tracking" },
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

    await runFreeReport(ctx, facts);

    // 5. Assert on the persisted scans row.
    const { data: finalScan, error: finalErr } = await db
      .from("scans")
      .select("report_payload, score_total, score_version")
      .eq("id", scanId)
      .single();
    expect(finalErr).toBeNull();
    if (!finalScan) throw new Error("No scan row after runFreeReport");

    expect(finalScan.report_payload).toBeTruthy();
    const report = finalScan.report_payload as Record<string, unknown>;

    const reportScore = report["score"] as Record<string, unknown>;
    expect(typeof reportScore["total"]).toBe("number");
    expect(reportScore["basis"]).toBe("verified");
    expect(Array.isArray(reportScore["radar"])).toBe(true);
    expect((reportScore["radar"] as unknown[]).length).toBe(7);

    // Deep (paid-only) sections must be empty on the free report.
    expect(report["competitiveLandscape"]).toEqual([]);
    expect(report["channelOpportunities"]).toEqual({ keywordClusters: [], communitiesByEngagement: [] });
    expect(report["creatorsToReach"]).toEqual([]);

    // The persisted headline is the v5 unified Discoverability Score
    // (geomean of on-page readiness × search presence — CLAUDE.md invariant #1).
    expect(finalScan.score_version).toBe(5);

    // Score parity: the report's score total equals the persisted headline score_total.
    expect(reportScore["total"]).toBe(finalScan.score_total);
  },
  60_000,
);
