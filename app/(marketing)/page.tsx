/**
 * Landing page — §22.1 rich marketing surface
 *
 * Composes the §21.1 section library + §20.3 GSAP set pieces.
 * Section order (§22.1 spec):
 *   Hero + ScanInput (above the fold, §23 moment 1)
 *   SocialProofMarquee
 *   ScanScrollSequence (GSAP set piece 2, lazy)
 *   FeatureBento
 *   HowItWorksScroll (GSAP set piece 3, lazy)
 *   TeardownGrid
 *   ComparisonTable
 *   PricingTable
 *   Faq
 *   FinalCta
 *   Footer
 *
 * JSON-LD: SoftwareApplication + Organization + FAQPage (Faq emits its own).
 *
 * LCP strategy:
 * - Hero + ScanInput are static/CSS — no GSAP blocking above the fold
 * - GSAP set pieces are dynamically imported with ssr:false (below the fold)
 * - Lenis + GSAP init in layout.tsx (marketing-only, never reaches app/funnel)
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  Search,
  Zap,
  BarChart2,
  Target,
  FileText,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import {
  buildMetadata,
  softwareApplicationLd,
  organizationLd,
  SITE,
} from "@/lib/seo";
import { ScanInput } from "./scan-input";
import {
  SocialProofMarquee,
  FeatureBento,
  HowItWorksScroll,
  TeardownGrid,
  ComparisonTable,
  PricingTable,
  Faq,
  FinalCta,
  Footer,
} from "@/components/sections";
import type {
  SocialProofMarqueeContent,
  FeatureBentoContent,
  TeardownGridContent,
  ComparisonTableContent,
  PricingTableContent,
  FaqContent,
  FinalCtaContent,
  FooterContent,
} from "@/components/sections";
// GSAP set pieces live behind a client boundary with ssr:false dynamic imports
import {
  LazyScanScrollSequence,
  LazyHeroGsapWrapper,
} from "@/components/motion/gsap/dynamic-wrappers";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = buildMetadata({
  title: "The distribution system for solo founders",
  description:
    "Paste your App Store URL or website and get a free discoverability report — SEO gaps, positioning blind spots, and ranked action steps in under two minutes.",
  path: "/",
});

// ---------------------------------------------------------------------------
// Content objects — real, on-brand copy from the positioning spec
// ---------------------------------------------------------------------------

const MARQUEE_CONTENT: SocialProofMarqueeContent = {
  label: "Recent scans",
  chips: [
    { label: "journaling app · 63 / 100", score: 63 },
    { label: "invoicing tool · 41 / 100", score: 41 },
    { label: "fitness tracker · 77 / 100", score: 77 },
    { label: "recipe SaaS · 29 / 100", score: 29 },
    { label: "habit tracker · 55 / 100", score: 55 },
    { label: "time tracker · 48 / 100", score: 48 },
    { label: "expense reporter · 71 / 100", score: 71 },
    { label: "flashcard app · 38 / 100", score: 38 },
    { label: "meditation app · 82 / 100", score: 82 },
    { label: "language tutor · 44 / 100", score: 44 },
  ],
};

const FEATURE_CONTENT: FeatureBentoContent = {
  eyebrow: "What you get",
  headline: "Everything a solo founder needs to get found",
  cards: [
    {
      icon: <BarChart2 className="h-4 w-4" />,
      title: "Discoverability Score",
      blurb:
        "A single number (0–100) built from 18 signals — keyword density, metadata completeness, category fit, backlink profile, and more.",
      accent: "blue",
      wide: true,
    },
    {
      icon: <Target className="h-4 w-4" />,
      title: "Positioning Mirror",
      blurb:
        "Who your page actually targets vs. who you think it targets. The gap is usually the problem.",
      accent: "amber",
    },
    {
      icon: <Search className="h-4 w-4" />,
      title: "Search Gap Analysis",
      blurb:
        "The keywords your ideal customer types that your page is completely invisible for.",
      accent: "green",
    },
    {
      icon: <FileText className="h-4 w-4" />,
      title: "Ranked Action Steps",
      blurb:
        "Specific fixes, ordered by expected score impact. Not generic SEO advice — your actual gaps.",
      accent: "blue",
    },
    {
      icon: <RefreshCw className="h-4 w-4" />,
      title: "Weekly Action Engine",
      blurb:
        "Paid plans refresh the queue weekly. Ship a fix, mark it done, watch your score move.",
      accent: "amber",
    },
    {
      icon: <CheckCircle className="h-4 w-4" />,
      title: "Action Verification",
      blurb:
        "ReachKit checks the live URL when you mark something complete — no self-reporting without evidence.",
      accent: "green",
    },
    {
      icon: <Zap className="h-4 w-4" />,
      title: "Draft Copy Included",
      blurb:
        "Every action comes with a draft — a rewritten title, a better description, a keyword insertion. Ready to paste.",
      accent: "blue",
      wide: true,
    },
  ],
};

const TEARDOWN_CONTENT: TeardownGridContent = {
  eyebrow: "Real teardowns",
  headline: "See what a real scan finds",
  cards: [
    {
      title: "App Store Teardown: Calm",
      app: "Calm",
      score: 72,
      blurb:
        "Strong keyword coverage but the subtitle targets existing meditators, not the anxiety-reduction query that converts new users. Three quick fixes identified.",
      href: "/teardowns",
    },
    {
      title: "Web Teardown: Linear",
      app: "Linear",
      score: 84,
      blurb:
        "Excellent structured data and backlink profile. The one gap: no long-tail content targeting 'issue tracker for solo devs' — a $0 fix with estimated 15-point lift.",
      href: "/teardowns",
    },
    {
      title: "App Store Teardown: Bear",
      app: "Bear",
      score: 38,
      blurb:
        "Beautiful app, invisible listing. Keyword density is 2× below category average. Title wastes 80 characters on branding that no one searches. Huge upside.",
      href: "/teardowns",
    },
  ],
};

const COMPARISON_CONTENT: ComparisonTableContent = {
  eyebrow: "How we compare",
  headline: "Built for founders, not agencies",
  tools: ["ReachKit", "ChatGPT", "SparkToro"],
  rows: [
    {
      capability: "Discoverability score",
      cells: [
        { type: "check" },
        { type: "cross" },
        { type: "cross" },
      ],
    },
    {
      capability: "Grounded in your live page",
      cells: [
        { type: "check" },
        { type: "cross" },
        { type: "partial", note: "URL only, no deep analysis" },
      ],
    },
    {
      capability: "Ranked action steps",
      cells: [
        { type: "check" },
        { type: "partial", note: "Generic, unranked" },
        { type: "cross" },
      ],
    },
    {
      capability: "Draft copy per action",
      cells: [
        { type: "check" },
        { type: "partial", note: "With prompting" },
        { type: "cross" },
      ],
    },
    {
      capability: "Weekly queue refresh",
      cells: [
        { type: "check" },
        { type: "cross" },
        { type: "cross" },
      ],
    },
    {
      capability: "Action verification",
      cells: [
        { type: "check" },
        { type: "cross" },
        { type: "cross" },
      ],
    },
    {
      capability: "Free to start",
      cells: [
        { type: "check" },
        { type: "check" },
        { type: "cross" },
      ],
    },
  ],
};

const PRICING_CONTENT: PricingTableContent = {
  eyebrow: "Transparent pricing",
  headline: "Free to scan.\nPaid to act.",
  subhead:
    "Run your first scan free. Upgrade when you're ready to turn the report into a weekly engine.",
  tiers: [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "One scan, a full report, 3 sample actions.",
      features: [
        "One discoverability scan",
        "Full four-question report",
        "3 sample action cards",
        "Score out of 100",
      ],
      cta: (
        <Link
          href="/"
          className="block w-full rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors duration-150"
          style={{
            borderColor: "oklch(1 0 0 / 0.12)",
            color: "var(--color-fg)",
            background: "oklch(1 0 0 / 0.04)",
          }}
        >
          Scan your product
        </Link>
      ),
    },
    {
      name: "Solo",
      price: "$29",
      period: "/ month",
      description: "1 app, weekly queue, drafts, monitoring.",
      features: [
        "Everything in Free",
        "Weekly action queue",
        "Draft copy for every action",
        "Score history & weekly deltas",
        "Action verification",
        "20 keyword rank-depth",
      ],
      highlighted: true,
      badge: "Most popular",
      cta: (
        <Link
          href="/pricing"
          className="block w-full rounded-lg border border-transparent px-4 py-2.5 text-center text-sm font-semibold transition-colors duration-150"
          style={{
            background: "var(--color-accent-600)",
            color: "var(--color-accent-fg)",
          }}
        >
          Start Solo — $29/mo
        </Link>
      ),
    },
    {
      name: "Growth",
      price: "$99",
      period: "/ month",
      description: "3 apps, higher quotas, deeper rank tracking.",
      features: [
        "Everything in Solo",
        "3 apps tracked",
        "100 draft actions per refresh",
        "50 keyword rank-depth",
        "Priority support",
      ],
      cta: (
        <Link
          href="/pricing"
          className="block w-full rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors duration-150"
          style={{
            borderColor: "oklch(1 0 0 / 0.12)",
            color: "var(--color-fg)",
            background: "oklch(1 0 0 / 0.04)",
          }}
        >
          Start Growth — $99/mo
        </Link>
      ),
    },
  ],
};

const FAQ_CONTENT: FaqContent = {
  eyebrow: "Common questions",
  headline: "Honest answers",
  items: [
    {
      q: "Is the first scan really free?",
      a: "Yes — no account, no credit card. Paste a URL, get a full discoverability report including your score, positioning analysis, and 3 sample action cards. Free, always.",
    },
    {
      q: "How is this different from running a ChatGPT prompt?",
      a: "ChatGPT gives generic advice based on what you tell it. ReachKit fetches your live product page, extracts the actual signals (keyword density, metadata, category fit, competitor gap), and grounds every answer in evidence from your real listing. No hallucinations, no advice that doesn't apply to you.",
    },
    {
      q: "What counts as a scan?",
      a: "One App Store URL or website URL analysed by the four-question engine. Free accounts get one scan. Paid accounts re-scan weekly — same URL, fresh data, updated score.",
    },
    {
      q: "What is action verification?",
      a: "When you mark an action complete, ReachKit checks the live URL and confirms the change is there. Your score updates only when the fix is verified. No self-reporting without evidence.",
    },
    {
      q: "Can I scan a website, or only App Store listings?",
      a: "Both. Paste an App Store or Google Play URL for a mobile app scan. Paste any website URL for a web discoverability scan. The engine adapts the signal set to the platform.",
    },
    {
      q: "Can I cancel my subscription?",
      a: "Yes, any time. Your subscription ends at the close of the billing period. No long-term contract, no cancellation fee.",
    },
  ],
};

const FINAL_CTA_CONTENT: FinalCtaContent = {
  eyebrow: "Free, no account needed",
  headline: "Find out exactly why your product isn't getting found",
  subhead:
    "Paste your App Store URL or website. Get your Discoverability Score and a ranked action list in 90 seconds.",
};

const FOOTER_CONTENT: FooterContent = {
  brand: "ReachKit",
  tagline: "The distribution system for solo founders.",
  columns: [
    {
      heading: "Product",
      items: [
        { label: "Pricing", href: "/pricing" },
        { label: "Scan now", href: "/scan" },
        { label: "Teardowns", href: "/teardowns" },
      ],
    },
    {
      heading: "Company",
      items: [
        { label: "Privacy policy", href: "/privacy" },
        { label: "Terms of service", href: "/terms" },
        { label: "Imprint", href: "/imprint" },
      ],
    },
  ],
  legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Imprint", href: "/imprint" },
  ],
  copyright: `© ${new Date().getFullYear()} ReachKit`,
  attribution: "Built for founders who ship",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const appLd = softwareApplicationLd({
    name: SITE.name,
    url: SITE.url,
    priceUsd: 0,
  });
  const orgLd = organizationLd();

  return (
    <main
      style={{ background: "var(--color-bg)" }}
      aria-label="ReachKit home"
    >
      {/* JSON-LD: SoftwareApplication + Organization */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
      />

      {/* ── §23 Moment 1: Hero + ScanInput above the fold ──────────────── */}
      {/* Static/CSS — no GSAP dependency on the LCP path.
          LazyHeroGsapWrapper is dynamic(ssr:false) so it loads after hydration.
          The headline HTML is SSR'd regardless (SEO + LCP). */}
      <LazyHeroGsapWrapper>
        <section
          className="hero-section relative flex flex-col items-center gap-10 px-[--spacing-content-x] py-[--spacing-section-y] text-center"
          aria-label="Hero"
        >
          {/* Ambient background glow — CSS only, zero JS */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div
              className="absolute -top-48 left-1/2 h-[640px] w-[900px] -translate-x-1/2 rounded-full"
              style={{
                background:
                  "radial-gradient(ellipse at center, var(--color-accent) 0%, transparent 70%)",
                opacity: 0.065,
              }}
            />
          </div>

          <div className="hero-content relative z-10 flex max-w-xl flex-col items-center gap-8">
            {/* Eyebrow */}
            <p
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wider"
              style={{
                borderColor: "var(--color-accent-subtle)",
                background: "var(--color-accent-subtle)",
                color: "var(--color-accent-400)",
              }}
            >
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ background: "var(--color-accent-400)" }}
                aria-hidden="true"
              />
              Free · no account needed
            </p>

            {/* Headline — SSR'd for SEO + LCP, GSAP enhances on hydrate */}
            <h1
              data-hero-headline
              className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
              style={{ color: "var(--color-fg)", lineHeight: 1.05 }}
            >
              Find out exactly why
              <br />
              <span
                data-hero-accent
                style={{ color: "var(--color-accent)" }}
              >
                your product isn&apos;t
              </span>
              <br />
              getting found
            </h1>

            {/* Subhead */}
            <p
              data-hero-subhead
              className="mx-auto max-w-md text-base leading-relaxed sm:text-lg"
              style={{ color: "var(--color-muted)" }}
            >
              Paste your App Store URL or website — get a Discoverability Score,
              positioning gap, and ranked action steps in ~90 seconds.
            </p>

            {/* ── Scan input — THE single action above the fold ── */}
            <div className="w-full max-w-lg">
              <ScanInput />
            </div>
          </div>

          {/* CSS-only entrance — GSAP overrides after hydrate */}
          <style>{`
            @media (prefers-reduced-motion: no-preference) {
              .hero-content {
                animation: hero-fade-up 0.6s cubic-bezier(0.25, 0, 0, 1) both;
              }
            }
            @keyframes hero-fade-up {
              from { opacity: 0; transform: translateY(20px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </section>
      </LazyHeroGsapWrapper>

      {/* ── Social proof marquee ────────────────────────────────────────── */}
      <SocialProofMarquee content={MARQUEE_CONTENT} />

      {/* ── §20.3 Set piece 2: watch a scan happen (lazy, ssr:false) ───── */}
      <LazyScanScrollSequence />

      {/* ── Feature bento ───────────────────────────────────────────────── */}
      <FeatureBento content={FEATURE_CONTENT} />

      {/* ── §20.3 Set piece 3: pinned how-it-works (lazy via client comp) ─ */}
      <HowItWorksScroll />

      {/* ── Teardown grid ───────────────────────────────────────────────── */}
      <TeardownGrid content={TEARDOWN_CONTENT} />

      {/* ── Comparison table ────────────────────────────────────────────── */}
      <ComparisonTable content={COMPARISON_CONTENT} />

      {/* ── Pricing table ───────────────────────────────────────────────── */}
      <PricingTable content={PRICING_CONTENT} />

      {/* ── FAQ (emits FAQPage JSON-LD internally) ──────────────────────── */}
      <Faq content={FAQ_CONTENT} />

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <FinalCta content={FINAL_CTA_CONTENT}>
        <ScanInput />
      </FinalCta>

      {/* ── Footer (legal: /privacy /terms /imprint) ────────────────────── */}
      <Footer content={FOOTER_CONTENT} />
    </main>
  );
}
