// BUILD §8 hard rule 1 — grounded.
//
// BUILD §14 guardrail 5 — grounding.
//
// "≥1 verifiable fact from the customer's own live pages, carried with its
// source URL + read date." The check is that the recorded passage occurs,
// word for word, in the content fetched from that page that day.
//
// The model's own knowledge is not a source, and a market fact (SPEC §7,
// 2026-09-29, issue 1135) is a second pool beside this one, never in its
// place. A page with no passage of the customer's own stands on research
// alone (owner, #2511): the writer leaves out every sentence that names the
// business (`../pipeline/index.ts`), so there is nothing here to verify.
import type { GroundedFact, RuleFailure } from "./types";

/** Whitespace differences are not a different passage: a page's HTML is
 *  wrapped at whatever column its author wrote it at, and the rendered text
 *  of the same words can carry one space or three. Nothing else is
 *  normalised — a passage altered by one letter, one numeral or one
 *  punctuation mark is a different passage and fails. */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function checkGrounding(a: {
  grounded: GroundedFact | null;
  /** The rendered text of the customer's own page, as the measurement read
   *  it on the grounded fact's own read date. */
  sourceText: string;
}): RuleFailure | null {
  if (a.grounded === null) return null;
  const passage = collapseWhitespace(a.grounded.passage);
  if (passage.length === 0) return { rule: "grounding" };
  return collapseWhitespace(a.sourceText).includes(passage) ? null : { rule: "grounding" };
}
