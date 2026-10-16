// BUILD §3, §4.2 — the public footer, a daisyUI footer.
// src/app/(public)/_chrome/Footer.tsx
//
// SPEC §1: brand, rights, removal address, Product, Legal. The legal column
// reaches the three static routes, and the removal address is named so a
// person who never opened an email can still find the way out.
// **The column titles are not headings** (#328). They were level-six
// headings, which land two or three levels under whatever `<h1>` the page
// above carries — `heading-order`, on all eight public routes — and they
// were never headings to begin with: each `<nav>` already carries the same
// sentence as its `aria-label`, so each was a second, lower-ranked copy of
// a name the landmark already had. A `<div>` keeps daisyUI's
// `footer-title` and every pixel it draws, and takes the duplicate out of
// the document outline.
import type React from "react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { Brand } from "@/app/_brand/Brand";

const LEGAL: readonly { href: string; key: "legal.privacy.title" | "legal.terms.title" | "legal.imprint.title" }[] = [
  { href: "/privacy", key: "legal.privacy.title" },
  { href: "/terms", key: "legal.terms.title" },
  { href: "/imprint", key: "legal.imprint.title" },
];

const LEARN: readonly { href: string; key: "chrome.nav.compare" | "chrome.nav.tools" | "chrome.nav.teardowns" }[] = [
  { href: "/compare", key: "chrome.nav.compare" },
  { href: "/tools", key: "chrome.nav.tools" },
  { href: "/teardowns", key: "chrome.nav.teardowns" },
];

export function Footer(): React.JSX.Element {
  return (
    <footer className="border-t border-base-300 bg-base-100" data-testid="public-footer">
      <div className="footer mx-auto max-w-6xl px-4 py-10 text-sm sm:footer-horizontal">
        <aside className="max-w-sm">
          <Brand href="/" />
          <p className="text-base-content/70">{copy("chrome.footer.rights")}</p>
          <p className="text-base-content/70">
            {copy("chrome.footer.opt-out", { address: copy("removal.address") })}
          </p>
        </aside>

        <nav aria-label={copy("chrome.footer.product")}>
          <div className="footer-title opacity-70">{copy("chrome.footer.product")}</div>
          {/* The board's Product column opens with the free scan itself
              (#936) — the one thing on this site a stranger came for, and
              the only column entry that was missing. Its word is the
              header CTA's own key, not a second spelling of it. */}
          <Link href="/" className="link link-hover">
            {copy("chrome.cta.scan")}
          </Link>
          <Link href="/how-it-works" className="link link-hover">
            {copy("chrome.nav.works")}
          </Link>
          <Link href="/pricing" className="link link-hover">
            {copy("chrome.nav.pricing")}
          </Link>
          <Link href="/about" className="link link-hover">
            {copy("chrome.nav.about")}
          </Link>
          <Link href="/signin" className="link link-hover">
            {copy("chrome.nav.signin")}
          </Link>
        </nav>

        {/* Issue 1458: the pages earlier versions published and Google
            still ranks, linked from every public page so they are crawled. */}
        <nav aria-label={copy("chrome.footer.learn")}>
          <div className="footer-title opacity-70">{copy("chrome.footer.learn")}</div>
          {LEARN.map((link) => (
            <Link key={link.href} href={link.href} className="link link-hover">
              {copy(link.key)}
            </Link>
          ))}
        </nav>

        <nav aria-label={copy("chrome.footer.legal")}>
          <div className="footer-title opacity-70">{copy("chrome.footer.legal")}</div>
          {LEGAL.map((link) => (
            <Link key={link.href} href={link.href} className="link link-hover">
              {copy(link.key)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
