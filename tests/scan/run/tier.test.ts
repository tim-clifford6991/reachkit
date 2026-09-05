// tests/scan/run/tier.test.ts — issue #25.
//
// "The pipeline never branches on tier; only its parameters change" — the
// same six stages over the same callees at all three tiers, differing only
// in the values looked up in one frozen table. The mutation this suite
// exists to kill is a battery guarded by `if (tier !== 'free')`: it passes
// every behavioural row and fails the source row.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStages, fakeDb } from "./harness";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import type { DomainMeasurement } from "../../../src/lib/measure";
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

vi.mock("@/lib/scan/correction", () => ({
  readCorrectionFacts: async () => null,
  advanceCorrectionState: async () => true,
  registerCorrectionRunner: () => undefined,
  correctionRunner: () => null,
}));

const { runScan, TIER_PARAMETERS } = await import("../../../src/lib/scan/run");

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
};

let stages: { lines: string[]; restore: () => void };

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  measureDomain.mockResolvedValue(MEASUREMENT);
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  deriveMarketSet.mockResolvedValue(measured([{ keyword: SELECTED.keyword, volume: SELECTED.volume }], AT));
  phraseQuestions.mockResolvedValue(measured([QUESTION], AT));
  serpOrganic.mockResolvedValue(measured(SERP, AT));
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "done" as const,
  }));
  stages = captureStages();
});

afterEach(() => stages.restore());

describe("the same six stages run at every tier", () => {
  it.each(["free", "deep", "weekly"] as const)("%s emits the identical stage sequence", async (tier) => {
    await runScan({ domain: DOMAIN, tier });
    expect(stages.lines).toEqual(EVERY_STAGE);
  });

  it.each(["free", "deep", "weekly"] as const)("%s calls the identical set of callees", async (tier) => {
    await runScan({ domain: DOMAIN, tier });
    expect(measureDomain).toHaveBeenCalledTimes(1);
    expect(deriveProfile).toHaveBeenCalledTimes(1);
    expect(deriveMarketSet).toHaveBeenCalledTimes(1);
    expect(phraseQuestions).toHaveBeenCalledTimes(1);
    expect(serpOrganic).toHaveBeenCalledTimes(1);
    expect(storeCurrentReport).toHaveBeenCalledTimes(1);
  });
});

describe("what does differ is exactly the looked-up parameters", () => {
  it("the SERP mode is live where a human is waiting and standard on the queue", async () => {
    for (const [tier, mode] of [
      ["free", "live"],
      ["deep", "live"],
      ["weekly", "std"],
    ] as const) {
      vi.clearAllMocks();
      db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
      await runScan({ domain: DOMAIN, tier });
      expect((serpOrganic.mock.calls[0] as unknown as [unknown, { mode: string }])[1].mode).toBe(mode);
    }
  });

  it("only the free report's own battery counts Google's actual AI answers", async () => {
    for (const [tier, flagged] of [
      ["free", true],
      ["deep", false],
      ["weekly", false],
    ] as const) {
      vi.clearAllMocks();
      db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
      await runScan({ domain: DOMAIN, tier });
      expect(
        (serpOrganic.mock.calls[0] as unknown as [unknown, { loadAsyncAiOverview: boolean }])[1].loadAsyncAiOverview
      ).toBe(flagged);
    }
  });

  it("each tier spends against its own cap and only the free path has the report deadline", () => {
    expect(TIER_PARAMETERS.free).toMatchObject({ cap: "FREE", deadlineApplies: true, adoptsClaim: true });
    expect(TIER_PARAMETERS.deep).toMatchObject({ cap: "DEEP", deadlineApplies: false, adoptsClaim: false });
    expect(TIER_PARAMETERS.weekly).toMatchObject({ cap: "WEEKLY", deadlineApplies: false, adoptsClaim: false });
  });

  it("the paid tiers insert their own row; the free path adopts admission's", async () => {
    await runScan({ domain: DOMAIN, tier: "deep" });
    // No read of the claimed row at all — the paid pass has its own id.
    expect(db.queries.filter((q) => q.table === "scans" && q.verb === "select")).toHaveLength(0);
  });

  it("the table is frozen — a tier's parameters cannot be changed at run time", () => {
    expect(Object.isFrozen(TIER_PARAMETERS)).toBe(true);
    expect(Object.isFrozen(TIER_PARAMETERS.free)).toBe(true);
  });
});

describe("tier is a parameter and never a branch", () => {
  it("the source compares against no tier literal outside the parameter table", () => {
    // Everything above the table's closing line is the declaration; below
    // it, no comparison against a tier name may appear.
    const belowTheTable = RUN_SOURCE.slice(RUN_SOURCE.indexOf("} as const);"));
    expect(belowTheTable).not.toMatch(/tier\s*===?\s*["']/);
    expect(belowTheTable).not.toMatch(/["'](free|deep|weekly)["']\s*===?\s*/);
    expect(belowTheTable).not.toMatch(/switch\s*\(\s*\w*\.?tier\s*\)/);
  });

  it("the table names every tier, so a new one cannot ship without its parameters", () => {
    expect(Object.keys(TIER_PARAMETERS).sort()).toEqual(["deep", "free", "weekly"]);
  });
});
