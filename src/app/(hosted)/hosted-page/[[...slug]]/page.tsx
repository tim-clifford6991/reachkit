// BUILD §9 — the hosted page: one typographic render, canonical on the
// customer's own domain, a description and `BlogPosting` on every page,
// `FAQPage` from data, zero client JavaScript.
//
// §9: published pages "render through **one** clean typographic template
// (the §2 design system, light-only is acceptable), customisable later —
// never per-customer templates in MVP", and a published page "is listed in
// a sitemap, declares its canonical address on the customer's own domain,
// and — where the page has a question-and-answer section — is marked up as
// such."
//
// **Why the address is `/hosted-page/{…slug}` and the customer's is not.**
// `src/middleware.ts` rewrites every request on a `content.` Host — except
// `/robots.txt` and `/sitemap.xml`, which resolve the Host themselves — to
// this catch-all, or, for an address it has just found live, to the cached
// article beside it (`hosted-live/[host]/[slug]`, issue 1242; the article
// both draw is `article.tsx`). A rewrite, never a redirect: the visitor stays at
// `content.{their domain}/{slug}`, which is the address the canonical link,
// the sitemap entry and `publications.live_url` all name. The rewrite is
// also the authorisation boundary: with it, *no* path on a customer's
// domain can reach a ReachKit screen, because every one of them lands here.
//
// **The whole page is in the HTML at first byte.** No `"use client"` in
// this module graph, no client component, no script but the JSON-LD block —
// which is data, not behaviour. REQ-062 c1 verifies exactly this property
// in the world, against "a crawler that runs no scripts"; this file is
// where it is true at the source.
//
// **`FAQPage` restates the questions the page draws, and only those**
// (SPEC §7, owner, 2026-10-17, issue 1489). `drafts.meta.faq` is drawn as a
// visible section above the sources list by `render/faq.ts`, and the data
// is built from the text of those very blocks — never from a guess at the
// body's headings (the archived BP-047 decision 2), and never from a
// question the reader cannot see. An absent or empty section draws nothing
// and emits no `FAQPage` at all, never an empty one.
//
// **Every page describes itself** (issue 697). §9's crawl flags a page with
// no meta description and a page with no structured data, and a hosted page
// is ReachKit's template, not the customer's: a fault there is ours to fix
// in the template, never a Fix opportunity. So every live page's head
// carries the description generation wrote for it (`drafts.meta`), and
// every page carries a `BlogPosting` and a `BreadcrumbList` block built
// from what the page already shows (SPEC §7, 2026-09-29, issue 1141;
// `seo.ts`) — its title, its description, its dates, its byline, its
// canonical, its publisher and the three parts of its breadcrumb — with
// the share tags and the link to the feed beside them in the head.
//
// **The page carries the customer's identity** (SPEC §7, 2026-09-29, issue
// 1140; the *Hosted article* board in `docs/DESIGN.md`). Their logo and name
// in the header, linking to the index, and a button to their main site; the
// category they chose as the eyebrow; the byline, dates and reading time
// under the title; a table of contents built from the body's own headings;
// and at the foot an about card, related guides, a breadcrumb and their
// footer line — §14.6's "customer is publisher of record: their domain,
// their identity", rendered. The title and the body are their page — the
// one place in the product generated prose is rendered (REQ-093 c2).
//
// **Every sentence of ours is a key, and none names ReachKit.** They are
// structure around the customer's own data (`publish.ts`'s `hosted.*`):
// SPEC §5 and §7 put no ReachKit text, link or wordmark on a customer's
// page. The canonical is in `<head>`, where a crawler reads it.
//
// **Nothing on this surface is the primary colour.** The product's colour
// would be our branding on a stranger's domain; the customer's mark is the
// base content colour, and no class here names `primary`.
//
// daisyUI and Tailwind's scale in the route (DESIGN rule 1): no `rk-hosted-*`
// class, no type-ladder class. Dates, addresses and domains are `num`.
//
// **Nothing here writes.** No server action, no mutation, and the one form
// — the index's search (`listing.tsx`) — is a GET: a crawler cannot advance
// §9's state machine by fetching a page.
//
// **The root of the host is the index** (SPEC §7, 2026-09-16): every live
// page, newest first, with a search, and an honest empty state for a site
// that has published nothing. That is why the catch-all is optional.
//
// The archived plan is WO-230.
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type React from "react";
import { livePagesForSite, type HostedPage } from "@/lib/publish/destinations/hosted";
import { resolveHost } from "../../resolve-host";
import { HostedArticle, articleHead, businessOf, loadArticle, type Resolved } from "./article";
import type { HostedBusiness } from "./chrome";
import { HostedIndex, indexPageCount, pageOf, queryOf } from "./listing";
import { indexMetadata } from "./seo";

