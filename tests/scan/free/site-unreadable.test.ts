// tests/scan/free/site-unreadable.test.ts — issue #479
//
// "A pass whose first stage could not be read ends 'complete'." cal.com's
// home document was refused (2.16 MB over the fetcher's 2 MB cap), the
// pass marked everything after it `not_attempted` and ended
// `stoppedReason: complete` in 0.6 s. This suite drives the free pass
// with `measureDomain` answering a refused home and asserts the ending
// carries the cause: `site_unreadable` with the refusal, nothing after the
// first stage attempted, and the stored report saying so. The notice the
// report page renders for it is `tests/app/scan-address/{resolve,
// report-view}.test.*`'s; the ledger row the refusal writes is
// `tests/costs/refusal-row.test.ts`'s.
//
// Every callee is doubled at its module boundary, as in
// `tests/scan/run/run.test.ts`, whose harness this shares.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../run/harness";
import { measured, unmeasured } from "../../../src/lib/measure/measured";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { StoredReport } from "../../../src/lib/scan/report";
import { AT, ROBOTS } from "../report/fixtures";

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
  registerCorrectionRunner: () => {},
  correctionRunner: () => null,
}));

const { runScan } = await import("../../../src/lib/scan/run");
const { statusOf } = await import("../../../src/lib/scan/store");

const CLAIMED_ID = "47947947-9479-4479-8479-479479479479";

/** What `measureDomain` answers for a home document the fetcher refused:
 *  the shape `src/lib/measure/index.ts` returns on that arm. */
function refusedHome(refusal: "too_large" | "timeout" | "dns"): DomainMeasurement {
  return {
    drivers: {
      foundations: unmeasured("undeterminable", AT),
      answerability: unmeasured("undeterminable", AT),
      searchPresence: unmeasured("not_attempted", AT),
      aiPresence: unmeasured("not_attempted", AT),
    },
    text: { home: null, pricing: null },
    onPage: unmeasured("undeterminable", AT),
    pricing: null,
    robots: unmeasured("not_attempted", AT),
    ownRanked: unmeasured("not_attempted", AT),
    homeRefusal: refusal,
  };
}

let logged: Record<string, unknown>[];

function linesOf(event: string): Record<string, unknown>[] {
  return logged.filter((line) => line.event === event);
}

function stageLines(): string[] {
  return linesOf("stage_transition").map((l) => `${String(l.stage)}:${l.done === true ? "done" : "enter"}`);
}

function storedReport(): StoredReport {
  return (storeCurrentReport.mock.calls.at(-1) as unknown as [{ report: StoredReport }])[0].report;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.rows.set("scans", [{ id: CLAIMED_ID, fromIncompleteRescan: false }]);
  readCurrentReport.mockResolvedValue(null);
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport; degraded: boolean }) => ({
    scanId: a.report.scanId,
    status: statusOf({ stoppedReason: a.report.stoppedReason, degraded: a.degraded }),
  }));
  deriveProfile.mockResolvedValue(measured({}, AT));
  logged = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    if (typeof args[0] !== "string") return;
    try {
      logged.push(JSON.parse(args[0]) as Record<string, unknown>);
    } catch {
      // Not a JSON line.
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("issue #479 — home document refused → the pass ends `site_unreadable`, and nothing else is attempted", () => {
  it("stops after the first stage: no market, no presence, no questions, no score", async () => {
    measureDomain.mockResolvedValue(refusedHome("too_large"));
    await runScan({ domain: "cal.com", tier: "free" });

    expect(stageLines()).toEqual(["reading_your_site:enter", "reading_your_site:done"]);
    expect(deriveProfile).not.toHaveBeenCalled();
    expect(deriveMarketSet).not.toHaveBeenCalled();
    expect(phraseQuestions).not.toHaveBeenCalled();
    expect(serpOrganic).not.toHaveBeenCalled();
  });

  it("stores a report that ends `site_unreadable`, never `complete`, and is not complete", async () => {
    measureDomain.mockResolvedValue(refusedHome("too_large"));
    const result = await runScan({ domain: "cal.com", tier: "free" });

    const report = storedReport();
    expect(report.stoppedReason).toBe("site_unreadable");
    expect(report.complete).toBe(false);
    expect(report.verdict.scoreAndBand.kind).toBe("unmeasured");
    // The home document is the input both site factors depend on, and it
    // could not be determined — REQ-004 c6's reason, never a 0.
    expect(report.verdict.missing).toEqual(
      expect.arrayContaining([
        { factor: "foundations", reason: "undeterminable" },
        { factor: "answerability", reason: "undeterminable" },
      ])
    );
    // A report is stored — the page has something to say — and it is not `done`.
    expect(result.status).toBe("degraded");
  });

  it("the ending names the refusal: on the ceilings line, on the stream's ending and on the pass line", async () => {
    measureDomain.mockResolvedValue(refusedHome("too_large"));
    await runScan({ domain: "cal.com", tier: "free" });

    expect(linesOf("scan_ending")).toEqual([
      expect.objectContaining({ stoppedReason: "site_unreadable", refusal: "too_large" }),
    ]);
    expect(linesOf("scan_pass")).toEqual([
      expect.objectContaining({ stoppedReason: "site_unreadable", because: "too_large" }),
    ]);
  });

  it.each(["timeout", "dns"] as const)("a `%s` home ends the same way, carrying its own reason", async (refusal) => {
    measureDomain.mockResolvedValue(refusedHome(refusal));
    await runScan({ domain: "cal.com", tier: "free" });
    expect(storedReport().stoppedReason).toBe("site_unreadable");
    expect(linesOf("scan_ending")[0]).toMatchObject({ refusal });
  });

  it("a first stage that raised is the same unread site: `site_unreadable`, with no refusal to name", async () => {
    measureDomain.mockRejectedValue(new Error("ledger.ts: insert into fetches failed"));
    await runScan({ domain: "cal.com", tier: "free" });

    expect(stageLines()).toEqual(["reading_your_site:enter", "reading_your_site:done"]);
    expect(storedReport().stoppedReason).toBe("site_unreadable");
    expect(linesOf("scan_ending")[0]).toMatchObject({ stoppedReason: "site_unreadable", refusal: null });
    expect(linesOf("scan_pass")[0]).toMatchObject({ because: "stage_undeterminable" });
  });

  it("a readable home is untouched by any of this — the pass runs on past the first stage", async () => {
    measureDomain.mockResolvedValue({ ...refusedHome("too_large"), robots: measured(ROBOTS, AT), homeRefusal: null });
    await runScan({ domain: "cal.com", tier: "free" });
    expect(stageLines()).toContain("reading_your_market:enter");
    expect(storedReport().stoppedReason).not.toBe("site_unreadable");
  });
});
