/** @vitest-environment jsdom */
// tests/app/draft/take-down.test.tsx — SPEC §7 (issue 1532): *Take down* on
// a live page, on Plan and on the page's own screen, asked in the page
// itself; *Put back* inside its window.
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const takeDownDraft = vi.fn(async (draftId: string): Promise<string | null> => (draftId === "" ? "not_your_page" : null));
const putBackDraft = vi.fn(async (draftId: string): Promise<string | null> => (draftId === "" ? "not_your_page" : null));
vi.mock("@/app/(account)/app/calendar/publishing-actions", () => ({
  takeDownDraft: (id: string) => takeDownDraft(id),
  putBackDraft: (id: string) => putBackDraft(id),
  skipDraft: async () => null,
  vetoDraft: async () => null,
  regenerateDraft: async () => null,
}));
const say = vi.fn();
vi.mock("@/app/_toast/say", () => ({ say: (...args: unknown[]) => say(...args) }));

import { copy } from "@/lib/presentation/copy";
import { DraftScreen } from "@/app/(account)/app/draft/[draftId]/DraftScreen";
import { assembleDraft } from "@/app/(account)/app/draft/[draftId]/model";
import { FIXTURE_DRAFTS, FIXTURE_PUBLISHED_DRAFT_ID } from "@/app/(account)/app/draft/[draftId]/fixture";
import { PublishedList } from "@/app/(account)/app/calendar/PublishedList";
import { contentOf } from "@/app/(account)/app/_overview/content";
import type { TakeDownStanding } from "@/lib/publish/take-down/standing";

const published = FIXTURE_DRAFTS[FIXTURE_PUBLISHED_DRAFT_ID]!;
const view = (takeDown: TakeDownStanding) => assembleDraft({ ...published, takeDown });

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  takeDownDraft.mockClear();
  putBackDraft.mockClear();
  say.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function click(testId: string): void {
  const button = container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  if (button === null) throw new Error(`no ${testId}`);
  act(() => button.click());
}

describe("the page's own screen", () => {
  it("a live page offers Take down, which asks in the page before anything is written", async () => {
    const confirm = vi.spyOn(window, "confirm");
    act(() => root.render(<DraftScreen view={view({ kind: "take_down" })} generatedLabel="label" />));
    expect(container.querySelector('[data-testid="take-down"]')?.textContent).toBe(copy("draft.action.take-down"));

    click("take-down");
    expect(container.querySelector('[data-testid="take-down-ask"]')?.textContent).toContain(
      copy("draft.take-down.question", { days: "7" })
    );
    expect(takeDownDraft).not.toHaveBeenCalled();

    click("take-down-confirm");
    await act(async () => {});
    expect(takeDownDraft).toHaveBeenCalledWith(published.draftId);
    expect(say).toHaveBeenCalledWith(copy("draft.take-down.done", { days: "7" }), "ok");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("inside the window a page it took down offers Put back, and says until when", async () => {
    const until = new Date("2026-10-25T09:00:00.000Z");
    act(() => root.render(<DraftScreen view={view({ kind: "put_back", until })} generatedLabel="label" />));
    expect(container.querySelector('[data-testid="draft-take-down"]')?.textContent).toContain(copy("draft.action.put-back"));
    expect(container.querySelector('[data-testid="take-down"]')).toBeNull();
    click("put-back");
    await act(async () => {});
    expect(putBackDraft).toHaveBeenCalledWith(published.draftId);

    // Outside the window, neither.
    act(() => root.render(<DraftScreen view={view(null)} generatedLabel="label" />));
    expect(container.querySelector('[data-testid="draft-take-down"]')).toBeNull();
  });
});

describe("Plan's Published list", () => {
  it("every live page carries Take down", () => {
    const html = renderToStaticMarkup(
      <PublishedList
        timeZone="UTC"
        content={contentOf({
          now: new Date("2026-10-18T12:00:00.000Z"),
          pages: [
            { id: "p1", draftId: "d1", title: "A page", url: "https://blog.example.com/a", publishedAt: new Date("2026-10-01T09:00:00.000Z") },
            { id: "p2", draftId: "d2", title: "B page", url: "https://blog.example.com/b", publishedAt: new Date("2026-10-02T09:00:00.000Z") },
          ],
        })}
      />
    );
    expect(html.match(/data-testid="take-down"/g)).toHaveLength(2);
  });
});
