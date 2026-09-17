// tests/scan/free/questions-fit-the-purse.test.ts — issue 873
//
// **A free report shows what it measured.**
//
// The free path's market ladder and its twelve spend one purse (issue
// 835), so a pass that widened its market has less left to ask questions
// with. It still selected twelve, phrased twelve and showed twelve — and
// the ones the purse could not pay for were dropped after the visitor had
// been shown them, which is a shop window with holes in it. The count is
// now decided before the phrasing, so a question that reaches the report
// is one the pass could pay to answer.
//
// The market is doubled at its own module boundary — and its double
// **spends real cents through the real `CostContext`**, because what this
// suite is about is the money the ladder leaves behind. The vendor's HTTP
// surface, the database, the customer's server and the two nano calls are
// doubled; `withCostContext`, the selection, `asking_the_twelve` and the
// composition are real.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../run/harness";
import { envelope, setEnvFixture, stubVendorFetch } from "../../vendors/harness";
import { measured } from "../../../src/lib/measure/measured";
import type { CostContext } from "../../../src/lib/costs";
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

// The selection's own right-sizing (issues 830, 858) is not this suite's
// subject and has its own tests: the market's rows arrive already chosen,
// so what varies here is the money, not which searches survive a floor.
const selectTwelve = vi.fn();
vi.mock("@/lib/market/questions/select", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/market/questions/select")>()),
  selectTwelve: (...a: unknown[]) => selectTwelve(...a),
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

setEnvFixture();
const { runScan } = await import("../../../src/lib/scan/run");
const { QUESTION_SERP_RESERVE_C, questionsAffordable, twelveCentsAfter } = await import(
  "../../../src/lib/scan/budgets"
);
const { marketTooSmall } = await import("../../../src/lib/scan/market-floor");
const { CAPS, BATTERY } = await import("../../../src/lib/config/constants");

const CLAIMED_ID = "50450450-4504-4504-8504-504504504504";
const DOMAIN = "example.com";

const KEYWORDS = Array.from({ length: BATTERY.QUESTIONS }, (_, i) => `best onboarding software ${i}`);
const TWELVE = KEYWORDS.map((keyword, i) => ({ ...SELECTED, keyword, rank: i + 1 }));

/** The market's double, spending `cents` of the shared purse on its way to
 *  the same rows a real ladder would leave behind. One ledgered call, at
 *  the seam every purchase goes through. */
function marketSpending(cents: number): void {
  let seed = 0;
  deriveMarketSet.mockImplementation(async (cost: CostContext) => {
    seed += 1;
    await cost.recordFetch({
      source: "dataforseo_labs/google/keyword_suggestions",
      cacheKey: `seed-${seed}`,
      freshnessDays: 30,
      costCents: cents,
      run: async () => [{ keyword: "seed", volume: 100 }],
    });
    return measured(
      TWELVE.map((s) => ({ keyword: s.keyword, volume: s.volume })),
      AT
    );
  });
}

function storedCall(): { report: StoredReport; costCents: number } {
  return (storeCurrentReport.mock.calls.at(-1) as unknown as [{ report: StoredReport; costCents: number }])[0];
}

/** What the phrasing was asked to word — the model call this suite must
 *  never see spent on a question the pass cannot ask. */
function phrasedCount(): number {
  const call = phraseQuestions.mock.calls.at(-1) as unknown as [unknown, { selected: readonly unknown[] }];
  return call[1].selected.length;
}

function serpAsks(requests: { url: string }[]): number {
  return requests.filter((r) => r.url.includes("/serp/google/organic")).length;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  selectTwelve.mockReturnValue(TWELVE);
  marketSpending(0);
  phraseQuestions.mockImplementation(async (_c: unknown, a: { selected: readonly { keyword: string }[] }) =>
    measured(
      a.selected.map((search, i) => ({ ...QUESTION, id: `q${i + 1}`, search })),
      AT
    )
  );
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "done" as const,
  }));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Every SERP answers; the market's spend is what varies. */
function vendorAnswers() {
  return stubVendorFetch((request) => {
    if (request.url.includes("/serp/google/organic")) {
      return envelope({
        items: [{ type: "organic", rank_group: 1, domain: "rival.com", url: "https://rival.com/p", title: "Rival" }],
      });
    }
    return envelope({ items: [] });
  });
}

