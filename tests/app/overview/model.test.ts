// tests/app/overview/model.test.ts — BUILD §4.5's data rule.
//
// "max one headline number per module; every value carries its delta or its
// goal, never bare." Both halves, plus DECISIONS 2026-09-03's amendment: the
// AI-answers tile shows one reading only, and no other reading of AI-answer
// movement appears anywhere on this screen.
import { describe, expect, it } from "vitest";
import { measured, measuredZero, unmeasured } from "@/lib/measure/measured";
import { OVERVIEW_TRAILING_WEEKS } from "@/lib/config/constants";
import { assembleOverview, type OverviewFacts } from "@/app/(account)/app/_overview/model";
import { OVERVIEW_HEAD } from "@/app/(account)/app/_overview/head";
import type { WeeklyPoint } from "@/app/(account)/app/_overview/growth";

const AT = (day: number): Date => new Date(Date.UTC(2026, 7, day));
const TODAY = new Date(Date.UTC(2026, 8, 4, 14, 0));
const week = (day: number, value: number): WeeklyPoint => ({
  weekStart: AT(day),
  value: measured(value, AT(day)),
});

const facts = (over: Partial<OverviewFacts> = {}): OverviewFacts => ({
  timeZone: "America/New_York",
  today: TODAY,
  points: [week(10, 36), week(17, 81)],
  firstDueOn: new Date(Date.UTC(2026, 8, 7)),
  aiPresence: [true, true],
  // No answer has changed: the ordinary frame (issue #213).
  changes: [],
  pagesPublished: measured(11, AT(17)),
  rivals: { own: measuredZero(0, AT(17)), rivals: [] },
  supply: { exhausted: false, short: false, firstArrivalShortfall: false },
  waiting: [],
  ...over,
});

describe("one headline per module, and never bare", () => {
  it("each of the three modules carries exactly one headline and its goal", () => {
    const model = assembleOverview(facts());
    for (const tile of [model.searches, model.aiAnswers, model.pagesPublished]) {
      expect(tile.headline).toBeDefined();
      expect(tile.headline.goal).toBeTruthy();
      // One headline: there is no second slot to put one in.
      expect(Object.keys(tile).filter((k) => k === "headline")).toHaveLength(1);
    }
  });

  it("with a previous measurement the searches headline carries its delta", () => {
    const model = assembleOverview(facts());
    expect(model.searches.headline.delta).toEqual(measured(45, AT(17)));
  });

  it("with no previous measurement it carries no delta, and so falls to its goal", () => {
    const model = assembleOverview(facts({ points: [week(10, 36)], aiPresence: [true] }));
    expect(model.searches.headline.delta).toBeUndefined();
    expect(model.searches.headline.goal).toBe("searches_appeared_in");
  });

  it("a delta across an unmeasured week is unmeasured, never a difference from nothing", () => {
    const model = assembleOverview(
      facts({
        points: [
          { weekStart: AT(10), value: unmeasured<number>("undeterminable", AT(10)) },
          week(17, 81),
        ],
        aiPresence: [null, true],
      })
    );
    expect(model.searches.headline.delta).toBeUndefined();
  });

  it("pages published carries its delta only when a previous measurement exists", () => {
    expect(assembleOverview(facts()).pagesPublished.headline.delta).toBeUndefined();
    const withPrevious = assembleOverview(
      facts({ pagesPublishedPrevious: measured(6, AT(10)) })
    );
    expect(withPrevious.pagesPublished.headline.delta).toEqual(measured(5, AT(17)));
  });

  it("a delta of zero is a measured zero, not an absent delta", () => {
    const model = assembleOverview(facts({ pagesPublishedPrevious: measured(11, AT(10)) }));
    expect(model.pagesPublished.headline.delta).toEqual(measuredZero(0, AT(17)));
  });
});

