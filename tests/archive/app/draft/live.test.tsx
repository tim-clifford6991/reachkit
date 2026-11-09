/** @vitest-environment jsdom */
// tests/app/draft/live.test.tsx — board `PageDetail` (canvas v36)
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
import type { Label } from "@/lib/opportunities/verdicts/types";
import { FIXTURE_DRAFTS, FIXTURE_PUBLISHED_DRAFT_ID } from "@/app/(account)/app/draft/[draftId]/fixture";
import { FactsPanel } from "@/app/(account)/app/draft/[draftId]/FactsPanel";
import { FIXTURE_QUOTABLE } from "@/app/(account)/app/settings/business-fixture";
import { quotableFacts } from "@/lib/site-profile/business/confirm";
import { NO_EDITS } from "@/lib/site-profile/business/types";

const PUBLISHED = FIXTURE_DRAFTS[FIXTURE_PUBLISHED_DRAFT_ID]!;
const LIVE = PUBLISHED.live!;
const BOARD = readFileSync(boardFile("PageDetail"), "utf8");

/** What the app shell draws around every `/app` screen: the route-level
 *  reading in `tests/ui/layout/parity.test.ts` holds these. */
const SHELL = ["ReachKit", "Overview", "This week", "Settings", "Publishing on", "Theme: light"];

/** A customer's live page: the reserved account's fixture draws no Edit. */
const CUSTOMER: DraftFacts = { ...PUBLISHED, live: { ...LIVE, edit: { kind: "editor" } } };

/** The facts card the route hands the live arm, over the reserved account's passages. */
const FACTS = <FactsPanel facts={quotableFacts({ facts: FIXTURE_QUOTABLE, edits: NO_EDITS })} />;

function render(facts: DraftFacts = CUSTOMER): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<DraftScreen view={assembleDraft(facts)} generatedLabel="Written by ReachKit" facts={FACTS} />);
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

/** A ladder step as read: its name, then its date or standing. */
const stepText = (li: Element): string =>
  `${li.querySelector('[data-testid="live-step-name"]')?.textContent}${li.querySelector('[data-testid="live-step-at"]')?.textContent}`;

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
    expect(at(week, "live-visits").textContent).toBe(copy("draft.live.visits", { n: "3", days: "28" }));
    expect(at(week, "live-chart").textContent).toContain(copy("draft.live.band"));
  });

  it("the ladder with dates: four steps on Google, three in AI answers", () => {
    const google = [...at(host, "live-ladder-google").querySelectorAll("li")].map(stepText);
    expect(google).toEqual([
      `${copy("draft.ladder.live")}Sep 14, 2026`,
      `${copy("draft.ladder.found")}Sep 16, 2026`,
      `${copy("calendar.live.showing")}${copy("draft.ladder.places", { from: "41", to: "24" })}`,
      `${copy("draft.live.first-page")}${copy("draft.ladder.not-yet")}`,
    ]);
    const ai = [...at(host, "live-ladder-ai").querySelectorAll("li")].map(stepText);
    expect(ai).toEqual([
      `${copy("draft.ladder.read")}Sep 17, 2026`,
      `${copy("draft.ladder.linked")}Oct 5, 2026 · ${copy("ai-answers.engine.ai-mode")}`,
      `${copy("draft.ladder.visit")}${copy("draft.ladder.not-yet")}`,
    ]);
  });

  it("what happens next, then why this page: the reason, the search, then Edit and Stop and what Stop does", () => {
    const next = at(host, "live-next");
    expect(next.textContent).toBe(`${copy("draft.next.title")} ${copy("draft.next.climbing")}`);
    const why = at(host, "draft-why");
    const search = at(why, "draft-search");
    expect(search.querySelector("summary")?.textContent).toBe(copy("draft.search.title"));
    const controls = at(why, "live-controls");
    const stop = at(controls, "take-down");
    const note = at(controls, "live-stop-note");
    expect(before(at(host, "live-week"), next) && before(next, why)).toBe(true);
    expect(before(search, controls) && before(at(controls, "live-edit"), stop) && before(stop, note)).toBe(true);
    expect(note.textContent).toBe(`${copy("draft.live.stop-note")} ${copy("draft.live.pause-lead")}${copy("draft.live.pause-link")}`);
    expect(note.querySelector("a")?.getAttribute("href")).toBe("/app/settings/pages");
    expect(stop.getAttribute("aria-describedby")).toBe(note.id);
  });

  it("then Facts we can quote, closed, after why this page", () => {
    const facts = at(host, "settings-business-facts");
    expect(facts.querySelector("summary")?.textContent).toBe(copy("settings.business.facts.title"));
    expect(facts.hasAttribute("open")).toBe(false);
    expect(before(at(host, "draft-why"), facts)).toBe(true);
  });

  it("the search opens from a quiet link, and a step not reached is its number in a dashed ring, with no rail", () => {
    const summary = at(host, "draft-search").querySelector("summary")!;
    expect(summary.className).toContain("link-primary");
    expect(summary.className).not.toContain("bg-base-200");
    expect(summary.firstElementChild?.getAttribute("class")).toContain("lucide-chevron-down");
    const google = at(host, "live-ladder-google");
    expect(google.querySelector(".steps, .step")).toBeNull();
    const pending = [...google.querySelectorAll('li[data-reached="not-yet"]')];
    expect(pending.map((li) => li.firstElementChild!.textContent)).toEqual(["4"]);
    expect(pending[0]!.firstElementChild!.className).toContain("border-dashed");
  });

  it("draws no separate controls card and no page preview: the header's address opens the page", () => {
    expect([...host.querySelectorAll("section")].map((card) => card.dataset.testid)).toEqual(["live-week", "draft-why"]);
    expect(host.querySelector(".mockup-browser, [data-testid='published-view'], [data-testid='draft-body']")).toBeNull();
    expect(host.querySelectorAll(`a[href="${LIVE.url}"]`)).toHaveLength(1);
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
    const google = [...at(host, "live-ladder-google").querySelectorAll("li")].map(stepText);
    expect(google.slice(1)).toEqual(
      ["draft.ladder.found", "calendar.live.showing", "draft.live.first-page"].map((key) => `${copy(key as never)}${copy("draft.ladder.unmeasured")}`)
    );
    expect(host.querySelector('[data-testid="live-visits"]')).toBeNull();
    expect(at(host, "live-badges").textContent).toContain(copy("review.label.unmeasured"));
    expect(at(host, "live-next").textContent).toContain(copy("draft.next.unmeasured"));
  });

  it("the index state on Found by Google: the date found, not yet, or not measured", () => {
    const foundStep = (live: Partial<LiveFacts>) =>
      [...at(render(withLive(live)), "live-ladder-google").querySelectorAll("li")].find(
        (li) => li.querySelector('[data-testid="live-step-name"]')?.textContent === copy("draft.ladder.found")
      )?.querySelector('[data-testid="live-step-at"]')?.textContent;
    const unfound = { ...LIVE.reading!.reached, found: undefined };
    expect(foundStep({})).toBe("Sep 16, 2026");
    expect(foundStep({ reading: { ...LIVE.reading!, reached: unfound } })).toBe(copy("draft.ladder.not-yet"));
    expect(foundStep({ reading: null })).toBe(copy("draft.ladder.unmeasured"));
  });

  it("WordPress: Found by Google, Read by AI, the AI visit and the visits line are not drawn", () => {
    const host = render(withLive({ wordpress: true }));
    const steps = host.querySelectorAll('[data-testid^="live-ladder-"] li');
    const words = [...steps].map((li) => li.querySelector('[data-testid="live-step-name"]')?.textContent);
    expect(words).toEqual([copy("draft.ladder.live"), copy("calendar.live.showing"), copy("draft.live.first-page"), copy("draft.ladder.linked")]);
    expect(host.querySelector('[data-testid="live-visits"]')).toBeNull();
  });
});

