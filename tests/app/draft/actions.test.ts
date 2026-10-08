// tests/app/draft/actions.test.ts — BUILD §4.6, §9, REQ-045 criteria 4 and 7
//
// Two claims: every control rides an edge §9's table opens from that state,
// and the draft view and the calendar's day panel offer the same stop and
// restart for one page (BP-044) — including a page the rules stopped
// (#1180).
//
// Plus the two seams this screen calls: nothing here pretends a write
// succeeded. Approve and Veto reach BUILD §9's one mover (#45); the save
// reaches the engine (#789, `save.test.ts`).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `transition()` is exercised in `tests/publish/machine/` against a database
// double; mocking it here keeps this file's subject the seam's own contract.
const transition = vi.fn();
vi.mock("@/lib/publish/machine", () => ({ transition: (...a: unknown[]) => transition(...a) }));

// Issue #790: an approval that moved asks the engine to send the page's
// `publish/execute` for its moment. Doubled here for the machine's reason.
const schedulePublish = vi.fn(async () => ({ scheduled: true }));
vi.mock("@/jobs/engine", () => ({ schedulePublish: (...a: unknown[]) => schedulePublish(...(a as [])) }));

// Issue #169: the day panel's writes now act as the signed-in customer and
// refuse a draft the account does not own. The ownership read reaches
// `@/lib/db`; this suite is about the actor and the edge, so the read is
// doubled and answers "yours" — the refusal it can also answer has its own
// rows in `tests/app/calendar/ownership.test.ts`.
vi.mock("@/app/(account)/app/_session/store", () => ({
  siteOwnsDraft: async () => true,
}));

// Issue #913: a write that landed revalidates the screens that draw the
// page's state. `revalidatePath` needs Next's own request store, which no
// unit test has; the assertions on which paths are asked for live in
// `tests/app/calendar/ownership.test.ts`.
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
import {
  draftActionsFor,
  isEditable,
  type DraftAction,
} from "@/app/(account)/app/draft/[draftId]/actions";
import { actionsFor } from "@/app/(account)/app/calendar/actions";
import { isTransition } from "@/lib/publish/machine/table";
import { STATES, type State } from "@/app/(account)/app/calendar/stages";
import { publishing } from "@/app/(account)/app/calendar/publishing";
import { draftStore } from "@/app/(account)/app/draft/[draftId]/save";

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

const reviewed = (state: State) => ({ state, enteredReview: true });
const stopped = { state: "needs_attention" as State, enteredReview: false };

const TARGET: Record<string, State> = {
  veto: "skipped",
  skip: "skipped",
  regenerate: "generating",
};

describe("REQ-045 c4 — the controls, offered where the state allows them", () => {
  it("a page in review offers Edit and Stop, and no Approve (owner 2026-10-08, issue 1337)", () => {
    expect(keysOf(draftActionsFor(reviewed("in_review")))).toEqual([
      "draft.action.edit",
      "draft.action.veto",
    ]);
  });

  it("#1180 — a page the rules stopped before review offers Edit, Write it again and Skip", () => {
    expect(keysOf(draftActionsFor(stopped))).toEqual([
      "draft.action.edit",
      "calendar.action.regenerate",
      "calendar.action.skip",
    ]);
    expect(isEditable(stopped)).toBe(true);
  });

  it("#1180 — a page that went out and came back to needs-you is not edited or rewritten, only skipped", () => {
    expect(keysOf(draftActionsFor(reviewed("needs_attention")))).toEqual(["calendar.action.skip"]);
  });

  it("a page that has gone out, or been stopped, offers nothing at all", () => {
    for (const state of ["published", "unpublished", "skipped", "publishing"] as State[]) {
      expect(draftActionsFor(reviewed(state)), state).toEqual([]);
    }
  });

  it("no command is offered that the state would refuse", () => {
    for (const state of STATES) {
      for (const enteredReview of [true, false]) {
        for (const action of draftActionsFor({ state, enteredReview })) {
          if (action.kind !== "command") continue;
          const target = TARGET[action.command] as State;
          expect(isTransition(state, target), `${state} → ${target}`).toBe(true);
        }
      }
    }
  });

  it("wherever the day panel offers a stop or a restart, the draft view offers the same", () => {
    for (const state of STATES) {
      if (state === "planned") continue; // a planned page has no draft to open
      for (const enteredReview of [true, false]) {
        const cell = {
          day: "2026-09-15",
          inMonth: true,
          when: "plan" as const,
          statesLine: false,
          horizonMarker: false,
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
              bestRival: null,
              youStand: { kind: "measured" as const, value: 1, at: new Date(0) },
              doneWhen: "d",
              winnability: "winnable" as const,
              volume: { kind: "measured" as const, value: 90, at: new Date(0) },
              difficulty: { kind: "measured" as const, value: 12, at: new Date(0) },
              ceiling: 36,
              engines: [],
            },
            measuredAt: new Date(0),
            liveUrl: null,
            vetoDeadline: null,
            publishAt: null,
            enteredReview,
            verification: { kind: "never", because: "no_live_address" } as const,
            unpublishOutcome: null,
            needsYou: null,
            standing: null,
            update: false,
          },
        };
        const commands = (list: readonly { kind: string; command?: string }[]) =>
          list.filter((a) => a.kind === "command").map((a) => a.command).sort();
        expect(commands(draftActionsFor({ state, enteredReview })), state).toEqual(commands(actionsFor(cell)));
      }
    }
  });
});

describe("neither seam claims a write succeeded, and both of them answer", () => {
  beforeEach(() => {
    transition.mockReset();
  });

  // Owner, 2026-10-08 (issue 1337): the customer has no approve.
  it("the seam has no approve to ask for", () => {
    expect(Object.keys(publishing)).not.toContain("approve");
  });

  it("veto behaves alike — the same seam, the → skipped edge, refused the same way", async () => {
    transition.mockResolvedValue({ ok: true, state: "skipped" });
    await publishing.veto({ draftId: "d1" });
    expect(transition).toHaveBeenCalledWith("d1", "skipped", {
      kind: "customer",
      userId: RESERVED_ACCOUNT.userId,
    });

    transition.mockResolvedValue({ ok: false, refused: "guard", failedGuard: "customer_told", state: "in_review" });
    await expect(publishing.veto({ draftId: "d1" })).resolves.toEqual({
      ok: false,
      refused: "customer_told",
    });
  });

  it("the save never rejects: the fixture account has no row to write, and is refused rather than told it saved", async () => {
    const result = await draftStore.save({ draftId: "d1", title: "t", bodyMd: "x", description: "" });
    expect(result).toEqual({ ok: false, refused: "not_editable" });
  });
});
