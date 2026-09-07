// tests/app/calendar/actions.test.ts — BUILD §4.6, REQ-043 criteria 9 and 11
//
// WO-166 `## Test plan`: the projection from the transition table, no
// action offered that the stage would refuse, and an empty day offering
// nothing that publishes or approves.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The seam under test is the app-side adapter, not the engine: it must call
// BUILD §9's one mover with the right edge and turn its refusal into a
// rejection. `transition()` itself is exercised in `tests/publish/machine/`
// against a database double; mocking it here keeps this file's subject the
// seam's own contract.
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

import { measured } from "@/lib/measure/measured";
import {
  RESTART_COMMAND,
  STATES_WITH_RESTART_EDGE,
  STATES_WITH_STOP_EDGE,
  STOP_COMMAND,
  actionsFor,
  draftHref,
} from "@/app/(account)/app/calendar/actions";
import { STATES, TRANSITIONS, isTransition } from "@/lib/publish/machine/table";
import { PUBLISH_STATES, STAGE_OF, type PublishState } from "@/app/(account)/app/calendar/stages";
import {
  publishing,
  PublishingNotBuiltError,
  PublishingRefusedError,
} from "@/app/(account)/app/calendar/publishing";
import type { DayCell } from "@/app/(account)/app/calendar/month";
import { COPY } from "@/lib/presentation/copy";

// BUILD §4.4–§4.6, issue #169 — the surfaces under test now resolve who is
// asking through `_session/account.ts`, which reads a signed cookie and a
// `sites` row. This suite has neither, so it signs in as the reserved
// fixture account: the surfaces then take the same fixture branch they
// always took, and what changed is only how they learned whose it is.
import { RESERVED_ACCOUNT, resetAccount, signedInAs } from "../account-door";

beforeEach(() => signedInAs());
afterEach(() => resetAccount());


const AT = new Date(Date.UTC(2026, 8, 14, 6, 0, 0));

function cellWith(
  state: PublishState,
  liveUrl: string | null = null,
  draftId: string | null = "d1",
  enteredReview = false
): DayCell {
  const stage = STAGE_OF[state];
  if (stage === null) throw new Error(`${state} occupies no date`);
  return {
    day: "2026-09-15",
    inMonth: true,
    today: true,
    page: {
      draftId,
      title: "a page",
      state,
      stage,
      scheduledFor: "2026-09-15",
      why: {
        search: "a search",
        askedAs: "a question",
        answeredTodayBy: [],
        youStand: measured(1, AT),
        doneWhen: "an acceptance test",
        winnability: "reach",
      },
      measuredAt: AT,
      liveUrl,
      vetoDeadline: null,
      publishAt: null,
      enteredReview,
    },
    empty: null,
  };
}

const EMPTY_CELL: DayCell = {
  day: "2026-09-24",
  inMonth: true,
  today: false,
  page: null,
  empty: { cause: "supply_exhausted" },
};

describe("the panel projects from §9's own table — there is no second copy of it", () => {
  // Issue #130: the calendar carried a transcription of §9's table made
  // before `src/lib/publish/machine` existed. It is gone; these assertions
  // are against the real one, so an edge changed there changes the panel
  // and cannot silently disagree with it.

  it("the calendar's ten states are §9's ten", () => {
    expect([...PUBLISH_STATES].sort()).toEqual([...STATES].sort());
  });

  it("STOP_COMMAND is total over the ten and names a command exactly where the → skipped edge is open", () => {
    // This is what makes the offered controls a projection rather than a
    // second hand-kept list: adding a `→ skipped` edge without a word for
    // it, or a word without the edge, fails here.
    expect(Object.keys(STOP_COMMAND).sort()).toEqual([...STATES].sort());
    for (const state of PUBLISH_STATES) {
      expect(STOP_COMMAND[state] !== null, state).toBe(isTransition(state, "skipped"));
    }
    expect([...STATES_WITH_STOP_EDGE].sort()).toEqual([
      "in_review",
      "needs_attention",
      "planned",
    ]);
  });

  it("STATES_WITH_STOP_EDGE is read off the imported table, not restated", () => {
    expect([...STATES_WITH_STOP_EDGE].sort()).toEqual(
      TRANSITIONS.filter(([, to]) => to === "skipped")
        .map(([from]) => from)
        .sort()
    );
  });

  it("the edge out of in_review is Veto; out of planned and needs_attention it is Skip", () => {
    // §9 labels the in_review edge "veto" and §4.6 calls the planned one
    // "Skip". `needs_attention` takes Skip too: the page never went out, so
    // stopping it is a page taken off its date, which is what Skip means.
    expect(STOP_COMMAND.in_review).toBe("veto");
    expect(STOP_COMMAND.planned).toBe("skip");
    expect(STOP_COMMAND.needs_attention).toBe("skip");
  });

  it("generating has no stop word, because §9 opens no → skipped edge from it", () => {
    // The deleted transcription had `generating → skipped` and §9 does not.
    // §9 is the side that is right: a generating page is not stranded by
    // the loss — it leads to in_review, where the same edge is open under
    // the word Veto.
    expect(isTransition("generating", "skipped")).toBe(false);
    expect(STOP_COMMAND.generating).toBeNull();
    expect(isTransition("generating", "in_review")).toBe(true);
  });

  it("the three edges §9 has and the transcription lacked are all in the table the panel reads", () => {
    expect(isTransition("generating", "needs_attention")).toBe(true);
    expect(isTransition("needs_attention", "skipped")).toBe(true);
    expect(isTransition("needs_attention", "generating")).toBe(true);
  });
});

