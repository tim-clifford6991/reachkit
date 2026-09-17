// tests/scan/run/ai-mode-engine.test.ts — issue 869
//
// The battery's two engines, through the real vendor seam.
//
// Production 2026-09-17, from the `fetches` rows: the AI Mode engine
// answered 1 call in 14 — **9 × `task_40102`** and 4 timeouts — and every
// one of those cells was stored `unmeasured`, which is what left the GEO
// half of the measurement blank. DataForSEO's own documentation says
// `40102` is "no search results." and that the request reached the search
// engine and is billable
// (https://docs.dataforseo.com/v3/appendix/errors/ ·
// https://dataforseo.com/help-center/what-does-the-40102-error-mean), so it
// is the vendor's zero-result and never a failure: on AI Mode it is the
// ordinary answer for a query Google serves no AI Mode block for.
//
// Real: `aiMode`, `llmScraper`, the envelope, `withCostContext` and the
// composition. Doubled: the vendor's HTTP surface (global `fetch`), the
// database, the customer's server, and the three model calls before the
// twelve.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "./harness";
import { envelope, setEnvFixture, stubVendorFetch } from "../../vendors/harness";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { StoredReport } from "../../../src/lib/scan/report";
import { AT, ON_PAGE, PROFILE, QUESTION, ROBOTS, SELECTED } from "../report/fixtures";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

vi.mock("@/lib/costs/daily", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/costs/daily")>()),
  openDayLedger: async () => ({ spentCents: () => 0, refresh: async () => {}, ceilingReached: () => false, add: () => {} }),
}));

const measureDomain = vi.fn();
vi.mock("@/lib/measure", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/measure")>()),
  measureDomain: (...args: unknown[]) => measureDomain(...args),
}));

const deriveProfile = vi.fn();
vi.mock("@/lib/market/questions/profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/market/questions/profile")>()),
  deriveProfile: (...a: unknown[]) => deriveProfile(...a),
}));

const deriveMarketSet = vi.fn();
vi.mock("@/lib/market/questions/market-set", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/market/questions/market-set")>()),
  deriveMarketSet: (...a: unknown[]) => deriveMarketSet(...a),
}));

const phraseQuestions = vi.fn();
vi.mock("@/lib/market/questions/phrase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/market/questions/phrase")>()),
  phraseQuestions: (...a: unknown[]) => phraseQuestions(...a),
}));

const readCurrentReport = vi.fn();
vi.mock("@/lib/scan/report", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/scan/report")>()),
  readCurrentReport: (...a: unknown[]) => readCurrentReport(...a),
}));

const storeCurrentReport = vi.fn();
vi.mock("@/lib/scan/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/scan/store")>()),
  storeCurrentReport: (...a: unknown[]) => storeCurrentReport(...a),
}));

vi.mock("@/lib/scan/correction", () => ({
  readCorrectionFacts: async () => null,
  advanceCorrectionState: async () => true,
  registerCorrectionRunner: () => undefined,
  correctionRunner: () => null,
}));

vi.mock("@/lib/market/rivals/tracked", () => ({ trackedRivals: async () => null }));

// The ChatGPT engine is the standard queue — `task_post`, then `task_get`
// polled every `VENDOR.stdQueuePollIntervalS` — and this suite is about AI
// Mode, so it is doubled at its own function boundary rather than made to
// wait out a poll interval twelve times. AI Mode (live on the deep tier)
// goes through the real envelope and the real vendor surface below.
const llmScraper = vi.fn();
vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/vendors/dataforseo")>()),
  llmScraper: (...a: unknown[]) => llmScraper(...a),
}));

setEnvFixture();
const { runScan } = await import("../../../src/lib/scan/run");
const { PRICE_BOOK, BATTERY: BATTERY_PINS } = await import("../../../src/lib/config/constants");

const CLAIMED_ID = "33333333-3333-4333-8333-333333333333";
const DOMAIN = "example.com";
const AI_MODE_SOURCE = "serp/google/ai_mode";

const MEASUREMENT: DomainMeasurement = {
  drivers: {
    foundations: measured(52, AT),
    answerability: measured(38, AT),
    searchPresence: measuredZero(0, AT),
    aiPresence: unmeasured("not_attempted", AT),
  },
  text: { home: "Onboarding for product teams.", pricing: null },
  onPage: measured(ON_PAGE, AT),
  pricing: null,
  robots: measured(ROBOTS, AT),
  ownRanked: measuredZero(0, AT),
  ownRankedRows: [],
  homeRefusal: null,
};

const TWELVE = Array.from({ length: BATTERY_PINS.QUESTIONS }, (_, i) => ({
  ...QUESTION,
  id: `q${i}`,
  search: { ...SELECTED, keyword: `best onboarding software ${i}` },
}));

/** The vendor's "no search results." task — status 40102, no result. */
function noSearchResults(): unknown {
  return { tasks: [{ id: "task-id-fixture", status_code: 40102, status_message: "No Search Results.", result: null }] };
}

/** One AI Mode answer, in the shape the endpoint returns it. */
function aiModeAnswer(): unknown {
  return envelope({ items: [{ type: "ai_overview", markdown: "Some answer", references: [{ domain: "rival.com" }] }] });
}

function timeoutError(): Error {
  const error = new Error("The operation was aborted due to timeout");
  error.name = "TimeoutError";
  return error;
}

function storedReport(): StoredReport {
  return (storeCurrentReport.mock.calls.at(-1) as unknown as [{ report: StoredReport }])[0].report;
}

/** The engine columns of the stored report, by engine name. */
function cellsOf(engine: "ai_overview" | "ai_mode" | "chatgpt") {
  return (storedReport().aiAnswers?.rows ?? []).map(
    (row) => row.engines.find((column) => column.engine === engine)?.cell
  );
}

