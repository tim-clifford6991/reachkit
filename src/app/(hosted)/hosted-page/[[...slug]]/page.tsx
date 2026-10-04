// BUILD §9 — the hosted page: one typographic render, canonical on the
// customer's own domain, a description and `Article` on every page,
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
// this catch-all. A rewrite, never a redirect: the visitor stays at
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
// **`FAQPage` is emitted from `drafts.meta.faq` and never from parsing the
// body** (the archived BP-047 decision 2). A heading heuristic that is
// wrong emits schema claiming a question-and-answer section that is not
// there — a structured false statement on the customer's own domain. An
// absent or empty section emits no `FAQPage` at all, never an empty one.
//
// **Every page describes itself** (issue 697). §9's crawl flags a page with
// no meta description and a page with no structured data, and a hosted page
// is ReachKit's template, not the customer's: a fault there is ours to fix
// in the template, never a Fix opportunity. So every live page's head
// carries the description generation wrote for it (`drafts.meta`), and
// every page carries an `Article` block built from facts the page already
// states — its title, its description, its date, its canonical and its
// publisher. No author: §8 forbids inventing one.
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
import { after } from "next/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type React from "react";
import { HOSTED_BODY_CLASSES, HOSTED_GUIDES_CLASSES } from "../body-classes";
import { copy } from "@/lib/presentation/copy";
import {
  guidesBlock,
  headingsUnderTitle,
  inlineText,
  markPassage,
  parseMarkdown,
  toHtml,
  withHeadingIds,
  type Block,
  type HeadingEntry,
} from "@/lib/publish/render/markdown";
import {
  hostedIdentity,
  livePagesForSite,
  type HostedPage,
} from "@/lib/publish/destinations/hosted";
import { topicSimilarity } from "@/lib/known-content/similarity";
import { Surface } from "@/ui/layout";
import { resolveHost } from "../../resolve-host";
import { AboutCard, HostedFooter, HostedHeader, INDEX_PATH, mainSiteOf, type HostedBusiness } from "./chrome";
import { HostedIndex, pageOf, queryOf } from "./listing";
import { bylineLine } from "@/lib/publish/render/byline";
import { PAGE_LOCALE, writeDate } from "./present";
import { classifyBlogRead } from "@/lib/publish/reads/classify";

/** Nothing on this surface is cached (WO-028's NFR): a publication row that
 *  changes is read again on the very next request, so a takedown never
 *  waits on a TTL and a 410 is never served from a stale cache.
 *
 *  **It is also what makes the engine counter count** (issue #921). `after()`
 *  runs once per *render*, not once per request: on a cached or
 *  revalidated page the callback fires when the page is produced and never
 *  again, so every engine fetch and every AI-referred visit after that
 *  would go unrecorded. The issue asks this be confirmed rather than
 *  assumed, and the confirmation is this declaration plus the test that
 *  holds it in place — a future caching change to this route has to face
 *  the counter first. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Resolved {
  page: HostedPage;
  canonical: string;
  /** The site's other live pages, newest first. */
  others: HostedPage[];
  business: HostedBusiness;
}

/** The business a resolved host belongs to, as its pages draw it. */
async function businessOf(site: { siteId: string; domain: string }): Promise<HostedBusiness> {
  return { ...(await hostedIdentity(site)), domain: site.domain };
}

/** One resolution per request, shared by `generateMetadata` and the render.
 *  `cache` is React's own request-scoped memo — not a data cache, and not
 *  a TTL — so the two entry points below cannot disagree about which page
 *  they are describing, and the row is read once. */
const load = cache(async (slug: string): Promise<Resolved | null> => {
  const host = (await headers()).get("host") ?? "";
  const disposition = await resolveHost(host);
  // Every other disposition is somebody else's answer: `unknown` is the
  // 404 this file falls through to, and `gone` is answered 410 by
  // `../../gone/route.ts`, which the middleware rewrites to before this
  // route is reached. A page never renders for either.
  if (disposition.kind !== "site") return null;

  // The site's whole list, which the page is found in and its related
  // guides are chosen from: one read, the same one the sitemap makes.
  const pages = await livePagesForSite(disposition.siteId, disposition.host);
  const page = pages.find((candidate) => candidate.slug === slug);
  if (page === undefined) return null;
  return {
    page,
    others: pages.filter((candidate) => candidate !== page),
    business: await businessOf(disposition),
    // Always the customer's own domain, and always the page's own address:
    // the store composed it from the host that resolved (`liveUrlOnHost`,
    // which `liveUrlFor` is itself written in terms of), so the canonical,
    // the sitemap entry and §9's record are one string rather than three
    // compositions that can disagree. The host is the one that resolved —
    // the label is the customer's since SPEC §5's ruling of 2026-09-12, and
    // a host that moved under this page re-addresses it (SPEC §7,
    // 2026-09-18, issue 888) — so the canonical names the address the
    // visitor actually typed and never a stored guess at it. There is no
    // argument to it that yields a ReachKit address.
    canonical: page.liveUrl,
  };
});

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (isIndex(slug)) {
    const index = await loadIndex();
    if (index === null) return {};
    return {
      title: `${copy("hosted.index.heading")} · ${index.business.name}`,
      alternates: { canonical: index.canonical },
    };
  }
  if (slug === undefined) return {};
  const segment = oneSegment(slug);
  const resolved = segment === null ? null : await load(segment);
  if (resolved === null) return {};
  return {
    title: resolved.page.title,
    description: descriptionOf(resolved.page),
    alternates: { canonical: resolved.canonical },
  };
}

