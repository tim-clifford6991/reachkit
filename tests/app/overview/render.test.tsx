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
import { NeedsYouModule } from "@/app/(account)/app/_overview/NeedsYouModule";
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
  // UI-SPEC S12's score tile: 62 in "Hard to find", eight points up.
  score: measured({ score: 62, band: "hard-to-find" as const }, AT(31)),
  scorePrevious: measured({ score: 54, band: "hard-to-find" as const }, AT(31)),
  pagesRanking: measured(6, AT(31)),
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
    // Two runs — before the gap and after it — never one polyline across it.
    expect(count(markup, "<polyline")).toBe(2);
    // The week that did not run stands as the dashed break rule, in its
    // own place on the axis.
    expect(markup).toContain("stroke-dasharray");
  });

  it("labels the endpoint only — no numeral under any weekly point (#386)", () => {
    const model = assembleOverview(facts());
    const markup = html(<GrowthModule growth={model.growth} timeZone={ZONE} />);
    // The last measured week's value, once, above its dot. The three
    // earlier weeks and the em dash the unmeasured one used to print are
    // gone from the plot; every one of them still states its name and its
    // reading in its mark's tooltip.
    expect(markup).toContain(">81<");
    expect(markup).not.toContain(">0<");
    expect(markup).not.toContain(">36<");
    expect(markup).not.toContain("—");
    expect(markup).toContain("<title>");
    // …and the start value is the card's left-hand footnote, as S12 draws
    // it, not a numeral on the plot.
    expect(markup).toContain("overview.growth.footnote.start(0)");
  });

  it("with nothing measured it renders no chart and one line with the first-due date", () => {
    const model = assembleOverview(facts({ points: [], aiPresence: [] }));
    const markup = html(<GrowthModule growth={model.growth} timeZone={ZONE} />);
    // The card head's chip carries a glyph since #353, and a glyph is an
    // `<svg>`. What this asserts is the absence of the *chart*, which the
    // inventory's charts all label as an image role — not the absence of
    // every vector on the card.
    expect(markup).not.toContain('role="img"');
    expect(markup).not.toContain("<polyline");
    // …and no source chip either: nothing was measured, so there is no date
    // a reading came from to name.
    expect(markup).not.toContain("rk-srcchip");
    expect(markup).toContain("place.overview.weekly-presence.chart");
    expect(markup).toContain("Sep 7, 2026");
  });
});