function rowsFor(source: string): { cost_cents: number; reserved_cents: number; payload: unknown }[] {
  return db.queries
    .filter((q) => q.table === "fetches" && q.verb === "insert" && q.values?.source === source)
    .map((q) => q.values as unknown as { cost_cents: number; reserved_cents: number; payload: unknown });
}

let logged: Record<string, unknown>[];

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  measureDomain.mockResolvedValue(MEASUREMENT);
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  deriveMarketSet.mockResolvedValue(measured([{ keyword: SELECTED.keyword, volume: SELECTED.volume }], AT));
  phraseQuestions.mockResolvedValue(measured(TWELVE, AT));
  llmScraper.mockResolvedValue(measured({ answered: true, text: "…", citedDomains: ["rival.com"] }, AT));
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "done" as const,
  }));
  logged = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    if (typeof args[0] !== "string") return;
    try {
      logged.push(JSON.parse(args[0]) as Record<string, unknown>);
    } catch {
      // Not a JSON line.
    }
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("issue 869 — `task_40102` is the engine's answer, not a failure", () => {
  /** Every AI Mode call answers "no search results."; everything else answers. */
  function aiModeSaysNoResults() {
    return stubVendorFetch((request) => {
      if (request.url.includes("/serp/google/ai_mode")) return noSearchResults();
      return envelope({ items: [] });
    });
  }

  it("the cells are `no_answer` — measured, and the answer is that Google served none", async () => {
    aiModeSaysNoResults();
    await runScan({ domain: DOMAIN, tier: "deep" });

    const cells = cellsOf("ai_mode");
    expect(cells).toHaveLength(BATTERY_PINS.QUESTIONS);
    for (const cell of cells) expect(cell).toEqual({ kind: "no_answer" });
  });

  it("it is ledgered at what the vendor charges for it, not at nothing", async () => {
    aiModeSaysNoResults();
    await runScan({ domain: DOMAIN, tier: "deep" });

    const rows = rowsFor(AI_MODE_SOURCE);
    expect(rows).toHaveLength(BATTERY_PINS.QUESTIONS);
    for (const row of rows) {
      // The vendor's own help centre: "the request is billable even though
      // no SERP items were returned."
      expect(row.cost_cents).toBe(PRICE_BOOK.AI_MODE_LIVE_C);
      expect(row.payload).toEqual([]);
    }
  });

  it("an engine that is answering, even with nothing, keeps being asked — all twelve questions", async () => {
    const vendor = aiModeSaysNoResults();
    await runScan({ domain: DOMAIN, tier: "deep" });

    expect(vendor.requests.filter((r) => r.url.includes("/serp/google/ai_mode"))).toHaveLength(
      BATTERY_PINS.QUESTIONS
    );
    expect(logged.filter((line) => line.event === "battery_engine_dropped")).toEqual([]);
  });

  it("the other engine is untouched by it", async () => {
    aiModeSaysNoResults();
    await runScan({ domain: DOMAIN, tier: "deep" });

    const chatgpt = cellsOf("chatgpt");
    expect(chatgpt).toHaveLength(BATTERY_PINS.QUESTIONS);
    for (const cell of chatgpt) expect(cell?.kind).toBe("answered");
    expect(llmScraper).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);
  });
});

describe("issue 869 — an engine that is refusing stops being bought in the same pass", () => {
  it("its cells are unmeasured, carrying what the engine last said, and the pass buys it no more", async () => {
    const vendor = stubVendorFetch((request) => {
      if (request.url.includes("/serp/google/ai_mode")) throw timeoutError();
      return envelope({ items: [] });
    });

    await runScan({ domain: DOMAIN, tier: "deep" });

    // Bought while it might still answer, and not after.
    const asks = vendor.requests.filter((r) => r.url.includes("/serp/google/ai_mode")).length;
    expect(asks).toBeGreaterThan(0);
    expect(asks).toBeLessThan(BATTERY_PINS.QUESTIONS);
    expect(logged.filter((line) => line.event === "battery_engine_dropped")).toEqual([
      { event: "battery_engine_dropped", engine: "ai_mode", because: "timeout", after: 2 },
    ]);

    const cells = cellsOf("ai_mode");
    expect(cells.every((cell) => cell?.kind === "unmeasured")).toBe(true);
    expect(cells.some((cell) => cell?.kind === "unmeasured" && cell.because === "timeout")).toBe(true);
    // Never a `no_answer`: nothing was read, so nothing may read as "the
    // engine answered and named nobody".
    expect(cells.some((cell) => cell?.kind === "no_answer")).toBe(false);

    // And the other engine still measured every question.
    expect(cellsOf("chatgpt").every((cell) => cell?.kind === "answered")).toBe(true);
  });

  it("one failure is not a refusal — an engine that fails once and answers after is still bought", async () => {
    let seen = 0;
    const vendor = stubVendorFetch((request) => {
      if (request.url.includes("/serp/google/ai_mode")) {
        seen += 1;
        if (seen === 1) throw timeoutError();
        return aiModeAnswer();
      }
      return envelope({ items: [] });
    });

    await runScan({ domain: DOMAIN, tier: "deep" });

    expect(vendor.requests.filter((r) => r.url.includes("/serp/google/ai_mode"))).toHaveLength(
      BATTERY_PINS.QUESTIONS
    );
    expect(logged.filter((line) => line.event === "battery_engine_dropped")).toEqual([]);
    expect(cellsOf("ai_mode").filter((cell) => cell?.kind === "answered")).toHaveLength(
      BATTERY_PINS.QUESTIONS - 1
    );
  });
});
