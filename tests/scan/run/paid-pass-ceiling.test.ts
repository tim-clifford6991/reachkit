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
// and its AI Mode answers the same way.
//
// Issue 1160: those three asks used to queue behind one another, a SERP's
// wait and then each engine's, and an engine that had not answered yet was
// asked one question at a time (issue 869). The weekly passes of 2026-09-21
// and 2026-09-28 spent their whole ceiling waiting and never measured AI
// answers or rivals. A question's three asks now wait together.
//
// The mutations this suite exists to kill:
//
//  - a pass that runs past `jobsCeilingS` instead of ending on
//    `time_ceiling` — the frozen invocation that stores no report, leaves
//    the claimed row `running`, and has its step retried, which is where
//    twelve questions come to buy more than twelve questions' worth;
//  - dropping the pass's deadline on the way into any of the three calls a
//    question costs, so the bound is declared and never applied;
//  - asking a question more times than its three columns need;
//  - a slow engine costing the other engine's column;
//  - a weekly pass at production's measured queue waits missing its ceiling.
//
// Issue 1566: the timed passes run on a fake clock, and a module the pass
// loads for the first time takes real time that clock does not wait for. On
// a loaded box that real time let the clock run to `jobsCeilingS` while the
// pass was still loading, and the weekly pass failed one run in two. Each
// timed pass is now run once on the real clock first, so the one on the fake
// clock loads nothing; one module here is slowed, as a loaded box slows it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStages, fakeDb } from "./harness";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import { BATTERY as BATTERY_PINS, BUYER_SEARCHES, CAPS, TIMING, TYPING_RESERVE_C, VENDOR } from "../../../src/lib/config/constants";
import type { CostContext } from "../../../src/lib/costs";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { StoredReport } from "../../../src/lib/scan/report";
import type { AiAnswer } from "../../../src/lib/vendors/dataforseo/types";
import { AT, ON_PAGE, PROFILE, ROBOTS, SERP, SELECTED, QUESTION } from "../report/fixtures";
import { readFileSync } from "node:fs";
import type { MarketConclusion } from "../../../src/lib/market/infer/types";
import type { CanonicalDomain } from "../../../src/lib/scan/domain";
import type { SerpResult } from "../../../src/lib/vendors/dataforseo/types";
import { question, reportOf, search, SITE_ID } from "../../opportunities/fixtures";
import { memoryStore, newMemoryState } from "../../opportunities/memory-store";
import { toolUseMessage } from "../../llm/fixtures";
import { rowOf, type StoredTopic } from "../../golden/plan/panel";

// A module the weekly pass loads late, slowed to 300 ms of real time as a
// loaded box slows a first load (issue 1566). A timed pass that loads it on
// the fake clock ends on `time_ceiling`.
const realSetTimeout = vi.hoisted(() => globalThis.setTimeout);
vi.mock("@/lib/publish/destinations/hosted/store", async (importOriginal) => {
  await new Promise((resolve) => realSetTimeout(resolve, 300));
  return importOriginal();
});

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
const rankedKeywords = vi.fn();
vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/vendors/dataforseo")>()),
  serpOrganic: (...a: unknown[]) => serpOrganic(...a),
  aiMode: (...a: unknown[]) => aiMode(...a),
  llmScraper: (...a: unknown[]) => llmScraper(...a),
  rankedKeywords: (...a: unknown[]) => rankedKeywords(...a),
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

const anthropicCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: (...a: unknown[]) => anthropicCreate(...a) };
  },
}));

const { runScan } = await import("../../../src/lib/scan/run");
const { withStoredPassSpend } = await import("../../../src/lib/scan/ceilings");
const { deriveForPass } = await import("../../../src/lib/opportunities/pass");
const { setOpportunityStore } = await import("../../../src/lib/opportunities/store");

