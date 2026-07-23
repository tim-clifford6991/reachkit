import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { PositioningSheet, CompetitorGapSheet, KeywordSheet } from "./types";
import { installFixtures, resetFixtures } from "@/lib/scan/fixture-seam";
import { makeFixtureProvider } from "@/lib/dev/fixtures";

afterEach(() => resetFixtures());

// ---------------------------------------------------------------------------
// Canned model responses (review_themes retired M3b, 2026-07-23, O-7 — no
// longer extracted; the 3 remaining kinds are positioning/competitor_gap/keyword_data)
// ---------------------------------------------------------------------------
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

  test("calls upsertFactSheet for all 3 kinds with parsed bodies", async () => {
    vi.doMock("@/lib/db/client", () => ({ serverDb: makeDbMock(CANNED_RAW_DOCS) }));
    const callModelMock = makeCallModelMock();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    const upsertMock = vi.fn().mockResolvedValue({ id: 1 });
    vi.doMock("@/lib/scan/fact-sheets", () => ({ upsertFactSheet: upsertMock, factSheetSubjectType: (mode: string) => mode === "web" ? "web" : "app" }));

    const { runExtract } = await import("./extract");
    const ctx = await makeScanCtx();
    await runExtract(ctx);

    expect(upsertMock).toHaveBeenCalledTimes(3);

    const calls = upsertMock.mock.calls as Array<[Parameters<typeof upsertMock>[0]]>;
    const kinds = calls.map((c) => c[0].kind);
    expect(kinds).not.toContain("review_themes");
    expect(kinds).toContain("positioning");
    expect(kinds).toContain("competitor_gap");
    expect(kinds).toContain("keyword_data");

    const posCall = calls.find((c) => c[0].kind === "positioning")?.[0];
    expect(posCall?.body).toEqual(CANNED_POSITIONING);
    expect(posCall?.subjectKey).toBe(STORE_URL);
    expect(posCall?.subjectType).toBe("app");
    expect(posCall?.modelVersion).toBe("claude-haiku-4-5-20251001");

    const compCall = calls.find((c) => c[0].kind === "competitor_gap")?.[0];
    expect(compCall?.body).toEqual(CANNED_COMPETITOR_GAP);

    const kwCall = calls.find((c) => c[0].kind === "keyword_data")?.[0];
    expect(kwCall?.body).toEqual(CANNED_KEYWORD_SHEET);
  });

  test("callModel is called with stage=extract and scanId from ctx", async () => {
    vi.doMock("@/lib/db/client", () => ({ serverDb: makeDbMock(CANNED_RAW_DOCS) }));
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
    // Return unparseable text for every call
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: makeCallModelMock("NOT JSON {{{{") }));
    const upsertMock = vi.fn().mockResolvedValue({ id: 1 });
    vi.doMock("@/lib/scan/fact-sheets", () => ({ upsertFactSheet: upsertMock, factSheetSubjectType: (mode: string) => mode === "web" ? "web" : "app" }));

    const { runExtract } = await import("./extract");
    const ctx = await makeScanCtx();
    // Must not throw
    await expect(runExtract(ctx)).resolves.toBeUndefined();

    expect(upsertMock).toHaveBeenCalledTimes(3);

    const calls = upsertMock.mock.calls as Array<[Parameters<typeof upsertMock>[0]]>;
    // All three kinds written as minimal empty sheets
    expect(calls.find((c) => c[0].kind === "positioning")?.[0].body).toEqual({ category: "", claims: [], valueProps: [] });
    expect(calls.find((c) => c[0].kind === "competitor_gap")?.[0].body).toEqual({ competitors: [] });
    expect(calls.find((c) => c[0].kind === "keyword_data")?.[0].body).toEqual({ clusters: [] });
  });
});

describe("runExtract — missing source does NOT cache an empty sheet (invariant #3)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("when no competitor rows exist, competitor_gap is NOT upserted — never cache an empty sheet", async () => {
    // Only listing + keyword docs — no competitor/SERP data.
    const docsWithoutCompetitors = CANNED_RAW_DOCS.filter((d) => d.source_type !== "dataforseo_serp");
    vi.doMock("@/lib/db/client", () => ({ serverDb: makeDbMock(docsWithoutCompetitors) }));
    const callModelMock = makeCallModelMock();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    const upsertMock = vi.fn().mockResolvedValue({ id: 1 });
    vi.doMock("@/lib/scan/fact-sheets", () => ({ upsertFactSheet: upsertMock, factSheetSubjectType: (mode: string) => mode === "web" ? "web" : "app" }));

    const { runExtract } = await import("./extract");
    const ctx = await makeScanCtx();
    await runExtract(ctx);

    // invariant #3: an empty sheet is never persisted. The 2 kinds WITH docs
    // upsert; competitor_gap (zero docs) is skipped entirely, so synth reads back
    // the {competitors:[]} fallback rather than a cached blank that could later be
    // served as if it were real. This is the same guard demand-intel has.
    const calls = upsertMock.mock.calls as Array<[Parameters<typeof upsertMock>[0]]>;
    const kinds = calls.map((c) => c[0].kind);
    expect(kinds).not.toContain("competitor_gap");
    expect(upsertMock).toHaveBeenCalledTimes(2);

    // callModel was NOT called for competitor_gap (only 2 remaining sources).
    expect(callModelMock).toHaveBeenCalledTimes(2);
  });
});

