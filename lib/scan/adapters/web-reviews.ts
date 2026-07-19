import { env } from "@/lib/config/env";
import { fixtures } from "@/lib/scan/fixture-seam";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { recordTavilyCost } from "@/lib/scan/cost-context";

/**
 * Grounding-policy version for review-derived fact sheets. This is the class fix
 * for the cache-poisoning bug: a fact sheet cached under an OLDER policy is stale
 * evidence even if it hasn't expired, because the RULES that decided what counts
 * as grounded evidence changed underneath it. `lib/scan/fact-sheets.ts` stamps
 * this onto `review_themes` writes and rejects a cached sheet on read-back whose
 * stamp doesn't match — a policy bump here invalidates every prior sheet without
 * a migration or a manual purge.
 *
 * v1 = pre-WS-A implicit (Tavily's synthesized `answer` could leak in as a
 *      "review", and any snippet mentioning the subject's name was kept).
 * v2 = WS-A: `parseWebReviewSnippets` drops `answer` outright, and
 *      `filterSubjectResults` drops same-brand different-domain results; a
 *      CONTESTED batch additionally required per-result subject-host evidence.
 * v3 = attribution macro rule (2026-07-19 evening). A v2 sheet was poisoned
 *      LIVE (fact_sheets id 110, subject reachkit.app): the batch that built it
 *      happened to carry NO conflicting domain token — Capterra/GetApp key
 *      products by NAME ("…/software/2081334/reachkit"), so reachkit.AI's
 *      listings sailed through as "uncontested" and the brand-token fallback
 *      kept them. The class: a bare brand-NAME match is never attribution.
 *      v3 requires DOMAIN-LEVEL subject evidence on every kept result and
 *      drops the contested/uncontested split entirely (one rule, no branch);
 *      results hosted ON the subject's own domain are also dropped — the
 *      subject talking about itself is not a review.
 *
 * Bump this whenever the grounding rule for review evidence tightens again.
 */
export const GROUNDING_POLICY_VERSION = 3;

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

// `filterSubjectSnippets` (the WS-A v2 string-level brand-token filter) was
// DELETED in v3: it had no production caller (fetchWebReviews routes through
// `filterSubjectResults`), and its bare brand-name matching is exactly the
// attribution hole v3 closes — keeping it around invites the next caller to
// reintroduce the class.

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
 * WS-A v3 (2026-07-19): the attribution macro rule. WS-A v2's domain-conflict
 * gate only bit when a conflicting same-brand DOMAIN appeared in the batch —
 * but review platforms key products by NAME (capterra.com/p/…/Reachkit,
 * getapp.ie/software/…/reachkit), so a batch that happened to carry no domain
 * token read as "uncontested" and the brand-token fallback shipped reachkit.AI's
 * "Features 5/5" as reachkit.app's reviews (poisoned sheet, fact_sheets id 110).
 * A blocklist of platforms would be the anti-pattern CLAUDE.md forbids; the
 * class fix is structural — attribution, per RESULT, no batch-state branch:
 *   1. Referencing a same-brand DIFFERENT domain → dropped (unchanged).
 *   2. Hosted ON the subject's own domain → dropped. The subject's own pages
 *      are marketing, not reviews — without this, the domain-anchored query
 *      launders the subject's own site copy into "review" evidence.
 *   3. Kept ONLY with explicit domain-level subject evidence (the subject's
 *      host in the result's url/title/content). A bare brand-NAME match is
 *      never attribution — a name-keyed platform page about a same-named
 *      different product is indistinguishable from a genuine one at the
 *      snippet level, so an unverifiable result is not evidence.
 * Cost: genuine name-only snippets ("Stripe is great" on a G2 page that never
 * writes stripe.com) are now dropped too — domain-keyed results (Trustpilot
 * keys by domain) still survive. Errs toward dropping, three times documented:
 * grounding honesty (#11) over coverage. "0 reviews found" renders nothing
 * (rubric R3); someone else's 5/5 renders a lie.
 */
export function filterSubjectResults(body: unknown, subjectHost: string): string[] {
  const host = subjectHost.toLowerCase().replace(/^www\./, "");
  if (!host) return [];
  const brand = host.split(".")[0] ?? host;
  const results = ((body ?? {}) as { results?: TavilyResult[] }).results ?? [];

  const conflicts = (r: TavilyResult): boolean =>
    referencedDomains(r).some((d) => d !== host && (d.split(".")[0] ?? d) === brand);
  const referencesSubject = (r: TavilyResult): boolean => referencedDomains(r).includes(host);
  const selfHosted = (r: TavilyResult): boolean => {
    try {
      return new URL(r.url ?? "").hostname.toLowerCase().replace(/^www\./, "") === host;
    } catch {
      return false;
    }
  };

  return results
    .filter((r) => !conflicts(r) && !selfHosted(r) && referencesSubject(r))
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
 *
 * DELIBERATE ASYMMETRY vs `filterSubjectResults` v3: news keeps the v2
 * conflict-drop/contested semantics and does NOT require per-result domain
 * evidence, because press almost never writes a domain ("Stripe launches X")
 * and buzz feeds an aggregate COUNT on a paid surface — while reviews feed
 * verbatim QUOTES rendered as the subject's own users on the free conversion
 * surface. Quotes need attribution; counts tolerate the weaker gate. If a
 * wrong-subject buzz incident ever ships, tighten this to the v3 rule too.
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
