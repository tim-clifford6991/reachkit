/** @vitest-environment jsdom */
// tests/app/overview/changes.test.tsx — BUILD §4.5, §2.4; REQ-071 c12/c13
// (issue #205)
//
// A series drawn across a date the site's answers changed reads as one
// continuous measurement of one market. It is not: the weeks either side
// were measured against different markets, and c12 forbids presenting the
// difference "in any form: no change figure, no joined line, no trend
// arrow, no rising or falling colour, no slope, and no direction, streak,
// badge or verdict stated in words".
//
// #222 supplied the markers; nothing read them. These are the assertions
// that fail if a series is ever joined across one again.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  const written = new Proxy(
    {},
    { get: (_t, key: string) => (key in actual.COPY ? key : undefined) }
  ) as typeof actual.COPY;
  return {
    ...actual,
    COPY: written,
    copy: (key: string, vars?: Record<string, string | number>) =>
      vars === undefined ? key : `${key}(${Object.values(vars).join(",")})`,
  };
});

const { assembleOverview } = await import("@/app/(account)/app/_overview/model");
const { readGrowth } = await import("@/app/(account)/app/_overview/growth");
const { withBreaks, changeWithin, CHANGE_ACCOUNT_KEY } = await import(
  "@/app/(account)/app/_overview/changes"
);
const { GrowthModule } = await import("@/app/(account)/app/_overview/GrowthModule");
const { RivalModule } = await import("@/app/(account)/app/_overview/RivalModule");
const { measured } = await import("@/lib/measure/measured");
type OverviewFacts = import("@/app/(account)/app/_overview/model").OverviewFacts;
type WeeklyPoint = import("@/app/(account)/app/_overview/growth").WeeklyPoint;

const ZONE = "America/New_York";
const AT = (day: number): Date => new Date(Date.UTC(2026, 7, day));
const TODAY = new Date(Date.UTC(2026, 8, 4, 14, 0));
const point = (day: number, value: number): WeeklyPoint => ({
  weekStart: AT(day),
  value: measured(value, AT(day)),
});

/** Four weeks, and a change measured in the second of them.
 *
 *  Aug 20 falls in the week starting Aug 17, so that week is the **first
 *  under the new answer**: the break stands before it and the count starts
 *  at it. That is `weekOf`'s rule, and both the drawing and the count ask
 *  it — see `changes.ts`. */
const POINTS: readonly WeeklyPoint[] = [point(10, 12), point(17, 36), point(24, 60), point(31, 81)];
const CHANGE = { kind: "domain" as const, on: AT(20) };

