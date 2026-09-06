// tests/scan/weekly/week.test.ts — BUILD §11, REQ-065 c1/c2 (issue #41)
//
// ADR-060, verbatim: "Weekly measurement is triggered hourly and gated on
// each site's own local Monday; 'Mon 06:00 UTC' is not the trigger."
//
// The mutation this file exists to catch is computing the week from UTC: a
// site at UTC−7 is due on *its* Monday 06:00 (13:00 UTC) and is **not** due
// at 06:00 UTC, when its own clock still says Sunday 23:00 — and the week
// that instant belongs to there began on the *previous* Monday. A gate or a
// key written against UTC passes the first and fails here.
import { describe, expect, it } from "vitest";
// The module's public entry reaches `@/lib/db`, which reads `env` at import.
import "../run/harness";
import {
  isWeeklyDue,
  localClock,
  nextDueAfter,
  weekKey,
  weekStartFor,
} from "@/lib/scan/weekly";
import { WEEK_START, WEEKLY_DUE_HOUR_LOCAL } from "@/lib/config/constants";

// 2026-09-07 is a Monday.
const MONDAY_0600_UTC = new Date("2026-09-07T06:00:00Z");
const LA = "America/Los_Angeles"; // UTC−7 on this date
const BERLIN = "Europe/Berlin"; // UTC+2 on this date
const AUCKLAND = "Pacific/Auckland"; // UTC+12
const KATHMANDU = "Asia/Kathmandu"; // UTC+5:45 — a quarter-hour zone
const CHICAGO = "America/Chicago"; // UTC−5 on this date
const DENVER = "America/Denver"; // UTC−6 on this date

describe("the gate is the site's own local Monday, never Mon 06:00 UTC", () => {
  it("is pinned to Monday, and reads the pin rather than writing it twice", () => {
    expect(WEEK_START).toBe("monday");
  });

  it("a UTC site is due at 06:00 UTC on Monday", () => {
    expect(isWeeklyDue({ at: MONDAY_0600_UTC, zone: "UTC" })).toBe(true);
  });

  it("a site at UTC−7 is NOT due at 06:00 UTC — its own clock still says Sunday", () => {
    expect(localClock(MONDAY_0600_UTC, LA)).toMatchObject({ weekday: 7, hour: 23 });
    expect(isWeeklyDue({ at: MONDAY_0600_UTC, zone: LA })).toBe(false);
  });

  it("that same site IS due at its own Monday 06:00 local (13:00 UTC)", () => {
    const own = new Date("2026-09-07T13:00:00Z");
    expect(localClock(own, LA)).toMatchObject({ weekday: 1, hour: WEEKLY_DUE_HOUR_LOCAL });
    expect(isWeeklyDue({ at: own, zone: LA })).toBe(true);
  });

  it("a site east of UTC is due before the UTC one, on its own clock", () => {
    const own = new Date("2026-09-07T04:00:00Z"); // 06:00 in Berlin
    expect(isWeeklyDue({ at: own, zone: BERLIN })).toBe(true);
    expect(isWeeklyDue({ at: own, zone: "UTC" })).toBe(false);
  });

  it.each([["UTC"], [LA], [BERLIN], [AUCKLAND], [KATHMANDU]])(
    "%s: exactly one of the 168 hourly ticks in a week is due",
    (zone) => {
      const start = Date.UTC(2026, 8, 7, 0, 0, 0);
      let due = 0;
      for (let hour = 0; hour < 168; hour++) {
        if (isWeeklyDue({ at: new Date(start + hour * 3_600_000), zone })) due++;
      }
      expect(due).toBe(1);
    }
  );
});

