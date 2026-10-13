// tests/app/draft/checks.test.ts — SPEC §7 (2026-10-10, issue 1394)
//
// The draft screen's Checks list states outcomes. A row is a pass only
// where a recorded run asked the rule and it held, and the headline's total
// is the rule list's own length.
import { describe, expect, it } from "vitest";
import { recordedChecks } from "@/lib/generate/record";
import { HARD_RULES, NO_CHECKS, SWITCHED_RULES, type HardRule } from "@/lib/generate/rules/types";
import { COPY } from "@/lib/presentation/copy";
import { CHECK_GROUPS, CHECKS, checkList } from "@/app/(account)/app/draft/[draftId]/checks";

const ASKED = HARD_RULES.filter((rule) => rule !== "honest_row" && rule !== "fit_claim");
const RUN = recordedChecks([], { asked: ASKED, fixed: ["traceable_numerals"] });
const PAGE = { grounded: true, claim: { state: "passed", at: new Date(0) }, recorded: RUN } as const;

const statusOf = (list: ReturnType<typeof checkList>, rule: HardRule) =>
  list.rows.find((row) => row.rule === rule)?.status;

describe("every hard rule has a sentence", () => {
  it("each rule has its own copy key, written, and a group the note lists", () => {
    const keys = HARD_RULES.map((rule) => CHECKS[rule].key);
    expect(new Set(keys).size).toBe(HARD_RULES.length);
    for (const rule of HARD_RULES) {
      expect(COPY[CHECKS[rule].key], rule).toBeTruthy();
      expect(COPY[CHECKS[rule].key], rule).not.toContain("TODO(copy)");
      expect(CHECK_GROUPS.map((entry) => entry.group)).toContain(CHECKS[rule].group);
    }
  });
});

describe("the headline counts what the run recorded", () => {
  it("the total is the rule list's length, and a rule the run was not asked is not a pass", () => {
    const list = checkList(PAGE);
    expect(list.rows.map((row) => row.rule)).toEqual([...HARD_RULES]);
    expect(list.counts).toEqual({
      passed: HARD_RULES.length - 2,
      total: HARD_RULES.length,
      skipped: 2,
      failed: 0,
      fixed: 1,
    });
    expect(statusOf(list, "honest_row")).toBe("skipped");
  });

  it("a rule the run failed is drawn as failed, and is not counted as fixed", () => {
    const recorded = recordedChecks([{ rule: "traceable_numerals" }], { asked: ASKED, fixed: ["traceable_numerals"] });
    const list = checkList({ ...PAGE, recorded });
    expect(statusOf(list, "traceable_numerals")).toBe("failed");
    expect(list.counts).toMatchObject({ passed: HARD_RULES.length - 3, failed: 1, fixed: 0 });
  });

  it("a row written before the run was recorded states no count and says nothing of a switched rule", () => {
    const list = checkList({ ...PAGE, recorded: recordedChecks([], null) });
    expect(list.counts).toBeNull();
    for (const rule of SWITCHED_RULES.filter((switched) => switched !== "do_not_claim")) {
      expect(statusOf(list, rule), rule).toBeUndefined();
    }
    expect(statusOf(list, "near_duplicate")).toBe("passed");
  });

  it("text no battery has checked draws only the two rules the screen answers itself", () => {
    const list = checkList({ ...PAGE, recorded: NO_CHECKS });
    expect(list.rows.map((row) => row.rule)).toEqual(["grounding", "do_not_claim"]);
  });
});

describe("the two live rules follow the page as it stands", () => {
  it("an edit that removed the fact removes the row — the mark and the row are one answer", () => {
    expect(statusOf(checkList({ ...PAGE, grounded: false }), "grounding")).toBeUndefined();
  });

  it("the never-claim row is the claim check's own state, and only a pass is a pass", () => {
    const states = [
      [{ state: "outstanding" }, "pending"],
      [{ state: "nothing_to_check" }, "skipped"],
      [{ state: "failed", matchedEntry: "we are the cheapest", at: new Date(0) }, "failed"],
    ] as const;
    for (const [claim, status] of states) {
      expect(statusOf(checkList({ ...PAGE, claim }), "do_not_claim"), claim.state).toBe(status);
    }
  });
});
