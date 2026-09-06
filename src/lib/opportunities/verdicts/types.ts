// BUILD §9 — the four standings, and the two unions that must never merge.
//
// §9: "Monday → full re-measure; each published page gets Working / Too
// early / Not working against its acceptance test. A regression is shown,
// never hidden." REQ-063 adds the fourth standing and the law this file
// exists to make unrepresentable-otherwise (DECISIONS 2026-09-01,
// ADR-071/072): **a page has four ways of having no ordinary verdict —
// verdict / not judgeable / not measured / no week — none may be merged,
// and all four are terminal.**
//
// `WeekStanding` is a discriminated union and not an enum with a reason
// field, because a consumer must destructure: the three "cannot tell you"
// cases are then unavoidable at every call site rather than optional at
// one. `tests/opportunities/verdicts/types.test.ts` holds the four arms to
// four with an exhaustiveness fixture that fails to compile if one is
// dropped.
//
// **`could_not_confirm` is a `VerifyNote` and never a `NotJudgeableCause`**
// (ADR-085 decision 4, ADR-072 decision 5b). It and `page_not_found` come
// from the same check, render as the same grey line, and go opposite ways:
// one leaves the page fully judged with a note beside its verdict, the
// other retires it from judgement forever and nothing restores it. Adding
// `could_not_confirm` to the cause union "beside `page_not_found`" is the
// tidy-up those two decisions exist to stop — it passes every runtime test
// that exists, and its effect is a live page retired permanently on the
// strength of ReachKit's own 502. `landmine.test.ts` is the assertion that
// goes red the day it is proposed.
import type { Measured } from "@/lib/measure/measured";
import type { Barrier } from "../types";

/** The three §9 names. */
export type Verdict = "working" | "too_early" | "not_working";

/** The site-local Monday a standing belongs to, `YYYY-MM-DD` — the same
 *  calendar date `scans.week_start` carries, never an instant. A customer
 *  who moves time zone moves no verdict they have already been given. */
export type WeekStart = string;

/**
 * REQ-063 c6's five ways a recorded acceptance test stops being evaluable.
 * **Every one of them is terminal.** There is no lift condition for any,
 * and no code computes one: `judgeWeek` short-circuits on a prior
 * `not_judgeable` row before it evaluates anything, and `page_verdicts`
 * grants no update and no delete, so there is nothing that could clear a
 * cause even by mistake.
 *
 * Read ADR-072 before writing the branch that judges a page again once its
 * search comes back into the tracked set. It will present as a *bug
 * report* — the page is live, the search is back, the customer is paying,
 * and the screen says no longer judgeable — and REQ-063 c6 forbids it in
 * terms: "A page marked no longer judgeable stays so, and nothing restores
 * it." REQ-063's criterion 7, the resumption path, was withdrawn outright
 * on 2026-09-01 and its number was not reused, so a citation to it dangles
 * rather than pointing at a softer promise.
 */
export type NotJudgeableCause =
  /** Its target search is no longer measured. */
  | "search_untracked"
  /** The customer unpublished the page (REQ-056 c7 — itself terminal). */
  | "unpublished"
  /** The one check at 24 hours found no page at its live address (REQ-062
   *  c4). Read from what that check recorded and derived nowhere: this
   *  module makes no request of any kind (ADR-085). */
  | "page_not_found"
  /** The question it named left the tracked set (REQ-071 c7). */
  | "question_left_set"
  /** The customer changed the domain the site is measured under, so every
   *  measurement the test was written against is about a different
   *  website (REQ-071 c14). */
  | "domain_changed";

export const NOT_JUDGEABLE_CAUSES: readonly NotJudgeableCause[] = Object.freeze([
  "search_untracked",
  "unpublished",
  "page_not_found",
  "question_left_set",
  "domain_changed",
]);

/**
 * The four checks the one look at 24 hours makes.
 *
 * Declared here because nothing declares it yet: BP-049's
 * `src/lib/publish/verify/verify.ts` (issue #50) is the home the plans give
 * it, and issue #45 owns `src/lib/publish/types.ts`. When either lands this
 * declaration is replaced by an import from it and no other line in this
 * directory changes — the ids are `publications.verify`'s own, transcribed
 * from BUILD §10 ("verify jsonb(reachable/indexable/sitemap/ai_readable)")
 * and not chosen here.
 */
export type CheckId = "reachable" | "indexable" | "sitemap" | "aiReadable";

