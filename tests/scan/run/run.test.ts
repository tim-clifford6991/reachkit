// tests/scan/run/run.test.ts — issue #25.
//
// The pipeline, with every callee doubled at its module boundary. What
// this suite decides: the stage order and its boundaries, both ceilings
// giving back what was measured, the free path adopting the claim it was
// started under, the seven-day window, the correction's one allowance, and
// that a stage that raises degrades rather than failing the pass.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStages, fakeDb } from "./harness";
import { measured, measuredZero, unmeasured, type Measured } from "../../../src/lib/measure/measured";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { SerpResult } from "../../../src/lib/vendors/dataforseo/types";
import type { StoredReport } from "../../../src/lib/scan/report";
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
vi.mock("@/lib/vendors/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/vendors/dataforseo")>()),
  serpOrganic: (...a: unknown[]) => serpOrganic(...a),
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

const readCorrectionFacts = vi.fn();
const advanceCorrectionState = vi.fn();
const registerCorrectionRunner = vi.fn();
/** Captured at module load, before any `clearAllMocks` — the registration
 *  happens once, when `run.ts` is first imported. */
const registeredAtLoad: unknown[] = [];
vi.mock("@/lib/scan/correction", () => ({
  readCorrectionFacts: (...a: unknown[]) => readCorrectionFacts(...a),
  advanceCorrectionState: (...a: unknown[]) => advanceCorrectionState(...a),
  registerCorrectionRunner: (...a: unknown[]) => {
    registeredAtLoad.push(a[0]);
    return registerCorrectionRunner(...a);
  },
  correctionRunner: () => null,
}));

const { runScan } = await import("../../../src/lib/scan/run");

const RUN_SOURCE = readFileSync(path.resolve(import.meta.dirname, "../../../src/lib/scan/run.ts"), "utf8");

const CLAIMED_ID = "33333333-3333-4333-8333-333333333333";
const DOMAIN = "example.com";

const EVERY_STAGE = [
  "reading_your_site:enter",
  "reading_your_site:done",
  "reading_access_rules:enter",
  "reading_access_rules:done",
  "reading_your_market:enter",
  "reading_your_market:done",
  "checking_your_presence:enter",
  "checking_your_presence:done",
  "asking_the_twelve:enter",
  "asking_the_twelve:done",
  "scoring:enter",
  "scoring:done",
];

function measurement(over: Partial<DomainMeasurement> = {}): DomainMeasurement {
  return {
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
    ...over,
  };
}

/** Twelve selected searches and their questions, so the battery is the
 *  battery §6.2 names and not a shorter one. Every keyword is one the
 *  relevance guard admits against `PROFILE`, because `selectTwelve` is not
 *  doubled here — only the vendor call that feeds it is. */
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
const TWELVE = KEYWORDS.map((keyword, i) => ({ ...SELECTED, keyword, rank: i + 1 }));
const TWELVE_QUESTIONS = TWELVE.map((search, i) => ({ ...QUESTION, id: `q${i + 1}`, search }));

function happyPath(): void {
  measureDomain.mockResolvedValue(measurement());
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  deriveMarketSet.mockResolvedValue(
    measured(
      TWELVE.map((search) => ({ keyword: search.keyword, volume: search.volume })),
      AT
    )
  );
  phraseQuestions.mockResolvedValue(measured(TWELVE_QUESTIONS, AT));
  serpOrganic.mockResolvedValue(measured(SERP, AT) as Measured<SerpResult>);
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "done" as const,
  }));
  readCorrectionFacts.mockResolvedValue(null);
  advanceCorrectionState.mockResolvedValue(true);
}

/** A stored report as the seven-day window reads one: its scan id, whether
 *  it was complete, and the one date the blob has — `verdict.measuredAt`. */
function storedFor(a: { daysAgo: number; complete: boolean }): StoredReport {
  return {
    scanId: "previous-scan",
    complete: a.complete,
    verdict: { measuredAt: new Date(Date.now() - a.daysAgo * 86_400_000) },
  } as unknown as StoredReport;
}

function storedReport(): StoredReport {
  return (storeCurrentReport.mock.calls.at(-1) as unknown as [{ report: StoredReport }])[0].report;
}

let stages: { lines: string[]; restore: () => void };

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  happyPath();
  stages = captureStages();
});

afterEach(() => {
  stages.restore();
});

