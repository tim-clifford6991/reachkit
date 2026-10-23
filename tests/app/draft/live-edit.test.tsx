/** @vitest-environment jsdom */
// tests/app/draft/live-edit.test.tsx — owner R19: *Edit this page* on a live
// page opens the editor on the live words, writes nothing until a save that
// changes something, and that save lands the customer on the new version.
// The save seam is steered here; `tests/generate/edit-live.test.ts` drives
// the server function and the engine to the rows.
import "../../generate/env";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const save = vi.fn();
const saveLive = vi.fn();
vi.mock("@/app/(account)/app/draft/[draftId]/save", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(account)/app/draft/[draftId]/save")>();
  return { ...actual, draftStore: { save: (...a: unknown[]) => save(...a), saveLive: (...a: unknown[]) => saveLive(...a) } };
});
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: () => undefined }) }));
const said = vi.fn();
vi.mock("@/app/_toast/say", () => ({ say: (...a: unknown[]) => said(...a) }));

import { AUTOSAVE_DEBOUNCE_MS } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { DraftScreen } from "@/app/(account)/app/draft/[draftId]/DraftScreen";
import { assembleDraft, liveEditFor } from "@/app/(account)/app/draft/[draftId]/model";
import { FIXTURE_DRAFTS, FIXTURE_PUBLISHED_DRAFT_ID } from "@/app/(account)/app/draft/[draftId]/fixture";
import type { State } from "@/lib/publish/types";

const PUBLISHED = FIXTURE_DRAFTS[FIXTURE_PUBLISHED_DRAFT_ID]!;
const VIEW = assembleDraft({ ...PUBLISHED, live: { ...PUBLISHED.live!, edit: { kind: "editor" } } });

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  save.mockReset();
  saveLive.mockReset();
  push.mockReset();
  said.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<DraftScreen view={VIEW} generatedLabel="Written by ReachKit" />));
});
afterEach(() => {
  act(() => root.unmount());
  // The editor's latch scheduler clears its interval on the next tick.
  act(() => vi.advanceTimersByTime(2));
  container.remove();
  vi.useRealTimers();
});

function el<T extends Element>(testId: string): T {
  const found = container.querySelector<T>(`[data-testid="${testId}"]`);
  if (found === null) throw new Error(`no ${testId}`);
  return found;
}

function retitle(title: string): void {
  const input = el<HTMLInputElement>("draft-editor-title");
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, title);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const settle = () => act(async () => void vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS));

describe("Edit this page on a live page", () => {
  it("opens the editor on the live version's title, body and description, and writes nothing", async () => {
    act(() => el<HTMLButtonElement>("live-edit").click());
    expect(el<HTMLInputElement>("draft-editor-title").value).toBe(VIEW.title);
    expect(el<HTMLTextAreaElement>("draft-editor-description").value).toBe(VIEW.description);
    expect(container.querySelector(".cm-content")?.textContent).toContain("What leaves with you.");
    await settle();
    expect(saveLive).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("a changed save makes one live edit with the typed text and opens the new version", async () => {
    saveLive.mockResolvedValue({ ok: true, changed: true, draftId: "d-new", state: "in_review", passed: true, told: true });
    act(() => el<HTMLButtonElement>("live-edit").click());
    retitle("A customer's own title");
    await settle();
    expect(saveLive).toHaveBeenCalledTimes(1);
    expect(saveLive).toHaveBeenCalledWith({ draftId: VIEW.draftId, title: "A customer's own title", bodyMd: VIEW.bodyMd, description: VIEW.description });
    expect(save).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/app/draft/d-new");
  });

  it("words typed while the first live save is on its way go to the new version, and only then does the screen move", async () => {
    let land!: (outcome: unknown) => void;
    saveLive.mockReturnValue(new Promise((resolve) => (land = resolve)));
    save.mockResolvedValue({ ok: true, savedAt: new Date("2026-10-23T10:00:00.000Z"), claim: { state: "nothing_to_check" }, recordedChecks: [], rulesFailed: false, entered: false });
    act(() => el<HTMLButtonElement>("live-edit").click());
    retitle("First words");
    await settle();
    retitle("First words, and more");
    await settle();
    expect(saveLive).toHaveBeenCalledTimes(1);
    await act(async () => land({ ok: true, changed: true, draftId: "d-new", state: "needs_attention", passed: false, told: false }));
    await settle();
    expect(saveLive).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ draftId: "d-new", title: "First words, and more", bodyMd: VIEW.bodyMd, description: VIEW.description });
    expect(push).toHaveBeenCalledWith("/app/draft/d-new");
    expect(push.mock.invocationCallOrder[0]!).toBeGreaterThan(save.mock.invocationCallOrder[0]!);
  });

  it("Done editing before the live save returns answers when it lands, and opens the new version", async () => {
    let land!: (outcome: unknown) => void;
    saveLive.mockReturnValue(new Promise((resolve) => (land = resolve)));
    act(() => el<HTMLButtonElement>("live-edit").click());
    retitle("A customer's own title");
    await settle();
    act(() => el<HTMLButtonElement>("draft-edit-done").click());
    expect(container.querySelector('[data-testid="live-controls"]')).not.toBeNull();
    expect(said).not.toHaveBeenCalled();
    await act(async () => land({ ok: true, changed: true, draftId: "d-new", state: "in_review", passed: true, told: true }));
    expect(said).toHaveBeenCalledWith(copy("draft.edit.entered-review"), "ok");
    expect(push).toHaveBeenCalledWith("/app/draft/d-new");
  });

  it("a refused live edit keeps the words and goes nowhere", async () => {
    saveLive.mockResolvedValue({ ok: false, refused: "store_unavailable" });
    act(() => el<HTMLButtonElement>("live-edit").click());
    retitle("A customer's own title");
    await settle();
    expect(el<HTMLInputElement>("draft-editor-title").value).toBe("A customer's own title");
    expect(el("draft-edit-state-unsaved")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("when a version of the address already waits (pending_version)", () => {
  it.each<[State, ReturnType<typeof liveEditFor>]>([
    ["in_review", { kind: "version", draftId: "d-waiting" }],
    ["needs_attention", { kind: "version", draftId: "d-waiting" }],
    ["failed", { kind: "version", draftId: "d-waiting" }],
    ["generating", null],
    ["approved", null],
    ["publishing", null],
  ])("%s → %j", (state, edit) => {
    expect(liveEditFor({ id: "d-waiting", state })).toEqual(edit);
  });

  it("none waiting → the editor", () => {
    expect(liveEditFor(null)).toEqual({ kind: "editor" });
  });

  it("not live → no Edit, since the save would be refused", () => {
    expect(liveEditFor("not_live")).toBeNull();
  });

  it("a version being written or going out draws no Edit", () => {
    const view = assembleDraft({ ...PUBLISHED, live: { ...PUBLISHED.live!, edit: liveEditFor({ id: "d-waiting", state: "publishing" }) } });
    act(() => root.render(<DraftScreen view={view} generatedLabel="Written by ReachKit" />));
    expect(container.querySelector('[data-testid="take-down"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="live-edit"]')).toBeNull();
  });
});
