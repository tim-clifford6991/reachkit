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

  it("judges the cap on billed spend where it is known and on recorded spend where it is not", () => {
    // Recorded today: 8.4¢ DataForSEO, 61.5¢ AI. No reading: both recorded.
    const recorded = reconcile({ spend: spend(), ledger: [], snapshots: [], adminKey: false, now: NOW });
    expect(recorded.today.judgedCents).toBeCloseTo(69.9);
    expect(recorded.today.state).toBe("ok");
    expect(render(recorded)).toContain("AI spend: estimated from tokens; no admin key");

    // Anthropic says 190¢, three times what the tokens came to: with the
    // 8.4¢ that is €1.77, past the warning.
    const billed = reconcile({ spend: spend(), ledger: [], snapshots: [{ at: "2026-10-06T11:00:00.000Z", anthropic: { days: { "2026-10-06": 190 } } }], adminKey: true, now: NOW });
    expect(billed.today.ai).toMatchObject({ billed: 190, billedFrom: "cost report" });
    expect(billed.today.judgedCents).toBeCloseTo(198.4);
    expect(billed.today.state).toBe("warn");
    expect(render(billed)).not.toContain("no admin key");

    // €2 is converted at the pinned rate: 230¢ is over it, 220¢ is not.
    const at = (cents: number) => reconcile({ spend: [], ledger: [], snapshots: [{ at: "2026-10-06T11:00:00.000Z", anthropic: { days: { "2026-10-06": cents } } }], adminKey: true, now: NOW });
    expect(at(2 * USD_PER_EUR.rate * 100 - 1).today.state).toBe("warn");
    expect(at(2 * USD_PER_EUR.rate * 100 + 1).today.state).toBe("over");
    expect(render(at(230))).toContain("ask the owner");
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
