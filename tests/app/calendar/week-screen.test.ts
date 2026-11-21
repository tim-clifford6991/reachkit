// This Week's one model over the fixture: the site's week that holds today, the head's dates and count, one word
// per state, and the pane each card opens.
import { describe, expect, it } from "vitest";
import { FIXTURE_CALENDAR_FACTS, FIXTURE_PLAN_HEAD } from "@/app/(account)/app/calendar/fixture";
import { assembleMonth, dayStateOf, weekOf, type CalendarFacts, type DraftOnDay } from "@/app/(account)/app/calendar/month";
import { STAGE_OF } from "@/app/(account)/app/calendar/stages";
import { copy } from "@/lib/presentation/copy";
import { weekListOf } from "@/app/(account)/app/_overview/this-week";
import { addDays, clockTime, commitEnd, dayKeyOf, monthOf } from "@/app/(account)/app/calendar/dates";
import type { State } from "@/lib/publish/types";
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

/** The fixture's week with Monday's page in review rather than live. */
const MONDAY_IN_REVIEW: CalendarFacts = {
  ...FIXTURE_CALENDAR_FACTS,
  drafts: FIXTURE_CALENDAR_FACTS.drafts.map((draft) => (draft.scheduledFor === "2026-09-14" ? { ...draft, state: "in_review" } : draft)),
};

/** Monday before its pass, Monday after it, Wednesday, and Wednesday in a first week set up on its Tuesday. */
const CLOCKS: readonly [string, Date, PlanHeadFacts, string][] = [
  ["Monday before the pass", at("2026-09-14T15:00:00Z"), { ...FIXTURE_PLAN_HEAD, lastCheck: "2026-09-07", commitStart: "2026-09-08" }, "2026-09-14"],
  ["Monday after the pass", at("2026-09-14T15:00:00Z"), FIXTURE_PLAN_HEAD, "2026-09-21"],
  ["Wednesday", at("2026-09-16T15:00:00Z"), FIXTURE_PLAN_HEAD, "2026-09-21"],
  ["first Wednesday", at("2026-09-16T15:00:00Z"), { ...FIXTURE_PLAN_HEAD, setupDay: "2026-09-15" }, "2026-09-21"],
];

function screenOf(facts: CalendarFacts, head: PlanHeadFacts, bodies?: ReadonlySet<string> | null) {
  const today = dayKeyOf(facts.now, facts.timeZone);
  const months = [...new Set([head.weekStart, addDays(head.weekStart, 6)].map(monthOf))].map((month) => assembleMonth(facts, month, commitEnd(today, head.commitStart)));
  const week = weekOf(months, { today, weekStart: head.weekStart, setupDay: head.setupDay });
  return { today, week, screen: weekScreen({ week, head, published: null, ...(bodies === undefined ? {} : { bodies }) }) };
}

describe.each(CLOCKS)("This Week on the %s", (_, now, head, next) => {
  describe.each([["fixture", FIXTURE_CALENDAR_FACTS], ["every arm", ALL_ARMS], ["mixed", MIXED], ["Monday in review", MONDAY_IN_REVIEW]] as const)("over the %s week", (__, base) => {
    const { today, week, screen } = screenOf({ ...base, now }, head);
    const from = [head.weekStart, head.setupDay!].sort().at(-1)!;
    const days = screen.cards.map((card) => card.day);
    const window = new Set(days);

    it("draws the site's week from setup, every day through today, in date order, ending on its last day with something to say", () => {
      expect(days).toEqual([...new Set(days)].sort());
      expect([days[0], days.includes(today)]).toEqual([from, true]);
      expect(days.every((day, at) => day === addDays(from, at) && day <= addDays(head.weekStart, 6))).toBe(true);
      expect(screen.head.pages).toBe(screen.cards.filter((card) => card.cell.page !== null).length);
    });

    it("counts the window's dated pages, a past day only planned not among them, on This Week and Overview alike", () => {
      const unwritten = (draft: DraftOnDay) => draft.scheduledFor < today && draft.state === "planned" && draft.startedAt == null;
      const stored = base.drafts.filter((draft) => window.has(draft.scheduledFor) && STAGE_OF[draft.state] !== null && !unwritten(draft)).length;
      expect([screen.head.pages, weekListOf(week)?.pages]).toEqual([stored, stored]);
    });

    it("counts the pages still to come from the same window, never more than the week's pages", () => {
      const toCome = base.drafts.filter((d) => window.has(d.scheduledFor) && d.scheduledFor >= today && STAGE_OF[d.state] !== null && STAGE_OF[d.state] !== "live").length;
      const list = weekListOf(week);
      expect(list?.coming).toBe(toCome);
      expect(list!.coming <= list!.pages).toBe(true);
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
        if (card.day < today) expect(card.state === null || card.state === "planned", card.day).toBe(false);
        expect(page !== null || card.state !== null || card.lines.length + (card.emptyLine === null ? 0 : 1) > 0, card.day).toBe(true);
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

describe.each([
  ["planned, no draft", { draftId: null, state: "planned" }],
  ["planned, started", { draftId: null, state: "planned", startedAt: at("2026-09-15T12:00:00Z") }],
  ["being written", { state: "generating" }],
  ["in review", { state: "in_review" }],
  ["approved", { state: "approved", publishAt: at("2026-09-15T13:00:00Z") }],
  ["failed for good", { state: "needs_attention", needsYou: { kind: "live_edit" } }],
  ["stopped", { state: "skipped", stoppedByYou: true }],
  ["live", { state: "published" }],
] as const satisfies readonly [string, Partial<DraftOnDay> & { state: State }][])("a day before today, %s", (_, as) => {
  const facts: CalendarFacts = {
    ...FIXTURE_CALENDAR_FACTS,
    now: at("2026-09-16T15:00:00Z"),
    drafts: FIXTURE_CALENDAR_FACTS.drafts.map((draft) => (draft.scheduledFor === "2026-09-15" ? { ...draft, ...as } : draft)),
  };
  const time = clockTime(FIXTURE_PLAN_HEAD.publishTime!);

  it("carries no future-tense line, on its card or in its pane", () => {
    const { today, screen } = screenOf(facts, FIXTURE_PLAN_HEAD);
    const past = screen.cards.filter((card) => card.day < today);
    expect(past.length).toBeGreaterThan(0);
    for (const card of past) {
      const promised = [copy("calendar.card.goes-live", { day: card.dayLabel, time }), copy("calendar.week.today", { time })];
      expect(card.lines.some((line) => promised.includes(line)), card.day).toBe(false);
      expect(card.pane.kind === "lines" ? null : card.pane.next, card.day).toBeNull();
      if (card.state === "stopped" && card.pane.kind === "lines") expect(card.pane.lines, card.day).toEqual([card.stateLine]);
    }
  });
});
