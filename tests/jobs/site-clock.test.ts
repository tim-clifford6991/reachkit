// tests/jobs/site-clock.test.ts — BUILD §11 · SPEC §7 (issue 1337)
//
// `draft/generate`'s own gate and the date it writes for, read in each
// site's zone, against the rule a page actually publishes by.
//
// The weekly half of ADR-060 — the Monday, the week key and the next due
// date — is `src/lib/scan/weekly/week.ts`; its suite is
// `tests/scan/weekly/week.test.ts`.
import { describe, expect, it } from "vitest";
import { isDraftDue, localClock, nextPublishDate, tickHour, type DraftClock } from "@/jobs/site-clock";
import { becomesPublishable } from "@/lib/publish/publishable/predicate";
import type { DraftView } from "@/lib/publish/types";

const MS_PER_HOUR = 3_600_000;
const ZONES = ["Europe/Berlin", "America/Los_Angeles", "Australia/Sydney"];
const PUBLISH_TIMES = ["00:00", "09:00", "17:45"];
const VETO_HOURS = [0, 12, 24, 48];
/** Two weeks of hourly ticks in which Berlin (25 October 2026) and Los
 *  Angeles (1 November) both leave summer time. Each tick is delivered 40
 *  seconds late, as a cron is. */
const FIRST_TICK = Date.UTC(2026, 9, 20, 0, 0, 40);
const TICKS = 14 * 24;

/** The page as the publishing rule reads it once the tick has opened its
 *  window: `enterReview` stamps the deadline at the tick's hour plus the
 *  site's veto hours. */
function untouched(opened: Date, site: DraftClock): DraftView {
  return {
    id: "d1",
    siteId: "s1",
    state: "in_review",
    vetoDeadline: new Date(opened.getTime() + site.vetoHours * MS_PER_HOUR),
    approvedAt: null,
    approvedBy: null,
    hasUnsavedEdit: false,
    claimRecheckOutstanding: false,
    told: null,
    governing: { mode: "autopilot", vetoHours: site.vetoHours, publishTime: site.publishTime, timezone: site.timeZone },
  } as DraftView;
}

function publishesAt(opened: Date, site: DraftClock): Date {
  const answer = becomesPublishable(untouched(opened, site));
  if (!answer.publishable) throw new Error(`not publishable: ${answer.because}`);
  return answer.at;
}

const nextDay = (date: string): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + 24 * MS_PER_HOUR).toISOString().slice(0, 10);

describe("issue 1337 — a page nobody touches publishes on the date it was written for", () => {
  for (const timeZone of ZONES) {
    for (const publishTime of PUBLISH_TIMES) {
      for (const vetoHours of VETO_HOURS) {
        it(`${timeZone} · ${publishTime} · ${vetoHours} h`, () => {
          const site: DraftClock = { timeZone, publishTime, vetoHours };
          const written: string[] = [];
          for (let n = 0; n < TICKS; n++) {
            const tick = new Date(FIRST_TICK + n * MS_PER_HOUR);
            if (!isDraftDue(tick, site)) continue;
            const opened = tickHour(tick);
            const date = nextPublishDate(opened, site);
            const at = publishesAt(opened, site);
            // The day the calendar gives the page is the day it goes out.
            expect(localClock(at, timeZone).date, `tick ${tick.toISOString()}`).toBe(date);
            // And it was not written a day early to get there.
            expect(at.getTime() - opened.getTime() - vetoHours * MS_PER_HOUR).toBeLessThan(MS_PER_HOUR);
            written.push(date);
          }
          // One page for every date, none skipped and none twice.
          expect(written.length).toBeGreaterThanOrEqual(13);
          written.slice(1).forEach((date, i) => expect(date).toBe(nextDay(written[i] as string)));
        });
      }
    }
  }

  it("the page that showed it: written 2026-10-07 for 09:00 Berlin on a 24 h window", () => {
    const site: DraftClock = { timeZone: "Europe/Berlin", publishTime: "09:00", vetoHours: 24 };
    // 11:33 UTC is not this site's hour; 07:00 UTC is 09:00 in Berlin.
    expect(isDraftDue(new Date("2026-10-07T11:33:00Z"), site)).toBe(false);
    const due = new Date("2026-10-07T07:00:20Z");
    expect(isDraftDue(due, site)).toBe(true);
    expect(nextPublishDate(tickHour(due), site)).toBe("2026-10-08");
    expect(publishesAt(tickHour(due), site).toISOString()).toBe("2026-10-08T07:00:00.000Z");
  });

  it("outside the due hour the date is the first one whose publish time is the window away", () => {
    const site: DraftClock = { timeZone: "Europe/Berlin", publishTime: "09:00", vetoHours: 24 };
    const afternoon = new Date("2026-10-07T11:33:00Z");
    expect(nextPublishDate(afternoon, site)).toBe("2026-10-09");
    expect(localClock(publishesAt(afternoon, site), site.timeZone).date).toBe("2026-10-09");
  });
});

describe("a zone this module cannot read is a failure, not a fallback to UTC", () => {
  it("throws on an unknown time zone", () => {
    expect(() => localClock(new Date("2026-09-07T06:00:00Z"), "Mars/Olympus")).toThrow();
    expect(() => isDraftDue(new Date("2026-09-07T06:00:00Z"), { timeZone: "Mars/Olympus", publishTime: "09:00", vetoHours: 24 })).toThrow();
  });
});
