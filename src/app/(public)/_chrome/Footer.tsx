// BUILD §3, §4.2 — the public footer, a daisyUI footer.
// src/app/(public)/_chrome/Footer.tsx
//
// SPEC §1: brand, rights, removal address, Product, Legal. The legal column
// reaches the three static routes, and the removal address is named so a
// person who never opened an email can still find the way out.
import type React from "react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { Brand } from "./Header";

const LEGAL: readonly { href: string; key: "legal.privacy.title" | "legal.terms.title" | "legal.imprint.title" }[] = [
  { href: "/privacy", key: "legal.privacy.title" },
  { href: "/terms", key: "legal.terms.title" },
  { href: "/imprint", key: "legal.imprint.title" },
];

export function Footer(): React.JSX.Element {
  return (
    <footer className="border-t border-base-300 bg-base-100" data-testid="public-footer">
      <div className="footer mx-auto max-w-6xl px-4 py-10 text-sm sm:footer-horizontal">
        <aside className="max-w-sm">
          <Brand />
          <p className="text-base-content/60">{copy("chrome.footer.rights")}</p>
          <p className="text-base-content/60">
            {copy("chrome.footer.opt-out", { address: copy("removal.address") })}
          </p>
        </aside>

        <nav aria-label={copy("chrome.footer.product")}>
          <h6 className="footer-title">{copy("chrome.footer.product")}</h6>
          <Link href="/pricing" className="link link-hover">
            {copy("chrome.nav.pricing")}
          </Link>
          <Link href="/signin" className="link link-hover">
            {copy("chrome.nav.signin")}
          </Link>
        </nav>

        <nav aria-label={copy("chrome.footer.legal")}>
          <h6 className="footer-title">{copy("chrome.footer.legal")}</h6>
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
