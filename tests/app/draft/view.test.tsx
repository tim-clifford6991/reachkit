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
    expect(body?.querySelectorAll("h1").length).toBe(1);
    expect(body?.querySelectorAll("h2").length).toBeGreaterThanOrEqual(3);
    expect(body?.querySelectorAll("ul li").length).toBe(3);
    expect(body?.querySelectorAll("blockquote").length).toBe(1);
  });

  it("the generated-content label renders beside the body, and is the one the server resolved", () => {
    expect(textOf(markup(), "draft-generated-label")).toBe(LABEL);
  });
});

describe("REQ-045 c2 and c8 — the grounded fact, marked, with its source line", () => {
  it("the passage is marked within the text", () => {
    const marks = markup().querySelectorAll('[data-testid="draft-body"] mark');
    expect(marks.length).toBe(1);
    expect(marks[0]?.textContent).toBe(VIEW.grounded.fact);
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
    expect(textOf(root, "draft-grounded-fact")).toBe(EDITED_VIEW.grounded.fact);
    // The fact was not rewritten to match the edit.
    expect(EDITED_VIEW.grounded.fact).toBe(VIEW.grounded.fact);
  });

  // Issue #268. Generation records the grounding; a draft it recorded none
  // for has no address to print and no day to state, and the screen used
  // to print an empty link beside `Dec 31, 1969` — epoch zero, formatted,
  // read by a customer as the day their page's source was read. #237's
  // rule decides it: no row without a fact.
  describe("a draft with no recorded grounding states no source and no date", () => {
    const UNGROUNDED = assembleDraft({
      ...factsFor(FIXTURE_DRAFT_ID),
      groundedFact: { fact: "", url: "", readAt: null },
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
    const root = markup({ ...VIEW, doNothing: { ...VIEW.doNothing, publishesAt: null } });
    expect(root.querySelector('[data-testid="draft-do-nothing-at"]')).toBeNull();
    expect(textOf(root, "draft-do-nothing")).toContain(copy("draft.do-nothing.title"));
  });

  it("a page past review offers no control at all, and still renders whole", () => {
    const root = markup({ ...VIEW, state: "published" });
    expect(root.querySelectorAll('[data-testid="draft-actions"] button').length).toBe(0);
    expect(textOf(root, "draft-body")).not.toBe("");
  });
});

describe("BUILD §4.6 — the back link returns to the calendar", () => {
  it("it is a link to /app/calendar and carries the registry's word", () => {
    const back = markup().querySelector('[data-testid="draft-back"]');
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
    expect(preview?.querySelector("h1")?.textContent).toBe("A new heading");
    expect(preview?.textContent).toContain("A new sentence.");
    expect(save).not.toHaveBeenCalled();
  });

  it("there is no save control anywhere in the view", () => {
    mount();
    click("draft-action-draft.action.edit");
    const labels = [...container.querySelectorAll("button")].map((b) => b.textContent ?? "");
    expect(labels).toEqual([
      copy("draft.action.approve"),
      copy("draft.action.edit"),
      copy("draft.action.veto"),
      copy("draft.editor.tab.markdown"),
      copy("draft.editor.tab.preview"),
      copy("draft.copy.markdown"),
      copy("draft.copy.html"),
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
    expect(container.querySelector('[data-testid="draft-unsaved"]')?.textContent).toBe(
      copy("draft.unsaved")
    );
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
    expect(container.querySelector('[data-testid="draft-unsaved"]')).toBeNull();
    expect(textarea().value).toBe("saved text");
  });

  it("the claim badge drops to outstanding the moment the text differs, and no earlier", () => {
    mount();
    expect(container.querySelector('[data-testid="draft-claim-passed"]')).not.toBeNull();
    click("draft-action-draft.action.edit");
    // Opening the editor changes nothing: the text is still the text the
    // check ran against.
    expect(container.querySelector('[data-testid="draft-claim-passed"]')).not.toBeNull();
    type(`${VIEW.bodyMd} and one more sentence.`);
    expect(container.querySelector('[data-testid="draft-claim-outstanding"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="draft-claim-passed"]')).toBeNull();
    // And typing it back restores it — the badge is a function of the text,
    // not a latch.
    type(VIEW.bodyMd);
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
    type(VIEW.bodyMd.replace(VIEW.grounded.fact, "A claim of the customer's own."));
    await settle(PREVIEW_DEBOUNCE_MS);
    expect(
      container.querySelectorAll('[data-testid="draft-preview-body"] mark').length
    ).toBe(0);
    // And the fact itself is stated rather than lost.
    expect(
      container.querySelector('[data-testid="draft-grounded-fact"]')?.textContent
    ).toBe(VIEW.grounded.fact);
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
