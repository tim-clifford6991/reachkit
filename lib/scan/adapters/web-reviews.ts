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
    return { snippets: parseWebReviewSnippets(body), raw: body };
  } catch {
    return { snippets: [], raw: null };
  }
}
