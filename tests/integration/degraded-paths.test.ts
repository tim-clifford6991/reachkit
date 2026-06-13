/**
 * Degraded-output paths, end-to-end (Cycle 5 Task 3 — §9.1).
 *
 * §9.1 principle: a dead source / empty fact sheet / LLM failure must yield an
 * HONEST PARTIAL report (degraded content, probability_based / honest basis
 * labels), NEVER a crash and NEVER a blank report.
 *
 * Each test injects ONE failure into a real run (real Supabase, fixtures OFF so
 * the genuine degrade code executes — not the fixture short-circuits) and proves:
 *   1. the pipeline RESOLVES (no throw),
 *   2. scans.report_payload (or findings_payload) is still set, and
 *   3. the output carries an honest/degraded signal where the source failed
 *      (empty arrays / probability_based basis / honest fallback text), with
 *      NO fabricated/padded evidence.
 *
 * Injections covered (the §9.1 audit matrix):
 *   - a collect source throws (a D-tool rejects)               → full-scan resolves
 *   - callModel throws at EXTRACT (Haiku)   → empty/degraded fact sheets
 *   - callModel throws at SYNTH (Sonnet)    → degraded findings (probability_based)
 *   - callModel throws at FORMAT (actions)  → degraded action set, report assembles
 *   - callEmbed / searchSimilar throws (algorithm-safety) → cards still returned
 *   - missing/empty findings_payload at full-scan → report still assembles
 *
 * Mirrors the seeding/mocking style of full-scan.test.ts + findings-pipeline.test.ts:
 * vi.resetModules() per test, vi.doMock(...) BEFORE the dynamic import so transitive
 * modules pick up the mock, real serverDb() against local Supabase.
 *
 * LOCAL ONLY (needs local Supabase). Run with:
 *   pnpm test:int tests/integration/degraded-paths.test.ts
 */

