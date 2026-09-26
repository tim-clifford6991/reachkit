// BUILD §3 — the web app manifest, at the one address Next will serve it.
// src/app/manifest.ts — issue #326
//
// **It sits at the `src/app/` root because it cannot sit anywhere else.**
// Next matches `robots`, `manifest` and `favicon` with anchored patterns —
// `^[\\/]manifest…` in `next/dist/lib/metadata/is-metadata-route.js` — so a
// `manifest.ts` inside a route group is not recognised as a metadata route
// at all and is silently never served. `icon` and `opengraph-image` are
// matched unanchored; the icons sit beside this file at the root so every
// route names them (#1121), and the share image stays under `(public)`.
//
// The cost of the root is that Next writes `<link rel="manifest">` into
// every route's document, `(hosted)` included. Nothing of ours is served
// there: on a `content.` host `src/middleware.ts` rewrites every path but
// the two indexing documents into the hosted group, so
// `content.{domain}/manifest.webmanifest` answers that site's own 404 and
// no ReachKit string, colour or mark reaches a customer's page. Removing
// the tag from the hosted head is named under *Adjacent* in the PR.
//
// **Every sentence is a copy key and every colour is a token.** The name is
// `chrome.wordmark` — the same word the public header sets, read from its
// one home rather than typed again (rule 2.4) — and the description is the
// landing's, because the manifest and the landing's `<meta name=
// "description">` describe the same product to two readers. The two
// colours come from the resolved table `src/lib/mail/shell/tokens.ts`
// holds equal to `src/ui/theme.css`, for the same reason a mail reads it:
// a manifest is JSON and resolves no custom property.
//
// **Its icons are the stable files under `public/brand/`** (#1121), which
// `scripts/brand/render.mjs` writes from `src/lib/brand/mark.ts`. Next's
// own `icon` convention gives no fixed address a manifest can name; these
// have one. Without them Android draws its own tile — the plain violet
// square the owner saw. The maskable one is the chip to the edge with the
// dome inside the 80% safe zone, for launchers that crop to their shape.
import type { MetadataRoute } from "next";
import { copy } from "@/lib/presentation/copy";
import { token } from "@/lib/mail/shell/tokens";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: copy("chrome.wordmark"),
    short_name: copy("chrome.wordmark"),
    description: copy("meta.landing.description"),
    start_url: "/",
    display: "standalone",
    background_color: token("--bg"),
    theme_color: token("--color-primary"),
    icons: [
      { src: "/brand/mark-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/mark-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/mark-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