describe("the six stages", () => {
  it("runs all six in order, entry and exit, for a pass that completes", async () => {
    const result = await runScan({ domain: DOMAIN, tier: "free" });
    expect(stages.lines).toEqual(EVERY_STAGE);
    expect(result).toEqual({ scanId: CLAIMED_ID, status: "done" });
  });

  it("a domain that ranks for nothing runs every stage to completion — cold start branches nothing", async () => {
    measureDomain.mockResolvedValue(
      measurement({
        drivers: {
          foundations: measured(52, AT),
          answerability: measured(38, AT),
          searchPresence: measuredZero(0, AT), // no ranked rows at all
          aiPresence: unmeasured("not_attempted", AT),
        },
      })
    );
    serpOrganic.mockResolvedValue(
      measured({ organic: [], aiOverview: { present: false, asynchronousAiOverview: false, referenceDomains: [] } }, AT)
    );

    await runScan({ domain: DOMAIN, tier: "free" });
    expect(stages.lines).toEqual(EVERY_STAGE);
    const report = storedReport();
    expect(report.stoppedReason).toBe("complete");
    // The empty sections are measurements, not admissions of failure.
    expect(report.serps.every((serp) => serp.kind !== "unmeasured")).toBe(true);
    expect(report.presence?.you.top10Count).toBe(0);
  });

  it("asks one SERP per question, at the battery's own size", async () => {
    await runScan({ domain: DOMAIN, tier: "free" });
    expect(serpOrganic).toHaveBeenCalledTimes(12);
    expect(storedReport().serps).toHaveLength(12);
  });
});

describe("a ceiling gives back what was measured", () => {
  it("a battery the ceiling cut short keeps its unmeasured arms and lowers the denominator, never writes a 0", async () => {
    // The cost seam's own cap arm: `serpOrganic` returns `not_attempted`
    // for every call `recordFetch` skipped once the ceiling was reached.
    let asked = 0;
    serpOrganic.mockImplementation(async () => {
      asked += 1;
      return asked <= 3 ? measured(SERP, AT) : unmeasured("not_attempted", AT);
    });

    await runScan({ domain: DOMAIN, tier: "free" });
    const report = storedReport();
    expect(report.serps).toHaveLength(12);
    expect(report.serps.filter((serp) => serp.kind === "unmeasured")).toHaveLength(9);
    for (const serp of report.serps.slice(3)) {
      expect(serp.kind).toBe("unmeasured");
      // Not an empty SERP: "nobody was there" is a claim nobody made.
      expect(JSON.stringify(serp)).not.toMatch(/"organic"/);
    }
    // The cards' denominator is what was measured, not what was asked for.
    expect(report.aiAnswers?.measuredSearches).toBe(3);
    expect(report.presence?.measuredSearches).toBe(3);
  });

  it("a pass stopped before the market chain stores a report whose market says why", async () => {
    deriveProfile.mockResolvedValue(unmeasured("not_attempted", AT));
    await runScan({ domain: DOMAIN, tier: "free" });
    const report = storedReport();
    expect(report.market).toMatchObject({ kind: "unmeasured", reason: "not_attempted" });
    expect(report.questions.kind).toBe("unmeasured");
    expect(report.serps).toEqual([]);
    // A report is still stored: the customer gets back what was measured.
    expect(storeCurrentReport).toHaveBeenCalledTimes(1);
    expect(report.onPage.kind).toBe("measured");
  });
});

describe("degradation never throws", () => {
  it("a vendor that raises becomes `undeterminable` and the pass continues", async () => {
    serpOrganic.mockRejectedValue(new Error("dataforseo: 502 Bad Gateway"));
    const result = await runScan({ domain: DOMAIN, tier: "free" });
    expect(stages.lines).toEqual(EVERY_STAGE);
    expect(storedReport().serps.every((serp) => serp.kind === "unmeasured" && serp.reason === "undeterminable")).toBe(
      true
    );
    expect(result.status).not.toBe("failed");
  });

  it("a model that raises stops the market chain and leaves the rest unmeasured", async () => {
    deriveProfile.mockRejectedValue(new Error("anthropic: overloaded"));
    await runScan({ domain: DOMAIN, tier: "free" });
    const report = storedReport();
    expect(report.market.kind).toBe("unmeasured");
    expect(serpOrganic).not.toHaveBeenCalled();
    expect(storeCurrentReport).toHaveBeenCalledTimes(1);
  });

  it("a score that could not be computed is null, never partial — ADR-021", async () => {
    measureDomain.mockResolvedValue(
      measurement({
        drivers: {
          foundations: unmeasured("not_attempted", AT),
          answerability: measured(38, AT),
          searchPresence: measuredZero(0, AT),
          aiPresence: unmeasured("not_attempted", AT),
        },
      })
    );
    await runScan({ domain: DOMAIN, tier: "free" });
    const report = storedReport();
    expect(report.verdict.scoreAndBand.kind).toBe("unmeasured");
    expect(report.verdict.missing.map((m) => m.factor)).toContain("foundations");
  });
});

describe("the free path never starts outside admission control", () => {
  it("adopts the claimed row and issues no insert against scans", async () => {
    const result = await runScan({ domain: DOMAIN, tier: "free" });
    expect(result.scanId).toBe(CLAIMED_ID);
    expect(db.queries.some((q) => q.table === "scans" && q.verb === "insert")).toBe(false);
    expect(storedReport().scanId).toBe(CLAIMED_ID);
  });

  it("refuses with `failed` and spends nothing when there is no claimed row", async () => {
    db.rows.set("scans", []);
    const result = await runScan({ domain: DOMAIN, tier: "free" });
    expect(result).toEqual({ scanId: "", status: "failed" });
    expect(measureDomain).not.toHaveBeenCalled();
    expect(storeCurrentReport).not.toHaveBeenCalled();
    expect(stages.lines).toEqual([]);
  });

  it("refuses a domain that does not parse, before any row is touched", async () => {
    const result = await runScan({ domain: "not a domain at all", tier: "free" });
    expect(result).toEqual({ scanId: "", status: "failed" });
    expect(db.queries).toHaveLength(0);
  });
});

