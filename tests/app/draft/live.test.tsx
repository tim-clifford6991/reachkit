/** @vitest-environment jsdom */
// tests/app/draft/live.test.tsx — board `PageDetail` (canvas V22), issue 1749
//
// A live page's own screen against its board, by the same reading the
// `no overflow · axe` gate makes (`scripts/design/parity.mjs`): every string
// the board draws is on the screen or is an allow line with its citation, and
// each section stands in the board's order. Then the arms the board does not
// draw: not in results yet, never read, and WordPress.
import "../../generate/env";
import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";
import { copy } from "@/lib/presentation/copy";
import { DraftScreen } from "@/app/(account)/app/draft/[draftId]/DraftScreen";
import { assembleDraft, type DraftFacts, type LiveFacts } from "@/app/(account)/app/draft/[draftId]/model";
import { FIXTURE_DRAFTS, FIXTURE_PUBLISHED_DRAFT_ID } from "@/app/(account)/app/draft/[draftId]/fixture";

const PUBLISHED = FIXTURE_DRAFTS[FIXTURE_PUBLISHED_DRAFT_ID]!;
const LIVE = PUBLISHED.live!;
const BOARD = readFileSync(boardFile("PageDetail"), "utf8");

/** What the app shell draws around every `/app` screen: the route-level
 *  reading in `tests/ui/layout/parity.test.ts` holds these. */
const SHELL = ["ReachKit", "Overview", "Plan", "Settings", "Publishing on", "Theme: light"];

/** A customer's live page: the reserved account's fixture draws no Edit. */
const CUSTOMER: DraftFacts = { ...PUBLISHED, live: { ...LIVE, edit: { kind: "editor" } } };

function render(facts: DraftFacts = CUSTOMER): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<DraftScreen view={assembleDraft(facts)} generatedLabel="Written by ReachKit" />);
  return host;
}

function withLive(live: Partial<LiveFacts>): DraftFacts {
  return { ...CUSTOMER, live: { ...CUSTOMER.live!, ...live } };
}

function at(root: Element, testId: string): Element {
  const found = root.querySelector(`[data-testid="${testId}"]`);
  if (found === null) throw new Error(`no ${testId}`);
  return found;
}

const before = (a: Element, b: Element): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("board PageDetail: every string it draws is on the screen", () => {
  it("leaves nothing missing but the shell's own", () => {
    const { missing } = compare(BOARD, segments(render().innerHTML), readAllow("PageDetail"));
    expect(missing.filter((s) => !SHELL.includes(s))).toEqual([]);
  });

  it("each allow line names a string the board draws, so none excuses nothing", () => {
    const { allowed } = compare(BOARD, [], readAllow("PageDetail"));
    expect(allowed.length).toBe(readAllow("PageDetail").length);
  });
});

describe("board PageDetail: the sections, in its order and words", () => {
  const host = render();

  it("back to Plan, the title, when it went live and its label, then its address", () => {
    const back = at(host, "draft-back");
    expect(back.textContent).toBe(copy("draft.back"));
    const title = at(host, "draft-title");
    const badges = at(host, "live-badges");
    expect(badges.textContent).toBe(copy("draft.live.since", { date: "Sep 14, 2026" }) + copy("review.label.climbing"));
    expect(badges.querySelector(".badge:last-child svg.lucide-trending-up")).not.toBeNull();
    expect(at(host, "live-address").textContent).toBe(`${LIVE.url} ${copy("draft.live.new-tab")}`);
    expect(before(back, title) && before(title, badges)).toBe(true);
  });

  it("this week in Google: the place, how far it moved, the visits and the chart's band", () => {
    const week = at(host, "live-week");
    expect(week.querySelector("h2")?.textContent).toBe(copy("draft.live.week"));
    expect(at(week, "live-week-figure").textContent).toContain(copy("draft.live.place", { search: "best crm for small teams" }));
    expect(at(week, "live-moved").textContent).toBe(
      copy("draft.live.up.near", { places: copy("draft.live.places", { n: "17" }), date: "Sep 21, 2026", gap: copy("draft.live.places", { n: "14" }) })
    );
    expect(at(week, "live-visits").textContent).toBe(copy("draft.live.visits", { n: "3", days: "28", date: "Oct 5, 2026" }));
    expect(at(week, "live-chart").textContent).toContain(copy("draft.live.band"));
  });

  it("the ladder with dates: four steps on Google, three in AI answers", () => {
    const google = [...at(host, "live-ladder-google").querySelectorAll("li")].map((li) => li.textContent);
    expect(google).toEqual([
      `${copy("draft.ladder.live")}Sep 14, 2026`,
      `${copy("draft.ladder.found")}Sep 16, 2026`,
      `${copy("draft.ladder.showing")}${copy("draft.ladder.places", { from: "41", to: "24" })}`,
      `${copy("draft.ladder.first-page")}${copy("draft.ladder.not-yet")}`,
    ]);
    const ai = [...at(host, "live-ladder-ai").querySelectorAll("li")].map((li) => li.textContent);
    expect(ai).toEqual([
      `${copy("draft.ladder.read")}Sep 17, 2026`,
      `${copy("draft.ladder.linked")}Oct 5, 2026 · ${copy("ai-answers.engine.ai-mode")}`,
      `${copy("draft.ladder.visit")}${copy("draft.ladder.not-yet")}`,
    ]);
  });

  it("what happens next, why this page with the search, the page and its live link, then the controls", () => {
    const next = at(host, "live-next");
    expect(next.textContent).toBe(`${copy("draft.next.title")} ${copy("draft.next.climbing")}`);
    const why = at(host, "draft-why");
    expect(why.querySelector("summary")?.textContent).toBe(copy("draft.search.title"));
    const open = at(host, "live-open");
    expect(open.textContent).toBe(`${copy("draft.live.open")} ${copy("draft.live.new-tab")}`);
    const controls = at(host, "live-controls");
    expect(controls.textContent).toContain(copy("draft.live.runs"));
    expect(before(at(host, "live-week"), next) && before(next, why) && before(why, at(host, "published-view"))).toBe(true);
    expect(before(at(host, "published-view"), open) && before(open, controls)).toBe(true);
    expect(host.querySelector('[data-testid="draft-decide"]')).toBeNull();
  });
});

