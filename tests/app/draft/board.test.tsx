/** @vitest-environment jsdom */
// tests/app/draft/board.test.tsx — board `AppDraft` (canvas V22), issue 1748
//
// The draft screen before it goes live, against its board, by the same
// reading the `no overflow · axe` gate makes (`scripts/design/parity.mjs`):
// every string the board draws is on the screen, or is an allow line with
// its citation. The edit arm sits behind *Edit this page*, which the route's
// own reading never presses, so this file presses it and reads both arms.
import "../../generate/env";
import React, { act } from "react";
import { readFileSync } from "node:fs";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";
import { copy } from "@/lib/presentation/copy";
import { DraftScreen } from "@/app/(account)/app/draft/[draftId]/DraftScreen";
import { assembleDraft } from "@/app/(account)/app/draft/[draftId]/model";
import { FIXTURE_DRAFTS, FIXTURE_DRAFT_ID } from "@/app/(account)/app/draft/[draftId]/fixture";

const VIEW = assembleDraft(FIXTURE_DRAFTS[FIXTURE_DRAFT_ID]!);
const BOARD = readFileSync(boardFile("AppDraft"), "utf8");

/** What the app shell draws around every `/app` screen: the route-level
 *  reading in `tests/ui/layout/parity.test.ts` holds these. */
const SHELL = ["ReachKit", "Overview", "Plan", "Settings", "Publishing on", "Theme: light"];

function readArm(): string {
  return renderToStaticMarkup(<DraftScreen view={VIEW} generatedLabel="Written by ReachKit" />);
}

async function editArm(): Promise<string> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<DraftScreen view={VIEW} generatedLabel="Written by ReachKit" />));
  const edit = host.querySelector<HTMLButtonElement>('[data-testid="draft-action-draft.action.edit"]');
  await act(async () => edit?.click());
  const html = host.innerHTML;
  await act(async () => root.unmount());
  host.remove();
  return html;
}

function at(root: Element, testId: string): Element {
  const found = root.querySelector(`[data-testid="${testId}"]`);
  if (found === null) throw new Error(`no ${testId}`);
  return found;
}

const before = (a: Element, b: Element): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("board AppDraft: every string it draws is on the screen", () => {
  it("leaves nothing missing but the shell's own, with the edit arm read off the screen", async () => {
    const texts = [...segments(readArm()), ...segments(await editArm())];
    const { missing } = compare(BOARD, texts, readAllow("AppDraft"));

    expect(missing.filter((s) => !SHELL.includes(s))).toEqual([]);
  });

  it("each allow line names a string the board draws, so none excuses nothing", () => {
    const { allowed } = compare(BOARD, [], readAllow("AppDraft"));
    expect(allowed.length).toBe(readAllow("AppDraft").length);
  });
});

describe("board AppDraft: the read arm, in the board's order", () => {
  const host = document.createElement("div");
  host.innerHTML = readArm();

  it("back to Plan, the title, then the badges and when it was written", () => {
    const back = at(host, "draft-back");
    expect(back.textContent).toBe(copy("draft.back"));
    const title = at(host, "draft-title");
    expect(before(back, title)).toBe(true);
    expect(before(title, at(host, "draft-claim"))).toBe(true);
    expect(at(host, "draft-kind").textContent).toBe(copy("calendar.card.new-page"));
    expect(at(host, "draft-written").textContent).toMatch(/· about \d[\d,]* words$/);
  });

  it("why this page, then the preview with its caption", () => {
    const why = at(host, "draft-why");
    expect(why.querySelector("h2")?.textContent).toBe(copy("draft.why.title"));
    const caption = at(host, "published-view-lead");
    expect(caption.textContent).toBe(copy("draft.preview.caption", { at: "Sep 16, 2026, 10:00 AM EDT" }));
    expect(before(why, caption)).toBe(true);
  });

  it("the checks name their first five, the rest one level down, and how we decided", () => {
    const checks = at(host, "draft-checks");
    const shown = checks.querySelectorAll(':scope details > div [data-testid^="draft-check-"]');
    expect(shown.length - at(checks, "draft-checks-more").querySelectorAll('[data-testid^="draft-check-"]').length).toBe(5);
    expect(at(checks, "draft-checks-more").querySelector("summary")?.textContent).toBe(
      copy("draft.checks.more", { n: String(shown.length - 5) })
    );
    expect(checks.textContent).toContain(copy("draft.checks.all-passed"));
    expect(checks.textContent).toContain(copy("draft.checks.decided"));
  });

  it("the search result carries its caption", () => {
    expect(at(host, "draft-search-result").textContent).toContain(copy("draft.search-result.caption"));
  });

  it("the rail: this page, when it goes live, Edit this page, Stop this page and what Stop does", () => {
    const rail = at(host, "draft-decide");
    const edit = at(rail, "draft-action-draft.action.edit");
    const stop = at(rail, "draft-action-draft.action.veto");
    const note = at(rail, "draft-stop-note");
    expect(edit.textContent).toBe("Edit this page");
    expect(before(at(rail, "draft-goes-live"), edit)).toBe(true);
    expect(before(edit, stop) && before(stop, note) && before(note, at(rail, "draft-day"))).toBe(true);
  });
});

describe("board AppDraft: the edit arm", () => {
  it("back to the page, the description in search results with its count, and the three panes", async () => {
    const host = document.createElement("div");
    host.innerHTML = await editArm();
    expect(at(host, "draft-edit-back").textContent).toBe(copy("draft.edit.back"));
    expect(host.querySelector('label[for="draft-edit-description"]')?.textContent).toContain(
      copy("draft.edit.description-label")
    );
    expect(at(host, "draft-description-count").textContent).toBe(
      copy("draft.editor.description-count", { n: String(VIEW.description.length) })
    );
    expect([...at(host, "draft-editor-tabs").querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)).toEqual([
      copy("draft.editor.tab.markdown"),
      copy("draft.editor.tab.preview"),
      copy("draft.editor.tab.search"),
    ]);
  });
});
