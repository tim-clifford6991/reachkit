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
// **The page is the customer's, and the set draws whose** (UI-SPEC S19,
// issue #375). Their mark and their name at the top, the category they
// chose as the eyebrow, their own byline under the title, and their footer
// line at the bottom — §14.6's "customer is publisher of record: their
// domain, their identity", rendered. The title and the body are their page
// — the one place in the product generated prose is rendered (REQ-093 c2,
// `GeneratedText`) — and every other value on the surface is theirs too.
//
// **Three sentences, and they are structure rather than voice.** The
// byline, the source line and the canonical note are the only strings of
// ours, all three written unbracketed in the approved set and therefore
// approved copy under ruling 11a. They read as keys like every other
// sentence in the product (`publish.ts`'s `hosted.*`), and none of them
// names ReachKit except the one the set itself writes: the canonical note,
// which states the guardrail §9 and §14 fix — customer content never ranks
// on our domain — where a reader of the page can check it. There is no
// heading of ours, no navigation, no link to us and no wordmark.
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
import { BODY_CLASSES } from "@/app/(account)/app/draft/[draftId]/present";
import { copy } from "@/lib/presentation/copy";
import {
  markPassage,
  parseMarkdown,
  toHtml,
  type Block,
  type Inline,
} from "@/lib/publish/render/markdown";
import {
  liveUrlOnHost,
  livePageBySlug,
  livePagesForSite,
  type HostedPage,
} from "@/lib/publish/destinations/hosted";
import { Surface } from "@/ui/layout";
import { resolveHost } from "../../resolve-host";
import { HostedIndex, queryOf } from "./listing";
import { hostOf, PAGE_LOCALE, QUIET_LINE, writeDate } from "./present";

/** Nothing on this surface is cached (WO-028's NFR): a publication row that
 *  changes is read again on the very next request, so a takedown never
 *  waits on a TTL and a 410 is never served from a stale cache. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Resolved {
  page: HostedPage;
  canonical: string;
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

  const page = await livePageBySlug(disposition.siteId, slug);
  if (page === null) return null;
  return {
    page,
    // Always the customer's own domain, composed from the one composer
    // (`liveUrlOnHost`, which `liveUrlFor` is itself written in terms of).
    // The host is the one that resolved — the label is the customer's
    // since SPEC §5's ruling of 2026-09-12 — so the canonical names the
    // address the visitor actually typed and never a recomposed guess at
    // it. There is no argument to it that yields a ReachKit address.
    canonical: liveUrlOnHost({ host: disposition.host, slug: page.slug }),
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
  publisher: string;
  canonical: string;
  pages: HostedPage[];
}

/** The index's one resolution per request: the site this Host serves and
 *  every live page of it, or `null` for any Host that is not a site. */
