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
const count = (source: string, needle: string): number => source.split(needle).length - 1;

describe("how far ahead each rival is", () => {
  it("the ratio arm renders the figure, the was badge and the shrinking line", () => {
    const model = assembleOverview(facts());
    const markup = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    // The fixture's reachable rival: 420 against 81.
    expect(markup).toContain("overview.rivals.ratio(5)");
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

  it("#983 — the Rivals tab says where the leaders are left out; the Overview keeps its own line", () => {
    // Owner ruling 2026-09-21. The two sentences differ in one clause, and
    // the surface chooses which by handing the module a key: on the tab the
    // cards above name every leader, so "they aren't shown as your rivals"
    // read as a contradiction of what was on screen.
    const model = assembleOverview(facts());
    const overview = html(<RivalModule rivals={model.rivals} timeZone={ZONE} />);
    expect(overview).toContain("overview.rivals.leaders(bigcompetitor.com)");
    expect(overview).not.toContain("overview.rivals.leaders.tab");

    const tab = html(
      <RivalModule rivals={model.rivals} timeZone={ZONE} leadersKey="overview.rivals.leaders.tab" />
    );
    expect(tab).toContain("overview.rivals.leaders.tab(bigcompetitor.com)");
    // The names it states are the same names, from the same module.
    expect(tab).toContain("bigcompetitor.com");
    expect(tab).toContain("overview.rivals.leaders.swap");
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

describe("issue 867 — this week says what its pages aim at", () => {
  const weekOf = (over: Partial<OverviewFacts> = {}): string => {
    const model = assembleOverview(facts(over));
    return html(<WeekModule week={model.week} timeZone={ZONE} supply={model.supply} />);
  };

  it("names the searches, never a count", () => {
    const markup = weekOf();
    expect(markup).toContain(
      "overview.week.aimed-at(best crm for small teams, crm pricing comparison)"
    );
    expect(markup).toContain('data-testid="overview-week-aim"');
  });

  it("a week with no planned or written page states no aim at all", () => {
    const markup = weekOf({ weekSearches: [] });
    expect(markup).not.toContain('data-testid="overview-week-aim"');
    expect(markup).not.toContain("overview.week.aimed-at");
    // The strip itself is unchanged.
    expect(count(markup, 'data-testid="overview-week-day"')).toBe(7);
  });
});

describe("this week", () => {
  const model = assembleOverview(facts());
  const markup = html(<WeekModule week={model.week} timeZone={ZONE} supply={model.supply} />);

  it("renders seven days, each with its own date", () => {
    // Monday 31 Aug through Sunday 6 Sep, in the site's zone. The label is
    // the day of the month, as the set draws it (see `dayOf`). The month
    // is the module's heading's.
    for (const day of ["31", "1", "2", "3", "4", "5", "6"]) {
      expect(markup, `missing day ${day}`).toContain(`>${day}</span>`);
    }
    expect(count(markup, 'data-testid="overview-week-day"')).toBe(7);
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
    expect(markup).toContain("btn-ghost");
  });

  it("names each day by its weekday, its date, what stands on it and its state", () => {
    // SPEC §4 (2026-09-20): every cell carries a word, so its meaning is
    // never its colour. A day nothing is scheduled on says so.
    expect(markup).toContain('data-state="today"');
    expect(markup).toMatch(
      /aria-label="Fri 4 · overview\.week\.day\.no-page · overview\.week\.day\.today"/
    );
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

describe("needs you (S12)", () => {
  const model = assembleOverview(facts());
  const markup = html(<NeedsYouModule alerts={model.alerts} overflow={model.overflow} />);

  it("is its own card, headed as the set heads it", () => {
    expect(markup).toContain("overview.needs-you.title");
    expect(markup).toContain('data-testid="overview-needs-you"');
  });

  it("renders at most two panels, each with one control, and the remainder as a count", () => {
    expect(count(markup, 'data-testid="overview-alert"')).toBe(2);
    const pair = markup.slice(markup.indexOf('data-testid="overview-alert-panels"'));
    expect(count(pair.slice(0, pair.indexOf('data-testid="overview-overflow"')), "<a ")).toBe(2);
    expect(markup).toContain("overview.alert.overflow(1)");
  });

  it("spends no solid button at all — the screen's one is Read it, on the page waiting for review", () => {
    // SPEC §4 (2026-09-20): the page in review leads the screen and takes
    // its one solid control. This card no longer repeats that page, so a
    // panel here is always a second thing waiting and takes the soft rank (#1063).
    const veto = markup.slice(markup.indexOf('data-kind="pending_veto"'));
    const reconnect = markup.slice(markup.indexOf('data-kind="needs_you"'));
    expect(veto.slice(0, veto.indexOf("</a>"))).toContain("btn-soft");
    expect(reconnect.slice(0, reconnect.indexOf("</a>"))).toContain("btn-soft");
    expect(count(markup, 'class="btn btn-primary')).toBe(0);
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
    // #1070: a tick and one line, never a green alert.
    expect(count(emptyMarkup, 'role="alert"')).toBe(0);
    expect(count(emptyMarkup, 'data-testid="overview-alerts-empty"')).toBe(1);
    expect(count(emptyMarkup, 'data-testid="overview-alert"')).toBe(0);
  });
});

describe("needs you — a hosted blog waiting for its DNS record (#1174)", () => {
  it("renders the connect-blog line with its host, so Overview loads while the destination is pending_dns", () => {
    const model = assembleOverview(
      facts({ waiting: [{ kind: "connect_blog", hostname: "blog.example.com", since: AT(31), href: "/setup/connect" }] })
    );
    const markup = html(<NeedsYouModule alerts={model.alerts} />);
    expect(markup).toContain("overview.alert.connect-blog.line(blog.example.com)");
  });
});

describe("needs you — a technical issue the customer fixes (#572)", () => {
  const model = assembleOverview(
    facts({
      waiting: [
        { kind: "site_issue", check: "slow_pages", count: 3, over: 40, severity: "critical", since: AT(31), href: "/scan/example.com" },
      ],
    })
  );
  const markup = html(<NeedsYouModule alerts={model.alerts} overflow={model.overflow} issuesOverflow={model.issuesOverflow} />);

  it("names the check, its stored count over its set and its severity, and links to the fix lines", () => {
    expect(markup).toContain("check.slow-pages.title");
    expect(markup).toContain(">3/40<");
    expect(markup).toContain("severity.high");
    expect(markup).toContain('href="/scan/example.com"');
    expect(markup).toContain("alert-error");
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
