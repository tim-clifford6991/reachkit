// tests/costs/spend-log.test.ts — SPEC §6 (owner, D57, issue 1286; issue 1408).
//
// `npm run costs`: what the vendors billed beside what we recorded, and the
// day judged against D34's €2. Driven on fixture rows and a scratch file:
// nothing is bought and the box's own logs are not touched.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { reconcile, render, type LedgerRow, type Snapshot, type SpendRow } from "../../scripts/costs/report";
import { appendSpend, readSpend } from "../../scripts/spend-log.mjs";
import { readCostReport, readUserData } from "../../scripts/vendor-snapshot.mjs";
import { USD_PER_EUR } from "../../src/lib/config/constants";

const FIXTURE = path.join(import.meta.dirname, "fixtures/spend.jsonl");
const NOW = new Date("2026-10-06T12:00:00.000Z");
const spend = (): SpendRow[] => readSpend(FIXTURE) as SpendRow[];
const reading = (at: string, balanceCents: number, depositedCents = 10100): Snapshot => ({ at, dataforseo: { balanceCents, depositedCents } });

afterEach(() => {
  delete process.env.RK_SPEND_LOG;
});

describe("npm run costs — billed beside recorded, against €2 a day", () => {
  it("reads billed from the balance drop between the day's readings, with a deposit added back", () => {
    const report = reconcile({
      spend: spend(),
      ledger: [],
      // 5 October: 30¢ spent and $10 deposited. 6 October so far: 5¢.
      snapshots: [reading("2026-10-05T00:00:04.000Z", 3000), reading("2026-10-06T00:00:03.000Z", 3970, 11100), reading("2026-10-06T11:00:02.000Z", 3965, 11100)],
      adminKey: false,
      now: NOW,
    });
    const day5 = report.days.find((day) => day.day === "2026-10-05")!;
    expect(day5.dataforseo).toMatchObject({ billed: 30, billedFrom: "balance" });
    expect(report.today.dataforseo.billed).toBeCloseTo(5);
    // The log holds 8.4¢ of DataForSEO spend today: 3.4¢ and 68% over the bill.
    expect(report.today.dataforseo.recorded).toBeCloseTo(8.4);
    expect(report.today.dataforseo.gap?.cents).toBeCloseTo(3.4);
    expect(render(report)).toContain("WARNING: DataForSEO billed and recorded differ by 3.40¢ (68%)");
  });

  it("adds production's ledger to recorded, and says so when it could not be read", () => {
    const ledger: LedgerRow[] = [{ day: "2026-10-06", source: "serp/google/organic", cents: 1.6, billed: 1 }];
    const read = reconcile({ spend: spend(), ledger, snapshots: [], adminKey: false, now: NOW });
    expect(read.today.dataforseo).toMatchObject({ tests: 8.4, production: 1.6, billed: null });
    expect(read.today.dataforseo.calls).toEqual({ billed: 1, estimated: 1.6, count: 1 });

    const unread = reconcile({ spend: spend(), ledger: null, snapshots: [], adminKey: false, now: NOW });
    expect(unread.today.dataforseo.production).toBeNull();
    expect(render(unread)).toContain("Production ledger: not read");
  });

  it("never compares billed with recorded when the production ledger is unread", () => {
    // 113.36¢ left the balance today and the box made no paid call: the bill is production's.
    const report = reconcile({ spend: [], ledger: null, snapshots: [reading("2026-10-06T00:00:03.000Z", 5000), reading("2026-10-06T11:00:02.000Z", 5000 - 113.36)], adminKey: false, now: NOW });
    expect(report.today.dataforseo.billed).toBeCloseTo(113.36);
    expect(report.today.dataforseo.gap).toBeNull();
    const text = render(report);
    expect(text).not.toContain("differ");
    expect(text).not.toContain("WARNING: DataForSEO");
    expect(text).toContain("billed 113.36¢; not compared, production ledger unread");
  });

  it("judges the cap on the box's own spend log, and prints account-wide billed beside it", () => {
    // The box's log today: 8.4¢ DataForSEO, 61.5¢ AI.
    const recorded = reconcile({ spend: spend(), ledger: [], snapshots: [], adminKey: false, now: NOW });
    expect(recorded.today.judgedCents).toBeCloseTo(69.9);
    expect(recorded.today.state).toBe("ok");
    expect(render(recorded)).toContain("AI spend: estimated from tokens; no admin key");

    // Anthropic bills 500¢ account-wide and the box made no call: production spent it.
    const billed = reconcile({ spend: [], ledger: null, snapshots: [{ at: "2026-10-06T11:00:00.000Z", anthropic: { days: { "2026-10-06": 500 } } }], adminKey: true, now: NOW });
    expect(billed.today.ai).toMatchObject({ billed: 500, billedFrom: "cost report" });
    expect(billed.today.state).toBe("ok");
    const text = render(billed);
    expect(text).not.toContain("OVER");
    expect(text).not.toContain("ask the owner");
    expect(text).not.toContain("no admin key");
    expect(text).toContain("Billed, account-wide, includes production: DataForSEO not known, AI 500.00¢");

    // €2 is converted at the pinned rate, and a row's own vendor charge counts over its estimate.
    const cap = 2 * USD_PER_EUR.rate * 100;
    const row = (cents: number, charged: number | null = null): SpendRow => ({ at: "2026-10-06T10:00:00.000Z", issue: "1", script: "pass", source: "serp/google/organic", cents, billed: charged });
    const at = (rows: SpendRow[]) => reconcile({ spend: rows, ledger: [], snapshots: [], adminKey: true, now: NOW });
    expect(at([row(cap - 1)]).today.state).toBe("warn");
    expect(at([row(cap + 1)]).today.state).toBe("over");
    expect(at([row(1, cap + 1)]).today.state).toBe("over");
    expect(render(at([row(cap + 1)]))).toContain("OVER: today's spend has reached €2. Stop and ask the owner");
  });

  it("falls back to the vendor's own day total where no reading stands at the day's opening", () => {
    const report = reconcile({
      spend: [],
      ledger: [],
      snapshots: [{ at: "2026-10-06T08:43:00.000Z", dataforseo: { balanceCents: 3113, depositedCents: 10100, dayCents: 48.8, day: "2026-10-06", timezone: "Europe/Berlin" } }],
      adminKey: false,
      now: NOW,
    });
    expect(report.today.dataforseo).toMatchObject({ billed: 48.8, billedFrom: "vendor day" });
    expect(report.days[0]!.dataforseo.billed).toBeNull();
  });
});