import { beforeEach, expect, test, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/db/types";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { ActionCard } from "@/lib/llm/types";

// Real Supabase (service-role) — used for seeding + reading back, never mocked.
const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

beforeEach(() => {
  vi.resetModules();
  // Fixtures OFF for every test: we want the REAL degrade paths to run, not the
  // fixture short-circuits in extract/synth/actions/algorithm-safety.
  vi.stubEnv("REACHKIT_USE_FIXTURES", "false");
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedApp(storeUrl: string, platform: "ios" | "web" = "ios"): Promise<string> {
  const { data: appRow, error: appErr } = await db
    .from("apps")
    .insert({ store_url: storeUrl, platform })
    .select("id")
    .single();
  if (appErr) throw appErr;
  if (!appRow) throw new Error("No app row");
  return appRow.id as string;
}

async function seedScan(appId: string, findingsPayload: Json | null): Promise<string> {
  const insert: { app_id: string; status: string; findings_payload?: Json } = {
    app_id: appId,
    status: "synthesizing",
  };
  if (findingsPayload !== null) insert.findings_payload = findingsPayload;

  const { data: scanRow, error: scanErr } = await db
    .from("scans")
    .insert(insert)
    .select("id")
    .single();
  if (scanErr) throw scanErr;
  if (!scanRow) throw new Error("No scan row");
  return scanRow.id as string;
}

async function makeCtx(storeUrl: string, mode: "ios" | "web" = "ios"): Promise<ScanContext> {
  const appId = await seedApp(storeUrl, mode === "web" ? "web" : "ios");
  const findingsPayload = {
    positioningMirror: {
      listingSays: "Build habits in 21 days",
      reviewsValue: "Users prize the streak feature",
      gap: "Listing over-promises the 21-day timeline",
    },
    findings: [
      {
        category: "content",
        claim: "The 21-day headline is unsupported by review sentiment",
        basis: "evidence_based",
        confidence: 0.82,
        evidence: [{ excerpt: "the streak feature keeps me going", source: "review_themes" }],
      },
    ],
    score: { total: 12, breakdown: { content: 10, outreach: 5, seo: 20 } },
  } as unknown as Json;
  const scanId = await seedScan(appId, findingsPayload);
  const { ScanBudget } = await import("@/lib/tools/registry");
  return {
    scanId,
    appId,
    storeUrl,
    mode,
    budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 150 }),
  };
}

function makeFacts(mode: "ios" | "web" = "ios"): PreliminaryFacts {
  return {
    mode,
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
  };
}

// A real raw_document so extract has something to read (and would call the LLM,
// which we then make throw). Without docs, extract trivially writes empty sheets
// WITHOUT a model call — so we seed a doc to genuinely exercise the catch path.
async function seedReviewDoc(storeUrl: string): Promise<void> {
  const { error } = await db.from("raw_documents").insert({
    subject_type: "app",
    subject_key: storeUrl,
    source_type: "app_store_rss",
    body: { reviews: [{ title: "Great", body: "love the streaks" }] },
    content_hash: `degraded-rss-${Date.now()}-${Math.random()}`,
    mode: "ios",
  });
  if (error) throw error;
}

// Read back the persisted report payload for a scan.
async function readReport(scanId: string): Promise<Record<string, unknown>> {
  const { data, error } = await db
    .from("scans")
    .select("report_payload")
    .eq("id", scanId)
    .single();
  expect(error).toBeNull();
  if (!data || data.report_payload === null) {
    throw new Error(`report_payload not set for scan ${scanId}`);
  }
  return data.report_payload as Record<string, unknown>;
}

// Assert a report payload is non-blank: it carries the four §5.6 questions + a score.
function expectFourQuestionReport(report: Record<string, unknown>): void {
  expect(report["whatYouOffer"]).toBeDefined();
  expect(report["whoItsFor"]).toBeDefined();
  expect(report["whereTheyAre"]).toBeDefined();
  expect(report["whatToDoThisWeek"]).toBeDefined();
  const score = report["score"] as Record<string, unknown>;
  expect(score).toBeDefined();
  expect(score["basis"]).toBe("verified");
  expect(typeof score["total"]).toBe("number");
}

// A callModel mock that ALWAYS throws — simulates a total LLM outage at any stage.
function throwingCallModel() {
  return vi.fn().mockRejectedValue(new Error("injected LLM outage"));
}

// ---------------------------------------------------------------------------
// 1. A collect source throws — runFullScan must still complete.
//    runFullCollect runs its D-tools under allSettled + .catch, so one rejecting
//    tool degrades only that source; the scan resolves with a usable report.
// ---------------------------------------------------------------------------
test(
  "collect source throws (a D-tool rejects) → runFullScan resolves with a report",
  async () => {
    const storeUrl = `https://apps.apple.com/us/app/habits/id${Date.now()}1`;

    // Make ALL three full-collect D-tools reject. They are .catch-guarded inside
    // runFullCollect, so this must NOT propagate. Other tools used elsewhere keep
    // their real impls (we override only what full-collect imports).
    vi.doMock("@/lib/scan/tools/index", async () => {
      const actual = await vi.importActual<typeof import("@/lib/scan/tools/index")>(
        "@/lib/scan/tools/index",
      );
      const reject = { run: vi.fn().mockRejectedValue(new Error("injected source outage")) };
      return {
        ...actual,
        searchKeywords: { ...actual.searchKeywords, ...reject },
        findCommunities: { ...actual.findCommunities, ...reject },
        findCreators: { ...actual.findCreators, ...reject },
      };
    });
    // Fact-sheet LLM (extract) also down — proves a compound failure still degrades.
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: throwingCallModel() }));

    const ctx = await makeCtx(storeUrl);
    const facts = makeFacts();

    const { runFullScan } = await import("@/lib/scan/full-scan");

    // MUST resolve — a dead source is degraded, never thrown.
    await expect(runFullScan(ctx, facts)).resolves.toBeUndefined();

    const report = await readReport(ctx.scanId);
    expectFourQuestionReport(report);

    // No community/creator surfaces could be collected (the tools rejected), so
    // Q3 surfaces degrade to []. Honest partial, not a crash — and not fabricated.
    const where = report["whereTheyAre"] as { surfaces: unknown[] };
    expect(Array.isArray(where.surfaces)).toBe(true);
    expect(where.surfaces.length).toBe(0);
  },
  90_000,
);

