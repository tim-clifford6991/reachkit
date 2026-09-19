// tests/scan/run/paid-pass-ceiling.test.ts — issue 902.
//
// Issue 855 set `TIMING.paidPassCeilingS` so a paid pass fits inside the
// `/api/jobs` invocation it runs in (`TIMING.jobsCeilingS`) with room to
// compose and store its report. A paid pass is not raced — its ceiling is
// read cooperatively, `bounds.stopNow()` between calls, exactly as its cap
// is — and that is enough only while no single call can outlast the
// ceiling on its own.
//
// Two of the pass's could. The ChatGPT scraper has no live surface, so
// every battery ask of it is a standard-queue `task_post` and then a poll
// that ran to `VENDOR.stdQueueDeadlineMin` — forty-five minutes, eleven
// times the whole ceiling — and the weekly pass buys its question SERPs
// and its AI Mode answers the same way. And an engine that has not
// answered yet is asked one question at a time (issue 869), so an ask
// could wait behind every ask ahead of it and then buy against a
// `stopNow()` read before that wait began.
//
// The mutations this suite exists to kill:
//
//  - a pass that runs past `jobsCeilingS` instead of ending on
//    `time_ceiling` — the frozen invocation that stores no report, leaves
//    the claimed row `running`, and has its step retried, which is where
//    twelve questions come to buy more than twelve questions' worth;
//  - dropping the pass's deadline on the way into any of the three calls a
//    question costs, so the bound is declared and never applied;
//  - buying an engine ask that won its turn after the ceiling had fired;
//  - asking a question more times than its three columns need.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStages, fakeDb } from "./harness";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import { BATTERY as BATTERY_PINS, TIMING, VENDOR } from "../../../src/lib/config/constants";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { StoredReport } from "../../../src/lib/scan/report";
import type { AiAnswer } from "../../../src/lib/vendors/dataforseo/types";
import { AT, ON_PAGE, PROFILE, ROBOTS, SERP, SELECTED, QUESTION } from "../report/fixtures";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

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

const serpOrganic = vi.fn();
const aiMode = vi.fn();
const llmScraper = vi.fn();
vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/vendors/dataforseo")>()),
  serpOrganic: (...a: unknown[]) => serpOrganic(...a),
  aiMode: (...a: unknown[]) => aiMode(...a),
  llmScraper: (...a: unknown[]) => llmScraper(...a),
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

const { runScan } = await import("../../../src/lib/scan/run");

const CLAIMED_ID = "99999999-9999-4999-8999-999999999999";
const DOMAIN = "example.com";
const CEILING_MS = TIMING.paidPassCeilingS * 1000;
const QUEUE_DEADLINE_MS = VENDOR.stdQueueDeadlineMin * 60 * 1000;

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

const answered = (cited: string[]): AiAnswer => ({ answered: true, text: "…", citedDomains: cited });

function storedReport(): StoredReport {
  const call = storeCurrentReport.mock.calls.at(-1) as unknown as [{ report: StoredReport }];
  return call[0].report;
}

/**
 * The standard queue, as it really waits.
 *
 * `task_post`, then a poll every `VENDOR.stdQueuePollIntervalS` until the
 * task completes or a deadline passes — and the deadline is the earlier of
 * the vendor's own pin and whatever the caller handed in. A call site that
 * hands in nothing waits the vendor's forty-five minutes, which is the
 * shape this issue is about; one that hands in its pass's remaining time
 * comes back inside it. The failure it ends on is the vendor's `deadline`,
 * ledgered and heard by the caller exactly as the real seam reports one.
 */
function stillQueueing(onFailure?: (failure: { vendorFailure: string; endpoint: string; billed: boolean }) => void) {
  return async (_c: unknown, call: { untilMs?: number }) => {
    const until = Math.min(call.untilMs ?? Number.POSITIVE_INFINITY, Date.now() + QUEUE_DEADLINE_MS);
    while (Date.now() < until) {
      await new Promise((resolve) => setTimeout(resolve, VENDOR.stdQueuePollIntervalS * 1000));
    }
    onFailure?.({ vendorFailure: "deadline", endpoint: "ai_optimization/chat_gpt/llm_scraper", billed: true });
    return unmeasured<AiAnswer>("undeterminable", AT);
  };
}

