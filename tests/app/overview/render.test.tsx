/** @vitest-environment jsdom */
// tests/app/overview/render.test.tsx — BUILD §4.5, rendered.
//
// Every sentence this screen speaks is owner-owed today, and the screen's
// own rule is that an unwritten line renders as nothing. That is the right
// behaviour and it is asserted in `page.test.tsx` — but it would also make
// every rendering assertion here vacuous, because a module that renders
// nothing passes "renders no invented sentence" trivially.
//
// So this file renders the screen against a registry in which **every key is
// written**, its value being the key itself. What that shows is what the
// customer will see the moment the owner fills the keys: three tiles and no
// fourth, two alerts and a count for the third, one supply statement, both
// rival arms, and the seven days of the week.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  // Every key resolves to itself, with its slots substituted, so nothing is
  // owner-owed and every line the screen can state is stated.
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

import { measured, measuredZero, unmeasured } from "@/lib/measure/measured";
import { assembleOverview, type OverviewFacts } from "@/app/(account)/app/_overview/model";
import { HeadModule } from "@/app/(account)/app/_overview/HeadModule";
import { GrowthModule } from "@/app/(account)/app/_overview/GrowthModule";
import { TileRow } from "@/app/(account)/app/_overview/TileRow";
import { RivalModule } from "@/app/(account)/app/_overview/RivalModule";
import { WeekModule } from "@/app/(account)/app/_overview/WeekModule";
import type { WeeklyPoint } from "@/app/(account)/app/_overview/growth";

const ZONE = "America/New_York";
const AT = (day: number): Date => new Date(Date.UTC(2026, 7, day));
const TODAY = new Date(Date.UTC(2026, 8, 4, 14, 0));
const week = (day: number, value: number): WeeklyPoint => ({
  weekStart: AT(day),
  value: measured(value, AT(day)),
});

const facts = (over: Partial<OverviewFacts> = {}): OverviewFacts => ({
  timeZone: ZONE,
  today: TODAY,
  points: [
    { weekStart: AT(10), value: measuredZero(0, AT(10)) },
    week(17, 36),
    { weekStart: AT(24), value: unmeasured<number>("not_attempted", AT(24)) },
    week(31, 81),
  ],
  firstDueOn: new Date(Date.UTC(2026, 8, 7, 6)),
  aiPresence: [false, true, null, true],
  // No answer has changed: the ordinary frame (issue #213).
  changes: [],
  pagesPublished: measured(11, AT(31)),
  rivals: {
    own: measured(81, AT(31)),
    previousOwn: measured(36, AT(17)),
    rivals: [
      // Banded `far` — against an own count of 81 the middle bar is
      // `max(500, 405) = 500`, so this is the row REQ-096 c6 applies to
      // (issue #223).
      {
        domain: "bigcompetitor.com",
        confirmed: true,
        ranked: measured(6318, AT(31)),
        previousRanked: measured(9936, AT(17)),
        series: [276, 168, 78],
        size: {
          domain: "bigcompetitor.com",
          state: "sized" as const,
          rankedCount: 6318,
          band: "far" as const,
          at: AT(31),
          current: true,
        },
      },
      // Banded `middle`, and the row that proves the offer belongs to one
      // rival rather than to the module.
      {
        domain: "secondplace.io",
        confirmed: true,
        ranked: measured(420, AT(31)),
        previousRanked: measured(430, AT(17)),
        series: [12, 8, 5],
        size: {
          domain: "secondplace.io",
          state: "sized" as const,
          rankedCount: 420,
          band: "middle" as const,
          at: AT(31),
          current: true,
        },
      },
      {
        domain: "unconfirmed.com",
        confirmed: false,
        ranked: measured(1204, AT(31)),
        series: [31, 30, 29],
      },
    ],
  },
  supply: { exhausted: false, short: true, firstArrivalShortfall: false },
  waiting: [
    { kind: "pending_veto", title: "a draft", since: AT(31), href: "/app/draft/1" },
    { kind: "needs_you", title: "a destination", since: AT(31), href: "/app/settings" },
    { kind: "pending_veto", title: "another draft", since: AT(31), href: "/app/draft/2" },
  ],
  ...over,
});

const html = (el: React.ReactElement): string => renderToStaticMarkup(el);
const count = (source: string, needle: string): number => source.split(needle).length - 1;

