// tests/scan/free/serp-battery-honesty.test.ts — issue 865
//
// A battery says what it measured. Two things, from the production data of
// 2026-09-17: roughly an eighth of live SERP calls came back `timeout` —
// our own request abort inside the vendor's latency tail, billed either
// way — and every one of those cells was dropped and never asked again;
// and one dropped cell marked the whole pass `degraded`, which is the word
// the app's states read.
//
// So: the twelve are asked through the real pass, with the vendor's HTTP
// surface doubled and nothing else about the battery doubled. The real
// `serpOrganic`, the real `withCostContext` (reservation, settlement, cap)
// and the real composition all run.
//
// Doubled: the database (the §9 memory store), the vendor's server (global
// `fetch`, which is where the timeouts are made), the customer's server
// (`safeFetch`, `readRobots`), and the three model calls before the twelve
// — the same doubles `tests/scan/free/vendor-failure.test.ts` uses, and for
// the same reason: this suite is about the battery, not about them.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../run/harness";
import { envelope, setEnvFixture, stubVendorFetch } from "../../vendors/harness";
import { measured } from "../../../src/lib/measure/measured";
import type { StoredReport } from "../../../src/lib/scan/report";
import { AT, PROFILE, QUESTION, ROBOTS, SELECTED } from "../report/fixtures";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

vi.mock("@/lib/costs/daily", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/costs/daily")>()),
  openDayLedger: async () => ({ spentCents: () => 0, refresh: async () => {}, ceilingReached: () => false, add: () => {} }),
}));

const HOME_HTML =
  "<html><head><title>Onboarding</title></head><body><h1>Onboarding for product teams</h1>" +
  "<h2>How does it work?</h2><p>Guided product tours that lift activation in the first week.</p></body></html>";

vi.mock("@/lib/egress/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/egress/safe-fetch")>()),
  safeFetch: async (url: string) => ({ ok: true, status: 200, url, html: HOME_HTML, bytes: HOME_HTML.length, readAt: AT, headers: {} }),
}));

vi.mock("@/lib/egress/robots", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/egress/robots")>()),
  readRobots: async () => ROBOTS,
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
  registerCorrectionRunner: () => {},
  correctionRunner: () => null,
}));

setEnvFixture();
const { runScan } = await import("../../../src/lib/scan/run");
const { statusOf } = await import("../../../src/lib/scan/store");
const { QUESTION_SERP_RESERVE_C, STAGE_BUDGETS } = await import("../../../src/lib/scan/budgets");
const { marketTooSmall } = await import("../../../src/lib/scan/market-floor");

const CLAIMED_ID = "50450450-4504-4504-8504-504504504504";
const SERP_SOURCE = "serp/google/organic";

const KEYWORDS = [
  "best user onboarding software",
  "user onboarding tools",
  "user onboarding platform",
  "top user onboarding apps",
  "product tours software",
  "product tours platform",
  "user activation tools",
  "user activation software",
  "onboarding software for product teams",
  "best product tours tool",
  "user onboarding app",
  "onboarding platform for saas",
];
/** The two the vendor drops, as issue 865's proving row asks: 2 of 12. */
const DROPPED = [KEYWORDS[4]!, KEYWORDS[9]!];

const TWELVE = KEYWORDS.map((keyword, i) => ({ ...SELECTED, keyword, rank: i + 1 }));
const TWELVE_QUESTIONS = TWELVE.map((search, i) => ({ ...QUESTION, id: `q${i + 1}`, search }));

/** `AbortSignal.timeout()`'s own rejection, which is what a request this
 *  pass gave up on looks like to the transport. */
function timeoutError(): Error {
  const error = new Error("The operation was aborted due to timeout");
  error.name = "TimeoutError";
  return error;
}

function serpBody(): unknown {
  return envelope({
    items: [
      { type: "organic", rank_group: 1, domain: "rival-one.com", url: "https://rival-one.com/p", title: "Rival one" },
      { type: "organic", rank_group: 2, domain: "rival-two.com", url: "https://rival-two.com/p", title: "Rival two" },
    ],
  });
}

/** Every organic SERP request the vendor saw, as the keyword it asked. */
function serpQueries(requests: { url: string; task: Record<string, unknown> | undefined }[]): string[] {
  return requests.filter((r) => r.url.includes("/serp/google/organic")).map((r) => String(r.task?.keyword ?? ""));
}

