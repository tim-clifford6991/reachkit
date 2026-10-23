/** @vitest-environment jsdom */
// tests/app/draft/take-down.test.tsx — owner ruling R9 (2026-10-22): a live
// page's *Stop this page* stops on one press with its consequence line under
// it; a stopped hosted page offers *Put it back* for 7 days and only then; a
// stopped WordPress page says the post went back to draft.
import "../../generate/env";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const takeDownDraft = vi.fn<(id: string) => Promise<string | null>>(async () => null);
const putBackDraft = vi.fn<(id: string) => Promise<string | null>>(async () => null);
vi.mock("@/app/(account)/app/calendar/publishing-actions", () => ({
  takeDownDraft: (id: string) => takeDownDraft(id),
  putBackDraft: (id: string) => putBackDraft(id),
  skipDraft: async () => null,
  vetoDraft: async () => null,
  regenerateDraft: async () => null,
}));
const say = vi.fn();
vi.mock("@/app/_toast/say", () => ({ say: (...args: unknown[]) => say(...args) }));

import { copy, COPY } from "@/lib/presentation/copy";
import { TAKE_DOWN } from "@/lib/config/constants";
import { DraftScreen } from "@/app/(account)/app/draft/[draftId]/DraftScreen";
import { assembleDraft } from "@/app/(account)/app/draft/[draftId]/model";
import { FIXTURE_DRAFTS, FIXTURE_PUBLISHED_DRAFT_ID } from "@/app/(account)/app/draft/[draftId]/fixture";
import { formatDate } from "@/app/(account)/app/_shell/format";
import { PublishedList } from "@/app/(account)/app/calendar/PublishedList";
import { contentOf } from "@/lib/measure/published";
import { takeDownStanding } from "@/lib/publish/take-down/standing";
import type { UnpublishOutcome } from "@/lib/publish/types";

const published = FIXTURE_DRAFTS[FIXTURE_PUBLISHED_DRAFT_ID]!;
const STOPPED_AT = new Date("2026-10-18T12:00:00.000Z");
const DAY = 86_400_000;
const TOOK_DOWN = [
  { from: "approved", to: "published", at: "2026-09-14T14:00:00.000Z", actor: { kind: "system" } },
  { from: "published", to: "unpublished", at: STOPPED_AT.toISOString(), actor: { kind: "customer", userId: "u1" }, reason: "take_down" },
];

/** The page after a stop, as the store decides it on `now`. */
function stoppedView(outcome: UnpublishOutcome, now: Date) {
  const takeDown = takeDownStanding({ state: "unpublished", transitions: TOOK_DOWN, live: false, unpublishOutcome: outcome, now });
  return assembleDraft({ ...published, state: "unpublished", takeDown });
}

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

const $ = (testId: string) => container.querySelector(`[data-testid="${testId}"]`);

describe("R9: one press stops, with the consequence line and no confirm", () => {
  it("Stop this page sits over its consequence, and one click stops the page at once", async () => {
    act(() => root.render(<DraftScreen view={assembleDraft(published)} generatedLabel="label" />));
    const stop = $("take-down") as HTMLButtonElement;
    expect(stop.textContent).toBe(copy("draft.action.veto"));
    const note = $("live-stop-note")!;
    expect(stop.getAttribute("aria-describedby")).toBe(note.id);
    expect(note.textContent).toContain(copy("draft.live.stop-note"));
    expect(note.querySelector("a")?.textContent).toBe(copy("draft.live.pause-link"));

    await act(async () => stop.click());
    expect(takeDownDraft).toHaveBeenCalledTimes(1);
    expect(takeDownDraft).toHaveBeenCalledWith(published.draftId);
    expect(say).toHaveBeenCalledWith(copy("draft.stop.done"), "ok");
    expect($("take-down-ask")).toBeNull();
    expect($("put-back")).toBeNull();
  });

  it("a stop that did not go through says the page is still live", async () => {
    takeDownDraft.mockResolvedValueOnce("failed");
    act(() => root.render(<DraftScreen view={assembleDraft(published)} generatedLabel="label" />));
    await act(async () => ($("take-down") as HTMLButtonElement).click());
    expect(say).toHaveBeenCalledWith(copy("draft.stop.refused"), "bad");
  });

  it("no take-down key is left in the registry", () => {
    expect(Object.keys(COPY).filter((key) => key.startsWith("draft.take-down.") || key === "draft.action.take-down")).toEqual([]);
  });
});

describe("R9: a stopped hosted page offers Put it back for 7 days, and only then", () => {
  it("live: no Put it back", () => {
    act(() => root.render(<DraftScreen view={assembleDraft(published)} generatedLabel="label" />));
    expect($("put-back")).toBeNull();
    expect($("live-put-back-until")).toBeNull();
  });

  it("day 0: the badge reads Stopped, the controls leave, and Put it back names its last day", async () => {
    act(() => root.render(<DraftScreen view={stoppedView("removed", STOPPED_AT)} generatedLabel="label" />));
    expect($("live-stopped")?.textContent).toBe(copy("draft.stopped.badge"));
    expect($("live-controls")).toBeNull();
    expect($("live-stopped-state")?.textContent).toContain(copy("draft.stopped.line"));
    const until = new Date(STOPPED_AT.getTime() + TAKE_DOWN.PUT_BACK_DAYS * DAY);
    expect($("live-put-back-until")?.textContent).toBe(copy("draft.put-back.until", { date: formatDate(until, published.timeZone) }));

    await act(async () => ($("put-back") as HTMLButtonElement).click());
    expect(putBackDraft).toHaveBeenCalledWith(published.draftId);
    expect(say).toHaveBeenCalledWith(copy("draft.put-back.done"), "ok");
  });

  it("day 7: still offered; day 8: gone, and the page stays stopped", () => {
    act(() => root.render(<DraftScreen view={stoppedView("removed", new Date(STOPPED_AT.getTime() + 7 * DAY - 60_000))} generatedLabel="label" />));
    expect($("put-back")?.textContent).toBe(copy("draft.action.put-back"));

    act(() => root.render(<DraftScreen view={stoppedView("removed", new Date(STOPPED_AT.getTime() + 8 * DAY))} generatedLabel="label" />));
    expect($("put-back")).toBeNull();
    expect($("live-put-back-until")).toBeNull();
    expect($("live-stopped")).not.toBeNull();
  });
});

describe("R9: a stopped WordPress page says the post went back to draft", () => {
  it("draws the line and no Put it back", () => {
    act(() => root.render(<DraftScreen view={stoppedView("returned_to_draft", STOPPED_AT)} generatedLabel="label" />));
    expect($("live-stopped-wordpress")?.textContent).toBe(copy("draft.stopped.wordpress"));
    expect($("put-back")).toBeNull();
  });
});

describe("Plan's Published list", () => {
  it("every live page carries Stop this page", () => {
    const html = renderToStaticMarkup(
      <PublishedList
        timeZone="UTC"
        now={new Date("2026-10-18T12:00:00.000Z")}
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
    expect(html).toContain(copy("draft.action.veto"));
  });
});
