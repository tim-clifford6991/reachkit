// The four standings are four, and each says exactly what it can.
//
// Type-level, because that is where the property lives: merging
// `not_measured` into `not_judgeable` — the tidy-up ADR-071 exists to
// prevent — changes no rendered pixel and passes every runtime test in the
// corpus. The exhaustiveness fixture is what survives the reviewer who
// proposes collapsing two grey rows into one.
import { describe, expect, it } from "vitest";
import {
  NOT_JUDGEABLE_CAUSES,
  type NotJudgeableCause,
  type WeekStanding,
} from "../../../src/lib/opportunities/verdicts/types";
import { AT } from "../fixtures";

function never(value: never): never {
  throw new Error(`unhandled: ${JSON.stringify(value)}`);
}

/** A consumer that handles only three arms does not compile: the fourth
 *  falls through to `never(...)` and TypeScript refuses the argument. This
 *  function is that fixture, written out in full so deleting an arm is a
 *  build failure and not a silently narrower switch. */
function describeStanding(standing: WeekStanding): string {
  switch (standing.kind) {
    case "verdict":
      return standing.verdict;
    case "not_judgeable":
      return standing.cause;
    case "not_measured":
      return "not_measured";
    case "no_week":
      return "no_week";
    default:
      return never(standing);
  }
}

function describeCause(cause: NotJudgeableCause): string {
  switch (cause) {
    case "search_untracked":
    case "unpublished":
    case "page_not_found":
    case "question_left_set":
    case "domain_changed":
      return cause;
    default:
      return never(cause);
  }
}

describe("WeekStanding has exactly four arms and they never collapse into three", () => {
  it("every arm is reachable and distinguishable, and a fifth is not declared", () => {
    const kinds = ["verdict", "not_judgeable", "not_measured", "no_week"] as const;
    expect(new Set(kinds).size).toBe(4);
    expect(
      describeStanding({ kind: "verdict", verdict: "working", measuredAt: AT, movement: null, verifyNote: null })
    ).toBe("working");
    expect(describeStanding({ kind: "not_judgeable", cause: "unpublished", lastJudgedWeek: null })).toBe(
      "unpublished"
    );
    expect(describeStanding({ kind: "not_measured" })).toBe("not_measured");
    expect(describeStanding({ kind: "no_week" })).toBe("no_week");
  });

  it("not_measured and no_week carry no data — there is nothing to write down", () => {
    const notMeasured: Extract<WeekStanding, { kind: "not_measured" }> = { kind: "not_measured" };
    const noWeek: Extract<WeekStanding, { kind: "no_week" }> = { kind: "no_week" };
    expect(Object.keys(notMeasured)).toEqual(["kind"]);
    expect(Object.keys(noWeek)).toEqual(["kind"]);
  });

  it("not_judgeable carries cause and lastJudgedWeek as required members, including the null that means never judged", () => {
    type Arm = Extract<WeekStanding, { kind: "not_judgeable" }>;
    // Both keys are required: an optional `lastJudgedWeek` would make an
    // absent field and "never judged" the same thing, and REQ-063 c6 needs
    // to say the second out loud.
    const required: Record<keyof Omit<Arm, "kind">, true> = { cause: true, lastJudgedWeek: true };
    expect(Object.keys(required).sort()).toEqual(["cause", "lastJudgedWeek"]);
    const neverJudged: Arm = { kind: "not_judgeable", cause: "search_untracked", lastJudgedWeek: null };
    expect(neverJudged.lastJudgedWeek).toBeNull();
  });
});

describe("NotJudgeableCause has exactly five members", () => {
  it("the five, and a switch missing one does not compile", () => {
    expect([...NOT_JUDGEABLE_CAUSES].sort()).toEqual([
      "domain_changed",
      "page_not_found",
      "question_left_set",
      "search_untracked",
      "unpublished",
    ]);
    for (const cause of NOT_JUDGEABLE_CAUSES) expect(describeCause(cause)).toBe(cause);
  });
});