describe("the head, backed by the chart under it", () => {
  it("a rising series renders the rising line and the badge", () => {
    const model = assembleOverview(facts());
    const markup = html(<HeadModule head={model.head} />);
    expect(markup).toContain("overview.head.rising");
    expect(markup).toContain("overview.head.badge");
  });

  it("a falling series renders the falling line and no badge at all", () => {
    const model = assembleOverview(facts({ points: [week(10, 81), week(17, 36)], aiPresence: [true, true] }));
    const markup = html(<HeadModule head={model.head} />);
    expect(markup).toContain("overview.head.falling");
    expect(markup).not.toContain("overview.head.rising");
    expect(markup).not.toContain("overview.head.badge");
  });
});

describe("the growth chart", () => {
  it("draws the measured weeks and cuts the run at the week that was not measured", () => {
    const model = assembleOverview(facts());
    const markup = html(<GrowthModule growth={model.growth} timeZone={ZONE} />);
    // Four weeks, three values and one em dash where the week did not run.
    expect(markup).toContain(">0<");
    expect(markup).toContain(">36<");
    expect(markup).toContain(">81<");
    expect(markup).toContain("—");
    // Two runs — before the gap and after it — never one polyline across it.
    expect(count(markup, "<polyline")).toBe(2);
  });

  it("with nothing measured it renders no chart and one line with the first-due date", () => {
    const model = assembleOverview(facts({ points: [], aiPresence: [] }));
    const markup = html(<GrowthModule growth={model.growth} timeZone={ZONE} />);
    expect(markup).not.toContain("<svg");
    expect(markup).toContain("place.overview.weekly-presence.chart");
    expect(markup).toContain("Sep 7, 2026");
  });
});

describe("three tiles, and no fourth", () => {
  const model = assembleOverview(facts());
  const markup = html(
    <TileRow
      searches={model.searches}
      aiAnswers={model.aiAnswers}
      pagesPublished={model.pagesPublished}
      timeZone={ZONE}
    />
  );

  it("renders exactly three stat tiles", () => {
    expect(count(markup, 'class="stats"')).toBe(3);
  });

  it("renders no score tile — the composite score has none on Overview", () => {
    expect(markup).not.toContain("score");
  });

  it("the searches headline carries its delta, in the delta glyph from the registry", () => {
    expect(markup).toContain("overview.delta.up");
    expect(markup).toContain(">45<");
  });

  it("the pages headline has no delta, so it carries its goal of 30", () => {
    expect(markup).toContain("overview.goal(30)");
  });

  it("the AI tile carries its goal and its one window reading, and no movement", () => {
    expect(markup).toContain("overview.goal(6)");
    expect(markup).toContain("overview.tile.ai-answers.window");
    expect(markup).not.toContain("overview.delta.down");
  });

  it("no headline renders bare: every stat carries a description", () => {
    // Matched on the class *token* rather than the whole attribute: the
    // component carries a second class on this element since #211
    // (`whitespace-normal`, so a written reason wraps inside its tile), and
    // this test is about every tile having a description — not about how
    // many classes the design system puts on it.
    expect(count(markup, "stat-desc")).toBe(3);
    expect(markup).not.toMatch(/class="stat-desc[^"]*"><\/div>/);
  });
});