let stages: { lines: string[]; restore: () => void };

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  measureDomain.mockResolvedValue(MEASUREMENT);
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  deriveMarketSet.mockResolvedValue(measured([{ keyword: SELECTED.keyword, volume: SELECTED.volume }], AT));
  phraseQuestions.mockResolvedValue(measured(TWELVE, AT));
  serpOrganic.mockResolvedValue(measured(SERP, AT));
  aiMode.mockResolvedValue(measured(answered(["appcues.com"]), AT));
  llmScraper.mockResolvedValue(measured(answered(["example.com"]), AT));
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "done" as const,
  }));
  stages = captureStages();
});

afterEach(() => stages.restore());

describe("a paid pass whose engine is slower than its ceiling (issue 902)", () => {
  it("ends on `time_ceiling` with its report stored, inside the invocation it runs in", async () => {
    // The pass's other modules are reached through `await import`, and a
    // module loaded for the first time takes real time the fake clock does
    // not wait for: loaded here, the timeline below is the pass's own.
    await import("@/lib/site-profile");
    await import("@/lib/site-issues");
    llmScraper.mockImplementation(
      stillQueueing((failure) => {
        const onFailure = (llmScraper.mock.calls.at(-1) as unknown as [unknown, { onFailure?: (f: unknown) => void }])[1]
          .onFailure;
        onFailure?.(failure);
      })
    );

    vi.useFakeTimers();
    try {
      const startedMs = Date.now();
      // Stamped the instant the pass settles, not after the clock has been
      // run forward: what is being asserted is when it ended, and
      // `advanceTimersByTimeAsync` moves the clock whether it ended or not.
      let settledMs = -1;
      const pass = runScan({ domain: DOMAIN, siteId: "site-902", tier: "deep" }).then((result) => {
        settledMs = Date.now();
        return result;
      });
      await vi.advanceTimersByTimeAsync(TIMING.jobsCeilingS * 1000);
      await pass;
      const elapsedMs = settledMs - startedMs;

      const report = storedReport();
      expect(report.stoppedReason).toBe("time_ceiling");
      expect(report.complete).toBe(false);
      // The whole reason issue 855 chose the figure it did: the pass ends
      // with room left in the invocation to compose and store what it has.
      expect(elapsedMs).toBeLessThan(TIMING.jobsCeilingS * 1000);
      // It stopped because its own ceiling arrived, not because the clock
      // ran out of the test's patience.
      expect(elapsedMs).toBeGreaterThanOrEqual(CEILING_MS);
      // And the report is there, with a slot for every question.
      expect(report.serps).toHaveLength(BATTERY_PINS.QUESTIONS);
    } finally {
      vi.useRealTimers();
    }
  });

  it("buys the slow engine once, not once per question: an ask that wins its turn past the ceiling buys nothing", async () => {
    await import("@/lib/site-profile");
    await import("@/lib/site-issues");
    llmScraper.mockImplementation(stillQueueing());

    vi.useFakeTimers();
    try {
      const pass = runScan({ domain: DOMAIN, siteId: "site-902", tier: "deep" });
      await vi.advanceTimersByTimeAsync(TIMING.jobsCeilingS * 1000);
      await pass;

      // One ask spent the whole ceiling. The eleven behind it waited their
      // turn on an engine that has not answered yet (issue 869) and found
      // the ceiling fired when their turn came: nothing more is bought.
      expect(llmScraper).toHaveBeenCalledTimes(1);
      // And the second engine is never reached either — `stopNow()` is
      // read before it, as §6.5 requires between every call.
      expect(aiMode).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hands its own remaining time to every call that can wait inside itself", async () => {
    await runScan({ domain: DOMAIN, siteId: "site-902", tier: "deep" });

    const startedAtMost = Date.now() + CEILING_MS;
    const deadlines = [...serpOrganic.mock.calls, ...aiMode.mock.calls, ...llmScraper.mock.calls].map(
      (call) => (call as unknown as [unknown, { untilMs?: number }])[1].untilMs
    );
    expect(deadlines).toHaveLength(BATTERY_PINS.QUESTIONS * 3);
    for (const until of deadlines) {
      expect(until).toBeTypeOf("number");
      expect(until as number).toBeLessThanOrEqual(startedAtMost);
    }
  });
});

describe("what a twelve-question pass costs when nothing goes wrong", () => {
  it("asks each question once on each engine — three calls a question, never a second round", async () => {
    await runScan({ domain: DOMAIN, siteId: "site-902", tier: "deep" });

    expect(serpOrganic).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);
    expect(llmScraper).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);
    expect(aiMode).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);

    const asked = llmScraper.mock.calls.map((call) => (call as unknown as [unknown, { query: string }])[1].query);
    expect(new Set(asked).size).toBe(BATTERY_PINS.QUESTIONS);
    expect(storedReport().stoppedReason).toBe("complete");
  });
});
