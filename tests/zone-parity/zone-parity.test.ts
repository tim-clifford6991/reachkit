// A one-off proof, deleted once the zone helpers move to @date-fns/tz: the new helpers give byte-equal answers to the
// frozen copies under ./legacy, across awkward zones and at every offset change from 2024 to 2027, except where the
// old answer was wrong by the calendar and the new one is right; those places are counted in `CORRECTED`. `scans.week_start`
// is half of a unique key, so a single changed date would split or merge a measured week.
import { describe, expect, it } from "vitest";
import * as legacyClock from "./legacy/clock";
import * as legacyLocalWeek from "./legacy/local-week";
import * as legacyWeek from "./legacy/week";
// The ceilings' entry reaches `@/lib/db`, which reads `env` at import.
import "../scan/run/harness";
import * as localWeek from "@/lib/publish/ceilings";
import * as clock from "@/lib/publish/settings/clock";
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

const dayFormats = new Map<string, Intl.DateTimeFormat>();

/** The local `YYYY-MM-DD` and ISO weekday, read straight from `Intl`. */
function local(zone: string, t: number): { date: string; weekday: number; hour: number; minute: number } {
  let format = dayFormats.get(zone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    dayFormats.set(zone, format);
  }
  const parts = format.formatToParts(new Date(t));
  const at = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${at("year")}-${at("month")}-${at("day")}`;
  const weekday = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
  return { date, weekday, hour: Number(at("hour")), minute: Number(at("minute")) };
}

function shift(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/** What each answer means, checked from the calendar alone, for the places the two implementations disagree. */
const ORACLES = {
  weekStartFor: (zone: string, t: number, answer: string): boolean => {
    const here = local(zone, t);
    return answer === shift(here.date, 1 - here.weekday);
  },
  nextDueAfter: (zone: string, t: number, answer: string): boolean => {
    const due = Date.parse(answer);
    const there = local(zone, due);
    const before = local(zone, due - MINUTE);
    const firstSix = there.hour === 6 && there.minute === 0 && before.hour < 6;
    return due > t && there.weekday === 1 && firstSix && due - t <= 7 * DAY + HOUR;
  },
  startOfLocalDay: (zone: string, t: number, answer: string): boolean => {
    const start = Date.parse(answer);
    return start <= t && local(zone, start).date === local(zone, t).date && local(zone, start - MINUTE).date !== local(zone, t).date;
  },
  startOfNextLocalDay: (zone: string, t: number, answer: string): boolean => {
    const start = Date.parse(answer);
    return start > t && local(zone, start).date === shift(local(zone, t).date, 1) && local(zone, start - MINUTE).date === local(zone, t).date;
  },
} as const;

/** Where the hand-written helpers were wrong and @date-fns/tz is right, by zone and helper, over every sample below. */
const CORRECTED: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  // Saturday 00:00–00:59 after the Friday-midnight spring-forward: the old walk stepped back onto a Sunday 23:xx.
  "Africa/Cairo": { weekStartFor: 17 },
  // Midnight occurs twice on the fall-back day: the old answer was the second, leaving the first hour in no day.
  "America/Havana": { startOfLocalDay: 73, startOfNextLocalDay: 65 },
  // Late on a Sunday before a week shortened by a spring-forward: the old `at + 7d` stepped past the next Monday.
  "Europe/London": { nextDueAfter: 4 },
  "Europe/Dublin": { nextDueAfter: 4 },
  "Asia/Beirut": { nextDueAfter: 1 },
  "Australia/Lord_Howe": { nextDueAfter: 1 },
  "America/Santiago": { nextDueAfter: 1 },
};

let corrected: Record<string, number> = {};

/** Byte-equal, or else the old answer fails the oracle and the new one passes it. */
function same(fn: keyof typeof ORACLES, zone: string, t: number, now: string, before: string): void {
  if (now === before) return;
  const label = `${fn} ${zone} @ ${new Date(t).toISOString()}: new ${now}, old ${before}`;
  expect(ORACLES[fn](zone, t, now), label).toBe(true);
  expect(ORACLES[fn](zone, t, before), label).toBe(false);
  corrected[fn] = (corrected[fn] ?? 0) + 1;
}

function compareWeek(zone: string, t: number): void {
  const at = new Date(t);
  const label = `${zone} @ ${at.toISOString()}`;
  const start = legacyWeek.weekStartFor({ at, zone });
  same("weekStartFor", zone, t, week.weekStartFor({ at, zone }), start);
  expect(week.localClock(at, zone), label).toEqual(legacyWeek.localClock(at, zone));
  expect(week.isWeeklyDue({ at, zone }), label).toBe(legacyWeek.isWeeklyDue({ at, zone }));
  expect(week.weekHasBegun({ at, zone }), label).toBe(legacyWeek.weekHasBegun({ at, zone }));
  expect(iso(week.weekStartInstant({ weekStart: start, zone })), label).toBe(
    iso(legacyWeek.weekStartInstant({ weekStart: start, zone }))
  );
  same("nextDueAfter", zone, t, iso(week.nextDueAfter({ at, zone })), iso(legacyWeek.nextDueAfter({ at, zone })));
}

function compareCeilings(zone: string, t: number): void {
  const at = new Date(t);
  const label = `${zone} @ ${at.toISOString()}`;
  for (const fn of ["startOfLocalDay", "startOfNextLocalDay"] as const) {
    same(fn, zone, t, iso(localWeek[fn](at, zone)), iso(legacyLocalWeek[fn](at, zone)));
  }
  for (const fn of ["startOfLocalWeek", "startOfNextLocalWeek"] as const) {
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
      corrected = {};
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
      expect(corrected, zone).toEqual(CORRECTED[zone] ?? {});
    });
  }
});
