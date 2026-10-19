// BUILD §9 — the hosted edge's document: the `<html>` every page on a
// customer's host is drawn in (issue 1514; until then `(hosted)/layout.tsx`,
// inside ReachKit's root document).
//
// §9: published pages "render through **one** clean typographic template
// (the §2 design system, light-only is acceptable), customisable later —
// never per-customer templates in MVP." This is that template's outer
// frame: a measure, a rhythm, and nothing else.
//
// **A document of its own, so the page can say what it is** (SPEC §7,
// 2026-10-18, issue 1514). `<html lang>` is the site's tag (D66), the one
// `inLanguage`, `og:locale` and the feed state, never a fixed English. It
// carries none of ReachKit's document: no theme script, no banner
// script, no answers stack. Every hosted response is served under a policy
// that runs no script of ours, and the page needs none (the theme follows
// the reader's system, as `theme.css` does with no choice stored).
//
// **It speaks no sentence and names no ReachKit.** The header, the
// navigation and the footer a visitor sees are the customer's own and are
// drawn by the page (SPEC §7, 2026-09-29, issue 1140); this frame adds no
// heading, link or name of ours to them — every response it wraps is served
// on a domain that is not ours.
//
// **No client JavaScript.** No `"use client"` here or anywhere in this
// group's module graph: the whole document is in the HTML at first byte,
// which is the property REQ-062 c1's crawler check exists to verify in the
// world.
//
// Tokens and type are ReachKit's own sheets (`src/ui/theme.css`,
// `type.css`, `tailwind.css`, `layout/layout.css`, `layout/surface.css`),
// imported here as `_root/document.tsx` imports them; this file introduces
// no stylesheet and no colour or size of its own.
import type React from "react";
import type { Metadata } from "next";
import { cache } from "react";

import "@/ui/theme.css";
import "@/ui/tailwind.css";
import "@/ui/type.css";
import "@/ui/layout/layout.css";
import "@/ui/layout/surface.css";
import { fontVariables } from "@/ui/fonts";
import { DEFAULT_LOCALE, localeTag } from "@/lib/locale/locales";
import { siteLocale } from "@/lib/locale/site";
import { normaliseHost, resolveHost } from "./resolve-host";

/** The language a host's pages are written in, as `<html lang>` states it:
 *  its site's tag (D66), and the default for a host that serves no site,
 *  whose 404 says nothing in any language. Once per render. */
export const hostedLanguageOf = cache(async (host: string): Promise<string> => {
  const disposition = await resolveHost(host).catch(() => null);
  if (disposition?.kind !== "site") return localeTag(DEFAULT_LOCALE);
  return localeTag(await siteLocale(disposition.siteId));
});

/**
 * **No icon of ours, and no head link that 404s** (#1121, #1129). The
 * favicon set sits at the root of `src/app/` so every ReachKit route names
 * it, and Next hands a root icon to every layout beneath — these included.
 * Naming no icon at all is not enough: a browser that finds no
 * `<link rel="icon">` asks for `/favicon.ico`, which a customer's host
 * answers 404. `data:,` is an empty icon the browser never fetches; a page
 * of a site names that site's own icon over it (`ICON_PATH`, issue 1514).
 *
 * The web app manifest is ReachKit's (`src/app/manifest.ts`, #326), and
 * Next links it from the root to every page; `null` here unlinks it, since
 * `/manifest.webmanifest` on a customer's host is the hosted catch-all's 404.
 *
 * **One line of head, and it is the visitor's own host** (owner ruling
 * 2026-09-22, #980). A response on this surface that states no title of
 * its own — the 404 for a host with nothing published — is titled with the
 * host it was asked on, exactly as it was sent: `content.example.com`. It
 * is not copy, not a name of ours, and in no language. A published page
 * returns its own title from `generateMetadata`, and that one wins.
 */
export function hostedHead(host: string): Metadata {
  const head = { icons: { icon: "data:," }, manifest: null } satisfies Metadata;
  const name = normaliseHost(host);
  // A request with no `Host` at all states no title rather than an empty
  // one — there is nothing of the visitor's to put there.
  return name === "" ? head : { title: name, ...head };
}

export function HostedDocument({
  lang,
  children,
}: {
  lang: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang={lang} className={fontVariables}>
      <body>
        <div className="bg-base-100 text-base-content min-h-screen">{children}</div>
      </body>
    </html>
  );
}
