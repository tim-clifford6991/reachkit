// tests/publish/record/needs-you.test.ts — BUILD §9, issue 880
//
// Why a page needs the customer, from the page's own record.
//
// The mutation these rows kill is the one the owner walked into on
// 2026-09-18: answering "why does this page need me?" from the page's
// *stage*. Every page in `needs_attention` was told to reconnect
// WordPress — including one the §8 hard rules stopped, on a site with no
// WordPress anywhere. So the discriminating rows here are the two that
// read the same stage and have opposite answers.
import { describe, expect, it } from "vitest";
import {
  critical,
  needsYouCauseOf,
  needsYouOf,
  restedReasonOf,
  waitsOnDestination,
} from "@/lib/publish/record/needs-you";
import type { transition } from "@/lib/publish/machine";
import { NEEDS_YOU_COPY } from "@/lib/publish/record/lines";
import { COPY } from "@/lib/presentation/copy";

/** One move, as §9 appends it. */
function move(from: string, to: string, reason?: string): Record<string, unknown> {
  return { from, to, at: "2026-09-18T06:00:00.000Z", ...(reason === undefined ? {} : { reason }) };
}

describe("the reason is the page's last move into needs_attention", () => {
  it("reads it off the transitions, newest first", () => {
    expect(
      restedReasonOf([
        move("generating", "needs_attention", "rules:brand_gap"),
        move("needs_attention", "generating"),
        move("generating", "needs_attention", "step_failed:answerability"),
      ])
    ).toBe("step_failed:answerability");
  });

  it("a page that never rested has no reason, and a malformed column is not a throw", () => {
    expect(restedReasonOf([move("generating", "in_review")])).toBeNull();
    expect(restedReasonOf(null)).toBeNull();
    expect(restedReasonOf("not a list")).toBeNull();
    expect(restedReasonOf([null, 7, { to: "needs_attention" }])).toBeNull();
  });
});

describe("the four movers, each read as what it is", () => {
  it("the §8 hard rules that stopped the writing — the owner's own page", () => {
    // draft 290d12ba, 2026-09-19, "Best SEO Software".
    expect(needsYouCauseOf("rules:no_private_figure,no_unsourced_testimonial,brand_gap")).toEqual({
      kind: "rules",
      rules: ["no_private_figure", "no_unsourced_testimonial", "brand_gap"],
    });
  });

  it("a step that could not run (issue 813)", () => {
    expect(needsYouCauseOf("step_failed:claim_check")).toEqual({ kind: "step", step: "claim_check" });
  });

  it("a delivery no retry clears, and a publish tried to exhaustion", () => {
    expect(needsYouCauseOf("reason_needs_customer")).toEqual({ kind: "destination" });
    expect(needsYouCauseOf("retries_exhausted")).toEqual({ kind: "delivery" });
  });

  it("a reason this build does not know claims nothing about why", () => {
    expect(needsYouCauseOf("something_else")).toEqual({ kind: "unknown" });
    expect(needsYouCauseOf(null)).toEqual({ kind: "unknown" });
    // And never the loudest of the four: an unknown cause is not a
    // destination problem, so it earns no reconnect below.
    expect(waitsOnDestination(needsYouCauseOf(null))).toBe(false);
  });

  it("a rules list that is empty is still a rules stop, not an unknown one", () => {
    expect(needsYouCauseOf("rules:")).toEqual({ kind: "rules", rules: [] });
  });
});

describe("only a page that rests needing the customer has a cause", () => {
  it("`needs_attention` has one", () => {
    expect(
      needsYouOf({
        state: "needs_attention",
        transitions: [move("generating", "needs_attention", "rules:brand_gap")],
        meta: null,
      })
    ).toEqual({ kind: "rules", rules: ["brand_gap"] });
  });

  it("every other state has none — nothing is wanted of them", () => {
    for (const state of ["planned", "generating", "in_review", "approved", "published"] as const) {
      expect(
        needsYouOf({ state, transitions: [move("generating", "needs_attention", "rules:brand_gap")], meta: null }),
        state
      ).toBeNull();
    }
  });
});

