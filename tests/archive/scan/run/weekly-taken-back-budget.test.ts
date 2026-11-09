// tests/scan/run/weekly-taken-back-budget.test.ts
//
// A weekly row the claim takes back after a failure is handed to `runScan`
// as `scanId`. One `WEEKLY` cap per site-week, retries included: the pass
// opens on what the row has already spent, never on a fresh 40¢.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "./harness";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import { CAPS, TYPING_RESERVE_C } from "../../../src/lib/config/constants";
import type { CostContext } from "../../../src/lib/costs";
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

const { runScan } = await import("../../../src/lib/scan/run");

const TAKEN_BACK_ID = "44444444-4444-4444-8444-444444444444";

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

/** The paid calls the pass's first stage asks for, each with a spied vendor call. */
let asks: number[] = [];
let openedAt: number | null = null;
let answers: unknown[] = [];
const vendor = vi.fn(async () => ({}));

function paidCall(costCents: number, n: number) {
  return { source: "serpOrganic", cacheKey: `taken-back-${n}`, freshnessDays: 0, costCents, run: vendor };
}

function ledgerRows(): number {
  return db.queries.filter((q) => q.table === "fetches" && q.verb === "insert").length;
}

async function passOnRowAt(costCents: number): Promise<void> {
  db.answer = (q) =>
    q.table === "scans" && q.verb === "select" && q.filters.some(([c, v]) => c === "id" && v === TAKEN_BACK_ID)
      ? [{ id: TAKEN_BACK_ID, cost_cents: costCents, report: null }]
      : null;
  await runScan({ scanId: TAKEN_BACK_ID, domain: "example.com", tier: "weekly" });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  asks = [];
  answers = [];
  openedAt = null;
  measureDomain.mockImplementation(async (cost: CostContext) => {
    openedAt = cost.spentCents();
    for (const [n, cents] of asks.entries()) answers.push(await cost.recordFetch(paidCall(cents, n)));
    return MEASUREMENT;
  });
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  deriveMarketSet.mockResolvedValue(measured([{ keyword: SELECTED.keyword, volume: SELECTED.volume }], AT));
  phraseQuestions.mockResolvedValue(measured([QUESTION], AT));
  serpOrganic.mockResolvedValue(measured(SERP, AT));
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "done" as const,
  }));
});

describe("a weekly row taken back after a failure", () => {
  it("a taken-back week at 40¢ buys nothing", async () => {
    asks = [0.1];
    await passOnRowAt(CAPS.WEEKLY_C);
    expect(vendor).not.toHaveBeenCalled();
    expect(ledgerRows()).toBe(0);
  });

  it("a fresh claim opens at 0", async () => {
    asks = [1];
    await passOnRowAt(0);
    expect(openedAt).toBe(0);
    expect(answers[0]).not.toEqual({ skipped: "cap" });
    expect(vendor).toHaveBeenCalledTimes(1);
  });

  it("a row at 25¢ gets only 15¢", async () => {
    const left = CAPS.WEEKLY_C - 25;
    asks = [left + 1, left - TYPING_RESERVE_C];
    await passOnRowAt(25);
    expect(openedAt).toBe(25);
    expect(answers[0]).toEqual({ skipped: "cap" });
    expect(answers[1]).not.toEqual({ skipped: "cap" });
    expect(vendor).toHaveBeenCalledTimes(1);
  });
});