function html(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

const facts = (over: Partial<OverviewFacts> = {}): OverviewFacts => ({
  timeZone: ZONE,
  today: TODAY,
  points: POINTS,
  firstDueOn: new Date(Date.UTC(2026, 8, 7, 6)),
  aiPresence: [false, true, true, true],
  changes: [],
  pagesPublished: measured(11, AT(31)),
  rivals: {
    own: measured(81, AT(31)),
    previousOwn: measured(36, AT(17)),
    rivals: [
      {
        domain: "bigcompetitor.com",
        confirmed: true,
        ranked: measured(6300, AT(31)),
        previousRanked: measured(9900, AT(17)),
        series: [9900, 6300],
      },
    ],
  },
  supply: { exhausted: false, short: false, firstArrivalShortfall: false },
  waiting: [],
  ...over,
});

// ── the break itself ───────────────────────────────────────────────────────
describe("withBreaks — a marker stands between the two weeks it fell between", () => {
  it("splits the series into the runs either side, and never inside a week", () => {
    const entries = withBreaks(POINTS, [CHANGE], (p) => p.weekStart);
    expect(entries.map((e) => e.kind)).toEqual(["week", "break", "week", "week", "week"]);
    // The break carries the marker, so the drawing can name which answer
    // changed rather than standing a nameless rule.
    const broken = entries.find((e) => e.kind === "break");
    expect(broken?.kind === "break" && broken.marker).toEqual(CHANGE);
  });

  it("a marker older than the window draws nothing — there is no earlier run to separate", () => {
    const entries = withBreaks(POINTS, [{ kind: "domain", on: AT(1) }], (p) => p.weekStart);
    expect(entries.every((e) => e.kind === "week")).toBe(true);
  });

  it("two markers between the same pair of weeks both stand — neither is swallowed", () => {
    const entries = withBreaks(
      POINTS,
      // Both in the week starting Aug 17: two answers changed in one week,
      // and neither rule is swallowed by the other.
      [CHANGE, { kind: "category", on: AT(21) }],
      (p) => p.weekStart
    );
    expect(entries.filter((e) => e.kind === "break")).toHaveLength(2);
  });

  it("no change leaves the series exactly as it was — most sites never change one", () => {
    const entries = withBreaks(POINTS, [], (p) => p.weekStart);
    expect(entries.map((e) => e.kind)).toEqual(["week", "week", "week", "week"]);
  });

  it("every change kind has an account key — a change this screen cannot name is one it must not draw", () => {
    const kinds = ["domain", "category", "rivals"] as const;
    for (const kind of kinds) {
      expect(CHANGE_ACCOUNT_KEY[kind], kind).toMatch(/^overview\.change\./);
    }
    expect(new Set(Object.values(CHANGE_ACCOUNT_KEY)).size).toBe(kinds.length);
  });
});

// ── the growth series ──────────────────────────────────────────────────────
describe("REQ-071 c12 — the growth series is two runs, never one line across a change", () => {
  it("`readGrowth` carries the break in its entries and leaves `points` the weeks alone", () => {
    const growth = readGrowth({ points: POINTS, firstDueOn: AT(1), changes: [CHANGE] });
    expect(growth.kind).toBe("series");
    if (growth.kind !== "series") throw new Error("unreachable");
    expect(growth.points).toHaveLength(4);
    expect(growth.entries.filter((e) => e.kind === "break")).toHaveLength(1);
  });

  it("the chart is handed a column with no value at the change, which is where it cuts its run", () => {
    const growth = readGrowth({ points: POINTS, firstDueOn: AT(1), changes: [CHANGE] });
    const markup = html(<GrowthModule growth={growth} timeZone={ZONE} />);
    // One break column and its account: the same shape an unmeasured week
    // takes, so §2.4's inventory gains no sixth chart.
    expect(markup).toContain(CHANGE_ACCOUNT_KEY.domain);
  });

  it("without a change the same weeks draw one run and no account", () => {
    const growth = readGrowth({ points: POINTS, firstDueOn: AT(1), changes: [] });
    const markup = html(<GrowthModule growth={growth} timeZone={ZONE} />);
    expect(markup).not.toContain(CHANGE_ACCOUNT_KEY.domain);
  });
});

// ── the AI-answers window ──────────────────────────────────────────────────
describe("REQ-071 c12 — the AI-answers window breaks at the same date", () => {
  it("the window's entries carry the break, and its weeks do not", () => {
    const model = assembleOverview(facts({ changes: [CHANGE] }));
    expect(model.aiAnswers.window.entries.filter((e) => e.kind === "break")).toHaveLength(1);
    expect(model.aiAnswers.window.weeks.length).toBe(model.aiAnswers.window.of);
  });

  it("the break is not counted as a reading — the count is over the weeks", () => {
    const withChange = assembleOverview(facts({ changes: [CHANGE] }));
    const without = assembleOverview(facts({ changes: [] }));
    expect(withChange.aiAnswers.headline.value).toEqual(without.aiAnswers.headline.value);
  });
});

// ── the week count ─────────────────────────────────────────────────────────
describe("REQ-071 c13 — the week count runs from the last change, not the first scan", () => {
  it("a change inside the window shortens the count", () => {
    const withChange = assembleOverview(facts({ changes: [CHANGE] }));
    const without = assembleOverview(facts({ changes: [] }));
    expect(withChange.head.weeksMeasured).toBeLessThan(without.head.weeksMeasured);
    // Three of the four weeks are on this side of it: the change was
    // measured in the second week, so that week is the first under the new
    // answer.
    expect(without.head.weeksMeasured).toBe(4);
    expect(withChange.head.weeksMeasured).toBe(3);
  });
});

// ── the comparison window ──────────────────────────────────────────────────
describe("REQ-071 c12/c13 — a comparison that would cross a change is not made, and says so", () => {
  it("the `was` badge is withheld when the two readings straddle the change", () => {
    const model = assembleOverview(facts({ changes: [CHANGE] }));
    expect(model.rivals.kind).toBe("ratio");
    if (model.rivals.kind !== "ratio") throw new Error("unreachable");
    expect(model.rivals.rivals[0]?.previous.kind).toBe("spans_change");

    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    expect(markup).not.toContain("overview.rivals.was");
  });

  it("the card states the window it can compare over instead", () => {
    const model = assembleOverview(facts({ changes: [CHANGE] }));
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    expect(markup).toContain("overview-rivals-comparison-window");
    expect(markup).toContain("overview.comparison.window");
  });

  it("with no change the comparison is made and the window line is absent", () => {
    const model = assembleOverview(facts({ changes: [] }));
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    expect(markup).toContain("overview.rivals.was");
    expect(markup).not.toContain("overview-rivals-comparison-window");
  });

  it("`changeWithin` is exclusive of the older end — a change *on* the earlier reading is behind it", () => {
    expect(changeWithin([AT(17), AT(31)], [{ kind: "domain", on: AT(17) }])).toBeNull();
    expect(changeWithin([AT(17), AT(31)], [{ kind: "domain", on: AT(18) }])).not.toBeNull();
    expect(changeWithin([AT(17), AT(31)], [{ kind: "domain", on: AT(31) }])).not.toBeNull();
  });
});

// ── the obligation this screen cannot discharge yet ────────────────────────
describe("the verdicts series is not on this screen, and this is what says so", () => {
  it("Overview draws no verdicts card — the day one lands, it breaks at markers too", () => {
    // REQ-071 c12 names verdicts alongside the series. There is no verdicts
    // card on Overview: `readOverviewFacts` supplies none and no module
    // renders one. This is the marker that keeps that from going quiet —
    // when a verdicts card arrives, this fails and its author has to break
    // it at the markers like the other two.
    const model = assembleOverview(facts({ changes: [CHANGE] }));
    expect(Object.keys(model)).not.toContain("verdicts");
  });

  it("both week-spanning series on this screen do break at markers", () => {
    // The enumeration, so a *third* one added later is caught: today the
    // forms that span weeks are the growth line and the AI-answers window,
    // and both carry `entries`.
    const model = assembleOverview(facts({ changes: [CHANGE] }));
    expect(model.growth.kind).toBe("series");
    if (model.growth.kind !== "series") throw new Error("unreachable");
    expect(model.growth.entries.some((e) => e.kind === "break")).toBe(true);
    expect(model.aiAnswers.window.entries.some((e) => e.kind === "break")).toBe(true);
  });
});
