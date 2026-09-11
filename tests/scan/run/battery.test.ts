// tests/scan/run/battery.test.ts — issue #128, BUILD §6.2 / §6.3 / §6.5.
//
// §6.2: "Paid weekly battery: **ChatGPT std + AI Mode std + AI-Overview
// piggyback = 2.9¢/week**", and, two paragraphs above it, "The free path
// makes **zero** AI Optimization API calls."
//
// The mutations this suite exists to kill:
//
//  - buying the battery on the free path (money spent against a written
//    promise, and the one rule §6.1 restates on the price row itself);
//  - buying it with `if (tier !== 'free')` rather than through the
//    parameter table (`tier.test.ts` owns the source half; this owns the
//    behavioural one);
//  - asking the second engine without re-reading the ceilings — §6.5's
//    "`capHit()` is re-checked between calls in any multi-call step",
//    which is now three calls per question, not one;
//  - letting an engine that raised take the pass down, or turning it into
//    `no_answer`, which reads as "the engine answered and named nobody";
//  - dropping the answers on the floor, which is what made the battery
//    unbuyable before this issue: nothing rendered them.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStages, fakeDb } from "./harness";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import { PRICE_BOOK, BATTERY as BATTERY_PINS } from "../../../src/lib/config/constants";
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

const { runScan, TIER_PARAMETERS } = await import("../../../src/lib/scan/run");

const RUN_SOURCE = readFileSync(path.resolve(import.meta.dirname, "../../../src/lib/scan/run.ts"), "utf8");

const CLAIMED_ID = "33333333-3333-4333-8333-333333333333";
const DOMAIN = "example.com";

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
  homeRefusal: null,
};

/** §6.1's `QUESTIONS` pin: the twelve a real pass asks. Written from the
 *  pin, not from the literal 12, so the suite follows the price book. */
const TWELVE = Array.from({ length: BATTERY_PINS.QUESTIONS }, (_, i) => ({
  ...QUESTION,
  id: `q${i}`,
  search: { ...SELECTED, keyword: `best onboarding software ${i}` },
}));

const answered = (cited: string[]): AiAnswer => ({ answered: true, text: "…", citedDomains: cited });

/** The report the pass stored, for the run under test. */
function storedReport(): StoredReport {
  const call = storeCurrentReport.mock.calls.at(-1) as unknown as [{ report: StoredReport }];
  return call[0].report;
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

describe("§6.2 — the free path makes zero AI Optimization API calls", () => {
  it("battery/free-buys-neither-engine", async () => {
    await runScan({ domain: DOMAIN, tier: "free" });
    expect(serpOrganic).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);
    expect(llmScraper).not.toHaveBeenCalled();
    expect(aiMode).not.toHaveBeenCalled();
  });

  it("battery/free-stores-two-columns-that-say-nobody-asked — never a miss", async () => {
    await runScan({ domain: DOMAIN, tier: "free" });
    const rows = storedReport().aiAnswers?.rows ?? [];
    expect(rows).toHaveLength(BATTERY_PINS.QUESTIONS);
    for (const row of rows) {
      expect(row.engines.map((e) => e.engine)).toEqual(["ai_overview", "ai_mode", "chatgpt"]);
      expect(row.engines[1]?.cell).toEqual({ kind: "unmeasured", reason: "not_attempted" });
      expect(row.engines[2]?.cell).toEqual({ kind: "unmeasured", reason: "not_attempted" });
    }
  });

  it("battery/is-a-tier-parameter — false on free, true on both paid tiers", () => {
    expect(TIER_PARAMETERS.free.battery).toBe(false);
    expect(TIER_PARAMETERS.deep.battery).toBe(true);
    expect(TIER_PARAMETERS.weekly.battery).toBe(true);
  });
});

