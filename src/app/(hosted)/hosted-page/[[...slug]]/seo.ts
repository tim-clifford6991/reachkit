// SPEC §7 (2026-09-29, issue 1141) — what a hosted page tells a machine
// about itself: the share tags, the structured data, the feed link.
//
// **Hygiene, not a lever.** The structured data restates what the page
// visibly shows and nothing else: the title, the byline, the two dates, the
// business in the header, the three parts of the breadcrumb, and on the
// index the cards it lists. Markup that says more than the page does can be
// read as spam, on a domain that is not ours.
//
// Every address here is on the customer's own host. None names ReachKit.
import type { Metadata } from "next";
import { copy, readerTag } from "@/lib/presentation/copy/reader";
import type { HostedPage } from "@/lib/publish/destinations/hosted";
import { OG_SIZE } from "@/app/(public)/_seo/og-card";
import { INDEX_PATH, LOGO_PATH, mainSiteOf, type HostedBusiness } from "./chrome";

/** The feed, on the customer's own host (`../rss.xml`). */
export const FEED_PATH = "/rss.xml";
/** The generated share image (`../share.img`): the index's at the path
 *  itself, a page's one segment under it. The name carries a dot, which no
 *  page's address does, so it can never stand in front of a page. */
export const SHARE_IMAGE_PATH = "/share.img";

const FEED_TYPE = "application/rss+xml";
const SCHEMA_CONTEXT = "https://schema.org";

/** `https://{host}`, off an address already composed on that host. */
export function originOf(address: string): string {
  return new URL(address).origin;
}

export function shareImageUrl(origin: string, slug: string | null): string {
  return slug === null
    ? `${origin}${SHARE_IMAGE_PATH}`
    : `${origin}${SHARE_IMAGE_PATH}/${encodeURIComponent(slug)}`;
}

/** The index's title, which is also the feed's name in a reader. */
export function indexTitle(business: HostedBusiness): string {
  return `${copy("hosted.index.heading")} · ${business.name}`;
}

/** How long a description is (SPEC §7, D51 and D53): a search result shows
 *  about this much, and a shorter one is replaced by a snippet. */
const DESCRIPTION = { min: 120, max: 155 } as const;
const ELLIPSIS = "…";

/** A line as one closed sentence: one space between words, a capital first,
 *  and a full stop where it ends on none. */
function sentenceOf(line: string): string {
  const text = line.replace(/\s+/g, " ").trim();
  if (text === "") return "";
  const closed = /[.!?]$/.test(text) ? text : `${text}.`;
  return closed.charAt(0).toUpperCase() + closed.slice(1);
}

/**
 * The index's description (D53, issue 1268): what the business does, then
 * what this page of it is, in 120–155 characters. It is written from the
 * business's line and never from an answer to a setup question. A line too
 * long for a result is cut at a word; a business with no line has the one
 * sentence it can honestly have, and nothing is padded to reach the length.
 */
export function indexDescription(business: HostedBusiness): string {
  const lead = copy("hosted.index.description", { publisher: business.name });
  const does = sentenceOf(business.line ?? "");
  if (does === "") return lead;
  if (does.length > DESCRIPTION.max) {
    const cut = does.slice(0, DESCRIPTION.max - ELLIPSIS.length);
    return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.]$/, "")}${ELLIPSIS}`;
  }
  const both = `${does} ${lead}`;
  return does.length < DESCRIPTION.min && both.length <= DESCRIPTION.max ? both : does;
}

/** A schema object as a script body. Next's own JSON-LD guidance:
 *  `JSON.stringify` does not escape a `<`, and every value here is
 *  customer- or model-written text. */
export function jsonLd(schema: Record<string, unknown>): string {
  return JSON.stringify(schema).replace(/</g, "\\u003c");
}

/** What separates a name from its line in a byline: "Tim Clifford ·
 *  Founder, ReachKit" (SPEC §7, 2026-09-29) — or the comma or dash a founder
 *  typed instead: "Tim, Founder based in Berlin" (D53, issue 1268). The
 *  middle dot is the form setup shows, so it is read first. */
const BYLINE_SEPARATORS = [/\s+·\s+/, /\s+[–—|-]\s+/, /,\s+/] as const;

/** Where a line says the person is: "… based in Berlin, Germany". */
const PLACE = /(?:^|[\s,]+)(?:based|located|living)\s+in\s+(.+)$/i;

/** A byline as a person: the name, then what the line says they do and,
 *  where it states one, where they are. Nothing the byline does not say. */
export function personOf(byline: string): { name: string; jobTitle: string | null; place: string | null } {
  const said = byline.replace(/\s+/g, " ").trim();
  const separator = BYLINE_SEPARATORS.find((candidate) => candidate.test(said));
  const at = separator === undefined ? null : separator.exec(said);
  const name = at === null ? said : said.slice(0, at.index).trim();
  const line = at === null ? "" : said.slice(at.index + at[0].length).trim();
  const where = PLACE.exec(line);
  const jobTitle = (where === null ? line : line.slice(0, where.index)).replace(/[\s,;]+$/, "");
  const place = where?.[1]?.replace(/[\s.]+$/, "") ?? "";
  return { name, jobTitle: jobTitle === "" ? null : jobTitle, place: place === "" ? null : place };
}

/** The author the page prints. A page with no recorded byline prints the
 *  business's name, and is authored by the business; a recorded one is the
 *  founder's own name, with their line where they gave one. */
function authorOf(byline: string | null, business: HostedBusiness): Record<string, unknown> {
  const said = byline?.trim() ?? "";
  if (said === "" || said === business.name || said === business.domain) {
    return { "@type": "Organization", name: business.name, url: mainSiteOf(business) };
  }
  const person = personOf(said);
  return {
    "@type": "Person",
    name: person.name,
    ...(person.jobTitle === null ? {} : { jobTitle: person.jobTitle }),
    ...(person.place === null ? {} : { workLocation: { "@type": "Place", name: person.place } }),
  };
}

/** The business in the header, with its logo where one is kept. */
function publisherOf(business: HostedBusiness, origin: string): Record<string, unknown> {
  return {
    "@type": "Organization",
    name: business.name,
    url: mainSiteOf(business),
    ...(business.logoType === null
      ? {}
      : { logo: { "@type": "ImageObject", url: `${origin}${LOGO_PATH}` } }),
  };
}

/** `BlogPosting`, on every article: what the page is, from what it states.
 *  It carries no `description`: the meta description is written for a
 *  search result and the page does not print it, so stating it here would
 *  be text the reader cannot see (SPEC §7, 2026-10-17, issue 1489). */
export function blogPostingSchema(a: {
  page: HostedPage;
  canonical: string;
  business: HostedBusiness;
}): string {
  const origin = originOf(a.canonical);
  return jsonLd({
    "@context": SCHEMA_CONTEXT,
    "@type": "BlogPosting",
    "@id": `${a.canonical}#article`,
    // The heading a reader sees (D51); the `<title>` is the search form.
    headline: a.page.heading ?? a.page.title,
    url: a.canonical,
    mainEntityOfPage: a.canonical,
    // The dates the page itself prints (SPEC §7, 2026-09-29).
    datePublished: a.page.firstPublishedAt.toISOString(),
    dateModified: a.page.publishedAt.toISOString(),
    inLanguage: readerTag(),
    image: shareImageUrl(origin, a.page.slug),
    author: authorOf(a.page.byline, a.business),
    publisher: publisherOf(a.business, origin),
  });
}

