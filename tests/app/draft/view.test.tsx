/** @vitest-environment jsdom */
// tests/app/draft/view.test.tsx — BUILD §4.6, REQ-045 criteria 1-9, 11, 12
//
// The screen itself. Two halves, because two different things are being
// asserted: what the view *says* on arrival (rendered statically, the way
// `tests/app/calendar/day-panel.test.tsx` renders), and what it *does* when
// the customer edits (rendered into a real client root, so state, the two
// debounces and the autosave actually run).
//
// The save seam is mocked here: `tests/app/draft/save.test.ts` drives the
// real one through the Server Function to the row. What this file needs is a
// seam it can watch and steer — a save that is refused (a real outage's
// behaviour) and a save that lands.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// CodeMirror's own way back from the DOM to the editor (issue 932): the
// draft body is a CodeMirror 6 field now, so the buffer is read off the
// editor rather than off an element's `value`.
import { EditorView } from "@codemirror/view";

const save = vi.fn();

vi.mock("@/app/(account)/app/draft/[draftId]/save", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(account)/app/draft/[draftId]/save")>();
  return { ...actual, draftStore: { save: (...args: unknown[]) => save(...args) } };
});

import { AUTOSAVE_DEBOUNCE_MS, PREVIEW_DEBOUNCE_MS } from "@/lib/config/constants";

/** `@uiw/react-codemirror`'s own `TYPING_TIMOUT` (`esm/useCodeMirror.js`):
 *  how long a controlled `value` waits after a change before it overrides
 *  the document. Not ours to pin in `constants.ts` — it is the library's
 *  number, named here so the one test that has to wait it out says why. */
const CODEMIRROR_TYPING_LATCH_MS = 200;
import { copy } from "@/lib/presentation/copy";
import { renderMarkdownHtml } from "@/lib/publish/render/markdown";
import { DraftScreen } from "@/app/(account)/app/draft/[draftId]/DraftScreen";
import { assembleDraft } from "@/app/(account)/app/draft/[draftId]/model";
import { CLAIM_COPY_KEY, CLAIM_STATES } from "@/app/(account)/app/draft/[draftId]/claim";
import {
  FIXTURE_DRAFTS,
  FIXTURE_DRAFT_ID,
  FIXTURE_EDITED_DRAFT_ID,
  FIXTURE_PUBLISHED_DRAFT_ID,
} from "@/app/(account)/app/draft/[draftId]/fixture";

const LABEL = "the label renderGenerated returned";

function factsFor(id: string) {
  const f = FIXTURE_DRAFTS[id];
  if (f === undefined) throw new Error(`no fixture draft ${id}`);
  return f;
}

const VIEW = assembleDraft(factsFor(FIXTURE_DRAFT_ID));
/** The reserved account's first never-claim entry, read off the view rather
 *  than typed here: the phrase the editor underlines has to be the phrase
 *  the customer recorded, and a copy of it in this file would let the two
 *  drift. */
const DO_NOT_CLAIM_ENTRY = (() => {
  const entry = VIEW.ruleFacts.doNotClaim[0];
  if (entry === undefined) throw new Error("the fixture records no never-claim entry");
  return entry;
})();
const EDITED_VIEW = assembleDraft(factsFor(FIXTURE_EDITED_DRAFT_ID));

function markup(view = VIEW): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <DraftScreen view={view} generatedLabel={LABEL} />
  );
  return container;
}

function textOf(root: Element, testId: string): string {
  return root.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "";
}

/** Every line of the source Markdown, with the syntax removed and
 *  whitespace collapsed — what a reader should be able to find in the
 *  rendered body if nothing was withheld. */
function readableLines(md: string): string[] {
  return md
    .split("\n")
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^[-*+]\s+/, "")
        .replace(/^>\s?/, "")
        .replace(/\*\*/g, "")
        .trim()
    )
    .filter((line) => line !== "" && line !== "---");
}

describe("REQ-045 c1 — every word that would publish is rendered, with nothing withheld or summarised", () => {
  it("every line of the body appears in the rendered page", () => {
    const body = textOf(markup(), "draft-body").replace(/\s+/g, " ");
    for (const line of readableLines(VIEW.bodyMd)) {
      expect(body, line).toContain(line.replace(/\s+/g, " "));
    }
  });

  it("no truncation affordance is rendered at all — no ellipsis, no show-more control", () => {
    const root = markup();
    const body = root.querySelector('[data-testid="draft-body"]');
    expect(body?.textContent).not.toContain("…");
    expect(body?.querySelector("button")).toBeNull();
    expect(body?.querySelector("details")).toBeNull();
  });

  it("the body's own structure survives: its headings, list and quote are elements, not flattened text", () => {
    const body = markup().querySelector('[data-testid="draft-body"]');
    // **No shift any more, and that is #931's whole point.** #355 demoted
    // the body's headings a level because the title was the *screen's*
    // `<h1>` and a body heading sat under it in the screen's outline. The
    // title is now the *page's* `<h1>`, inside the page frame, so the
    // source's three `##` are the `<h2>` the hosted page serves, sitting
    // under that `<h1>`: the outline inside the frame is the published
    // page's own outline and no longer a shifted copy of it.
    //
    // **No `<h1>` in the body** (issue #446), because the body carries no
    // `#` of its own: the title is a column beside it and the frame draws
    // it above. The `#` → `h2` rung is exercised where a customer can
    // actually type one — the editor's preview, below.
    expect(body?.querySelectorAll("h1").length).toBe(0);
    expect(body?.querySelectorAll("h2").length).toBe(3);
    expect(body?.querySelectorAll("h3").length).toBe(0);
    // **One list, three items** (issue #446). Three `li` was also what the
    // hard-wrapped fixture rendered — as three lists of one, each followed
    // by the stray half-sentence its continuation line became. The `ul`
    // count is the assertion that says which of the two shapes this is.
    expect(body?.querySelectorAll("ul").length).toBe(1);
    expect(body?.querySelectorAll("ul li").length).toBe(3);
    expect(body?.querySelectorAll("blockquote").length).toBe(1);
  });

  it("the copy-out and the viewer agree, level for level — those are the bytes that publish", () => {
    // They used to disagree on purpose: the copy-out was the publishing
    // bytes and the screen shifted a level for its own outline. #931 ends
    // the difference — the frame shows the published levels — and this row
    // is kept, retargeted, because it is the one that would catch either
    // surface drifting from the other again.
    expect(renderMarkdownHtml(VIEW.bodyMd)).toContain("<h2>");
    expect(markup().querySelector('[data-testid="draft-body"] h2')).not.toBeNull();
    expect(markup().querySelector('[data-testid="draft-body"] h3')).toBeNull();
  });

  it("the generated-content label renders beside the body, and is the one the server resolved", () => {
    expect(textOf(markup(), "draft-generated-label")).toBe(LABEL);
  });
});