describe("§6.2 — the paid battery is bought once per question, both engines", () => {
  it.each(["deep", "weekly"] as const)("battery/%s-buys-chatgpt-and-ai-mode-per-question", async (tier) => {
    await runScan({ domain: DOMAIN, tier });
    expect(llmScraper).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);
    expect(aiMode).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);
    for (const [index, question] of TWELVE.entries()) {
      expect((llmScraper.mock.calls[index] as unknown as [unknown, { query: string }])[1].query).toBe(
        question.search.keyword
      );
      expect((aiMode.mock.calls[index] as unknown as [unknown, { query: string }])[1].query).toBe(
        question.search.keyword
      );
    }
  });

  it("battery/chatgpt-has-no-live-variant-to-choose", async () => {
    for (const tier of ["deep", "weekly"] as const) {
      vi.clearAllMocks();
      db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
      await runScan({ domain: DOMAIN, tier });
      for (const call of llmScraper.mock.calls) {
        expect((call as unknown as [unknown, { mode: string }])[1].mode).toBe("std");
      }
    }
  });

  it("battery/ai-mode-follows-the-pass's-own-serp-mode — live where a human waits, std on the queue", async () => {
    for (const [tier, mode] of [
      ["deep", "live"],
      ["weekly", "std"],
    ] as const) {
      vi.clearAllMocks();
      db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
      await runScan({ domain: DOMAIN, tier });
      for (const call of aiMode.mock.calls) {
        expect((call as unknown as [unknown, { mode: string }])[1].mode).toBe(mode);
      }
    }
  });

  it("battery/the-answers-reach-the-blob's-engine-columns", async () => {
    await runScan({ domain: DOMAIN, tier: "weekly" });
    const rows = storedReport().aiAnswers?.rows ?? [];
    expect(rows).toHaveLength(BATTERY_PINS.QUESTIONS);
    for (const row of rows) {
      expect(row.engines[1]?.cell).toEqual({
        kind: "answered",
        citedDomains: ["appcues.com"],
        namesCustomer: false,
      });
      expect(row.engines[2]?.cell).toEqual({
        kind: "answered",
        citedDomains: ["example.com"],
        namesCustomer: true,
      });
    }
  });

  it("battery/no-engine-prose-reaches-the-blob", async () => {
    llmScraper.mockResolvedValue(
      measured({ answered: true, text: "Example is the best onboarding tool.", citedDomains: [] }, AT)
    );
    await runScan({ domain: DOMAIN, tier: "weekly" });
    expect(JSON.stringify(storedReport())).not.toContain("the best onboarding tool");
  });
});

