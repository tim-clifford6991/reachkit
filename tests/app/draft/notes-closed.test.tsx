/** @vitest-environment jsdom */
// SPEC §7 (2026-10-07, issue 1325) — the page stays the page, and the notes
// under it start closed.
//
// What a founder meets on the review screen: the article whole and behind
// no tap, the decision before the notes, and each note as one closed line
// under its own name. The waiting state holds the same three regions in the
// same order.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import { DraftScreen } from "@/app/(account)/app/draft/[draftId]/DraftScreen";
import DraftLoading from "@/app/(account)/app/draft/[draftId]/loading";
import { assembleDraft, type DraftView } from "@/app/(account)/app/draft/[draftId]/model";
import {
  FIXTURE_DRAFTS,
  FIXTURE_DRAFT_ID,
} from "@/app/(account)/app/draft/[draftId]/fixture";

function viewOf(id: string): DraftView {
  const facts = FIXTURE_DRAFTS[id];
  if (facts === undefined) throw new Error(`no fixture draft ${id}`);
  return assembleDraft(facts);
}

function dom(tree: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(tree);
  return container;
}

function one(root: Element, testId: string): Element {
  const found = root.querySelector(`[data-testid="${testId}"]`);
  if (found === null) throw new Error(`no ${testId}`);
  return found;
}

/** Whether `a` comes before `b` in the document. */
function precedes(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

// A live page has its own screen (board `PageDetail`, `live.test.tsx`).
describe.each([["a page in review", FIXTURE_DRAFT_ID]])("the review screen, %s", (_name, id) => {
  const screen = dom(<DraftScreen view={viewOf(id)} generatedLabel="label" />);
  const notes = Array.from(one(screen, "draft-notes").children);

  it("every note is one closed line under its own name", () => {
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      const fold = note.querySelector("details");
      expect(fold, note.getAttribute("data-testid") ?? "").not.toBeNull();
      expect(fold?.hasAttribute("open")).toBe(false);
      expect(fold?.querySelector("summary")?.textContent?.trim()).not.toBe("");
      // Nothing of the note stands outside its fold.
      expect(note.textContent).toBe(fold?.textContent);
    }
  });

  it("the article is whole, above the notes, and behind no tap", () => {
    const article = one(screen, "draft-page").querySelector("article");
    expect(article).not.toBeNull();
    expect(article?.closest("details")).toBeNull();
    expect(precedes(one(screen, "draft-page"), one(screen, "draft-notes"))).toBe(true);
  });

  it("the decision comes before the notes", () => {
    expect(precedes(one(screen, "draft-decide"), one(screen, "draft-notes"))).toBe(true);
    expect(one(screen, "draft-notes").contains(one(screen, "draft-decide"))).toBe(false);
  });
});

describe("the review screen, while it waits", () => {
  it("holds the page, the decision and the closed lines, in the screen's order and places", () => {
    const waiting = dom(<DraftLoading />);
    const screen = dom(<DraftScreen view={viewOf(FIXTURE_DRAFT_ID)} generatedLabel="label" />);
    const page = one(waiting, "page-skeleton");
    const decide = one(waiting, "decide-skeleton");
    const lines = one(waiting, "notes-skeleton");
    expect(precedes(page, decide)).toBe(true);
    expect(precedes(decide, lines)).toBe(true);
    // One grid for both, so the panel is beside the page at the same width.
    expect(page.parentElement?.parentElement?.className).toBe(one(screen, "draft-page").parentElement?.className);
    expect(lines.className).toBe(one(screen, "draft-notes").className);
  });
});

describe("the notes, in the board's order", () => {
  it("checks, the search result, written from, what it adds, then its links", () => {
    const base = viewOf(FIXTURE_DRAFT_ID);
    const linked: DraftView = { ...base, bodyMd: `${base.bodyMd}\n\nSee [the full study](https://example.org/study).\n` };
    const screen = dom(<DraftScreen view={linked} generatedLabel="label" />);
    const order = Array.from(one(screen, "draft-notes").children).map((note) => note.getAttribute("data-testid"));
    expect(order.slice(0, 5)).toEqual(["draft-checks", "draft-search-result", "draft-written-from", "draft-adds", "draft-links"]);
  });
});

describe("a note on a page that was set aside", () => {
  it("is open, says what happened, and offers nothing to do (issue 1393)", () => {
    const base = viewOf(FIXTURE_DRAFT_ID);
    const asking: DraftView = { ...base, adds: { claims: [], ask: true } };
    const screen = dom(<DraftScreen view={asking} generatedLabel="label" />);
    expect(one(screen, "draft-adds").querySelector("details")?.hasAttribute("open")).toBe(true);
    expect(one(screen, "draft-adds-ask").textContent).not.toBe("");
    expect(one(screen, "draft-adds").querySelector("a, button")).toBeNull();
  });
});
