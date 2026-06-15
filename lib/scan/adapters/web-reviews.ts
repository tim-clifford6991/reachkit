import { env } from "@/lib/config/env";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

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
  const b = (body ?? {}) as { answer?: string; results?: Array<{ title?: string; content?: string }> };
  const out: string[] = [];
  if (b.answer) out.push(b.answer);
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
  if (fixturesEnabled()) return { snippets: [], raw: { skipped: "fixtures" } };
  try {
    const res = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: env.tavilyApiKey, query: `${subject} reviews`, max_results: 5, include_answer: true }),
    });
    if (!res.ok) return { snippets: [], raw: null };
    const body = await res.json();
    // Only keep snippets that actually reference the subject host (brand-safety).
    return { snippets: filterSubjectSnippets(parseWebReviewSnippets(body), subject), raw: body };
  } catch {
    return { snippets: [], raw: null };
  }
}
