/**
 * Marketing layout — server component so the nav is auth-aware (logged-in users
 * see "Dashboard" instead of "Log in"). One shared MarketingNav + Footer wraps
 * ALL public pages; the captured landing/pricing render body-only. Lazy
 * Lenis/GSAP motion lives in the client MotionProvider.
 */

import { type ReactNode, Suspense } from "react";
import { currentUser } from "@/lib/auth/server";
import { type FooterContent } from "@/components/sections/footer";
import { MarketingNav } from "@/components/sections/marketing-nav";
import { MotionProvider } from "@/components/sections/motion-provider";
import { MarketingChrome } from "@/components/sections/marketing-chrome";

const FOOTER_CONTENT: FooterContent = {
  brand: "ReachKit",
  tagline: "The discoverability engine for solo founders — a scored report and a weekly, verified action plan in ~90 seconds.",
  columns: [
    {
      heading: "Product",
      items: [
        { label: "Scan your app", href: "/scan" },
        { label: "How it works", href: "/how-it-works" },
        { label: "Pricing", href: "/pricing" },
        { label: "Free tools", href: "/tools" },
        { label: "Changelog", href: "/changelog" },
        { label: "Roadmap", href: "/roadmap" },
      ],
    },
    {
      heading: "Resources",
      items: [
        { label: "Teardowns", href: "/teardowns" },
        { label: "Blog", href: "/blog" },
        { label: "Help & docs", href: "/docs" },
        { label: "Status", href: "/status" },
      ],
    },
    {
      heading: "Compare",
      items: [
        { label: "vs SparkToro", href: "/compare/sparktoro" },
        { label: "vs Ahrefs", href: "/compare/ahrefs" },
        { label: "vs ChatGPT", href: "/compare/chatgpt" },
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

// Auth-aware nav isolated in its own async component: reading the session
// (cookies) is uncached/dynamic, so it MUST sit inside a <Suspense> boundary —
// otherwise it blocks static prerendering of every marketing page (Next 16
// cacheComponents). The static shell renders with the logged-out nav; the
// logged-in state streams in.
async function AuthNav() {
  const viewer = await currentUser();
  return <MarketingNav isLoggedIn={!!viewer} />;
}

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <MarketingChrome
      footer={FOOTER_CONTENT}
      nav={
        <Suspense fallback={<MarketingNav isLoggedIn={false} />}>
          <AuthNav />
        </Suspense>
      }
    >
      <MotionProvider>{children}</MotionProvider>
    </MarketingChrome>
  );
}
