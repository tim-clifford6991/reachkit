/**
 * Integration test for the findings pipeline (Cycle 2 Task 6).
 *
 * Exercises the FULL pipeline: extract → synth → score → persist → emit
 * with a mocked callModel (no Anthropic key required) against real Supabase.
 *
 * Verifies:
 *  - 3 findings rows written for the scan
 *  - scans.score_total is a number, score_breakdown is set, findings_payload is set
 *  - a "findings" scan_event was emitted with findings.length === 3 and numeric score.total
 */

import { beforeEach, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { SynthResult, ReviewThemesSheet, PositioningSheet, CompetitorGapSheet, KeywordSheet } from "@/lib/llm/types";

// ---------------------------------------------------------------------------
// Canned model responses — returned by the mocked callModel
// ---------------------------------------------------------------------------

const CANNED_REVIEW_THEMES: ReviewThemesSheet = {
  themes: [
    { theme: "Ease of use", sentiment: "positive", quote: "incredibly easy to get started", evidenceIds: [] },
    { theme: "Crashes", sentiment: "negative", quote: "crashes on older iOS", evidenceIds: [] },
  ],
};

const CANNED_POSITIONING: PositioningSheet = {
  category: "Health & Fitness",
  claims: ["Build habits in 21 days"],
  valueProps: ["Daily habit streaks"],
};

const CANNED_COMPETITOR_GAP: CompetitorGapSheet = {
  competitors: [
    { name: "Habitify", positioning: "Data-rich analytics", gap: "Simpler onboarding" },
    { name: "Streaks", positioning: "Apple Watch focused", gap: "Cross-platform" },
  ],
};

const CANNED_KEYWORD_SHEET: KeywordSheet = {
  clusters: [
    {
      theme: "Habit tracking",
      keywords: [
        { keyword: "habit tracker app", volume: 8100 },
        { keyword: "daily habit tracker", volume: 5400 },
      ],
    },
    {
      theme: "Productivity",
      keywords: [{ keyword: "productivity app ios", volume: 2900 }],
    },
  ],
};

const CANNED_SYNTH_RESULT: SynthResult = {
  positioningMirror: {
    listingSays: "Build habits in 21 days with science-backed streaks",
    reviewsValue: "Users love streak feature but report crashes",
    gap: "Listing over-promises timeline; users care more about consistency",
  },
  findings: [
    {
      category: "content",
      claim: "Listing's 21-day claim not matched by review sentiment",
      basis: "evidence_based",
      confidence: 0.82,
      evidence: [
        { excerpt: "the streak feature keeps me going", source: "review_themes" },
        { excerpt: "Build habits in 21 days", source: "positioning" },
      ],
    },
    {
      category: "seo_aso",
      claim: "High-volume keyword 'habit tracker app' absent from listing description",
      basis: "evidence_based",
      confidence: 0.91,
      evidence: [
        { excerpt: "habit tracker app", source: "keyword_data" },
      ],
    },
    {
      category: "outreach",
      claim: "Competitor Habitify focuses on analytics; simpler onboarding is an underexploited story",
      basis: "evidence_based",
      confidence: 0.75,
      evidence: [
        { excerpt: "Simpler onboarding and lower cognitive load", source: "competitor_gap" },
      ],
    },
  ],
  sampleAction: {
    category: "seo_aso",
    title: "Add habit tracker keyword cluster to description first paragraph",
    why: "8,100 monthly searches with no competitor owning the phrase",
    draft: "Track your daily habits effortlessly — the #1 habit tracker app for building lasting routines.",
  },
};

// ---------------------------------------------------------------------------
// Helper: route canned responses by prompt content (same logic as extract.test.ts)
// ---------------------------------------------------------------------------
function makeCallModelMock() {
  return vi.fn().mockImplementation(async (args: { stage: string; prompt: string }) => {
    if (args.stage === "synth") {
      return {
        text: JSON.stringify(CANNED_SYNTH_RESULT),
        usage: { inputTokens: 1200, outputTokens: 400 },
      };
    }
    // extract stage — route by prompt keyword
    const prompt = args.prompt;
    let text: string;
    if (prompt.includes("recurring themes")) {
      text = JSON.stringify(CANNED_REVIEW_THEMES);
    } else if (prompt.includes("app's positioning")) {
      text = JSON.stringify(CANNED_POSITIONING);
    } else if (prompt.includes("main competitors")) {
      text = JSON.stringify(CANNED_COMPETITOR_GAP);
    } else {
      text = JSON.stringify(CANNED_KEYWORD_SHEET);
    }
    return { text, usage: { inputTokens: 100, outputTokens: 50 } };
  });
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

const STORE_URL = `https://apps.apple.com/us/app/habits/id${Date.now()}`;

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

beforeEach(() => {
  vi.resetModules();
});

test(
  "runFindings: full pipeline writes 3 findings rows, score on scans, and findings event (mocked LLM, real Supabase)",
  async () => {
    // -----------------------------------------------------------------------
    // 1. Insert prerequisite rows: app + scan + raw_documents
    // -----------------------------------------------------------------------
    const storeUrl = `https://apps.apple.com/us/app/habits/id${Date.now()}`;

    const { data: appRow, error: appErr } = await db
      .from("apps")
      .insert({ store_url: storeUrl, platform: "ios" })
      .select("id")
      .single();
    expect(appErr).toBeNull();
    if (!appRow) throw new Error("No app row");

    const { data: scanRow, error: scanErr } = await db
      .from("scans")
      .insert({ app_id: appRow.id, status: "queued" })
      .select("id")
      .single();
    expect(scanErr).toBeNull();
    if (!scanRow) throw new Error("No scan row");

    const scanId = scanRow.id as string;

    // Insert raw_documents that runExtract reads (one per source category)
    const rawDocs = [
      {
        subject_type: "app",
        subject_key: storeUrl,
        source_type: "app_store_rss",
        body: { reviews: [{ title: "Great", body: "incredibly easy to get started" }] },
        content_hash: `rss-${Date.now()}`,
        mode: "ios",
      },
      {
        subject_type: "app",
        subject_key: storeUrl,
        source_type: "itunes",
        body: { name: "Habits", description: "Build habits in 21 days", category: "Health & Fitness" },
        content_hash: `itunes-${Date.now()}`,
        mode: "ios",
      },
      {
        subject_type: "app",
        subject_key: storeUrl,
        source_type: "dataforseo_serp",
        body: { results: [{ title: "Habitify", url: "https://habitify.me" }] },
        content_hash: `serp-${Date.now()}`,
        mode: "ios",
      },
      {
        subject_type: "app",
        subject_key: storeUrl,
        source_type: "dataforseo_keywords",
        body: { keywords: [{ keyword: "habit tracker app", volume: 8100, cpc: 1.2, competition: 0.4 }] },
        content_hash: `kw-${Date.now()}`,
        mode: "ios",
      },
    ];

    const { error: docsErr } = await db.from("raw_documents").insert(rawDocs);
    expect(docsErr).toBeNull();

    // -----------------------------------------------------------------------
    // 2. Build ScanContext + PreliminaryFacts
    // -----------------------------------------------------------------------
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: makeCallModelMock() }));
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));

    const { ScanBudget } = await import("@/lib/tools/registry");
    const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 500 });

    const ctx = {
      scanId,
      appId: appRow.id as string,
      storeUrl,
      mode: "ios" as const,
      budget,
    };

    const facts = {
      mode: "ios" as const,
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
      sourcesUsed: ["app_store_rss", "itunes", "dataforseo_serp", "dataforseo_keywords"],
    };

    // -----------------------------------------------------------------------
    // 3. Run the pipeline
    // -----------------------------------------------------------------------
    const { runFindings } = await import("@/lib/scan/findings-pipeline");
    await runFindings(ctx, facts);

    // -----------------------------------------------------------------------
    // 4. Assertions
    // -----------------------------------------------------------------------

    // 4a. 3 findings rows inserted for this scan
    const { data: findingRows, error: findingsErr } = await db
      .from("findings")
      .select("id, category, basis, confidence, body, evidence_ids")
      .eq("scan_id", scanId);

    expect(findingsErr).toBeNull();
    expect(findingRows).not.toBeNull();
    expect(findingRows!.length).toBe(3);

    const categories = (findingRows ?? []).map((r) => r.category);
    expect(categories).toContain("content");
    expect(categories).toContain("seo_aso");
    expect(categories).toContain("outreach");

    // 4b. scans.score_total is a number, score_breakdown is set, findings_payload is set
    const { data: scanFinal, error: scanFinalErr } = await db
      .from("scans")
      .select("score_total, score_breakdown, findings_payload")
      .eq("id", scanId)
      .single();

    expect(scanFinalErr).toBeNull();
    if (!scanFinal) throw new Error("No scan row found after pipeline");

    expect(typeof scanFinal.score_total).toBe("number");
    expect(scanFinal.score_breakdown).not.toBeNull();
    expect(scanFinal.findings_payload).not.toBeNull();

    const payload = scanFinal.findings_payload as Record<string, unknown>;
    expect(Array.isArray(payload["findings"])).toBe(true);
    expect((payload["findings"] as unknown[]).length).toBe(3);
    expect(payload["positioningMirror"]).toBeDefined();
    expect(payload["sampleAction"]).toBeDefined();
    expect(payload["score"]).toBeDefined();

    // 4c. A "findings" scan_event emitted with findings.length === 3 and numeric score.total
    const { data: eventRows, error: evtErr } = await db
      .from("scan_events")
      .select("type, payload")
      .eq("scan_id", scanId)
      .eq("type", "findings");

    expect(evtErr).toBeNull();
    expect(eventRows).not.toBeNull();
    expect(eventRows!.length).toBeGreaterThanOrEqual(1);

    const evtPayload = eventRows![0]!.payload as Record<string, unknown>;
    expect(Array.isArray(evtPayload["findings"])).toBe(true);
    expect((evtPayload["findings"] as unknown[]).length).toBe(3);

    const evtScore = evtPayload["score"] as Record<string, unknown>;
    expect(typeof evtScore["total"]).toBe("number");
  },
  60_000,
);