/** One site of a stored panel run, as far as this suite reads it. */
interface PanelRun {
  site: { domain: string };
  market: MarketConclusion;
  searches: string[];
  prompts: { text: string }[];
  topics?: { query: string; fit: number | null }[];
}

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
  locale: { country: "US", language: "en" },
  localeFellBack: null,
  homeRefusal: null,
};

const TWELVE = Array.from({ length: BATTERY_PINS.QUESTIONS }, (_, i) => ({
  ...QUESTION,
  id: `q${i}`,
  search: { ...SELECTED, keyword: `best onboarding software ${i}` },
}));

const answered = (cited: string[]): AiAnswer => ({ answered: true, text: "…", citedDomains: cited });

/**
 * The pass, once on the real clock with every vendor answering at once, so
 * each module it reaches through `await import` is loaded before a test
 * fakes the clock. Its calls and queries are then forgotten: the pass a test
 * asserts on is the one it runs next.
 */
async function loadedOnce(args: Parameters<typeof runScan>[0]): Promise<void> {
  await runScan(args);
  vi.clearAllMocks();
  db.queries.length = 0;
}

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

/** A site whose market yields the full set of 25 tracked prompts. */
const SITE_WITH_A_MARKET = {
        domain: DOMAIN,
        category: "user onboarding software",
        competitors: [],
        tracked_prompts: null,
        market: {
          current: {
            category: "user onboarding software",
            synonyms: ["product tours", "onboarding checklists", "in-app guidance"],
            buyer: "Product teams who ship SaaS",
            job: "Get their new users to the first win",
            rivals: [
              { domain: "appcues.com", name: "Appcues", basis: "ranks", reason: "" },
              { domain: "userpilot.com", name: "Userpilot", basis: "ranks", reason: "" },
              { domain: "pendo.io", name: "Pendo", basis: "ranks", reason: "" },
            ],
          },
        },
      };

let stages: { lines: string[]; restore: () => void };

beforeEach(() => {
  vi.clearAllMocks();
  anthropicCreate.mockReset();
  anthropicCreate.mockRejectedValue(new Error("no model in this suite"));
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  measureDomain.mockResolvedValue(MEASUREMENT);
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  deriveMarketSet.mockResolvedValue(measured([{ keyword: SELECTED.keyword, volume: SELECTED.volume }], AT));
  phraseQuestions.mockResolvedValue(measured(TWELVE, AT));
  serpOrganic.mockResolvedValue(measured(SERP, AT));
  aiMode.mockResolvedValue(measured(answered(["appcues.com"]), AT));
  llmScraper.mockResolvedValue(measured(answered(["example.com"]), AT));
  rankedKeywords.mockResolvedValue(
    measured({ rows: [{ keyword: "k0", position: 1, searchVolume: 10, url: "https://appcues.com/" }], total: 40 }, AT)
  );
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "done" as const,
  }));
  stages = captureStages();
});

afterEach(() => {
  stages.restore();
  setOpportunityStore(null);
});

