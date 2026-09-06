// tests/publish/machine/table.test.ts — BUILD §9's transition table.
//
// The table is data, so these are property assertions over it rather than
// behavioural ones: the ten states, the fifteen edges member by member, the
// two terminal states derived rather than restated, and the coupling
// between `GUARDS` and `TRANSITIONS` that keeps a guard from being named on
// an edge that does not exist.
//
// The archived plan is WO-207.
import { describe, expect, it } from "vitest";
import {
  GUARDS,
  STATES,
  TERMINAL,
  TRANSITIONS,
  edgeKey,
  type GuardId,
} from "@/lib/publish/machine/table";
import type { State } from "@/lib/publish/types";

/** BUILD §9, quoted — the diagram this table transcribes:
 *
 *   planned → generating → in_review → approved → publishing → published
 *                             ↓ veto                  ↓ fail
 *                          skipped            failed → retry ×3 → needs_attention
 *   published → unpublished (always available)
 */
const FIFTEEN: [State, State][] = [
  ["planned", "generating"],
  ["planned", "skipped"],
  ["generating", "in_review"],
  ["generating", "needs_attention"],
  ["in_review", "approved"],
  ["in_review", "skipped"],
  ["approved", "publishing"],
  ["publishing", "published"],
  ["publishing", "failed"],
  ["failed", "publishing"],
  ["failed", "needs_attention"],
  ["needs_attention", "publishing"],
  ["needs_attention", "generating"],
  ["needs_attention", "skipped"],
  ["published", "unpublished"],
];

describe("STATES is exactly §9's ten", () => {
  it("names all ten and no eleventh", () => {
    expect([...STATES].sort()).toEqual(
      [
        "approved",
        "failed",
        "generating",
        "in_review",
        "needs_attention",
        "planned",
        "published",
        "publishing",
        "skipped",
        "unpublished",
      ].sort()
    );
  });

  it("has no duplicate member", () => {
    expect(new Set(STATES).size).toBe(STATES.length);
  });
});

describe("TRANSITIONS is exactly the fifteen", () => {
  it.each(FIFTEEN)("%s → %s is a member", (from, to) => {
    expect(TRANSITIONS.some(([f, t]) => f === from && t === to)).toBe(true);
  });

  it("there is no sixteenth edge", () => {
    expect(TRANSITIONS.length).toBe(15);
    for (const [from, to] of TRANSITIONS) {
      expect(FIFTEEN.some(([f, t]) => f === from && t === to)).toBe(true);
    }
  });

  it("no edge appears twice", () => {
    const keys = TRANSITIONS.map(([from, to]) => edgeKey(from, to));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every endpoint of every edge is one of the ten states", () => {
    for (const [from, to] of TRANSITIONS) {
      expect(STATES).toContain(from);
      expect(STATES).toContain(to);
    }
  });

  it("nothing returns to planned — a page the pipeline has started is never un-started", () => {
    expect(TRANSITIONS.some(([, to]) => to === "planned")).toBe(false);
  });
});

describe("skipped and unpublished are the only states from which no change is possible", () => {
  it("TERMINAL is exactly the set of states that are the source of no edge — derived, not a second list", () => {
    const sources = new Set(TRANSITIONS.map(([from]) => from));
    const stranded = STATES.filter((state) => !sources.has(state));
    expect([...stranded].sort()).toEqual([...TERMINAL].sort());
  });

  it("neither terminal state is the source of any edge, so a page the customer stopped never goes to a destination", () => {
    for (const state of TERMINAL) {
      expect(TRANSITIONS.some(([from]) => from === state)).toBe(false);
    }
  });

  it("every non-terminal state has at least one exit, so no page is left in a state it has no way out of", () => {
    for (const state of STATES) {
      if (TERMINAL.includes(state)) continue;
      expect(TRANSITIONS.some(([from]) => from === state), state).toBe(true);
    }
  });

  it("needs_attention has a way out whichever route brought a page to it", () => {
    const exits = TRANSITIONS.filter(([from]) => from === "needs_attention").map(([, to]) => to);
    expect([...exits].sort()).toEqual(["generating", "publishing", "skipped"]);
  });
});

describe("GUARDS names guards only on edges that exist", () => {
  const NAMED: readonly GuardId[] = [
    "draft_passed_hard_rules",
    "never_entered_review",
    "customer_initiated",
    "publishable_and_due",
    "customer_told",
    "publishing_switch_on",
    "within_ceilings",
    "destination_working",
  ];

  it("every key of GUARDS is one of the fifteen edges", () => {
    const edges = new Set(TRANSITIONS.map(([from, to]) => edgeKey(from, to)));
    for (const key of Object.keys(GUARDS)) expect(edges.has(key)).toBe(true);
  });

  it("every guard named in GUARDS is one of the eight", () => {
    for (const guards of Object.values(GUARDS)) {
      for (const guard of guards) expect(NAMED).toContain(guard);
    }
  });

  it("every one of the eight is actually placed on an edge — a guard on no edge is a guard that never runs", () => {
    const placed = new Set(Object.values(GUARDS).flatMap((g) => [...g]));
    for (const guard of NAMED) expect(placed.has(guard), guard).toBe(true);
  });

  it("every edge whose target is publishing carries the switch, the ceilings and the destination", () => {
    const intoPublishing = TRANSITIONS.filter(([, to]) => to === "publishing");
    expect(intoPublishing.length).toBe(3);
    for (const [from, to] of intoPublishing) {
      const guards = GUARDS[edgeKey(from, to)] ?? [];
      expect(guards, `${from}→${to}`).toContain("publishing_switch_on");
      expect(guards, `${from}→${to}`).toContain("within_ceilings");
      expect(guards, `${from}→${to}`).toContain("destination_working");
    }
  });

  it("needs_attention → generating is open only to a customer, and only before review", () => {
    expect(GUARDS[edgeKey("needs_attention", "generating")]).toEqual([
      "never_entered_review",
      "customer_initiated",
    ]);
  });

  it("needs_attention → publishing is open only to a draft that passed the hard rules", () => {
    expect(GUARDS[edgeKey("needs_attention", "publishing")]).toContain("draft_passed_hard_rules");
  });

  it("approved → publishing carries the telling, so no page publishes on a pair the customer was never told about", () => {
    expect(GUARDS[edgeKey("approved", "publishing")]).toContain("customer_told");
  });

  it("an edge with no entry carries no guard — the stop edges are open", () => {
    expect(GUARDS[edgeKey("in_review", "skipped")]).toBeUndefined();
    expect(GUARDS[edgeKey("planned", "skipped")]).toBeUndefined();
    expect(GUARDS[edgeKey("published", "unpublished")]).toBeUndefined();
  });
});