describe("DECISIONS 2026-09-03 — the AI-answers tile shows one reading only", () => {
  it("its headline never carries a delta", () => {
    const model = assembleOverview(facts({ aiPresence: [false, true] }));
    expect(model.aiAnswers.headline.delta).toBeUndefined();
  });

  it("the reading is weeks present in the window, and unmeasured weeks are not misses", () => {
    const model = assembleOverview(
      facts({
        points: [week(10, 1), week(17, 2), week(24, 3)],
        aiPresence: [true, null, true],
      })
    );
    expect(model.aiAnswers.headline.value).toEqual(measured(2, TODAY));
  });

  it("no week present at all is a measured zero, not a dash", () => {
    const model = assembleOverview(facts({ aiPresence: [false, false] }));
    expect(model.aiAnswers.headline.value).toEqual(measuredZero(0, TODAY));
  });

  it("no week measured at all is unmeasured, not a zero", () => {
    const model = assembleOverview(facts({ aiPresence: [null, null] }));
    expect(model.aiAnswers.headline.value.kind).toBe("unmeasured");
  });

  it("the window is the fixed trailing window, padded rather than shrunk to fit", () => {
    const model = assembleOverview(facts());
    expect(model.aiAnswers.window.of).toBe(OVERVIEW_TRAILING_WEEKS);
    expect(model.aiAnswers.window.weeks).toHaveLength(OVERVIEW_TRAILING_WEEKS);
    // The padded weeks are weeks before the customer started: not measured,
    // and therefore not misses.
    expect(model.aiAnswers.window.weeks[0]?.present).toBeNull();
    expect(model.aiAnswers.window.weeks.at(-1)?.weekStart).toEqual(AT(17));
  });

  it("its weeks are the growth chart's weeks — one window, two readings", () => {
    const model = assembleOverview(facts());
    const measuredWeeks = model.aiAnswers.window.weeks.filter((w) => w.present !== null);
    expect(measuredWeeks.map((w) => w.weekStart)).toEqual([AT(10), AT(17)]);
  });
});

describe("the head, and the badge only a rising series earns", () => {
  it("a rising series selects the rising key and emits the badge over the measured weeks", () => {
    const model = assembleOverview(facts());
    expect(model.head.key).toBe(OVERVIEW_HEAD.rising);
    expect(model.head.badgeKey).toBe("overview.head.badge");
    expect(model.head.weeksMeasured).toBe(2);
  });

  // issue #213 — REQ-071 c13: a count of weeks may not span a date the
  // answers changed. The pair is what discriminates: the same two points
  // count 2 with no change and 1 with a change between them, and an
  // implementation still reading `measuredPoints.length` passes the first
  // and fails the second.
  it("a count of weeks never spans a change — it runs from the last one", () => {
    const model = assembleOverview(
      facts({ changes: [{ kind: "domain", on: new Date(Date.UTC(2026, 7, 17, 9, 0)) }] })
    );
    expect(model.head.weeksMeasured).toBe(1);
  });

  it("a change in the week of a point counts that point — the week under the new answer", () => {
    // The marker falls on the Wednesday of the week of Monday the 17th, so
    // the 17th's own measurement is the first one under the new answer.
    const model = assembleOverview(
      facts({ changes: [{ kind: "category", on: new Date(Date.UTC(2026, 7, 19, 9, 0)) }] })
    );
    expect(model.head.weeksMeasured).toBe(1);
  });

  it("with several changes the count runs from the last of them", () => {
    const model = assembleOverview(
      facts({
        points: [week(3, 10), week(10, 36), week(17, 81)],
        aiPresence: [true, true, true],
        changes: [
          { kind: "domain", on: new Date(Date.UTC(2026, 7, 10, 9, 0)) },
          { kind: "category", on: new Date(Date.UTC(2026, 7, 17, 9, 0)) },
        ],
      })
    );
    expect(model.head.weeksMeasured).toBe(1);
  });

  it("a falling series selects the falling key and emits no badge", () => {
    const model = assembleOverview(facts({ points: [week(10, 81), week(17, 36)] }));
    expect(model.head.key).toBe(OVERVIEW_HEAD.falling);
    expect(model.head.key).not.toBe(OVERVIEW_HEAD.rising);
    expect(model.head.badgeKey).toBeUndefined();
  });

  it("with nothing measured the head is the no-data key and the growth arm is none", () => {
    const model = assembleOverview(facts({ points: [], aiPresence: [] }));
    expect(model.head.key).toBe(OVERVIEW_HEAD.no_data);
    expect(model.growth.kind).toBe("none");
  });
});

describe("the assembly is pure, and reads nothing", () => {
  it("the same facts produce the same model, twice", () => {
    expect(assembleOverview(facts())).toEqual(assembleOverview(facts()));
  });

  it("it states one supply statement or none, and at most two alerts", () => {
    const model = assembleOverview(
      facts({ supply: { exhausted: true, short: true, firstArrivalShortfall: true } })
    );
    expect(model.supply?.key).toBe("overview.supply.exhausted");
    expect(model.alerts.length).toBeLessThanOrEqual(2);
  });

  it("carries no supply statement where the product has nothing to say", () => {
    expect(assembleOverview(facts()).supply).toBeUndefined();
  });
});
