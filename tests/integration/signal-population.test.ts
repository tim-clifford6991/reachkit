/**
 * Populates scan_signals via the REAL fixtures pipeline (keyless) AND runs the
 * v1-vs-v2 score calibration dry-run.
 *
 * For three web-mode scans with varied on-page HTML (rich / medium / poor), this
 * seeds the site_fetch raw_documents HTML, runs runFullScan, then reads back the
 * persisted scan_signals + headline score and compares the current v1 score to
 * the candidate v2 registry score. The scans persist to local Supabase so the
 * explainability panel can be viewed at /scan/<id>/results.
 *
 * Run: pnpm test:int tests/integration/signal-population.test.ts
 */

import { writeFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import { serverDb } from "@/lib/db/client";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { ScanBudget } from "@/lib/tools/registry";
import { registryScore, type RegistryScoreRow } from "@/lib/scan/registry-score";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { Json } from "@/lib/db/types";

const RICH_HTML = `<!doctype html><html lang="en"><head>
<title>Acme — the simplest habit tracker for iOS and web</title>
<meta name="description" content="Build lasting habits with streak-based tracking trusted by 500,000 people. Simple, fast, and delightful to use every day." />
<link rel="canonical" href="https://acme.com/" />
<meta property="og:title" content="Acme"><meta property="og:image" content="https://acme.com/og.png"><meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{"@type":"SoftwareApplication","name":"Acme"}</script>
</head><body><h1>Build habits that stick</h1><h2>Streaks</h2><h2>Reminders</h2>
<p>${"Acme helps you build durable daily habits with gentle reminders and a satisfying streak system. ".repeat(8)}</p>
<img src=a alt="screenshot"><img src=b alt="chart"><img src=c alt="widget"></body></html>`;

const MEDIUM_HTML = `<html><head>
<title>Acme habits</title>
<meta name="description" content="A habit app.">
<meta property="og:title" content="Acme">
</head><body><h1>Acme</h1><h1>Habits</h1>
<p>${"Track your habits. ".repeat(12)}</p>
<img src=a alt="x"><img src=b></body></html>`;

const POOR_HTML = `<html><head><title>app</title></head><body><div>welcome</div></body></html>`;

const VARIANTS: Array<{ tag: string; html: string }> = [
  { tag: "rich", html: RICH_HTML },
  { tag: "medium", html: MEDIUM_HTML },
  { tag: "poor", html: POOR_HTML },
];

function makeWebFacts(): PreliminaryFacts {
  return {
    mode: "web",
    listing: { name: "Acme", category: null, description: "Build habits with streaks" },
    competitors: [
      { name: "Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
      { name: "Streaks", url: "https://streaksapp.com", source: "dataforseo_serp", rank: 2 },
    ],
    reviewVolume: 800,
    ratingTrend: null,
    webProxy: { score: 45, serpResultCount: 1200, phUpvotes: 60, domainAgeYears: 3 },
    themes: [
      { term: "ease of use", count: 30 },
      { term: "streaks", count: 22 },
    ],
    sourcesUsed: ["site_fetch", "dataforseo_serp", "domain_age"],
    coldStart: false,
  };
}

async function seedWebScan(storeUrl: string, html: string): Promise<ScanContext> {
  const db = serverDb();
  const { data: appRow, error: appErr } = await db
    .from("apps")
    .insert({ store_url: storeUrl, platform: "web" })
    .select("id")
    .single();
  if (appErr) throw appErr;

  const findingsPayload = {
    positioningMirror: { listingSays: "Build habits", reviewsValue: "Users love streaks", gap: "Listing thin on SEO" },
    findings: [
      { category: "seo_aso", claim: "Missing keyword cluster", basis: "evidence_based", confidence: 0.9, evidence: [{ excerpt: "habit tracker", source: "keyword_data" }] },
    ],
    score: { total: 10, breakdown: { content: 8, outreach: 4, seo: 18 } },
  };

  const { data: scanRow, error: scanErr } = await db
    .from("scans")
    .insert({ app_id: appRow!.id, status: "synthesizing", findings_payload: findingsPayload as unknown as Json })
    .select("id")
    .single();
  if (scanErr) throw scanErr;

  // Seed the site_fetch HTML the Wave A parser reads.
  await upsertRawDocument({ subjectType: "web", subjectKey: storeUrl, sourceType: "site_fetch", body: html, mode: "web" });

  return {
    scanId: scanRow!.id as string,
    appId: appRow!.id as string,
    storeUrl,
    mode: "web",
    budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 150 }),
  };
}

test(
  "populates scan_signals + reports the v1-vs-v2 score calibration",
  async () => {
    vi.resetModules();
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");
    vi.stubEnv("REACHKIT_MARKET_ANALYSIS", "false"); // skip the keyed market pipeline
    const { runFullScan } = await import("@/lib/scan/full-scan");

    const db = serverDb();
    const calibration: Array<{ tag: string; scanId: string; v1: number; v2: number; delta: number; measured: number }> = [];

    for (const v of VARIANTS) {
      const storeUrl = `https://acme-${v.tag}-${Date.now()}.example.com`;
      const ctx = await seedWebScan(storeUrl, v.html);
      await expect(runFullScan(ctx, makeWebFacts())).resolves.toBeUndefined();

      const { data: rows } = await db
        .from("scan_signals")
        .select("pillar, weight, normalised, state, signal_key")
        .eq("scan_id", ctx.scanId);
      expect(rows && rows.length).toBeGreaterThan(0);

      const { data: scan } = await db.from("scans").select("score_total").eq("id", ctx.scanId).single();
      const v1 = scan!.score_total as number;
      const v2model = registryScore((rows ?? []) as RegistryScoreRow[]);
      const measured = (rows ?? []).filter((r) => r.state !== "unmeasured").length;
      calibration.push({ tag: v.tag, scanId: ctx.scanId, v1, v2: v2model.total, delta: v2model.total - v1, measured });
    }

    // ── Calibration report ───────────────────────────────────────────────────
    console.log("\n=== v1-vs-v2 score calibration (web, fixtures) ===");
    console.log("page     scan_id                               v1   v2   Δ     measured/18");
    for (const c of calibration) {
      console.log(
        `${c.tag.padEnd(8)} ${c.scanId}  ${String(c.v1).padStart(3)}  ${String(c.v2).padStart(3)}  ${(c.delta >= 0 ? "+" : "") + c.delta}`.padEnd(70) +
          `${c.measured}/18`,
      );
    }
    console.log("View the populated breakdown panel at /scan/<scan_id>/results\n");
    writeFileSync("/tmp/calibration.json", JSON.stringify(calibration, null, 2));

    // Sanity: web scans persist the full 18-signal set.
    expect(calibration.every((c) => c.measured >= 8)).toBe(true);
  },
  120_000,
);