/**
 * REQ-063 c1's two verification outcomes that sit **beside** a verdict
 * without qualifying it: a check the page failed (REQ-062 c3) and a check
 * that could not be confirmed (REQ-062 c4's third outcome, which asserts
 * nothing). Composed by destructuring what the 24-hour check recorded —
 * never by testing a boolean or a date, and never re-fetched or retried.
 *
 * A `Date` in its place — the `verifyFailedAt` an earlier cut of this file
 * carried — cannot say *which* checks failed, and cannot tell "the page
 * failed a check" from "the check did not settle at all".
 */
export type VerifyNote =
  | { readonly note: "checks_failed"; readonly failed: readonly CheckId[]; readonly checkedAt: Date }
  | { readonly note: "could_not_confirm"; readonly checkedAt: Date };

/**
 * REQ-063 c3's decline, carried rather than smoothed: both raw values,
 * the interval the change spans, and the fact that it went backwards.
 *
 * `from` and `to` are the measurements themselves, so nothing on the
 * render path can round a decline away or substitute the better earlier
 * figure — the two figures a customer is shown are the two that were
 * recorded.
 */
export interface Movement {
  readonly previousWeek: WeekStart;
  /** 1 unless a week was missed — REQ-063 c4's "the interval that change
   *  spans", stated wherever the measurement compared against is not the
   *  previous week's. */
  readonly spansWeeks: number;
  readonly from: Measured<number>;
  readonly to: Measured<number>;
  /** True where this week's place is worse than the one it is compared
   *  with. A search position is better the smaller it is, and holding no
   *  place at all is worse than holding any (`compareRank`, movement.ts).
   *  Carried, never smoothed away. */
  readonly declined: boolean;
}

/**
 * One page's standing for one week. **Four shapes, and they never collapse
 * into three** (ADR-071, carried forward unchanged by ADR-072).
 *
 * `no_week` is a property of the *week*, not of the page: it is returned
 * once per page only so the type is uniform, and a surface or a mail
 * renders it once for the week and never once per page (ADR-071 point 3).
 */
export type WeekStanding =
  | {
      readonly kind: "verdict";
      readonly verdict: Verdict;
      readonly measuredAt: Date;
      readonly movement: Movement | null;
      /** c1: shown beside the verdict, never in place of one. */
      readonly verifyNote: VerifyNote | null;
    }
  | {
      readonly kind: "not_judgeable";
      readonly cause: NotJudgeableCause;
      /** `null` = it never received a verdict at all (c6's second half). A
       *  required member carrying a null, not an optional one: an absent
       *  field cannot say "never judged". */
      readonly lastJudgedWeek: WeekStart | null;
    }
  /** c5, second half — this week measured too little to decide this page's
   *  recorded test. Transient, and it has no row: there is nowhere to
   *  write it down as permanent. */
  | { readonly kind: "not_measured" }
  /** c5, first half — the week was not measured at all. */
  | { readonly kind: "no_week" };

/**
 * What one week measured, in exactly the three readings the three
 * acceptance forms are decided from — REQ-047 c6's forms, no more and no
 * fewer.
 *
 * **An absent key and an `unmeasured` value are different facts and are
 * never merged.** A key that is absent says the thing left the tracked set
 * — which is terminal. A key that is present carrying an `unmeasured`
 * value says this week did not reach it — which is REQ-063 c5's transient
 * `not_measured` and must never be written down. Getting this backwards
 * retires a paying customer's live page forever on the strength of one
 * missed measurement, and every screen still renders correctly.
 */
export interface WeekMeasurements {
  readonly week: WeekStart;
  /** The date the measurement was taken — the report's own. */
  readonly measuredAt: Date;
  /** The domain this week measured. Compared with the publication's own; a
   *  difference is `domain_changed` (REQ-071 c14). */
  readonly domain: string;
  /** The customer's own place for each search still measured this week,
   *  keyed by the query a `top20` test records. A `zero` arm is a
   *  measurement — the customer holds no place — and never a missing one
   *  (§6.6's cold-start law). A key absent is `search_untracked`. */
  readonly positions: ReadonlyMap<string, Measured<number>>;
  /** Whether this week's AI answer for a question names the customer,
   *  keyed by the question a `named_on` test records. A key absent is
   *  `question_left_set` (REQ-071 c7). */
  readonly namesCustomer: ReadonlyMap<string, Measured<boolean>>;
  /** Whether each barrier is cleared, keyed by the `Barrier` a
   *  `gate_cleared` test records. A key absent is a gate this week did not
   *  look at — `not_measured`, and never one of the five causes: a barrier
   *  is a member of a closed set and cannot leave a tracked set. */
  readonly gatesCleared: ReadonlyMap<Barrier, Measured<boolean>>;
}
