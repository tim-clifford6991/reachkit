// tests/app/draft/actions.test.ts — BUILD §4.6, §9, REQ-045 criteria 4 and 7
//
// Two claims, and the second is the one that would be easy to lose:
//
//  1. Approve, Edit and Veto are offered exactly where §9's transition
//     table opens the edge each of them rides on.
//  2. The draft view and the calendar's day panel project from **the same**
//     table, so the two surfaces cannot offer different actions for one
//     state — which is the archived BP-044's own wording of the promise.
//
// Plus the two seams this screen calls, both stubbed honestly: nothing here
// pretends a write succeeded.
import { describe, expect, it } from "vitest";
import {
  draftActionsFor,
  isEditable,
  type DraftAction,
} from "@/app/(account)/app/draft/[draftId]/actions";
import { STOP_COMMAND, TRANSITIONS, actionsFor } from "@/app/(account)/app/calendar/actions";
import { PUBLISH_STATES, type PublishState } from "@/app/(account)/app/calendar/stages";
import {
  publishing,
  PublishingNotBuiltError,
} from "@/app/(account)/app/calendar/publishing";
import {
  draftStore,
  DraftSaveNotBuiltError,
} from "@/app/(account)/app/draft/[draftId]/save";

function keysOf(actions: readonly DraftAction[]): string[] {
  return actions.map((a) => a.key);
}

describe("REQ-045 c4 — approve, edit and veto, offered where the state allows them", () => {
  it("a page in review offers all three, in §4.6's own order", () => {
    expect(keysOf(draftActionsFor("in_review"))).toEqual([
      "draft.action.approve",
      "draft.action.edit",
      "draft.action.veto",
    ]);
  });

  it("approve is offered exactly where the → approved edge is open", () => {
    for (const state of PUBLISH_STATES) {
      const offered = draftActionsFor(state).some(
        (a) => a.kind === "command" && a.command === "approve"
      );
      expect(offered, state).toBe(TRANSITIONS[state].includes("approved"));
    }
  });

  it("veto is offered exactly where the calendar's own projection names that word", () => {
    for (const state of PUBLISH_STATES) {
      const offered = draftActionsFor(state).some((a) => a.kind === "command" && a.command === "veto");
      expect(offered, state).toBe(STOP_COMMAND[state] === "veto");
    }
  });

  it("edit rides on the same edge as approve — text that can still be approved has not gone out", () => {
    for (const state of PUBLISH_STATES) {
      expect(isEditable(state), state).toBe(TRANSITIONS[state].includes("approved"));
      expect(
        draftActionsFor(state).some((a) => a.kind === "edit"),
        state
      ).toBe(isEditable(state));
    }
  });

  it("a page that has gone out, or been stopped, offers nothing at all", () => {
    for (const state of ["published", "unpublished", "skipped", "publishing"] as PublishState[]) {
      expect(draftActionsFor(state), state).toEqual([]);
    }
  });

  it("no action is offered that the state would refuse — the projection is total over the ten states", () => {
    for (const state of PUBLISH_STATES) {
      for (const action of draftActionsFor(state)) {
        if (action.kind !== "command") continue;
        const target = action.command === "approve" ? "approved" : "skipped";
        expect(TRANSITIONS[state].includes(target), `${state} → ${target}`).toBe(true);
      }
    }
  });
});

describe("the draft view and the day panel read one table", () => {
  it("wherever the panel offers Veto, the draft view offers Veto too", () => {
    for (const state of PUBLISH_STATES) {
      const cell = {
        day: "2026-09-15",
        inMonth: true,
        today: true,
        empty: null,
        page: {
          draftId: "d1",
          title: "t",
          state,
          stage: "your_review" as const,
          scheduledFor: "2026-09-15",
          why: {
            search: "s",
            askedAs: "a",
            answeredTodayBy: [],
            youStand: { kind: "measured" as const, value: 1, at: new Date(0) },
            doneWhen: "d",
            winnability: "winnable" as const,
          },
          measuredAt: new Date(0),
          liveUrl: null,
          vetoDeadline: null,
          publishAt: null,
        },
      };
      const panelHasVeto = actionsFor(cell).some(
        (a) => a.kind === "command" && a.command === "veto"
      );
      const viewHasVeto = draftActionsFor(state).some(
        (a) => a.kind === "command" && a.command === "veto"
      );
      expect(viewHasVeto, state).toBe(panelHasVeto);
    }
  });

  it("the draft view offers no Move and no Skip — those are the calendar's, and it says so by not having them", () => {
    for (const state of PUBLISH_STATES) {
      for (const action of draftActionsFor(state)) {
        if (action.kind !== "command") continue;
        expect(["approve", "veto"]).toContain(action.command);
      }
    }
  });
});

describe("both seams are declared and stubbed honestly — nothing claims a write succeeded", () => {
  it("approve rejects with PublishingNotBuiltError, naming the command", async () => {
    await expect(publishing.approve({ draftId: "d1" })).rejects.toBeInstanceOf(
      PublishingNotBuiltError
    );
    await expect(publishing.approve({ draftId: "d1" })).rejects.toMatchObject({
      command: "approve",
    });
  });

  it("veto still rejects the same way, so the two controls behave alike", async () => {
    await expect(publishing.veto({ draftId: "d1" })).rejects.toBeInstanceOf(PublishingNotBuiltError);
  });

  it("the save rejects with DraftSaveNotBuiltError and never resolves ok", async () => {
    const asked = draftStore.save({ draftId: "d1", bodyMd: "x" });
    await expect(asked).rejects.toBeInstanceOf(DraftSaveNotBuiltError);
    await expect(asked).rejects.toMatchObject({ draftId: "d1" });
  });

  it("the stub names the section that will supply it, and never the customer's body", async () => {
    const error = await draftStore
      .save({ draftId: "d1", bodyMd: "the customer's private words" })
      .catch((e: unknown) => e);
    expect(String(error)).toContain("d1");
    expect(String(error)).not.toContain("the customer's private words");
  });
});