describe("REQ-043 c9 — §4.6's stage-appropriate actions, and no action a stage would refuse", () => {
  it("review → Read the full page + Move + Veto", () => {
    const actions = actionsFor(cellWith("in_review"));
    expect(actions.map((a) => a.key)).toEqual([
      "calendar.action.read-full-page",
      "calendar.action.move",
      "calendar.action.veto",
    ]);
    expect(actions[0]).toEqual({
      key: "calendar.action.read-full-page",
      kind: "link",
      href: draftHref("d1"),
    });
  });

  it("live → View live page, at the recorded address", () => {
    const actions = actionsFor(cellWith("published", "https://content.example.com/p"));
    expect(actions).toEqual([
      { key: "calendar.action.view-live-page", kind: "link", href: "https://content.example.com/p" },
    ]);
  });

  it("live with no recorded address offers no way through — an address is never invented", () => {
    expect(actionsFor(cellWith("published", null))).toEqual([]);
  });

  it("needs-you → Reconnect, the restart, and Move + Skip", () => {
    // #130 added Move and Skip (§9 c3: no page is left in a state it has
    // no way out of). #143 adds the restart, which is the one thing §9
    // opens for the customer at this state and for no one else.
    expect(actionsFor(cellWith("needs_attention"))).toEqual([
      { key: "calendar.action.reconnect", kind: "link", href: "/app/settings" },
      { key: "calendar.action.regenerate", kind: "command", command: "regenerate", draftId: "d1" },
      { key: "calendar.action.move", kind: "command", command: "move", draftId: "d1" },
      { key: "calendar.action.skip", kind: "command", command: "skip", draftId: "d1" },
    ]);
  });

  it("a page mid-generation offers nothing — the Skip the transcription gave it is gone", () => {
    // The one control change this reconciliation removes (#130). A
    // generating page wears the planned chip (`STAGE_OF`), which is what
    // the transcription reasoned from; §9 opens no edge out of it but
    // in_review and needs_attention, and the projection never invents one.
    expect(actionsFor(cellWith("generating"))).toEqual([]);
  });

  it("planned → Move + Skip, and never Veto", () => {
    const keys = actionsFor(cellWith("planned")).map((a) => a.key);
    expect(keys).toEqual(["calendar.action.move", "calendar.action.skip"]);
    expect(keys).not.toContain("calendar.action.veto");
  });

  // A planned date drawn from §7's supply carries no draft until §8
  // generates one on the morning it is due (issue #126). Every control
  // below writes against a draft's own row, so a date with none offers
  // nothing — DECISIONS 2026-09-05 (#99): "a control never appears to work
  // before its engine exists."
  it("a planned page with no draft yet offers no control at all", () => {
    expect(actionsFor(cellWith("planned", null, null))).toEqual([]);
  });

  it("a command carries the draft it acts on, so no renderer has to find one", () => {
    for (const action of actionsFor(cellWith("planned"))) {
      if (action.kind !== "command") continue;
      expect(action.draftId).toBe("d1");
    }
  });

  it("no state offers a command without a draft to act on", () => {
    for (const state of PUBLISH_STATES) {
      if (STAGE_OF[state] === null) continue;
      const actions = actionsFor(cellWith(state, "https://content.example.com/p", null));
      expect(actions.filter((a) => a.kind === "command"), state).toEqual([]);
    }
  });

  it("scheduled offers neither Move nor Skip — the page is on its way out", () => {
    expect(actionsFor(cellWith("approved"))).toEqual([]);
    expect(actionsFor(cellWith("publishing"))).toEqual([]);
  });

  it("every command offered is one whose edge is open in the page's own state", () => {
    for (const state of PUBLISH_STATES) {
      if (STAGE_OF[state] === null) continue;
      for (const action of actionsFor(cellWith(state, "https://content.example.com/p"))) {
        if (action.kind !== "command") continue;
        expect(isTransition(state, "skipped"), `${state} → ${action.command}`).toBe(true);
      }
    }
  });

  it("every action's word is a registry key the owner has filled", () => {
    for (const state of PUBLISH_STATES) {
      if (STAGE_OF[state] === null) continue;
      for (const action of actionsFor(cellWith(state, "https://content.example.com/p"))) {
        expect(Object.keys(COPY)).toContain(action.key);
        expect(COPY[action.key], action.key).not.toBe("");
      }
    }
  });
});

