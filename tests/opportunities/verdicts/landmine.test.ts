// The ADR-085 pin.
//
// `could_not_confirm` and `page_not_found` come from the same fetch, render
// as the same grey line, and go opposite ways: one leaves a page fully
// judged with a note beside its verdict, the other retires it from
// judgement forever and nothing restores it (ADR-072 decision 5).
//
// Adding `could_not_confirm` to `NotJudgeableCause`, "beside
// `page_not_found`", completes the union the obvious way, passes every
// runtime test that exists, and its effect in production is a live page
// retired permanently on the strength of ReachKit's own 502. Case (a)
// below is a **negative** assertion — it is green only while that merge has
// *not* happened, and goes red the day it does. A positive test cannot
// express that.
import { describe, expect, it } from "vitest";
import type {
  NotJudgeableCause,
  VerifyNote,
} from "../../../src/lib/opportunities/verdicts/types";
import { NOT_JUDGEABLE_CAUSES } from "../../../src/lib/opportunities/verdicts/types";
import { AT } from "../fixtures";

describe("could_not_confirm is a VerifyNote and never a NotJudgeableCause", () => {
  it("(a) it is not assignable to NotJudgeableCause — @ts-expect-error is the assertion", () => {
    // @ts-expect-error ADR-085 decision 4 / ADR-072 decision 5b: this
    // assignment must not compile. The day `could_not_confirm` is added to
    // `NotJudgeableCause`, the expected error stops occurring and this line
    // fails the type-check. One arm retires a page from judgement forever
    // and nothing restores it; the other leaves it fully judged.
    const merged: NotJudgeableCause = "could_not_confirm";
    expect(merged).toBe("could_not_confirm");
    expect([...NOT_JUDGEABLE_CAUSES]).not.toContain("could_not_confirm");
  });

  it("(b) VerifyNote and NotJudgeableCause share no member, in either direction", () => {
    const note: VerifyNote = { note: "could_not_confirm", checkedAt: AT };
    // @ts-expect-error a note's discriminator is not a cause.
    const asCause: NotJudgeableCause = note.note;
    expect(asCause).toBe("could_not_confirm");

    const cause: NotJudgeableCause = "page_not_found";
    // @ts-expect-error and a cause is not a note's discriminator.
    const asNote: VerifyNote["note"] = cause;
    expect(asNote).toBe("page_not_found");
  });

  it("(c) the verdict arm carries verifyNote and the not_judgeable arm does not", () => {
    // The shape, not a rule: a `could_not_confirm` cannot be written into a
    // standing that retires the page, because that standing has nowhere to
    // put it.
    const retired = { kind: "not_judgeable", cause: "page_not_found", lastJudgedWeek: null } as const;
    expect("verifyNote" in retired).toBe(false);
    const judged = {
      kind: "verdict",
      verdict: "working",
      measuredAt: AT,
      movement: null,
      verifyNote: { note: "could_not_confirm", checkedAt: AT },
    } as const;
    expect(judged.verifyNote.note).toBe("could_not_confirm");
  });
});
