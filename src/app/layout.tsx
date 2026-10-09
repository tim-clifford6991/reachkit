// src/app/layout.tsx
//
// BP-001 `## Module / boundary`: "`src/app/layout.tsx`" — the one root
// document every ReachKit-addressed surface renders inside. It carries
// BP-018's theme and fonts and holds no product copy of its own (BP-018
// decision 2: "no component has a default string"): this file renders
// `{children}` and nothing else — no navigation, no heading, no string.
//
// Theme: `src/ui/theme.css` (WO-029) declares its three states against the
// bare `:root` selector — the browser's root element is `<html>`, so
// importing the stylesheet here *is* the whole attribute contract. WO-029
// wrote no toggle script, only the CSS selectors this layout does not
// duplicate: bare `:root` = light, `:root:not([data-theme="light"])` = the
// media-guarded dark state, `:root[data-theme="dark"]` = the explicit
// toggle. `data-theme` is set before paint by `THEME_SCRIPT` (#681), from
// the Light / Dark / System choice `src/app/_theme/ThemeToggle.tsx` stores;
// `system` sets none. The script is inline, so it carries this request's
// CSP nonce, read back off the policy `src/middleware.ts` forwarded.
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
// entry point), and it declares the one daisyUI theme, `reachkit`. It is
// imported after `theme.css` so `:root`'s tokens exist before
// the daisyUI theme mapping that reads them, and before `type.css`, whose
// element rules are meant to win over the reset.
//
// URL state: `nuqs` (`docs/DESIGN.md`'s library list, 2026-09-20) reads and
// writes the query string of whichever route uses it — setup's step, and the
// month, day, tab and filters that follow. Its adapter has to sit above every
// route that calls `useQueryState`, and the root layout is the only element
// every ReachKit-addressed surface renders inside. It renders `{children}`
// and nothing of its own, so it adds no markup and no string.
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

import type React from "react";
import { headers } from "next/headers";

import "@/ui/theme.css";
import "@/ui/tailwind.css";
import "@/ui/type.css";
import "@/ui/layout/layout.css";
import "@/ui/layout/surface.css";
import { fontVariables } from "@/ui/fonts";
import { THEME_SCRIPT } from "./_theme/theme";
import { BANNER_SCRIPT } from "./(public)/_chrome/banner";
import { Answers } from "./_toast/Answers";

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
 * (`01-app/02-guides/content-security-policy.md`).
 *
 * **The declaration is on the two group layouts, not here** (issue 1242):
 * `(public)/layout.tsx` and `(account)/layout.tsx` each export
 * `dynamic = "force-dynamic"`, and every `(hosted)` route declares its own.
 * It was on this file until one route had to be cached. Next applies a
 * layout's `force-dynamic` when it reaches that layout, whatever the page
 * under it declares, so on the root it made the cached hosted article
 * (`(hosted)/hosted-live/[host]/[slug]`) fail instead of render. That
 * route is `force-static`, under which the `headers()` read below is empty
 * and the script is drawn with no nonce — and the middleware answers it
 * under `script-src 'none'`, so it is a page with no nonce on which no
 * script runs. The screen this file serves with no group above it,
 * `not-found.tsx`, is still rendered per request: the `headers()` read
 * below is itself what makes it so.
 */

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const policy = (await headers()).get("content-security-policy") ?? "";
  const nonce = /'nonce-([A-Za-z0-9+/_-]+={0,2})'/.exec(policy)?.[1];

  // `suppressHydrationWarning`: the script sets `data-theme` (and, once the
  // public banner is dismissed, `data-banner`, #1066) on `<html>` before
  // React hydrates,
  // which is the point, not a mismatch.
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT + BANNER_SCRIPT }} />
      </head>
      <body>
        {/* No `NuqsAdapter` here (#988). Only `(account)` routes hold URL
            state — the month, the day, the tab, the filters, the setup
            step — and only they call `useQueryState`, so the adapter is
            mounted in `(account)/layout.tsx`. Mounted on the document it
            cost every public route 17.8 kB of script for state that route
            has none of, which is one of the landing's own budget rows. */}
        {children}
        {/* SPEC §4/§7 (2026-09-20, #908): "every action answers", and the
            stack the answers land in — mounted once, here, because this is
            the one document every ReachKit-addressed surface renders
            inside. `_toast/Answers.tsx` holds the mount and says why it
            carries the one prop it does. Outside the adapter: it reads no
            URL state and holds none. */}
        <Answers />
      </body>
    </html>
  );
}