describe("§6.5 — degradation, never a throw, and the ceilings between every call", () => {
  it("battery/an-engine-that-raised-is-undeterminable-and-does-not-stop-the-other", async () => {
    llmScraper.mockRejectedValue(new Error("the scraper returned something unreadable"));
    const { status } = await runScan({ domain: DOMAIN, tier: "weekly" });

    expect(status).toBe("done");
    expect(aiMode).toHaveBeenCalledTimes(BATTERY_PINS.QUESTIONS);
    const rows = storedReport().aiAnswers?.rows ?? [];
    for (const row of rows) {
      expect(row.engines[2]?.cell).toEqual({ kind: "unmeasured", reason: "undeterminable" });
      expect(row.engines[1]?.cell.kind).toBe("answered");
    }
  });

  it("battery/an-engine-that-refused-passes-its-own-arm-through — a cap hit is not a throw", async () => {
    // What `recordFetch`'s `{ skipped: 'cap' }` arm surfaces as at the
    // vendor: a `Measured` that says the call was not attempted.
    aiMode.mockResolvedValue(unmeasured<AiAnswer>("not_attempted", AT));
    const { status } = await runScan({ domain: DOMAIN, tier: "weekly" });
    expect(status).toBe("done");
    const rows = storedReport().aiAnswers?.rows ?? [];
    for (const row of rows) {
      expect(row.engines[1]?.cell).toEqual({ kind: "unmeasured", reason: "not_attempted" });
    }
  });

  it("battery/the-ceilings-are-re-read-before-each-engine — §6.5's multi-call rule", () => {
    // Behavioural coverage cannot reach this: the vendors are doubles
    // here, so nothing is ledgered and no cap can fire. The rule is that
    // the *step* re-reads, and that is what the source says — one
    // `stopNow()` before each of the two engines, inside the function that
    // asks them, and neither hoisted out of the loop above it.
    const body = RUN_SOURCE.slice(
      RUN_SOURCE.indexOf("async function askTheBattery"),
      RUN_SOURCE.indexOf("async function engineAnswer")
    );
    expect(body).not.toBe("");
    expect(body.match(/bounds\.stopNow\(\)/g) ?? []).toHaveLength(2);
    expect(body).toMatch(/llmScraper\(/);
    expect(body).toMatch(/aiMode\(/);
  });

  it("battery/the-two-parallel-records-stay-the-same-length-as-the-twelve", async () => {
    // A ceiling that stopped the pass mid-battery must leave `serps` and
    // `battery` the same length, or the card pairs the wrong question with
    // the wrong answer. Asserted over a completed pass here and held by
    // the one `push` per iteration on each side.
    await runScan({ domain: DOMAIN, tier: "weekly" });
    const report = storedReport();
    expect(report.serps).toHaveLength(BATTERY_PINS.QUESTIONS);
    expect(report.aiAnswers?.rows).toHaveLength(BATTERY_PINS.QUESTIONS);
  });

  it("battery/the-whole-pass-still-stores-a-report-when-both-engines-fail", async () => {
    llmScraper.mockRejectedValue(new Error("no answer"));
    aiMode.mockRejectedValue(new Error("no answer"));
    const { status } = await runScan({ domain: DOMAIN, tier: "weekly" });
    expect(status).toBe("done");
    expect(storeCurrentReport).toHaveBeenCalledTimes(1);
    expect(storedReport().aiAnswers?.rows).toHaveLength(BATTERY_PINS.QUESTIONS);
  });

  it("battery/an-engine-that-answered-nothing-is-no_answer-and-not-a-miss", async () => {
    aiMode.mockResolvedValue(measuredZero({ answered: false, text: "", citedDomains: [] } as AiAnswer, AT));
    await runScan({ domain: DOMAIN, tier: "weekly" });
    for (const row of storedReport().aiAnswers?.rows ?? []) {
      expect(row.engines[1]?.cell).toEqual({ kind: "no_answer" });
    }
  });

  it("battery/never-moves-the-three-rendered-counts", async () => {
    // Every engine names the customer; the card's own citation count is
    // Google's alone and does not move. The three-column visual is the
    // design decision that would change these figures.
    llmScraper.mockResolvedValue(measured(answered(["example.com"]), AT));
    aiMode.mockResolvedValue(measured(answered(["example.com"]), AT));
    await runScan({ domain: DOMAIN, tier: "weekly" });
    const section = storedReport().aiAnswers;
    expect(section?.customerCitations).toBe(0);
    expect(section?.answeredSearches).toBe(BATTERY_PINS.QUESTIONS);
  });
});

describe("§6.3 — a weekly pass's ledgered cost is the ~8¢ the dataset list states", () => {
  it("battery/weekly-cost-composes-to-about-eight-cents-against-the-price-book", async () => {
    await runScan({ domain: DOMAIN, tier: "weekly" });

    // Counted from the calls the pass actually made, priced from §6.1's
    // pins — never from a number typed here.
    const serps = serpOrganic.mock.calls.length * PRICE_BOOK.SERP_STD_C;
    const battery =
      llmScraper.mock.calls.length * PRICE_BOOK.CHATGPT_SCRAPE_STD_C +
      aiMode.mock.calls.length * PRICE_BOOK.AI_MODE_STD_C;
    // §6.3's weekly line, the part `measureDomain` buys and this suite
    // mocks: "`ranked_keywords`@300 (user)". Everything else on that line
    // is monthly and sits inside its own cache window in a steady-state
    // week (`suggestions ×2`, `competitors_domain`, `@100 ×rivals`).
    const ranked = PRICE_BOOK.RANKED_PAID_COST_C;

    // §6.2's own figure for the battery: "ChatGPT std + AI Mode std +
    // AI-Overview piggyback = 2.9¢/week". The piggyback is the third
    // column and costs nothing extra — it rides the SERPs above.
    // 12 × CHATGPT_SCRAPE_STD_C + 12 × AI_MODE_STD_C = 12 × 0.12 + 12 × 0.12.
    // It was 2.16 while AI Mode std was mis-pinned at 0.06 (#381).
    expect(battery).toBeCloseTo(2.88, 2);

    // §6.3: "**weekly refresh ~8¢** standard".
    const weekly = ranked + serps + battery;
    expect(weekly).toBeGreaterThan(7);
    expect(weekly).toBeLessThan(9);

    // And the battery is what makes that figure right: without it the
    // week costs the SERPs alone, which is the gap #128 exists to close.
    expect(weekly - battery).toBeLessThan(6);
  });
});
