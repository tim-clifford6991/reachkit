/**
 * Cycle 1 Task 14 / Cycle 2 Task 8 acceptance gate: scan/requested pipeline function
 *
 * Runs the real scanRequested Inngest function via InngestTestEngine (no dev
 * server needed) and asserts that:
 *   - A `facts` scan_event with competitors is written to the DB
 *   - A `findings` scan_event with 3 findings and a numeric score.total is written
 *   - scans.score_total is set; `findings` table has 3 rows for the scan
 *   - The scan reaches status='done'
 *
 * REQUIRES NETWORK: Hits live iTunes / App Store RSS for facts (free, no keys).
 * LLM calls (extract + synth) are MOCKED — no Anthropic key required.
 * LOCAL ONLY — not CI. Run with: pnpm test:int tests/integration/scan-requested.test.ts
 */
import { beforeEach, expect, test, vi } from "vitest";
import type { SynthResult, ReviewThemesSheet, PositioningSheet, CompetitorGapSheet, KeywordSheet } from "@/lib/llm/types";

// ---------------------------------------------------------------------------
// Canned model responses used by the mocked callModel
// ---------------------------------------------------------------------------

const CANNED_REVIEW_THEMES: ReviewThemesSheet = {
  themes: [
    { theme: "Ease of use", sentiment: "positive", quote: "incredibly easy to get started", evidenceIds: [] },
    { theme: "Crashes", sentiment: "negative", quote: "crashes on older iOS", evidenceIds: [] },
  ],
};

const CANNED_POSITIONING: PositioningSheet = {
  category: "Health & Fitness",
  claims: ["Curate and organize things you want to do"],
  valueProps: ["Organize future plans", "Track what you watch, play, and read"],
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
      theme: "Watchlist",
      keywords: [
        { keyword: "watchlist app", volume: 5400 },
        { keyword: "movie tracker app", volume: 4100 },
      ],
    },
    {
      theme: "Organization",
      keywords: [{ keyword: "list organizer app", volume: 2900 }],
    },
  ],
};

const CANNED_SYNTH_RESULT: SynthResult = {
  positioningMirror: {
    listingSays: "Curate and organize things you want to do",
    reviewsValue: "Users love the clean interface but want more categories",
    gap: "Listing focuses on curation; users value organization speed",
  },
  findings: [
    {
      category: "content",
      claim: "Listing's curation focus does not match review emphasis on quick task entry",
      basis: "evidence_based",
      confidence: 0.82,
      evidence: [
        { excerpt: "incredibly easy to get started", source: "review_themes" },
        { excerpt: "Curate and organize things you want to do", source: "positioning" },
      ],
    },
    {
      category: "seo_aso",
      claim: "High-volume keyword 'watchlist app' (5,400/mo) absent from listing description",
      basis: "evidence_based",
      confidence: 0.91,
      evidence: [
        { excerpt: "watchlist app", source: "keyword_data" },
      ],
    },
    {
      category: "outreach",
      claim: "Competitors focus on analytics complexity; simple list-keeping is an underexploited story for creator outreach",
      basis: "evidence_based",
      confidence: 0.75,
      evidence: [
        { excerpt: "Simpler onboarding and lower cognitive load", source: "competitor_gap" },
      ],
    },
  ],
  sampleAction: {
    category: "seo_aso",
    title: "Add watchlist keyword cluster to listing title + first description paragraph",
    why: "5,400 monthly searches with no competitor owning the phrase in title",
    draft: "Sofa — Watchlist & List Tracker\n\nOrganize everything you want to watch, read, and play with Sofa, the simplest watchlist app for iOS.",
  },
};

// ---------------------------------------------------------------------------
// callModel mock — routes by stage; extract uses prompt keyword routing
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

const SOFA_URL = "https://apps.apple.com/us/app/sofa/id1276554886";

beforeEach(() => {
  vi.resetModules();
});