describe("npm run costs — Vercel Active CPU", () => {
  const at = new Date("2026-11-10T12:00:00.000Z");
  const vercel: Snapshot = {
    at: "2026-11-10T11:00:02.000Z",
    vercel: {
      days: { "2026-11-07": { cpuSeconds: 1440, projectCpuSeconds: 1440 }, "2026-11-08": { cpuSeconds: 900, projectCpuSeconds: 720 }, "2026-11-09": { cpuSeconds: 720, projectCpuSeconds: 540 } },
      month: "2026-11",
      monthToDate: { cpuSeconds: 7200, projectCpuSeconds: 6480 },
      sitesOnAutopilot: 4,
      cpuSecondsPerSite: 135,
    },
  };

  it("prints yesterday, the 7-day mean, the month against the budget, reachkit's share and per site", () => {
    const text = render(reconcile({ spend: [], ledger: [], snapshots: [vercel], adminKey: true, now: at }));
    expect(text).toContain("Yesterday (2026-11-09): 0.20 CPU-hours; reachkit 0.15 CPU-hours (75%)");
    expect(text).toContain("7-day mean: 0.28 CPU-hours a day (3 of 7 days measured)");
    expect(text).toContain("Month to date (2026-11): 2.00 CPU-hours of the 4 CPU-hour budget (50%); reachkit 1.80 CPU-hours (90%)");
    expect(text).toContain("Per site yesterday: 135.0 CPU-seconds across 4 sites on autopilot");
  });

  it("says not measured, never 0, where nothing was read", () => {
    const none = render(reconcile({ spend: [], ledger: [], snapshots: [], adminKey: true, now: at }));
    expect(none).toContain("Vercel Active CPU: not measured");

    const bare: Snapshot = { at: vercel.at, vercel: { days: {}, month: "2026-11", monthToDate: {} } };
    const text = render(reconcile({ spend: [], ledger: [], snapshots: [bare], adminKey: true, now: at }));
    for (const line of ["Yesterday (2026-11-09): not measured; reachkit not measured", "7-day mean: not measured", "Month to date (2026-11): not measured; reachkit not measured", "Per site yesterday: not measured"]) {
      expect(text).toContain(line);
    }
    expect(text).not.toContain("0.00 CPU-hours");
  });
});

describe("the vendors' own answers, as the hourly snapshot keeps them", () => {
  it("reads DataForSEO's balance, deposits and day total in cents", () => {
    const answer = { tasks: [{ cost: 0, result: [{ timezone: "Europe/Berlin", money: { total: 101, balance: 31.133168, statistics: { day: { total: 0.48828, value: "2026-10-11" } } } }] }] };
    expect(readUserData(answer)).toEqual({ balanceCents: 3113.3168, depositedCents: 10100, dayCents: 48.828, day: "2026-10-11", timezone: "Europe/Berlin" });
    expect(readUserData({ tasks: [{ status_code: 40100, result: null }] })).toBeNull();
  });

  it("sums Anthropic's cost report, already in cents, by UTC day", () => {
    const buckets = [
      { starting_at: "2026-10-10T00:00:00Z", results: [{ amount: "123.78912", currency: "USD" }, { amount: "6.2", currency: "USD" }] },
      { starting_at: "2026-10-11T00:00:00Z", results: [] },
    ];
    expect(readCostReport(buckets)).toEqual({ days: { "2026-10-10": 129.9891, "2026-10-11": 0 } });
  });
});

describe("the box's spend log", () => {
  it("a paid call appends one line with the vendor's charge where it has one; an unpaid one appends none", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "rk-spend-"));
    try {
      process.env.RK_SPEND_LOG = path.join(dir, "spend.jsonl");
      appendSpend({ script: "page", source: "llm:writer", cents: 4.2, at: NOW });
      appendSpend({ script: "pass", source: "serp/google/organic", cents: 0.2, billed: 0.12, at: NOW });
      appendSpend({ script: "page", source: "fetch:refused", cents: 0, at: NOW });

      expect(readFileSync(process.env.RK_SPEND_LOG, "utf8").trim().split("\n")).toHaveLength(2);
      const [model, vendor] = readSpend(process.env.RK_SPEND_LOG);
      expect(model).toMatchObject({ at: NOW.toISOString(), script: "page", source: "llm:writer", cents: 4.2, billed: null });
      expect(vendor).toMatchObject({ source: "serp/google/organic", cents: 0.2, billed: 0.12 });
      expect(model!.issue).not.toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