describe("a paid pass whose engine is slower than its ceiling (issue 902)", () => {
  it("stops waiting before its ceiling and ends `complete`, the slow engine's cells unmeasured (#1195)", async () => {
    await loadedOnce({ domain: DOMAIN, siteId: "site-902", tier: "deep" });
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
      // Production 2026-10-02: a 207 s ChatGPT queue ran a re-measure into
      // its ceiling after one question. The asks now stop waiting
      // `paidPassAskReserveS` before it, and the pass scores what came back.
      expect(report.stoppedReason).toBe("complete");
      expect(elapsedMs).toBeLessThan(CEILING_MS);
      const chatgpt = (report.aiAnswers?.rows ?? []).map((row) => row.engines.find((e) => e.engine === "chatgpt")?.cell.kind);
      expect(chatgpt).toHaveLength(BATTERY_PINS.QUESTIONS);
      expect(chatgpt.every((kind) => kind !== "answered")).toBe(true);
      expect(report.serps).toHaveLength(BATTERY_PINS.QUESTIONS);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a slow engine never costs the other engine its column: AI Mode answers every question", async () => {
    await loadedOnce({ domain: DOMAIN, siteId: "site-902", tier: "deep" });
    llmScraper.mockImplementation(stillQueueing());

    vi.useFakeTimers();
    try {
      const pass = runScan({ domain: DOMAIN, siteId: "site-902", tier: "deep" });
      await vi.advanceTimersByTimeAsync(TIMING.jobsCeilingS * 1000);
      await pass;

      // Each engine is asked once per question and never twice.
      expect(llmScraper).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);
      expect(aiMode).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);
      const modes = (storedReport().aiAnswers?.rows ?? []).map((row) => row.engines[1]?.cell.kind);
      expect(modes).toHaveLength(BATTERY_PINS.QUESTIONS);
      expect(modes.every((kind) => kind === "answered")).toBe(true);
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

/** A standard-queue ask that answers after `waitS`, polled the way the
 *  vendor seam polls (`VENDOR.stdQueuePollIntervalS`). */
function answersAfter<T>(waitS: number, value: T) {
  return async () => {
    const polls = Math.ceil(waitS / VENDOR.stdQueuePollIntervalS);
    for (let i = 0; i < polls; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, VENDOR.stdQueuePollIntervalS * 1000));
    }
    return value;
  };
}

describe("the weekly pass at production's measured queue waits (issue 1160)", () => {
  // The slowest answered ask of each kind on the two weekly passes that
  // stopped on `time_ceiling` (`fetches.duration_ms`, scans c74551df and
  // eece5dd1): a question SERP 177 s, ChatGPT 166 s, AI Mode 187 s. Asked
  // one after another, a question cost more than the 240 s ceiling. Asked
  // together, it costs the slowest of the three.
  //
  // Owner D19 final (issue 1162) and B2 (2026-10-19): the weekly pass asks
  // the site's 23 unbranded prompts once and its 2 branded prompts twice on
  // both engines, all at once beside the twelve, and the twelve keep their
  // Google searches alone. Fifty-four asks cost the pass the same wait as one.
  it("ends `complete` inside its ceiling, an unbranded prompt asked once and a branded one twice on both engines, and its rivals sized", async () => {
    db.rows.set("sites", [SITE_WITH_A_MARKET]);
    await loadedOnce({ domain: DOMAIN, siteId: "site-1160", tier: "weekly" });
    serpOrganic.mockImplementation(answersAfter(177, measured(SERP, AT)));
    llmScraper.mockImplementation(answersAfter(166, measured(answered(["example.com"]), AT)));
    aiMode.mockImplementation(answersAfter(187, measured(answered(["appcues.com"]), AT)));

    vi.useFakeTimers();
    try {
      const startedMs = Date.now();
      let settledMs = -1;
      const pass = runScan({ domain: DOMAIN, siteId: "site-1160", tier: "weekly" }).then((result) => {
        settledMs = Date.now();
        return result;
      });
      await vi.advanceTimersByTimeAsync(TIMING.jobsCeilingS * 1000);
      await pass;

      const report = storedReport();
      expect(report.stoppedReason).toBe("complete");
      expect(settledMs - startedMs).toBeLessThan(CEILING_MS);
      const rows = report.aiAnswers?.rows ?? [];
      expect(rows).toHaveLength(BATTERY_PINS.QUESTIONS);
      for (const row of rows) {
        expect(row.engines.map((engine) => engine.cell.kind)).toEqual(["answered", "unmeasured", "unmeasured"]);
      }
      // The set was built from the market and stored with the site; each
      // run of a prompt was asked under its own key.
      const stored = db.queries.find((q) => q.table === "sites" && q.verb === "update" && q.values?.tracked_prompts !== undefined);
      const set = (stored?.values?.tracked_prompts as { prompts: { text: string; kind: string }[] }).prompts;
      expect(set).toHaveLength(25);
      expect(report.prompts?.asked).toHaveLength(25);
      expect(report.prompts?.asks).toBe(54);
      expect(report.prompts?.answers).toHaveLength(54);
      expect(llmScraper).toHaveBeenCalledTimes(27);
      expect(aiMode).toHaveBeenCalledTimes(27);
      const branded = new Set(set.filter((p) => p.kind === "branded").map((p) => p.text));
      expect(branded.size).toBe(2);
      for (const engine of [llmScraper, aiMode]) {
        const asks = (engine.mock.calls as unknown as [unknown, { query: string; run?: number }][]).map((call) => call[1]);
        expect(asks.filter((ask) => ask.run === 1)).toHaveLength(25);
        // Only the two branded prompts get a second run.
        expect(new Set(asks.filter((ask) => ask.run === 2).map((ask) => ask.query))).toEqual(branded);
        expect(asks.filter((ask) => ask.run === 2)).toHaveLength(2);
      }
      // ChatGPT cited the site in every answer; AI Mode cited a rival.
      const chatgpt = report.prompts?.answers.filter((answer) => answer.engine === "chatgpt") ?? [];
      expect(chatgpt.every((answer) => answer.linked)).toBe(true);
      const mode = report.prompts?.answers.filter((answer) => answer.engine === "ai_mode") ?? [];
      expect(mode.every((answer) => !answer.linked && answer.rivals.includes("appcues.com"))).toBe(true);
      // Scoring was reached and sized the domains the twelve's top tens hold.
      expect(rankedKeywords).toHaveBeenCalled();
      expect(report.rivalSizes.kind).not.toBe("unmeasured");
    } finally {
      vi.useRealTimers();
    }
  });
});

// Owner W1: a weekly pass whose searches alone would spend its whole cap
// stops them short of the typing reserve, so the typing after the stored
// report is still paid for, and the pass never spends past the cap.
describe("a weekly pass whose measurement would spend its whole cap", () => {
  it("stops its stages at the cap less the reserve and leaves the reserve for the typing", async () => {
    // Each search is ledgered through the pass's own cost context; twelve would cost more than the cap.
    const serpCents = 4;
    serpOrganic.mockImplementation(async (c: CostContext, call: { keyword: string }) => {
      const spent = await c.recordFetch({
        source: "serpOrganic",
        cacheKey: `serp:${call.keyword}`,
        freshnessDays: 0,
        costCents: serpCents,
        run: async () => measured(SERP, AT),
      });
      return "skipped" in spent ? unmeasured<typeof SERP>("not_attempted", AT) : spent.payload;
    });
    // The close's roll-up is what the context after the stored report opens on.
    db.answer = (query) => {
      if (query.table !== "scans" || query.verb !== "select") return null;
      const closed = db.queries.filter((q) => q.table === "scans" && q.verb === "update" && q.values?.cost_cents !== undefined).at(-1);
      return [{ id: CLAIMED_ID, fromIncompleteRescan: false, cost_cents: closed?.values?.cost_cents ?? 0 }];
    };

    const typing: { openedAt?: number; capHit?: boolean } = {};
    await runScan({
      domain: DOMAIN,
      siteId: "site-1719",
      tier: "weekly",
      afterReport: async ({ cost }) => {
        typing.openedAt = cost.spentCents();
        typing.capHit = cost.capHit();
      },
    });

    expect(serpOrganic).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);
    expect(typing.openedAt).toBeLessThanOrEqual(CAPS.WEEKLY_C - TYPING_RESERVE_C);
    expect(typing.capHit).toBe(false);
  });

  it("the derivation after the stored report, opened at the line, gets every call it makes and closes inside the cap", async () => {
    // The panel run whose fit judgement cost the most: the German bakery, its own market, searches and SERPs.
    const RUN = "2026-10-10-1374";
    const site = (JSON.parse(readFileSync(`docs/walk/panel/${RUN}.json`, "utf8")) as { sites: PanelRun[] }).sites[0]!;
    const evidence: { source: string; cache_key: string; payload: SerpResult[] | null }[] = JSON.parse(
      readFileSync(`scripts/panel/evidence/${site.site.domain}.json`, "utf8")
    );
    const serpOf = (keyword: string): SerpResult =>
      evidence.find((row) => row.source === "serp/google/organic" && row.cache_key.split("|")[0] === keyword)?.payload?.[0] ??
      { organic: [], aiOverview: { present: false, referenceDomains: [], asynchronousAiOverview: false } };
    const fitOf = new Map((site.topics ?? []).map((topic) => [topic.query, topic.fit ?? 2]));
    const serps = site.searches.map(serpOf);
    // The run did not store its rival sizes; the top tens' domains are sized small, as a city's bakeries rank.
    const rivalSizes = measured(
      [...new Set(serps.flatMap((one) => one.organic.map((row) => row.domain)))].map((domain) => ({
        domain,
        state: "sized" as const,
        rankedCount: 40,
        countIs: "total" as const,
        band: "near" as const,
        at: AT,
        current: true,
      })),
      AT
    );
    const report: StoredReport = {
      ...reportOf(
        {
          questions: site.searches.map((keyword, n) =>
            question({ id: `q${n}`, text: keyword, search: search({ keyword, volume: 50 + n }) })
          ),
          serps,
        },
        { rivalSizes }
      ),
      domain: site.site.domain as CanonicalDomain,
    };
    // What buyers were seen asking beside those searches is what the model writes back as their searches.
    const phrased = [...new Set(serps.flatMap((one) => [...(one.peopleAlsoAsk ?? []), ...(one.relatedSearches ?? [])]))];
    // The topics the run held stay open and unjudged, so the fit judges them again beside this pass's.
    const state = newMemoryState({
      rows: (site.topics ?? []).map((topic, n) => ({ ...rowOf(site.site.domain, { ...topic, ready: false } as StoredTopic, n), site_id: SITE_ID, business_fit: null })),
    });
    setOpportunityStore({
      ...memoryStore(state),
      marketFor: async () => ({ market: site.market, competitors: [], prompts: site.prompts.map((p) => p.text), knowledge: null }),
    });
    // The model answers every call in the shape its site asks for, and reports the tokens it was sent.
    anthropicCreate.mockImplementation(async (request: { tools?: { name: string }[]; messages: { content: string }[] }) => {
      const name = request.tools?.[0]?.name ?? "";
      const sent = request.messages[0]!.content;
      const input = JSON.parse(sent) as { searches?: { i: number; search: string }[]; derivedType?: string; derivedSlug?: string; targetQuery?: string };
      const searches = input.searches ?? [];
      const answers: Record<string, [unknown, number]> = {
        "topic-buyer-searches": [{ problems: phrased.slice(0, BUYER_SEARCHES.max), solutions: phrased.slice(BUYER_SEARCHES.max, 2 * BUYER_SEARCHES.max) }, 400],
        "topic-typed": [{ typed: searches.map((entry) => entry.i) }, 80],
        "topic-fit": [
          { scores: searches.map((entry) => ({ i: entry.i, fit: fitOf.get(entry.search) ?? 2, title: entry.search })), strongest: [] },
          40 * searches.length,
        ],
        "opportunity-typing": [{ type: input.derivedType, slug: input.derivedSlug, title: input.targetQuery }, 60],
        "topic-same-question": [{ pairs: [] }, 20],
      };
      const [answer, tokensOut] = answers[name] ?? [{}, 10];
      return toolUseMessage(answer, Math.ceil(sent.length / 4), tokensOut, name);
    });

    const refused = vi.spyOn(console, "warn").mockImplementation(() => {});
    const line = CAPS.WEEKLY_C - TYPING_RESERVE_C;
    db.answer = (query) => (query.table === "scans" && query.verb === "select" ? [{ cost_cents: line, site_id: null }] : null);
    const closed = await withStoredPassSpend({ scanId: CLAIMED_ID, cap: "WEEKLY" }, async (cost) => {
      await deriveForPass(cost, { tier: "weekly", siteId: SITE_ID, report, hasActiveAccess: true });
      return cost.spentCents();
    });
    const warned = refused.mock.calls.map(([first]) => String(first));
    refused.mockRestore();

    const asked = new Map<string, string[]>();
    for (const [first] of vi.mocked(console.log).mock.calls) {
      const line = typeof first === "string" && first.startsWith("{") ? (JSON.parse(first) as { site?: string; parseOutcome?: string }) : {};
      if (line.site !== undefined && line.parseOutcome !== undefined) asked.set(line.site, [...(asked.get(line.site) ?? []), line.parseOutcome]);
    }
    for (const site of ["topic-buyer-searches", "topic-typed", "topic-fit", "opportunity-typing"]) {
      expect(asked.get(site)?.length ?? 0, site).toBeGreaterThan(0);
      expect(asked.get(site)!.every((outcome) => outcome === "success"), site).toBe(true);
    }
    expect(warned.filter((line) => line.includes('"cap_hit"'))).toEqual([]);
    expect(closed).toBeLessThanOrEqual(CAPS.WEEKLY_C);
  });
});

