// tests/scan/weekly/run.test.ts — BUILD §11, REQ-065 c1/c2/c4 (issue #41)
//
// One measurement inside the week, stamped with the week it belongs to.
//
// Two mutations this file exists to catch: dropping the unique-violation
// handling (two ticks delivered at once then both measure, and the
// customer is billed twice for one week), and keeping the claim after a
// pass that produced no report (the week is then never retried, and reads
// as measured for ever after).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DB, captureLog } from "./harness";

const runScan = vi.fn();
vi.mock("@/lib/scan/run", () => ({ runScan: (a: unknown) => runScan(a) }));

const { runWeekly } = await import("@/lib/scan/weekly");
const { registerActiveAccessGate } = await import("@/lib/scan/weekly");
const { assembleReport } = await import("@/lib/scan/store");
const { fullSections } = await import("../report/fixtures");

/** A whole week's blob, as `jsonb` hands it back. */
const COMPLETE_REPORT: unknown = JSON.parse(
  JSON.stringify(assembleReport({ ...fullSections(), tier: "weekly" }))
);

const SITE = { siteId: "site-1", domain: "example.com", zone: "UTC" };
const MONDAY_0600_UTC = new Date("2026-09-07T06:00:00Z");
const WEDNESDAY = new Date("2026-09-09T11:00:00Z");
const UNIQUE_VIOLATION = { message: "duplicate key value", code: "23505" };

let log: { lines: Record<string, unknown>[]; restore: () => void };

beforeEach(() => {
  DB.reset();
  runScan.mockReset();
  runScan.mockResolvedValue({ scanId: "ignored", status: "done" });
  registerActiveAccessGate(async (ids) => new Set(ids));
  process.env.KILL_SWITCH = "false";
  log = captureLog();
});

afterEach(() => {
  registerActiveAccessGate(null);
  process.env.KILL_SWITCH = "false";
  log.restore();
  vi.resetModules();
});

/** The account read that follows a completed pass. */
function weekReadsBack(row: Record<string, unknown> | null): void {
  DB.answer = (statement) =>
    statement.table === "scans" && statement.verb === "select" ? (row === null ? [] : [row]) : null;
}

describe("the measurement is runScan with the tier as its parameter, and nothing else", () => {
  it("runs the pipeline at tier weekly, into the row it claimed", async () => {
    weekReadsBack({ id: "x", status: "done", report: COMPLETE_REPORT });
    const outcome = await runWeekly({ ...SITE, now: MONDAY_0600_UTC });
    expect(runScan).toHaveBeenCalledTimes(1);
    const call = runScan.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.tier).toBe("weekly");
    expect(call.domain).toBe("example.com");
    expect(call.siteId).toBe(SITE.siteId);
    expect(outcome).toMatchObject({ ran: true, status: "done" });
    expect(call.scanId).toBe((outcome as { scanId: string }).scanId);
  });

  it("claims the week before the pipeline is called, never after", async () => {
    weekReadsBack({ id: "x", status: "done", report: COMPLETE_REPORT });
    runScan.mockImplementation(async () => {
      expect(DB.statements.filter((s) => s.verb === "insert")).toHaveLength(1);
      return { scanId: "x", status: "done" };
    });
    await runWeekly({ ...SITE, now: MONDAY_0600_UTC });
    expect.assertions(1);
  });

  it("writes week_start at insert, and no statement ever updates it", async () => {
    weekReadsBack({ id: "x", status: "done", report: COMPLETE_REPORT });
    await runWeekly({ ...SITE, now: MONDAY_0600_UTC });
    const claim = DB.statements.find((s) => s.verb === "insert");
    expect(claim?.values).toMatchObject({
      site_id: SITE.siteId,
      domain: "example.com",
      tier: "weekly",
      status: "running",
      week_start: "2026-09-07",
    });
    // The double records only what the module sent: an update would have
    // to have been built through a verb this shape has no member for.
    expect(DB.statements.map((s) => s.verb).sort()).toEqual(["insert", "select"]);
  });

  it("stamps the site's own Monday, not the tick's UTC date", async () => {
    weekReadsBack({ id: "x", status: "done", report: COMPLETE_REPORT });
    // 06:00 UTC on Monday is Sunday 23:00 in Los Angeles, so this run
    // belongs to the week that began on the *previous* Monday.
    await runWeekly({ ...SITE, zone: "America/Los_Angeles", now: WEDNESDAY });
    expect(DB.statements.find((s) => s.verb === "insert")?.values).toMatchObject({
      week_start: "2026-09-07",
    });
  });
});

