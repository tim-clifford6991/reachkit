// tests/publish/settings/clock.test.ts — REQ-073 c3.
//
// The publish hour in the customer's own zone, and the two days a year that
// hour is ambiguous. Every fixture pins a real zone and a real transition
// date; a naive UTC-offset implementation fails the last two.
//
// The archived plan is WO-219.
import { describe, expect, it } from "vitest";
import { nextPublishTimeAtOrAfter } from "@/lib/publish/settings/clock";
import type { PublishingSettings } from "@/lib/publish/settings/settings";

function at(zone: string | null, publishTime = "09:00"): PublishingSettings {
  return { mode: "autopilot", vetoHours: 24, publishTime, timezone: zone };
}

/** The wall clock in a zone, as the customer would read it. */
function wall(instant: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

describe('REQ-073 c3 — "it publishes at that hour in the customer\'s stated time zone … and never at an hour other than the one the screen shows"', () => {
  it("an ordinary day: the next 09:00 local, at or after the instant", () => {
    const instant = new Date("2026-06-15T06:00:00Z"); // 07:00 in Lisbon (WEST)
    const answer = nextPublishTimeAtOrAfter(instant, at("Europe/Lisbon"));
    expect(wall(answer, "Europe/Lisbon")).toBe("15/06/2026, 09:00");
    expect(answer.getTime()).toBeGreaterThan(instant.getTime());
  });

  it("asked at exactly the publish time it answers that instant, not the next day", () => {
    const exact = new Date("2026-06-15T08:00:00Z"); // 09:00 WEST
    const answer = nextPublishTimeAtOrAfter(exact, at("Europe/Lisbon"));
    expect(answer.getTime()).toBe(exact.getTime());
  });

  it("one minute past it rolls to the next local day, and to that day's 09:00", () => {
    const past = new Date("2026-06-15T08:01:00Z");
    const answer = nextPublishTimeAtOrAfter(past, at("Europe/Lisbon"));
    expect(wall(answer, "Europe/Lisbon")).toBe("16/06/2026, 09:00");
  });

  it("a zone east and a zone west of UTC give different instants for the same wall time", () => {
    const instant = new Date("2026-06-15T00:00:00Z");
    const tokyo = nextPublishTimeAtOrAfter(instant, at("Asia/Tokyo"));
    const denver = nextPublishTimeAtOrAfter(instant, at("America/Denver"));
    expect(tokyo.getTime()).not.toBe(denver.getTime());
    expect(wall(tokyo, "Asia/Tokyo")).toContain("09:00");
    expect(wall(denver, "America/Denver")).toContain("09:00");
  });

  it("the spring-forward gap resolves to the first instant after it", () => {
    // 2026-03-08, America/New_York: 02:00 EST jumps to 03:00 EDT. 02:30
    // does not occur.
    const instant = new Date("2026-03-08T05:00:00Z"); // 00:00 EST
    const answer = nextPublishTimeAtOrAfter(instant, at("America/New_York", "02:30"));
    expect(wall(answer, "America/New_York")).toBe("08/03/2026, 03:00");
    // The first instant after the gap, to the minute: 07:00 UTC.
    expect(answer.toISOString()).toBe("2026-03-08T07:00:00.000Z");
  });

  it("the spring-forward gap is not skipped to the next day — a publication is never silently dropped", () => {
    const instant = new Date("2026-03-08T05:00:00Z");
    const answer = nextPublishTimeAtOrAfter(instant, at("America/New_York", "02:30"));
    expect(wall(answer, "America/New_York").startsWith("08/03/2026")).toBe(true);
  });

  it("the autumn-back repetition resolves to the first of the two", () => {
    // 2026-11-01, America/New_York: 02:00 EDT falls back to 01:00 EST, so
    // 01:30 occurs twice — at 05:30 UTC (EDT) and again at 06:30 UTC (EST).
    const instant = new Date("2026-11-01T04:00:00Z"); // 00:00 EDT
    const answer = nextPublishTimeAtOrAfter(instant, at("America/New_York", "01:30"));
    expect(answer.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("a settings object with no zone throws rather than falling back to the server's", () => {
    expect(() => nextPublishTimeAtOrAfter(new Date(), at(null))).toThrow(/no resolvable time zone/);
  });

  it("an unresolvable zone throws too — there is no second zone source", () => {
    expect(() => nextPublishTimeAtOrAfter(new Date(), at("Mars/Olympus"))).toThrow();
  });

  it("a publishTime that is not HH:mm throws rather than resolving to midnight", () => {
    expect(() => nextPublishTimeAtOrAfter(new Date(), at("UTC", "nine"))).toThrow(/HH:mm/);
  });

  it("midnight is a publish time like any other", () => {
    const instant = new Date("2026-06-15T10:00:00Z");
    const answer = nextPublishTimeAtOrAfter(instant, at("UTC", "00:00"));
    expect(answer.toISOString()).toBe("2026-06-16T00:00:00.000Z");
  });
});