describe("REQ-045 c2 and c8 — the grounded fact, marked, with its source line", () => {
  it("the passage is marked within the text", () => {
    const marks = markup().querySelectorAll('[data-testid="draft-body"] mark');
    expect(marks.length).toBe(1);
    expect(marks[0]?.textContent).toBe(VIEW.grounded.passage);
  });

  it("the URL it was read from and the date it was read render beside it, both as values", () => {
    const root = markup();
    const url = root.querySelector('[data-testid="draft-grounded-url"]');
    expect(url?.textContent).toBe(VIEW.grounded.url);
    expect(url?.getAttribute("href")).toBe(VIEW.grounded.url);
    expect(url?.getAttribute("class")).toContain("num");
    const readAt = root.querySelector('[data-testid="draft-grounded-read-at"]');
    expect(readAt?.textContent).toBe("Sep 14, 2026");
    expect(readAt?.getAttribute("class")).toContain("num");
  });

  it("a draft the edit removed the fact from renders no mark, and the fact is stated rather than lost", () => {
    const root = markup(EDITED_VIEW);
    expect(root.querySelectorAll('[data-testid="draft-body"] mark').length).toBe(0);
    expect(textOf(root, "draft-grounded-fact")).toBe(EDITED_VIEW.grounded.passage);
    // The passage was not rewritten to match the edit.
    expect(EDITED_VIEW.grounded.passage).toBe(VIEW.grounded.passage);
  });

  // Issue #268. Generation records the grounding; a draft it recorded none
  // for has no address to print and no day to state, and the screen used
  // to print an empty link beside `Dec 31, 1969` — epoch zero, formatted,
  // read by a customer as the day their page's source was read. #237's
  // rule decides it: no row without a fact.
  describe("a draft with no recorded grounding states no source and no date", () => {
    const UNGROUNDED = assembleDraft({
      ...factsFor(FIXTURE_DRAFT_ID),
      groundedFact: null,
    });

    it("no date is stated, and no epoch date can be", () => {
      const root = markup(UNGROUNDED);
      expect(root.querySelector('[data-testid="draft-grounded-read-at"]')).toBeNull();
      // The assertion that survives a reformat: whatever the date column
      // is set to, 1969 and 1970 are the two years epoch zero lands in.
      expect(root.textContent).not.toMatch(/19(69|70)/);
    });

    it("no empty address is offered in place of the one that was never read", () => {
      expect(markup(UNGROUNDED).querySelector('[data-testid="draft-grounded-url"]')).toBeNull();
    });

    it("and the heading is not drawn over nothing", () => {
      expect(markup(UNGROUNDED).querySelector('[data-testid="draft-grounded"]')).toBeNull();
    });

    it("while a draft that has one still states all of it", () => {
      const root = markup();
      expect(root.querySelector('[data-testid="draft-grounded"]')).not.toBeNull();
      expect(textOf(root, "draft-grounded-read-at")).toBe("Sep 14, 2026");
      expect(textOf(root, "draft-grounded-url")).toBe(VIEW.grounded.url);
    });
  });
});

describe("REQ-045 c3 and c11 — the claim outcome, in every case", () => {
  it("a passed check renders its own badge word", () => {
    expect(textOf(markup(), "draft-claim")).toContain(copy("draft.claim.passed"));
  });

  it("each of the four states renders its own badge, from its own key, and never another state's", () => {
    for (const claim of [
      { state: "passed" as const, at: new Date(0) },
      { state: "failed" as const, matchedEntry: "e", at: new Date(0) },
      { state: "outstanding" as const },
      { state: "nothing_to_check" as const },
    ]) {
      const root = markup({ ...VIEW, claim });
      const badge = root.querySelector(`.badge[data-testid="draft-claim-${claim.state}"]`);
      expect(badge?.textContent, claim.state).toBe(copy(CLAIM_COPY_KEY[claim.state]));
      for (const other of CLAIM_STATES) {
        if (other === claim.state) continue;
        expect(root.querySelector(`[data-testid="draft-claim-${other}"]`), other).toBeNull();
      }
    }
    // The four keys are four keys — a state can never be spoken as another.
    expect(new Set(CLAIM_STATES.map((s) => CLAIM_COPY_KEY[s])).size).toBe(4);
  });

  it("an empty do-not-claim list states that there was nothing to check against, never a pass", () => {
    const root = markup({ ...VIEW, claim: { state: "nothing_to_check" } });
    expect(root.querySelector('[data-testid="draft-claim-nothing_to_check"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="draft-claim-passed"]')).toBeNull();
  });

  it("a failed check names the entry it matched, so the customer is told which one held the draft", () => {
    const root = markup({
      ...VIEW,
      claim: { state: "failed", matchedEntry: "the cheapest on the market", at: new Date(0) },
    });
    expect(textOf(root, "draft-claim-entry")).toBe("the cheapest on the market");
  });

  it("an outstanding check shows no outcome — only that one is running", () => {
    const root = markup(EDITED_VIEW);
    expect(root.querySelector('[data-testid="draft-claim-outstanding"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="draft-claim-passed"]')).toBeNull();
    expect(root.querySelector('[data-testid="draft-claim-failed"]')).toBeNull();
    expect(root.querySelector('[data-testid="draft-claim-entry"]')).toBeNull();
  });
});

