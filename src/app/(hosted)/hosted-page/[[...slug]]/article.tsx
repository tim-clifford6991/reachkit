// BUILD §9 — the hosted article: the page a live address draws, whichever
// route reaches it.
//
// Two routes draw it (issue 1242) and they must draw the same page:
// `hosted-live/[host]/[slug]`, which `src/middleware.ts` rewrites a live
// address to and which is cached, and `hosted-page/[[...slug]]`, the
// uncached route, which draws it only when the middleware could not
// confirm the address in time. The first is handed its host in its path;
// the second reads the Host header. Both resolve that host here, through
// the same `resolveHost`, so neither can serve a page its host does not
// serve now.
//
// What the page holds and why is `page.tsx`'s header, beside this file.
import { cache } from "react";
import type { Metadata } from "next";
import type React from "react";
import { HOSTED_BODY_CLASSES, HOSTED_GUIDES_CLASSES } from "../body-classes";
import { copy, readIn, readerLanguage, readerTag } from "@/lib/presentation/copy/reader";
import { localeTag } from "@/lib/locale/locales";
import { siteLocale } from "@/lib/locale/site";
import {
  guidesBlock,
  headingsUnderTitle,
  inlineText,
  markPassage,
  labelledIn,
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
import { bylineLine } from "@/lib/publish/render/byline";
import { writeDate } from "./present";
import { articleMetadata, blogPostingSchema, breadcrumbSchema, jsonLd } from "./seo";

export interface Resolved {
  page: HostedPage;
  canonical: string;
  /** The site's other live pages, newest first. */
  others: HostedPage[];
  business: HostedBusiness;
}

/** The business a resolved host belongs to, as its pages draw it. */
export async function businessOf(site: { siteId: string; domain: string }): Promise<HostedBusiness> {
  // D66: the blog is read in its site's own language. Said here, where the
  // host is resolved, so the listing, a page and their metadata all read it.
  const locale = await siteLocale(site.siteId);
  readIn(locale.language, localeTag(locale));
  return { ...(await hostedIdentity(site)), domain: site.domain };
}

/** One resolution per render, shared by `generateMetadata` and the page.
 *  `cache` is React's own render-scoped memo — not a data cache, and not
 *  a TTL — so the two entry points cannot disagree about which page they
 *  are describing, and the row is read once. */
export const loadArticle = cache(async (host: string, slug: string): Promise<Resolved | null> => {
  const disposition = await resolveHost(host);
  // Every other disposition is somebody else's answer: `unknown` is the
  // 404 each route falls through to, and `gone` is answered 410 by
  // `../../hosted-gone/route.ts`, which the middleware rewrites to before
  // either route is reached. A page never renders for either.
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

/** The article's `<head>`: its own title, description, canonical and share
 *  tags. */
export function articleHead(resolved: Resolved): Metadata {
  return articleMetadata({ ...resolved, description: descriptionOf(resolved.page) });
}

export function HostedArticle({ resolved }: { resolved: Resolved }): React.JSX.Element {
  const { page, canonical, others, business } = resolved;
  // What the page says about itself as data: always the posting and the
  // breadcrumb, and the questions only where the page has them.
  const faq = faqSchema(page, canonical);
  const dataBlocks = [
    blogPostingSchema({ page, canonical, business, description: descriptionOf(page) }),
    breadcrumbSchema({ page, canonical, business }),
    ...(faq === null ? [] : [faq]),
  ];
  // The one Markdown renderer (`markdown.ts`), which escapes every text
  // node on the way out — so a body cannot introduce markup and this
  // string is safe to set as HTML by construction rather than by a
  // sanitiser someone has to remember to call. A second renderer here is
  // exactly what that module's header forbids.
  const levelled = headingsUnderTitle(
    withoutRepeatedTitle(withoutRepeatedTitle(labelledIn(parseMarkdown(page.bodyMd), copy), page.title), page.heading ?? page.title)
  );
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
        say: copy,
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
      {dataBlocks.map((block) => (
        <script key={block} type="application/ld+json" dangerouslySetInnerHTML={{ __html: block }} />
      ))}

      <HostedHeader business={business} />

      <main lang={readerLanguage()} className="mx-auto w-full max-w-5xl px-4 py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-10">
        <article className="mx-auto w-full max-w-2xl min-w-0">
          {page.publisher.category === null ? null : (
            <span className="text-base-content/70 text-xs font-semibold tracking-wide uppercase">
              {page.publisher.category}
            </span>
          )}
          <h1 className="text-base-content my-3 text-4xl font-extrabold tracking-tight text-balance">
            {page.heading ?? page.title}
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
                say: copy,
                tag: readerTag(),
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