test(
  "scan/requested (ios/Sofa) — facts (live iTunes) + 3 findings (mocked LLM) + score + done",
  async () => {
    // Mock callModel BEFORE importing scanRequested so that extract/synth pick up the mock
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: makeCallModelMock() }));
    // Ensure fixture mode is off so the mock callModel is actually used
    vi.doMock("@/lib/dev/fixtures", () => ({
      useFixtures: () => false,
      fixtureExtract: () => { throw new Error("should not be called in test"); },
      fixtureSynth: () => { throw new Error("should not be called in test"); },
      fixtureSerp: () => { throw new Error("should not be called in test"); },
      fixtureTavily: () => { throw new Error("should not be called in test"); },
      fixturePh: () => { throw new Error("should not be called in test"); },
      fixtureKeywords: () => { throw new Error("should not be called in test"); },
    }));

    // Dynamic import AFTER mocking so all transitive modules pick up the mock
    const { InngestTestEngine } = await import("@inngest/test");
    const { serverDb } = await import("@/lib/db/client");
    const { scanRequested } = await import("@/lib/inngest/functions/scan-requested");

    const db = serverDb();

    // 1. Insert prerequisite rows
    const { data: appRow, error: appErr } = await db
      .from("apps")
      .insert({ store_url: SOFA_URL, platform: "ios" })
      .select("id")
      .single();
    expect(appErr).toBeNull();
    if (!appRow) throw new Error("No app row returned");

    const { data: scanRow, error: scanErr } = await db
      .from("scans")
      .insert({ app_id: appRow.id, status: "queued" })
      .select("id")
      .single();
    expect(scanErr).toBeNull();
    if (!scanRow) throw new Error("No scan row returned");

    const scanId = scanRow.id as string;

    // 2. Execute the real scanRequested function via InngestTestEngine
    //    collect step runs live (iTunes/RSS); findings step uses mocked callModel
    const engine = new InngestTestEngine({ function: scanRequested });
    const { result } = await engine.execute({
      events: [{ name: "scan/requested", data: { scanId } }],
    });

    expect(result).toMatchObject({ ok: true });

    // 3. Assert a `facts` scan_event was written with ≥1 competitor
    const { data: evtRows, error: evtErr } = await db
      .from("scan_events")
      .select("id, type, payload")
      .eq("scan_id", scanId)
      .eq("type", "facts");

    expect(evtErr).toBeNull();
    expect(evtRows).not.toBeNull();
    expect(evtRows!.length).toBeGreaterThan(0);

    const factsRow = evtRows![0];
    if (!factsRow) throw new Error("No facts event row found — pipeline did not write facts");

    const factsPayload = factsRow.payload as Record<string, unknown>;
    const competitors = factsPayload["competitors"];
    expect(Array.isArray(competitors)).toBe(true);
    expect((competitors as unknown[]).length).toBeGreaterThanOrEqual(1);

    // 4. Assert a `findings` scan_event was written with 3 findings and a numeric score.total
    const { data: findingsEvtRows, error: findingsEvtErr } = await db
      .from("scan_events")
      .select("id, type, payload")
      .eq("scan_id", scanId)
      .eq("type", "findings");

    expect(findingsEvtErr).toBeNull();
    expect(findingsEvtRows).not.toBeNull();
    expect(findingsEvtRows!.length).toBeGreaterThanOrEqual(1);

    const findingsEvt = findingsEvtRows![0];
    if (!findingsEvt) throw new Error("No findings event row found — findings pipeline did not emit");

    const findingsPayload = findingsEvt.payload as Record<string, unknown>;
    expect(Array.isArray(findingsPayload["findings"])).toBe(true);
    expect((findingsPayload["findings"] as unknown[]).length).toBe(3);

    const evtScore = findingsPayload["score"] as Record<string, unknown>;
    expect(typeof evtScore["total"]).toBe("number");

    // 5. Assert the scans row: score_total set, preliminary_facts set
    const { data: scanFinal, error: scanFinalErr } = await db
      .from("scans")
      .select("status, preliminary_facts, score_total, score_breakdown, findings_payload")
      .eq("id", scanId)
      .single();

    expect(scanFinalErr).toBeNull();
    if (!scanFinal) throw new Error("No scan row returned after execution");

    expect(scanFinal.status).toBe("done");
    expect(scanFinal.preliminary_facts).not.toBeNull();
    expect(typeof scanFinal.score_total).toBe("number");
    expect(scanFinal.score_breakdown).not.toBeNull();
    expect(scanFinal.findings_payload).not.toBeNull();

    // 6. Assert `findings` table has 3 rows for this scan
    const { data: findingRows, error: findingRowsErr } = await db
      .from("findings")
      .select("id, category")
      .eq("scan_id", scanId);

    expect(findingRowsErr).toBeNull();
    expect(findingRows).not.toBeNull();
    expect(findingRows!.length).toBe(3);

    const categories = (findingRows ?? []).map((r) => r.category);
    expect(categories).toContain("content");
    expect(categories).toContain("seo_aso");
    expect(categories).toContain("outreach");

    // 7. Assert pipeline_runs has ≥1 row for this scan (proves telemetry path)
    const { data: pipelineRows, error: pipelineErr } = await db
      .from("pipeline_runs")
      .select("id")
      .eq("scan_id", scanId);

    expect(pipelineErr).toBeNull();
    expect(pipelineRows).not.toBeNull();
    expect((pipelineRows ?? []).length).toBeGreaterThanOrEqual(1);
  },
  180_000, // live network collect + mocked findings — give it 3 minutes
);