describe("three tiles, and no fourth", () => {
  const model = assembleOverview(facts());
  const markup = html(
    <TileRow
      score={model.score}
      aiAnswers={model.aiAnswers}
      pagesPublished={model.pagesPublished}
      timeZone={ZONE}
    />
  );

  it("renders exactly three stat tiles", () => {
    expect(count(markup, 'class="stats"')).toBe(3);
  });

  it("leads with the Discoverability Score, its delta and its band (UI-SPEC 6a)", () => {
    // The set's `62 ▲ 8` beside the band word. Between DECISIONS
    // 2026-09-03 and the owner's 2026-09-08 screen set this tile did not
    // exist; ruling 6a names "Overview tile" and brought it back.
    expect(markup).toContain('data-testid="overview-tile-score"');
    expect(markup).toContain("overview.tile.score.label");
    expect(markup).toContain(">62<");
    expect(markup).toContain("overview.delta.up");
    expect(markup).toContain(">8<");
    expect(markup).toContain("band.score.hard-to-find");
  });

  it("the searches reading has no tile — the growth card is its home now", () => {
    expect(markup).not.toContain("overview.tile.searches.label");
  });

  it("names the pages already ranking and what the rest are waiting on", () => {
    expect(markup).toContain("overview.tile.pages.ranking(6)");
    expect(markup).toContain("overview.tile.pages.too-early(3)");
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
  const markup = html(<WeekModule week={model.week} timeZone={ZONE} supply={model.supply} />);

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

  it("carries the card head, and the calendar control inside it as the quiet rank", () => {
    // UI-SPEC S12: the control sits in the head, right-aligned, and it is
    // the tertiary — the screen's one solid fill is the veto panel's.
    expect(markup).toContain("overview.week.title");
    expect(markup).toContain('href="/app/calendar"');
    expect(markup).toContain("overview.week.calendar-link");
    expect(markup).toContain("rk-btn-tertiary");
  });

  it("renders exactly one supply statement", () => {
    expect(markup).toContain("overview.supply.short");
    expect(markup).not.toContain("overview.supply.exhausted");
    expect(markup).not.toContain("overview.supply.first-arrival");
  });

  it("no longer carries the alerts — they are the Needs-you card since #353", () => {
    expect(markup).not.toContain("overview.alert.");
    expect(markup).not.toContain("overview.alerts.empty");
  });
});

describe("needs you (UI-SPEC S12)", () => {
  const model = assembleOverview(facts());
  const markup = html(<NeedsYouModule alerts={model.alerts} overflow={model.overflow} />);

  it("is its own card, headed as the set heads it", () => {
    expect(markup).toContain("overview.needs-you.title");
    expect(markup).toContain('data-testid="overview-needs-you"');
  });

  it("renders at most two panels, each with one control, and the remainder as a count", () => {
    expect(count(markup, "rk-panel-title")).toBe(2);
    expect(count(markup, "rk-panel-cta")).toBe(2);
    expect(markup).toContain("overview.alert.overflow(1)");
  });

  it("gives the veto panel the warn ground and the solid pill, the reconnect panel the accent ground and the outline", () => {
    // Two calls to act on one screen, and §9.1 gives the screen one solid
    // fill: the page that publishes anyway takes it.
    expect(markup).toContain('data-tone="warn"');
    expect(markup).toContain("btn btn-sm btn-primary rk-pill");
    expect(markup).toContain("rk-btn-outline");
  });

  it("each panel's control navigates to that item's own address", () => {
    expect(markup).toContain('href="/app/draft/1"');
    expect(markup).toContain('href="/app/settings"');
  });

  it("the veto panel states how much of the window is left", () => {
    expect(markup).toContain("overview.alert.pending-veto.due");
  });

  it("with nothing waiting it states the success line rather than leaving a blank", () => {
    const empty = assembleOverview(facts({ waiting: [] }));
    const emptyMarkup = html(<NeedsYouModule alerts={empty.alerts} />);
    expect(emptyMarkup).toContain("overview.alerts.empty");
    expect(count(emptyMarkup, 'role="alert"')).toBe(1);
    expect(count(emptyMarkup, "rk-panel-title")).toBe(0);
  });
});

describe("UI-SPEC S13 — the week-0 arm, drawn", () => {
  const weekZero = { firstDueOn: new Date(Date.UTC(2026, 8, 7)) };
  const model = assembleOverview(
    facts({
      points: [],
      aiPresence: [],
      score: unmeasured<{ score: number; band: "hard-to-find" }>("not_attempted", TODAY),
      pagesPublished: measuredZero(0, TODAY),
      pagesRanking: unmeasured<number>("not_attempted", TODAY),
      deepPass: { value: measured(12, AT(31)), on: AT(31) },
      firstDueOn: weekZero.firstDueOn,
    })
  );

  it("the chart card names the pass its one reading came from", () => {
    const markup = html(<GrowthModule growth={model.growth} timeZone={ZONE} />);
    expect(markup).toContain("rk-srcchip");
    expect(markup).toContain("overview.growth.source.deep-pass");
    // One point, drawn — and no run *between* two of them: the polyline
    // carries a single coordinate pair, which is what renders the lone
    // reading (a zero-length subpath under a round linecap is a dot), and
    // the area fill `GrowthLine` guards on two points is absent.
    expect(markup).toContain('role="img"');
    expect(count(markup, "<polyline")).toBe(1);
    expect(markup).toMatch(/points="[\d.]+,[\d.]+"/);
    expect(markup).not.toContain('opacity="0.1"');
  });

  it("its footnotes are S13's pair, and the goal sentence is not among them", () => {
    const markup = html(<GrowthModule growth={model.growth} timeZone={ZONE} />);
    expect(markup).toContain("overview.growth.footnote.starting(12)");
    expect(markup).toContain("overview.growth.footnote.first-monday");
    expect(markup).not.toContain("overview.growth.footnote.goal");
    expect(markup).not.toContain("overview.growth.footnote.start(");
  });

  it("each tile states when its own reading arrives, in place of a number", () => {
    const markup = html(
      <TileRow
        score={model.score}
        aiAnswers={model.aiAnswers}
        pagesPublished={model.pagesPublished}
        timeZone={ZONE}
        weekZero={model.weekZero}
      />
    );
    expect(markup).toContain("overview.tile.score.first-due");
    expect(markup).toContain("overview.tile.ai-answers.first-pass");
    expect(markup).toContain("overview.tile.pages.first-review");
    // No band beside a dash: a band is a reading of a score.
    expect(markup).not.toContain("band.score.");
    // …and no ranking badge, because no count was taken.
    expect(markup).not.toContain("overview.tile.pages.ranking");
  });

  it("the rivals card states when sizing arrives rather than drawing empty rows", () => {
    const markup = html(
      <RivalModule rivals={model.rivals} timeZone={ZONE} weekZero={model.weekZero} />
    );
    expect(markup).toContain("overview.rivals.title");
    expect(markup).toContain("overview.rivals.line.week-zero");
    expect(markup).not.toContain("<svg class=\"rk-spark\"");
    expect(markup).not.toContain("overview.rivals.line.shrinking");
  });
});