describe("REQ-043 c11 — an empty day offers nothing that publishes or approves", () => {
  it("the projection for a cell with no page is empty by construction", () => {
    expect(actionsFor(EMPTY_CELL)).toEqual([]);
  });

  it("and it is empty for every cause, not only the proven one", () => {
    for (const empty of [
      { cause: "instruction", opportunityId: "o1" },
      { cause: "reachkit_stopped" },
      { cause: "page_cannot_go_live", state: "skipped" },
      { cause: "customer_change_holds_pages", setting: "publishing_off" },
      { cause: "supply_exhausted" },
      { cause: "unattributed" },
    ] as const) {
      expect(actionsFor({ ...EMPTY_CELL, empty }), empty.cause).toEqual([]);
    }
  });
});

describe("the publishing seam calls BUILD §9's one mover, and refuses honestly", () => {
  beforeEach(() => {
    transition.mockReset();
  });

  it.each([
    ["skip", "skipped"],
    ["veto", "skipped"],
    ["approve", "approved"],
  ] as const)("%s asks the machine for the %s edge, as the customer", async (command, to) => {
    transition.mockResolvedValue({ ok: true, state: to });
    await publishing[command]({ draftId: "d1" });
    expect(transition).toHaveBeenCalledWith("d1", to, {
      kind: "customer",
      userId: RESERVED_ACCOUNT.userId,
    });
  });

  it("a refusal rejects, carrying the machine's own word for why", async () => {
    transition.mockResolvedValue({
      ok: false,
      refused: "guard",
      failedGuard: "publishing_switch_on",
      state: "approved",
    });
    await expect(publishing.veto({ draftId: "d1" })).rejects.toBeInstanceOf(PublishingRefusedError);
    await expect(publishing.veto({ draftId: "d1" })).rejects.toMatchObject({
      command: "veto",
      refused: "publishing_switch_on",
    });
  });

  it("a move outside the fifteen rejects too, and is not reported as a guard", async () => {
    transition.mockResolvedValue({ ok: false, refused: "not_a_transition", state: "published" });
    await expect(publishing.skip({ draftId: "d1" })).rejects.toMatchObject({
      refused: "not_a_transition",
    });
  });

  it("a command that changed nothing never resolves as though it had", async () => {
    transition.mockResolvedValue({ ok: false, refused: "not_a_transition", state: "published" });
    const outcome = await publishing.skip({ draftId: "d1" }).then(
      () => "resolved",
      () => "rejected"
    );
    expect(outcome).toBe("rejected");
  });

  it("move alone is not a §9 transition, and says so without asking the machine", async () => {
    // Moving a page to another date rewrites the schedule and the veto
    // deadline that hangs off it — issue #46's re-deadline rule, not one of
    // the fifteen edges.
    await expect(publishing.move({ draftId: "d1", to: "2026-09-20" })).rejects.toBeInstanceOf(
      PublishingNotBuiltError
    );
    expect(transition).not.toHaveBeenCalled();
  });
});

