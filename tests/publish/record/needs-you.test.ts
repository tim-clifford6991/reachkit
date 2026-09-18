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
  needsYouCauseOf,
  needsYouOf,
  restedReasonOf,
  waitsOnDestination,
} from "@/lib/publish/record/needs-you";
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
      })
    ).toEqual({ kind: "rules", rules: ["brand_gap"] });
  });

  it("every other state has none — nothing is wanted of them", () => {
    for (const state of ["planned", "generating", "in_review", "approved", "published"] as const) {
      expect(
        needsYouOf({ state, transitions: [move("generating", "needs_attention", "rules:brand_gap")] }),
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
  it("five causes, five keys, no two the same", () => {
    const keys = Object.values(NEEDS_YOU_COPY);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(COPY[key], key).not.toBe("");
  });

  it("the rules sentence does not claim a delivery, and the delivery one does not blame the writing", () => {
    // The two the fault conflated. A page the rules stopped was never
    // sent; a page waiting on a destination was written correctly.
    expect(COPY[NEEDS_YOU_COPY.rules]).not.toMatch(/deliver/i);
    expect(COPY[NEEDS_YOU_COPY.destination]).not.toMatch(/rules/i);
  });

  it("no cause sentence names a vendor — the destination is named where it is settled", () => {
    for (const key of Object.values(NEEDS_YOU_COPY)) {
      expect(COPY[key], key).not.toMatch(/WordPress/i);
    }
  });
});
