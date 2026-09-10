/** @vitest-environment jsdom */
// tests/app/draft/view.test.tsx — BUILD §4.6, REQ-045 criteria 1-9, 11, 12
//
// The screen itself. Two halves, because two different things are being
// asserted: what the view *says* on arrival (rendered statically, the way
// `tests/app/calendar/day-panel.test.tsx` renders), and what it *does* when
// the customer edits (rendered into a real client root, so state, the two
// debounces and the autosave actually run).
//
// The save seam is mocked here and only here: `tests/app/draft/actions.test.ts`
// holds the unmocked stub against its own promise. What this file needs is a
// seam it can watch and steer — a save that is refused (today's behaviour,
// and a real outage's) and a save that lands.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const save = vi.fn();

vi.mock("@/app/(account)/app/draft/[draftId]/save", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(account)/app/draft/[draftId]/save")>();
  return { ...actual, draftStore: { save: (...args: unknown[]) => save(...args) } };
});

import { AUTOSAVE_DEBOUNCE_MS, PREVIEW_DEBOUNCE_MS } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { renderMarkdownHtml } from "@/lib/publish/render/markdown";
import { DraftScreen } from "@/app/(account)/app/draft/[draftId]/DraftScreen";
import { assembleDraft } from "@/app/(account)/app/draft/[draftId]/model";
import { CLAIM_COPY_KEY, CLAIM_STATES } from "@/app/(account)/app/draft/[draftId]/claim";
import {
  FIXTURE_DRAFTS,
  FIXTURE_DRAFT_ID,
  FIXTURE_EDITED_DRAFT_ID,
} from "@/app/(account)/app/draft/[draftId]/fixture";

const LABEL = "the label renderGenerated returned";

function factsFor(id: string) {
  const f = FIXTURE_DRAFTS[id];
  if (f === undefined) throw new Error(`no fixture draft ${id}`);
  return f;
}

