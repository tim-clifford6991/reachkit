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

import { Suspense } from "react";
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
// Direct imports (not the barrel) so Turbopack can split each section cleanly
// and below-the-fold sections don't all land in one eager first-load chunk.
import { SocialProofMarquee } from "@/components/sections/social-proof-marquee";
import { Empathy } from "@/components/sections/empathy";
import { SocialProof } from "@/components/sections/social-proof";
import { FeatureBento } from "@/components/sections/feature-bento";
import { HowItWorksScroll } from "@/components/sections/how-it-works-scroll";
import { TeardownGrid } from "@/components/sections/teardown-grid";
import { ComparisonTable } from "@/components/sections/comparison-table";
import { PricingTable } from "@/components/sections/pricing-table";
import { Faq } from "@/components/sections/faq";
import { FinalCta } from "@/components/sections/final-cta";
import type { SocialProofMarqueeContent } from "@/components/sections/social-proof-marquee";
import type { EmpathyContent } from "@/components/sections/empathy";
import type { SocialProofContent } from "@/components/sections/social-proof";
import type { FeatureBentoContent } from "@/components/sections/feature-bento";
import type { TeardownGridContent } from "@/components/sections/teardown-grid";
import type { ComparisonTableContent } from "@/components/sections/comparison-table";
import type { PricingTableContent } from "@/components/sections/pricing-table";
import type { FaqContent } from "@/components/sections/faq";
import type { FinalCtaContent } from "@/components/sections/final-cta";
// GSAP set pieces live behind a client boundary with ssr:false dynamic imports
import {
  LazyScanScrollSequence,
  LazyParallaxLayers,
} from "@/components/motion/gsap/dynamic-wrappers";
import { GradientMesh } from "@/components/motion/gradient-mesh";
import { RecentScans } from "@/components/sections/recent-scans";

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

const EMPATHY_CONTENT: EmpathyContent = {
  eyebrow: "Sound familiar?",
  lead: "You shipped it. You posted once. Then… silence.",
  turn: "Your product probably isn't bad — it's invisible. The people who'd love it are searching right now, and landing on someone else's listing instead of yours. ReachKit shows you exactly where, and what to fix first.",
};

const SOCIAL_PROOF_CONTENT: SocialProofContent = {
  eyebrow: "Proof, not promises",
  headline: "Built by a founder who hit the same wall",
  founder: {
    name: "Tim Clifford",
    role: "Founder, ReachKit",
    quote:
      "I'm a developer. I can build anything — and I still watched good products die because nobody could find them. Distribution was a black box you either ignored or paid an agency a fortune to manage. ReachKit is the tool I wished existed: paste a URL, get a score and a ranked plan, do a little every week.",
    initials: "TC",
    // TODO(asset): drop a square headshot in /public (e.g. /founder.jpg) and set
    // avatarSrc below; add a Loom/YouTube URL to render the 90-second video CTA.
    // avatarSrc: "/founder.jpg",
    // videoUrl: "https://www.loom.com/share/…",
    videoLabel: "Watch the 90-second story",
  },
  proofPoints: [
    { value: "18", label: "signals analysed per scan" },
    { value: "Free", label: "first scan — see it before you trust it" },
    { value: "Evidence", label: "every claim links to a real source" },
  ],
  // TODO(#29): wire real customer quotes here as they arrive — renders automatically.
  testimonials: [],
};