describe("REQ-045 c4 — told what happens if nothing is done, and able to approve, edit or veto here", () => {
  it("all three controls render, without leaving the view", () => {
    const root = markup();
    expect(textOf(root, "draft-action-draft.action.approve")).toBe(copy("draft.action.approve"));
    expect(textOf(root, "draft-action-draft.action.edit")).toBe(copy("draft.action.edit"));
    expect(textOf(root, "draft-action-draft.action.veto")).toBe(copy("draft.action.veto"));
    expect(root.querySelectorAll('[data-testid="draft-actions"] button').length).toBe(3);
  });

  // Issue #271, from the account audit: Approve and Veto were both filled
  // accent buttons — two calls to action of equal weight for opposite
  // consequences, one of which destroys the draft — on a screen tokens.md
  // §9.1 gives one solid primary. The classes are the ranks: `btn-primary`
  // is the solid fill, `btn-outline` the outline secondary (carrying the
  // one tone a rank may take), `btn-ghost` the quiet arm.
  it("§9.1 — Approve is the one solid primary, Veto the warn outline, Edit the quiet arm", () => {
    const root = markup();
    const button = (key: string): Element | null =>
      root.querySelector(`button[data-testid="draft-action-${key}"]`);

    const approve = button("draft.action.approve");
    expect(approve?.className).toContain("btn-primary");

    const veto = button("draft.action.veto");
    expect(veto?.className).toContain("btn-outline");
    expect(veto?.className).not.toContain("btn-primary");
    expect(veto?.className).toContain("btn-warning");

    const edit = button("draft.action.edit");
    expect(edit?.className).toContain("btn-ghost");
    expect(edit?.className).not.toContain("btn-primary");

    // One solid fill on the whole screen, not merely in this row.
    expect(root.querySelectorAll(".btn-primary")).toHaveLength(1);
  });

  it("the info box states what happens if you do nothing, with the time under autopilot", () => {
    const box = markup().querySelector('[data-testid="draft-do-nothing"]');
    expect(box?.textContent).toContain(copy("draft.do-nothing.title"));
    expect(textOf(markup(), "draft-do-nothing-at")).toContain("Sep 16, 2026");
  });

  it("under copilot it states no time, because nothing happens", () => {
    // The pair `doNothingOf` answers under copilot: its own key, and no
    // time. The key carries a sentence since #460, so it is read back too.
    const root = markup({
      ...VIEW,
      doNothing: { key: "draft.do-nothing.copilot", publishesAt: null },
    });
    expect(root.querySelector('[data-testid="draft-do-nothing-at"]')).toBeNull();
    expect(textOf(root, "draft-do-nothing")).toContain(copy("draft.do-nothing.title"));
    expect(textOf(root, "draft-do-nothing")).toContain(copy("draft.do-nothing.copilot"));
  });

  it("a page past review offers no control at all, and still renders whole", () => {
    const root = markup({ ...VIEW, state: "published" });
    expect(root.querySelectorAll('[data-testid="draft-actions"] button').length).toBe(0);
    expect(textOf(root, "draft-body")).not.toBe("");
  });
});

describe("BUILD §4.6 — the back link returns to the calendar", () => {
  it("it is a link to /app/calendar and carries the registry's word", () => {
    // The hook is on the `<nav>` and the control inside it is `Btn`'s link
    // arm — S16 draws the back link as a quiet pill, not as a bare anchor.
    const back = markup().querySelector('[data-testid="draft-back"] a');
    expect(back?.getAttribute("href")).toBe("/app/calendar");
    expect(back?.textContent).toBe(copy("draft.back"));
  });
});

describe("REQ-045 c12 — the Markdown and the HTML are always available to copy", () => {
  it("both controls render for a draft awaiting review", () => {
    const root = markup();
    expect(textOf(root, "draft-copy-markdown")).toBe(copy("draft.copy.markdown"));
    expect(textOf(root, "draft-copy-html")).toBe(copy("draft.copy.html"));
  });

  it("and for a published page, on a destination this product does not serve", () => {
    const root = markup({ ...VIEW, state: "published" });
    expect(root.querySelector('[data-testid="draft-copy-out"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-testid="draft-copy-out"] button').length).toBe(2);
  });
});