// ---------------------------------------------------------------------------
// 2. callModel throws at EXTRACT (Haiku) → empty/degraded fact sheets.
//    Run the FINDINGS pipeline with a real review doc + throwing callModel:
//    extract catches → writes EMPTY sheets; synth then also fails → degraded
//    finding. We assert the persisted fact sheets are the empty shapes (honest)
//    and findings carry the probability_based degraded marker.
// ---------------------------------------------------------------------------
test(
  "callModel throws at EXTRACT → empty fact sheets persisted (honest, not fabricated)",
  async () => {
    const storeUrl = `https://apps.apple.com/us/app/habits/id${Date.now()}2`;

    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: throwingCallModel() }));

    const ctx = await makeCtx(storeUrl);
    const facts = makeFacts();
    await seedReviewDoc(storeUrl); // ensure extract has a doc → genuinely hits the LLM catch

    const { runFindings } = await import("@/lib/scan/findings-pipeline");

    // Findings pipeline must resolve despite the extract + synth LLM outage.
    await expect(runFindings(ctx, facts)).resolves.toBeUndefined();

    // review_themes sheet was written as the EMPTY shape ({ themes: [] }) — the
    // honest degrade for a failed extract. No invented themes.
    const { data: sheet, error: sheetErr } = await db
      .from("fact_sheets")
      .select("body")
      .eq("subject_type", "app")
      .eq("subject_key", storeUrl)
      .eq("kind", "review_themes")
      .maybeSingle();
    expect(sheetErr).toBeNull();
    expect(sheet).not.toBeNull();
    const body = sheet!.body as { themes?: unknown[] };
    expect(Array.isArray(body.themes)).toBe(true);
    expect(body.themes!.length).toBe(0);

    // findings_payload is set, and the (synth-degraded) findings are honestly
    // labelled probability_based with no fabricated evidence source.
    const { data: scanRow, error: scanErr } = await db
      .from("scans")
      .select("findings_payload")
      .eq("id", ctx.scanId)
      .single();
    expect(scanErr).toBeNull();
    const payload = scanRow!.findings_payload as { findings: Array<Record<string, unknown>> };
    expect(Array.isArray(payload.findings)).toBe(true);
    expect(payload.findings.length).toBeGreaterThanOrEqual(1);
    expect(payload.findings.every((f) => f["basis"] === "probability_based")).toBe(true);
    // Honest low confidence, never a high-confidence fabrication.
    for (const f of payload.findings) {
      expect(Number(f["confidence"])).toBeLessThanOrEqual(0.6);
    }
  },
  90_000,
);

// ---------------------------------------------------------------------------
// 3. callModel throws at SYNTH (Sonnet) → degraded findings.
//    Seed fresh fact sheets directly (so extract has nothing to do / can't be the
//    cause), then make ONLY the synth call fail. Findings must degrade to the
//    single probability_based finding — honest, evidence-free.
// ---------------------------------------------------------------------------
test(
  "callModel throws at SYNTH → degraded probability_based findings (no fabricated evidence)",
  async () => {
    const storeUrl = `https://apps.apple.com/us/app/habits/id${Date.now()}3`;

    // callModel throws ONLY for the synth stage; extract returns valid empty-ish
    // sheets so the failure is unambiguously the synth stage's catch path.
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockImplementation(async (args: { stage: string }) => {
        if (args.stage === "synth") throw new Error("injected synth LLM outage");
        // extract stage — return a parseable empty body
        return { text: JSON.stringify({ themes: [] }), usage: { inputTokens: 1, outputTokens: 1 } };
      }),
    }));

    const ctx = await makeCtx(storeUrl);
    const facts = makeFacts();

    const { runFindings } = await import("@/lib/scan/findings-pipeline");
    await expect(runFindings(ctx, facts)).resolves.toBeUndefined();

    // findings rows persisted and honestly labelled
    const { data: findingRows, error: findErr } = await db
      .from("findings")
      .select("basis, confidence, body")
      .eq("scan_id", ctx.scanId);
    expect(findErr).toBeNull();
    expect(findingRows).not.toBeNull();
    expect(findingRows!.length).toBeGreaterThanOrEqual(1);
    for (const row of findingRows ?? []) {
      expect(row.basis).toBe("probability_based");
      expect(Number(row.confidence)).toBeLessThanOrEqual(0.6);
      // The degraded finding does NOT fabricate a real source — its evidence
      // excerpt is the explicit "(no evidence available)" placeholder.
      const body = row.body as { evidence?: Array<{ source?: string }> };
      const sources = (body.evidence ?? []).map((e) => e.source ?? "");
      expect(sources.every((s) => s === "parse_error" || s.length === 0)).toBe(true);
    }
  },
  90_000,
);

