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
// Plus the two seams this screen calls: nothing here pretends a write
// succeeded. Approve and Veto now reach BUILD §9's one mover (#45); the
// save is still declared and stubbed (#44).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `transition()` is exercised in `tests/publish/machine/` against a database
// double; mocking it here keeps this file's subject the seam's own contract.
const transition = vi.fn();
vi.mock("@/lib/publish/machine", () => ({ transition: (...a: unknown[]) => transition(...a) }));

// Issue #169: the day panel's writes now act as the signed-in customer and
// refuse a draft the account does not own. The ownership read reaches
// `@/lib/db`; this suite is about the actor and the edge, so the read is
// doubled and answers "yours" — the refusal it can also answer has its own
// rows in `tests/app/calendar/ownership.test.ts`.
vi.mock("@/app/(account)/app/_session/store", () => ({
  siteOwnsDraft: async () => true,
}));
import {
  draftActionsFor,
  isEditable,
  type DraftAction,
} from "@/app/(account)/app/draft/[draftId]/actions";
import { STOP_COMMAND, actionsFor } from "@/app/(account)/app/calendar/actions";
import { TRANSITIONS, isTransition } from "@/lib/publish/machine/table";
import { STATES, type State } from "@/app/(account)/app/calendar/stages";
import {
  publishing,
  PublishingRefusedError,
} from "@/app/(account)/app/calendar/publishing";
import {
  draftStore,
  DraftSaveNotBuiltError,
} from "@/app/(account)/app/draft/[draftId]/save";

// BUILD §4.4–§4.6, issue #169 — the surfaces under test now resolve who is
// asking through `_session/account.ts`, which reads a signed cookie and a
// `sites` row. This suite has neither, so it signs in as the reserved
// fixture account: the surfaces then take the same fixture branch they
// always took, and what changed is only how they learned whose it is.
import { RESERVED_ACCOUNT, resetAccount, signedInAs } from "../account-door";

beforeEach(() => signedInAs());
afterEach(() => resetAccount());


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
    for (const state of STATES) {
      const offered = draftActionsFor(state).some(
        (a) => a.kind === "command" && a.command === "approve"
      );
      expect(offered, state).toBe(isTransition(state, "approved"));
    }
  });

  it("veto is offered exactly where the calendar's own projection names that word", () => {
    for (const state of STATES) {
      const offered = draftActionsFor(state).some((a) => a.kind === "command" && a.command === "veto");
      expect(offered, state).toBe(STOP_COMMAND[state] === "veto");
    }
  });

  it("edit rides on the same edge as approve — text that can still be approved has not gone out", () => {
    for (const state of STATES) {
      expect(isEditable(state), state).toBe(isTransition(state, "approved"));
      expect(
        draftActionsFor(state).some((a) => a.kind === "edit"),
        state
      ).toBe(isEditable(state));
    }
  });

  it("a page that has gone out, or been stopped, offers nothing at all", () => {
    for (const state of ["published", "unpublished", "skipped", "publishing"] as State[]) {
      expect(draftActionsFor(state), state).toEqual([]);
    }
  });

  it("no action is offered that the state would refuse — the projection is total over the ten states", () => {
    for (const state of STATES) {
      for (const action of draftActionsFor(state)) {
        if (action.kind !== "command") continue;
        const target = action.command === "approve" ? "approved" : "skipped";
        expect(isTransition(state, target), `${state} → ${target}`).toBe(true);
      }
    }
  });
});

describe("the draft view and the day panel read one table", () => {
  // Issue #130: literally one table now — both surfaces read
  // `src/lib/publish/machine/table.ts`, and neither declares an edge.

  it("every action the draft view offers rides an edge of §9's own table", () => {
    for (const state of STATES) {
      for (const action of draftActionsFor(state)) {
        const target = action.kind === "edit" || action.command === "approve" ? "approved" : "skipped";
        expect(
          TRANSITIONS.some(([from, to]) => from === state && to === target),
          `${state} → ${target}`
        ).toBe(true);
      }
    }
  });

  it("Edit is offered on exactly the states §9's table can still reach approved from", () => {
    const editable = STATES.filter((state) => isEditable(state));
    expect([...editable].sort()).toEqual(
      TRANSITIONS.filter(([, to]) => to === "approved")
        .map(([from]) => from)
        .sort()
    );
  });

  it("wherever the panel offers Veto, the draft view offers Veto too", () => {
    for (const state of STATES) {
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
      enteredReview: false,
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
    for (const state of STATES) {
      for (const action of draftActionsFor(state)) {
        if (action.kind !== "command") continue;
        expect(["approve", "veto"]).toContain(action.command);
      }
    }
  });
});

describe("neither seam claims a write succeeded", () => {
  beforeEach(() => {
    transition.mockReset();
  });

  it("approve asks §9's machine for the in_review → approved edge", async () => {
    transition.mockResolvedValue({ ok: true, state: "approved" });
    await publishing.approve({ draftId: "d1" });
    expect(transition).toHaveBeenCalledWith("d1", "approved", {
      kind: "customer",
      userId: RESERVED_ACCOUNT.userId,
    });
  });

  it("a refused approve rejects, naming the command and the machine's own word", async () => {
    transition.mockResolvedValue({
      ok: false,
      refused: "not_a_transition",
      state: "published",
    });
    await expect(publishing.approve({ draftId: "d1" })).rejects.toBeInstanceOf(
      PublishingRefusedError
    );
    await expect(publishing.approve({ draftId: "d1" })).rejects.toMatchObject({
      command: "approve",
      refused: "not_a_transition",
    });
  });

  it("veto behaves alike — the same seam, the → skipped edge, refused the same way", async () => {
    transition.mockResolvedValue({ ok: true, state: "skipped" });
    await publishing.veto({ draftId: "d1" });
    expect(transition).toHaveBeenCalledWith("d1", "skipped", {
      kind: "customer",
      userId: RESERVED_ACCOUNT.userId,
    });

    transition.mockResolvedValue({ ok: false, refused: "guard", failedGuard: "customer_told", state: "in_review" });
    await expect(publishing.veto({ draftId: "d1" })).rejects.toBeInstanceOf(PublishingRefusedError);
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
