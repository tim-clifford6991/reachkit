// tests/publish/machine/transition.test.ts — BUILD §9's one mover.
//
// Every move outside the fifteen is refused **with the state unchanged and
// nothing appended**; every guarded edge is refused by each of its guards in
// turn, naming the one that said no; and the record is appended in the same
// statement that sets the state, so a state that moved without a record is
// unrepresentable.
//
// The archived plan is WO-209.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import {
  PUBLISHABLE_RULE_NOT_BUILT,
  STATES,
  TRANSITIONS,
  transition,
  type GuardDeps,
} from "@/lib/publish/machine";
import type { Actor, State, TransitionRecord } from "@/lib/publish/types";

const CUSTOMER: Actor = { kind: "customer", userId: "u1" };
const SYSTEM: Actor = { kind: "system", job: "publish/execute" };
const AT = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));

/** Every guard open. A test that wants one shut says which. */
function openDeps(over: Partial<GuardDeps> = {}): GuardDeps {
  return {
    isPublishingOn: async () => true,
    hasCeilingRoom: async () => true,
    destinationWorking: async () => true,
    rule: { becomesPublishable: () => true, toldCurrentPair: () => true },
    ...over,
  };
}

function seedDraft(state: State, over: Row = {}): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [{ id: "s1", mode: "autopilot", veto_hours: 24, publishing_enabled: true }]);
  db.seed("drafts", [
    {
      id: "d1",
      site_id: "s1",
      state,
      veto_deadline: null,
      approved_at: null,
      transitions: [],
      hard_rules_passed: true,
      publishable_since: null,
      ...over,
    },
  ]);
}

function draftRow(): Row {
  const row = db.rows("drafts")[0];
  if (row === undefined) throw new Error("no draft row");
  return row;
}

beforeEach(() => {
  db.reset();
  installTransitionRpc(db);
});

describe("every move outside the fifteen is refused with the state unchanged", () => {
  const pairs: [State, State][] = STATES.flatMap((from) =>
    STATES.map((to) => [from, to] as [State, State])
  );
  const members = new Set(TRANSITIONS.map(([f, t]) => `${f}→${t}`));
  const nonMembers = pairs.filter(([f, t]) => !members.has(`${f}→${t}`));

  it("all 100 ordered pairs are accounted for: 15 members, 85 not", () => {
    expect(pairs.length).toBe(100);
    expect(nonMembers.length).toBe(85);
  });

  it.each(nonMembers)("%s → %s is refused as not_a_transition", async (from, to) => {
    seedDraft(from);
    const result = await transition("d1", to, CUSTOMER, { at: AT, deps: openDeps() });
    expect(result).toEqual({ ok: false, refused: "not_a_transition", state: from });
    expect(draftRow().state).toBe(from);
    expect(draftRow().transitions).toEqual([]);
    expect(db.rpcCalls).toHaveLength(0);
  });
});

describe("no move leaves skipped or unpublished", () => {
  it.each(["skipped", "unpublished"] as const)(
    "%s is the source of no move that succeeds",
    async (terminal) => {
      for (const to of STATES) {
        seedDraft(terminal);
        const result = await transition("d1", to, CUSTOMER, { at: AT, deps: openDeps() });
        expect(result.ok, `${terminal}→${to}`).toBe(false);
        expect(draftRow().state).toBe(terminal);
      }
    }
  );
});

