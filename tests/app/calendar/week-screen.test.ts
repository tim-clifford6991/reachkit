// This Week's one model over the fixture week and its every arm: the cards, their count and the pane each opens agree.
import { describe, expect, it } from "vitest";
import { FIXTURE_CALENDAR_FACTS, FIXTURE_PLAN_HEAD } from "@/app/(account)/app/calendar/fixture";
import { assembleMonth, weekOf, type CalendarFacts } from "@/app/(account)/app/calendar/month";
import { dayKeyOf, monthOf, planWeek } from "@/app/(account)/app/calendar/dates";
import { weekScreen } from "@/app/(account)/app/calendar/week-screen";
import { ALL_ARMS } from "./arms";

/** The fixture week with one day being written and one stopped by the system. */
const WRITING: CalendarFacts = {
  ...FIXTURE_CALENDAR_FACTS,
  drafts: FIXTURE_CALENDAR_FACTS.drafts.map((draft) =>
    draft.scheduledFor === "2026-09-17"
      ? { ...draft, state: "generating", startedAt: FIXTURE_CALENDAR_FACTS.now }
      : draft.scheduledFor === "2026-09-18"
        ? { ...draft, state: "skipped" }
        : draft
  ),
};

function screenOf(facts: CalendarFacts) {
  const today = dayKeyOf(facts.now, facts.timeZone);
  const week = weekOf([...new Set(planWeek(today).map(monthOf))].map((month) => assembleMonth(facts, month)), today);
  return { week, screen: weekScreen({ week, head: FIXTURE_PLAN_HEAD, published: null }) };
}

describe.each([["fixture", FIXTURE_CALENDAR_FACTS], ["every arm", ALL_ARMS], ["being written", WRITING]] as const)("This Week over the %s week", (_, facts) => {
  const { week, screen } = screenOf(facts);

  it("draws one card a day, at most seven, in date order, with a page count that is the cards'", () => {
    const days = screen.cards.map((card) => card.day);
    expect(days.length).toBeLessThanOrEqual(7);
    expect(days).toEqual([...new Set(days)].sort());
    expect(screen.cards.filter((card) => card.cell.page !== null)).toHaveLength(week.counts.all);
    expect(screen.opensOn === null || days.includes(screen.opensOn)).toBe(true);
  });

  it("opens a page only where one is written, and offers a day being written nothing to read", () => {
    for (const card of screen.cards) {
      const page = card.cell.page;
      expect(card.pane.kind === "page", card.day).toBe(page !== null && page.draftId !== null && page.state !== "generating" && page.state !== "planned");
      if (card.state === "writing") expect(card.pane.kind, card.day).toBe("lines");
      if (card.state === "stopped") expect(card.stateLine, card.day).not.toBeNull();
      expect([...card.lines, ...(card.pane.kind === "lines" ? card.pane.lines : [])].every((line) => line.trim() !== ""), card.day).toBe(true);
    }
  });
});
