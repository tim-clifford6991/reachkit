// BUILD §3 — the one composer of a public route's <head>.
// src/app/(public)/_seo/metadata.ts — issue #326
//
// Nine routes, one shape. Every `(public)` surface's `metadata` export is
// this function's return value and nothing else, so a route cannot ship
// with a title and no description, an Open Graph block that disagrees with
// the title above it, or a canonical address composed by hand.
//
// **The canonical address comes from `_chrome/canonical.ts`**, the module
// that already owns "the public origin, in a client bundle" for the
// header's copy control (REQ-001 c7). One origin, one reader: a second
// `new URL(…, process.env.NEXT_PUBLIC_APP_URL)` here would be a second
// place a wrong origin could come from. Where no origin is bound at build
// time the canonical and the Open Graph URL are simply absent — a `<link
// rel="canonical">` pointing at a guess is worse than none, which is the
// same judgement the header makes when it draws no copy control.
//
// **`metadataBase` is set on every route rather than at the root.** Next
// resolves a relative `og:image` — which is what the file-based share
// images below are — against it, and warns and falls back to
// `http://localhost:3000` in production when it is unset
// (`next/dist/esm/lib/metadata/resolvers/resolve-opengraph.js`). It cannot
// be set once in `(public)/layout.tsx`: that file is a Client Component
// (it reads the pathname to decide the header's arm) and Next reads
// `metadata` only from a Server Component. Setting it in the root layout
// would put it on `(hosted)` too, where a page's canonical is the
// customer's own domain and ours has no business being the base.
//
// **`robots` is the table's `indexable` flag and nothing else** — see
// `routes.ts` for why each of the four negative rows is negative. The two
// noindex routes that already carried the directive on their own page keep
// exactly the directive they had; what changed is that it is now derived
// from the same row the sitemap reads, so the two can no longer disagree.
// `next.config.ts` still carries the `X-Robots-Tag` half for those two
// paths — neither half is enough alone (ADR-002, REQ-001 c8).
//
// **The share image is not named here.** `opengraph-image.tsx` beside the
// public group, and the report's own beside its page, are Next's
// file-based metadata: it has higher priority than this object and is
// resolved against `metadataBase`, so naming an image here would be a
// second declaration that the file convention would then override. The
// Twitter card carries no image either, for a different reason — Next
// fills `twitter.images` from the resolved Open Graph images when a
// `twitter` block declares none (`resolve-metadata.js`), so the one file
// serves both cards.
import type { Metadata } from "next";
import { copy } from "@/lib/presentation/copy";
import { PUBLIC_ORIGIN, canonicalUrl } from "../_chrome/canonical";
import type { PublicRouteSeo } from "./routes";

/** The base every relative metadata URL — the generated share images
 *  included — is resolved against. Absent where no origin is bound, which
 *  is the same condition that leaves the canonical absent. */
function metadataBase(): URL | undefined {
  if (PUBLIC_ORIGIN === undefined) return undefined;
  try {
    return new URL(PUBLIC_ORIGIN);
  } catch {
    return undefined;
  }
}

/**
 * The `<head>` of one public route.
 *
 * `path` is the address as served — every dynamic segment filled — because
 * that is what a canonical address is: the one URL this response should be
 * indexed under. `vars` fills the row's copy slots; a row whose sentences
 * declare a slot (the report's `{domain}`) throws without it, which is the
 * point.
 */
export function publicMetadata(a: {
  seo: PublicRouteSeo;
  path: string;
  vars?: Record<string, string>;
}): Metadata {
  const title = copy(a.seo.title, a.vars);
  const description = copy(a.seo.description, a.vars);
  // A route *pattern* is not an address, so it gets no canonical: the two
  // token routes and the report's malformed arm pass their row's `{param}`
  // spelling because there is no one URL this response should be indexed
  // under — and for the token pair that is the better answer twice over,
  // because the path is the credential and a `<link rel="canonical">`
  // restating it would publish the stop link into the document.
  const canonical = a.path.includes("{") ? null : canonicalUrl(a.path);
  return {
    metadataBase: metadataBase(),
    title,
    description,
    alternates: canonical === null ? undefined : { canonical },
    openGraph: {
      type: "website",
      siteName: copy("chrome.wordmark"),
      title,
      description,
      ...(canonical === null ? {} : { url: canonical }),
    },
    // One card type across the product: every public route has a share
    // image (the group's, or the report's own), and `summary` would crop
    // the score out of the one that carries a number.
    twitter: { card: "summary_large_image", title, description },
    robots: a.seo.indexable ? undefined : { index: false, follow: false },
  };
}

/**
 * The `<head>` of a route with no dynamic segment: its own row, at its own
 * address. Six of the nine public rows are this, and writing
 * `{ seo: row, path: row.route }` six times would be six chances to pass
 * one route's row at another route's path.
 */
export function staticMetadata(seo: PublicRouteSeo): Metadata {
  return publicMetadata({ seo, path: seo.route });
}