describe("a move that is one of the fifteen moves the page and records it", () => {
  it("in_review → skipped: the customer's veto, recorded with who and why", async () => {
    seedDraft("in_review");
    const result = await transition("d1", "skipped", CUSTOMER, { at: AT, reason: "veto" });
    expect(result).toEqual({ ok: true, state: "skipped" });
    expect(draftRow().state).toBe("skipped");
    const [record] = draftRow().transitions as TransitionRecord[];
    expect(record).toEqual({
      from: "in_review",
      to: "skipped",
      actor: CUSTOMER,
      reason: "veto",
      at: AT.toISOString(),
    });
  });

  it("the record is appended, never rewritten", async () => {
    seedDraft("planned");
    await transition("d1", "generating", SYSTEM, { at: AT, deps: openDeps() });
    await transition("d1", "in_review", SYSTEM, { at: AT, deps: openDeps() });
    const records = draftRow().transitions as TransitionRecord[];
    expect(records.map((r) => `${r.from}→${r.to}`)).toEqual([
      "planned→generating",
      "generating→in_review",
    ]);
  });

  it("the state and the record are one statement — the mover never issues two writes", async () => {
    seedDraft("in_review");
    await transition("d1", "approved", CUSTOMER, { at: AT, deps: openDeps() });
    expect(db.rpcCalls.map((c) => c.fn)).toEqual(["publish_transition"]);
    expect(db.queries.filter((q) => q.verb === "update")).toHaveLength(0);
  });

  it("a page that moved under us is refused, and nothing is claimed about where it is now", async () => {
    seedDraft("in_review");
    // The optimistic lock: the row is no longer in the state the edge was
    // checked against, so the update matches nothing.
    draftRow().state = "approved";
    const result = await transition("d1", "approved", CUSTOMER, { at: AT, deps: openDeps() });
    expect(result.ok).toBe(false);
  });
});

describe("the named guards refuse the edge, each in its turn", () => {
  it("approved → publishing is refused by the switch, and the page is held in approved", async () => {
    seedDraft("approved");
    const result = await transition("d1", "publishing", SYSTEM, {
      at: AT,
      deps: openDeps({ isPublishingOn: async () => false }),
    });
    expect(result).toEqual({
      ok: false,
      refused: "guard",
      failedGuard: "publishing_switch_on",
      state: "approved",
    });
    expect(draftRow().state).toBe("approved");
    expect(draftRow().transitions).toEqual([]);
  });

  it("approved → publishing is refused when the ceilings are full", async () => {
    seedDraft("approved");
    const result = await transition("d1", "publishing", SYSTEM, {
      at: AT,
      deps: openDeps({ hasCeilingRoom: async () => false }),
    });
    expect(result).toMatchObject({ failedGuard: "within_ceilings", state: "approved" });
  });

  it("approved → publishing is refused when the destination is not working", async () => {
    seedDraft("approved");
    const result = await transition("d1", "publishing", SYSTEM, {
      at: AT,
      deps: openDeps({ destinationWorking: async () => false }),
    });
    expect(result).toMatchObject({ failedGuard: "destination_working" });
  });

  it("approved → publishing is refused when the customer has not been told — held, not skipped", async () => {
    seedDraft("approved");
    const result = await transition("d1", "publishing", SYSTEM, {
      at: AT,
      deps: openDeps({ rule: { becomesPublishable: () => true, toldCurrentPair: () => false } }),
    });
    expect(result).toMatchObject({ failedGuard: "customer_told", state: "approved" });
    expect(draftRow().state).toBe("approved");
  });

  it("approved → publishing is refused when the page is not yet publishable", async () => {
    seedDraft("approved");
    const result = await transition("d1", "publishing", SYSTEM, {
      at: AT,
      deps: openDeps({ rule: { becomesPublishable: () => false, toldCurrentPair: () => true } }),
    });
    expect(result).toMatchObject({ failedGuard: "publishable_and_due" });
  });

  it("the first guard in list order wins, and the later ones are never asked", async () => {
    seedDraft("approved");
    const ceilings = vi.fn(async () => true);
    const result = await transition("d1", "publishing", SYSTEM, {
      at: AT,
      deps: openDeps({
        rule: { becomesPublishable: () => false, toldCurrentPair: () => true },
        hasCeilingRoom: ceilings,
      }),
    });
    expect(result).toMatchObject({ failedGuard: "publishable_and_due" });
    expect(ceilings).not.toHaveBeenCalled();
  });

  it("needs_attention → publishing requires draft_passed_hard_rules, and names it when refused", async () => {
    seedDraft("needs_attention", { hard_rules_passed: false });
    const result = await transition("d1", "publishing", SYSTEM, { at: AT, deps: openDeps() });
    expect(result).toMatchObject({ failedGuard: "draft_passed_hard_rules", state: "needs_attention" });
  });

  it("needs_attention → generating is refused for a system actor", async () => {
    seedDraft("needs_attention");
    const result = await transition("d1", "generating", SYSTEM, { at: AT, deps: openDeps() });
    expect(result).toMatchObject({ failedGuard: "customer_initiated" });
  });

  it("needs_attention → generating is refused for a draft that entered review", async () => {
    seedDraft("needs_attention", {
      transitions: [
        { from: "generating", to: "in_review", actor: SYSTEM, at: AT.toISOString() },
        { from: "in_review", to: "skipped", actor: CUSTOMER, at: AT.toISOString() },
      ],
    });
    const result = await transition("d1", "generating", CUSTOMER, { at: AT, deps: openDeps() });
    expect(result).toMatchObject({ failedGuard: "never_entered_review" });
  });

  it("needs_attention → generating is open to a customer whose draft never entered review", async () => {
    seedDraft("needs_attention");
    const result = await transition("d1", "generating", CUSTOMER, { at: AT, deps: openDeps() });
    expect(result).toEqual({ ok: true, state: "generating" });
  });

  it("the stop edges carry no guard, so a customer can always stop a page", async () => {
    for (const [from, to] of [
      ["planned", "skipped"],
      ["in_review", "skipped"],
      ["needs_attention", "skipped"],
    ] as const) {
      seedDraft(from);
      const result = await transition("d1", to, CUSTOMER, {
        at: AT,
        deps: openDeps({
          isPublishingOn: async () => false,
          hasCeilingRoom: async () => false,
          destinationWorking: async () => false,
          rule: PUBLISHABLE_RULE_NOT_BUILT,
        }),
      });
      expect(result, `${from}→${to}`).toEqual({ ok: true, state: to });
    }
  });
});