describe("the verdict badge draws the shared icon, per label", () => {
  const ICON: Readonly<Record<Label, string>> = {
    working: "lucide-check",
    climbing: "lucide-trending-up",
    too_early: "lucide-clock",
    not_moving: "lucide-minus",
  };
  for (const [label, icon] of Object.entries(ICON) as [Label, string][]) {
    it(label, () => {
      const badge = at(render(withLive({ label })), "live-badges").lastElementChild!;
      expect(badge.textContent).toBe(copy(`review.label.${label}`));
      expect(badge.querySelector(`svg.${icon}`)).not.toBeNull();
    });
  }
});

describe("the live page's board icons", () => {
  const host = render();

  it("Live since opens with the globe", () => {
    expect(at(host, "live-badges").firstElementChild!.querySelector("svg.lucide-globe")).not.toBeNull();
  });

  it("the address carries the new-tab mark and says it opens a new tab", () => {
    const address = at(host, "live-address");
    expect(address.querySelector("svg.lucide-external-link")).not.toBeNull();
    expect(address.querySelector(".sr-only")?.textContent).toBe(` ${copy("draft.live.new-tab")}`);
  });

  it("a reached step draws its ladder's icon: the tick on Google, sparkles in AI answers", () => {
    const icons = (testId: string) =>
      [...at(host, testId).querySelectorAll("li")].map((li) => li.querySelector('[data-testid="live-step-icon"] svg')?.getAttribute("class") ?? null);
    expect(icons("live-ladder-google").map((c) => c?.includes("lucide-check") ?? null)).toEqual([true, true, true, null]);
    expect(icons("live-ladder-ai").map((c) => c?.includes("lucide-sparkles") ?? null)).toEqual([true, true, null]);
  });

  it("an unmeasured step keeps its words and draws no reached icon", () => {
    const unread = render(withLive({ reading: null, label: null }));
    const steps = [...unread.querySelectorAll('[data-testid^="live-ladder-"] li')].slice(1);
    expect(steps.every((li) => li.querySelector('[data-testid="live-step-icon"]') === null)).toBe(true);
    expect(steps.every((li) => stepText(li).endsWith(copy("draft.ladder.unmeasured")))).toBe(true);
  });

  it("what happens next draws the refresh, not the bulb", () => {
    const next = at(host, "live-next");
    expect(next.querySelector("svg.lucide-refresh-cw")).not.toBeNull();
    expect(next.querySelector("svg.lucide-lightbulb")).toBeNull();
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