// ---------------------------------------------------------------------------
// 4. callModel throws at FORMAT (actions) → degraded action set; report assembles.
//    With a total LLM outage, generateActions returns buildDegradedActions()
//    (probability_based, no evidence). The Critic gate drops the un-fixable cards
//    (the content/outreach degraded cards have no draft → hard fail) but the
//    report STILL assembles around the surviving / empty plan. The honest signal:
//    every persisted action is probability_based with NO fabricated evidence.
// ---------------------------------------------------------------------------
test(
  "callModel throws at FORMAT (actions) → report assembles around the degraded plan",
  async () => {
    const storeUrl = `https://apps.apple.com/us/app/habits/id${Date.now()}4`;

    // Total LLM outage — every stage's callModel throws (extract/synth/actions/critic).
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: throwingCallModel() }));

    const ctx = await makeCtx(storeUrl);
    const facts = makeFacts();

    const { runFullScan } = await import("@/lib/scan/full-scan");
    await expect(runFullScan(ctx, facts)).resolves.toBeUndefined();

    const report = await readReport(ctx.scanId);
    expectFourQuestionReport(report);

    // whatToDoThisWeek is present and well-formed (each bucket an array) — never blank.
    const week = report["whatToDoThisWeek"] as {
      quickWins: ActionCard[];
      medium: ActionCard[];
      longPlay: ActionCard[];
    };
    expect(Array.isArray(week.quickWins)).toBe(true);
    expect(Array.isArray(week.medium)).toBe(true);
    expect(Array.isArray(week.longPlay)).toBe(true);

    // Any action that survives the gate is the honest degraded shape:
    // probability_based with NO fabricated evidence (§9.1 — never pad evidence).
    const persisted = [...week.quickWins, ...week.medium, ...week.longPlay];
    for (const a of persisted) {
      expect(a.basis).toBe("probability_based");
      expect(a.draftRequiresEdit).toBe(true);
      expect(Array.isArray(a.evidence)).toBe(true);
      expect(a.evidence.length).toBe(0); // degraded cards carry no invented evidence
    }

    // Cross-check the actions TABLE matches the report (persisted, §11 invariant held).
    const { data: actionRows, error: actErr } = await db
      .from("actions")
      .select("basis, draft_requires_edit, evidence_ids")
      .eq("scan_id", ctx.scanId);
    expect(actErr).toBeNull();
    for (const a of actionRows ?? []) {
      expect(a.basis).toBe("probability_based");
      expect(a.draft_requires_edit).toBe(true);
      expect((a.evidence_ids as unknown[]).length).toBe(0);
    }
  },
  90_000,
);

