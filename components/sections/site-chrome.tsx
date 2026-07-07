/**
 * SiteChrome — the canonical nav + footer wrapper for non-marketing surfaces
 * that should still read as first-class site pages (the funnel scan/results and
 * the public shared report). It reuses the same auth-aware MarketingNav + Footer
 * the marketing layout uses, so the whole project shares one header, one footer,
 * and one content width.
 *
 * Server component: the session read in AuthNav stays inside <Suspense> so it
 * doesn't block static prerendering (Next 16 cacheComponents).
 */

import { type ReactNode, Suspense } from "react";
import { currentUser } from "@/lib/auth/server";
import { type FooterContent } from "@/components/sections/footer";
import { MarketingNav } from "@/components/sections/marketing-nav";
import { MarketingChrome } from "@/components/sections/marketing-chrome";

export const SITE_FOOTER: FooterContent = {
  brand: "ReachKit",
  tagline:
    "The discoverability engine for solo founders — a scored report and a weekly, verified action plan in under a minute.",
  columns: [
    {
      heading: "Product",
      items: [
        { label: "Scan your app", href: "/scan" },
        { label: "How it works", href: "/how-it-works" },
        { label: "Pricing", href: "/pricing" },
        { label: "Free tools", href: "/tools" },
        { label: "Roadmap", href: "/roadmap" },
      ],
    },
    {
      heading: "Resources",
      items: [
        { label: "Scans", href: "/gallery" },
        { label: "Status", href: "/status" },
      ],
    },
    {
      heading: "Compare",
      items: [
        { label: "vs Ahrefs", href: "/compare/ahrefs" },
        { label: "vs Semrush", href: "/compare/semrush" },
        { label: "vs SparkToro", href: "/compare/sparktoro" },
        { label: "vs ChatGPT", href: "/compare/chatgpt" },
        { label: "All comparisons", href: "/compare" },
      ],
    },
    {
      heading: "Company",
      items: [
        { label: "About", href: "/about" },
        { label: "Contact", href: "/contact" },
        { label: "Affiliates", href: "/affiliates" },
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

async function AuthNav() {
  const viewer = await currentUser();
  return <MarketingNav isLoggedIn={!!viewer} />;
}

export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <MarketingChrome
      footer={SITE_FOOTER}
      nav={
        <Suspense fallback={<MarketingNav isLoggedIn={false} />}>
          <AuthNav />
        </Suspense>
      }
    >
      {children}
    </MarketingChrome>
  );
}
