// BUILD §3 — the public header (issue #266).
// src/app/(public)/_chrome/Header.tsx
//
// **Proposed, and reviewed as such.** No approved artifact draws a public
// header: the owner endorsed the card idiom on 2026-09-02 and that idiom
// draws the landing, the sign-in and the overview, not the chrome around
// them. The mockup linked on #266 is labelled *proposed — not in the
// approved idiom*, the master approved it under ship-then-steer, and this
// is that mockup built. The owner strikes or keeps it on steering.
//
// **One solid primary per screen** (master's ruling on the mockup). On the
// landing the hero's own control is that primary, so the header there shows
// the sign-in link and no CTA; on every other public route the header's CTA
// is the one primary. `showCta` is how the route says which it is — never
// inferred from a pathname here, because a header that reads the route is a
// second place the rule lives.
//
// **The compact band is the registered `Collapse`, listing the links under
// the header** (same ruling) — never a drawer and never a dropdown. That is
// one of BUILD §2.2's fifteen, it needs no JavaScript of its own (`details`
// is the element), and it leaves every link in the document at every width,
// which is what keeps them in the layout sweep and in the accessibility
// tree rather than behind a control.
import type React from "react";
import Link from "next/link";
import { Btn } from "@/ui/components/Btn";
import { Collapse } from "@/ui/components/Collapse";
import { copy } from "@/lib/presentation/copy";

/** The links the header carries, and the only ones: every destination is a
 *  route that exists in v3. v2's Gallery, Compare and Free tools are not
 *  carried — #266's ruling, and a link to a route that does not exist is a
 *  promise the product cannot keep. */
const LINKS: readonly { href: string; key: "chrome.nav.pricing" | "chrome.nav.signin" }[] = [
  { href: "/pricing", key: "chrome.nav.pricing" },
  { href: "/signin", key: "chrome.nav.signin" },
];

export function Header(p: { showCta: boolean }): React.JSX.Element {
  return (
    <header className="rk-chrome-head" data-testid="public-header">
      <div className="rk-chrome-bar">
        <Link href="/" className="rk-wordmark">
          <span className="rk-wordmark-chip" aria-hidden />
          <span>{copy("chrome.wordmark")}</span>
        </Link>

        {/* At and above --breakpoint-lg the links sit in the bar. */}
        <nav className="rk-chrome-nav" aria-label={copy("chrome.nav.menu")}>
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {copy(link.key)}
            </Link>
          ))}
        </nav>

        {p.showCta ? (
          <Link href="/" className="rk-chrome-cta">
            <Btn label={copy("chrome.cta.scan")} variant="primary" pill />
          </Link>
        ) : null}
      </div>

      {/* Below --breakpoint-lg the same links, listed under the header. */}
      <div className="rk-chrome-compact">
        <Collapse summary={copy("chrome.nav.menu")}>
          <nav className="rk-chrome-stack">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {copy(link.key)}
              </Link>
            ))}
          </nav>
        </Collapse>
      </div>
    </header>
  );
}
