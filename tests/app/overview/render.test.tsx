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
// customer will see the moment the owner fills the keys: both rival arms and
// the week-0 arm.
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
import { RivalModule } from "@/app/(account)/app/_overview/RivalModule";
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
  // Issue 867: the engines the pass asked, and what this week aims at.
  aiEngines: ["ai_overview", "ai_mode", "chatgpt"],
  weekSearches: ["best crm for small teams", "crm pricing comparison"],
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
  supply: { exhausted: false, unmeasured: false, measuring: false, outsized: false, short: true, firstArrivalShortfall: false },
  waiting: [
    { kind: "pending_veto", title: "a draft", since: AT(31), vetoDeadline: AT(32), href: "/app/draft/1" },
    { kind: "needs_you", title: "a destination", since: AT(31), vetoDeadline: null, href: "/app/settings" },
    { kind: "pending_veto", title: "another draft", since: AT(31), vetoDeadline: AT(32), href: "/app/draft/2" },
  ],
  ...over,
});

const html = (el: React.ReactElement): string => renderToStaticMarkup(el);

describe("how far ahead each rival is", () => {
  it("the ratio arm renders the figure, where it was before and the shrinking line", () => {
    const model = assembleOverview(facts());
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    // The fixture's reachable rival: 420 against 81.
    expect(markup).toContain("overview.rivals.ratio(5)");
    expect(markup).toMatch(/overview\.rivals\.(from|flat)/);
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

  // ── Right-sized rivals, rendered (issue 858; REQ-096 c6) ────────────
  it("a far rival is not a row: it is named as a market leader, after the reachable rows, with one control", () => {
    const model = assembleOverview(facts());
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    expect(markup).toContain("overview.rivals.leaders(bigcompetitor.com)");
    expect(markup).not.toContain("overview.rivals.spark.label(bigcompetitor.com)");
    expect(markup).toContain("overview.rivals.spark.label(secondplace.io)");
    expect(markup.indexOf("secondplace.io")).toBeLessThan(markup.indexOf("overview.rivals.leaders("));
    expect(markup).not.toContain("overview.rivals.none-reachable");
  });

  it("the board's size note leads the leaders' line, under the card's own name and its pace", () => {
    const model = assembleOverview(facts());
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    expect(markup).toContain("overview.rivals.ahead.size overview.rivals.leaders(bigcompetitor.com)");
    expect(markup).toContain("overview.rivals.ahead.sub");
  });

  it("the control is a link to the competitors card, and there is exactly one", () => {
    const model = assembleOverview(facts());
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    expect(markup.split('href="/app/settings"').length - 1).toBe(1);
    expect(markup.split("overview.rivals.leaders.swap").length - 1).toBe(1);
  });

  it("with no reachable rival the card says so first, and leads with no far rival", () => {
    const far = (domain: string, count: number) => ({
      domain,
      confirmed: true,
      ranked: measured(count, AT(31)),
      series: [count],
      size: { domain, state: "sized" as const, rankedCount: count, band: "far" as const, at: AT(31), current: true },
    });
    const model = assembleOverview(
      facts({ rivals: { own: measured(3, AT(31)), rivals: [far("zapier.com", 218_224), far("ahrefs.com", 59_767)] } })
    );
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    expect(markup).toContain("overview.rivals.none-reachable");
    expect(markup).toContain("overview.rivals.leaders(zapier.com, ahrefs.com)");
    expect(markup).not.toContain("overview.rivals.spark.label");
    expect(markup).not.toContain("far beyond your reach");
  });
});

describe("S13 — the week-0 arm, drawn", () => {
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
      // The deep pass sized nobody: the card has no starting rows (#793).
      rivals: {
        own: measured(12, AT(31)),
        rivals: [
          {
            domain: "bigcompetitor.com",
            confirmed: true,
            ranked: unmeasured<number>("not_attempted", AT(31)),
            series: [],
          },
        ],
      },
    })
  );

  it("with no sizes from the deep pass, the rivals card states when sizing arrives rather than drawing empty rows", () => {
    const markup = html(
      <RivalModule rivals={model.rivals} timeZone={ZONE} weekZero={model.weekZero} />
    );
    expect(markup).toContain("overview.rivals.title");
    expect(markup).toContain("overview.rivals.line.week-zero");
    expect(markup).not.toContain("<svg class=\"rk-spark\"");
    expect(markup).not.toContain("overview.rivals.line.shrinking");
  });
});
