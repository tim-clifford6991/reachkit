// tests/scan/free/vendor-failure.test.ts — issue #504
//
// A free pass whose one priced call — the customer's own `ranked_keywords`
// — fails at the vendor. Before #504 the failure was handed to the ledger
// as a `null` payload; `fetches.payload` is `not null`, so the insert threw
// and the stage's reason was the insert error. Here the vendor answers
// 502, the store refuses a null payload exactly as the column does, and
// the pass must end with the presence factor `unmeasured` naming the
// vendor's failure while every other stage runs on.
//
// Real: `measureDomain`, the DataForSEO client, `withCostContext` and the
// ledger write. Doubled: the database (the memory store, with the column's
// `not null`), the customer's server (`safeFetch`, `readRobots`), the
// vendor's server (global `fetch`), and every later stage's callee at its
// module boundary, as in `tests/scan/run/run.test.ts`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../run/harness";
import { setEnvFixture, stubVendorFetch } from "../../vendors/harness";
import { measured, type Measured } from "../../../src/lib/measure/measured";
import type { SerpResult } from "../../../src/lib/vendors/dataforseo/types";
import type { StoredReport } from "../../../src/lib/scan/report";
import { AT, PROFILE, QUESTION, ROBOTS, SELECTED, SERP } from "../report/fixtures";

const db = fakeDb();
const NOT_NULL = 'null value in column "payload" of relation "fetches" violates not-null constraint';
/** The memory store, with `fetches.payload`'s `not null`: an insert handed
 *  a null payload answers the error Postgres would. */
const strictClient = {
  ...db.client,
  from(table: string) {
    const builder = db.client.from(table) as unknown as Record<string, unknown> & {
      insert: (values: Record<string, unknown>) => unknown;
    };
    if (table !== "fetches") return builder;
    const insert = builder.insert.bind(builder);
    return {
      ...builder,
      insert(values: Record<string, unknown>) {
        if (values.payload === null || values.payload === undefined) {
          return { then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: NOT_NULL } }).then(resolve) };
        }
        return insert(values);
      },
    };
  },
};
vi.mock("@/lib/db", () => ({ dbAdmin: () => strictClient, db: () => strictClient }));

vi.mock("@/lib/costs/daily", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/costs/daily")>()),
  openDayLedger: async () => ({ spentCents: () => 0, ceilingReached: () => false, add: () => {} }),
}));

const HOME_HTML =
  "<html><head><title>Onboarding</title></head><body><h1>Onboarding for product teams</h1>" +
  "<h2>How does it work?</h2><p>Guided product tours that lift activation in the first week.</p></body></html>";

vi.mock("@/lib/egress/safe-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/egress/safe-fetch")>()),
  safeFetch: async (url: string) => ({
    ok: true,
    status: 200,
    url,
    html: HOME_HTML,
    bytes: HOME_HTML.length,
    readAt: AT,
    headers: {},
  }),
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
  registerCorrectionRunner: () => {},
  correctionRunner: () => null,
}));

setEnvFixture();
const { runScan } = await import("../../../src/lib/scan/run");

const CLAIMED_ID = "50450450-4504-4504-8504-504504504504";
const RANKED = "dataforseo_labs/google/ranked_keywords";

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

let logged: Record<string, unknown>[];
let raw: string[];

function linesOf(event: string): Record<string, unknown>[] {
  return logged.filter((line) => line.event === event);
}

function storedReport(): StoredReport {
  return (storeCurrentReport.mock.calls.at(-1) as unknown as [{ report: StoredReport }])[0].report;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  deriveMarketSet.mockResolvedValue(measured(TWELVE.map((s) => ({ keyword: s.keyword, volume: s.volume })), AT));
  phraseQuestions.mockResolvedValue(measured(TWELVE_QUESTIONS, AT));
  serpOrganic.mockResolvedValue(measured(SERP, AT) as Measured<SerpResult>);
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => ({
    scanId: a.report.scanId,
    status: "degraded" as const,
  }));
  logged = [];
  raw = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    if (typeof args[0] !== "string") return;
    raw.push(args[0]);
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

describe("issue #504 — the ranked-keywords call fails at the vendor on a free pass", () => {
  it("ledgers the failure as a row, never a null, and at 0 cents — DataForSEO does not bill a refused call", async () => {
    const vendor = stubVendorFetch(() => ({ status: 502, statusText: "Bad Gateway" }));
    await runScan({ domain: "example.com", tier: "free" });

    expect(vendor.requests.filter((r) => r.url.includes("ranked_keywords"))).toHaveLength(1);
    const ranked = db.queries.filter((q) => q.table === "fetches" && q.verb === "insert" && q.values?.source === RANKED);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.values).toMatchObject({
      payload: { vendorFailure: "http_502", endpoint: RANKED, billed: false },
      cost_cents: 0,
    });
  });

  it("the presence factor is `unmeasured`, and the stage's reason is the vendor's failure, not the insert", async () => {
    stubVendorFetch(() => ({ status: 502, statusText: "Bad Gateway" }));
    await runScan({ domain: "example.com", tier: "free" });

    expect(storedReport().verdict.missing).toEqual(
      expect.arrayContaining([{ factor: "presence", reason: "undeterminable" }])
    );
    expect(linesOf("driver_undeterminable")).toEqual([
      expect.objectContaining({ driver: "searchPresence", because: "http_502", endpoint: RANKED }),
    ]);
    expect(raw.some((line) => line.includes("insert into fetches failed"))).toBe(false);
    expect(linesOf("stage_undeterminable")).toEqual([]);
  });

  it("the rest of the pass completes: every stage runs, the questions are asked, and the ending is `complete`", async () => {
    stubVendorFetch(() => ({ status: 502, statusText: "Bad Gateway" }));
    await runScan({ domain: "example.com", tier: "free" });

    const stages = linesOf("stage_transition").map((l) => `${String(l.stage)}:${l.done === true ? "done" : "enter"}`);
    expect(stages).toEqual(EVERY_STAGE);
    expect(phraseQuestions).toHaveBeenCalled();
    expect(serpOrganic).toHaveBeenCalled();
    const report = storedReport();
    expect(report.stoppedReason).toBe("complete");
    // The site was read: the factors that rest on it are not missing.
    expect(report.verdict.missing).not.toEqual(
      expect.arrayContaining([{ factor: "foundations", reason: "undeterminable" }])
    );
  });
});
