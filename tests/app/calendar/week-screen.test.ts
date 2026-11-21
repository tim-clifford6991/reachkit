// This Week's one model over the fixture: the committed week (from its Tuesday), the head's dates and count, one word
// per state, and the pane each card opens.
import { describe, expect, it } from "vitest";
import { FIXTURE_CALENDAR_FACTS, FIXTURE_PLAN_HEAD } from "@/app/(account)/app/calendar/fixture";
import { assembleMonth, dayStateOf, weekOf, type CalendarFacts } from "@/app/(account)/app/calendar/month";
import { STAGE_OF } from "@/app/(account)/app/calendar/stages";
import { copy } from "@/lib/presentation/copy";
import { weekListOf } from "@/app/(account)/app/_overview/this-week";
import { commitDays, commitEnd, dayKeyOf, monthOf } from "@/app/(account)/app/calendar/dates";
import { checkDays, weekScreen, writtenDrafts } from "@/app/(account)/app/calendar/week-screen";
import type { PlanHeadFacts } from "@/app/(account)/app/calendar/provider";
import { ALL_ARMS } from "./arms";

const at = (iso: string) => new Date(iso);

/** The fixture's week with Thu failed for good and Fri started with no draft row yet. */
const MIXED: CalendarFacts = {
  ...FIXTURE_CALENDAR_FACTS,
  drafts: FIXTURE_CALENDAR_FACTS.drafts.map((draft) =>
    draft.scheduledFor === "2026-09-17"
      ? { ...draft, state: "needs_attention", needsYou: { kind: "live_edit" } }
      : draft.scheduledFor === "2026-09-18"
        ? { ...draft, draftId: null, state: "planned", startedAt: at("2026-09-15T12:00:00Z") }
        : draft
  ),
};

/** Monday before its pass (last week's commit, Tue to Mon), Monday after it (this commit, Tue to Mon), and Wednesday. */
const CLOCKS: readonly [string, Date, PlanHeadFacts, string][] = [
  ["Monday before the pass", at("2026-09-14T15:00:00Z"), { ...FIXTURE_PLAN_HEAD, lastCheck: "2026-09-07", commitStart: "2026-09-08" }, "2026-09-14"],
  ["Monday after the pass", at("2026-09-14T15:00:00Z"), FIXTURE_PLAN_HEAD, "2026-09-21"],
  ["Wednesday", at("2026-09-16T15:00:00Z"), FIXTURE_PLAN_HEAD, "2026-09-21"],
];

function screenOf(facts: CalendarFacts, head: PlanHeadFacts, bodies?: ReadonlySet<string> | null) {
  const today = dayKeyOf(facts.now, facts.timeZone);
  const shown = commitDays(today, head.commitStart);
  const planned = { ...facts, planEnd: commitEnd(today, head.commitStart) };
  const months = [...new Set([...shown.days, today].map(monthOf))].map((month) => assembleMonth(planned, month));
  const week = weekOf(months, today, head.commitStart);
  return { today, shown, week, screen: weekScreen({ week, head, published: null, ...(bodies === undefined ? {} : { bodies }) }) };
}

describe.each(CLOCKS)("This Week on the %s", (_, now, head, next) => {
  describe.each([["fixture", FIXTURE_CALENDAR_FACTS], ["every arm", ALL_ARMS], ["mixed", MIXED]] as const)("over the %s week", (__, base) => {
    const { today, shown, week, screen } = screenOf({ ...base, now }, head);
    const commit = new Set(shown.days);

    it("draws the committed week, and today's page from the commit before, in date order, counting the commit's pages", () => {
      const days = screen.cards.map((card) => card.day);
      expect(days).toEqual([...new Set(days)].sort());
      for (const card of screen.cards) expect(commit.has(card.day) || (card.day === today && card.cell.page !== null), card.day).toBe(true);
      expect(shown.days.filter((day) => monthOf(day) === monthOf(today)).every((day) => days.includes(day))).toBe(true);
      expect(screen.head.pages).toBe(screen.cards.filter((card) => card.cell.page !== null && commit.has(card.day)).length);
    });

    it("counts the commit's dated pages, as the stored days hold them, on This Week and Overview alike", () => {
      const stored = base.drafts.filter((draft) => commit.has(draft.scheduledFor) && STAGE_OF[draft.state] !== null).length;
      expect([screen.head.pages, weekListOf(week)?.pages]).toEqual([stored, stored]);
    });

    it("never says a day before today goes live", () => {
      for (const card of screen.cards.filter((each) => each.day < today)) {
        const promised = copy("calendar.card.goes-live", { day: card.dayLabel, time: "9:00 AM" });
        expect(card.lines.includes(promised), card.day).toBe(false);
        if (card.pane.kind === "page") expect(card.pane.next, card.day).toBeNull();
      }
    });

    it("was chosen no later than today, and is checked next on the Monday still to come", () => {
      const check = checkDays(head, today);
      expect(check.chosen! <= today).toBe(true);
      expect(check.next).toBe(next);
    });

    it("gives each card its state's one word, and opens a page only where one is written", () => {
      for (const card of screen.cards) {
        const page = card.cell.page;
        expect(card.state, card.day).toBe(dayStateOf(card.cell));
        expect(card.pane.kind === "page", card.day).toBe(page !== null && page.draftId !== null && page.state !== "generating" && page.state !== "planned");
        if (page?.stage === "needs_you") expect(card.state, card.day).toBe("needs_you");
        if (page !== null && page.draftId === null && page.startedAt != null) expect([card.state, card.pane.kind], card.day).toEqual(["writing", "lines"]);
        expect([...card.lines, ...(card.pane.kind === "lines" ? card.pane.lines : [])].every((line) => line.trim() !== ""), card.day).toBe(true);
      }
    });
  });
});

describe("the pane and the head", () => {
  const facts = { ...MIXED, now: at("2026-09-16T15:00:00Z") };
  const panes = (bodies?: ReadonlySet<string> | null) =>
    screenOf(facts, FIXTURE_PLAN_HEAD, bodies).screen.cards.flatMap((card) => (card.pane.kind === "page" ? [card.pane.unread] : []));

  it("says so in every written page's pane when the body read failed, and not when it answered", () => {
    const failed = panes(null);
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((line) => line !== null)).toBe(true);
    expect(panes(new Set(writtenDrafts(screenOf(facts, FIXTURE_PLAN_HEAD).week))).every((line) => line === null)).toBe(true);
  });

  it("never dates the choice after today, whatever the stored check says", () => {
    expect(checkDays({ ...FIXTURE_PLAN_HEAD, lastCheck: "2026-09-21" }, "2026-09-16").chosen).toBe("2026-09-16");
  });
});