describe("what waits on the destination, and what does not", () => {
  it("the two delivery causes do", () => {
    expect(waitsOnDestination({ kind: "destination" })).toBe(true);
    expect(waitsOnDestination({ kind: "delivery" })).toBe(true);
  });

  it("a page the rules or a step stopped does not — it was never sent anywhere", () => {
    expect(waitsOnDestination({ kind: "rules", rules: ["brand_gap"] })).toBe(false);
    expect(waitsOnDestination({ kind: "step", step: "answerability" })).toBe(false);
    expect(waitsOnDestination({ kind: "unknown" })).toBe(false);
    expect(waitsOnDestination(null)).toBe(false);
  });
});

describe("one sentence per cause, and every one of them written", () => {
  it("a new page that adds too little is its own cause, not a step that failed (issue 1143)", () => {
    expect(needsYouCauseOf("step_failed:adds")).toEqual({ kind: "adds" });
    expect(waitsOnDestination({ kind: "adds" })).toBe(false);
  });

  it("a page held for being too close to one elsewhere is its own cause, and waits on no destination (issue 1144)", () => {
    expect(needsYouCauseOf("step_failed:elsewhere")).toEqual({ kind: "elsewhere" });
    expect(waitsOnDestination({ kind: "elsewhere" })).toBe(false);
  });

  it("a short pack is its own cause and names what it lacked, by handle (issue 1252)", () => {
    expect(needsYouCauseOf("step_failed:pack:options,own_price")).toEqual({ kind: "pack", missing: ["options", "own_price"] });
    expect(needsYouCauseOf("step_failed:pack")).toEqual({ kind: "pack", missing: [] });
    expect(waitsOnDestination({ kind: "pack", missing: [] })).toBe(false);
  });

  it("every cause has its own key, no two the same", () => {
    const keys = Object.values(NEEDS_YOU_COPY);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(COPY[key], key).not.toBe("");
  });

  it("the delivery sentence does not blame the writing", () => {
    expect(COPY[NEEDS_YOU_COPY.destination]).not.toMatch(/rules/i);
  });

  it("no cause sentence names a vendor — the destination is named where it is settled", () => {
    for (const key of Object.values(NEEDS_YOU_COPY)) {
      expect(COPY[key], key).not.toMatch(/WordPress/i);
    }
  });
});

// Owner O7: only a cause critical for the customer is told.
describe("what is critical for the customer", () => {
  const NOW = new Date("2026-10-31T08:00:00.000Z");
  const rested = (reason: string, at: string) => ({ from: "failed", to: "needs_attention", reason, at });

  it.each([
    ...["reason_needs_customer", "live_edit", "something_new"].map((reason) => [reason, true] as const),
    ...["rules:brand_gap", "step_failed:claim_check", "step_failed:adds", "step_failed:elsewhere", "step_failed:pack:buyer_questions"].map((reason) => [reason, false] as const),
  ])("%s is critical: %s (a destination to fix, their words, an unread cause; never a writing stop)", (reason, told) => {
    expect(critical(needsYouCauseOf(reason), NOW)).toBe(told);
    expect(critical(null, NOW)).toBe(false);
  });

  it("a publish tried to exhaustion becomes critical after seven days, counted from its first rest", () => {
    const transitions = (first: string) => [rested("retries_exhausted", first), { from: "needs_attention", to: "publishing", at: "2026-10-30T08:00:00.000Z" }, rested("retries_exhausted", "2026-10-30T08:05:00.000Z")];
    const cause = (first: string) => needsYouOf({ state: "needs_attention", transitions: transitions(first), meta: null });
    expect(cause("2026-10-24T08:00:00.000Z")).toEqual({ kind: "delivery", since: "2026-10-24T08:00:00.000Z" });
    expect(critical(cause("2026-10-24T08:00:00.000Z"), NOW)).toBe(false);
    expect(critical(cause("2026-10-24T07:59:00.000Z"), NOW)).toBe(true);
  });

  it("an unclassified reason into needs_attention does not compile; any reason into another state does", () => {
    type Into<S extends Parameters<typeof transition>[1]> = NonNullable<Parameters<typeof transition<S>>[3]>;
    const classified: Into<"needs_attention">[] = [{ reason: "rules:brand_gap" }, { reason: "retries_exhausted" }, { reason: "live_edit" }];
    // @ts-expect-error a cause nobody classified
    const unclassified: Into<"needs_attention"> = { reason: "rate_limited" };
    const elsewhere: Into<"publishing"> = { reason: "publish/execute" };
    expect([...classified, unclassified, elsewhere]).toHaveLength(5);
  });
});
