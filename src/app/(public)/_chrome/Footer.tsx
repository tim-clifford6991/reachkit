// BUILD §3, §4.2 — the public footer (issue #266).
// src/app/(public)/_chrome/Footer.tsx
//
// Proposed on the same footing as the header: no approved artifact draws
// one, the mockup linked on #266 carries the *proposed* label, and the
// owner strikes or keeps it on steering.
//
// Three columns and a fine-print line. The legal column reaches the three
// static routes this issue adds, so a footer link never lands on a 404; the
// support column names §4.2's removal address, so a person who never opened
// an email can still find the way out.
import type React from "react";
import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";

const LEGAL: readonly { href: string; key: "legal.privacy.title" | "legal.terms.title" | "legal.imprint.title" }[] = [
  { href: "/privacy", key: "legal.privacy.title" },
  { href: "/terms", key: "legal.terms.title" },
  { href: "/imprint", key: "legal.imprint.title" },
];

export function Footer(): React.JSX.Element {
  return (
    <footer className="rk-chrome-foot" data-testid="public-footer">
      <div className="rk-chrome-foot-in">
        <div>
          <Link href="/" className="rk-wordmark">
            <span className="rk-wordmark-chip" aria-hidden>
            <TrendingUp size={15} strokeWidth={2} aria-hidden />
          </span>
            <span>{copy("chrome.wordmark")}</span>
          </Link>
          <p className="rk-chrome-fine">{copy("chrome.footer.rights")}</p>
          {/* §4.2's way out, named where a person who never opened an email
              can still find it. One line, not a column of its own: it is a
              sentence, and a heading over a single sentence says the same
              thing twice. */}
          <p className="rk-chrome-fine">
            {copy("chrome.footer.opt-out", { address: copy("removal.address") })}
          </p>
        </div>

        <nav aria-label={copy("chrome.footer.product")}>
          <p className="eyebrow">{copy("chrome.footer.product")}</p>
          <Link href="/pricing">{copy("chrome.nav.pricing")}</Link>
          <Link href="/signin">{copy("chrome.nav.signin")}</Link>
        </nav>

        <nav aria-label={copy("chrome.footer.legal")}>
          <p className="eyebrow">{copy("chrome.footer.legal")}</p>
          {LEGAL.map((link) => (
            <Link key={link.href} href={link.href}>
              {copy(link.key)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