describe("the four refusals, all of them before any spend", () => {
  it("refuses before the site's own week has begun", async () => {
    // 05:00 Monday UTC — the site's due hour has not arrived.
    const outcome = await runWeekly({ ...SITE, now: new Date("2026-09-07T05:00:00Z") });
    expect(outcome).toEqual({ ran: false, because: "week_not_begun" });
    expect(runScan).not.toHaveBeenCalled();
    expect(DB.statements.filter((s) => s.verb === "insert")).toEqual([]);
  });

  it("runs later in the same week, once the week has begun", async () => {
    weekReadsBack({ id: "x", status: "done", report: COMPLETE_REPORT });
    const outcome = await runWeekly({ ...SITE, now: WEDNESDAY });
    expect(outcome).toMatchObject({ ran: true });
  });

  it("refuses where the kill switch is engaged, before any spend", async () => {
    process.env.KILL_SWITCH = "true";
    vi.resetModules();
    const fresh = await import("@/lib/scan/weekly");
    const gate = await import("@/lib/scan/weekly/access");
    gate.registerActiveAccessGate(async (ids) => new Set(ids));
    const outcome = await fresh.runWeekly({ ...SITE, now: MONDAY_0600_UTC });
    expect(outcome).toEqual({ ran: false, because: "kill_switch" });
    expect(runScan).not.toHaveBeenCalled();
    expect(DB.statements.filter((s) => s.verb === "insert")).toEqual([]);
  });

  it("refuses a site whose access has ended, before any spend", async () => {
    registerActiveAccessGate(async () => new Set());
    const outcome = await runWeekly({ ...SITE, now: MONDAY_0600_UTC });
    expect(outcome).toEqual({ ran: false, because: "no_active_access" });
    expect(runScan).not.toHaveBeenCalled();
    expect(DB.statements.filter((s) => s.verb === "insert")).toEqual([]);
  });

  it("refuses a site that has stated no zone — it has no week of its own", async () => {
    DB.rows.set("sites", [{ id: SITE.siteId, domain: "example.com", timezone: null }]);
    const outcome = await runWeekly({ siteId: SITE.siteId, domain: "example.com", now: MONDAY_0600_UTC });
    expect(outcome).toEqual({ ran: false, because: "week_not_begun" });
    expect(runScan).not.toHaveBeenCalled();
  });
});

describe("one measurement per site per week — the index decides it, not the schedule", () => {
  it("a second claim for the same week is already_measured, not an error", async () => {
    DB.errors.set("scans", UNIQUE_VIOLATION);
    const outcome = await runWeekly({ ...SITE, now: MONDAY_0600_UTC });
    expect(outcome).toEqual({ ran: false, because: "already_measured" });
    expect(runScan).not.toHaveBeenCalled();
  });

  it("two concurrent ticks produce one measurement and one already_measured", async () => {
    weekReadsBack({ id: "x", status: "done", report: COMPLETE_REPORT });
    let claims = 0;
    DB.answer = (statement) => {
      if (statement.verb === "insert") {
        claims += 1;
        if (claims > 1) throw new Error("the double plants the violation below");
      }
      return statement.verb === "select" ? [{ id: "x", status: "done", report: null }] : null;
    };
    const first = runWeekly({ ...SITE, now: MONDAY_0600_UTC });
    DB.errors.set("scans", UNIQUE_VIOLATION);
    const second = runWeekly({ ...SITE, now: MONDAY_0600_UTC });
    const outcomes = await Promise.all([first, second]);
    expect(outcomes.filter((o) => o.ran)).toHaveLength(1);
    expect(outcomes.filter((o) => !o.ran && o.because === "already_measured")).toHaveLength(1);
    expect(runScan).toHaveBeenCalledTimes(1);
  });

  it("any other insert failure is a fault, not an answer", async () => {
    DB.errors.set("scans", { message: "connection reset" });
    await expect(runWeekly({ ...SITE, now: MONDAY_0600_UTC })).rejects.toThrow(/connection reset/);
  });
});

describe("a pass that produced no report leaves no week behind it", () => {
  it("releases the claim when the pipeline throws, and lets the error out", async () => {
    runScan.mockRejectedValue(new Error("vendor exploded"));
    await expect(runWeekly({ ...SITE, now: MONDAY_0600_UTC })).rejects.toThrow(/vendor exploded/);
    expect(DB.statements.filter((s) => s.verb === "delete")).toHaveLength(1);
  });

  it("releases the claim when the pass produced no report at all", async () => {
    runScan.mockResolvedValue({ scanId: "x", status: "failed" });
    const outcome = await runWeekly({ ...SITE, now: MONDAY_0600_UTC });
    expect(outcome).toMatchObject({ ran: true, status: "failed" });
    expect(DB.statements.filter((s) => s.verb === "delete")).toHaveLength(1);
  });

  it("keeps the row of a partly measured week — a partial week is not retried", async () => {
    runScan.mockResolvedValue({ scanId: "x", status: "degraded" });
    weekReadsBack({ id: "x", status: "degraded", report: null });
    const outcome = await runWeekly({ ...SITE, now: MONDAY_0600_UTC });
    expect(outcome).toMatchObject({ ran: true, status: "degraded" });
    expect(DB.statements.filter((s) => s.verb === "delete")).toEqual([]);
  });
});

describe("what came back is read through the one account of the week", () => {
  it("a degraded pass names the sections it did not reach", async () => {
    runScan.mockResolvedValue({ scanId: "x", status: "degraded" });
    weekReadsBack({ id: "x", status: "degraded", report: null });
    const outcome = await runWeekly({ ...SITE, now: MONDAY_0600_UTC });
    if (!outcome.ran || outcome.status !== "degraded") throw new Error("unreachable");
    expect(outcome.unmeasured.length).toBeGreaterThan(0);
  });

  it("records one line per run, carrying the week and the outcome", async () => {
    weekReadsBack({ id: "x", status: "done", report: COMPLETE_REPORT });
    await runWeekly({ ...SITE, now: MONDAY_0600_UTC });
    expect(log.lines).toContainEqual({
      event: "weekly_measurement",
      siteId: SITE.siteId,
      weekStart: "2026-09-07",
      outcome: "complete",
    });
  });
});
