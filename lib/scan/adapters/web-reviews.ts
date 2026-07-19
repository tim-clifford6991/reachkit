import { env } from "@/lib/config/env";
import { fixtures } from "@/lib/scan/fixture-seam";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { recordTavilyCost } from "@/lib/scan/cost-context";

/**
 * Best-effort web review snippets. Web mode collects no first-party reviews, so we
 * mine review-bearing text from a `"{subject} reviews"` search (Trustpilot/G2/etc.
 * snippets) to feed the review_themes extract — turning "0 reviews" into real
 * sentiment signal. Pass the full host (e.g. "acquire.com") as `subject` so the
 * query is domain-anchored and can't pull a same-named different product's reviews.
 *
 * Never throws: any failure degrades to an empty result and the scan continues.
 */
export function parseWebReviewSnippets(body: unknown): string[] {
  // ONLY real result snippets. Tavily's `answer` is LLM-synthesized prose, not a
  // review — laundering it as review #1 (the old `if (b.answer) out.push`) is what
  // produced invented reviews for the unlaunched reachkit.app (scan 6d49d58e).
  // Grounding honesty (invariant #11): never treat generated text as evidence.
  const b = (body ?? {}) as { results?: Array<{ title?: string; content?: string }> };
  const out: string[] = [];
  for (const r of b.results ?? []) {
    const s = `${r.title ?? ""} — ${r.content ?? ""}`.trim();
    if (s.length > 3) out.push(s);
  }
  return out;
}

/**
 * Brand-ambiguity hard rule for web reviews: a `"{host} reviews"` search can fuzzy-
 * match a same-named DIFFERENT product (e.g. "nudgi.ai reviews" → "Nudge AI", a
 * clinical-documentation tool). Keep only snippets that actually reference the
 * subject's full host, so a different product's reviews can never pollute the
 * subject's themes/insight. Errs toward dropping — brand-safety over coverage.
 */
export function filterSubjectSnippets(snippets: string[], subjectHost: string): string[] {
  const host = subjectHost.toLowerCase().replace(/^www\./, "");
  if (!host) return [];
  // Match the distinctive BRAND token ("stripe", "nudgi") — that's how real reviews
  // reference a product ("Stripe", not "stripe.com"). Requiring the full host dropped
  // almost every genuine review (the "1 review for Stripe" bug). The token still
  // blocks a same-named DIFFERENT product ("Nudge AI" lacks "nudgi"). Fall back to the
  // full host when the token is too short to be safe (a 2–3 char token matches anything).
  const brand = host.split(".")[0] ?? host;
  const needle = brand.length >= 4 ? brand : host;
  return snippets.filter((s) => s.toLowerCase().includes(needle));
}

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
 * WS-A (2026-07-19): brand-ambiguity, domain-conflict edition. The token filter
 * above (`filterSubjectSnippets`) cannot tell reachkit.app from reachkit.AI —
 * both contain "reachkit" — so a contested brand shipped another company's
 * reviews (prod scan 4093f1c9). Rule, per RESULT:
 *   1. A result referencing a same-brand DIFFERENT domain is dropped outright.
 *   2. If ANY result in the batch shows such a conflict, the brand is contested:
 *      every kept result must then reference the subject's own host explicitly.
 *   3. Otherwise (uncontested batch) the existing brand-token match stands, so
 *      genuine "Stripe is great" reviews survive (the 1-review-for-Stripe bug).
 * Errs toward dropping — grounding honesty (#11) over coverage.
 */
export function filterSubjectResults(body: unknown, subjectHost: string): string[] {
  const host = subjectHost.toLowerCase().replace(/^www\./, "");
  if (!host) return [];
  const brand = host.split(".")[0] ?? host;
  const results = ((body ?? {}) as { results?: TavilyResult[] }).results ?? [];

  const conflicts = (r: TavilyResult): boolean =>
    referencedDomains(r).some((d) => d !== host && (d.split(".")[0] ?? d) === brand);
  const referencesSubject = (r: TavilyResult): boolean => referencedDomains(r).includes(host);

  const contested = results.some(conflicts);
  const needle = brand.length >= 4 ? brand : host;
  return results
    .filter((r) => {
      if (conflicts(r)) return false;
      if (contested) return referencesSubject(r);
      return `${r.title ?? ""} — ${r.content ?? ""}`.toLowerCase().includes(needle);
    })
    .map((r) => `${r.title ?? ""} — ${r.content ?? ""}`.trim())
    .filter((s) => s.length > 3);
}

/**
 * Same domain-conflict rule as `filterSubjectResults` (WS-A, 2026-07-19), but
 * returns the ORIGINAL result objects instead of formatted title/content strings
 * — for callers that need to keep other fields (url, publishedDate, …) alongside
 * the filtered set. First reuse found in the class sweep: `runMarketAnalysis`'s
 * "recent buzz" pass (`gap/run.ts`) runs a Tavily NEWS search keyed on the
 * subject's own product NAME — exactly as brand-ambiguous as the reviews search
 * (a same-brand different-domain product's press can get rendered as "what's
 * been said about your space" and inflate `recentBuzzCount`, a real market
 * signal). Errs toward dropping — grounding honesty (#11) over coverage.
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

/**
 * Largest "<n> reviews"/"<n> ratings" figure found across the snippets, else 0.
 * Lets a web scan surface a real review count (Capterra/G2 page summaries embed
 * "from 380 reviews") instead of the misleading snippet count. NEVER fabricates:
 * 0 when nothing parseable, and the caller falls back to the snippet count.
 */
export function reviewCountFromSnippets(snippets: string[]): number {
  let max = 0;
  const re = /([\d][\d,]{1,})\s*(?:verified\s+)?(?:reviews|ratings)/gi;
  for (const s of snippets) {
    for (const m of s.matchAll(re)) {
      const n = Number((m[1] ?? "").replace(/,/g, ""));
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max;
}

export async function fetchWebReviews(subject: string): Promise<{ snippets: string[]; raw: unknown }> {
  if (fixtures()) return { snippets: [], raw: { skipped: "fixtures" } };
  try {
    const res = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // No include_answer: we stop paying Tavily to generate prose we now discard
      // (parseWebReviewSnippets ignores `answer`).
      body: JSON.stringify({ api_key: env.tavilyApiKey, query: `${subject} reviews`, max_results: 5 }),
    });
    if (!res.ok) return { snippets: [], raw: null };
    recordTavilyCost("search", env.tavilyUsdPerCredit, { depth: "basic" });
    const body = await res.json();
    // Only keep snippets provably about THIS subject (domain-conflict rule, WS-A).
    return { snippets: filterSubjectResults(body, subject), raw: body };
  } catch {
    return { snippets: [], raw: null };
  }
}