/** A description's length in a search result, past which it is cut. */
const DESCRIPTION_CHARS = 160;

/**
 * The page's meta description: the one generation wrote for it, or — for a
 * page generated before that was stored — its own first paragraph, cut at a
 * word. Always the page's own words, never a sentence of ours. `undefined`
 * only for a page with neither, which declares no description rather than
 * an empty one.
 */
function descriptionOf(page: HostedPage): string | undefined {
  if (page.description !== null) return page.description;
  const first = parseMarkdown(page.bodyMd).find(
    (block): block is Extract<Block, { kind: "paragraph" }> => block.kind === "paragraph"
  );
  const text = first === undefined ? "" : inlineText(first.children).replace(/\s+/g, " ").trim();
  if (text === "") return undefined;
  if (text.length <= DESCRIPTION_CHARS) return text;
  const cut = text.slice(0, DESCRIPTION_CHARS);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** A schema object as a script body. Next's own JSON-LD guidance:
 *  `JSON.stringify` does not escape a `<`, and every value here is
 *  customer- or model-written text. */
function jsonLd(schema: Record<string, unknown>): string {
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

/** `Article`, on every page: what the page is, from what it states. */
function articleSchema(page: HostedPage, canonical: string): string {
  const description = descriptionOf(page);
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${canonical}#article`,
    headline: page.title,
    ...(description === undefined ? {} : { description }),
    url: canonical,
    mainEntityOfPage: canonical,
    // The dates the page itself prints (SPEC §7, 2026-09-29).
    datePublished: page.firstPublishedAt.toISOString(),
    dateModified: page.publishedAt.toISOString(),
    inLanguage: PAGE_LOCALE,
    publisher: {
      "@type": "Organization",
      name: page.publisher.name,
      url: `https://${page.publisher.name}`,
    },
  });
}

/** `FAQPage` from the stored section, or nothing at all. */
function faqSchema(page: HostedPage, canonical: string): string | null {
  if (page.faq.length === 0) return null;
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${canonical}#faq`,
    mainEntity: page.faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  });
}

/** The source's host and path, without the scheme, the query or a trailing
 *  slash: `example.org/tools-compared`. An address that will not parse is
 *  shown as it was recorded. */
function sourceOf(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}

/** The set's source line, or `null` for a page generation recorded no
 *  grounding for. The address stands in for the set's `[source title]`:
 *  what §8 records is where the fact was read, and a title we do not hold
 *  would have to be invented. */
function sourceLineFor(page: HostedPage): string | null {
  const grounded = page.grounded;
  if (grounded === null || grounded.url === "") return null;
  if (grounded.readAt === null) return null;
  return copy("hosted.source", {
    source: sourceOf(grounded.url),
    date: writeDate(grounded.readAt, page.publisher.timeZone),
  });
}

/** The words of a heading or title, for comparing the two: case, spacing
 *  and a trailing full stop or colon do not make them different. */
function titleKey(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[.:]$/, "").toLowerCase();
}

/** The body without a leading heading that repeats the page's title (SPEC
 *  §7, 2026-09-29): the title is the page's one `<h1>`, printed above the
 *  body, and a writer that also opens the body with it prints it twice. */
function withoutRepeatedTitle(blocks: readonly Block[], title: string): Block[] {
  const [first, ...rest] = blocks;
  if (first?.kind === "heading" && titleKey(inlineText(first.children)) === titleKey(title)) {
    return rest;
  }
  return [...blocks];
}

/** How many words a minute the reading time assumes. */
const WORDS_A_MINUTE = 220;

/** The page's reading time in whole minutes, never less than one. */
function readingMinutes(bodyMd: string): number {
  const words = bodyMd.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  return Math.max(1, Math.round(words / WORDS_A_MINUTE));
}

/** How many related guides an article's foot shows: one row of cards. */
const RELATED_GUIDES = 3;