// ---------------------------------------------------------------------------
// Regression test: WEB-mode runFindings produces non-empty findings
// Regression for Fix 1: before the fix, extract queried subject_type="app" but
// web-mode collect writes subject_type="web", so no raw_documents were found →
// empty fact sheets → empty/degraded findings.
// ---------------------------------------------------------------------------
test(
  "runFindings (web-mode): web raw_documents (subject_type=web) yield non-empty findings (mocked LLM)",
  async () => {
    // Unique store URL per test run
    const webStoreUrl = `https://example-saas.com/product/${Date.now()}`;

    // 1. Insert prerequisite rows: app (web) + scan + raw_documents (subject_type="web")
    const { data: appRow, error: appErr } = await db
      .from("apps")
      .insert({ store_url: webStoreUrl, platform: "web" })
      .select("id")
      .single();
    expect(appErr).toBeNull();
    if (!appRow) throw new Error("No app row");

    const { data: scanRow, error: scanErr } = await db
      .from("scans")
      .insert({ app_id: appRow.id, status: "queued" })
      .select("id")
      .single();
    expect(scanErr).toBeNull();
    if (!scanRow) throw new Error("No scan row");

    const scanId = scanRow.id as string;

    // Insert web-mode raw_documents (subject_type="web" as written by get-listing/find-competitors)
    const webRawDocs = [
      {
        subject_type: "web",
        subject_key: webStoreUrl,
        source_type: "site_fetch",
        body: { name: "Example SaaS", description: "The best SaaS for productivity" },
        content_hash: `site-${Date.now()}`,
        mode: "web",
      },
      {
        subject_type: "web",
        subject_key: webStoreUrl,
        source_type: "dataforseo_serp",
        body: { results: [{ title: "Competitor A", url: "https://competitor-a.com" }] },
        content_hash: `serp-${Date.now()}`,
        mode: "web",
      },
      {
        subject_type: "web",
        subject_key: webStoreUrl,
        source_type: "product_hunt",
        body: { upvotes: 250, name: "Example SaaS" },
        content_hash: `ph-${Date.now()}`,
        mode: "web",
      },
    ];

    const { error: docsErr } = await db.from("raw_documents").insert(webRawDocs);
    expect(docsErr).toBeNull();

    // 2. Build ScanContext + PreliminaryFacts (web-mode)
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: makeCallModelMock() }));
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));

    const { ScanBudget } = await import("@/lib/tools/registry");
    const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 500 });

    const ctx = {
      scanId,
      appId: appRow.id as string,
      storeUrl: webStoreUrl,
      mode: "web" as const,
      budget,
    };

    const facts = {
      mode: "web" as const,
      listing: { name: "Example SaaS", category: null, description: "The best SaaS for productivity" },
      competitors: [
        { name: "Competitor A", url: "https://competitor-a.com", source: "dataforseo_serp", rank: 1 },
      ],
      reviewVolume: 0,
      ratingTrend: null,
      webProxy: { score: 30, serpResultCount: 1, phUpvotes: 250, domainAgeYears: 3 },
      themes: [],
      sourcesUsed: ["site_fetch", "dataforseo_serp", "product_hunt"],
    };

    // 3. Run the pipeline
    const { runFindings } = await import("@/lib/scan/findings-pipeline");
    await runFindings(ctx, facts);

    // 4. Assert: findings rows written (non-empty — web raw_docs were found)
    const { data: findingRows, error: findingsErr } = await db
      .from("findings")
      .select("id, category, confidence, body")
      .eq("scan_id", scanId);

    expect(findingsErr).toBeNull();
    expect(findingRows).not.toBeNull();
    // The mocked LLM returns 3 valid findings — all should be persisted
    expect(findingRows!.length).toBe(3);

    // 5. Assert: fact_sheets written with subject_type="web" (not "app")
    const { data: factSheets, error: fsErr } = await db
      .from("fact_sheets")
      .select("id, subject_type, kind")
      .eq("subject_key", webStoreUrl);

    expect(fsErr).toBeNull();
    expect(factSheets).not.toBeNull();
    // All sheets must be written as "web" subject_type
    for (const sheet of factSheets ?? []) {
      expect(sheet.subject_type).toBe("web");
    }

    // 6. Assert: scans.score_total is set
    const { data: scanFinal, error: scanFinalErr } = await db
      .from("scans")
      .select("score_total, findings_payload")
      .eq("id", scanId)
      .single();

    expect(scanFinalErr).toBeNull();
    if (!scanFinal) throw new Error("No scan row found after web-mode pipeline");
    expect(typeof scanFinal.score_total).toBe("number");
    expect(scanFinal.findings_payload).not.toBeNull();
  },
  60_000,
);

