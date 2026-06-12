import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ReviewThemesSheet, PositioningSheet, CompetitorGapSheet, KeywordSheet } from "./types";

// ---------------------------------------------------------------------------
// Canned model responses
// ---------------------------------------------------------------------------
const CANNED_REVIEW_THEMES: ReviewThemesSheet = {
  themes: [
    { theme: "Onboarding", sentiment: "positive", quote: "super easy to set up", evidenceIds: [] },
    { theme: "Crashes", sentiment: "negative", quote: "crashes on launch", evidenceIds: [] },
  ],
};
const CANNED_POSITIONING: PositioningSheet = {
  category: "Productivity",
  claims: ["#1 habit tracker"],
  valueProps: ["Build habits in 21 days", "Daily streaks"],
};
const CANNED_COMPETITOR_GAP: CompetitorGapSheet = {
  competitors: [
    { name: "Habitify", positioning: "Visual habit analytics", gap: "Simpler onboarding" },
    { name: "Streaks", positioning: "Apple Watch focused", gap: "Multi-platform support" },
  ],
};
const CANNED_KEYWORD_SHEET: KeywordSheet = {
  clusters: [
    { theme: "Habit building", keywords: [{ keyword: "habit tracker", volume: 5000 }] },
    { theme: "Productivity", keywords: [{ keyword: "daily planner", volume: 3200 }] },
  ],
};

// ---------------------------------------------------------------------------
// Canned raw_documents rows
// ---------------------------------------------------------------------------
const STORE_URL = "https://apps.apple.com/us/app/habits/id123";
const CANNED_RAW_DOCS = [
  { id: 1, source_type: "app_store_rss",       subject_key: STORE_URL, body: { reviews: [{ title: "Great", body: "super easy to set up" }] } },
  { id: 2, source_type: "itunes",               subject_key: STORE_URL, body: { name: "Habits", description: "Build habits in 21 days", category: "Productivity" } },
  { id: 3, source_type: "dataforseo_serp",      subject_key: STORE_URL, body: { results: [{ title: "Habitify", url: "https://habitify.me", snippet: "Visual habit analytics" }] } },
  { id: 4, source_type: "dataforseo_keywords",  subject_key: STORE_URL, body: { keywords: [{ keyword: "habit tracker", volume: 5000, cpc: 1.2, competition: 0.4 }] } },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Build a fresh ScanContext with a real ScanBudget — must be called after vi.resetModules().
async function makeScanCtx() {
  const { ScanBudget } = await import("@/lib/tools/registry");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 500 });
  return {
    scanId: "scan-test-1",
    appId: "app-test-1",
    storeUrl: STORE_URL,
    mode: "ios" as const,
    budget,
  };
}

function makeDbMock(rows: typeof CANNED_RAW_DOCS) {
  // The extract query uses a single .eq("subject_key", ...) — no subject_type filter.
  return () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          data: rows,
          error: null,
        }),
      }),
    }),
  });
}

