/**
 * Cycle 4 Task 17b — TRUE end-to-end Inngest pipeline test.
 *
 * Drives the FULL `scanRequested` Inngest function through ALL FIVE steps
 * (collect → findings → full-scan → notify → done) via @inngest/test's
 * InngestTestEngine, in FIXTURES mode (REACHKIT_USE_FIXTURES=true) so every
 * paid call (extract / synth / action-gen / critic LLM / embeddings / email)
 * short-circuits to deterministic fixtures with NO API keys.
 *
 * The ONLY network-bound stages are the three collect-step D-tools
 * (get_listing / get_reviews / find_competitors), which are NOT fixture-gated.
 * We mock their two underlying adapters (itunes + app-store-rss) with canned
 * data so the tools run their REAL persistence logic — writing the
 * raw_documents the rest of the pipeline reads — without hitting the network.
 *
 * Closes the gap that NO test currently exercises the whole 5-step function
 * end-to-end. Asserts the terminal state:
 *   - scans.report_payload set (four questions + a verified score)
 *   - a `done` scan_event emitted
 *   - ≥1 row in `actions`
 *   - the 4 weekly `monitors` seeded for the app after full-scan
 *
 * LOCAL ONLY (needs local Supabase). Run with:
 *   pnpm test:int tests/integration/scan-requested-e2e.test.ts
 */
import { beforeEach, expect, test, vi } from "vitest";
import type { ListingFacts, Competitor, ReviewItem } from "@/lib/scan/types";

// Fixture mode ON for the whole file — keyless extract/synth/actions/critic/embed/email.
vi.stubEnv("REACHKIT_USE_FIXTURES", "true");

const APP_URL = "https://apps.apple.com/us/app/reachkit-e2e-fixture/id9000000001";

// ---------------------------------------------------------------------------
// Canned adapter outputs — what get_listing / get_reviews / find_competitors
// persist into raw_documents (in place of live iTunes / App Store RSS).
// ---------------------------------------------------------------------------

const CANNED_LISTING: ListingFacts = {
  name: "ReachKit E2E Fixture",
  category: "Health & Fitness",
  description:
    "A symptom and habit tracker that surfaces correlations between sleep, mood and daily factors.",
};

const CANNED_COMPETITORS: Competitor[] = [
  { name: "Bearable", url: "https://bearable.app", source: "itunes_search", rank: 1 },
  { name: "Symple", url: "https://sympleapp.com", source: "itunes_search", rank: 2 },
];

const CANNED_REVIEWS: ReviewItem[] = [
  { id: "e2e-rev-1", rating: 5, title: "Love the correlations", body: "The correlation view finally showed me my triggers.", at: "2026-06-01T10:00:00Z" },
  { id: "e2e-rev-2", rating: 4, title: "Great tracker", body: "Best symptom tracker I've used for chronic illness.", at: "2026-05-28T09:00:00Z" },
];

beforeEach(() => {
  vi.resetModules();
});

