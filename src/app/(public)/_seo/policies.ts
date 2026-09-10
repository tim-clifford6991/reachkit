// BUILD §3 · §9 — the two indexing documents ReachKit's own address serves.
// src/app/(public)/_seo/policies.ts — issue #326
//
// §3 lists `/robots.txt` and `/sitemap.xml` among the public routes. Until
// this file existed only two hosts were answered on those paths — a
// customer's `content.` domain and a `{slug}.reachkit.app` preview — and
// the app's own host was answered 404, which
// `src/app/(hosted)/robots.txt/route.ts` recorded as deliberate: "quietly
// taking over the product's own `/robots.txt` from inside the hosted edge
// would be a policy change nobody asked for". Issue #326 is the policy
// being asked for, so the two route handlers now answer a third host with
// the two documents written here.
//
// **They live under `(public)` and not beside the hosted pair.** These are
// statements about ReachKit's own public routes; `(hosted)/policies.ts` is
// a statement about a customer's site and about a preview address, and the
// test that keeps *those* two apart (`tests/hosted/indexing/robots.test.ts`
// — "they share no callee") exists because a merged, parameterised
// template is one tidy-up away from serving the wrong policy on the wrong
// host. A third document in that file would be a third candidate for the
// same tidy-up. It takes no helper from either of them.
//
// **The app policy names no `Disallow`.** Every public route that must not
// be indexed says so twice already — `robots: { index: false }` from
// `_seo/routes.ts` and, for the two token paths, `next.config.ts`'s
// `X-Robots-Tag` — and a `Disallow` would be strictly worse than that: a
// crawler forbidden to fetch a page never reads the `noindex` on it, and
// may list the bare address anyway. Blocking is not how a page stays out
// of an index; `noindex` is. The account container needs no line either —
// every path under it answers a redirect to `/signin` without a session.
//
// **The sitemap names the indexable rows and nothing else** — no report
// address ever (ADR-002 decision 1, REQ-001 c8: "no sitemap the product
// publishes lists any report address"), no `(account)` path, no `(hosted)`
// or preview address (§14 guardrail 6). It cannot name one by accident:
// the only paths it can emit are `sitemapPaths()`, which is every
// `indexable` row of the route table with no `{param}` in it.
import { sitemapPaths } from "./routes";

/**
 * The robots document ReachKit's own host serves.
 *
 * One wildcard group that allows the whole site, and this deployment's own
 * sitemap by absolute address. The six pinned AI readers take no group of
 * their own here: the pin is a promise about the *hosted* destination
 * (BUILD §9, REQ-059 c4), and naming them again on the app host would be a
 * second, unrequested policy wearing the same list.
 */
export function appRobotsDocument(sitemapUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`;
}

/** The five characters XML reserves. Every entry below is composed from a
 *  closed table of static paths and one parsed origin, so none of them
 *  should carry one; escaping is not a promise about the input, it is what
 *  keeps a malformed one from producing a malformed document — the same
 *  reason `(hosted)/sitemap.xml/route.ts` escapes its own live URLs. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * The sitemap ReachKit's own host serves: one `<url>` per indexable public
 * route, at this deployment's own origin.
 *
 * No `lastmod`: a public route's document changes when the product ships,
 * not on a date this process knows, and a date invented per request would
 * be a claim rather than a fact.
 */
export function appSitemapDocument(origin: string): string {
  const entries = sitemapPaths()
    .map((path) => `  <url><loc>${xmlEscape(new URL(path, origin).toString())}</loc></url>`)
    .join("\n");
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    (entries === "" ? "" : `${entries}\n`) +
    "</urlset>\n"
  );
}
