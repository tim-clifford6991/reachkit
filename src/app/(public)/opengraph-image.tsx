// BUILD §3 — the share image every public route unfurls as.
// src/app/(public)/opengraph-image.tsx — issue #326
//
// One picture for the whole group. Next resolves file-based metadata down
// the segment tree, so this file gives `/`, `/pricing`, `/signin`, the
// three legal pages and the two token pages an `og:image` — and, because
// `resolve-metadata.js` fills a `twitter` block's images from the resolved
// Open Graph ones, a `twitter:image` too — with no per-route edit. Same
// reason the header and footer live in the group layout; and
// `scan/[domain]/opengraph-image.tsx` overrides it for the one route that
// has a number to show.
//
// **It is inside the group on purpose.** A file at the `src/app/` root
// would put ReachKit's share image on `(hosted)` too, and a hosted page is
// the customer's site, not ours (BUILD §9, §14 guardrail 6). The cost is
// that Next gives a metadata route under a route group a six-character
// hash suffix — `/opengraph-image-<hash>` rather than `/opengraph-image`
// (`next/dist/esm/lib/metadata/get-metadata-route.js`) — which is why
// `src/middleware.ts` recognises this class of address by shape rather
// than by literal path.
//
// **It says only the brand and the address.** Every other sentence a public
// route owes is a `TODO(copy)` key (`keys/meta.ts`); a marker rendered
// 32 px tall into a picture posted somewhere we cannot edit is not what
// the marker is for. The origin is written because it is a value, not a
// sentence — the address this deployment answers on — and it is omitted
// rather than guessed where no origin is bound at build time.
//
// Static: nothing here depends on a request, so the image is rendered once
// at build and served from the cache.
import { ImageResponse } from "next/og";
import { copy } from "@/lib/presentation/copy";
import { PUBLIC_ORIGIN } from "./_chrome/canonical";
import { OG_CONTENT_TYPE, OG_SIZE, OgAddress, OgCard } from "./_seo/og-card";

export const alt = copy("meta.og.alt");
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** The deployment's own hostname, or nothing at all. */
function originHost(): string | null {
  if (PUBLIC_ORIGIN === undefined) return null;
  try {
    return new URL(PUBLIC_ORIGIN).hostname;
  } catch {
    return null;
  }
}

export default function Image(): ImageResponse {
  const host = originHost();
  return new ImageResponse(<OgCard>{host === null ? <div /> : <OgAddress address={host} />}</OgCard>, {
    ...OG_SIZE,
  });
}
