// UI-SPEC §4 rule 3 — the waiting state, two mounts of one written line.
//
// "Every empty, degraded or waiting state is one written line; never a
// spinner, never a blank card." Issue #327 asks for a `loading.tsx`
// wherever a route awaits a database read, and this is what one draws.
//
// Rendered rather than walked, for `screens.test.tsx`'s reason beside it:
// the shape hands its one sentence over from the registry, and a walker
// over the returned element would see `<WaitingScreen>` and never a word.
// `renderToStaticMarkup` is the same renderer the copy sweeps use and it
// runs in the `node` project with no DOM.
//
// What is asserted is the rule and the two structural facts that follow
// from where each file mounts: one sentence and nothing else on the screen;
// **no bar**, which is the part of the issue's own Done-when the registry
// refuses (see `src/app/_fallback/Waiting.tsx`'s header); a `Surface` root
// on the report's arm, which owns its screen root, and none under `/app`,
// where the shell's layout owns it (issue #83).
import { describe, expect, it } from "vitest";
import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AWAITING_COPY, COPY } from "../../../src/lib/presentation/copy";
import ReportLoading from "../../../src/app/(public)/scan/[domain]/loading";
import AppLoading from "../../../src/app/(account)/app/loading";

function html(screen: () => React.JSX.Element): string {
  return renderToStaticMarkup(screen());
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const REPORT = html(ReportLoading);
const APP = html(AppLoading);

const EVERY_SCREEN = [
  { name: "(public)/scan/[domain]/loading.tsx", markup: REPORT },
  { name: "(account)/app/loading.tsx", markup: APP },
];

describe("set §4 rule 3 — a waiting state is one written line", () => {
  it.each(EVERY_SCREEN)("$name draws exactly one sentence", ({ markup }) => {
    expect(occurrences(markup, "<p")).toBe(1);
    expect(occurrences(markup, `<p class="rk-quiet">${COPY["chrome.loading.line"]}</p>`)).toBe(1);
  });

  it.each(EVERY_SCREEN)("$name draws no bar and no spinner", ({ markup }) => {
    // The Done-when asks for the registered `Progress` and the registry
    // refuses it here: `value` and `max` are both required, and a route
    // that has not answered has no measured value to put in one. REQ-003 c1
    // — "never an unlabelled spinner and never an indeterminate bar alone"
    // — and §4.1's "no spinner" are the same answer from the other
    // direction. `verdict.tsx` sets the precedent: its unmeasured driver
    // renders no bar rather than an empty one.
    expect(markup).not.toContain("<progress");
    expect(markup).not.toContain("progress");
    expect(markup).not.toContain("spinner");
    expect(markup).not.toContain("skeleton");
  });

  it.each(EVERY_SCREEN)("$name carries the hook the layout sweep waits on", ({ markup }) => {
    // `browser.ts` waits for `[data-waiting]` to leave the document after
    // every navigation, because a screen that is still waiting is not a
    // screen to measure — the failure that found it was `/app/settings` on
    // the live account, read while the content well still held this line.
    // One attribute for both mounts, so a third `loading.tsx` is covered by
    // writing none of it.
    expect(markup).toContain("data-waiting");
  });

  it.each(EVERY_SCREEN)("$name announces itself as a wait", ({ markup }) => {
    // A line that replaces a screen without a reload is one a screen reader
    // is otherwise never told about. Neither attribute is a sentence.
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-busy="true"');
  });

  it("both mounts spend the one key, and it is the owner's approved line (2026-09-10, #459)", () => {
    // One sentence, one home. The 404's line is split public/app because
    // the two say different things; a waiting line does not.
    expect(COPY["chrome.loading.line"]).toBe("Loading…");
    expect(AWAITING_COPY).not.toContain("chrome.loading.line");
    expect(occurrences(REPORT, COPY["chrome.loading.line"])).toBe(1);
    expect(occurrences(APP, COPY["chrome.loading.line"])).toBe(1);
  });

  it("the report's arm is its own Surface root; the app's is not", () => {
    // ADR-093 decision 6: exactly one `[data-surface]` per document. The
    // seven arms of `/scan/{domain}` each declare their own, so the
    // fallback that stands in for them must too — and under `/app` the
    // shell's layout owns the route's screen root, so a second one here
    // would be a second `[data-surface]` on that document.
    expect(occurrences(REPORT, "data-surface")).toBe(1);
    expect(occurrences(APP, "data-surface")).toBe(0);
  });

  it("the app's fallback nests no second <main> inside the shell's", () => {
    // `(account)/app/layout.tsx` renders `<main class="rk-main">` and this
    // file draws inside it; `<main>` does not nest.
    expect(APP).not.toContain("<main");
    expect(REPORT).toContain("<main");
  });

  it("both stand in the centred reading column S8's screens stand in", () => {
    for (const { markup } of EVERY_SCREEN) {
      expect(occurrences(markup, 'class="rk-fallback"')).toBe(1);
    }
  });
});
