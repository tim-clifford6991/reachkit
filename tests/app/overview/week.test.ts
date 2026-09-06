// tests/app/overview/week.test.ts — BUILD §4.5 item 5, REQ-041 c6.
//
// "which days of this week are done, which is today, and which are still to
// come" — in the customer's own time zone. The discriminating case is an
// instant that is one calendar day in UTC and another where the customer is.
import { describe, expect, it } from "vitest";
import { CALENDAR_HREF, DAY_MARK, readWeek } from "@/app/(account)/app/_overview/week";

const NEW_YORK = "America/New_York";

describe("the seven days", () => {
  it("is always seven, starting on the week's own Monday", () => {
    const week = readWeek({ today: new Date(Date.UTC(2026, 8, 4, 14, 0)), timeZone: NEW_YORK });
    expect(week.days).toHaveLength(7);
    // 2026-08-31 is the Monday of the week 2026-09-04 (a Friday) sits in.
    expect(week.days[0]?.date).toEqual(new Date(Date.UTC(2026, 7, 31)));
    expect(week.days[6]?.date).toEqual(new Date(Date.UTC(2026, 8, 6)));
  });

  it("marks the days before today done, today today, and the rest to come", () => {
    const week = readWeek({ today: new Date(Date.UTC(2026, 8, 4, 14, 0)), timeZone: NEW_YORK });
    expect(week.days.map((d) => d.state)).toEqual([
      "done",
      "done",
      "done",
      "done",
      "today",
      "to-come",
      "to-come",
    ]);
  });

  it("Monday's own week starts with today and has no done day at all", () => {
    const week = readWeek({ today: new Date(Date.UTC(2026, 7, 31, 14, 0)), timeZone: NEW_YORK });
    expect(week.days[0]?.state).toBe("today");
    expect(week.days.filter((d) => d.state === "done")).toHaveLength(0);
  });

  it("Sunday is the week's last day, not the next week's first", () => {
    const week = readWeek({ today: new Date(Date.UTC(2026, 8, 6, 14, 0)), timeZone: NEW_YORK });
    expect(week.days[6]?.state).toBe("today");
    expect(week.days.filter((d) => d.state === "to-come")).toHaveLength(0);
  });
});

describe("today is today where the customer is", () => {
  it("an instant that is already Monday in UTC is still Sunday in a US zone", () => {
    // 2026-09-07T02:00Z is Monday in UTC and 22:00 on Sunday in New York.
    const at = new Date(Date.UTC(2026, 8, 7, 2, 0));
    const newYork = readWeek({ today: at, timeZone: NEW_YORK });
    const utc = readWeek({ today: at, timeZone: "UTC" });
    expect(newYork.days[6]?.state).toBe("today");
    expect(utc.days[0]?.state).toBe("today");
    // ...and they are two different weeks, which is the whole point.
    expect(newYork.days[0]?.date).not.toEqual(utc.days[0]?.date);
  });
});

describe("identity is never colour alone", () => {
  it("every day carries the written word for its state", () => {
    const week = readWeek({ today: new Date(Date.UTC(2026, 8, 4, 14, 0)), timeZone: NEW_YORK });
    for (const day of week.days) expect(day.markKey).toBe(DAY_MARK[day.state]);
  });

  it("the three states take three distinct keys", () => {
    const keys = Object.values(DAY_MARK);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("the one control", () => {
  it("links to the calendar and nowhere else (§4.4: no other navigation)", () => {
    const week = readWeek({ today: new Date(Date.UTC(2026, 8, 4)), timeZone: NEW_YORK });
    expect(week.calendarHref).toBe(CALENDAR_HREF);
    expect(CALENDAR_HREF).toBe("/app/calendar");
  });
});
