// BUILD §9 — the robots document a customer's own domain is served.
//
// BUILD §14 guardrail 6 — the customer is publisher of record.
//
// §9: "a robots.txt **we serve** that allows GPTBot, ClaudeBot,
// OAI-SearchBot, Claude-SearchBot, PerplexityBot, Google-Extended."
// ReachKit's own address is served a different document, which lives under
// `(public)/_seo/policies.ts` and shares no helper with this one: a merged,
// parameterised template is one tidy-up away from serving the wrong policy
// on the wrong host.
//
// **The agents are pins, never literals here**: the answer readers
// (`AI_READER_AGENTS`) and the training crawlers (`AI_TRAINING_CRAWLERS`)
// are the two closed lists SPEC §9 (2026-09-29, D14) names, and this policy
// allows all seven. Typing the names here would be a second copy.
import { AI_ANSWER_FETCHERS, AI_READER_AGENTS, AI_TRAINING_CRAWLERS } from "@/lib/config/constants";

/**
 * The document we serve on the customer's own domain.
 *
 * No blanket `Disallow`, no rule against a general crawler, and one
 * `Allow` group per pinned AI reader — a named group's verdict outranks
 * the wildcard (RFC 9309 §2.2.1, the 2026-09-05 ruling on #72), so the
 * four answer readers and the three training crawlers are permitted
 * explicitly rather than by omission (SPEC §9, D14: "the hosted robots
 * policy still allows all seven").
 *
 * **And one group per user-triggered fetcher** (SPEC §6, 2026-09-20 measure
 * (d); issue #921). `ChatGPT-User`, `Perplexity-User` and `Claude-User` are
 * how an engine goes to a page *because a person asked it something* — the
 * one arrival this product counts as progress. They are a separate pin from
 * `AI_READER_AGENTS` (which answers "may an engine read this site") and
 * the lists are walked separately here for the same reason: permitting a
 * fetcher by name is a different statement from permitting an indexer, and
 * merging the lists would change a site-issue count.
 *
 * Every list is read from the pins; no agent name is typed in this file.
 */
export function customerRobotsDocument(sitemapUrl: string): string {
  const lines: string[] = ["User-agent: *", "Allow: /", ""];
  for (const agent of [...AI_READER_AGENTS, ...AI_TRAINING_CRAWLERS]) {
    lines.push(`User-agent: ${agent}`, "Allow: /", "");
  }
  for (const agent of Object.keys(AI_ANSWER_FETCHERS)) {
    lines.push(`User-agent: ${agent}`, "Allow: /", "");
  }
  lines.push(`Sitemap: ${sitemapUrl}`, "");
  return lines.join("\n");
}