function storedCall(): { report: StoredReport; degraded: boolean; costCents: number } {
  return (storeCurrentReport.mock.calls.at(-1) as unknown as [{ report: StoredReport; degraded: boolean; costCents: number }])[0];
}

/** The `fetches` rows this pass wrote for the twelve. */
function serpRows(): { cache_key: string; cost_cents: number; reserved_cents: number; payload: unknown }[] {
  return db.queries
    .filter((q) => q.table === "fetches" && q.verb === "insert" && q.values?.source === SERP_SOURCE)
    .map((q) => q.values as unknown as { cache_key: string; cost_cents: number; reserved_cents: number; payload: unknown });
}

let logged: Record<string, unknown>[];

function linesOf(event: string): Record<string, unknown>[] {
  return logged.filter((line) => line.event === event);
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  deriveMarketSet.mockResolvedValue(measured(TWELVE.map((s) => ({ keyword: s.keyword, volume: s.volume })), AT));
  phraseQuestions.mockResolvedValue(measured(TWELVE_QUESTIONS, AT));
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport; degraded: boolean }) => ({
    scanId: a.report.scanId,
    status: statusOf({ stoppedReason: a.report.stoppedReason, degraded: a.degraded }),
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

describe("issue 865 — ten of twelve is a measured pass, not a degraded one", () => {
  /** Two questions the vendor never answers, however often it is asked. */
  function twoAlwaysTimeOut() {
    return stubVendorFetch((request) => {
      if (request.url.includes("/serp/google/organic")) {
        if (DROPPED.includes(String(request.task?.keyword ?? ""))) throw timeoutError();
        return serpBody();
      }
      return envelope({ items: [] });
    });
  }

  it("the pass is stored `done`: it measured ten of twelve, inside its budget, and ended complete", async () => {
    twoAlwaysTimeOut();
    await runScan({ domain: "example.com", tier: "free" });

    const stored = storedCall();
    expect(stored.degraded).toBe(false);
    expect(statusOf({ stoppedReason: stored.report.stoppedReason, degraded: stored.degraded })).toBe("done");
    expect(stored.report.stoppedReason).toBe("complete");
    expect(stored.report.complete).toBe(true);
    expect(stored.report.serps.filter((serp) => serp.kind !== "unmeasured")).toHaveLength(10);
  });

  it("the two cells carry their reason — the vendor's own failure kind, never a message", async () => {
    twoAlwaysTimeOut();
    await runScan({ domain: "example.com", tier: "free" });

    const missed = storedCall().report.serps.filter((serp) => serp.kind === "unmeasured");
    expect(missed).toHaveLength(2);
    for (const cell of missed) {
      expect(cell).toMatchObject({ kind: "unmeasured", reason: "undeterminable", because: "timeout" });
    }
  });

  it("the questions and the score still stand, and no state says stopped or market-too-small", async () => {
    twoAlwaysTimeOut();
    await runScan({ domain: "example.com", tier: "free" });

    const report = storedCall().report;
    expect(report.questions.kind).toBe("measured");
    expect(report.questions.kind === "measured" ? report.questions.value : []).toHaveLength(12);
    expect(report.verdict.missing).toEqual([]);
    expect(marketTooSmall(report.questions)).toBe(false);
    expect(linesOf("scan_pass")).toEqual([
      expect.objectContaining({ status: "done", stoppedReason: "complete", because: "pass_ended", serpsMeasured: 10, serpsAsked: 12 }),
    ]);
  });

  it("a battery no question came back from is still a missing section — the rule is proportionate, not absent", async () => {
    stubVendorFetch((request) => {
      if (request.url.includes("/serp/google/organic")) throw timeoutError();
      return envelope({ items: [] });
    });
    await runScan({ domain: "example.com", tier: "free" });

    const stored = storedCall();
    expect(stored.report.serps.every((serp) => serp.kind === "unmeasured")).toBe(true);
    expect(stored.degraded).toBe(true);
    expect(statusOf({ stoppedReason: stored.report.stoppedReason, degraded: stored.degraded })).toBe("degraded");
  });
});

describe("issue 865 — one more ask, paid for out of what the question already reserved", () => {
  it("a question the vendor dropped once is asked again and measured, and the pass measures all twelve", async () => {
    const seen = new Map<string, number>();
    const vendor = stubVendorFetch((request) => {
      if (!request.url.includes("/serp/google/organic")) return envelope({ items: [] });
      const keyword = String(request.task?.keyword ?? "");
      const attempt = (seen.get(keyword) ?? 0) + 1;
      seen.set(keyword, attempt);
      if (keyword === DROPPED[0] && attempt === 1) throw timeoutError();
      return serpBody();
    });

    await runScan({ domain: "example.com", tier: "free" });

    // Thirteen asks for twelve questions: the one that was dropped, once more.
    const asked = serpQueries(vendor.requests);
    expect(asked).toHaveLength(13);
    expect(asked.filter((q) => q === DROPPED[0])).toHaveLength(2);
    expect(storedCall().report.serps.filter((serp) => serp.kind === "unmeasured")).toHaveLength(0);
    expect(linesOf("serp_retry")).toEqual([{ event: "serp_retry", because: "timeout", outcome: "measured" }]);
  });

  it("the second ask spends nothing the question had not already reserved, and the stage stays inside its purse", async () => {
    const seen = new Map<string, number>();
    stubVendorFetch((request) => {
      if (!request.url.includes("/serp/google/organic")) return envelope({ items: [] });
      const keyword = String(request.task?.keyword ?? "");
      const attempt = (seen.get(keyword) ?? 0) + 1;
      seen.set(keyword, attempt);
      if (keyword === DROPPED[0] && attempt === 1) throw timeoutError();
      return serpBody();
    });

    await runScan({ domain: "example.com", tier: "free" });

    const rows = serpRows();
    const retried = rows.filter((row) => row.cache_key.startsWith(`${DROPPED[0]}|`));
    // Two rows for that question — the timeout the vendor bills, and the
    // answer — and together they cost no more than one question reserves.
    expect(retried).toHaveLength(2);
    expect(retried.map((row) => row.reserved_cents)).toEqual([QUESTION_SERP_RESERVE_C, QUESTION_SERP_RESERVE_C]);
    const spentOnTheQuestion = retried.reduce((sum, row) => sum + row.cost_cents, 0);
    expect(spentOnTheQuestion).toBeLessThanOrEqual(QUESTION_SERP_RESERVE_C);
    // And the twelve as a whole stay inside the purse they are budgeted.
    const spentOnTheTwelve = rows.reduce((sum, row) => sum + row.cost_cents, 0);
    expect(spentOnTheTwelve).toBeLessThanOrEqual(STAGE_BUDGETS.asking_the_twelve.cents);
  });

  it("every question is asked once before any is asked twice — a retry never takes a waiting question's turn", async () => {
    const seen = new Map<string, number>();
    const vendor = stubVendorFetch((request) => {
      if (!request.url.includes("/serp/google/organic")) return envelope({ items: [] });
      const keyword = String(request.task?.keyword ?? "");
      const attempt = (seen.get(keyword) ?? 0) + 1;
      seen.set(keyword, attempt);
      // The first four — one whole wave of the fan-out — time out once.
      if (KEYWORDS.slice(0, 4).includes(keyword) && attempt === 1) throw timeoutError();
      return serpBody();
    });

    await runScan({ domain: "example.com", tier: "free" });

    const asked = serpQueries(vendor.requests);
    expect(asked).toHaveLength(16);
    const firstAsks = asked.slice(0, 12);
    expect(new Set(firstAsks).size).toBe(12);
    expect(asked.slice(12).sort()).toEqual(KEYWORDS.slice(0, 4).sort());
    expect(storedCall().report.serps.filter((serp) => serp.kind === "unmeasured")).toHaveLength(0);
  });

  it("a failure the vendor will answer the same way twice is not re-asked — it is recorded", async () => {
    const vendor = stubVendorFetch((request) => {
      if (!request.url.includes("/serp/google/organic")) return envelope({ items: [] });
      if (String(request.task?.keyword ?? "") === DROPPED[0]) return { status: 400, statusText: "Bad Request" };
      return serpBody();
    });

    await runScan({ domain: "example.com", tier: "free" });

    expect(serpQueries(vendor.requests).filter((q) => q === DROPPED[0])).toHaveLength(1);
    expect(linesOf("serp_retry")).toEqual([]);
    const missed = storedCall().report.serps.filter((serp) => serp.kind === "unmeasured");
    expect(missed).toEqual([expect.objectContaining({ kind: "unmeasured", reason: "undeterminable", because: "http_400" })]);
  });
});
