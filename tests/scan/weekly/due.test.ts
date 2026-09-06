// tests/scan/weekly/due.test.ts — BUILD §11, REQ-065 c1/c5 (issue #41)
//
// The hourly selection, and the four predicates that decide it. Two
// mutations this file exists to catch: selecting on the UTC weekday (the
// UTC−7 site is then measured a week early, on a Monday its own calendar
// has not reached), and dropping the active-access predicate (a customer
// who left is then measured, and billed for, every week).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DB, captureLog } from "./harness";
import { dueSites } from "@/lib/scan/weekly";
import { registerActiveAccessGate } from "@/lib/scan/weekly";
import { ActiveAccessGateNotRegistered } from "@/lib/scan/weekly/access";

const MONDAY_0600_UTC = new Date("2026-09-07T06:00:00Z");
const LA = "America/Los_Angeles"; // UTC−7 — Sunday 23:00 at that instant
const BERLIN = "Europe/Berlin";

function site(id: string, zone: string) {
  return { id, domain: `${id}.example.com`, timezone: zone };
}

/** Every site's owner is paying, unless a suite says otherwise. */
function everyoneHasAccess(): void {
  registerActiveAccessGate(async (ids) => new Set(ids));
}

let log: { lines: Record<string, unknown>[]; restore: () => void };

beforeEach(() => {
  DB.reset();
  everyoneHasAccess();
  log = captureLog();
});

afterEach(() => {
  registerActiveAccessGate(null);
  log.restore();
});

describe("a site is selected only once its own local Monday and due hour arrive", () => {
  it("selects the UTC site at 06:00 UTC on Monday and stamps it with that Monday", async () => {
    DB.rows.set("sites", [site("utc-site", "UTC")]);
    expect(await dueSites(MONDAY_0600_UTC)).toEqual([
      { siteId: "utc-site", domain: "utc-site.example.com", zone: "UTC", weekStart: "2026-09-07" },
    ]);
  });

  it("does not select the site at UTC−7 at that same instant — its own clock says Sunday", async () => {
    DB.rows.set("sites", [site("la-site", LA)]);
    expect(await dueSites(MONDAY_0600_UTC)).toEqual([]);
  });

  it("selects that same site seven hours later, on its own Monday 06:00", async () => {
    DB.rows.set("sites", [site("la-site", LA)]);
    const own = await dueSites(new Date("2026-09-07T13:00:00Z"));
    expect(own).toEqual([
      { siteId: "la-site", domain: "la-site.example.com", zone: LA, weekStart: "2026-09-07" },
    ]);
  });

  it("selects each site exactly once across the 168 ticks of a week", async () => {
    DB.rows.set("sites", [site("utc-site", "UTC"), site("la-site", LA), site("berlin", BERLIN)]);
    const selected: string[] = [];
    for (let hour = 0; hour < 168; hour++) {
      const at = new Date(Date.UTC(2026, 8, 7, 0, 0, 0) + hour * 3_600_000);
      for (const due of await dueSites(at)) selected.push(due.siteId);
    }
    expect(selected.sort()).toEqual(["berlin", "la-site", "utc-site"]);
  });

  it("never selects a site that has stated no zone — there is no clock to decide its Monday in", async () => {
    DB.rows.set("sites", [{ id: "no-zone", domain: "no-zone.example.com", timezone: null }]);
    expect(await dueSites(MONDAY_0600_UTC)).toEqual([]);
  });
});

describe("active access is billing's single gate, and nothing here is a second one", () => {
  it("a site whose access has ended is never selected, whatever its local weekday", async () => {
    DB.rows.set("sites", [site("utc-site", "UTC"), site("gone", "UTC")]);
    registerActiveAccessGate(async () => new Set(["utc-site"]));
    const due = await dueSites(MONDAY_0600_UTC);
    expect(due.map((s) => s.siteId)).toEqual(["utc-site"]);
  });

  it("asks the gate once for the whole tick, not once per site", async () => {
    DB.rows.set("sites", [site("a", "UTC"), site("b", "UTC"), site("c", "UTC")]);
    let asks = 0;
    registerActiveAccessGate(async (ids) => {
      asks += 1;
      return new Set(ids);
    });
    await dueSites(MONDAY_0600_UTC);
    expect(asks).toBe(1);
  });

  it("refuses to answer at all while billing has registered no gate", async () => {
    DB.rows.set("sites", [site("utc-site", "UTC")]);
    registerActiveAccessGate(null);
    await expect(dueSites(MONDAY_0600_UTC)).rejects.toBeInstanceOf(ActiveAccessGateNotRegistered);
  });

  it("does not ask the gate on a tick that is nobody's Monday", async () => {
    DB.rows.set("sites", [site("utc-site", "UTC")]);
    registerActiveAccessGate(null);
    await expect(dueSites(new Date("2026-09-09T06:00:00Z"))).resolves.toEqual([]);
  });
});

describe("a week already stamped is never measured twice, and a failed one is retried", () => {
  it("excludes a site that already carries a weekly row for the week it is in", async () => {
    DB.rows.set("sites", [site("utc-site", "UTC"), site("other", "UTC")]);
    DB.answer = (statement) =>
      statement.table === "scans" ? [{ site_id: "utc-site", week_start: "2026-09-07" }] : null;
    const due = await dueSites(MONDAY_0600_UTC);
    expect(due.map((s) => s.siteId)).toEqual(["other"]);
  });

  it("a row for a different week does not exclude the site — the key is the pair", async () => {
    DB.rows.set("sites", [site("utc-site", "UTC")]);
    DB.answer = (statement) =>
      statement.table === "scans" ? [{ site_id: "utc-site", week_start: "2026-08-31" }] : null;
    const due = await dueSites(MONDAY_0600_UTC);
    expect(due.map((s) => s.siteId)).toEqual(["utc-site"]);
  });

  it("a site whose run left no row is selected again on the next hourly tick", async () => {
    DB.rows.set("sites", [site("utc-site", "UTC")]);
    // Nothing was stamped, which is what a released claim leaves behind.
    expect((await dueSites(MONDAY_0600_UTC)).map((s) => s.siteId)).toEqual(["utc-site"]);
  });
});

describe("the tick's budget and its one log line", () => {
  it("sends two statements for a whole tick, however many sites there are", async () => {
    DB.rows.set(
      "sites",
      Array.from({ length: 250 }, (_, n) => site(`site-${n}`, "UTC"))
    );
    await dueSites(MONDAY_0600_UTC);
    expect(DB.statements.map((s) => `${s.table}:${s.verb}`)).toEqual(["sites:select", "scans:select"]);
  });

  it("records the counts, and nothing about a customer", async () => {
    DB.rows.set("sites", [site("utc-site", "UTC"), site("la-site", LA)]);
    await dueSites(MONDAY_0600_UTC);
    expect(log.lines).toContainEqual({ event: "weekly_due_selection", candidates: 1, due: 1 });
    expect(JSON.stringify(log.lines)).not.toContain("utc-site");
  });
});
