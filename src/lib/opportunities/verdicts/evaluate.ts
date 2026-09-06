// BUILD §9 — can this week decide the test this page was created with?
//
// Pure: no clock, no database, no network, no model. It reads the recorded
// `Acceptance` and never writes it — §7's test is written once at creation
// (`opportunities.acceptance`'s own `before update` trigger is that
// invariant), including where it can no longer be evaluated. REQ-063 c6:
// "its recorded test is not rewritten to something that could be judged."
//
// **It produces exactly two of the five causes** — `search_untracked` and
// `question_left_set`, each read as an *absent key* in the week's
// measurements. The other three are the caller's, from stored state this
// function's inputs do not carry: `unpublished` is the publication's own
// state, `domain_changed` is the publication's domain against the week's,
// and `page_not_found` is what the one check at 24 hours recorded.
//
// **A code path here that returns `page_not_found` is the ADR-085 merge
// arriving by the back door.** This module makes no request and reads no
// publication row, so it cannot know a page's absence; a value it cannot
// observe is a value it must not name. The negative sweep in
// `evaluate.test.ts` is what holds that line — a positive-only suite is
// green either way.
import type { Measured } from "@/lib/measure/measured";
import type { Acceptance } from "../types";
import type { NotJudgeableCause, WeekMeasurements } from "./types";

/**
 * What one week can say about one recorded test. **Three arms, not two.**
 *
 * WO-204 declared this as a two-arm return — decided, or a
 * `NotJudgeableCause` — and a two-arm return cannot express REQ-063 c5's
 * transient case at all: "each remaining page stating that it was not
 * measured this week" is `not_measured`, which ADR-071 forbids merging
 * into `not_judgeable` precisely because one is a week's miss and the
 * other retires a page forever. Folding the two would write a transient
 * miss down as a permanent state, which is the whole of what this
 * subsystem is shaped to prevent. So the third arm is declared, and the
 * `cause` arm still carries only the two causes this function can observe.
 */
export type Evaluation =
  | { readonly decided: true; readonly passes: boolean; readonly measuredAt: Date }
  /** REQ-063 c5 — the week reached this reading and this page's test is
   *  still tracked; it simply was not measured. Transient. No row. */
  | { readonly decided: false; readonly because: "not_measured" }
  /** REQ-063 c6 — the test itself has stopped being evaluable. Terminal. */
  | { readonly decided: false; readonly cause: NotJudgeableCause };

/**
 * The reading, once the key was found. A measurement this week did not
 * reach decides nothing, and says so as the transient arm — never as a
 * cause. `passes` is handed the whole arm rather than the value, because
 * for a search position the *arm* is the answer: `zero` is "measured, and
 * the customer holds no place", which is a result and not a gap.
 */
function decide<T>(
  value: Measured<T>,
  passes: (m: { kind: "measured" | "zero"; value: T }) => boolean
): Evaluation {
  if (value.kind === "unmeasured") return { decided: false, because: "not_measured" };
  return { decided: true, passes: passes(value), measuredAt: value.at };
}

/** REQ-063 c5's transient arm, written once. */
const NOT_MEASURED: Evaluation = Object.freeze({ decided: false, because: "not_measured" as const });

/** REQ-063 c6's terminal arm, from an *absent key* and from nothing else. */
function retired(cause: NotJudgeableCause): Evaluation {
  return { decided: false, cause };
}

/**
 * Pure. Can this recorded test be decided from what this week measured?
 *
 * The three forms are §7's own — "top 20 for Q" / "named on question P" /
 * "gate passes" — and each is decided from one reading and no other.
 */
export function evaluateAcceptance(a: {
  acceptance: Acceptance;
  week: WeekMeasurements;
}): Evaluation {
  switch (a.acceptance.form) {
    case "top20": {
      const place = a.week.positions.get(a.acceptance.query);
      // Absent: the search this test names is no longer measured.
      if (place === undefined) return retired("search_untracked");
      // The battery buys a fixed depth of 10 (`SerpOrganicRow`: "depth 10,
      // fixed by `transport.ts`, never a caller argument"), so every place
      // the measurement can observe at all is inside the top twenty this
      // test names: holding a measured place *is* passing it, and the rank
      // rides along for the movement. The `zero` arm — measured, and the
      // customer holds no place — fails it, which is a measured result and
      // not a missing one (§6.6's cold-start law). No second copy of the
      // depth is written here to drift from the transport's.
      return decide(place, (m) => m.kind === "measured");
    }
    case "named_on": {
      const named = a.week.namesCustomer.get(a.acceptance.question);
      // Absent: the question left the tracked set when the market changed.
      if (named === undefined) return retired("question_left_set");
      return decide(named, (m) => m.value);
    }
    case "gate_cleared": {
      const cleared = a.week.gatesCleared.get(a.acceptance.gate);
      // A barrier belongs to a closed set (`BARRIERS`) and cannot leave a
      // tracked set, so a gate this week did not look at is
      // `not_measured` — never one of the five causes, and this branch
      // names none.
      if (cleared === undefined) return NOT_MEASURED;
      return decide(cleared, (m) => m.value);
    }
  }
}
