// src/app/layout.tsx
//
// BP-001 `## Module / boundary`: "`src/app/layout.tsx`" — the one root
// document every ReachKit-addressed surface renders inside. It carries
// BP-018's theme and fonts and holds no product copy of its own (BP-018
// decision 2: "no component has a default string"): this file renders
// `{children}` and nothing else — no navigation, no heading, no string of
// its own. Since issue #328 it exports the document's `title`, which is not
// a string of its own either: it is `chrome.wordmark`, read from the
// registry, and the comment on `metadata` below says why the document needs
// one at all.
//
// Theme: `src/ui/theme.css` (WO-029) declares its three states against the
// bare `:root` selector — the browser's root element is `<html>`, so
// importing the stylesheet here *is* the whole attribute contract. WO-029
// wrote no toggle script, only the CSS selectors this layout does not
// duplicate: bare `:root` = light, `:root:not([data-theme="light"])` = the
// media-guarded dark state, `:root[data-theme="dark"]` = the explicit
// future toggle. No `data-theme` is set from here.
//
// Fonts: `fontVariables` (`"rk-fonts"`, `src/ui/fonts.ts`) is the class
// `src/ui/type.css`'s `.rk-fonts` rule binds `--font-ui`/`--font-mono` on —
// `fonts.ts`'s own header: "the two files meet ... at the root layout".
// `fonts.ts` alone only loads the two families' `@font-face` bytes
// (side-effect imports); it does not itself bind the variable names, so
// `type.css` is imported here too, alongside `fonts.ts`, for the class to
// have a rule to match — WO-030's file plan: "Exports the two CSS variable
// names the root layout binds."
//
// Design system: `src/ui/tailwind.css` is what actually emits Tailwind's
// utilities and daisyUI's component classes (Tailwind 4 has no implicit
// entry point, and loads `tailwind.config.ts` only when a stylesheet names
// it). It is imported after `theme.css` so `:root`'s tokens exist before
// the daisyUI theme mapping that reads them, and before `type.css`, whose
// element rules are meant to win over the reset.
//
// Layout tokens: `src/ui/theme.css` declares the approved set on `:root`,
// including the ladder's floor `--t-eyebrow` that conformance check 4 reads
// off every route's document (ADR-093; issues #62, #349). `layout.css` is
// imported beside it and now declares nothing — its four tokens moved or
// were resolved; see that file.
//
// The layout law itself: `src/ui/layout/surface.css` (issue #241) is what
// renders `Surface`'s `data-surface` and `data-arm-<band>` attributes — the
// centred column, the band's gutters and the arm's grid. Every route has a
// `Surface` root, so it is imported here for the same reason `layout.css`
// is: the one stylesheet every route shares. It carries its own `:root`
// block — the spacing steps and the two content measures it spends — and
// sits beside its neighbour rather than inside it, because that file is
// ADR-093's three tokens and nothing else.
//
// The card idiom: `src/ui/idiom/idiom.css` is the idiom the owner endorsed
// on 2026-09-02 ("A · Six boxes"), ported from the live preview code
// (issue #266). It declares four tokens on `:root` and widens three
// registered components' arms, so it ships wherever those components do —
// which is every route.
import type { Metadata } from "next";
import type React from "react";

import { copy } from "@/lib/presentation/copy";
import "@/ui/theme.css";
import "@/ui/tailwind.css";
import "@/ui/type.css";
import "@/ui/layout/layout.css";
import "@/ui/layout/surface.css";
import "@/ui/idiom/idiom.css";
import { fontVariables } from "@/ui/fonts";

/**
 * **Every ReachKit render is a request's own** (issue #331).
 *
 * `src/middleware.ts` answers each request under a nonce-based
 * `script-src`, and a nonce only works on a page that is rendered *after*
 * the request exists: Next stamps it on the script tags it emits by reading
 * the `Content-Security-Policy` header off the incoming request
 * (`next/dist/server/app-render/app-render.js`, `parseRequestHeaders`). A
 * statically prerendered page is built before any request, so its inline
 * bootstrap carries no nonce, and the policy on the way out — correctly —
 * refuses to run it. The screen would still draw and would never hydrate.
 *
 * Next's own guide states the consequence rather than hiding it: "When you
 * use nonces in your CSP, **all pages must be dynamically rendered**"
 * (`01-app/02-guides/content-security-policy.md`). One declaration on the
 * root layout is the whole of that, and it costs this product almost
 * nothing: every `(account)` screen already renders per request behind a
 * session, `/scan/{domain}`, `/veto/{token}` and all four `(hosted)`
 * addresses already declare `force-dynamic` for their own reasons, and what
 * is left is six small surfaces the middleware was already waking a Node
 * process for.
 */
export const dynamic = "force-dynamic";

/**
 * The document's title (issue #328).
 *
 * Every one of the sixteen routes rendered `<title></title>` — axe reported
 * `document-title`, serious, on all of them, which is WCAG 2.1 §2.4.2 at
 * level A. A title is copy, so this is not one: it is `chrome.wordmark`,
 * the registry's own key, whose value the owner approved as written under
 * ruling 11a. That is why this file may carry it and still hold to
 * BP-018 decision 2 — the string is read, never defaulted.
 *
 * Plain rather than a `template`, so a route that sets its own title
 * *replaces* this one instead of being suffixed. The hosted page is why:
 * `generateMetadata` there returns the customer's own page title, and a
 * page on the customer's domain does not carry our wordmark in its title
 * bar.
 *
 * **Per-screen titles are still owed.** §2.4.2 asks a title to describe the
 * page's topic, and one wordmark across sixteen screens is the floor, not
 * the answer; the sentences are the owner's (M13).
 */
export const metadata: Metadata = {
  title: copy("chrome.wordmark"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
