// BUILD §3, §4.2 — the public footer, a daisyUI footer.
// src/app/(public)/_chrome/Footer.tsx
//
// Board `PubLanding`: brand, then Product · Learn · Legal · Contact, then
// one wrapping line with the rights and the removal address as a mail link,
// named so a person who never opened an email can still find the way out.
// **The column titles are not headings** (#328). They were level-six
// headings, which land two or three levels under whatever `<h1>` the page
// above carries — `heading-order`, on all eight public routes — and they
// were never headings to begin with: each `<nav>` already carries the same
// sentence as its `aria-label`, so each was a second, lower-ranked copy of
// a name the landmark already had. A `<div>` keeps daisyUI's
// `footer-title` and every pixel it draws, and takes the duplicate out of
// the document outline.
import type React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { Brand } from "@/app/_brand/Brand";
import { readOwnArticles } from "./own-articles";

/** Every footer link is a 44px target (board PubLanding v34). */
const LINK = "link link-hover inline-flex min-h-11 items-center";

const LEGAL: readonly { href: string; key: "legal.privacy.title" | "legal.terms.title" | "legal.imprint.title" }[] = [
  { href: "/privacy", key: "legal.privacy.title" },
  { href: "/terms", key: "legal.terms.title" },
  { href: "/imprint", key: "legal.imprint.title" },
];

const LEARN: readonly { href: string; key: "chrome.nav.scans" | "chrome.nav.compare" | "chrome.nav.tools" | "chrome.nav.teardowns" }[] = [
  { href: "/scans", key: "chrome.nav.scans" },
  { href: "/compare", key: "chrome.nav.compare" },
  { href: "/tools", key: "chrome.nav.tools" },
  { href: "/teardowns", key: "chrome.nav.teardowns" },
];

/** Issue 1512: the index of the articles ReachKit publishes on its own
 *  content host, as a plain link off this site. Drawn only where the stored
 *  rows name one, and streamed, so no public page waits on the read. */
async function ArticlesLink(): Promise<React.JSX.Element | null> {
  const own = await readOwnArticles();
  if (own === null) return null;
  return (
    <a href={own.index} className={LINK}>
      {copy("chrome.nav.articles")}
    </a>
  );
}

/** Not a character any sentence holds, so the split is the slot's own boundary. */
const SENTINEL = "\u0000";

export function Footer(): React.JSX.Element {
  const address = copy("removal.address");
  const [before = "", after = ""] = copy("chrome.footer.opt-out", { address: SENTINEL }).split(SENTINEL);
  return (
    <footer className="border-t border-base-300 bg-base-100" data-testid="public-footer">
      <div className="footer mx-auto max-w-6xl px-4 pt-10 pb-8 text-sm sm:footer-horizontal">
        <aside>
          <Brand href="/" />
        </aside>

        <nav aria-label={copy("chrome.footer.product")}>
          <div className="footer-title opacity-70">{copy("chrome.footer.product")}</div>
          {/* The board's Product column opens with the free scan itself
              (#936) — the one thing on this site a stranger came for, and
              the only column entry that was missing. Its word is the
              header CTA's own key, not a second spelling of it. */}
          <Link href="/" className={LINK}>
            {copy("chrome.cta.scan")}
          </Link>
          <Link href="/how-it-works" className={LINK}>
            {copy("chrome.nav.works")}
          </Link>
          <Link href="/pricing" className={LINK}>
            {copy("chrome.nav.pricing")}
          </Link>
          <Link href="/about" className={LINK}>
            {copy("chrome.nav.about")}
          </Link>
          <Link href="/signin" className={LINK}>
            {copy("chrome.nav.signin")}
          </Link>
        </nav>

        {/* Issue 1458: the pages earlier versions published and Google
            still ranks, linked from every public page so they are crawled. */}
        <nav aria-label={copy("chrome.footer.learn")}>
          <div className="footer-title opacity-70">{copy("chrome.footer.learn")}</div>
          {LEARN.map((link) => (
            <Link key={link.href} href={link.href} className={LINK}>
              {copy(link.key)}
            </Link>
          ))}
          <Suspense fallback={null}>
            <ArticlesLink />
          </Suspense>
        </nav>

        <nav aria-label={copy("chrome.footer.legal")}>
          <div className="footer-title opacity-70">{copy("chrome.footer.legal")}</div>
          {LEGAL.map((link) => (
            <Link key={link.href} href={link.href} className={LINK}>
              {copy(link.key)}
            </Link>
          ))}
        </nav>

        <nav aria-label={copy("chrome.footer.contact")}>
          <div className="footer-title opacity-70">{copy("chrome.footer.contact")}</div>
          <a href={`mailto:${copy("chrome.footer.contact.address")}`} className={LINK}>
            {copy("chrome.footer.contact.address")}
          </a>
        </nav>
      </div>
      <p className="border-base-300 text-base-content/70 mx-auto flex max-w-6xl flex-wrap items-center border-t px-4 py-3 text-sm">
        <span className="whitespace-pre-wrap">{`${copy("chrome.footer.rights")} · ${before}`}</span>
        <a href={`mailto:${address}`} className={LINK}>
          {address}
        </a>
        <span>{after}</span>
      </p>
    </footer>
  );
}
