// evaluateAcceptance — what a week can and cannot decide, and the two
// causes it may name.
//
// The cases that discriminate are the negative ones: no input to this
// function produces `page_not_found`, `unpublished` or `domain_changed`.
// A positive-only suite is green either way, and the branch that guesses
// one of the three from a missing measurement retires a live page forever
// (ADR-072 decision 5, ADR-085).
import { describe, expect, it } from "vitest";
import { evaluateAcceptance } from "../../../src/lib/opportunities/verdicts/evaluate";
import type { WeekMeasurements } from "../../../src/lib/opportunities/verdicts/types";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import type { Barrier } from "../../../src/lib/opportunities/types";
import type { Measured } from "../../../src/lib/measure/measured";
import { AT, DOMAIN } from "../fixtures";

const WEEK = "2026-08-31";

function week(over: Partial<WeekMeasurements> = {}): WeekMeasurements {
  return {
    week: WEEK,
    measuredAt: AT,
    domain: DOMAIN,
    positions: new Map<string, Measured<number>>(),
    namesCustomer: new Map<string, Measured<boolean>>(),
    gatesCleared: new Map<Barrier, Measured<boolean>>(),
    ...over,
  };
}

describe("top20 — the customer's own place for the recorded search", () => {
  it("a measured place decides the test and passes it", () => {
    const out = evaluateAcceptance({
      acceptance: { form: "top20", query: "q" },
      week: week({ positions: new Map([["q", measured(4, AT)]]) }),
    });
    expect(out).toEqual({ decided: true, passes: true, measuredAt: AT });
  });

  it("a measured zero — the SERP was read and the customer holds no place — decides it and fails it", () => {
    const out = evaluateAcceptance({
      acceptance: { form: "top20", query: "q" },
      week: week({ positions: new Map([["q", measuredZero(0, AT)]]) }),
    });
    expect(out).toEqual({ decided: true, passes: false, measuredAt: AT });
  });

  it("a search the week no longer measures at all returns search_untracked — an absent key, never an unmeasured value", () => {
    expect(evaluateAcceptance({ acceptance: { form: "top20", query: "q" }, week: week() })).toEqual({
      decided: false,
      cause: "search_untracked",
    });
  });

  it("a search still tracked whose SERP the week could not read is not_measured, and is never a cause", () => {
    const out = evaluateAcceptance({
      acceptance: { form: "top20", query: "q" },
      week: week({ positions: new Map([["q", unmeasured<number>("undeterminable", AT)]]) }),
    });
    // The distinction this whole subsystem exists to keep: one missed
    // request is a week's miss, not a page retired forever.
    expect(out).toEqual({ decided: false, because: "not_measured" });
  });
});

describe("named_on — whether this week's AI answer names the customer", () => {
  it("a measured answer decides it, both ways", () => {
    expect(
      evaluateAcceptance({
        acceptance: { form: "named_on", question: "p" },
        week: week({ namesCustomer: new Map([["p", measured(true, AT)]]) }),
      })
    ).toEqual({ decided: true, passes: true, measuredAt: AT });
    expect(
      evaluateAcceptance({
        acceptance: { form: "named_on", question: "p" },
        week: week({ namesCustomer: new Map([["p", measuredZero(false, AT)]]) }),
      })
    ).toEqual({ decided: true, passes: false, measuredAt: AT });
  });

  it("a question that left the tracked set returns question_left_set", () => {
    expect(
      evaluateAcceptance({ acceptance: { form: "named_on", question: "p" }, week: week() })
    ).toEqual({ decided: false, cause: "question_left_set" });
  });

  it("the two causes are returned distinctly and neither is substituted for the other", () => {
    const untracked = evaluateAcceptance({
      acceptance: { form: "top20", query: "q" },
      week: week({ namesCustomer: new Map([["q", measured(true, AT)]]) }),
    });
    const left = evaluateAcceptance({
      acceptance: { form: "named_on", question: "q" },
      week: week({ positions: new Map([["q", measured(1, AT)]]) }),
    });
    expect(untracked).toEqual({ decided: false, cause: "search_untracked" });
    expect(left).toEqual({ decided: false, cause: "question_left_set" });
  });
});

describe("gate_cleared — whether the barrier is cleared", () => {
  it("a measured gate decides it", () => {
    expect(
      evaluateAcceptance({
        acceptance: { form: "gate_cleared", gate: "noindex" },
        week: week({ gatesCleared: new Map<Barrier, Measured<boolean>>([["noindex", measured(true, AT)]]) }),
      })
    ).toEqual({ decided: true, passes: true, measuredAt: AT });
  });

  it("a barrier absent from the week's gates is undecided rather than failing — and names no cause", () => {
    // A barrier belongs to a closed set and cannot leave a tracked set, so
    // an absent key here is a gate the week did not look at.
    expect(
      evaluateAcceptance({ acceptance: { form: "gate_cleared", gate: "js_only" }, week: week() })
    ).toEqual({ decided: false, because: "not_measured" });
  });
});

describe("the three causes this function must never produce", () => {
  const forms = [
    { form: "top20", query: "q" },
    { form: "named_on", question: "p" },
    { form: "gate_cleared", gate: "noindex" as Barrier },
  ] as const;

  const readings: Measured<never>[] | Measured<number>[] = [
    measured(1, AT),
    measuredZero(0, AT),
    unmeasured<number>("undeterminable", AT),
    unmeasured<number>("not_attempted", AT),
  ];

  it("an exhaustive sweep of the fixture space never returns page_not_found, unpublished or domain_changed", () => {
    const seen = new Set<string>();
    for (const acceptance of forms) {
      for (const present of [false, true]) {
        for (const reading of readings) {
          const key = "q";
          const positions = new Map<string, Measured<number>>();
          const namesCustomer = new Map<string, Measured<boolean>>();
          const gatesCleared = new Map<Barrier, Measured<boolean>>();
          if (present) {
            positions.set(key, reading);
            namesCustomer.set("p", reading.kind === "unmeasured" ? reading : measured(true, AT));
            gatesCleared.set("noindex", reading.kind === "unmeasured" ? reading : measured(true, AT));
          }
          const out = evaluateAcceptance({
            acceptance,
            week: week({ positions, namesCustomer, gatesCleared }),
          });
          if (!out.decided && "cause" in out) seen.add(out.cause);
        }
      }
    }
    expect([...seen].sort()).toEqual(["question_left_set", "search_untracked"]);
    expect(seen.has("page_not_found")).toBe(false);
    expect(seen.has("unpublished")).toBe(false);
    expect(seen.has("domain_changed")).toBe(false);
  });

  it("the recorded test is never rewritten — the module holds no write path to opportunities", () => {
    const acceptance = { form: "top20", query: "q" } as const;
    const before = JSON.stringify(acceptance);
    evaluateAcceptance({ acceptance, week: week() });
    expect(JSON.stringify(acceptance)).toBe(before);
  });
});