describe("runExtract — Part C: site_fetch_escalated REPLACES the raw site_fetch HTML", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("positioning prompt uses the escalated text, NOT the raw site_fetch HTML, when both rows exist", async () => {
    const RAW_HTML_MARKER = "UNIQUE_RAW_HTML_SHELL_MARKER";
    const ESCALATED_MARKER = "UNIQUE_ESCALATED_TEXT_MARKER";
    const docsWithEscalation = [
      // The raw (garbage-shell-shaped) site_fetch row — still present in
      // raw_documents (append-only), but must NOT reach the prompt once a
      // good escalation exists for the same subject.
      { id: 10, source_type: "site_fetch", subject_key: STORE_URL, body: `<html><body><p>${RAW_HTML_MARKER}</p></body></html>` },
      { id: 11, source_type: "site_fetch_escalated", subject_key: STORE_URL, body: `${ESCALATED_MARKER} — real rendered page content.` },
    ];
    vi.doMock("@/lib/db/client", () => ({ serverDb: makeDbMock(docsWithEscalation as unknown as typeof CANNED_RAW_DOCS) }));
    const capturedPrompts: string[] = [];
    const callModelMock = vi.fn().mockImplementation(async (args: { prompt: string }) => {
      capturedPrompts.push(args.prompt);
      return { text: JSON.stringify(CANNED_POSITIONING), usage: { inputTokens: 10, outputTokens: 5 } };
    });
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    const upsertMock = vi.fn().mockResolvedValue({ id: 1 });
    vi.doMock("@/lib/scan/fact-sheets", () => ({ upsertFactSheet: upsertMock, factSheetSubjectType: (mode: string) => mode === "web" ? "web" : "app" }));

    const { runExtract } = await import("./extract");
    const ctx = await makeScanCtx();
    await runExtract(ctx, ["positioning"]);

    expect(callModelMock).toHaveBeenCalledTimes(1);
    const prompt = capturedPrompts[0] ?? "";
    expect(prompt).toContain(ESCALATED_MARKER);
    expect(prompt).not.toContain(RAW_HTML_MARKER);
  });

  test("positioning floor (non-LLM) also prefers the escalated text over the raw HTML", async () => {
    const docsWithEscalation = [
      { id: 10, source_type: "site_fetch", subject_key: STORE_URL, body: `<html><head><title>Wrong Name</title></head><body></body></html>` },
      { id: 11, source_type: "site_fetch_escalated", subject_key: STORE_URL, body: "The real product name\nA real value prop, from the rendered page." },
    ];
    vi.doMock("@/lib/db/client", () => ({ serverDb: makeDbMock(docsWithEscalation as unknown as typeof CANNED_RAW_DOCS) }));
    // Malformed model output forces the floor to be what's actually persisted.
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: makeCallModelMock("NOT JSON {{{{") }));
    const upsertMock = vi.fn().mockResolvedValue({ id: 1 });
    vi.doMock("@/lib/scan/fact-sheets", () => ({ upsertFactSheet: upsertMock, factSheetSubjectType: (mode: string) => mode === "web" ? "web" : "app" }));

    const { runExtract } = await import("./extract");
    const ctx = await makeScanCtx();
    await runExtract(ctx, ["positioning"]);

    const calls = upsertMock.mock.calls as Array<[Parameters<typeof upsertMock>[0]]>;
    const posCall = calls.find((c) => c[0].kind === "positioning")?.[0];
    expect(posCall?.body).toEqual({
      category: "",
      claims: ["The real product name"],
      valueProps: ["A real value prop, from the rendered page."],
    });
  });

  test("review fix (IMPORTANT B): a site_fetch_degraded marker excludes the raw garbage row too — no LLM call, no cached sheet", async () => {
    // Escalation was attempted and STILL failed (get-listing.ts persists the
    // marker instead of a "site_fetch_escalated" row). The raw garbage
    // site_fetch row must be excluded from the positioning extract exactly
    // as if a good escalation existed — invariant #3 (don't-cache-empties):
    // once site_fetch is filtered out, there are zero listing docs, so
    // extractKind must skip the upsert entirely rather than cache an empty
    // positioning sheet.
    const docsWithDegradedMarker = [
      { id: 10, source_type: "site_fetch", subject_key: STORE_URL, body: `<html><body><p>GARBAGE_SHELL_MARKER</p></body></html>` },
      { id: 12, source_type: "site_fetch_degraded", subject_key: STORE_URL, body: { fetchDegraded: true } },
    ];
    vi.doMock("@/lib/db/client", () => ({ serverDb: makeDbMock(docsWithDegradedMarker as unknown as typeof CANNED_RAW_DOCS) }));
    const callModelMock = vi.fn();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    const upsertMock = vi.fn().mockResolvedValue({ id: 1 });
    vi.doMock("@/lib/scan/fact-sheets", () => ({ upsertFactSheet: upsertMock, factSheetSubjectType: (mode: string) => mode === "web" ? "web" : "app" }));

    const { runExtract } = await import("./extract");
    const ctx = await makeScanCtx();
    await runExtract(ctx, ["positioning"]);

    // No listing docs survive the filter → no LLM call, no upsert (empty
    // sheet is never cached) — the raw garbage HTML never reached the prompt.
    expect(callModelMock).not.toHaveBeenCalled();
    const calls = upsertMock.mock.calls as Array<[Parameters<typeof upsertMock>[0]]>;
    expect(calls.some((c) => c[0].kind === "positioning")).toBe(false);
  });

  test("without an escalated row, positioning behaves exactly as before (real HTML parsed)", async () => {
    // Regression guard: LISTING_SOURCES growing to include site_fetch_escalated
    // must not change behavior when no such row exists for the subject.
    vi.doMock("@/lib/db/client", () => ({ serverDb: makeDbMock(CANNED_RAW_DOCS) }));
    const callModelMock = makeCallModelMock();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    const upsertMock = vi.fn().mockResolvedValue({ id: 1 });
    vi.doMock("@/lib/scan/fact-sheets", () => ({ upsertFactSheet: upsertMock, factSheetSubjectType: (mode: string) => mode === "web" ? "web" : "app" }));

    const { runExtract } = await import("./extract");
    const ctx = await makeScanCtx();
    await runExtract(ctx);

    const calls = upsertMock.mock.calls as Array<[Parameters<typeof upsertMock>[0]]>;
    const posCall = calls.find((c) => c[0].kind === "positioning")?.[0];
    expect(posCall?.body).toEqual(CANNED_POSITIONING);
  });
});

