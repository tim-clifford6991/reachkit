/**
 * MarketingNav — sticky top navigation, 1:1 with the Claude Design mockup
 * (ReachKit.dc.html): glass sticky header, logo + flat links (Product / Pricing
 * / Free tools / Compare / Teardowns), Log in, and a dark "Analyze my site" CTA.
 * Used on the non-captured marketing pages so their chrome matches the captured
 * landing/pricing pages.
 */

import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { MobileMenu } from "./mobile-menu";

const LINKS = [
  { label: "Product", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Free tools", href: "/tools" },
  { label: "Compare", href: "/compare" },
  { label: "Teardowns", href: "/teardowns" },
] as const;

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function MarketingNav() {
  return (
    <header
      style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.82)", backdropFilter: "blur(14px)", borderBottom: "1px solid #EEEDF3" }}
    >
      <nav
        className="mx-auto flex items-center gap-[30px]"
        style={{ maxWidth: 1180, padding: "14px 28px" }}
        aria-label="Primary"
      >
        <Link href="/" className={`shrink-0 rounded-lg ${focusRing}`} aria-label="ReachKit home">
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-6 sm:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={`transition-colors hover:text-[#14131A] ${focusRing}`} style={{ fontSize: 14.5, fontWeight: 500, color: "#56535F" }}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3.5">
          <Link href="/login" className={`hidden sm:inline-flex ${focusRing}`} style={{ fontSize: 14.5, fontWeight: 600, color: "#3A3744" }}>
            Log in
          </Link>
          <Link
            href="/scan"
            className={`inline-flex items-center transition-transform hover:-translate-y-px motion-reduce:transform-none ${focusRing}`}
            style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 600, fontSize: 14, color: "#fff", background: "#14131A", borderRadius: 9, padding: "9px 16px" }}
          >
            Analyze my site
          </Link>
          <MobileMenu links={[...LINKS]} />
        </div>
      </nav>
    </header>
  );
}