// ---------------------------------------------------------------------------
// Idempotency regression test: calling runFindings twice for the same scan
// must leave exactly 3 findings rows (delete-before-insert ensures no duplicates).
// ---------------------------------------------------------------------------
test(
  "runFindings idempotency: calling twice for the same scan leaves exactly 3 findings rows",
  async () => {
    const idempStoreUrl = `https://apps.apple.com/us/app/idemp/id${Date.now()}`;

    // 1. Insert prerequisite rows
    const { data: appRow, error: appErr } = await db
      .from("apps")
      .insert({ store_url: idempStoreUrl, platform: "ios" })
      .select("id")
      .single();
    expect(appErr).toBeNull();
    if (!appRow) throw new Error("No app row");

    const { data: scanRow, error: scanErr } = await db
      .from("scans")
      .insert({ app_id: appRow.id, status: "queued" })
      .select("id")
      .single();
    expect(scanErr).toBeNull();
    if (!scanRow) throw new Error("No scan row");

    const scanId = scanRow.id as string;

    const rawDocs = [
      {
        subject_type: "app",
        subject_key: idempStoreUrl,
        source_type: "app_store_rss",
        body: { reviews: [{ title: "Great", body: "love the streaks" }] },
        content_hash: `idemp-rss-${Date.now()}`,
        mode: "ios",
      },
      {
        subject_type: "app",
        subject_key: idempStoreUrl,
        source_type: "itunes",
        body: { name: "Idemp App", description: "Build habits", category: "Health & Fitness" },
        content_hash: `idemp-itunes-${Date.now()}`,
        mode: "ios",
      },
      {
        subject_type: "app",
        subject_key: idempStoreUrl,
        source_type: "dataforseo_serp",
        body: { results: [{ title: "Competitor X", url: "https://competitor-x.com" }] },
        content_hash: `idemp-serp-${Date.now()}`,
        mode: "ios",
      },
      {
        subject_type: "app",
        subject_key: idempStoreUrl,
        source_type: "dataforseo_keywords",
        body: { keywords: [{ keyword: "habit tracker", volume: 5000, cpc: 0.8, competition: 0.3 }] },
        content_hash: `idemp-kw-${Date.now()}`,
        mode: "ios",
      },
    ];

    const { error: docsErr } = await db.from("raw_documents").insert(rawDocs);
    expect(docsErr).toBeNull();

    // 2. Build ctx + facts
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: makeCallModelMock() }));
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));

    const { ScanBudget } = await import("@/lib/tools/registry");
    const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 500 });

    const ctx = {
      scanId,
      appId: appRow.id as string,
      storeUrl: idempStoreUrl,
      mode: "ios" as const,
      budget,
    };

    const facts = {
      mode: "ios" as const,
      listing: { name: "Idemp App", category: "Health & Fitness", description: "Build habits" },
      competitors: [{ name: "Competitor X", url: "https://competitor-x.com", source: "dataforseo_serp", rank: 1 }],
      reviewVolume: 800,
      ratingTrend: 4.2,
      webProxy: null,
      themes: [{ term: "streaks", count: 20 }],
      sourcesUsed: ["app_store_rss", "itunes", "dataforseo_serp", "dataforseo_keywords"],
    };

    // 3. Run the pipeline TWICE for the same scan
    const { runFindings } = await import("@/lib/scan/findings-pipeline");
    await runFindings(ctx, facts);
    await runFindings(ctx, facts);

    // 4. Assert: exactly 3 findings rows remain (delete-before-insert idempotency)
    const { data: findingRows, error: findingsErr } = await db
      .from("findings")
      .select("id")
      .eq("scan_id", scanId);

    expect(findingsErr).toBeNull();
    expect(findingRows).not.toBeNull();
    expect(findingRows!.length).toBe(3);
  },
  90_000,
);
