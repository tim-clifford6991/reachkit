/**
 * Domain-conflict / subject-attribution helpers for brand-ambiguous web
 * search results.
 *
 * History: this module originally ALSO fetched + filtered web review
 * snippets for the (now-retired) `review_themes` extract kind — `fetchWebReviews`,
 * `filterSubjectResults`, `parseWebReviewSnippets`, `reviewCountFromSnippets`,
 * and the `GROUNDING_POLICY_VERSION` cache-invalidation constant were CUT M3b
 * (2026-07-23, O-7): reviews are no longer collected for either tier, so
 * nothing consumes them anymore. What remains — `referencedDomains` +
 * `dropDomainConflicts` — is a SEPARATE, still-live producer: the recent-buzz
 * Tavily NEWS search in `gap/run.ts` is exactly as brand-ambiguous as the old
 * reviews search (a same-brand different-domain product's press can get
 * rendered as "what's been said about your space"), so it reuses the same
 * domain-conflict rule to drop wrong-subject hits.
 */

type TavilyResult = { url?: string; title?: string; content?: string };

/** Every host-shaped token a result references (its URL + text), www-stripped.
 *  Review platforms key products by domain (trustpilot.com/review/<domain>), so
 *  the URL is the strongest subject evidence a result carries. */
export function referencedDomains(r: TavilyResult): string[] {
  const text = `${r.url ?? ""} ${r.title ?? ""} ${r.content ?? ""}`.toLowerCase();
  const found = new Set<string>();
  for (const m of text.matchAll(/([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,})/g)) {
    found.add((m[1] ?? "").replace(/^www\./, ""));
  }
  return [...found];
}

/**
 * Domain-conflict rule (WS-A, 2026-07-19), reused by the recent-buzz pass
 * (`gap/run.ts`)'s Tavily NEWS search keyed on the subject's own product NAME
 * — brand-ambiguous the same way the retired reviews search was (a same-brand
 * different-domain product's press can get rendered as "what's been said
 * about your space" and inflate `recentBuzzCount`, a real market signal).
 * Errs toward dropping — grounding honesty (#11) over coverage.
 *
 * Semantics: news keeps the WEAKER contested/uncontested gate (does NOT
 * require per-result domain evidence), because press almost never writes a
 * domain ("Stripe launches X") and buzz feeds an aggregate COUNT on a paid
 * surface, not rendered quotes.
 */
export function dropDomainConflicts<T extends TavilyResult>(results: T[], subjectHost: string): T[] {
  const host = subjectHost.toLowerCase().replace(/^www\./, "");
  if (!host) return [];
  const brand = host.split(".")[0] ?? host;

  const conflicts = (r: T): boolean =>
    referencedDomains(r).some((d) => d !== host && (d.split(".")[0] ?? d) === brand);
  const referencesSubject = (r: T): boolean => referencedDomains(r).includes(host);

  const contested = results.some(conflicts);
  return results.filter((r) => {
    if (conflicts(r)) return false;
    if (contested) return referencesSubject(r);
    return true;
  });
}
