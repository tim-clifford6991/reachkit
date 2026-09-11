// tests/app/draft/checks.test.ts — UI-SPEC S16, BUILD §8
//
// The Decide rail's Checks list is a list of *outcomes*. This file holds
// the one rule that makes that true: a row exists only where this product
// decided the check, and never because a draft's state implies it must
// have passed.
import { describe, expect, it } from "vitest";
import { HARD_RULES } from "@/lib/generate/rules/types";
import { COPY } from "@/lib/presentation/copy";
import {
  CHECK_COPY_KEY,
  RAIL_CHECKS,
  RECORDED_CHECKS,
  checkRows,
} from "@/app/(account)/app/draft/[draftId]/checks";

const GROUNDED = {
  grounded: true,
  groundedUrl: "https://example.com/pricing",
  claim: { state: "passed", at: new Date(0) },
  recorded: RECORDED_CHECKS,
} as const;

describe("S16 — the four rules the rail names are §8's own", () => {
  it("every rail check is a member of §8's closed hard-rule list", () => {
    for (const rule of RAIL_CHECKS) expect(HARD_RULES).toContain(rule);
  });

  it("each carries a sentence, and none of them is unwritten", () => {
    for (const rule of RAIL_CHECKS) {
      expect(COPY[CHECK_COPY_KEY[rule]], rule).not.toBe("");
      expect(COPY[CHECK_COPY_KEY[rule]], rule).not.toBe("TODO(copy)");
    }
  });
});

describe("a row is an outcome, never an inference", () => {
  it("a page with all four decided draws all four, in the set's order", () => {
    expect(checkRows(GROUNDED).map((row) => row.rule)).toEqual([...RAIL_CHECKS]);
  });

  it("the grounded row states the fact and the source it stands on", () => {
    expect(checkRows(GROUNDED)[0]?.vars).toEqual({ facts: 1, sources: 1 });
  });

  it("a grounding with no address recorded says one fact and no source", () => {
    const rows = checkRows({ ...GROUNDED, groundedUrl: "" });
    expect(rows[0]?.vars).toEqual({ facts: 1, sources: 0 });
  });

  it("an edit that removed the fact removes the row — the mark and the row are one answer", () => {
    const rows = checkRows({ ...GROUNDED, grounded: false });
    expect(rows.map((row) => row.rule)).not.toContain("grounding");
  });

  it("a claim check that has not passed draws no do-not-claim row, in any of its three other states", () => {
    for (const claim of [
      { state: "outstanding" },
      { state: "nothing_to_check" },
      { state: "failed", matchedEntry: "we are the cheapest", at: new Date(0) },
    ] as const) {
      const rows = checkRows({ ...GROUNDED, claim });
      expect(rows.map((row) => row.rule), claim.state).not.toContain("do_not_claim");
    }
  });

  it("a draft generation recorded no battery for draws neither of the two recorded rules", () => {
    const rows = checkRows({ ...GROUNDED, recorded: [] });
    expect(rows.map((row) => row.rule)).toEqual(["grounding", "do_not_claim"]);
  });

  it("and one it recorded half of draws the half — never the other", () => {
    const rows = checkRows({ ...GROUNDED, recorded: ["near_duplicate"] });
    expect(rows.map((row) => row.rule)).toEqual([
      "grounding",
      "do_not_claim",
      "near_duplicate",
    ]);
  });
});
