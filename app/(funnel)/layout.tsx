/**
 * Funnel layout — branded shell for /scan/[id] and /scan/[id]/results.
 *
 * Conversion-focused: a minimal header (logo + Log in) keeps brand continuity
 * without adding nav exit points that hurt the scan-to-email funnel. The shared
 * footer provides legal, social, and brand links below the fold.
 *
 * No GSAP / Lenis — those stay in the marketing bundle only (§20.3).
 * This is a server component so it has zero JS weight of its own.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { Footer, type FooterContent } from "@/components/sections/footer";

const FOOTER_CONTENT: FooterContent = {
  brand: "ReachKit",
  tagline:
    "The discoverability engine for solo founders — a scored report and a weekly, verified action plan in ~90 seconds.",
  columns: [
    {
      heading: "Product",
      items: [
        { label: "Scan your app", href: "/scan" },
        { label: "How it works", href: "/how-it-works" },
        { label: "Pricing", href: "/pricing" },
      ],
    },
    {
      heading: "Resources",
      items: [
        { label: "Teardowns", href: "/teardowns" },
        { label: "Blog", href: "/blog" },
        { label: "Help & docs", href: "/docs" },
      ],
    },
    {
      heading: "Company",
      items: [
        { label: "About", href: "/about" },
        { label: "Contact", href: "/contact" },
        { label: "Log in", href: "/login" },
      ],
    },
  ],
  legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Imprint", href: "/imprint" },
  ],
  social: [
    { label: "ReachKit on X", href: "https://x.com/reachkit", icon: "x" },
    { label: "ReachKit on GitHub", href: "https://github.com/reachkit", icon: "github" },
    { label: "Teardowns RSS feed", href: "/teardowns/rss.xml", icon: "rss" },
  ],
  copyright: `© ${new Date().getFullYear()} ReachKit`,
  attribution: "Built for founders who ship",
};

// ---------------------------------------------------------------------------
// Funnel header — logo only + a quiet "Log in" link (no distraction links)
// ---------------------------------------------------------------------------

function FunnelHeader() {
  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl"
      style={{
        background: "var(--glass-tint)",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <div
        className="mx-auto flex h-16 max-w-[var(--spacing-content-max)] items-center justify-between gap-4 px-(--spacing-content-x)"
      >
        <Link
          href="/"
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="ReachKit home"
        >
          <Wordmark />
        </Link>

        <Link
          href="/login"
          className="rounded-full px-3.5 py-2 text-sm font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          style={{ color: "var(--color-muted)" }}
        >
          Log in
        </Link>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function FunnelLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-dvh flex-col overflow-x-hidden"
      style={{ background: "var(--color-bg)" }}
    >
      <FunnelHeader />
      <div className="flex-1">{children}</div>
      <Footer content={FOOTER_CONTENT} />
    </div>
  );
}
