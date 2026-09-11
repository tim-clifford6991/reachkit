// BUILD §5 — the score's parts, and what a cut-off factor does to it.
// src/lib/measure/partition.ts — WO-277 (consolidates WO-053), BP-024
//
// The exhaustive classification REQ-004's last non-goal hands to the
// blueprint. One function, one closed input union, one arm each — a new
// input cannot ship without a classification (BP-024 decision 2).
import { measured, measuredZero, unmeasured, worseReason, type Measured, type UnmeasuredReason } from "./measured";
import type { ScoreFactorName } from "./score";

export type ScanInput =
  | "home_document"
  | "pricing_document"
  | "access_rules"
  | "business_profile"
  | "market_suggestions"
  | "own_ranked_rows"
  | "question_serps";

export type InputOutcome =
  | { read: true; empty: boolean } // we read it; `empty` = it contained none of what we counted
  | { read: false; because: "undeterminable" }
  | { read: false; because: "not_attempted" };

/** Total switch over `InputOutcome`, per BP-024's classification table.
 *  Reading is the whole of the line: no arm inspects `input` to decide —
 *  it is carried through only so a caller can log which input produced
 *  which classification. */
export function classify(input: ScanInput, o: InputOutcome, at: Date): Measured<null> {
  void input;
  if (o.read) {
    return o.empty ? measuredZero(null, at) : measured(null, at);
  }
  return unmeasured(o.because, at);
}

/** REQ-004 criterion 6's second sentence — "an input no driver depends on
 *  never withholds the score" — is this map, not a judgement at each call
 *  site (BP-024 decision 2). Transitively closed: `business_profile` and
 *  `market_suggestions` feed `presence` only through `question_serps` in
 *  the pipeline's own data flow, but the map already carries the closure,
 *  so `verdict.ts` never has to walk a chain to answer "does this input
 *  feed a factor". */
export const FEEDS: Readonly<Record<ScanInput, readonly ScoreFactorName[]>> = Object.freeze({
  home_document: Object.freeze(["foundations", "answerability"] as const),
  pricing_document: Object.freeze(["answerability"] as const),
  access_rules: Object.freeze(["foundations"] as const),
  business_profile: Object.freeze(["presence"] as const),
  market_suggestions: Object.freeze(["presence"] as const),
  own_ranked_rows: Object.freeze(["presence"] as const),
  question_serps: Object.freeze(["presence"] as const),
});

/** Section-level outcome, for REQ-004 criterion 10. A section whose data
 *  could not be retrieved is absent and named; it is never an empty card. */
export type SectionName = "verdict" | "ai_answers" | "google_presence" | "problems" | "first_page";

/** Which `ScanInput`s each report section is made of — internal to this
 *  file (rule 1.1 parameter: an internal module boundary, not a customer
 *  promise; `structure.md` rule 5 and rendering itself are BP-019's, out
 *  of this WO's scope entirely). Derived from `SPEC.md` §4.1's screen
 *  order: the header strip (`verdict`) rests on everything that feeds a
 *  factor; the AI-answers card and the Google-search card both need the
 *  twelve SERPs and the rival derivation's own inputs; the three problem
 *  cards (`problems`) rest on the home document and the access rules; the
 *  free page card (`first_page`) rests on the same presence pipeline as
 *  the Google-search card, since it is the first opportunity that
 *  pipeline produces. Reversing this mapping is a one-file, no-migration
 *  change — nothing downstream stores it. */
const SECTION_INPUTS: Readonly<Record<SectionName, readonly ScanInput[]>> = Object.freeze({
  verdict: Object.freeze([
    "home_document",
    "pricing_document",
    "access_rules",
    "business_profile",
    "market_suggestions",
    "own_ranked_rows",
    "question_serps",
  ] as const),
  ai_answers: Object.freeze(["question_serps", "business_profile", "market_suggestions"] as const),
  google_presence: Object.freeze(["own_ranked_rows", "question_serps", "business_profile", "market_suggestions"] as const),
  problems: Object.freeze(["home_document", "access_rules"] as const),
  first_page: Object.freeze(["business_profile", "market_suggestions", "own_ranked_rows", "question_serps"] as const),
});

export function sectionOutcome(
  s: SectionName,
  inputs: Readonly<Record<ScanInput, InputOutcome>>
): { present: true } | { present: false; reason: UnmeasuredReason } {
  const own = SECTION_INPUTS[s];
  let reason: UnmeasuredReason | undefined;
  for (const input of own) {
    const outcome = inputs[input];
    if (outcome.read) {
      return { present: true };
    }
    reason = reason === undefined ? outcome.because : worseReason(reason, outcome.because);
  }
  return { present: false, reason: reason ?? "not_attempted" };
}
