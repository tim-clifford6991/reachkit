// tests/app/calendar/actions.test.ts — BUILD §4.6, REQ-043 criteria 9 and 11
//
// WO-166 `## Test plan`: the projection from the transition table, no
// action offered that the stage would refuse, and an empty day offering
// nothing that publishes or approves.
import { describe, expect, it } from "vitest";
import { measured } from "@/lib/measure/measured";
import {
  STATES_WITH_STOP_EDGE,
  STOP_COMMAND,
  TRANSITIONS,
  actionsFor,
  draftHref,
} from "@/app/(account)/app/calendar/actions";
import { PUBLISH_STATES, STAGE_OF, type PublishState } from "@/app/(account)/app/calendar/stages";
import { publishing, PublishingNotBuiltError } from "@/app/(account)/app/calendar/publishing";
import type { DayCell } from "@/app/(account)/app/calendar/month";
import { COPY } from "@/lib/presentation/copy";

const AT = new Date(Date.UTC(2026, 8, 14, 6, 0, 0));

function cellWith(state: PublishState, liveUrl: string | null = null): DayCell {
  const stage = STAGE_OF[state];
  if (stage === null) throw new Error(`${state} occupies no date`);
  return {
    day: "2026-09-15",
    inMonth: true,
    today: true,
    page: {
      draftId: "d1",
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

describe("the transition table is BUILD §9's, and STOP_COMMAND is a projection of it", () => {
  it("TRANSITIONS is total over the ten states, and the two terminal states are terminal", () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...PUBLISH_STATES].sort());
    expect(TRANSITIONS.skipped).toEqual([]);
    expect(TRANSITIONS.unpublished).toEqual([]);
  });

  it("STOP_COMMAND names a command exactly where the → skipped edge is open", () => {
    // This is what makes the offered controls a projection rather than a
    // second hand-kept list: adding a `→ skipped` edge without a word for
    // it, or a word without the edge, fails here.
    for (const state of PUBLISH_STATES) {
      expect(STOP_COMMAND[state] !== null, state).toBe(TRANSITIONS[state].includes("skipped"));
    }
    expect([...STATES_WITH_STOP_EDGE].sort()).toEqual(["generating", "in_review", "planned"]);
  });

  it("the edge out of in_review is Veto and out of a planned page is Skip (§9 and §4.6)", () => {
    expect(STOP_COMMAND.in_review).toBe("veto");
    expect(STOP_COMMAND.planned).toBe("skip");
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

  it("needs-you → Reconnect", () => {
    expect(actionsFor(cellWith("needs_attention"))).toEqual([
      { key: "calendar.action.reconnect", kind: "link", href: "/app/settings" },
    ]);
  });

  it("planned → Move + Skip, and never Veto", () => {
    const keys = actionsFor(cellWith("planned")).map((a) => a.key);
    expect(keys).toEqual(["calendar.action.move", "calendar.action.skip"]);
    expect(keys).not.toContain("calendar.action.veto");
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
        expect(TRANSITIONS[state], `${state} → ${action.command}`).toContain("skipped");
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

describe("the publishing seam is declared and stubbed honestly", () => {
  it("every command rejects, naming what was asked", async () => {
    await expect(publishing.move({ draftId: "d1", to: "2026-09-20" })).rejects.toBeInstanceOf(
      PublishingNotBuiltError
    );
    await expect(publishing.skip({ draftId: "d1" })).rejects.toBeInstanceOf(PublishingNotBuiltError);
    await expect(publishing.veto({ draftId: "d1" })).rejects.toBeInstanceOf(PublishingNotBuiltError);
  });

  it("it never resolves — a stub that succeeded would be a control that appears to work", async () => {
    const outcome = await publishing.skip({ draftId: "d1" }).then(
      () => "resolved",
      () => "rejected"
    );
    expect(outcome).toBe("rejected");
  });
});
