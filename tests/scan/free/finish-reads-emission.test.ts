// tests/scan/free/finish-reads-emission.test.ts — issue 1440
//
// A free pass that stores a report with searches it chose and did not read
// says so on the report and sends `scan/finish-reads` for its scan, once,
// after the report is stored. A pass that read every search sends nothing.
//
// The pass is real; its doubles are `vendor-failure.test.ts`'s (the
// database, the customer's server, the vendor, the model calls), plus the
// send itself.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../run/harness";
import { setEnvFixture, stubVendorFetch } from "../../vendors/harness";
import { measured, unmeasured, type Measured } from "../../../src/lib/measure/measured";
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
  openDayLedger: async () => ({ spentCents: () => 0, refresh: async () => {}, ceilingReached: () => false, add: () => {} }),
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

const sendFinishReads = vi.fn();
vi.mock("@/jobs/scan-finish-reads", () => ({ sendFinishReads: (...a: unknown[]) => sendFinishReads(...a) }));

setEnvFixture();
const { runScan } = await import("../../../src/lib/scan/run");

const CLAIMED_ID = "50450450-4504-4504-8504-504504504504";


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

describe("issue 1440 — a free pass that left searches unread sends scan/finish-reads", () => {
  it("marks the stored report with how many are unread and sends the event for its scan", async () => {
    stubVendorFetch(() => ({ status: 502, statusText: "Bad Gateway" }));
    serpOrganic.mockImplementation(async (_cost: unknown, a: { query: string }) =>
      KEYWORDS.indexOf(a.query) < 9 ? (measured(SERP, AT) as Measured<SerpResult>) : unmeasured<SerpResult>("undeterminable", AT)
    );
    await runScan({ domain: "example.com", tier: "free" });

    const report = storedReport();
    expect(report.finishingReads).toMatchObject({ searches: 3 });
    expect(sendFinishReads.mock.calls).toEqual([[CLAIMED_ID]]);
    // Sent after the store: the job reads the stored row.
    expect(sendFinishReads.mock.invocationCallOrder[0]!).toBeGreaterThan(storeCurrentReport.mock.invocationCallOrder.at(-1)!);
  });

  it("a pass that read every search sends nothing and marks nothing", async () => {
    stubVendorFetch(() => ({ status: 502, statusText: "Bad Gateway" }));
    await runScan({ domain: "example.com", tier: "free" });

    expect(storedReport().finishingReads).toBeUndefined();
    expect(sendFinishReads).not.toHaveBeenCalled();
  });

  it("a send that fails is logged and the stored report stands", async () => {
    stubVendorFetch(() => ({ status: 502, statusText: "Bad Gateway" }));
    serpOrganic.mockResolvedValue(unmeasured<SerpResult>("undeterminable", AT));
    sendFinishReads.mockRejectedValueOnce(new Error("queue down"));
    await expect(runScan({ domain: "example.com", tier: "free" })).resolves.toMatchObject({ scanId: CLAIMED_ID });
    expect(linesOf("finish_reads_not_sent")).toEqual([expect.objectContaining({ scanId: CLAIMED_ID, because: "queue down" })]);
  });
});
