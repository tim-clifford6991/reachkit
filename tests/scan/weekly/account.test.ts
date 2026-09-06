// tests/scan/weekly/account.test.ts — BUILD §11, REQ-065 c2–c5 (issue #41)
//
// The one account of a week, total over four cases. Two mutations this
// file exists to catch: returning `complete` for a degraded row (a partly
// measured week then reads as a whole one, which criterion 4 forbids), and
// returning `not_measured` for a site whose access has ended (which
// announces a measurement to somebody we owe none).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DB, captureLog } from "./harness";
import { accountForWeek, nextDueOn, unmeasuredPartsOf } from "@/lib/scan/weekly";
import { registerActiveAccessGate } from "@/lib/scan/weekly";
import { assembleReport } from "@/lib/scan/store";
import { fullSections, unreachedSections, AT } from "../report/fixtures";

const SITE = "site-1";
const WEEK = "2026-09-07";
const NOW = new Date("2026-09-09T10:00:00Z"); // the Wednesday of that week

/** The blob as it is read back: `jsonb` out and dates revived by
 *  `readStoredReport`, which is what `readWeekScan` runs it through. */
function stored(sections = fullSections()): unknown {
  return JSON.parse(JSON.stringify(assembleReport({ ...sections, tier: "weekly" })));
}

function weekRow(over: Record<string, unknown>): void {
  DB.answer = (statement) =>
    statement.table === "scans" ? [{ id: "scan-1", status: "done", report: stored(), ...over }] : null;
}

let log: { lines: Record<string, unknown>[]; restore: () => void };

beforeEach(() => {
  DB.reset();
  DB.rows.set("sites", [{ id: SITE, domain: "example.com", timezone: "UTC" }]);
  registerActiveAccessGate(async (ids) => new Set(ids));
  log = captureLog();
});

afterEach(() => {
  registerActiveAccessGate(null);
  log.restore();
});

describe("a completed week reads back complete, with the date it was taken", () => {
  it("returns complete and the measurement's own date, never the storage's", async () => {
    weekRow({ status: "done" });
    const account = await accountForWeek({ siteId: SITE, weekStart: WEEK, now: NOW });
    expect(account).toEqual({ kind: "complete", measuredAt: AT });
  });

  it("asks the database once — it is on the render path of every app screen", async () => {
    weekRow({ status: "done" });
    await accountForWeek({ siteId: SITE, weekStart: WEEK, now: NOW });
    expect(DB.statements.map((s) => `${s.table}:${s.verb}`)).toEqual(["scans:select"]);
  });

  it("reads the week by the pair, and by the weekly tier", async () => {
    weekRow({ status: "done" });
    await accountForWeek({ siteId: SITE, weekStart: WEEK, now: NOW });
    expect(DB.statements[0]?.filters).toEqual([
      ["site_id", SITE],
      ["tier", "weekly"],
      ["week_start", WEEK],
    ]);
  });
});

describe("a week that ran but could not measure everything is never complete", () => {
  it("returns partial with its date and the sections it did not reach", async () => {
    weekRow({ status: "degraded", report: stored(unreachedSections()) });
    const account = await accountForWeek({ siteId: SITE, weekStart: WEEK, now: NOW });
    expect(account.kind).toBe("partial");
    if (account.kind !== "partial") throw new Error("unreachable");
    expect(account.measuredAt).toEqual(AT);
    expect(account.unmeasured).toEqual(["on_page", "market", "rankings", "ai_answers", "rivals", "score"]);
  });

  it("a row stored as done whose blob is missing a section is partial, not complete", async () => {
    weekRow({ status: "done", report: stored(fullSections({ rivals: unreachedSections().rivals })) });
    const account = await accountForWeek({ siteId: SITE, weekStart: WEEK, now: NOW });
    expect(account.kind).toBe("partial");
    if (account.kind !== "partial") throw new Error("unreachable");
    expect(account.unmeasured).toEqual(["rivals"]);
  });

  it("a measured zero is a measurement, not a missing section — the cold-start law", async () => {
    // A site that ranks for nothing has read every section; nothing here
    // may report that as unmeasured.
    expect(unmeasuredPartsOf(assembleReport(fullSections()))).toEqual([]);
  });
});

describe("a week with no measurement says so, and names the day the next one is due", () => {
  it("returns not_measured with the next site-local Monday at its due hour", async () => {
    DB.answer = (statement) => (statement.table === "scans" ? [] : null);
    const account = await accountForWeek({ siteId: SITE, weekStart: WEEK, now: NOW });
    expect(account).toEqual({ kind: "not_measured", nextDueOn: new Date("2026-09-14T06:00:00Z") });
  });

  it("stands across later reads until that week's own measurement completes", async () => {
    DB.answer = (statement) => (statement.table === "scans" ? [] : null);
    for (const later of ["2026-09-10T08:00:00Z", "2026-09-12T20:00:00Z"]) {
      const account = await accountForWeek({ siteId: SITE, weekStart: WEEK, now: new Date(later) });
      expect(account.kind).toBe("not_measured");
    }
    // No earlier week's figures are returned in its place: the variant
    // carries a due date and nothing measured at all.
    DB.answer = (statement) => (statement.table === "scans" ? [] : null);
    const account = await accountForWeek({ siteId: SITE, weekStart: WEEK, now: NOW });
    expect(account).not.toHaveProperty("measuredAt");
  });

  it("a running row is not yet a measurement", async () => {
    weekRow({ status: "running", report: null });
    const account = await accountForWeek({ siteId: SITE, weekStart: WEEK, now: NOW });
    expect(account.kind).toBe("not_measured");
  });
});

describe("a site whose access has ended is owed no week, and is promised none", () => {
  it("returns not_owed, announcing no next measurement", async () => {
    DB.answer = (statement) => (statement.table === "scans" ? [] : null);
    registerActiveAccessGate(async () => new Set());
    const account = await accountForWeek({ siteId: SITE, weekStart: WEEK, now: NOW });
    expect(account).toEqual({ kind: "not_owed" });
  });

  it("weeks already measured under active access still read back with their own dates", async () => {
    weekRow({ status: "done" });
    registerActiveAccessGate(async () => new Set());
    expect(await accountForWeek({ siteId: SITE, weekStart: WEEK, now: NOW })).toEqual({
      kind: "complete",
      measuredAt: AT,
    });
  });

  it("a partly measured week likewise survives the subscription", async () => {
    weekRow({ status: "degraded", report: stored(unreachedSections()) });
    registerActiveAccessGate(async () => new Set());
    const account = await accountForWeek({ siteId: SITE, weekStart: WEEK, now: NOW });
    expect(account.kind).toBe("partial");
  });
});

describe("the next due date is the site's own, and there is only one of it", () => {
  it("reads the zone the customer stated", async () => {
    DB.rows.set("sites", [{ id: SITE, domain: "example.com", timezone: "America/Los_Angeles" }]);
    // 06:00 Monday in Los Angeles is 13:00 UTC.
    expect(await nextDueOn({ siteId: SITE, now: NOW })).toEqual(new Date("2026-09-14T13:00:00Z"));
  });

  it("refuses to name a date for a site that has stated no zone", async () => {
    DB.rows.set("sites", [{ id: SITE, domain: "example.com", timezone: null }]);
    await expect(nextDueOn({ siteId: SITE, now: NOW })).rejects.toThrow(/time zone/);
  });
});