const FEATURE_CONTENT: FeatureBentoContent = {
  eyebrow: "What you get",
  headline: "One score. One weekly plan to raise it.",
  cards: [
    {
      icon: <BarChart2 className="h-4 w-4" />,
      title: "Discoverability Score",
      blurb:
        "A single number, 0–100, built from 18 signals — keyword density, metadata, category fit, backlink profile, and more. It's the one number that tells you how findable you are.",
      wide: true,
    },
    {
      icon: <Target className="h-4 w-4" />,
      title: "Positioning Mirror",
      blurb:
        "Who your page actually targets vs. who you think it targets. The gap is usually the problem.",
    },
    {
      icon: <Search className="h-4 w-4" />,
      title: "Search Gap Analysis",
      blurb:
        "An AI reads your live page the way a customer's search does — and surfaces the exact queries you're invisible for.",
    },
    {
      icon: <FileText className="h-4 w-4" />,
      title: "Ranked Action Steps",
      blurb:
        "Specific fixes, ordered by expected score impact. Not generic SEO advice — your actual gaps.",
    },
    {
      icon: <RefreshCw className="h-4 w-4" />,
      title: "Weekly Action Engine",
      blurb:
        "Paid plans refresh the queue weekly. Ship a fix, mark it done, watch your score move.",
    },
    {
      icon: <CheckCircle className="h-4 w-4" />,
      title: "Action Verification",
      blurb:
        "ReachKit checks the live URL when you mark something complete — no self-reporting without evidence.",
    },
    {
      icon: <Zap className="h-4 w-4" />,
      title: "Draft Copy Included",
      blurb:
        "Every action comes with a draft — a rewritten title, a better description, a keyword insertion. Ready to paste.",
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
  headline: "Scan free.\nPay to act.",
  subhead:
    "Your first scan is free. Upgrade when you're ready to turn the report into a weekly engine. Save two months with annual billing.",
  tiers: [
    {
      name: "Solo",
      price: "$59",
      period: "/ month",
      description: "1 product, weekly queue, drafts, monitoring.",
      features: [
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
          className="block w-full rounded-lg border border-transparent px-4 py-2.5 text-center text-sm font-semibold shadow-[var(--elevation-glow)] transition-[transform,filter] duration-200 ease-revolut hover:-translate-y-px hover:brightness-110 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          style={{
            background: "var(--gradient-accent)",
            color: "var(--color-accent-fg)",
          }}
        >
          Start Solo — $59/mo
        </Link>
      ),
    },
    {
      name: "Growth",
      price: "$129",
      period: "/ month",
      description: "3 products, higher quotas, deeper rank tracking.",
      features: [
        "Everything in Solo",
        "3 products tracked",
        "100 draft actions per refresh",
        "50 keyword rank-depth",
        "Priority support",
      ],
      cta: (
        <Link
          href="/pricing"
          className="block w-full rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors duration-150"
          style={{
            borderColor: "var(--hairline-strong)",
            color: "var(--color-fg)",
            background: "var(--fill-subtle)",
          }}
        >
          Start Growth — $129/mo
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
      {/* CSS-only entrance (no JS/GSAP dependency) so the headline is never
          blank — calm and robust, fitting the Almanac direction. */}
      <section
          className="hero-section relative flex flex-col items-center gap-14 overflow-hidden px-(--spacing-content-x) pb-(--spacing-section-y) pt-16 text-center sm:pt-24"
          aria-label="Hero"
        >
          {/* Ambient animated gradient mesh — pure CSS, below the LCP path */}
          <GradientMesh />

          <div className="hero-content relative z-10 flex max-w-2xl flex-col items-center gap-8">
            {/* Eyebrow — glass pill */}
            <p
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs uppercase tracking-wider backdrop-blur-[var(--glass-blur)]"
              style={{
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "var(--glass-border)",
                background: "var(--glass-tint)",
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
              className="text-[2.25rem] font-bold tracking-[var(--tracking-display)] sm:text-6xl lg:text-7xl"
              style={{ color: "var(--color-fg)", lineHeight: 1.05 }}
            >
              Find out exactly why
              <br />
              <span
                data-hero-accent
                style={{
                  background: "var(--gradient-accent)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
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
              Paste your App Store URL or website. An AI reads your live listing
              the way a customer&apos;s search does — and hands back a
              Discoverability Score, your positioning gap, and ranked fixes in ~90
              seconds.
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

      {/* ── Social proof marquee ────────────────────────────────────────── */}
      <Suspense fallback={<SocialProofMarquee content={MARQUEE_CONTENT} />}>
        <RecentScans fallback={MARQUEE_CONTENT.chips} />
      </Suspense>

      {/* ── §20.3 Set piece 2: watch a scan happen (lazy, ssr:false) ───── */}
      <LazyScanScrollSequence />

      {/* ── Empathy beat — name the pain before pitching (#21) ──────────── */}
      <Empathy content={EMPATHY_CONTENT} />

      {/* ── Feature bento (with scroll-linked parallax depth) ───────────── */}
      <div className="relative overflow-hidden">
        <LazyParallaxLayers />
        <FeatureBento content={FEATURE_CONTENT} />
      </div>

      {/* ── §20.3 Set piece 3: pinned how-it-works (lazy via client comp) ─ */}
      <HowItWorksScroll />

      {/* ── Teardown grid ───────────────────────────────────────────────── */}
      <TeardownGrid content={TEARDOWN_CONTENT} />

      {/* ── Comparison table ────────────────────────────────────────────── */}
      <ComparisonTable content={COMPARISON_CONTENT} />

      {/* ── Social proof — founder vouch + factual trust points (#15/#29) ─ */}
      <SocialProof content={SOCIAL_PROOF_CONTENT} />

      {/* ── Pricing table ───────────────────────────────────────────────── */}
      <PricingTable content={PRICING_CONTENT} />

      {/* ── FAQ (emits FAQPage JSON-LD internally) ──────────────────────── */}
      <Faq content={FAQ_CONTENT} />

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <FinalCta content={FINAL_CTA_CONTENT}>
        <ScanInput />
      </FinalCta>

    </main>
  );
}