describe("S16 — the card the approved set draws", () => {
  it("the head carries the stage, the claim outcome and REQ-093 c2's label", () => {
    const root = markup();
    expect(root.querySelector('[data-testid="draft-stage-your_review"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="draft-claim-passed"]')).not.toBeNull();
    expect(textOf(root, "draft-generated-label")).toBe(LABEL);
  });

  it("the provenance line states when the page was written and roughly how long it is", () => {
    const written = textOf(markup(), "draft-written");
    // The two facts, not the sentence: the date is formatted in the site's
    // zone and the count is grouped by the shell's one locale, so what is
    // asserted here is that both reached the line.
    expect(written).toContain("2026");
    expect(written).toContain(String(VIEW.bodyMd.trim().split(/\s+/).length));
  });

  it("a view with no written date states the length alone, never a stand-in date", () => {
    const written = textOf(markup({ ...VIEW, writtenAt: null }), "draft-written");
    expect(written).not.toContain("2026");
    expect(written).toContain("words");
  });

  it("the source line sits inside the page's own article, where the hosted page serves it", () => {
    // #355 placed it under the paragraph carrying the mark, on a screen
    // with no page frame. The frame (#931) is the reader's article, and the
    // hosted route puts its source line at the foot of that article — so
    // the reviewer reads the citation a visitor reads, in the place a
    // visitor reads it. It is still *inside the document*, which is the
    // half of #355 that was about not floating it off to the screen's foot.
    const root = markup();
    const article = root.querySelector('[data-testid="published-view-article"]');
    expect(article?.querySelector('[data-testid="draft-grounded"]')).not.toBeNull();
    // After the body, not before it.
    const body = article?.querySelector('[data-testid="draft-body"]');
    const line = article?.querySelector('[data-testid="draft-grounded"]');
    expect(
      body !== undefined &&
        body !== null &&
        line !== undefined &&
        line !== null &&
        body.compareDocumentPosition(line) === Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(true);
    expect(textOf(root, "draft-grounded-url")).toBe(VIEW.grounded.url);
    // And the dropped-fact block is not drawn beside it: the fact is in the
    // body, marked.
    expect(root.querySelector('[data-testid="draft-grounded-dropped"]')).toBeNull();
  });

  it("the copy-out card names itself and says whose the words are", () => {
    const root = markup();
    const card = root.querySelector('[data-testid="draft-copy-card"]');
    expect(card?.textContent).toContain(copy("draft.copy.title"));
    expect(card?.textContent).toContain(copy("draft.copy.note"));
  });
});

describe("the Decide bar — one DOM, pinned only below `md`", () => {
  // The owner's review of #931: on a phone the rail was the last thing under
  // a ~5,300px page, so a reviewer could not act without scrolling past all
  // of it. The controls are now fixed to the foot of the viewport below
  // `md`. **The geometry is proved in a real browser** — Approve's box inside
  // the viewport at the top of the page and at its foot, the bar above the
  // shell's dock, the last card clear of it — and the numbers are in the PR
  // body, because jsdom computes no layout (`checks.ts`'s own header says
  // why). What is proved *here* is the thing a browser cannot tell us: that
  // there is only one of everything.

  it("there is one set of controls, not a phone copy beside a desktop one", () => {
    const root = markup();
    const controls = root.querySelectorAll('[data-testid^="draft-action-"]');
    // The in-review fixture offers all three (§9's table, through
    // `draftActionsFor`), and each appears exactly once.
    expect(controls.length).toBe(3);
    for (const key of ["draft.action.approve", "draft.action.edit", "draft.action.veto"]) {
      expect(
        root.querySelectorAll(`[data-testid="draft-action-${key}"]`).length,
        `${key} must exist exactly once in the document`
      ).toBe(1);
    }
    // And one do-nothing line, in the same place as the controls: the
    // sentence takes the row above them through `order`, not by being
    // written a second time.
    expect(root.querySelectorAll('[data-testid="draft-do-nothing"]').length).toBe(1);
    const bar = root.querySelector('[data-testid="draft-decide-bar"]');
    expect(bar).not.toBeNull();
    expect(bar?.querySelector('[data-testid="draft-actions"]')).not.toBeNull();
    expect(bar?.querySelector('[data-testid="draft-do-nothing"]')).not.toBeNull();
  });

  it("the checks are not in the bar: they stay below the page", () => {
    // The owner's words. A four-row list pinned over the page would cover
    // the page it is about, and a reviewer reads the checks once, before
    // deciding.
    const root = markup();
    const bar = root.querySelector('[data-testid="draft-decide-bar"]');
    expect(bar?.querySelector('[data-testid="draft-checks"]')).toBeNull();
    expect(
      root.querySelector('[data-testid="draft-decide"] [data-testid="draft-checks"]')
    ).not.toBeNull();
  });

  it("nothing is pinned from `md` up, and the page reserves room where something is", () => {
    // The two halves of "below md" as the markup states them: every pinning
    // class is prefixed, so from `md` up the rail is exactly the card it was
    // — and the page's own bottom padding is prefixed the same way, so it
    // exists only where the bar does.
    const root = markup();
    const bar = root.querySelector('[data-testid="draft-decide-bar"]');
    const barClasses = (bar?.getAttribute("class") ?? "").split(/\s+/);
    expect(barClasses).toContain("max-md:fixed");
    expect(barClasses, "an unprefixed `fixed` would pin the rail at every width").not.toContain(
      "fixed"
    );
    const view = root.querySelector('[data-testid="draft-view"]');
    expect((view?.getAttribute("class") ?? "").split(/\s+/)).toContain("max-md:pb-20");
  });
});

describe("a published page on an autopilot site renders at all", () => {
  // The screen used to throw for this view, in `DecidePanel`, before it
  // drew a single element: an autopilot page with no veto window left named
  // a copy key whose sentence takes a `{at}` slot. Rendering is the
  // assertion — `markup` throws if it does not.
  const PUBLISHED = assembleDraft(factsFor(FIXTURE_PUBLISHED_DRAFT_ID));

  it("draws the page, and no `what happens if you do nothing` box, because nothing does", () => {
    const root = markup(PUBLISHED);
    expect(root.querySelector('[data-testid="draft-body"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="draft-do-nothing"]')).toBeNull();
  });
});

describe("S16 — the Decide rail", () => {
  it("it is the registered panel, labelled, with the three controls and the checks", () => {
    const root = markup();
    const rail = root.querySelector('[data-testid="draft-decide"]');
    expect(rail).not.toBeNull();
    expect(rail?.textContent).toContain(copy("draft.decide.title"));
    expect(rail?.textContent).toContain(copy("draft.checks.title"));
    expect(rail?.querySelectorAll('[data-testid^="draft-action-"]').length).toBe(3);
  });

  it("Approve takes the whole column and the other two share the row under it", () => {
    const root = markup();
    expect(
      root.querySelector('[data-testid="draft-action-draft.action.approve"]')?.className
    ).toContain("col-span-2");
    for (const key of ["draft.action.edit", "draft.action.veto"]) {
      expect(root.querySelector(`[data-testid="draft-action-${key}"]`)?.className).not.toContain(
        "col-span-2"
      );
    }
  });

  it("the four checks are drawn, each as its own sentence", () => {
    const rows = markup().querySelectorAll('[data-testid^="draft-check-"]');
    expect([...rows].map((row) => row.getAttribute("data-testid"))).toEqual([
      "draft-check-grounding",
      "draft-check-do_not_claim",
      "draft-check-near_duplicate",
      "draft-check-no_invented_people",
    ]);
  });

  it("a page past review offers no control block at all, and still lists what was checked", () => {
    const root = markup({ ...VIEW, state: "published" });
    expect(root.querySelector('[data-testid="draft-actions"]')).toBeNull();
    expect(root.querySelectorAll('[data-testid^="draft-check-"]').length).toBe(4);
  });

  it("a draft with no recorded battery lists only the two the view decides itself", () => {
    const root = markup({ ...VIEW, recordedChecks: [] });
    expect(root.querySelectorAll('[data-testid^="draft-check-"]').length).toBe(2);
  });
});

// ── the editor, in a real client root ────────────────────────────────────

describe("REQ-045 c5-c9 — the editor, its live preview, its autosave and its indicator", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    save.mockReset();
    save.mockRejectedValue(new Error("the store is not built"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    // **Drain `@uiw/react-codemirror`'s latch scheduler before the fake
    // clock goes away.** The scheduler is a module-level singleton with one
    // `setInterval`, and it only clears that interval when its last latch
    // leaves the set — which happens on the tick *after* the latch is
    // cancelled. Unmounting cancels the editor's latch but does not tick,
    // so leaving here with the set non-empty strands an interval id from a
    // clock that is about to be thrown away: the singleton then believes it
    // is already running, every later test's `start()` is a no-op, and no
    // latch in this file ever fires again. One tick is the whole fix, and
    // it belongs here rather than in each test that types.
    act(() => vi.advanceTimersByTime(2));
    container.remove();
    vi.useRealTimers();
  });

  function mount(view = VIEW): void {
    act(() => {
      root.render(<DraftScreen view={view} generatedLabel={LABEL} />);
    });
  }

  /**
   * The editor's own `EditorView` (issue 932).
   *
   * The field is CodeMirror 6 now, not a `<textarea>`, so "what the buffer
   * holds" and "the customer typed" are asked of the editor rather than of
   * an element's `value`. `EditorView.findFromDOM` is CodeMirror's own
   * public way back from the DOM to the view, so this reaches for no
   * internal.
   */
  function editorView(): EditorView {
    const el = container.querySelector(".cm-editor");
    const found = el instanceof HTMLElement ? EditorView.findFromDOM(el) : null;
    if (found === null) throw new Error("no editor in the view");
    return found;
  }

  /** What the field holds, as the editor holds it. */
  function bodyText(): string {
    return editorView().state.doc.toString();
  }

  function click(testId: string): void {
    const at = container.querySelector(`[data-testid="${testId}"]`);
    const el = at instanceof HTMLButtonElement ? at : at?.querySelector("button");
    if (!(el instanceof HTMLButtonElement)) throw new Error(`no button at ${testId}`);
    act(() => el.click());
  }

  /** Replace the whole document, the way a paste does. The change goes
   *  through CodeMirror's own transaction, so the update listener
   *  `@uiw/react-codemirror` installs fires and `onChange` runs — the same
   *  path a keystroke takes. */
  function type(text: string): void {
    act(() => {
      const view = editorView();
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    });
  }

  /** The value setter React's own listener reads, for any field. */
  function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set?.call(el, text);
  }

  async function settle(ms: number): Promise<void> {
    await act(async () => {
      vi.advanceTimersByTime(ms);
    });
  }

  it("no editor is on screen until the customer asks for one, and then it holds the Markdown", () => {
    mount();
    expect(container.querySelector('[data-testid="draft-editor"]')).toBeNull();
    click("draft-action-draft.action.edit");
    expect(bodyText()).toBe(VIEW.bodyMd);
  });

  it("typing updates the preview pane client-side, with no round trip", async () => {
    mount();
    click("draft-action-draft.action.edit");
    type("# A new heading\n\nA new sentence.");
    await settle(PREVIEW_DEBOUNCE_MS);
    const preview = container.querySelector('[data-testid="draft-preview-body"]');
    // `# A new heading` renders as an `<h1>` (issue 932). The preview is
    // the **hosted** render now — `parseMarkdown → markPassage → toHtml`
    // with `HOSTED_BODY_CLASSES`, the same three calls
    // `(hosted)/hosted-page` makes — so a body heading keeps the level it
    // will publish at. The read arm still demotes, because there the body
    // sits under the screen's own `<h1>`; here the pane *is* the page.
    expect(preview?.querySelector("h1")?.textContent).toBe("A new heading");
    expect(preview?.textContent).toContain("A new sentence.");
    expect(save).not.toHaveBeenCalled();
  });

  it("there is no save control anywhere in either arm", () => {
    mount();
    // S16: the copy-out's two, then the rail's three — the page column
    // stands before the rail in the document, which is the order the
    // approved set puts them in and the order they are read in. The back
    // link is a link and not a button, so it is not in this list.
    expect([...container.querySelectorAll("button")].map((b) => b.textContent ?? "")).toEqual([
      copy("draft.copy.markdown"),
      copy("draft.copy.html"),
      copy("draft.action.approve"),
      copy("draft.action.edit"),
      copy("draft.action.veto"),
    ]);

    click("draft-action-draft.action.edit");
    // S17 and SPEC §7's editor: back, the three panes' tabs, the seven
    // formatting controls, the desktop/phone switch, and the two controls
    // that leave the editor. **Nothing here saves** — §4.6 says autosaved,
    // and a save button beside an autosave is an invitation to believe the
    // autosave is optional.
    //
    // Listed exactly rather than searched for a word: an exact list is what
    // catches a control somebody adds, which is the only way this assertion
    // earns its place. The formatting bar's buttons carry a glyph and no
    // text, so their accessible name is what is read here (#962 — a glyph
    // alone is not a label).
    const named = (b: HTMLButtonElement): string =>
      b.textContent !== "" ? b.textContent : (b.getAttribute("aria-label") ?? "");
    expect([...container.querySelectorAll("button")].map(named)).toEqual([
      copy("draft.edit.back"),
      copy("draft.editor.tab.markdown"),
      copy("draft.editor.tab.preview"),
      copy("draft.editor.tab.search"),
      copy("draft.editor.format.heading"),
      copy("draft.editor.format.bold"),
      copy("draft.editor.format.italic"),
      copy("draft.editor.format.link"),
      copy("draft.editor.format.list"),
      copy("draft.editor.format.quote"),
      copy("draft.editor.format.table"),
      copy("draft.editor.frame.desktop"),
      copy("draft.editor.frame.phone"),
      copy("draft.edit.done"),
      copy("draft.edit.discard"),
    ]);
  });

  it("a pause of the debounce issues one save, and a burst of typing does not issue one per keystroke", async () => {
    mount();
    click("draft-action-draft.action.edit");
    type("one");
    await settle(AUTOSAVE_DEBOUNCE_MS / 4);
    type("one two");
    await settle(AUTOSAVE_DEBOUNCE_MS / 4);
    type("one two three");
    expect(save).not.toHaveBeenCalled();
    await settle(AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ draftId: VIEW.draftId, title: VIEW.title, bodyMd: "one two three", description: VIEW.description });
  });

  it("blur flushes the pending save immediately, without waiting out the debounce", () => {
    mount();
    click("draft-action-draft.action.edit");
    type("edited on the way out");
    // React maps `onBlur` onto the DOM's `focusout`, which is the event
    // that actually bubbles.
    act(() =>
      editorView().contentDOM.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))
    );
    expect(save).toHaveBeenCalledWith({ draftId: VIEW.draftId, title: VIEW.title, bodyMd: "edited on the way out", description: VIEW.description });
  });

  it("leaving the view flushes the last buffer", () => {
    mount();
    click("draft-action-draft.action.edit");
    type("typed and then navigated away");
    act(() => root.unmount());
    expect(save).toHaveBeenCalledWith({
      draftId: VIEW.draftId,
      title: VIEW.title,
      bodyMd: "typed and then navigated away",
      description: VIEW.description,
    });
    // Re-created so `afterEach`'s unmount has a root to act on.
    root = createRoot(container);
  });

  it("a refused save keeps the buffer, keeps the indicator up, and retries on the next pause", async () => {
    mount();
    click("draft-action-draft.action.edit");
    type("the customer's own words");
    await settle(AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(bodyText()).toBe("the customer's own words");
    // S17 states it on the save line, in the sentence the set writes for a
    // refusal, and the badge beside the title turns.
    expect(container.querySelector('[data-testid="draft-save-line"]')?.textContent).toBe(
      copy("draft.unsaved")
    );
    expect(container.querySelector('[data-testid="draft-edit-state-unsaved"]')).not.toBeNull();
    type("the customer's own words, more of them");
    await settle(AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(2);
    expect(bodyText()).toBe("the customer's own words, more of them");
  });

  it("a save that lands clears the indicator, and the text that came back is the draft", async () => {
    save.mockResolvedValue({
      ok: true,
      savedAt: new Date(0),
      claim: { state: "outstanding" },
      recordedChecks: [],
      rulesFailed: false,
    });
    mount();
    click("draft-action-draft.action.edit");
    type("saved text");
    await settle(AUTOSAVE_DEBOUNCE_MS);
    // Nothing is outstanding: the line states when the store confirmed it,
    // and the read arm behind it carries no unsaved indicator.
    expect(container.querySelector('[data-testid="draft-edit-state-unsaved"]')).toBeNull();
    expect(container.querySelector('[data-testid="draft-save-line"]')?.textContent).toContain(
      "saved"
    );
    click("draft-edit-done");
    expect(container.querySelector('[data-testid="draft-unsaved"]')).toBeNull();
  });

  it("#789 — the title and the meta description are edited and saved with the body", async () => {
    mount();
    click("draft-action-draft.action.edit");
    const title = container.querySelector<HTMLInputElement>('[data-testid="draft-editor-title"]')!;
    const description = container.querySelector<HTMLTextAreaElement>('[data-testid="draft-editor-description"]')!;
    act(() => {
      setNativeValue(title, "A founder's title");
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      setNativeValue(description, "A founder's description.");
      description.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle(AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      draftId: VIEW.draftId,
      title: "A founder's title",
      bodyMd: VIEW.bodyMd,
      description: "A founder's description.",
    });
  });

  it("#789 — a saved edit that breaks a page rule says the page is held, and its words stay", async () => {
    save.mockResolvedValue({
      ok: true,
      savedAt: new Date(0),
      claim: { state: "passed", at: new Date(0) },
      recordedChecks: [],
      rulesFailed: true,
    });
    mount();
    click("draft-action-draft.action.edit");
    type("In our tests it held up.");
    // **Before any save** (issue 932): the live pass runs thirteen of the
    // sixteen rules in this process, so a text that opens with a
    // twenty-four character sentence is already held — §8's
    // `first_block_answers` wants 40 to 320. #789's own sentence says it,
    // because what it says is still exactly true.
    expect(container.querySelector('[data-testid="draft-rules-held"]')?.textContent).toBe(
      copy("draft.edit.rules-held")
    );
    await settle(AUTOSAVE_DEBOUNCE_MS);
    expect(container.querySelector('[data-testid="draft-rules-held"]')?.textContent).toBe(
      copy("draft.edit.rules-held")
    );
    expect(bodyText()).toBe("In our tests it held up.");
    // The badge states the check that ran on the saved text.
    expect(container.querySelector('[data-testid="draft-claim-passed"]')).not.toBeNull();
  });

  it("the claim badge drops the moment the text differs, and no earlier", () => {
    mount();
    expect(container.querySelector('[data-testid="draft-claim-passed"]')).not.toBeNull();
    click("draft-action-draft.action.edit");
    // Opening the editor changes nothing: the text is still the text the
    // check ran against.
    expect(container.querySelector('[data-testid="draft-claim-passed"]')).not.toBeNull();
    type(`${VIEW.bodyMd} and one more sentence.`);
    // S17's own word for the same fact: no outcome is shown, and the badge
    // says a re-check is coming rather than that one is running.
    expect(container.querySelector('[data-testid="draft-edit-state-edited"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="draft-claim-passed"]')).toBeNull();
    // And typing it back restores it — the badge is a function of the text,
    // not a latch.
    type(VIEW.bodyMd);
    expect(container.querySelector('[data-testid="draft-claim-passed"]')).not.toBeNull();
  });

  it("and the read arm carries the outstanding word once an edit stands unsaved", () => {
    mount();
    click("draft-action-draft.action.edit");
    type(`${VIEW.bodyMd} and one more sentence.`);
    click("draft-edit-done");
    expect(container.querySelector('[data-testid="draft-claim-outstanding"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="draft-claim-passed"]')).toBeNull();
    expect(container.querySelector('[data-testid="draft-unsaved"]')?.textContent).toBe(
      copy("draft.unsaved")
    );
  });

  it("Discard changes returns the buffer to the text the store last confirmed", async () => {
    mount();
    click("draft-action-draft.action.edit");
    type("words the customer decided against");
    expect(bodyText()).toBe("words the customer decided against");
    click("draft-edit-discard");
    // `@uiw/react-codemirror` holds a controlled `value` back for 200ms
    // after a change so a re-render cannot fight a fast typist mid-word
    // (`timeoutLatch.ts`), then applies it. Under fake timers that pause
    // has to be advanced; in a browser the founder's click lands after it.
    await settle(CODEMIRROR_TYPING_LATCH_MS * 2);
    expect(bodyText()).toBe(VIEW.bodyMd);
    expect(container.querySelector('[data-testid="draft-claim-passed"]')).not.toBeNull();
  });

  it("the highlight survives an edit that spared the fact and is gone once the fact is removed", async () => {
    mount();
    click("draft-action-draft.action.edit");
    type(`${VIEW.bodyMd}\n\nA sentence the customer added.`);
    await settle(PREVIEW_DEBOUNCE_MS);
    // The preview marks it while nothing is holding the page: one `mark`
    // slot, so the break takes it wherever there is one (issue 932, below).
    expect(
      container.querySelectorAll('[data-testid="draft-preview-body"] mark').length
    ).toBe(1);
    type(VIEW.bodyMd.replace(VIEW.grounded.passage, "A claim of the customer's own."));
    await settle(PREVIEW_DEBOUNCE_MS);
    expect(
      container.querySelectorAll('[data-testid="draft-preview-body"] mark').length
    ).toBe(0);
    // And the fact itself is stated rather than lost — on the read arm,
    // which is where a page's own account of itself is drawn.
    click("draft-edit-done");
    expect(
      container.querySelector('[data-testid="draft-grounded-fact"]')?.textContent
    ).toBe(VIEW.grounded.passage);
    expect(container.querySelectorAll('[data-testid="draft-body"] mark').length).toBe(0);
  });

  it("a break takes the preview's one mark, and the grounded fact keeps the read arm's", async () => {
    // SPEC §7 (2026-09-20): "A sentence that breaks a hard rule or matches
    // the never-claim list is marked where it stands as it is typed."
    //
    // `HtmlClasses` has one `mark` slot and the serialiser decides what
    // publishes, so a second mark kind is not this issue's to add. While a
    // page is held, the run the founder is here to find is the one holding
    // it — so the break takes the slot in the preview, and REQ-045 c8's
    // highlight keeps the read arm, which is where that criterion puts it.
    mount();
    click("draft-action-draft.action.edit");
    // A body whose opening block is far too short for §8's answer-first
    // rule, with the recorded fact still in it further down.
    type(`Short.\n\n${VIEW.grounded.passage}`);
    await settle(PREVIEW_DEBOUNCE_MS);
    const marks = [
      ...container.querySelectorAll('[data-testid="draft-preview-body"] mark'),
    ];
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe("Short.");
    // The page says so in one sentence, and the founder's words are there.
    expect(container.querySelector('[data-testid="draft-rules-held"]')).not.toBeNull();
    // The read arm still marks the fact, unchanged.
    click("draft-edit-done");
    const read = [...container.querySelectorAll('[data-testid="draft-body"] mark')];
    expect(read).toHaveLength(1);
    expect(read[0]?.textContent).toBe(VIEW.grounded.passage);
  });

  it("SPEC §7 — three panes on a phone, and the two frames the live page is drawn in", () => {
    // "On a phone: Text / Preview tabs" plus the search result, which §7
    // names in the same sentence as the description. One DOM: the tab bar
    // chooses which pane is visible, and from `lg` up it is not drawn at
    // all — which is a class, not a second tree, so every pane is in the
    // document at every width.
    mount();
    click("draft-action-draft.action.edit");
    for (const pane of ["markdown", "preview", "search"] as const) {
      expect(container.querySelector(`[data-testid="draft-editor-tab-${pane}"]`)).not.toBeNull();
      expect(container.querySelector(`[data-testid="draft-editor-${pane}"]`)).not.toBeNull();
    }
    // The desktop/phone switch, and the frame it draws.
    expect(container.querySelector('[data-testid="draft-preview-frame-desktop"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="draft-preview-frame-phone"]')).toBeNull();
    click("draft-editor-frame-phone");
    expect(container.querySelector('[data-testid="draft-preview-frame-phone"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="draft-preview-frame-desktop"]')).toBeNull();
    // The page inside is the same page either way: one serialiser, one call.
    expect(
      container.querySelector('[data-testid="draft-preview-body"]')?.textContent
    ).toContain("Most comparison pages rank tools by feature count.");
  });

  it("SPEC §7 — the search result moves with the buffer, and the description carries a count", () => {
    mount();
    click("draft-action-draft.action.edit");
    expect(container.querySelector('[data-testid="draft-search-title"]')?.textContent).toBe(
      VIEW.title
    );
    expect(container.querySelector('[data-testid="draft-description-count"]')?.textContent).toBe(
      copy("draft.editor.description-count", { n: String(VIEW.description.length) })
    );

    const field = container.querySelector('[data-testid="draft-editor-description"]');
    if (!(field instanceof HTMLTextAreaElement)) throw new Error("no description field");
    act(() => {
      setNativeValue(field, "Nine char");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    // A count, and never a verdict: nothing in §8 bounds a description, so
    // the number moves and nothing turns red.
    expect(container.querySelector('[data-testid="draft-description-count"]')?.textContent).toBe(
      copy("draft.editor.description-count", { n: "9" })
    );
    expect(
      container.querySelector('[data-testid="draft-search-description"]')?.textContent
    ).toBe("Nine char");
  });

  it("the done-when — a never-claim phrase holds the page as it is typed, and removing it releases it", async () => {
    // SPEC §7's done-when, end to end on the screen: "Typing a never-claim
    // phrase underlines it within a second and holds the page; removing it
    // releases it." Within a second is the preview's own pause, 100ms.
    mount();
    click("draft-action-draft.action.edit");
    // Nothing is broken to begin with, and the page says so.
    await settle(PREVIEW_DEBOUNCE_MS);
    expect(container.querySelector('[data-testid="draft-rules-ok"]')?.textContent).toBe(
      copy("draft.editor.rules-ok")
    );

    type(`${VIEW.bodyMd}\n\nWe are ${DO_NOT_CLAIM_ENTRY} for a team of five.`);
    await settle(PREVIEW_DEBOUNCE_MS);
    expect(container.querySelector('[data-testid="draft-rules-ok"]')).toBeNull();
    expect(container.querySelector('[data-testid="draft-rules-held"]')?.textContent).toBe(
      copy("draft.edit.rules-held")
    );
    // Marked where it stands: the sentence carrying the phrase, and not the
    // paragraph around it.
    expect(
      container.querySelector('[data-testid="draft-preview-body"] mark')?.textContent
    ).toBe(`We are ${DO_NOT_CLAIM_ENTRY} for a team of five.`);
    // **No save has run.** The underline is this process's answer, from the
    // same comparison `claimCheck` makes before it spends anything.
    expect(save).not.toHaveBeenCalled();

    type(VIEW.bodyMd);
    await settle(PREVIEW_DEBOUNCE_MS);
    expect(container.querySelector('[data-testid="draft-rules-held"]')).toBeNull();
    expect(container.querySelector('[data-testid="draft-rules-ok"]')).not.toBeNull();
  });

  it("S17 — the back link, the footnote and the two controls the set draws", () => {
    mount();
    click("draft-action-draft.action.edit");
    expect(
      container.querySelector('[data-testid="draft-edit-back"] button')?.textContent
    ).toBe(copy("draft.edit.back"));
    expect(container.querySelector('[data-testid="draft-edit-footnote"]')?.textContent).toBe(
      copy("draft.edit.footnote")
    );
    // And it goes back: the read arm is what "Back to the draft" returns to.
    click("draft-edit-back");
    expect(container.querySelector('[data-testid="draft-editor"]')).toBeNull();
    expect(container.querySelector('[data-testid="draft-decide"]')).not.toBeNull();
  });

  it("S17 — the save line states saving while a save is on its way, and the time once one landed", async () => {
    save.mockResolvedValue({
      ok: true,
      savedAt: new Date(Date.UTC(2026, 8, 15, 17, 6, 0)),
      claim: { state: "outstanding" },
      recordedChecks: [],
      rulesFailed: false,
    });
    mount();
    click("draft-action-draft.action.edit");
    type("a sentence in flight");
    expect(container.querySelector('[data-testid="draft-save-line"]')?.textContent).toBe(
      copy("draft.edit.saving")
    );
    expect(container.querySelector('[data-testid="draft-edit-state-edited"]')).not.toBeNull();
    await settle(AUTOSAVE_DEBOUNCE_MS);
    const line = container.querySelector('[data-testid="draft-save-line"]')?.textContent ?? "";
    expect(line).toContain("saved");
    expect(line).not.toBe(copy("draft.edit.saving"));
  });

  it("S17 — a keystroke after a refusal clears the refusal, because a new save is coming", async () => {
    mount();
    click("draft-action-draft.action.edit");
    type("refused once");
    await settle(AUTOSAVE_DEBOUNCE_MS);
    expect(container.querySelector('[data-testid="draft-edit-state-unsaved"]')).not.toBeNull();
    type("refused once, and typed again");
    expect(container.querySelector('[data-testid="draft-edit-state-unsaved"]')).toBeNull();
    expect(container.querySelector('[data-testid="draft-edit-state-edited"]')).not.toBeNull();
  });

  it("switching panes is not a save boundary: it changes what is visible and nothing else", async () => {
    mount();
    click("draft-action-draft.action.edit");
    type("halfway through a sentence");
    const tabs = container.querySelectorAll('[data-testid="draft-editor-tabs"] button');
    act(() => (tabs[1] as HTMLButtonElement).click());
    expect(save).not.toHaveBeenCalled();
    act(() => (tabs[0] as HTMLButtonElement).click());
    expect(bodyText()).toBe("halfway through a sentence");
    await settle(AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
