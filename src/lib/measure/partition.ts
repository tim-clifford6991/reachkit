// BUILD §5 — the score's parts, and what a cut-off factor does to it.
// src/lib/measure/partition.ts — WO-277 (consolidates WO-053), BP-024
//
// The exhaustive classification REQ-004's last non-goal hands to the
// blueprint. One function, one closed input union, one arm each — a new
// input cannot ship without a classification (BP-024 decision 2).
import { measured, measuredZero, unmeasured, type Measured } from "./measured";
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

/** An input's outcome, read off the measurement it produced. */
export function outcomeOf(m: Measured<unknown>): InputOutcome {
  if (m.kind === "unmeasured") return { read: false, because: m.reason };
  return { read: true, empty: m.kind === "zero" };
}

/** The twelve SERPs as the one input the verdict reads them as: measured
 *  where any of them was, and carrying the reason where none was. */
export function foldSerps(serps: readonly Measured<unknown>[], at: Date): Measured<null> {
  for (const serp of serps) {
    if (serp.kind !== "unmeasured") return measured(null, at);
  }
  const first = serps[0];
  return unmeasured(first !== undefined && first.kind === "unmeasured" ? first.reason : "not_attempted", at);
}
