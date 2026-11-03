// A one-off proof, deleted once the zone helpers move to @date-fns/tz: the new helpers give byte-equal answers to the
// frozen copies under ./legacy, across awkward zones and at every offset change from 2024 to 2027. `scans.week_start`
// is half of a unique key, so a single changed date would split or merge a measured week.
import { describe, expect, it } from "vitest";
import * as legacyClock from "./legacy/clock";
import * as legacyLocalWeek from "./legacy/local-week";
import * as legacyWeek from "./legacy/week";
import * as clock from "@/lib/publish/settings/clock";
import * as localWeek from "@/lib/publish/ceilings/local-week";
import * as week from "@/lib/scan/weekly/week";
import type { PublishingSettings } from "@/lib/publish/settings/settings";

const ZONES = [
  "UTC",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Berlin",
  "Africa/Cairo",
  "Africa/Casablanca",
  "Asia/Beirut",
  "Asia/Tehran",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Australia/Lord_Howe",
  "Pacific/Auckland",
  "Pacific/Chatham",
  "America/St_Johns",
  "America/New_York",
  "America/Los_Angeles",
  "America/Havana",
  "America/Santiago",
  "America/Asuncion",
  "Pacific/Apia",
] as const;

/** The zones above whose offset never changes from 2024 to 2027. */
const STEADY = new Set(["UTC", "Asia/Tehran", "Asia/Kolkata", "Asia/Kathmandu", "Pacific/Apia"]);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const FROM = Date.UTC(2024, 0, 1);
const TO = Date.UTC(2028, 0, 1);

/** Minutes east of UTC, read independently of either implementation. */
const offsetFormats = new Map<string, Intl.DateTimeFormat>();

function offset(zone: string, t: number): number {
  let format = offsetFormats.get(zone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" });
    offsetFormats.set(zone, format);
  }
  const name = format
    .formatToParts(new Date(t))
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d\d):(\d\d)/.exec(name);
  return m === null ? 0 : (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** Every instant the zone's offset changes, to the minute. */
function edges(zone: string): number[] {
  const found: number[] = [];
  for (let t = FROM; t < TO; t += 6 * HOUR) {
    if (offset(zone, t) === offset(zone, t + 6 * HOUR)) continue;
    let lo = t;
    let hi = t + 6 * HOUR;
    while (hi - lo > MINUTE) {
      const mid = lo + Math.floor((hi - lo) / 2 / MINUTE) * MINUTE;
      if (offset(zone, mid) === offset(zone, lo)) lo = mid;
      else hi = mid;
    }
    found.push(hi);
  }
  return found;
}

// Every gap and repeat here begins on the hour, the half or the quarter between midnight and 03:45.
const PUBLISH_TIMES = ["00:00", "00:30", "01:00", "01:30", "02:00", "02:15", "02:30", "02:45", "03:00", "03:15", "09:00", "23:45"];

function settings(zone: string, publishTime: string): PublishingSettings {
  return { mode: "autopilot", vetoHours: 24, publishTime, timezone: zone };
}

function iso(d: Date): string {
  return d.toISOString();
}

function compareWeek(zone: string, t: number): void {
  const at = new Date(t);
  const label = `${zone} @ ${at.toISOString()}`;
  const start = legacyWeek.weekStartFor({ at, zone });
  expect(week.weekStartFor({ at, zone }), label).toBe(start);
  expect(week.localClock(at, zone), label).toEqual(legacyWeek.localClock(at, zone));
  expect(week.isWeeklyDue({ at, zone }), label).toBe(legacyWeek.isWeeklyDue({ at, zone }));
  expect(week.weekHasBegun({ at, zone }), label).toBe(legacyWeek.weekHasBegun({ at, zone }));
  expect(iso(week.weekStartInstant({ weekStart: start, zone })), label).toBe(
    iso(legacyWeek.weekStartInstant({ weekStart: start, zone }))
  );
  expect(iso(week.nextDueAfter({ at, zone })), label).toBe(iso(legacyWeek.nextDueAfter({ at, zone })));
}

function compareCeilings(zone: string, t: number): void {
  const at = new Date(t);
  const label = `${zone} @ ${at.toISOString()}`;
  for (const fn of ["startOfLocalDay", "startOfNextLocalDay", "startOfLocalWeek", "startOfNextLocalWeek"] as const) {
    expect(iso(localWeek[fn](at, zone)), `${fn} ${label}`).toBe(iso(legacyLocalWeek[fn](at, zone)));
  }
}

function comparePublish(zone: string, t: number): void {
  const at = new Date(t);
  for (const time of PUBLISH_TIMES) {
    const s = settings(zone, time);
    const label = `${zone} ${time} @ ${at.toISOString()}`;
    expect(iso(clock.nextPublishTimeAtOrAfter(at, s)), label).toBe(iso(legacyClock.nextPublishTimeAtOrAfter(at, s)));
  }
  for (const time of ["00:00", "23:45"]) {
    const s = settings(zone, time);
    expect(clock.publishDateAtOrAfter(at, s), `${zone} ${time} @ ${at.toISOString()}`).toBe(
      legacyClock.publishDateAtOrAfter(at, s)
    );
  }
}

describe("the @date-fns/tz helpers answer byte-for-byte as the hand-written ones did", () => {
  for (const zone of ZONES) {
    it(`${zone}: every offset change from 2024 to 2027, and a sweep across the years`, { timeout: 60_000 }, () => {
      const changes = edges(zone);
      expect(changes.length > 0, zone).toBe(!STEADY.has(zone));
      for (const edge of changes) {
        // The whole week either side, every two hours, then the day either side to the quarter hour.
        for (let t = edge - 8 * DAY; t <= edge + 8 * DAY; t += 2 * HOUR) compareWeek(zone, t);
        for (let t = edge - DAY; t <= edge + DAY; t += 15 * MINUTE) compareWeek(zone, t);
        for (let t = edge - DAY; t <= edge + DAY; t += 90 * MINUTE) compareCeilings(zone, t);
        for (const t of [edge - MINUTE, edge - 1, edge, edge + MINUTE]) {
          compareWeek(zone, t);
          compareCeilings(zone, t);
          comparePublish(zone, t);
        }
        for (let t = edge - 30 * HOUR; t <= edge + 30 * HOUR; t += 15 * HOUR) comparePublish(zone, t);
      }
      // Off the edges: a stride that walks through every hour and weekday over the four years.
      for (let t = FROM; t < TO; t += 19 * HOUR + 13 * MINUTE) compareWeek(zone, t);
      for (let t = FROM; t < TO; t += 7 * DAY + 7 * HOUR + 13 * MINUTE) compareCeilings(zone, t);
      for (let t = FROM; t < TO; t += 61 * DAY + 5 * HOUR + 7 * MINUTE) comparePublish(zone, t);
    });
  }
});