describe("weekStartFor returns the site-local Monday, for every offset", () => {
  it.each([
    ["UTC", "2026-09-07"],
    [BERLIN, "2026-09-07"],
    [AUCKLAND, "2026-09-07"],
    [KATHMANDU, "2026-09-07"],
    // ADR-060's own sentence, as values: at UTC−6 Monday has just begun,
    // and one hour further west it has not — the site at UTC−7 is still in
    // the week that began on the *previous* Monday, and a schedule fixed to
    // Mon 06:00 UTC would file its measurement there.
    [CHICAGO, "2026-09-07"],
    [DENVER, "2026-09-07"],
    [LA, "2026-08-31"],
  ])("at Monday 06:00 UTC, %s is in the week beginning %s", (zone, weekStart) => {
    expect(weekStartFor({ at: MONDAY_0600_UTC, zone })).toBe(weekStart);
  });

  it("every tick inside one site-local week yields the same week", () => {
    const start = Date.UTC(2026, 8, 7, 7, 0, 0); // 00:00 Monday in Los Angeles
    const keys = new Set<string>();
    for (let hour = 0; hour < 24 * 7; hour++) {
      keys.add(weekStartFor({ at: new Date(start + hour * 3_600_000), zone: LA }));
    }
    expect([...keys]).toEqual(["2026-09-07"]);
  });

  it("a week is a calendar date, so a zone change does not move a week already measured", () => {
    // The measurement was taken in Berlin and stamped `2026-09-07`. The
    // customer moves west; the stamp is a stored string and does not
    // recompute. What *would* move is a stored instant, read back in the
    // new zone — the mutation this test exists to catch.
    const takenAt = new Date("2026-09-07T04:00:00Z");
    const stamped = weekStartFor({ at: takenAt, zone: BERLIN });
    expect(stamped).toBe("2026-09-07");
    expect(weekKey({ siteId: "site-1", weekStart: stamped })).toBe("site-1:2026-09-07");
    // Read in a new zone, the same instant is in a different local week —
    // which is exactly why the label is stored and never recomputed.
    expect(weekStartFor({ at: takenAt, zone: LA })).toBe("2026-08-31");
  });

  it("crosses a spring-forward transition without skipping a Monday", () => {
    // Europe/Berlin springs forward on 2026-03-29 (a Sunday).
    for (let hour = 0; hour < 24 * 9; hour++) {
      const at = new Date(Date.UTC(2026, 2, 23, 0, 0, 0) + hour * 3_600_000);
      const start = weekStartFor({ at, zone: BERLIN });
      expect(["2026-03-23", "2026-03-30"]).toContain(start);
      expect(localClock(new Date(`${start}T12:00:00Z`), "UTC").weekday).toBe(1);
    }
  });

  it("crosses a fall-back transition without repeating one", () => {
    // Europe/Berlin falls back on 2026-10-25 (a Sunday).
    for (let hour = 0; hour < 24 * 9; hour++) {
      const at = new Date(Date.UTC(2026, 9, 19, 0, 0, 0) + hour * 3_600_000);
      expect(["2026-10-19", "2026-10-26"]).toContain(weekStartFor({ at, zone: BERLIN }));
    }
  });
});

describe("the next measurement is due on a Monday, in the site's own zone", () => {
  it("names this week's Monday while its due hour has not yet arrived", () => {
    const sundayNight = new Date("2026-09-07T05:00:00Z"); // 05:00 Monday UTC
    const due = nextDueAfter({ at: sundayNight, zone: "UTC" });
    expect(due.toISOString()).toBe("2026-09-07T06:00:00.000Z");
  });

  it("names next week's Monday once this week's hour has passed", () => {
    const due = nextDueAfter({ at: MONDAY_0600_UTC, zone: "UTC" });
    expect(due.toISOString()).toBe("2026-09-14T06:00:00.000Z");
  });

  it.each([[LA], [BERLIN], [AUCKLAND], [KATHMANDU]])(
    "%s: the date named is that zone's own Monday at its own due hour",
    (zone) => {
      const due = nextDueAfter({ at: MONDAY_0600_UTC, zone });
      const local = localClock(due, zone);
      expect(local.weekday).toBe(1);
      expect(local.hour).toBe(WEEKLY_DUE_HOUR_LOCAL);
      expect(due.getTime()).toBeGreaterThan(MONDAY_0600_UTC.getTime());
    }
  );

  it("never names an instant in the past, at any hour of any week, in any zone", () => {
    for (const zone of ["UTC", LA, BERLIN, AUCKLAND, KATHMANDU]) {
      for (let hour = 0; hour < 24 * 21; hour++) {
        const at = new Date(Date.UTC(2026, 2, 20, 0, 0, 0) + hour * 3_600_000);
        const due = nextDueAfter({ at, zone });
        expect(due.getTime(), `${zone} @ ${at.toISOString()}`).toBeGreaterThan(at.getTime());
        expect(localClock(due, zone).weekday, `${zone} @ ${at.toISOString()}`).toBe(1);
        expect(localClock(due, zone).hour, `${zone} @ ${at.toISOString()}`).toBe(
          WEEKLY_DUE_HOUR_LOCAL
        );
      }
    }
  });
});

describe("a zone this module cannot read is a failure, not a fallback to UTC", () => {
  it("throws on an unknown time zone", () => {
    expect(() => localClock(MONDAY_0600_UTC, "Mars/Olympus")).toThrow();
  });
});