describe("the default publishable rule refuses until the veto leaf is built", () => {
  it("approved → publishing is held, not taken, and the page keeps its state", async () => {
    seedDraft("approved");
    const result = await transition("d1", "publishing", SYSTEM, {
      at: AT,
      deps: {
        isPublishingOn: async () => true,
        hasCeilingRoom: async () => true,
        destinationWorking: async () => true,
        rule: PUBLISHABLE_RULE_NOT_BUILT,
      },
    });
    expect(result).toMatchObject({ refused: "guard", failedGuard: "publishable_and_due" });
    expect(draftRow().state).toBe("approved");
  });
});

describe("the one log line carries no secret and no sentence", () => {
  it("names the draft, the edge, the actor kind and the outcome — and nothing else", async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((first: unknown) => {
      if (typeof first === "string") lines.push(first);
    });
    seedDraft("in_review");
    await transition("d1", "approved", CUSTOMER, { at: AT, deps: openDeps() });
    spy.mockRestore();

    const record = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(record).toEqual({
      event: "publish_transition",
      draftId: "d1",
      from: "in_review",
      to: "approved",
      actor: "customer",
      outcome: "moved",
    });
    // The actor's own id is not in the line: the record on the row carries
    // who, and the log carries only that it was a person.
    expect(JSON.stringify(record)).not.toContain("u1");
  });
});

describe("a draft that does not exist moves nothing", () => {
  it("is refused without a write", async () => {
    db.seed("drafts", []);
    const result = await transition("nope", "skipped", CUSTOMER, { at: AT, deps: openDeps() });
    expect(result.ok).toBe(false);
    expect(db.rpcCalls).toHaveLength(0);
  });
});