describe("how far ahead each rival is", () => {
  it("the ratio arm renders the figure, the was badge and the shrinking line", () => {
    const model = assembleOverview(facts());
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    expect(markup).toContain("overview.rivals.ratio(78)");
    expect(markup).toContain("overview.rivals.was");
    expect(markup).toContain("overview.rivals.line.shrinking");
  });

  it("only the confirmed set renders", () => {
    const model = assembleOverview(facts());
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    expect(markup).toContain("bigcompetitor.com");
    expect(markup).not.toContain("unconfirmed.com");
  });

  it("the cold-start arm renders absolute counts, the customer's own, and not the shrinking line", () => {
    const model = assembleOverview(
      facts({ rivals: { own: measuredZero(0, AT(31)), rivals: [
        { domain: "bigcompetitor.com", confirmed: true, ranked: measured(6318, AT(31)), series: [312, 320, 331] },
      ] } })
    );
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    expect(markup).toContain("6,318");
    expect(markup).toContain("overview.rivals.you");
    expect(markup).toContain("overview.rivals.line.absolute");
    expect(markup).not.toContain("overview.rivals.line.shrinking");
    // Never a ratio: no × figure is composed on this arm.
    expect(markup).not.toContain("overview.rivals.ratio");
  });

  // ── REQ-096 c6, rendered (issue #223) ───────────────────────────────
  //
  // `page.test.tsx` asserts the other half: while either sentence is owed,
  // nothing of this renders at all. Here every key is written, so this is
  // what the customer sees the moment the owner fills them.
  it("a far rival carries the written line and one control, under its own row", () => {
    const model = assembleOverview(facts());
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    expect(markup).toContain("overview.rivals.far.line(bigcompetitor.com)");
    expect(markup).toContain("overview.rivals.far.swap");
  });

  it("the control is a link to the competitors card, and there is exactly one", () => {
    const model = assembleOverview(facts());
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    expect(markup.split('href="/app/settings"').length - 1).toBe(1);
    expect(markup.split("overview.rivals.far.swap").length - 1).toBe(1);
  });

  it("no other rival's row carries it — the fixture's middle-banded rival has none", () => {
    const model = assembleOverview(facts());
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    // Both rivals render; only one offer does.
    expect(markup).toContain("secondplace.io");
    expect(markup.split("overview.rivals.far.line").length - 1).toBe(1);
  });

  it("the far rival keeps its figure and its badge — the offer adds, it never replaces", () => {
    const model = assembleOverview(facts());
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    expect(markup).toContain("overview.rivals.ratio(78)");
    expect(markup).toContain("overview.rivals.was");
  });

  it("it names no replacement and offers no removal — only the two written keys appear", () => {
    const model = assembleOverview(facts());
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    const rivalKeys = [...markup.matchAll(/overview\.rivals\.[a-z.]+/g)].map((m) => m[0]);
    expect(new Set(rivalKeys.filter((k) => k.startsWith("overview.rivals.far")))).toEqual(
      new Set(["overview.rivals.far.line", "overview.rivals.far.swap"])
    );
  });
});

describe("this week", () => {
  const model = assembleOverview(facts());
  const markup = html(
    <WeekModule
      week={model.week}
      timeZone={ZONE}
      alerts={model.alerts}
      overflow={model.overflow}
      supply={model.supply}
    />
  );

  it("renders seven days, each with its own date", () => {
    // Monday 31 Aug through Sunday 6 Sep, in the site's zone. The label is
    // the day of the month: a cell is a seventh of a 300-unit viewBox, and
    // a full date drawn there is wider than its own cell and is clipped by
    // the `<svg>` (see `dayOf`). The month is the module's heading's.
    for (const day of ["31", "1", "2", "3", "4", "5", "6"]) {
      expect(markup, `missing day ${day}`).toContain(`>${day}</text>`);
    }
  });

  it("gives every day the written word for its state — identity is never colour alone", () => {
    expect(count(markup, "overview.week.day.done")).toBeGreaterThan(0);
    expect(markup).toContain("overview.week.day.today");
    expect(markup).toContain("overview.week.day.to-come");
  });

  it("renders the calendar control", () => {
    expect(markup).toContain('href="/app/calendar"');
    expect(markup).toContain("overview.week.calendar-link");
  });

  it("renders at most two alerts, each with one control, and the remainder as a count", () => {
    expect(count(markup, 'role="alert"')).toBe(2);
    expect(count(markup, 'class="btn btn-sm"')).toBe(2);
    expect(markup).toContain("overview.alert.overflow(1)");
  });

  it("renders exactly one supply statement", () => {
    expect(markup).toContain("overview.supply.short");
    expect(markup).not.toContain("overview.supply.exhausted");
    expect(markup).not.toContain("overview.supply.first-arrival");
  });

  it("with nothing waiting it states the success line rather than leaving a blank", () => {
    const empty = assembleOverview(facts({ waiting: [] }));
    const emptyMarkup = html(
      <WeekModule week={empty.week} timeZone={ZONE} alerts={empty.alerts} supply={empty.supply} />
    );
    expect(emptyMarkup).toContain("overview.alerts.empty");
    expect(count(emptyMarkup, 'role="alert"')).toBe(1);
  });
});