const loadIndex = cache(async (): Promise<IndexResolved | null> => {
  const host = (await headers()).get("host") ?? "";
  const disposition = await resolveHost(host);
  if (disposition.kind !== "site") return null;
  return {
    publisher: disposition.domain,
    canonical: `https://${disposition.host}/`,
    pages: await livePagesForSite(disposition.siteId),
  };
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
      title: `${copy("hosted.index.heading")} · ${index.publisher}`,
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

function inlineText(inlines: readonly Inline[]): string {
  return inlines
    .map((inline) => ("children" in inline ? inlineText(inline.children) : inline.text))
    .join("");
}

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
    datePublished: page.publishedAt.toISOString(),
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

/** The set's source line, or `null` for a page generation recorded no
 *  grounding for. The address stands in for the set's `[source title]`:
 *  what §8 records is where the fact was read, and a title we do not hold
 *  would have to be invented. */
function sourceLineFor(page: HostedPage): string | null {
  const grounded = page.grounded;
  if (grounded === null || grounded.url === "") return null;
  if (grounded.readAt === null) return null;
  return copy("hosted.source", {
    source: grounded.url,
    date: writeDate(grounded.readAt, page.publisher.timeZone),
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
    const query = queryOf((await searchParams)?.q);
    return <HostedIndex {...index} query={query} />;
  }
  if (slug === undefined) notFound();
  const segment = oneSegment(slug);
  const resolved = segment === null ? null : await load(segment);
  // An unknown Host, an address this site never published at, and a page in
  // any state but live all end here: 404, and never another customer's
  // page, never a ReachKit page, never a fallback.
  if (resolved === null) notFound();

  const { page, canonical } = resolved;
  const article = articleSchema(page, canonical);
  const faq = faqSchema(page, canonical);
  // The one Markdown renderer (`markdown.ts`), which escapes every text
  // node on the way out — so a body cannot introduce markup and this
  // string is safe to set as HTML by construction rather than by a
  // sanitiser someone has to remember to call. A second renderer here is
  // exactly what that module's header forbids.
  const blocks = parseMarkdown(page.bodyMd);
  const grounded = page.grounded;
  const body = toHtml(
    grounded === null ? blocks : markPassage(blocks, grounded.passage).blocks,
    BODY_CLASSES
  );
  const sourceLine = sourceLineFor(page);

  return (
    <Surface
      arms={{
        // **Declared, not one column** (issue #375). A single-column arm
        // caps the whole surface at `--w-read`, which is right for the
        // article and wrong for everything around it: the customer's bar
        // and their footer line are the width of their page, and the set
        // draws both as rules across the top and the bottom. `declared`
        // takes no measure and no gutter, so the three widths on this
        // screen are the screen's own — the bar and the footer at
        // `max-w-6xl`, the article at `max-w-2xl`.
        compact: { kind: "declared", note: "their bar, the article at max-w-2xl, their footer" },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: article }} />
      {faq === null ? null : (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faq }} />
      )}

      {/* The customer's own bar: their mark, their name, and the address
          this page answers at. Not a `<nav>` and not a link — there is
          nowhere on their site for us to send a reader. */}
      <header className="border-base-300 mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 border-b px-4 py-3">
        <span className="text-base-content mr-auto flex min-w-0 items-center gap-2 font-extrabold tracking-tight">
          <span className="bg-base-content size-4 shrink-0 rounded-full" aria-hidden />
          <span>{page.publisher.name}</span>
        </span>
        <span className={QUIET_LINE}>{hostOf(canonical)}</span>
      </header>

      <main>
        <article className="mx-auto w-full max-w-2xl px-5 py-12">
          {page.publisher.category === null ? null : (
            <span className="text-base-content/60 text-xs font-semibold tracking-wide uppercase">
              {page.publisher.category}
            </span>
          )}
          <h1 className="text-base-content my-3 text-4xl font-extrabold tracking-tight text-balance">
            {page.title}
          </h1>
          <p className={QUIET_LINE}>
            <time dateTime={page.publishedAt.toISOString().slice(0, 10)}>
              {copy("hosted.published", {
                date: writeDate(page.publishedAt, page.publisher.timeZone),
                publisher: page.publisher.name,
              })}
            </time>
          </p>

          <hr className="border-base-300 my-6" />

          {/* The body, with §8's recorded passage marked where it is still
              in the text. `markPassage` is the same call the draft screen
              makes, so what the customer approved and what a visitor reads
              are marked alike; a passage that no longer occurs marks
              nothing rather than marking the nearest thing to it. */}
          <div className="text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: body }} />
          {sourceLine === null ? null : <p className={QUIET_LINE}>{sourceLine}</p>}

          <hr className="border-base-300 my-6" />

          <p className={QUIET_LINE}>
            {copy("hosted.canonical", {
              domain: page.publisher.name,
              canonical,
            })}
          </p>
        </article>
      </main>

      {/* Their line, and nothing of ours beside it. The imprint half is the
          customer's to state and no column carries one yet. */}
      <footer className="border-base-300 mx-auto w-full max-w-6xl border-t px-4 py-6">
        <span className={QUIET_LINE}>
          {copy("hosted.footer", { publisher: page.publisher.name })}
        </span>
      </footer>
    </Surface>
  );
}