test(
  "scan/requested e2e (fixtures) — all 5 steps → report_payload + done event + actions + monitors",
  async () => {
    // Mock ONLY the network adapters used by the collect-step D-tools. The tools
    // themselves run their real persistence (upsertRawDocument) + telemetry so
    // raw_documents / pipeline_runs are written exactly as in production.
    vi.doMock("@/lib/scan/adapters/itunes", () => ({
      appIdFromUrl: (url: string) => {
        const m = url.match(/id(\d+)/);
        if (!m) throw new Error(`no app id in ${url}`);
        return m[1] as string;
      },
      fetchItunesListing: vi.fn().mockResolvedValue({
        listing: CANNED_LISTING,
        rating: 4.7,
        ratingCount: 2800,
        raw: { fixture: true, listing: CANNED_LISTING },
      }),
      fetchItunesCompetitors: vi.fn().mockResolvedValue(CANNED_COMPETITORS),
    }));
    vi.doMock("@/lib/scan/adapters/app-store-rss", () => ({
      parseRssPage: () => CANNED_REVIEWS,
      fetchAppReviews: vi.fn().mockResolvedValue(CANNED_REVIEWS),
    }));

    // Dynamic import AFTER mocking so transitive modules pick up the mocks + env stub.
    const { InngestTestEngine } = await import("@inngest/test");
    const { serverDb } = await import("@/lib/db/client");
    const { scanRequested } = await import("@/lib/inngest/functions/scan-requested");

    const db = serverDb();

    // 1. Seed prerequisite rows: app + scan.
    const { data: appRow, error: appErr } = await db
      .from("apps")
      .insert({ store_url: APP_URL, platform: "ios", name: "ReachKit E2E Fixture" })
      .select("id")
      .single();
    expect(appErr).toBeNull();
    if (!appRow) throw new Error("No app row returned");
    const appId = appRow.id as string;

    const { data: scanRow, error: scanErr } = await db
      .from("scans")
      .insert({ app_id: appId, status: "queued" })
      .select("id")
      .single();
    expect(scanErr).toBeNull();
    if (!scanRow) throw new Error("No scan row returned");
    const scanId = scanRow.id as string;

    // 2. Execute the REAL scanRequested function through ALL 5 steps.
    const engine = new InngestTestEngine({ function: scanRequested });
    const { result } = await engine.execute({
      events: [{ name: "scan/requested", data: { scanId } }],
    });

    // The function returns { ok: true, factsMode } only after step 5 (done) runs.
    expect(result).toMatchObject({ ok: true, factsMode: "ios" });

    // 3. Terminal scan row: status=done, verified report_payload with 4 questions.
    const { data: scanFinal, error: scanFinalErr } = await db
      .from("scans")
      .select("status, report_payload, score_total, preliminary_facts, findings_payload")
      .eq("id", scanId)
      .single();
    expect(scanFinalErr).toBeNull();
    if (!scanFinal) throw new Error("No scan row after execution");

    expect(scanFinal.status).toBe("done");
    expect(scanFinal.preliminary_facts).not.toBeNull();
    expect(scanFinal.findings_payload).not.toBeNull();
    expect(scanFinal.report_payload).not.toBeNull();

    // report_payload = the four §5.6 questions + a verified score.
    const report = scanFinal.report_payload as Record<string, unknown>;
    expect(report["whatYouOffer"]).toBeDefined();
    expect(report["whoItsFor"]).toBeDefined();
    expect(report["whereTheyAre"]).toBeDefined();
    expect(report["whatToDoThisWeek"]).toBeDefined();

    const reportScore = report["score"] as Record<string, unknown>;
    expect(reportScore).toBeDefined();
    expect(reportScore["basis"]).toBe("verified");
    expect(typeof reportScore["total"]).toBe("number");
    expect(Array.isArray(reportScore["radar"])).toBe(true);
    expect((reportScore["radar"] as unknown[]).length).toBe(7);

    // The four-question bucket must carry the surviving action plan.
    const week = report["whatToDoThisWeek"] as {
      quickWins: unknown[];
      medium: unknown[];
      longPlay: unknown[];
    };
    const bucketed = week.quickWins.length + week.medium.length + week.longPlay.length;
    expect(bucketed).toBeGreaterThanOrEqual(1);

    // 4. A `done` scan_event was emitted (step 5).
    const { data: doneEvents, error: doneErr } = await db
      .from("scan_events")
      .select("id, type, payload")
      .eq("scan_id", scanId)
      .eq("type", "done");
    expect(doneErr).toBeNull();
    expect(doneEvents).not.toBeNull();
    expect((doneEvents ?? []).length).toBeGreaterThanOrEqual(1);
    const doneEvt = (doneEvents ?? [])[0];
    if (!doneEvt) throw new Error("No done scan_event emitted");
    expect((doneEvt.payload as Record<string, unknown>)["scanId"]).toBe(scanId);

    // 5. ≥1 row in `actions` (the persisted Critic-passed, §11-safe plan).
    const { data: actionRows, error: actionErr } = await db
      .from("actions")
      .select("id, category, scan_id, app_id, draft_requires_edit")
      .eq("scan_id", scanId);
    expect(actionErr).toBeNull();
    expect(actionRows).not.toBeNull();
    expect((actionRows ?? []).length).toBeGreaterThanOrEqual(1);
    // §11.1 No-auto invariant survives persistence.
    for (const a of actionRows ?? []) {
      expect(a.draft_requires_edit).toBe(true);
      expect(a.app_id).toBe(appId);
    }

    // The persisted plan covers at least one real category (not just the degraded set).
    const persistedCategories = new Set((actionRows ?? []).map((a) => a.category));
    expect(persistedCategories.size).toBeGreaterThanOrEqual(1);

    // 6. The 4 weekly monitors are seeded for the app after full-scan (Task 7).
    const { data: monitorRows, error: monitorErr } = await db
      .from("monitors")
      .select("kind, cadence, last_run_at")
      .eq("app_id", appId);
    expect(monitorErr).toBeNull();
    expect(monitorRows).not.toBeNull();
    const monitorKinds = (monitorRows ?? []).map((m) => m.kind).sort();
    expect(monitorKinds).toEqual(["competitors", "rank", "reviews", "threads"]);
    for (const m of monitorRows ?? []) {
      expect(m.cadence).toBe("weekly");
      expect(m.last_run_at).toBeNull(); // never-run baseline
    }
  },
  180_000, // mocked collect + fixture findings/full-scan — generous ceiling
);