describe("issue #143 — the restart is offered against the guard, never against the state alone", () => {
  const keysOf = (cell: Parameters<typeof actionsFor>[0]) => actionsFor(cell).map((a) => a.key);

  it("a page that needs you and was never read offers it", () => {
    expect(keysOf(cellWith("needs_attention", null, "d1", false))).toContain(
      "calendar.action.regenerate"
    );
  });

  it("**a page that reached review and came back does not** — the guard would refuse it", () => {
    // The discriminating row. Both pages read `needs_attention`; only one
    // can pass `never_entered_review`. A projection from the state alone
    // passes every other assertion in this file and fails this one.
    expect(keysOf(cellWith("needs_attention", null, "d1", true))).not.toContain(
      "calendar.action.regenerate"
    );
  });

  it("and it is absent, not present-and-refusing: the other three controls are unchanged", () => {
    expect(keysOf(cellWith("needs_attention", null, "d1", true))).toEqual([
      "calendar.action.reconnect",
      "calendar.action.move",
      "calendar.action.skip",
    ]);
  });

  it("a page with no draft offers it nothing to act on, so it is not offered", () => {
    expect(keysOf(cellWith("needs_attention", null, null, false))).not.toContain(
      "calendar.action.regenerate"
    );
  });

  it("**no other state offers it**, whatever the draft's history", () => {
    for (const state of PUBLISH_STATES) {
      // `skipped` and `unpublished` occupy no date, so no cell carries
      // them — `STAGE_OF` is what says so, and `cellWith` refuses them.
      if (state === "needs_attention" || STAGE_OF[state] === null) continue;
      for (const entered of [true, false]) {
        expect(keysOf(cellWith(state, null, "d1", entered)), state).not.toContain(
          "calendar.action.regenerate"
        );
      }
    }
  });

  it("`planned` is a tail of the → generating edge and still offers no control", () => {
    // §8's own move on the morning a page is due, not the customer's —
    // which is what the edge's `customer_initiated` guard says, and what
    // RESTART_COMMAND carries onto the panel.
    expect(isTransition("planned", "generating")).toBe(true);
    expect(RESTART_COMMAND.planned).toBeNull();
    expect(keysOf(cellWith("planned"))).not.toContain("calendar.action.regenerate");
  });

  it("RESTART_COMMAND is total over the ten, and names a command only where the edge is open", () => {
    expect(Object.keys(RESTART_COMMAND).sort()).toEqual([...STATES].sort());
    for (const state of STATES) {
      if (RESTART_COMMAND[state] !== null) {
        expect(isTransition(state, "generating"), state).toBe(true);
      }
    }
  });

  it("STATES_WITH_RESTART_EDGE is read off the imported table, not restated", () => {
    expect([...STATES_WITH_RESTART_EDGE].sort()).toEqual(
      [...STATES].filter((state) => isTransition(state, "generating")).sort()
    );
    // A subset, and stated as one: the panel offers the control at one of
    // the edge's two tails.
    for (const state of STATES) {
      if (RESTART_COMMAND[state] !== null) expect(STATES_WITH_RESTART_EDGE).toContain(state);
    }
    expect(STATES_WITH_RESTART_EDGE.length).toBeGreaterThan(
      [...STATES].filter((state) => RESTART_COMMAND[state] !== null).length
    );
  });

  it("the word is a registry key and no sentence is written here", () => {
    expect(Object.keys(COPY)).toContain("calendar.action.regenerate");
  });
});

describe("issue #143 — the restart reaches §9's one mover, and nothing else", () => {
  beforeEach(() => {
    transition.mockReset();
  });

  it("it asks for the `generating` edge, as the customer, against that draft", async () => {
    transition.mockResolvedValue({ ok: true, state: "generating" });
    await publishing.regenerate({ draftId: "d1" });
    expect(transition).toHaveBeenCalledWith("d1", "generating", { kind: "customer", userId: expect.any(String) });
  });

  it("**it re-decides no guard of its own** — the seam asks and reports, and holds no rule", async () => {
    transition.mockResolvedValue({
      ok: false,
      refused: "guard",
      failedGuard: "never_entered_review",
      state: "needs_attention",
    });
    await expect(publishing.regenerate({ draftId: "d1" })).rejects.toMatchObject({
      command: "regenerate",
      refused: "never_entered_review",
    });
  });

  it("it is idempotent by the machine: a second press is `not_a_transition`, and writes nothing", async () => {
    transition.mockResolvedValue({ ok: true, state: "generating" });
    await publishing.regenerate({ draftId: "d1" });
    // The page has left `needs_attention`; the same control pressed again
    // asks for an edge that no longer exists from where it now is.
    transition.mockResolvedValue({ ok: false, refused: "not_a_transition", state: "generating" });
    await expect(publishing.regenerate({ draftId: "d1" })).rejects.toMatchObject({
      refused: "not_a_transition",
    });
    expect(transition).toHaveBeenCalledTimes(2);
  });

  it("a refusal tells the customer nothing — there is no sentence for one, and none is invented", async () => {
    transition.mockResolvedValue({ ok: false, refused: "not_a_transition", state: "generating" });
    const outcome = await publishing.regenerate({ draftId: "d1" }).then(
      () => "resolved",
      () => "rejected"
    );
    expect(outcome).toBe("rejected");
    expect(Object.keys(COPY)).not.toContain("calendar.action.regenerate.refused");
  });
});
