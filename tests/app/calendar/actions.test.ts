// tests/app/calendar/actions.test.ts — BUILD §4.6, REQ-043 criteria 9 and 11
//
// WO-166 `## Test plan`: the projection from the transition table, no
// action offered that the stage would refuse, and an empty day offering
// nothing that publishes or approves.
import { beforeEach, describe, expect, it, vi } from "vitest";

// The seam under test is the app-side adapter, not the engine: it must call
// BUILD §9's one mover with the right edge and turn its refusal into a
// rejection. `transition()` itself is exercised in `tests/publish/machine/`
// against a database double; mocking it here keeps this file's subject the
// seam's own contract.
const transition = vi.fn();
vi.mock("@/lib/publish/machine", () => ({ transition: (...a: unknown[]) => transition(...a) }));
import { measured } from "@/lib/measure/measured";
import {
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

const AT = new Date(Date.UTC(2026, 8, 14, 6, 0, 0));

function cellWith(
  state: PublishState,
  liveUrl: string | null = null,
  draftId: string | null = "d1"
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

  it("needs-you → Reconnect, and now Move + Skip: §9 opens needs_attention → skipped", () => {
    // The one control change this reconciliation adds (#130). §9 c3: no
    // page is left in a state it has no way out of — and Reconnect alone
    // was no way out for a customer who would rather drop the page.
    expect(actionsFor(cellWith("needs_attention"))).toEqual([
      { key: "calendar.action.reconnect", kind: "link", href: "/app/settings" },
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
    expect(transition).toHaveBeenCalledWith("d1", to, { kind: "customer", userId: "user-fixture" });
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
