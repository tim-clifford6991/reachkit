// This Week's window over every site-local day of two weeks in three zones: the site's own week from setup, today in
// it, no past pane promising its day, one count on This Week and Overview.
import { describe, expect, it } from "vitest";
import { FIXTURE_CALENDAR_FACTS, FIXTURE_PLAN_HEAD } from "@/app/(account)/app/calendar/fixture";
import { assembleMonth, pagesThisWeek, weekOf, type CalendarFacts } from "@/app/(account)/app/calendar/month";
import { addDays, clockTime, commitEnd, dayKeyOf, monthOf } from "@/app/(account)/app/calendar/dates";
import { weekScreen } from "@/app/(account)/app/calendar/week-screen";
import { weekListOf } from "@/app/(account)/app/_overview/this-week";
import { weekStartFor } from "@/lib/scan/weekly/week";
import { ALL_ARMS } from "./arms";

const time = clockTime(FIXTURE_PLAN_HEAD.publishTime!);

function screenOf(facts: CalendarFacts, setupDay: string | null) {
  const today = dayKeyOf(facts.now, facts.timeZone);
  const weekStart = weekStartFor({ at: facts.now, zone: facts.timeZone });
  // The commit re-dated to today, as a late-week re-plan leaves it: the window must not follow it.
  const head = { ...FIXTURE_PLAN_HEAD, weekStart, setupDay, commitStart: today };
  const months = [...new Set([weekStart, addDays(weekStart, 6)].map(monthOf))].map((month) => assembleMonth(facts, month, commitEnd(today, today)));
  const week = weekOf(months, { today, weekStart, setupDay });
  return { today, weekStart, week, screen: weekScreen({ week, head, published: null }) };
}

const NOWS = Array.from({ length: 14 }, (_, at) => new Date(Date.UTC(2026, 8, 14 + at, 12)));

describe.each(["Pacific/Kiritimati", "America/Los_Angeles", "UTC"])("This Week in %s", (zone) => {
  describe.each([["fixture", FIXTURE_CALENDAR_FACTS], ["every arm", ALL_ARMS]] as const)("over the %s week", (_, base) => {
    it.each(NOWS)("on %s draws the site's week through today, and no past day promises anything", (now) => {
      for (const setupDay of [null, dayKeyOf(now, zone)]) {
        const { today, weekStart, week, screen } = screenOf({ ...base, timeZone: zone, now }, setupDay);
        const days = screen.cards.map((card) => card.day);
        expect([days[0], days.includes(today)]).toEqual([setupDay ?? weekStart, true]);
        expect(days.at(-1)! <= addDays(weekStart, 6)).toBe(true);
        const list = weekListOf(week, time)!;
        expect([screen.head.pages, list.pages]).toEqual([pagesThisWeek(week), pagesThisWeek(week)]);
        expect(list.coming <= list.pages).toBe(true);
        for (const card of screen.cards.filter((each) => each.day < today)) {
          if (card.pane.kind !== "lines") expect(card.pane.next, card.day).toBeNull();
        }
        for (const entry of list.days.filter((each) => each.cell.day < today)) expect([entry.next, entry.goesLiveAt], entry.cell.day).toEqual([false, null]);
      }
    });
  });
});

it("a week with only today dated, on its first day, draws one card", () => {
  const now = new Date("2026-09-14T15:00:00Z");
  const facts = { ...FIXTURE_CALENDAR_FACTS, now, instructions: {}, drafts: FIXTURE_CALENDAR_FACTS.drafts.filter((draft) => draft.scheduledFor === "2026-09-14") };
  expect(screenOf(facts, null).screen.cards.map((card) => card.day)).toEqual(["2026-09-14"]);
});