describe("Measure again now asks the tracked prompts too (owner, 2026-10-03, issue 1162)", () => {
  it("a re-measure stores the full set's answers, each day its own sample; the onboarding pass asks none", async () => {
    db.rows.set("sites", [SITE_WITH_A_MARKET]);
    await runScan({ domain: DOMAIN, siteId: "site-1162", tier: "deep", asksTrackedPrompts: true });

    const report = storedReport();
    expect(report.stoppedReason).toBe("complete");
    expect(report.prompts?.asked).toHaveLength(25);
    expect(report.prompts?.answers).toHaveLength(54);
    // The deep pass's own battery on the twelve, and the set beside it.
    expect(llmScraper).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS + 27);
    const tracked = (aiMode.mock.calls as unknown as [unknown, { asOf?: string; mode: string }][])
      .map((call) => call[1])
      .filter((call) => call.asOf !== undefined);
    expect(tracked).toHaveLength(27);
    // The standard queue, as the weekly pass asks them, and keyed by day.
    expect(tracked.every((call) => call.mode === "std" && /^\d{4}-\d{2}-\d{2}$/.test(call.asOf ?? ""))).toBe(true);

    vi.clearAllMocks();
    db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
    storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
      scanId: a.report.scanId,
      status: "done" as const,
    }));
    await runScan({ domain: DOMAIN, siteId: "site-1162", tier: "deep" });
    expect(storedReport().prompts).toBeUndefined();
    expect(llmScraper).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);
  });
});

describe("a pass with a period of its own is served nothing read before it (issue 1170)", () => {
  it("narrows the own reads and the twelve's SERPs to the time since the period began", async () => {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    await runScan({ domain: DOMAIN, siteId: "site-1170", tier: "deep", measuredSince: sixHoursAgo });

    const own = (measureDomain.mock.calls[0] as unknown as [unknown, { ownWindowDays?: number }])[1].ownWindowDays;
    expect(own).toBeGreaterThan(0.24);
    expect(own).toBeLessThan(0.26);
    const serpWindows = serpOrganic.mock.calls.map(
      (call) => (call as unknown as [unknown, { freshnessDays: number }])[1].freshnessDays
    );
    expect(serpWindows).toHaveLength(BATTERY_PINS.QUESTIONS);
    expect(serpWindows.every((days) => days === own)).toBe(true);
  });

  it("a pass with no period keeps its tier's windows", async () => {
    await runScan({ domain: DOMAIN, siteId: "site-1170", tier: "deep" });
    expect((measureDomain.mock.calls[0] as unknown as [unknown, object])[1]).not.toHaveProperty("ownWindowDays");
  });
});