// Route canned responses by prompt content so each kind gets its own body.
// The prompt text is checked against unique phrases from prompts.ts.
function makeCallModelMock(overrideText?: string) {
  return vi.fn().mockImplementation(async (args: { system: string; prompt: string }) => {
    const prompt = args.prompt;
    let text: string;
    if (overrideText !== undefined) {
      text = overrideText;
    } else if (prompt.includes("recurring themes")) {
      // review_themes prompt: "Extract the top recurring themes"
      text = JSON.stringify(CANNED_REVIEW_THEMES);
    } else if (prompt.includes("app's positioning")) {
      // positioning prompt: "Extract the app's positioning"
      text = JSON.stringify(CANNED_POSITIONING);
    } else if (prompt.includes("main competitors")) {
      // competitor_gap prompt: "Identify the main competitors"
      text = JSON.stringify(CANNED_COMPETITOR_GAP);
    } else {
      // keyword_data prompt
      text = JSON.stringify(CANNED_KEYWORD_SHEET);
    }
    return { text, usage: { inputTokens: 100, outputTokens: 50 } };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("runExtract — normal path", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("calls upsertFactSheet for all 4 kinds with parsed bodies", async () => {
    vi.doMock("@/lib/db/client", () => ({ serverDb: makeDbMock(CANNED_RAW_DOCS) }));
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    const callModelMock = makeCallModelMock();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    const upsertMock = vi.fn().mockResolvedValue({ id: 1 });
    vi.doMock("@/lib/scan/fact-sheets", () => ({ upsertFactSheet: upsertMock, factSheetSubjectType: (mode: string) => mode === "web" ? "web" : "app" }));

    const { runExtract } = await import("./extract");
    const ctx = await makeScanCtx();
    await runExtract(ctx);

    expect(upsertMock).toHaveBeenCalledTimes(4);

    const calls = upsertMock.mock.calls as Array<[Parameters<typeof upsertMock>[0]]>;
    const kinds = calls.map((c) => c[0].kind);
    expect(kinds).toContain("review_themes");
    expect(kinds).toContain("positioning");
    expect(kinds).toContain("competitor_gap");
    expect(kinds).toContain("keyword_data");

    const reviewCall = calls.find((c) => c[0].kind === "review_themes")?.[0];
    expect(reviewCall?.body).toEqual(CANNED_REVIEW_THEMES);
    expect(reviewCall?.subjectKey).toBe(STORE_URL);
    expect(reviewCall?.subjectType).toBe("app");
    expect(reviewCall?.modelVersion).toBe("claude-haiku-4-5-20251001");

    const posCall = calls.find((c) => c[0].kind === "positioning")?.[0];
    expect(posCall?.body).toEqual(CANNED_POSITIONING);

    const compCall = calls.find((c) => c[0].kind === "competitor_gap")?.[0];
    expect(compCall?.body).toEqual(CANNED_COMPETITOR_GAP);

    const kwCall = calls.find((c) => c[0].kind === "keyword_data")?.[0];
    expect(kwCall?.body).toEqual(CANNED_KEYWORD_SHEET);
  });

  test("callModel is called with stage=extract and scanId from ctx", async () => {
    vi.doMock("@/lib/db/client", () => ({ serverDb: makeDbMock(CANNED_RAW_DOCS) }));
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    const callModelMock = makeCallModelMock();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    vi.doMock("@/lib/scan/fact-sheets", () => ({ upsertFactSheet: vi.fn().mockResolvedValue({ id: 1 }), factSheetSubjectType: (mode: string) => mode === "web" ? "web" : "app" }));

    const { runExtract } = await import("./extract");
    const ctx = await makeScanCtx();
    await runExtract(ctx);

    for (const call of callModelMock.mock.calls) {
      expect(call[0].stage).toBe("extract");
      expect(call[0].scanId).toBe("scan-test-1");
      expect(call[0].model).toBe("claude-haiku-4-5-20251001");
    }
  });
});

describe("runExtract — malformed JSON degrades to empty sheets (no throw)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("malformed callModel response writes empty sheets for all kinds", async () => {
    vi.doMock("@/lib/db/client", () => ({ serverDb: makeDbMock(CANNED_RAW_DOCS) }));
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    // Return unparseable text for every call
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: makeCallModelMock("NOT JSON {{{{") }));
    const upsertMock = vi.fn().mockResolvedValue({ id: 1 });
    vi.doMock("@/lib/scan/fact-sheets", () => ({ upsertFactSheet: upsertMock, factSheetSubjectType: (mode: string) => mode === "web" ? "web" : "app" }));

    const { runExtract } = await import("./extract");
    const ctx = await makeScanCtx();
    // Must not throw
    await expect(runExtract(ctx)).resolves.toBeUndefined();

    expect(upsertMock).toHaveBeenCalledTimes(4);

    const calls = upsertMock.mock.calls as Array<[Parameters<typeof upsertMock>[0]]>;
    // All four kinds written as minimal empty sheets
    expect(calls.find((c) => c[0].kind === "review_themes")?.[0].body).toEqual({ themes: [] });
    expect(calls.find((c) => c[0].kind === "positioning")?.[0].body).toEqual({ category: "", claims: [], valueProps: [] });
    expect(calls.find((c) => c[0].kind === "competitor_gap")?.[0].body).toEqual({ competitors: [] });
    expect(calls.find((c) => c[0].kind === "keyword_data")?.[0].body).toEqual({ clusters: [] });
  });
});