const VIEW = assembleDraft(factsFor(FIXTURE_DRAFT_ID));
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
    // One level down, since #355: the page's title is the screen's `<h1>`
    // and a body's heading is a heading *within* the page, so the source's
    // three `##` are `<h3>` here. Nothing is flattened and nothing is lost
    // — `present.ts` says why the shift is on the level rather than on the
    // size.
    //
    // **No `<h1>` and no `<h2>`, and both for the same reason** (issue
    // #446): the body carries no `#` of its own, because the title is a
    // column beside it and the screen already draws it above. The `#`
    // → `h2` rung is exercised where a customer can actually type one —
    // the editor's preview, below.
    expect(body?.querySelectorAll("h1").length).toBe(0);
    expect(body?.querySelectorAll("h2").length).toBe(0);
    expect(body?.querySelectorAll("h3").length).toBe(3);
    // **One list, three items** (issue #446). Three `li` was also what the
    // hard-wrapped fixture rendered — as three lists of one, each followed
    // by the stray half-sentence its continuation line became. The `ul`
    // count is the assertion that says which of the two shapes this is.
    expect(body?.querySelectorAll("ul").length).toBe(1);
    expect(body?.querySelectorAll("ul li").length).toBe(3);
    expect(body?.querySelectorAll("blockquote").length).toBe(1);
  });

  it("and the copy-out is not demoted — those are the bytes that publish", () => {
    // The screen's own shift is the screen's. `renderMarkdownHtml` takes
    // the body with no map and no shift, so the body's `##` is an `<h2>` in
    // the bytes a customer copies out while the same heading is an `<h3>`
    // on the screen above them: on the destination no heading of ours
    // stands over the page.
    expect(renderMarkdownHtml(VIEW.bodyMd)).toContain("<h2>");
    expect(markup().querySelector('[data-testid="draft-body"] h2')).toBeNull();
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
      const badge = root.querySelector(`[data-testid="draft-claim-${claim.state}"] .badge`);
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
  // is the solid fill, `rk-btn-outline` the outline secondary (carrying the
  // one tone a rank may take), `rk-btn-tertiary` the quiet arm.
  it("§9.1 — Approve is the one solid primary, Veto the warn outline, Edit the quiet arm", () => {
    const root = markup();
    const button = (key: string): Element | null =>
      root.querySelector(`[data-testid="draft-action-${key}"] button`);

    const approve = button("draft.action.approve");
    expect(approve?.className).toContain("btn-primary");

    const veto = button("draft.action.veto");
    expect(veto?.className).toContain("rk-btn-outline");
    expect(veto?.className).not.toContain("btn-primary");
    expect(veto?.getAttribute("data-tone")).toBe("warn");

    const edit = button("draft.action.edit");
    expect(edit?.className).toContain("rk-btn-tertiary");
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

describe("UI-SPEC S16 — the card the approved set draws", () => {
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

  it("the source line sits inside the document, under the paragraph that carries the mark", () => {
    const root = markup();
    const body = root.querySelector('[data-testid="draft-body"]');
    expect(body?.querySelector('[data-testid="draft-grounded"]')).not.toBeNull();
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

describe("UI-SPEC S16 — the Decide rail", () => {
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
    ).toContain("rk-daypanel-block");
    for (const key of ["draft.action.edit", "draft.action.veto"]) {
      expect(root.querySelector(`[data-testid="draft-action-${key}"]`)?.className).toContain(
        "rk-daypanel-half"
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
    container.remove();
    vi.useRealTimers();
  });

  function mount(view = VIEW): void {
    act(() => {
      root.render(<DraftScreen view={view} generatedLabel={LABEL} />);
    });
  }

  function textarea(): HTMLTextAreaElement {
    const el = container.querySelector('[data-testid="draft-editor-textarea"]');
    if (!(el instanceof HTMLTextAreaElement)) throw new Error("no textarea in the view");
    return el;
  }

  function click(testId: string): void {
    const el = container.querySelector(`[data-testid="${testId}"] button`);
    if (!(el instanceof HTMLButtonElement)) throw new Error(`no button at ${testId}`);
    act(() => el.click());
  }

  function type(text: string): void {
    const el = textarea();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      setter?.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
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
    expect(textarea().value).toBe(VIEW.bodyMd);
  });

  it("typing updates the preview pane client-side, with no round trip", async () => {
    mount();
    click("draft-action-draft.action.edit");
    type("# A new heading\n\nA new sentence.");
    await settle(PREVIEW_DEBOUNCE_MS);
    const preview = container.querySelector('[data-testid="draft-preview-body"]');
    // `# A new heading` renders as an `<h2>`: the preview is the same
    // renderer the read view uses, demotion included, which is what makes
    // it a preview rather than a second opinion.
    expect(preview?.querySelector("h2")?.textContent).toBe("A new heading");
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
    // S17: back, the two panes' tabs, and the two controls that leave the
    // editor. Nothing here saves — §4.6 says autosaved, and a save button
    // beside an autosave is an invitation to believe the autosave is
    // optional.
    expect([...container.querySelectorAll("button")].map((b) => b.textContent ?? "")).toEqual([
      copy("draft.edit.back"),
      copy("draft.editor.tab.markdown"),
      copy("draft.editor.tab.preview"),
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
    expect(save).toHaveBeenCalledWith({ draftId: VIEW.draftId, bodyMd: "one two three" });
  });

  it("blur flushes the pending save immediately, without waiting out the debounce", () => {
    mount();
    click("draft-action-draft.action.edit");
    type("edited on the way out");
    // React maps `onBlur` onto the DOM's `focusout`, which is the event
    // that actually bubbles.
    act(() => textarea().dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
    expect(save).toHaveBeenCalledWith({ draftId: VIEW.draftId, bodyMd: "edited on the way out" });
  });

  it("leaving the view flushes the last buffer", () => {
    mount();
    click("draft-action-draft.action.edit");
    type("typed and then navigated away");
    act(() => root.unmount());
    expect(save).toHaveBeenCalledWith({
      draftId: VIEW.draftId,
      bodyMd: "typed and then navigated away",
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
    expect(textarea().value).toBe("the customer's own words");
    // S17 states it on the save line, in the sentence the set writes for a
    // refusal, and the badge beside the title turns.
    expect(container.querySelector('[data-testid="draft-save-line"]')?.textContent).toBe(
      copy("draft.unsaved")
    );
    expect(container.querySelector('[data-testid="draft-edit-state-unsaved"]')).not.toBeNull();
    type("the customer's own words, more of them");
    await settle(AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(2);
    expect(textarea().value).toBe("the customer's own words, more of them");
  });

  it("a save that lands clears the indicator, and the text that came back is the draft", async () => {
    save.mockResolvedValue({
      ok: true,
      savedAt: new Date(0),
      grounded: { present: false },
      claim: { state: "outstanding" },
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

  it("Discard changes returns the buffer to the text the store last confirmed", () => {
    mount();
    click("draft-action-draft.action.edit");
    type("words the customer decided against");
    expect(textarea().value).toBe("words the customer decided against");
    click("draft-edit-discard");
    expect(textarea().value).toBe(VIEW.bodyMd);
    expect(container.querySelector('[data-testid="draft-claim-passed"]')).not.toBeNull();
  });

  it("the highlight survives an edit that spared the fact and is gone once the fact is removed", async () => {
    mount();
    click("draft-action-draft.action.edit");
    type(`${VIEW.bodyMd}\n\nA sentence the customer added.`);
    await settle(PREVIEW_DEBOUNCE_MS);
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
      grounded: { present: true },
      claim: { state: "outstanding" },
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
    expect(textarea().value).toBe("halfway through a sentence");
    await settle(AUTOSAVE_DEBOUNCE_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
