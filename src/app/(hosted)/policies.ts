// BUILD §9 — the two robots documents, written by two functions that share
//
// BUILD §14 guardrail 6 — the customer is publisher of record, and
// `*.reachkit.app` is noindex forever.
// no helper.
//
// §9: "a robots.txt **we serve** that allows GPTBot, ClaudeBot,
// OAI-SearchBot, Claude-SearchBot, PerplexityBot, Google-Extended. Preview
// at `{slug}.reachkit.app` is `noindex` **forever** (site-reputation-abuse
// guardrail — customer content never ranks on our domain)."
//
// Two policies, and they must never become one. The customer's own domain
// is served a document that blocks no general search engine crawler and
// names the six AI readers with `Allow`; the preview host is served a
// document that indexes nothing. **They share no helper and no partial —
// not even a line-joining utility.** A merged, parameterised template is
// one edit away from serving the wrong policy on the wrong host, and that
// edit reads as a tidy-up, which is exactly why the separation is a test
// (`tests/hosted/indexing/robots.test.ts` asserts the two functions'
// callees are disjoint) and not a comment.
//
// **The six agents are a pin, never a literal here** (ADR-022, ADR-090):
// `AI_READER_AGENTS` is one closed list that the blocked-readers count, the
// unblock lines and this policy all read. Typing the names here would
// be a second copy, and adding or removing an agent would stop being a
// pins-test change.
//
// The archived plan is WO-231.
import { AI_READER_AGENTS } from "@/lib/config/constants";

/**
 * The document we serve on the customer's own domain.
 *
 * No blanket `Disallow`, no rule against a general crawler, and one
 * `Allow` group per pinned AI reader — a named group's verdict outranks
 * the wildcard (RFC 9309 §2.2.1, the 2026-09-05 ruling on #72), so the six
 * are permitted explicitly rather than by omission.
 */
export function customerRobotsDocument(sitemapUrl: string): string {
  const lines: string[] = ["User-agent: *", "Allow: /", ""];
  for (const agent of AI_READER_AGENTS) {
    lines.push(`User-agent: ${agent}`, "Allow: /", "");
  }
  lines.push(`Sitemap: ${sitemapUrl}`, "");
  return lines.join("\n");
}

/**
 * The document we serve on a `{slug}.reachkit.app` preview.
 *
 * Everything is disallowed, forever (ADR-002 decision 2). No setting
 * reaches this function, there is no argument that changes what it
 * returns, and `HostDisposition`'s `preview` arm carries `indexable: false`
 * as a literal type beside it. Written out in full rather than composed
 * from the function above: see this file's header.
 */
export function previewRobotsDocument(): string {
  return "User-agent: *\nDisallow: /\n";
}
