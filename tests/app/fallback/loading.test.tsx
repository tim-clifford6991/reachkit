// tests/app/fallback/loading.test.tsx — what a route draws while it waits.
//
// UI-SPEC §4 rule 3 used to hold everywhere: "Every empty, degraded or
// waiting state is one written line; never a spinner, never a blank card."
// SPEC §4 of 2026-09-20 (#908) replaced it for `/app` routes with daisyUI
// `skeleton` placeholders, and SPEC §2 of 2026-10-07 (issue 1328) did the
// same for the public report: its waiting state is the shape of the
// report's first screen. So one rule holds everywhere now — a screen's own
// boxes, no sentence, no spinner, no bar.
//
// The single `(account)/app/loading.tsx` is gone. It was one line for three
// addresses; there are seven files now, one per route, and the block below
// enumerates every one of them so an eighth route added without a waiting
// state of its own is a failure here rather than a blank screen on a phone.
import { describe, expect, it } from "vitest";
import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COPY } from "../../../src/lib/presentation/copy";
import ReportLoading from "../../../src/app/(public)/scan/[domain]/loading";
import OverviewLoading from "../../../src/app/(account)/app/(tabs)/loading";
import SearchLoading from "../../../src/app/(account)/app/(tabs)/search/loading";
import RivalsLoading from "../../../src/app/(account)/app/(tabs)/rivals/loading";
import AiAnswersLoading from "../../../src/app/(account)/app/(tabs)/ai-answers/loading";
import CalendarLoading from "../../../src/app/(account)/app/calendar/loading";
import DraftLoading from "../../../src/app/(account)/app/draft/[draftId]/loading";
import SettingsLoading from "../../../src/app/(account)/app/settings/loading";

function html(screen: () => React.JSX.Element): string {
  return renderToStaticMarkup(screen());
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const REPORT = html(ReportLoading);

/** Every `/app` waiting state, by the file it lives in. */
const APP_SCREENS = [
  { name: "(tabs)/loading.tsx", markup: html(OverviewLoading) },
  { name: "(tabs)/search/loading.tsx", markup: html(SearchLoading) },
  { name: "(tabs)/rivals/loading.tsx", markup: html(RivalsLoading) },
  { name: "(tabs)/ai-answers/loading.tsx", markup: html(AiAnswersLoading) },
  { name: "calendar/loading.tsx", markup: html(CalendarLoading) },
  { name: "draft/[draftId]/loading.tsx", markup: html(DraftLoading) },
  { name: "settings/loading.tsx", markup: html(SettingsLoading) },
];

describe("the public report waits in the shape of its first screen (SPEC §2, issue 1328)", () => {
  it("holds four cards of boxes — the score, the two results and the offer — and no sentence", () => {
    expect(occurrences(REPORT, 'class="card ')).toBe(4);
    expect(occurrences(REPORT, "skeleton")).toBeGreaterThan(0);
    expect(REPORT.replace(/<[^>]+>/g, "").trim()).toBe("");
  });

  it("draws no bar and no spinner, and says once that it is waiting", () => {
    expect(REPORT).not.toContain("<progress");
    expect(REPORT).not.toContain("spinner");
    expect(occurrences(REPORT, 'role="status"')).toBe(1);
    expect(occurrences(REPORT, "data-waiting")).toBe(1);
  });

  it("is its own Surface root, and renders its own <main>", () => {
    // The seven arms of `/scan/{domain}` each declare one, so the fallback
    // standing in for them must too.
    expect(occurrences(REPORT, "data-surface")).toBe(1);
    expect(REPORT).toContain("<main");
  });
});

describe("every /app route — skeletons of its own cards (SPEC §4, 2026-09-20)", () => {
  it.each(APP_SCREENS)("$name holds its screen's boxes, not a sentence", ({ markup }) => {
    // The rule that replaced the written line. A `skeleton` box is the
    // shape of the thing that is coming; a sentence here would be words the
    // customer reads and then watches disappear.
    expect(occurrences(markup, "skeleton")).toBeGreaterThan(0);
  });

  it.each(APP_SCREENS)("$name draws no spinner and no bar", ({ markup }) => {
    // The half of the old rule that did not change, and the reason it did
    // not: a spinner says a screen is busy, which the customer can see, and
    // says nothing about what is coming.
    expect(markup).not.toContain("spinner");
    expect(markup).not.toContain("<progress");
  });

  it.each(APP_SCREENS)("$name carries the hook the layout sweep waits on", ({ markup }) => {
    // `browser.ts` waits for `[data-waiting]` to leave the document after
    // every navigation, because a screen that is still waiting is not a
    // screen to measure. One attribute for every mount, so an eighth route
    // is covered by writing none of it.
    expect(markup).toContain("data-waiting");
  });

  it.each(APP_SCREENS)("$name announces the wait once, not once per box", ({ markup }) => {
    // A screen reader is owed "this is loading", not eleven blank regions:
    // the boxes are `aria-hidden` and the regions around them carry the
    // status. One region per card is the shape; what is ruled out is a
    // status on every box.
    expect(occurrences(markup, 'role="status"')).toBeGreaterThan(0);
    expect(occurrences(markup, 'role="status"')).toBeLessThanOrEqual(
      occurrences(markup, "data-waiting")
    );
    expect(markup).toContain('aria-busy="true"');
    expect(occurrences(markup, "aria-hidden")).toBeGreaterThan(0);
  });

  it.each(APP_SCREENS)("$name declares no Surface and nests no second <main>", ({ markup }) => {
    // ADR-093 decision 6: exactly one `[data-surface]` per document, and
    // under `/app` the shell's layout owns it. `<main>` does not nest.
    expect(occurrences(markup, "data-surface")).toBe(0);
    expect(markup).not.toContain("<main");
  });
});

describe("Plan waits in the shape of the Plan that arrives (issue 1320)", () => {
  const PLAN = html(CalendarLoading);
  const part = (testId: string): string => {
    const at = PLAN.indexOf(`data-testid="${testId}"`);
    if (at === -1) throw new Error(`no ${testId} in the waiting Plan`);
    return PLAN.slice(PLAN.lastIndexOf("<", at), PLAN.indexOf(">", at));
  };

  it("is headed as the loaded screen is, with the month switcher's place held", () => {
    // The name has no read behind it, so it is there from the first paint
    // and is not replaced; the switcher names a month, so it is a box.
    expect(PLAN).toContain(`>${COPY["shell.nav.plan"]}</h1>`);
    expect(part("month-switcher-skeleton")).toContain("skeleton");
  });

  it("is a list of days on a phone and the month grid from md, never seven columns below it", () => {
    // The loaded screen's own media queries (`CalendarView`): the list is
    // `md:hidden`, the grid `hidden md:block`.
    expect(part("plan-skeleton-list")).toContain("md:hidden");
    expect(part("plan-skeleton-grid")).toMatch(/\bhidden\b.*md:block/);
    expect(PLAN).not.toContain("grid-cols-7");
    // The day panel has a place wherever the loaded screen opens one.
    expect(part("plan-skeleton-panel")).toMatch(/\bhidden\b.*md:flex/);
  });
});
