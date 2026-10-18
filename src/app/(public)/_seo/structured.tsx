// Issue 1512 — what reachkit.app's own pages tell a machine about
// themselves: the Organization and WebSite on the landing, and an Article
// and its breadcrumb on each library page.
//
// **Hygiene, not a lever**, as on a hosted page (SPEC §7, 2026-10-17, issue
// 1489): each block restates what the page visibly shows. A name is the
// wordmark the header prints, a headline is the page's `<h1>`, a date is
// the date the page prints, a breadcrumb part is a link the page draws, and
// the `logo` is the mark the page shows. `sameAs` is absent: the site links
// to no profile of its own.
//
// **One Organization.** Its `@id` is the one a hosted page of ReachKit's
// own site names as its publisher (issue 1511, `organizationIdOf`: the main
// site's declared `@id`, else `{home}#organization`), so the content host
// and the main site state one entity. The home is the product's own domain
// on every deployment, as `PREVIEW_HOST_SUFFIX` is, not this deployment's
// address.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { PREVIEW_HOST_SUFFIX } from "@/lib/config/constants";
import { jsonLd } from "@/app/(hosted)/hosted-page/[[...slug]]/seo";
import { canonicalUrl } from "../_chrome/canonical";

/** ReachKit's own home, and the entity that is ReachKit. */
export const OWN_HOME = `https://${PREVIEW_HOST_SUFFIX}/`;
export const ORGANIZATION_ID = `${OWN_HOME}#organization`;
const WEBSITE_ID = `${OWN_HOME}#website`;
/** The mark, as the 180-pixel PNG every public page links as its icon. */
const LOGO = `${OWN_HOME}apple-icon.png`;
/** The group's share card at its fixed address (`share-card/route.tsx`). */
export const SHARE_CARD_PATH = "/share-card";

const SCHEMA_CONTEXT = "https://schema.org";
/** Bound to a name: the copy sweep reads a bare JSX attribute as voice. */
const LD_TYPE = "application/ld+json";

/** The page's structured data, one script per block. */
export function JsonLd(p: { blocks: readonly string[] }): React.JSX.Element {
  return (
    <>
      {p.blocks.map((block) => (
        <script key={block} type={LD_TYPE} dangerouslySetInnerHTML={{ __html: block }} />
      ))}
    </>
  );
}

function organization(): Record<string, unknown> {
  return { "@type": "Organization", "@id": ORGANIZATION_ID, name: copy("chrome.wordmark"), url: OWN_HOME };
}

/** The landing's two blocks: who ReachKit is, and the site it publishes. */
export function homeSchemas(): string[] {
  return [
    jsonLd({
      "@context": SCHEMA_CONTEXT,
      ...organization(),
      logo: { "@type": "ImageObject", url: LOGO },
    }),
    jsonLd({
      "@context": SCHEMA_CONTEXT,
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name: copy("chrome.wordmark"),
      url: OWN_HOME,
      publisher: { "@id": ORGANIZATION_ID },
    }),
  ];
}

/** A link the page draws: its words and where it goes. */
export interface Crumb {
  readonly name: string;
  readonly path: string;
}

/**
 * A library page's two blocks: the `Article` and its `BreadcrumbList`.
 *
 * `published` is given only where the page prints when it was written (a
 * teardown); `modified` is the date it prints last, the day its facts were
 * checked or revised. `trail` is the links the page draws to its parents —
 * the header's mark home, then the index its back link names — and the page
 * itself is the last part. Nothing at all where no origin is bound: an
 * address composed on a guess is worse than none, as the canonical is.
 */
export function articleSchemas(a: {
  path: string;
  headline: string;
  published?: string;
  modified: string;
  trail: readonly Crumb[];
}): string[] {
  const canonical = canonicalUrl(a.path);
  const image = canonicalUrl(SHARE_CARD_PATH);
  if (canonical === null || image === null) return [];
  const parts = [...a.trail, { name: a.headline, path: a.path }];
  return [
    jsonLd({
      "@context": SCHEMA_CONTEXT,
      "@type": "Article",
      "@id": `${canonical}#article`,
      headline: a.headline,
      url: canonical,
      mainEntityOfPage: canonical,
      ...(a.published === undefined ? {} : { datePublished: a.published }),
      dateModified: a.modified,
      inLanguage: "en",
      image,
      author: organization(),
      publisher: organization(),
    }),
    jsonLd({
      "@context": SCHEMA_CONTEXT,
      "@type": "BreadcrumbList",
      itemListElement: parts.map((part, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: part.name,
        item: canonicalUrl(part.path),
      })),
    }),
  ];
}

/** The first part of every trail: the header's mark, which links home. */
export function homeCrumb(): Crumb {
  return { name: copy("chrome.wordmark"), path: "/" };
}
