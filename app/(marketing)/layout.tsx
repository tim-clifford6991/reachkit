"use client";

/**
 * Marketing layout — §20.3
 *
 * Mounts Lenis smooth-scroll + GSAP context for the marketing route group.
 * Lazy-loaded: GSAP and Lenis are dynamic-imported below the fold so they
 * never touch the initial HTML chunk (LCP path stays CSS-only).
 *
 * prefers-reduced-motion → Lenis disabled, GSAP context skipped entirely.
 *
 * IMPORTANT: This file uses "use client" — the dynamic import with ssr:false
 * lives inside the GsapProvider, which is itself only rendered client-side.
 * The marketing page RSC content renders server-first; this layout hydrates
 * after. GSAP/Lenis never reach the (app) or (funnel) bundles.
 */

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { MarketingNav } from "@/components/sections/marketing-nav";
import { Footer, type FooterContent } from "@/components/sections/footer";
import { PreFooterShare } from "@/components/sections/pre-footer-share";

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

// ---------------------------------------------------------------------------
// Lenis provider — lazy, client-only
// ---------------------------------------------------------------------------

function LenisMount() {
  const lenisRef = useRef<unknown>(null);

  useEffect(() => {
    // Bail out if the user prefers reduced motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    let animFrameId: number;

    async function init() {
      const { default: Lenis } = await import("lenis");

      const lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        touchMultiplier: 1.5,
      });

      lenisRef.current = lenis;

      function raf(time: number) {
        (lenis as { raf: (t: number) => void }).raf(time);
        animFrameId = requestAnimationFrame(raf);
      }

      animFrameId = requestAnimationFrame(raf);
    }

    void init();

    return () => {
      cancelAnimationFrame(animFrameId);
      (lenisRef.current as { destroy?: () => void } | null)?.destroy?.();
      lenisRef.current = null;
    };
  }, []);

  return null;
}

// ---------------------------------------------------------------------------
// GSAP ScrollTrigger registration — lazy, client-only
// ---------------------------------------------------------------------------

function GsapInit() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    async function init() {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
    }

    void init();
  }, []);

  return null;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function MarketingLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The landing ("/") is the captured 1:1 page — it carries its own nav + footer,
  // so the shared marketing chrome is suppressed there.
  const isCaptured = pathname === "/";

  if (isCaptured) {
    return (
      <>
        <LenisMount />
        <GsapInit />
        <div className="flex min-h-dvh flex-col overflow-x-hidden">{children}</div>
      </>
    );
  }

  return (
    <>
      {/* Lazy animation infra — never blocks the first paint */}
      <LenisMount />
      <GsapInit />
      <div className="font-editorial flex min-h-dvh flex-col overflow-x-hidden" style={{ background: "var(--color-bg)" }}>
        <MarketingNav />
        <div className="flex-1">{children}</div>
        <PreFooterShare />
        <Footer content={FOOTER_CONTENT} />
      </div>
    </>
  );
}