/** The breadcrumb the article draws at its foot, part for part: the site,
 *  the blog and the page. */
export function breadcrumbSchema(a: {
  page: HostedPage;
  canonical: string;
  business: HostedBusiness;
}): string {
  const parts = [
    { name: a.business.name, item: mainSiteOf(a.business) },
    { name: copy("hosted.index.heading"), item: `${originOf(a.canonical)}${INDEX_PATH}` },
    { name: a.page.title, item: a.canonical },
  ];
  return jsonLd({
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: parts.map((part, index) => ({
      "@type": "ListItem",
      position: index + 1,
      ...part,
    })),
  });
}

/** `Blog` with its `WebSite`, on the index: the business the index is
 *  headed by, and the pages this page of it lists — no others. */
export function blogSchema(a: {
  business: HostedBusiness;
  canonical: string;
  listed: readonly HostedPage[];
}): string {
  const origin = originOf(a.canonical);
  const site = `${a.canonical}#website`;
  return jsonLd({
    "@context": SCHEMA_CONTEXT,
    "@graph": [
      { "@type": "WebSite", "@id": site, url: a.canonical, name: a.business.name, inLanguage: readerTag() },
      {
        "@type": "Blog",
        "@id": `${a.canonical}#blog`,
        url: a.canonical,
        name: a.business.name,
        description: indexDescription(a.business),
        inLanguage: readerTag(),
        isPartOf: { "@id": site },
        publisher: publisherOf(a.business, origin),
        blogPost: a.listed.map((page) => ({
          "@type": "BlogPosting",
          headline: page.title,
          url: page.liveUrl,
          dateModified: page.publishedAt.toISOString(),
        })),
      },
    ],
  });
}

/** The `<link rel="alternate">` to the feed, beside the canonical. */
function alternatesOf(canonical: string, business: HostedBusiness): Metadata["alternates"] {
  return {
    canonical,
    types: { [FEED_TYPE]: [{ url: `${originOf(canonical)}${FEED_PATH}`, title: indexTitle(business) }] },
  };
}

/** The share tags both kinds of page carry: the card a pasted link draws. */
function shareTags(a: {
  canonical: string;
  title: string;
  description: string | undefined;
  business: HostedBusiness;
  image: string;
}): Pick<Metadata, "twitter"> & { openGraph: Record<string, unknown> } {
  const described = a.description === undefined ? {} : { description: a.description };
  return {
    openGraph: {
      url: a.canonical,
      title: a.title,
      ...described,
      siteName: a.business.name,
      locale: readerTag().replace("-", "_"),
      images: [{ url: a.image, ...OG_SIZE, alt: a.title }],
    },
    twitter: { card: "summary_large_image", title: a.title, ...described, images: [a.image] },
  };
}

export function articleMetadata(a: {
  page: HostedPage;
  canonical: string;
  description: string | undefined;
  business: HostedBusiness;
}): Metadata {
  const share = shareTags({
    canonical: a.canonical,
    title: a.page.title,
    description: a.description,
    business: a.business,
    image: shareImageUrl(originOf(a.canonical), a.page.slug),
  });
  return {
    title: a.page.title,
    description: a.description,
    alternates: alternatesOf(a.canonical, a.business),
    openGraph: {
      ...share.openGraph,
      type: "article",
      publishedTime: a.page.firstPublishedAt.toISOString(),
      modifiedTime: a.page.publishedAt.toISOString(),
    },
    twitter: share.twitter,
  };
}

export function indexMetadata(a: { canonical: string; business: HostedBusiness }): Metadata {
  const title = indexTitle(a.business);
  const description = indexDescription(a.business);
  const share = shareTags({
    canonical: a.canonical,
    title,
    description,
    business: a.business,
    image: shareImageUrl(originOf(a.canonical), null),
  });
  return {
    title,
    description,
    alternates: alternatesOf(a.canonical, a.business),
    openGraph: { ...share.openGraph, type: "website" },
    twitter: share.twitter,
  };
}