describe("the arms the board does not draw", () => {
  it("not in results yet: the furthest step stands in for the figure, and no chart", () => {
    const reading = { ...LIVE.reading!, place: null, first: null, best: null };
    const host = render(withLive({ reading, label: "too_early" }));
    expect(at(host, "live-furthest").textContent).toBe(
      copy("draft.live.furthest", { step: copy("draft.ladder.found"), date: "Sep 16, 2026" })
    );
    expect(host.querySelector('[data-testid="live-chart"]')).toBeNull();
    expect(host.querySelector('[data-testid="live-moved"]')).toBeNull();
  });

  it("never read: each unread step says not measured, and nothing reads as 0", () => {
    const host = render(withLive({ reading: null, label: null }));
    const google = [...at(host, "live-ladder-google").querySelectorAll("li")].map((li) => li.textContent);
    expect(google.slice(1)).toEqual(
      ["draft.ladder.found", "draft.ladder.showing", "draft.ladder.first-page"].map((key) => `${copy(key as never)}${copy("draft.ladder.unmeasured")}`)
    );
    expect(host.querySelector('[data-testid="live-visits"]')).toBeNull();
    expect(at(host, "live-badges").textContent).toContain(copy("review.label.unmeasured"));
    expect(at(host, "live-next").textContent).toContain(copy("draft.next.unmeasured"));
  });

  it("the index state on Found by Google: the date found, not yet, or not measured", () => {
    const foundStep = (live: Partial<LiveFacts>) =>
      [...at(render(withLive(live)), "live-ladder-google").querySelectorAll("li")].find(
        (li) => li.querySelector("span")?.textContent === copy("draft.ladder.found")
      )?.lastElementChild?.textContent;
    const unfound = { ...LIVE.reading!.reached, found: undefined };
    expect(foundStep({})).toBe("Sep 16, 2026");
    expect(foundStep({ reading: { ...LIVE.reading!, reached: unfound } })).toBe(copy("draft.ladder.not-yet"));
    expect(foundStep({ reading: null })).toBe(copy("draft.ladder.unmeasured"));
  });

  it("WordPress: Found by Google, Read by AI, the AI visit and the visits line are not drawn", () => {
    const host = render(withLive({ wordpress: true }));
    const steps = host.querySelectorAll('[data-testid^="live-ladder-"] li');
    const words = [...steps].map((li) => li.querySelector("span")?.textContent);
    expect(words).toEqual([copy("draft.ladder.live"), copy("draft.ladder.showing"), copy("draft.ladder.first-page"), copy("draft.ladder.linked")]);
    expect(host.querySelector('[data-testid="live-visits"]')).toBeNull();
  });
});

describe("Edit this page (owner R19)", () => {
  it("a live page shows Edit this page beside Stop this page", () => {
    const controls = at(render(), "live-controls");
    const edit = at(controls, "live-edit");
    expect(edit.tagName).toBe("BUTTON");
    expect(edit.textContent).toBe(copy("draft.action.edit"));
    expect(edit.nextElementSibling).toBe(at(controls, "take-down"));
  });

  it("a version already waiting is what it opens", () => {
    const edit = at(render(withLive({ edit: { kind: "version", draftId: "d-next" } })), "live-edit");
    expect(edit.getAttribute("href")).toBe("/app/draft/d-next");
    expect(edit.textContent).toBe(copy("draft.action.edit"));
  });

  it("taken-down arm: a page the customer took down draws no Edit", () => {
    const stopped = { ...CUSTOMER, state: "unpublished" as const, takeDown: { kind: "stopped" as const, wordpress: false, putBackUntil: new Date("2026-10-25T12:00:00.000Z") } };
    const host = render(stopped);
    expect(host.querySelector('[data-testid="put-back"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="live-edit"]')).toBeNull();
  });

  it("fixture arm: the reserved account's live page draws no Edit", () => {
    const host = render(PUBLISHED);
    expect(host.querySelector('[data-testid="take-down"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="live-edit"]')).toBeNull();
  });
});