/** This route is not cached: it reads the Host header and the index's
 *  query, and it is where every address the middleware did not find live
 *  ends — the index, a 404, and a page whose read missed its deadline. A
 *  live article is cached, by its own route (`hosted-live/[host]/[slug]`,
 *  issue 1242); nothing that has to be asked again on each request is. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The article at this slug on the Host that was asked, or `null`. */
async function load(slug: string): Promise<Resolved | null> {
  return loadArticle((await headers()).get("host") ?? "", slug);
}

/** The catch-all takes an array; only a single-segment address is a page.
 *  `content.{domain}/a/b` is not a deeper page, it is not a page at all. */
function oneSegment(slug: readonly string[]): string | null {
  return slug.length === 1 ? (slug[0] ?? null) : null;
}

/** The root of the host — no segment at all — is the index (SPEC §7,
 *  2026-09-16), not a 404. */
function isIndex(slug: readonly string[] | undefined): boolean {
  return slug === undefined || slug.length === 0;
}

interface IndexResolved {
  business: HostedBusiness;
  canonical: string;
  pages: HostedPage[];
}

/** The index's one resolution per request: the site this Host serves and
 *  every live page of it, or `null` for any Host that is not a site. */
const loadIndex = cache(async (): Promise<IndexResolved | null> => {
  const host = (await headers()).get("host") ?? "";
  const disposition = await resolveHost(host);
  if (disposition.kind !== "site") return null;
  const [business, pages] = await Promise.all([
    businessOf(disposition),
    livePagesForSite(disposition.siteId, disposition.host),
  ]);
  return { business, canonical: `https://${disposition.host}/`, pages };
});

type Search = Promise<Record<string, string | string[] | undefined>> | undefined;

/** The search and the page of the index this address asks for. A page past
 *  the last one is `null`: it answers 404 (issue 1514), never the last
 *  page under another address. */
async function listOf(index: IndexResolved, searchParams: Search): Promise<{ query: string; page: number } | null> {
  const search = await searchParams;
  const query = queryOf(search?.q);
  const page = pageOf(search?.page);
  return page > indexPageCount(index.pages, query) ? null : { query, page };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams?: Search;
}): Promise<Metadata> {
  const { slug } = await params;
  if (isIndex(slug)) {
    const index = await loadIndex();
    if (index === null) return {};
    const list = await listOf(index, searchParams);
    if (list === null) return {};
    return indexMetadata({ ...index, ...list });
  }
  if (slug === undefined) return {};
  const segment = oneSegment(slug);
  const resolved = segment === null ? null : await load(segment);
  if (resolved === null) return {};
  return articleHead(resolved);
}

export default async function HostedPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams?: Search;
}): Promise<React.JSX.Element> {
  const { slug } = await params;
  if (isIndex(slug)) {
    const index = await loadIndex();
    // An unknown or stopped Host has no index either: the same 404.
    if (index === null) notFound();
    const list = await listOf(index, searchParams);
    if (list === null) notFound();
    return <HostedIndex {...index} {...list} />;
  }
  if (slug === undefined) notFound();
  const segment = oneSegment(slug);
  const resolved = segment === null ? null : await load(segment);
  // An unknown Host, an address this site never published at, and a page in
  // any state but live all end here: 404, and never another customer's
  // page, never a ReachKit page, never a fallback.
  if (resolved === null) notFound();
  return <HostedArticle resolved={resolved} />;
}