describe("issue 873 — the free report asks as many questions as its purse can pay for", () => {
  it("a market that ate most of the purse leaves room for the questions it can answer, and shows exactly those", async () => {
    // 7.2¢ of the 10¢ purse, which is what three extra seeds cost.
    const MARKET = 7.2;
    marketSpending(MARKET);
    const afforded = questionsAffordable(twelveCentsAfter(MARKET));
    expect(afforded).toBeGreaterThan(0);
    expect(afforded).toBeLessThan(BATTERY.QUESTIONS);

    const vendor = vendorAnswers();
    await runScan({ domain: DOMAIN, tier: "free" });

    const report = storedCall().report;
    expect(phrasedCount()).toBe(afforded);
    expect(report.questions.kind === "measured" ? report.questions.value.length : 0).toBe(afforded);
    expect(report.serps).toHaveLength(afforded);
    expect(serpAsks(vendor.requests)).toBe(afforded);
  });

  it("every question it shows carries a measured answer — no row with nothing in it", async () => {
    marketSpending(7.2);
    vendorAnswers();
    await runScan({ domain: DOMAIN, tier: "free" });

    const report = storedCall().report;
    expect(report.serps.every((serp) => serp.kind !== "unmeasured")).toBe(true);
    expect(report.aiAnswers?.rows.every((row) => row.cell.kind !== "unmeasured")).toBe(true);
    expect(report.aiAnswers?.measuredSearches).toBe(report.aiAnswers?.rows.length);
  });

  it("no model call words a question the pass cannot ask", async () => {
    marketSpending(7.2);
    vendorAnswers();
    await runScan({ domain: DOMAIN, tier: "free" });

    expect(phraseQuestions).toHaveBeenCalledTimes(1);
    expect(phrasedCount()).toBeLessThan(BATTERY.QUESTIONS);
  });

  it("the pass still spends inside the free cap", async () => {
    marketSpending(7.2);
    vendorAnswers();
    await runScan({ domain: DOMAIN, tier: "free" });

    const spent = db.queries
      .filter((q) => q.table === "fetches" && q.verb === "insert")
      .reduce((sum, q) => sum + Number((q.values as unknown as { cost_cents: number }).cost_cents), 0);
    expect(spent).toBeLessThanOrEqual(CAPS.FREE_C);
    expect(storedCall().costCents).toBeLessThanOrEqual(CAPS.FREE_C);
  });

  it("a full purse still shows twelve", async () => {
    // One seed, the purchase every pass makes.
    marketSpending(1.8);
    const vendor = vendorAnswers();
    await runScan({ domain: DOMAIN, tier: "free" });

    const report = storedCall().report;
    expect(phrasedCount()).toBe(BATTERY.QUESTIONS);
    expect(report.serps).toHaveLength(BATTERY.QUESTIONS);
    expect(serpAsks(vendor.requests)).toBe(BATTERY.QUESTIONS);
    expect(report.serps.every((serp) => serp.kind !== "unmeasured")).toBe(true);
  });

  it("a purse with nothing left to ask with is the thin-market state, not a short list", async () => {
    // The ladder took the purse to within less than one question's reserve.
    marketSpending(10 - QUESTION_SERP_RESERVE_C / 2);
    const vendor = vendorAnswers();
    await runScan({ domain: DOMAIN, tier: "free" });

    const report = storedCall().report;
    expect(phrasedCount()).toBe(0);
    expect(report.questions.kind).not.toBe("unmeasured");
    expect(marketTooSmall(report.questions)).toBe(true);
    expect(serpAsks(vendor.requests)).toBe(0);
  });

  it("the paid tiers are untouched: a deep pass whose market spent the same still asks all twelve", async () => {
    marketSpending(7.2);
    const vendor = vendorAnswers();
    await runScan({ domain: DOMAIN, tier: "deep" });

    expect(phrasedCount()).toBe(BATTERY.QUESTIONS);
    expect(serpAsks(vendor.requests)).toBe(BATTERY.QUESTIONS);
  });
});