/** The site's other live pages closest to this one's topic, then newest —
 *  `others` is already newest first and the sort is stable. */
function relatedGuides(page: HostedPage, others: readonly HostedPage[]): HostedPage[] {
  const about = `${page.title} ${page.record.targetQuery}`;
  return others
    .map((other) => ({ other, score: topicSimilarity(about, other.title) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, RELATED_GUIDES)
    .map(({ other }) => other);
}

/** The headings a table of contents lists: the body's sections and the
 *  one level under them. A page with a single section draws none. */
function contentsOf(headings: readonly HeadingEntry[]): HeadingEntry[] {
  const listed = headings.filter((heading) => heading.level === 2 || heading.level === 3);
  return listed.length < 2 ? [] : listed;
}

function Contents({ headings }: { headings: readonly HeadingEntry[] }): React.JSX.Element {
  return (
    <ul className="menu menu-sm w-full p-0">
      {headings.map((heading) => (
        <li key={heading.id} className={heading.level === 3 ? "pl-3" : undefined}>
          <a href={`#${heading.id}`} className="text-base-content/70 whitespace-normal">
            {heading.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** One value from a query string that may repeat. A repeated `utm_source`
 *  is a malformed link, not two claims; the first is read and the rest are
 *  ignored. */
function firstOf(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * SPEC §6 (2026-09-20, #908) measure (d) · SPEC §7 of the same date, issue
 * #921 — count this read of this page, after the response has gone.
 *
 * **The three strings are read here, in the render, and never inside
 * `after()`.** A Server Component may not call `headers()` from an `after`
 * callback (Next 16's own rule for the API: request data is read during the
 * component's lifecycle and passed in), and — more to the point — they are
 * not what is passed in. `classifyBlogRead` reduces them to one
 * `{ engine, kind }` or to nothing before the callback is even scheduled,
 * so the agent string, the referrer and the query never reach the store and
 * cannot be written by accident. §7: "no cookie, no visitor identity …
 * nothing else about a visit is kept."
 *
 * **Ordinary traffic schedules nothing.** A request that is neither an AI
 * engine nor an AI referral classifies as `null` and this function returns
 * before `after()` is called at all — no module is resolved, no connection
 * is opened, nothing is queued behind the response.
 *
 * **The store is imported at the call.** A page nobody counted never
 * resolves `@/lib/db`.
 */
async function countBlogRead(
  page: HostedPage,
  query: Record<string, string | string[] | undefined> | undefined
): Promise<void> {
  const head = await headers();
  const read = classifyBlogRead({
    userAgent: head.get("user-agent"),
    referer: head.get("referer"),
    utmSource: firstOf(query?.["utm_source"]),
  });
  if (read === null) return;

  after(async () => {
    const { recordBlogRead } = await import("@/lib/publish/reads/store");
    const { now } = await import("@/lib/config/now");
    await recordBlogRead({
      siteId: page.siteId,
      publicationId: page.publicationId,
      at: now(),
      read,
    });
  });
}

export default async function HostedPageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const { slug } = await params;
  if (isIndex(slug)) {
    const index = await loadIndex();
    // An unknown or stopped Host has no index either: the same 404.
    if (index === null) notFound();
    const search = await searchParams;
    return <HostedIndex {...index} query={queryOf(search?.q)} page={pageOf(search?.page)} />;
  }
  if (slug === undefined) notFound();
  const segment = oneSegment(slug);
  const resolved = segment === null ? null : await load(segment);
  // An unknown Host, an address this site never published at, and a page in
  // any state but live all end here: 404, and never another customer's
  // page, never a ReachKit page, never a fallback.
  if (resolved === null) notFound();

  const { page, canonical, others, business } = resolved;
  // Counted before anything is rendered and written after everything is
  // sent: the classification needs this request's own headers, and the
  // write must not stand between the reader and the page.
  await countBlogRead(page, await searchParams);
  const article = articleSchema(page, canonical);
  const faq = faqSchema(page, canonical);
  // The one Markdown renderer (`markdown.ts`), which escapes every text
  // node on the way out — so a body cannot introduce markup and this
  // string is safe to set as HTML by construction rather than by a
  // sanitiser someone has to remember to call. A second renderer here is
  // exactly what that module's header forbids.
  const levelled = headingsUnderTitle(withoutRepeatedTitle(parseMarkdown(page.bodyMd), page.title));
  const grounded = page.grounded;
  // The mark first, the ids after: an id is minted from a heading's words
  // and the mark changes none of them.
  const { blocks, headings } = withHeadingIds(
    grounded === null ? levelled : markPassage(levelled, grounded.passage).blocks
  );
  const body = toHtml(blocks, HOSTED_BODY_CLASSES);
  const contents = contentsOf(headings);
  const sourceLine = sourceLineFor(page);
  // Related guides: the site's own live pages on this host, minted by
  // `guidesBlock` (SPEC §7, 2026-09-20: "chosen in code, never by the
  // model") and drawn by the one serialiser, as cards.
  const guides = toHtml(
    [
      guidesBlock({
        publisher: business.name,
        items: relatedGuides(page, others).map((other) => ({ href: other.liveUrl, label: other.title })),
      }),
    ],
    HOSTED_GUIDES_CLASSES
  );
  const tocLabel = copy("hosted.toc");

  return (
    <Surface
      arms={{
        // **Declared, not one column** (issue #375). A single-column arm
        // caps the whole surface at `--w-read`, which is right for the
        // article and wrong for everything around it. `declared` takes no
        // measure and no gutter, so the widths on this screen are the
        // screen's own: the frame at `max-w-5xl`, the article at
        // `max-w-2xl`, and from `lg` the table of contents beside it.
        compact: { kind: "declared", note: "their header, the article at max-w-2xl, their footer" },
        medium: { kind: "same-as-below" },
        wide: { kind: "declared", note: "the article with a sticky table of contents beside it" },
      }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: article }} />
      {faq === null ? null : (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faq }} />
      )}

      <HostedHeader business={business} />

      <main className="mx-auto w-full max-w-5xl px-4 py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-10">
        <article className="mx-auto w-full max-w-2xl min-w-0">
          {page.publisher.category === null ? null : (
            <span className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">
              {page.publisher.category}
            </span>
          )}
          <h1 className="text-base-content my-3 text-4xl font-extrabold tracking-tight text-balance">
            {page.title}
          </h1>
          {/* SPEC §7 (2026-09-29): the text face, not mono. The byline setup
              recorded, else the business's name; the day the address first
              carried a page, and the day it was last refreshed where it has
              been; and the reading time. */}
          <p className="text-base-content/70 text-sm">
            <time dateTime={page.firstPublishedAt.toISOString().slice(0, 10)}>
              {bylineLine({
                byline: page.byline ?? business.name,
                published: page.firstPublishedAt,
                updated: page.publishedAt,
                timeZone: page.publisher.timeZone,
              })}
            </time>
            <span className="before:mx-1.5 before:content-['·']">
              {copy("hosted.readingTime", { minutes: String(readingMinutes(page.bodyMd)) })}
            </span>
          </p>

          <hr className="border-base-300 my-6" />

          {/* Below `lg` the table of contents is a block that opens: a
              `<details>`, so it works with no script. */}
          {contents.length === 0 ? null : (
            <details className="collapse-arrow bg-base-200 collapse mb-6 lg:hidden">
              <summary className="collapse-title font-semibold">{tocLabel}</summary>
              <nav className="collapse-content" aria-label={tocLabel}>
                <Contents headings={contents} />
              </nav>
            </details>
          )}

          {/* The body, with §8's recorded passage marked where it is still
              in the text. `markPassage` is the same call the draft screen
              makes, so what the customer approved and what a visitor reads
              are marked alike; a passage that no longer occurs marks
              nothing rather than marking the nearest thing to it. */}
          {/* SPEC §7 (2026-09-20, issue 929): `prose` — the article
              typography `docs/DESIGN.md` admits for exactly this.
              `max-w-none` because the column's measure is the article's
              already, and a second one would narrow it again. */}
          <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: body }} />
          {/* The text face, not mono: it is a sentence, and the address
              in it is a host and a path rather than a URL to copy. */}
          {sourceLine === null ? null : (
            <p className="text-base-content/70 mt-8 text-sm wrap-anywhere">{sourceLine}</p>
          )}

          <AboutCard business={business} />

          {guides === "" ? null : <div dangerouslySetInnerHTML={{ __html: guides }} />}

          {/* The site, the blog and the page. The list wraps, so a long
              title folds under the other two instead of scrolling. */}
          <nav className="breadcrumbs mt-10 overflow-visible text-sm" aria-label={copy("hosted.breadcrumb")}>
            <ul className="flex-wrap whitespace-normal">
              <li>
                <a href={mainSiteOf(business)}>{business.name}</a>
              </li>
              <li>
                <a href={INDEX_PATH}>{copy("hosted.index.heading")}</a>
              </li>
              <li aria-current="page" className="text-base-content/70 min-w-0">
                {page.title}
              </li>
            </ul>
          </nav>
        </article>

        {contents.length === 0 ? null : (
          <nav className="sticky top-6 hidden self-start lg:block" aria-label={tocLabel}>
            <p className="eyebrow mb-2">{tocLabel}</p>
            <Contents headings={contents} />
          </nav>
        )}
      </main>

      <HostedFooter business={business} />
    </Surface>
  );
}