describe("runExtract — missing source degrades to empty sheet", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("when no review rows exist, review_themes is written as empty sheet without calling callModel for it", async () => {
    // Only listing + competitor + keyword docs — no reviews
    const docsWithoutReviews = CANNED_RAW_DOCS.filter((d) => d.source_type !== "app_store_rss");
    vi.doMock("@/lib/db/client", () => ({ serverDb: makeDbMock(docsWithoutReviews) }));
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => false }));
    const callModelMock = makeCallModelMock();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    const upsertMock = vi.fn().mockResolvedValue({ id: 1 });
    vi.doMock("@/lib/scan/fact-sheets", () => ({ upsertFactSheet: upsertMock, factSheetSubjectType: (mode: string) => mode === "web" ? "web" : "app" }));

    const { runExtract } = await import("./extract");
    const ctx = await makeScanCtx();
    await runExtract(ctx);

    // Still writes all 4 kinds
    expect(upsertMock).toHaveBeenCalledTimes(4);
    const calls = upsertMock.mock.calls as Array<[Parameters<typeof upsertMock>[0]]>;
    // review_themes is an empty sheet because source is absent
    expect(calls.find((c) => c[0].kind === "review_themes")?.[0].body).toEqual({ themes: [] });

    // callModel was NOT called for reviews (only 3 remaining sources)
    expect(callModelMock).toHaveBeenCalledTimes(3);
  });
});

describe("runExtract — fixture mode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("fixture mode writes canned fixture sheets WITHOUT calling callModel", async () => {
    vi.doMock("@/lib/db/client", () => ({ serverDb: makeDbMock(CANNED_RAW_DOCS) }));
    vi.doMock("@/lib/dev/fixtures", () => ({
      fixturesEnabled: () => true,
      fixtureExtract: (kind: string) => {
        switch (kind) {
          case "review_themes":  return CANNED_REVIEW_THEMES;
          case "positioning":    return CANNED_POSITIONING;
          case "competitor_gap": return CANNED_COMPETITOR_GAP;
          case "keyword_data":   return CANNED_KEYWORD_SHEET;
          default: return {};
        }
      },
    }));
    const callModelMock = vi.fn();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    const upsertMock = vi.fn().mockResolvedValue({ id: 1 });
    vi.doMock("@/lib/scan/fact-sheets", () => ({ upsertFactSheet: upsertMock, factSheetSubjectType: (mode: string) => mode === "web" ? "web" : "app" }));

    const { runExtract } = await import("./extract");
    const ctx = await makeScanCtx();
    await runExtract(ctx);

    // callModel must NOT be called
    expect(callModelMock).not.toHaveBeenCalled();

    // But upsertFactSheet still called for all 4 kinds
    expect(upsertMock).toHaveBeenCalledTimes(4);
    const calls = upsertMock.mock.calls as Array<[Parameters<typeof upsertMock>[0]]>;
    expect(calls.find((c) => c[0].kind === "review_themes")?.[0].body).toEqual(CANNED_REVIEW_THEMES);
    expect(calls.find((c) => c[0].kind === "positioning")?.[0].body).toEqual(CANNED_POSITIONING);
    expect(calls.find((c) => c[0].kind === "competitor_gap")?.[0].body).toEqual(CANNED_COMPETITOR_GAP);
    expect(calls.find((c) => c[0].kind === "keyword_data")?.[0].body).toEqual(CANNED_KEYWORD_SHEET);
  });
});
