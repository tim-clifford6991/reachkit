// tests/scan/run/after-report.test.ts — issue #126.
//
// Two things the pipeline gained so that §7 could be wired to it without a
// second budget and without a second pipeline:
//
//   1. a paid pass claims its own `running` row before it spends, because
//      `fetches.scan_id` and `opportunities.scan_id` both reference
//      `scans (id)`;
//   2. `afterReport` — one optional hook, called once the report is
//      stored, with the pass's own `CostContext`.
//
// What the hook *does* is its caller's (`deriveForPass`, and
// `tests/opportunities/pass.test.ts`); what this suite holds is that the
// pipeline calls it once, at the right moment, with the pass's own money,
// and that a hook which throws never takes the report down with it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureStages, fakeDb } from "./harness";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import type { DomainMeasurement } from "../../../src/lib/measure";
import type { CostContext } from "../../../src/lib/costs";
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
};

let stages: { lines: string[]; restore: () => void };
const order: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  order.length = 0;
  measureDomain.mockResolvedValue(MEASUREMENT);
  deriveProfile.mockResolvedValue(measured(PROFILE, AT));
  deriveMarketSet.mockResolvedValue(measured([{ keyword: SELECTED.keyword, volume: SELECTED.volume }], AT));
  phraseQuestions.mockResolvedValue(measured([QUESTION], AT));
  serpOrganic.mockResolvedValue(measured(SERP, AT));
  storeCurrentReport.mockImplementation(async (a: { report: StoredReport }) => {
    order.push("stored");
    return { scanId: a.report.scanId, status: "done" as const };
  });
  stages = captureStages();
});

afterEach(() => stages.restore());

describe("a paid pass claims its own row before it spends", () => {
  it("inserts one `running` row, carrying the site it belongs to", async () => {
    await runScan({ domain: DOMAIN, tier: "deep", siteId: "site-1" });
    const inserts = db.queries.filter((q) => q.table === "scans" && q.verb === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.values).toMatchObject({
      domain: DOMAIN,
      tier: "deep",
      status: "running",
      site_id: "site-1",
    });
  });

  it("claims nothing where the caller already claimed one — the weekly pass's `(site_id, week_start)` row is not doubled", async () => {
    await runScan({ domain: DOMAIN, tier: "weekly", siteId: "site-1", scanId: "already-claimed" });
    expect(db.queries.filter((q) => q.table === "scans" && q.verb === "insert")).toHaveLength(0);
  });

  it("writes the report into the row it claimed, and not into a second one", async () => {
    await runScan({ domain: DOMAIN, tier: "deep", siteId: "site-1" });
    const inserted = db.queries.find((q) => q.table === "scans" && q.verb === "insert")!.values!;
    const stored = storeCurrentReport.mock.calls[0]![0] as { report: StoredReport };
    expect(stored.report.scanId).toBe(inserted.id);
  });
});

describe("afterReport — one hook, once, after the store, on the pass's own money", () => {
  it("is called once, with the stored report and a cost context", async () => {
    const seen: { report: StoredReport; cost: CostContext }[] = [];
    await runScan({
      domain: DOMAIN,
      tier: "deep",
      siteId: "site-1",
      afterReport: async (a) => {
        order.push("hook");
        seen.push(a);
      },
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]!.report.tier).toBe("deep");
    // The pass's own context, under the pass's own cap — never a second
    // budget opened for the derivation (§6.3 puts opportunity typing
    // inside the deep and weekly passes' caps).
    expect(seen[0]!.cost.cap).toBe("DEEP");
    expect(typeof seen[0]!.cost.recordFetch).toBe("function");
  });

  it("runs after the report is stored — the rows it writes reference that scan", async () => {
    await runScan({
      domain: DOMAIN,
      tier: "deep",
      siteId: "site-1",
      afterReport: async () => void order.push("hook"),
    });
    expect(order).toEqual(["stored", "hook"]);
  });

  it("a hook that throws leaves the stored report standing — zero proposals is legal, never faked", async () => {
    const result = await runScan({
      domain: DOMAIN,
      tier: "deep",
      siteId: "site-1",
      afterReport: async () => {
        throw new Error("the derivation blew up");
      },
    });
    expect(result.status).toBe("done");
    expect(storeCurrentReport).toHaveBeenCalledTimes(1);
  });

  it("is optional: a pass without one runs the same six stages and stores the same report", async () => {
    await runScan({ domain: DOMAIN, tier: "deep", siteId: "site-1" });
    const withoutHook = [...stages.lines];

    stages.restore();
    stages = captureStages();
    await runScan({
      domain: DOMAIN,
      tier: "deep",
      siteId: "site-1",
      afterReport: async () => undefined,
    });
    expect(stages.lines).toEqual(withoutHook);
    expect(storeCurrentReport).toHaveBeenCalledTimes(2);
  });
});
