// tests/publish/record/stalled.test.ts — issue 1184
//
// Why pages stall, counted from each page's own record of why it rested.
import { describe, expect, it } from "vitest";
import { stalledCount } from "@/lib/publish/record/stalled";

function rested(reason: string, state = "needs_attention"): { state: string; transitions: unknown } {
  return { state, transitions: [{ from: "generating", to: "needs_attention", at: "2026-09-29T06:00:00.000Z", reason }] };
}

describe("a week's pages, counted by why they stopped", () => {
  it("counts a stopped page once, and once for each rule that stopped it, most frequent first", () => {
    const count = stalledCount([
      rested("rules:no_private_figure,brand_gap"),
      rested("rules:no_private_figure"),
      rested("step_failed:answerability"),
      // Edited into review afterwards: it still stalled that week.
      rested("rules:brand_gap,no_private_figure", "in_review"),
      { state: "published", transitions: [{ from: "generating", to: "in_review" }] },
    ]);

    expect(count.written).toBe(5);
    expect(count.stopped).toBe(4);
    expect(count.causes).toEqual([
      { cause: "no_private_figure", rule: true, count: 3 },
      { cause: "brand_gap", rule: true, count: 2 },
      { cause: "step/answerability", rule: false, count: 1 },
    ]);
  });

  it("a resting page with no readable record is counted, as unknown", () => {
    expect(stalledCount([{ state: "needs_attention", transitions: null }])).toEqual({
      written: 1,
      stopped: 1,
      causes: [{ cause: "unknown", rule: false, count: 1 }],
    });
  });
});
