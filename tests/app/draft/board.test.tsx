/** @vitest-environment jsdom */
// tests/app/draft/board.test.tsx — board `AppDraft` (canvas v36)
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
import { assembleDraft, type DraftView } from "@/app/(account)/app/draft/[draftId]/model";
import { FIXTURE_DRAFTS, FIXTURE_DRAFT_ID } from "@/app/(account)/app/draft/[draftId]/fixture";

const VIEW = assembleDraft(FIXTURE_DRAFTS[FIXTURE_DRAFT_ID]!);
const BOARD = readFileSync(boardFile("AppDraft"), "utf8");

/** What the app shell draws around every `/app` screen: the route-level
 *  reading in `tests/ui/layout/parity.test.ts` holds these. */
const SHELL = ["ReachKit", "Overview", "This week", "Settings", "Publishing on", "Theme: light"];

function readArm(view: DraftView = VIEW): string {
  return renderToStaticMarkup(<DraftScreen view={view} generatedLabel="Written by ReachKit" />);
}

function readHost(view: DraftView = VIEW): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = readArm(view);
  return host;
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
    // A component line is read by the route's component count, not by this string reading.
    expect(allowed.length).toBe(readAllow("AppDraft").filter((a: { string: string }) => !a.string.startsWith("component:")).length);
  });
});

describe("board AppDraft: the read arm, in the board's order", () => {
  const host = document.createElement("div");
  host.innerHTML = readArm();

  it("back to Plan, the title, then the badges and the length, with no write time", () => {
    const back = at(host, "draft-back");
    expect(back.textContent).toBe(copy("draft.back"));
    const title = at(host, "draft-title");
    expect(before(back, title)).toBe(true);
    expect(before(title, at(host, "draft-claim"))).toBe(true);
    expect(at(host, "draft-kind").textContent).toBe(copy("calendar.card.new-page"));
    expect(at(host, "draft-written").textContent).toMatch(/^About \d[\d,]* words$/);
  });

  it("why this page, then the preview with its caption", () => {
    const why = at(host, "draft-why");
    expect(why.querySelector("h2")?.textContent).toBe(copy("draft.why.title"));
    const caption = at(host, "published-view-lead");
    expect(caption.textContent).toBe(copy("draft.preview.caption"));
    expect(before(why, caption)).toBe(true);
  });

  it("the checks name their first five, the rest one level down, and how we decided; the count is the only badge", () => {
    const checks = at(host, "draft-checks");
    const shown = checks.querySelectorAll(':scope details > div [data-testid^="draft-check-"]');
    expect(shown.length - at(checks, "draft-checks-more").querySelectorAll('[data-testid^="draft-check-"]').length).toBe(5);
    expect(at(checks, "draft-checks-more").querySelector("summary")?.textContent).toBe(
      copy("draft.checks.more", { n: String(shown.length - 5) })
    );
    expect(at(checks, "draft-checks-headline").textContent).toMatch(/^Checks: \d+ of \d+ passed$/);
    expect(checks.querySelector("summary .badge")).toBeNull();
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
    expect(at(rail, "draft-goes-live").textContent).toBe(`${copy("draft.decide.goes-live")}Sep 16, 2026, 10:00 AM EDT`);
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

describe("the draft's board icons", () => {
  it("the Ready badge carries the tick", () => {
    expect(at(readHost(), "draft-stage-your_review").querySelector("svg.lucide-circle-check")).not.toBeNull();
  });

  it("a new page's badge carries the plus, an update's the refresh", () => {
    expect(at(readHost(), "draft-kind").querySelector("svg.lucide-plus")).not.toBeNull();
    const update = readHost({ ...VIEW, target: { ...VIEW.target, update: true } } as DraftView);
    expect(at(update, "draft-kind").textContent).toBe(copy("calendar.card.update"));
    expect(at(update, "draft-kind").querySelector("svg.lucide-refresh-cw")).not.toBeNull();
  });

  it("the preview's address bar opens with the lock, in the read arm and the editor", async () => {
    expect(readHost().querySelector(".mockup-browser-toolbar svg.lucide-lock")).not.toBeNull();
    const edit = document.createElement("div");
    edit.innerHTML = await editArm();
    const toolbar = at(edit, "draft-preview-frame-desktop").querySelector(".mockup-browser-toolbar");
    expect(toolbar?.querySelector("svg.lucide-lock")).not.toBeNull();
    expect(toolbar?.textContent).toContain(new URL(VIEW.publisher.url).host);
  });

  it("each closed note is named by its title alone: sentence case, no leading icon (v36)", () => {
    const linked = readHost({ ...VIEW, bodyMd: `${VIEW.bodyMd}\n\nSee [the full study](https://example.org/study).\n` });
    const heads = [...at(linked, "draft-notes").querySelectorAll("summary h2")];
    expect(heads.length).toBeGreaterThanOrEqual(5);
    expect(heads.every((h) => h.querySelector("svg") === null && !h.className.includes("eyebrow"))).toBe(true);
  });

  it("the page's day: done steps filled success, going live filled primary, the first reading an empty ring", () => {
    const day = at(readHost(), "draft-day");
    const dot = (step: string) => at(day, `draft-day-${step}`).querySelector(".timeline-middle")!;
    expect(dot("written").className).toContain("bg-success");
    expect(dot("live").className).toContain("bg-primary");
    expect(dot("reading").className).toContain("border-base-300");
    expect(dot("reading").querySelector("svg")).toBeNull();
  });

  it("the header's Ready is the primary pill, and the AI label and the claim outcome stay (REQ-093 c2, REQ-045 c3)", () => {
    const host = readHost();
    expect(at(host, "draft-stage-your_review").className).toContain("badge-primary");
    expect(at(host, "draft-generated-label").textContent).toBe("Written by ReachKit");
    expect(host.querySelector('[data-testid^="draft-claim-"]')).not.toBeNull();
  });

  it("a page that broke a rule says so behind the warning sign", () => {
    const held = at(readHost({ ...VIEW, rulesFailed: true }), "draft-rules-held");
    expect(held.querySelector("svg.lucide-triangle-alert")).not.toBeNull();
    expect(held.textContent).toBe(copy("draft.edit.rules-held"));
  });
});
