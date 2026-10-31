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
// Three indexable rows carry a `{param}` (issue 1458): the comparisons, the
// teardowns and the answer page. Each declares the addresses it serves, and
// those are what the sitemap names.
//
// **These routes are `indexable: false`, and each for its own reason:**
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
//   · `/auth/confirm` — its address carries a sign-in link's token.
//
// The 404 and error pages take no row — they are not routes,
// they have no address of their own, and Next reads no `metadata` export
// from `not-found.tsx` or `error.tsx`.
import { WEEK_PLAN } from "@/lib/config/constants";
import type { CopyKey } from "@/lib/presentation/copy";
import { ANSWERS, COMPARISONS, TEARDOWNS } from "../_library";

export interface PublicRouteSeo {
  /** The route as `BUILD.md` §3 spells it — `{param}`, not `[param]`. */
  readonly route: string;
  readonly title: CopyKey;
  readonly description: CopyKey;
  /** Named in the app host's sitemap, and free of a `noindex` directive.
   *  The two move together; see this file's header. */
  readonly indexable: boolean;
  /** The slots a static row's sentences declare, filled from the constants. */
  readonly vars?: Readonly<Record<string, string>>;
  /** Every address an indexable `{param}` route serves, for the sitemap
   *  (issue 1458). A pattern is not an address; this list is. */
  readonly addresses?: () => readonly string[];
}

export const PUBLIC_ROUTE_SEO = Object.freeze({
  landing: {
    route: "/",
    title: "meta.landing.title",
    description: "meta.landing.description",
    indexable: true,
    vars: { weekPages: String(WEEK_PLAN.days) },
  },
  pricing: {
    route: "/pricing",
    title: "meta.pricing.title",
    description: "meta.pricing.description",
    indexable: true,
    vars: { weekPages: String(WEEK_PLAN.days) },
  },
  // SPEC §2 2026-09-24 (#1058): the gallery is indexed — canonical and a
  // sitemap entry for `/scans` itself — while every report it links to
  // stays `noindex` and out of the sitemap (the `report` row below).
  scans: {
    route: "/scans",
    title: "meta.scans.title",
    description: "meta.scans.description",
    indexable: true,
  },
  // SPEC §1 2026-10-10 (issue 1396): how the product works and who builds
  // it, both written to be found.
  how: {
    route: "/how-it-works",
    title: "meta.how.title",
    description: "meta.how.description",
    indexable: true,
  },
  about: {
    route: "/about",
    title: "meta.about.title",
    description: "meta.about.description",
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
  // Issue 1458: the pages Google still ranks from earlier versions, at the
  // addresses they were first published under. An article's title and
  // description are its own data, carried in the two `meta.article.*` slots.
  compare: {
    route: "/compare",
    title: "meta.compare.title",
    description: "meta.compare.description",
    indexable: true,
  },
  comparison: {
    route: "/compare/{tool}",
    title: "meta.article.title",
    description: "meta.article.description",
    indexable: true,
    addresses: () => COMPARISONS.map((c) => `/compare/${c.slug}`),
  },
  teardowns: {
    route: "/teardowns",
    title: "meta.teardowns.title",
    description: "meta.teardowns.description",
    indexable: true,
  },
  teardown: {
    route: "/teardowns/{site}",
    title: "meta.article.title",
    description: "meta.article.description",
    indexable: true,
    addresses: () => TEARDOWNS.map((t) => `/teardowns/${t.slug}`),
  },
  answer: {
    route: "/answers/{question}",
    title: "meta.article.title",
    description: "meta.article.description",
    indexable: true,
    addresses: () => ANSWERS.map((a) => `/answers/${a.slug}`),
  },
  tools: {
    route: "/tools",
    title: "meta.tools.title",
    description: "meta.tools.description",
    indexable: true,
  },
  metaPreview: {
    route: "/tools/meta-preview",
    title: "meta.tools.meta.title",
    description: "meta.tools.meta.description",
    indexable: true,
  },
  onPageCheck: {
    route: "/tools/on-page-check",
    title: "meta.tools.onpage.title",
    description: "meta.tools.onpage.description",
    indexable: true,
  },
  signin: {
    route: "/signin",
    title: "meta.signin.title",
    description: "meta.signin.description",
    indexable: false,
  },
  confirm: {
    route: "/auth/confirm",
    title: "meta.confirm.title",
    description: "meta.confirm.description",
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
  unsubscribe: {
    route: "/unsubscribe/{token}",
    title: "meta.unsubscribe.title",
    description: "meta.unsubscribe.description",
    indexable: false,
  },
  pause: {
    route: "/pause/{token}",
    title: "meta.pause.title",
    description: "meta.pause.description",
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
 * Derived, never typed twice: every `indexable` row — a static one as its
 * own address, a `{param}` one as the addresses it declares (issue 1458).
 * An indexable pattern with no `addresses` is absent rather than wrong.
 */
export function sitemapPaths(): readonly string[] {
  return PUBLIC_ROUTE_SEO_ROWS.filter((row) => row.indexable).flatMap((row) =>
    row.route.includes("{") ? (row.addresses?.() ?? []) : [row.route]
  );
}
