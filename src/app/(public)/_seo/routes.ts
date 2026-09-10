// BUILD §3 — one row per public route, and what its <head> says.
// src/app/(public)/_seo/routes.ts — issue #326
//
// §3 lists the public routes; this is the same list with the two sentences
// each of them owes a search result attached to it, and one flag saying
// whether a crawler may index it. It exists so that "does every public
// route have metadata?" is a question a test can answer by comparing this
// table with the route tree, rather than by trusting nine `metadata`
// exports to have been remembered.
//
// **The flag is the sitemap.** A route is named in the app host's sitemap
// if and only if `indexable` is true — one fact, read by `sitemapPaths()`
// below and by `metadata.ts`'s `robots` directive, so a page cannot be
// listed for crawling and told not to be indexed, or the reverse.
//
// **Four routes are `indexable: false`, and each for its own reason:**
//
//   · `/scan/{domain}` — ADR-002 decision 1 and REQ-001 c8: report pages
//     are `noindex` forever and appear in no sitemap the product
//     publishes. The page's own `metadata` said so before this table
//     existed and still does; the table agrees with it rather than
//     replacing it.
//   · `/veto/{token}` and `/opt-out/{token}` — the path *is* the
//     credential. An indexed stop link is a stop link published to
//     everyone who can read a search result (issue #144's reasoning for
//     the veto page, which holds identically for the opt-out one).
//   · `/signin` — a sign-in form has nothing to rank and is the one public
//     screen whose whole job is to hand out a credential by mail. It is
//     reachable, linked from every header, and left out of the index
//     deliberately.
//
// **`/signin/{token}` takes no row.** It is a route handler that redeems a
// link and redirects; it renders no document, so it has no `<head>` to
// fill. The 404 and error pages take no row either — they are not routes,
// they have no address of their own, and Next reads no `metadata` export
// from `not-found.tsx` or `error.tsx`.
import type { CopyKey } from "@/lib/presentation/copy";

export interface PublicRouteSeo {
  /** The route as `BUILD.md` §3 spells it — `{param}`, not `[param]`. */
  readonly route: string;
  readonly title: CopyKey;
  readonly description: CopyKey;
  /** Named in the app host's sitemap, and free of a `noindex` directive.
   *  The two move together; see this file's header. */
  readonly indexable: boolean;
}

export const PUBLIC_ROUTE_SEO = Object.freeze({
  landing: {
    route: "/",
    title: "meta.landing.title",
    description: "meta.landing.description",
    indexable: true,
  },
  pricing: {
    route: "/pricing",
    title: "meta.pricing.title",
    description: "meta.pricing.description",
    indexable: true,
  },
  privacy: {
    route: "/privacy",
    title: "meta.privacy.title",
    description: "meta.privacy.description",
    indexable: true,
  },
  terms: {
    route: "/terms",
    title: "meta.terms.title",
    description: "meta.terms.description",
    indexable: true,
  },
  imprint: {
    route: "/imprint",
    title: "meta.imprint.title",
    description: "meta.imprint.description",
    indexable: true,
  },
  signin: {
    route: "/signin",
    title: "meta.signin.title",
    description: "meta.signin.description",
    indexable: false,
  },
  report: {
    route: "/scan/{domain}",
    title: "meta.report.title",
    description: "meta.report.description",
    indexable: false,
  },
  veto: {
    route: "/veto/{token}",
    title: "meta.veto.title",
    description: "meta.veto.description",
    indexable: false,
  },
  optOut: {
    route: "/opt-out/{token}",
    title: "meta.optout.title",
    description: "meta.optout.description",
    indexable: false,
  },
}) satisfies Readonly<Record<string, PublicRouteSeo>>;

export type PublicRouteName = keyof typeof PUBLIC_ROUTE_SEO;

export const PUBLIC_ROUTE_SEO_ROWS: readonly PublicRouteSeo[] = Object.freeze(
  Object.values(PUBLIC_ROUTE_SEO)
);

/**
 * The paths the app host's sitemap names, in the order it names them.
 *
 * Derived, never typed twice: every `indexable` row, and no row carrying a
 * `{param}` — a sitemap entry is one address, and a pattern is not one. The
 * two predicates agree today (every indexable public route is static) and
 * the filter is what keeps them agreeing if a dynamic route is ever ruled
 * indexable: it would need an enumeration of its own before it could
 * appear here, and it would be absent rather than wrong in the meantime.
 */
export function sitemapPaths(): readonly string[] {
  return PUBLIC_ROUTE_SEO_ROWS.filter(
    (row) => row.indexable && !row.route.includes("{")
  ).map((row) => row.route);
}