// ---------------------------------------------------------------------------
// 5. callEmbed / searchSimilar throws (algorithm-safety §11 divergence check) →
//    cards still returned. We feed VALID action cards (with drafts) by mocking
//    callModel to return them, then make callEmbed throw. applyDivergenceCheck
//    catches the embed failure and returns the cards unchanged — the scan
//    resolves and the plan survives.
// ---------------------------------------------------------------------------
test(
  "callEmbed throws in algorithm-safety → action cards still returned, scan resolves",
  async () => {
    const storeUrl = `https://apps.apple.com/us/app/habits/id${Date.now()}5`;

    // A single fully-valid, Critic-passing ActionCard the FORMAT stage will "return".
    const validCard = {
      category: "content",
      title: "Lead the description with streak consistency",
      why: "Reviews cite the streak feature; the listing buries it behind the 21-day headline.",
      evidenceIds: [],
      evidence: [
        { excerpt: "the streak feature keeps me going", source: "review_themes", sourceType: "app_store_rss" },
        { excerpt: "Build habits in 21 days", source: "positioning", sourceType: "positioning" },
      ],
      effortMin: 45,
      suggestedDeadline: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
      expectedOutcome: { scoreComponent: "content", delta: 8 },
      draft: "I built this because the streak was the one thing that kept me showing up — and our reviews say the same.",
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "evidence_based",
      confidence: 0.55,
    };

    // callModel: FORMAT stage returns our valid card; critic stage returns an
    // all-pass verdict; everything else returns empty/parseable text.
    vi.doMock("@/lib/llm/anthropic", () => ({
      callModel: vi.fn().mockImplementation(async (args: { stage: string }) => {
        if (args.stage === "format") {
          return { text: JSON.stringify([validCard]), usage: { inputTokens: 1, outputTokens: 1 } };
        }
        if (args.stage === "critic") {
          return {
            text: JSON.stringify({ specificityOk: true, draftCitesFact: true, audienceHonest: true }),
            usage: { inputTokens: 1, outputTokens: 1 },
          };
        }
        // extract stage — parseable empty body
        return { text: JSON.stringify({ themes: [] }), usage: { inputTokens: 1, outputTokens: 1 } };
      }),
    }));

    // The injection under test: the embed provider is down. Both callEmbed call
    // sites in applyDivergenceCheck are guarded; cards must survive.
    vi.doMock("@/lib/llm/embed", () => ({
      callEmbed: vi.fn().mockRejectedValue(new Error("injected embed outage")),
    }));

    // check_link is an L-tool that would otherwise hit the network for the http(s)
    // evidence spot-check; our card's evidence sources are non-URL labels, so it
    // won't fire — but stub it defensively to keep the test hermetic.
    vi.doMock("@/lib/llm/check-link", () => ({
      checkLink: { name: "check_link", klass: "L", run: vi.fn().mockResolvedValue({ entails: true, reason: "stub" }) },
    }));

    const ctx = await makeCtx(storeUrl);
    const facts = makeFacts();

    const { runFullScan } = await import("@/lib/scan/full-scan");
    // MUST resolve despite the embed outage inside §11 divergence.
    await expect(runFullScan(ctx, facts)).resolves.toBeUndefined();

    const report = await readReport(ctx.scanId);
    expectFourQuestionReport(report);

    // The valid card survived the gate + algorithm-safety (embed failure was
    // swallowed, not fatal) — at least one action is in the weekly plan.
    const week = report["whatToDoThisWeek"] as {
      quickWins: ActionCard[];
      medium: ActionCard[];
      longPlay: ActionCard[];
    };
    const total = week.quickWins.length + week.medium.length + week.longPlay.length;
    expect(total).toBeGreaterThanOrEqual(1);

    // §11 no-auto invariant held through the divergence-check failure path.
    for (const a of [...week.quickWins, ...week.medium, ...week.longPlay]) {
      expect(a.draftRequiresEdit).toBe(true);
    }
  },
  90_000,
);

// ---------------------------------------------------------------------------
// 6. Missing/empty findings_payload at full-scan → report still assembles.
//    Seed a scan with NO findings_payload. readFindingsPayload degrades to []
//    findings + the EMPTY positioning mirror; the four-question report still
//    assembles (honest, blank-mirror). Fixtures ON here so extract/actions have
//    deterministic content and the ONLY missing input is the findings payload.
// ---------------------------------------------------------------------------
test(
  "missing findings_payload → full-scan still assembles a four-question report",
  async () => {
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true"); // isolate: only findings_payload is absent

    const storeUrl = `https://apps.apple.com/us/app/habits/id${Date.now()}6`;
    const appId = await seedApp(storeUrl, "ios");
    const scanId = await seedScan(appId, null); // <-- NO findings_payload

    const { ScanBudget } = await import("@/lib/tools/registry");
    const ctx: ScanContext = {
      scanId,
      appId,
      storeUrl,
      mode: "ios",
      budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 150 }),
    };

    const { runFullScan } = await import("@/lib/scan/full-scan");
    await expect(runFullScan(ctx, makeFacts())).resolves.toBeUndefined();

    const report = await readReport(scanId);
    expectFourQuestionReport(report);

    // Q1 positioning mirror degraded to the EMPTY shape (no findings_payload to
    // source it from) — honest blanks, not fabricated copy.
    const whatYouOffer = report["whatYouOffer"] as {
      positioningMirror: { listingSays: string; reviewsValue: string; gap: string };
    };
    expect(whatYouOffer.positioningMirror.listingSays).toBe("");
    expect(whatYouOffer.positioningMirror.reviewsValue).toBe("");
    expect(whatYouOffer.positioningMirror.gap).toBe("");
  },
  90_000,
);
