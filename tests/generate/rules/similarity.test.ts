// tests/generate/rules/similarity.test.ts — BUILD §8 hard rule 5: the one
// recorded similarity measure, and the gate it feeds.
//
// The measure has to be *one* measure: the same pair always returns the
// same number, on any machine and in any process, so a verdict is
// reproducible. And it has to be un-tunable: there is no options parameter
// and no threshold argument, so no per-customer threshold can arrive.
import "../env";
import { describe, expect, it } from "vitest";
import { NEAR_DUPLICATE_MAX, SHINGLE_SIZE } from "../../../src/lib/config/constants";
import { similarity } from "../../../src/lib/generate/rules/similarity";
import { checkNearDuplicate } from "../../../src/lib/generate/rules/nearduplicate";
import { emptyComparison } from "../fixtures";

const A = "The seat limit is the constraint teams notice last and feel most, every single time.";
const B = "A seat limit is the constraint that teams notice last and that they feel the most.";

describe("similarity — one fixed, recorded measure", () => {
  it("takes exactly two strings: there is no options parameter a threshold could arrive through", () => {
    expect(similarity.length).toBe(2);
  });

  it("is symmetric", () => {
    expect(similarity(A, B)).toBe(similarity(B, A));
  });

  it("returns 1 for identical text and 0 for disjoint text", () => {
    expect(similarity(A, A)).toBe(1);
    expect(similarity("alpha beta gamma delta epsilon zeta", "one two three four five six")).toBe(0);
  });

  it("is unchanged by letter case and punctuation", () => {
    const shouted = A.toUpperCase().replace(/[,.]/g, " — ");
    expect(similarity(A, shouted)).toBe(1);
  });

  it("is stable: the same pair gives the same number every time it is asked", () => {
    const first = similarity(A, B);
    expect(similarity(A, B)).toBe(first);
    expect(similarity(A, B)).toBe(first);
  });

  it("a fixture pair is pinned to a fixed value, so a changed shingle size shows as a changed number", () => {
    expect(SHINGLE_SIZE).toBe(5);
    // Two texts that share one five-word window out of eleven and nine.
    const left = "one two three four five six seven eight nine ten eleven twelve fourteen fifteen sixteen";
    const right = "one two three four five alpha beta gamma delta epsilon zeta eta theta";
    expect(similarity(left, right)).toBeCloseTo(1 / 19, 10);
  });

  it("two empty texts are identical; an empty text shares nothing with a written one", () => {
    expect(similarity("", "")).toBe(1);
    expect(similarity("", A)).toBe(0);
  });
});

describe("§8 hard rule 5 — the near-duplicate gate", () => {
  const member = { ref: "page-1", title: "Choosing a tool", rendered: A };

  it("a candidate at or above the threshold fails, carrying the page it duplicated", () => {
    const failure = checkNearDuplicate({
      rendered: A,
      comparison: emptyComparison({ queued: [member] }),
    });
    expect(failure?.rule).toBe("near_duplicate");
    expect(failure?.detail).toEqual({
      rule: "near_duplicate",
      duplicateOf: { kind: "queued", ref: "page-1", title: "Choosing a tool" },
      similarity: 1,
    });
  });

  it("the threshold is §8's 85 per cent", () => {
    expect(NEAR_DUPLICATE_MAX).toBe(0.85);
  });

  it("a candidate below the threshold passes", () => {
    expect(
      checkNearDuplicate({ rendered: B, comparison: emptyComparison({ queued: [member] }) })
    ).toBeNull();
  });

  it("a duplicate of a measured page carries `measured`, and of a published page `published`", () => {
    expect(
      checkNearDuplicate({ rendered: A, comparison: emptyComparison({ measured: [member] }) })?.detail
    ).toMatchObject({ duplicateOf: { kind: "measured" } });
    expect(
      checkNearDuplicate({ rendered: A, comparison: emptyComparison({ published: [member] }) })?.detail
    ).toMatchObject({ duplicateOf: { kind: "published" } });
  });

  it("published outranks measured outranks queued, so a candidate duplicating two sets always names the same one", () => {
    const failure = checkNearDuplicate({
      rendered: A,
      comparison: emptyComparison({ published: [member], measured: [member], queued: [member] }),
    });
    expect(failure?.detail).toMatchObject({ duplicateOf: { kind: "published" } });
  });

  it("an empty comparison set fails nothing — a customer's first page duplicates nothing", () => {
    expect(checkNearDuplicate({ rendered: A, comparison: emptyComparison() })).toBeNull();
  });
});
