// SPEC §4, §6, §7 (issue 867) — what one page is optimising for.
//
// The owner, 2026-09-17: "I don't believe we are currently showing the
// users the SEO or GEO metrics their content is currently optimizing for."
// The facts were all measured and none of them reached a screen: the
// search's monthly volume, its keyword difficulty against the ceiling this
// site is judged by (§6, issue 858), the winnability band, and where each
// of §6.2's three answer engines stood on that question.
//
// **One projection, read by both screens.** The calendar day panel and the
// draft screen state the same thing about the same page, so they read it
// from one place: two projections of one row is how they came to disagree.
//
// **Nothing is measured or re-derived.** Every value is copied off the
// opportunity's stored evidence, with the dates it was measured on. A row
// derived before issue 867 carries no target facts, and its numbers render
// through their unmeasured arm rather than as zeros.
//
// **No sentence.** This module emits values and handles; the words are the
// copy registry's, and the band words are `BAND_LABELS.winnability`'s.
import { unmeasured, type Measured } from "@/lib/measure/measured";
// By file, never through the barrel: a screen that names these types must
// not pull the engine's store — and an import-graph guard counts a type
// import (issue #223's lesson, and the overview graph test's).
import type { Choice } from "@/lib/opportunities/derive/explain";
import type { TargetEngine, Winnability } from "@/lib/opportunities/types";

/** What a page is for, as both screens read it. */
export interface PageTarget {
  /** The search this page is written to win. */
  search: string;
  /** The search as a question — the acceptance test's own wording where the
   *  target was chosen against one, else the deterministic question form. */
  askedAs: string;
  /** Searches a month, as the pass measured it. */
  volume: Measured<number>;
  /** The vendor's keyword difficulty for that search, 0–100. */
  difficulty: Measured<number>;
  /** What the difficulty is judged against for this site — `null` where the
   *  row carries no target facts, so no screen prints a ceiling nobody
   *  measured this page against. */
  ceiling: number | null;
  /** The band, as a handle. The words are `BAND_LABELS.winnability`'s. */
  winnability: Winnability;
  /** Where each answer engine stood, in the order the pass carried them. */
  engines: readonly TargetEngine[];
  /** What "done" means for this page, in the registry's words. */
  doneWhen: string;
}

/** A Fix page has no market target at all: no search, no volume, no band.
 *  The screens draw their own arm for it rather than a block of blanks. */
export type PageTargetOrNone = PageTarget | null;

/**
 * One choice, as the two screens state it.
 *
 * `askedAs` and `doneWhen` are the caller's: both are already derived by
 * the calendar store, from the acceptance test and the copy registry, and
 * deriving them a second time here would be a second place the product
 * words the same fact.
 */
export function pageTargetOf(a: {
  choice: Choice;
  askedAs: string;
  doneWhen: string;
  /** The date an unmeasured value carries — the choice's own measurement
   *  date, never today's. */
  at: Date;
}): PageTargetOrNone {
  const { evidence } = a.choice;
  if (evidence.family === "fix") return null;
  const target = evidence.target;
  return {
    search: evidence.query,
    askedAs: a.askedAs,
    volume: evidence.volume,
    difficulty: target?.difficulty ?? unmeasured<number>("undeterminable", a.at),
    ceiling: target?.ceiling ?? null,
    // Non-null for everything a page can be: `fit_band` is null for exactly
    // the Fix family, which took the arm above.
    winnability: a.choice.fitBand ?? "not-yet",
    engines: target?.engines ?? [],
    doneWhen: a.doneWhen,
  };
}
