// tests/jobs/site-clock.test.ts — BUILD §11
//
// `draft/generate`'s own evening gate, read in each site's zone.
//
// The weekly half of ADR-060 — the Monday, the week key and the next due
// date — moved to `src/lib/scan/weekly/week.ts` with issue #41, so that
// the label a tick decides on and the label a measurement is stored under
// are one derivation. Its suite is `tests/scan/weekly/week.test.ts`; the
// two suites here that read it come along with it, and what stays is the
// daily gate this file still owns.
import { describe, expect, it } from "vitest";
import { isDraftDue, localClock, nextPublishDate } from "@/jobs/site-clock";
import { DRAFT_DUE_HOUR_LOCAL } from "@/lib/config/constants";

// 2026-09-07 is a Monday.
const MONDAY_0600_UTC = new Date("2026-09-07T06:00:00Z");
const LA = "America/Los_Angeles"; // UTC−7 on this date
const BERLIN = "Europe/Berlin"; // UTC+2 on this date

describe("draft/generate is due at the site's own evening hour, every day", () => {
  it("each site is due once a day, in its own zone", () => {
    const start = Date.UTC(2026, 8, 7, 0, 0, 0);
    for (const zone of ["UTC", LA, BERLIN]) {
      const dueHours = [...Array(24).keys()].filter((h) =>
        isDraftDue(new Date(start + h * 3_600_000), zone)
      );
      expect(dueHours, zone).toHaveLength(1);
    }
  });

  it("two sites in different zones are each triggered in their own evening", () => {
    const berlinEvening = new Date("2026-09-07T16:00:00Z"); // 18:00 Berlin
    const laEvening = new Date("2026-09-08T01:00:00Z"); // 18:00 Los Angeles
    expect(isDraftDue(berlinEvening, BERLIN)).toBe(true);
    expect(isDraftDue(berlinEvening, LA)).toBe(false);
    expect(isDraftDue(laEvening, LA)).toBe(true);
    expect(isDraftDue(laEvening, BERLIN)).toBe(false);
    expect(localClock(laEvening, LA).hour).toBe(DRAFT_DUE_HOUR_LOCAL);
  });

  it("generation runs the evening before the date it publishes for", () => {
    const berlinEvening = new Date("2026-09-07T16:00:00Z");
    expect(localClock(berlinEvening, BERLIN).date).toBe("2026-09-07");
    expect(nextPublishDate(berlinEvening, BERLIN)).toBe("2026-09-08");
  });
});

describe("a zone this module cannot read is a failure, not a fallback to UTC", () => {
  it("throws on an unknown time zone", () => {
    expect(() => localClock(MONDAY_0600_UTC, "Mars/Olympus")).toThrow();
  });
});
