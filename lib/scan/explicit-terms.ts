/**
 * Editorial filter for NAMED example keywords on the public report (found via
 * the report corpus: x.com's off-topic examples rendered `e.g. you rank for
 * "porn hub"` on the conversion surface — payload-grounded and honest, but not
 * copy we put a founder's brand next to).
 *
 * Scope is deliberately narrow: this curates which EXAMPLES are named, never
 * the numbers — the off-topic percentage still counts every keyword, so no
 * metric moves (the number–label honesty rules are untouched). Shared by the
 * render boundary (`to-results-props.ts`) and the acceptance rubric's R3
 * grounding predicate so the two can never disagree about whether an example
 * set is renderable.
 */
export const EXPLICIT_TERM_RE =
  /\b(porn\w*|xxx+|xvideos|xnxx|xhamster|redtube|youporn|hentai|nsfw|onlyfans|escorts?|camgirls?|milfs?)\b/i;

export function isExplicitTerm(s: string): boolean {
  return EXPLICIT_TERM_RE.test(s);
}

/** The renderable subset of off-topic examples — the ONE shared curation rule. */
export function renderableExamples(examples: string[] | undefined): string[] {
  return (examples ?? []).filter((ex) => !isExplicitTerm(ex));
}