describe("a free re-scan inside the seven-day window serves the stored report", () => {
  it("returns the stored scan id, spends nothing, and closes the adopted row", async () => {
    readCurrentReport.mockResolvedValue(storedFor({ daysAgo: 2, complete: true }));

    const result = await runScan({ domain: DOMAIN, tier: "free" });
    expect(result).toEqual({ scanId: "previous-scan", status: "done" });
    expect(measureDomain).not.toHaveBeenCalled();
    expect(serpOrganic).not.toHaveBeenCalled();
    expect(storeCurrentReport).not.toHaveBeenCalled();

    const closed = db.queries.find((q) => q.verb === "update" && q.table === "scans");
    expect(closed?.values).toMatchObject({ status: "done", cost_cents: 0 });
    expect(closed?.filters).toEqual([["id", CLAIMED_ID]]);
  });

  it("runs a full pass once the window has passed", async () => {
    readCurrentReport.mockResolvedValue(storedFor({ daysAgo: 8, complete: true }));
    await runScan({ domain: DOMAIN, tier: "free" });
    expect(measureDomain).toHaveBeenCalledTimes(1);
    expect(stages.lines).toEqual(EVERY_STAGE);
  });

  it("runs a full pass when the stored report is itself incomplete", async () => {
    readCurrentReport.mockResolvedValue(storedFor({ daysAgo: 1, complete: false }));
    await runScan({ domain: DOMAIN, tier: "free" });
    expect(measureDomain).toHaveBeenCalledTimes(1);
  });
});

describe("a market correction runs inside the scan it corrects", () => {
  const CORRECTED = "44444444-4444-4444-8444-444444444444";

  beforeEach(() => {
    readCorrectionFacts.mockResolvedValue({
      scanId: CORRECTED,
      measuredAt: AT,
      category: "user onboarding software",
      correctionState: "running",
      domainRemoved: false,
    });
  });

  it("buys no async AI Overviews and says so on the card — DECISIONS 2026-09-03", async () => {
    await runScan({ domain: DOMAIN, tier: "free", correctionOf: CORRECTED });
    for (const call of serpOrganic.mock.calls) {
      expect((call as unknown as [unknown, { loadAsyncAiOverview: boolean }])[1].loadAsyncAiOverview).toBe(false);
    }
    expect(storedReport().aiAnswers?.coverage).toBe("cached_only");
  });

  it("ignores the seven-day window — a correction is not a re-scan", async () => {
    readCurrentReport.mockResolvedValue(storedFor({ daysAgo: 0, complete: true }));
    await runScan({ domain: DOMAIN, tier: "free", correctionOf: CORRECTED });
    expect(measureDomain).toHaveBeenCalledTimes(1);
    expect(readCurrentReport).not.toHaveBeenCalled();
  });

  it("supersedes the scan it corrects and marks the correction used", async () => {
    await runScan({ domain: DOMAIN, tier: "free", correctionOf: CORRECTED });
    const call = (storeCurrentReport.mock.calls.at(-1) as unknown as [{ supersedesScanId?: string; report: StoredReport }])[0];
    expect(call.supersedesScanId).toBe(CORRECTED);
    expect(call.report.correctionState).toBe("used");
    expect(advanceCorrectionState).toHaveBeenCalledWith({ scanId: CORRECTED, from: "running", to: "used" });
  });

  it("spends one allowance: one cost context, no second free-path claim", async () => {
    await runScan({ domain: DOMAIN, tier: "free", correctionOf: CORRECTED });
    expect(db.queries.filter((q) => q.verb === "insert")).toHaveLength(0);
    expect(storeCurrentReport).toHaveBeenCalledTimes(1);
  });
});

describe("the pipeline delegates and computes nothing", () => {
  it("imports no surface and no design system", () => {
    expect(RUN_SOURCE).not.toMatch(/from "@\/lib\/presentation/);
    expect(RUN_SOURCE).not.toMatch(/from "@\/ui/);
    expect(RUN_SOURCE).not.toMatch(/from "@\/app/);
  });

  it("stores the very values its callees returned", async () => {
    await runScan({ domain: DOMAIN, tier: "free" });
    const report = storedReport();
    expect(report.onPage.kind !== "unmeasured" && report.onPage.value).toBe(ON_PAGE);
    expect(report.robots.kind !== "unmeasured" && report.robots.value).toBe(ROBOTS);
    expect(report.questions.kind !== "unmeasured" && report.questions.value).toBe(TWELVE_QUESTIONS);
  });

  it("registers itself as the correction runner at module load", () => {
    expect(registeredAtLoad).toHaveLength(1);
    expect(typeof registeredAtLoad[0]).toBe("function");
  });
});