describe("runExtract — fixture mode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("fixture mode writes canned fixture sheets WITHOUT calling callModel", async () => {
    vi.doMock("@/lib/db/client", () => ({ serverDb: makeDbMock(CANNED_RAW_DOCS) }));
    installFixtures({
      ...makeFixtureProvider(),
      extract: (kind: string) => {
        switch (kind) {
          case "positioning":    return CANNED_POSITIONING;
          case "competitor_gap": return CANNED_COMPETITOR_GAP;
          case "keyword_data":   return CANNED_KEYWORD_SHEET;
          default:               return CANNED_KEYWORD_SHEET;
        }
      },
    });
    const callModelMock = vi.fn();
    vi.doMock("@/lib/llm/anthropic", () => ({ callModel: callModelMock }));
    const upsertMock = vi.fn().mockResolvedValue({ id: 1 });
    vi.doMock("@/lib/scan/fact-sheets", () => ({ upsertFactSheet: upsertMock, factSheetSubjectType: (mode: string) => mode === "web" ? "web" : "app" }));

    const { runExtract } = await import("./extract");
    const ctx = await makeScanCtx();
    await runExtract(ctx);

    // callModel must NOT be called
    expect(callModelMock).not.toHaveBeenCalled();

    // But upsertFactSheet still called for all 3 kinds
    expect(upsertMock).toHaveBeenCalledTimes(3);
    const calls = upsertMock.mock.calls as Array<[Parameters<typeof upsertMock>[0]]>;
    expect(calls.find((c) => c[0].kind === "positioning")?.[0].body).toEqual(CANNED_POSITIONING);
    expect(calls.find((c) => c[0].kind === "competitor_gap")?.[0].body).toEqual(CANNED_COMPETITOR_GAP);
    expect(calls.find((c) => c[0].kind === "keyword_data")?.[0].body).toEqual(CANNED_KEYWORD_SHEET);
  });
});
