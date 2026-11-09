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
import { DAY_ROW, WEEK_LIST } from "../../../src/app/(account)/app/calendar/frame";
import DraftLoading from "../../../src/app/(account)/app/draft/[draftId]/loading";
import SettingsLoading from "../../../src/app/(account)/app/settings/loading";

function html(screen: () => React.JSX.Element): string {
  return renderToStaticMarkup(screen());
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Plan's wait counts the week from the screen's own today, which is the
 *  account's: a site in New York, as the layout has already read it. */
function plan(): string {
  return renderToStaticMarkup(CalendarLoading());
}

const REPORT = html(ReportLoading);

/** Every `/app` waiting state, by the file it lives in. */
const APP_SCREENS = [
  { name: "(tabs)/loading.tsx", markup: html(OverviewLoading) },
  { name: "(tabs)/search/loading.tsx", markup: html(SearchLoading) },
  { name: "(tabs)/rivals/loading.tsx", markup: html(RivalsLoading) },
  { name: "(tabs)/ai-answers/loading.tsx", markup: html(AiAnswersLoading) },
  { name: "calendar/loading.tsx", markup: await plan() },
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

const PLAN = plan();

describe("Plan waits in the shape of the Plan that arrives (issue 1320)", () => {
  const part = (testId: string): string => {
    const at = PLAN.indexOf(`data-testid="${testId}"`);
    if (at === -1) throw new Error(`no ${testId} in the waiting Plan`);
    return PLAN.slice(PLAN.lastIndexOf("<", at), PLAN.indexOf(">", at));
  };

  it("is named as the loaded screen is", () => {
    // The name has no read behind it, so the eyebrow says it from the first
    // paint; the week's heading and lead arrive with the week.
    expect(PLAN).toContain(`<span class="eyebrow">${COPY["shell.nav.plan"]}</span>`);
    expect(COPY["calendar.title"].startsWith(COPY["shell.nav.plan"])).toBe(true);
  });

  it("is the week as one list at every width, as the loaded screen draws it", () => {
    expect(part("plan-skeleton-list")).toContain(`class="${WEEK_LIST}"`);
    expect(PLAN).not.toMatch(/lg:hidden|lg:grid/);
    // The day panel has a place wherever the loaded screen opens one.
    expect(part("plan-skeleton-panel")).toMatch(/\bhidden\b.*lg:flex/);
  });

  it("draws the seven days the week that arrives draws, Monday to Sunday", () => {
    expect(occurrences(PLAN, `class="${DAY_ROW}"`)).toBe(7);
  });
});
