/**
 * /scan — dedicated lead-magnet entry point (§23 moment 1)
 *
 * A focused, distraction-free page: Hero + ScanInput + minimal proof.
 * No nav. No sidebar. One action.
 *
 * JSON-LD: HowTo (3-step scan flow — how to use ReachKit).
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { buildMetadata, howToLd } from "@/lib/seo";
import { ScanInput } from "@/app/(marketing)/scan-input";
// Direct import (not the barrel) so this lean funnel page doesn't drag the
// entire §21.1 section library — incl. GradientMesh — into its client graph.
import { SocialProofMarquee } from "@/components/sections/social-proof-marquee";
import type { SocialProofMarqueeContent } from "@/components/sections/social-proof-marquee";
import { RecentScans } from "@/components/sections/recent-scans";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = buildMetadata({
  title: "Scan your product — free discoverability report",
  description:
    "Paste your App Store URL or website. Get a Discoverability Score, positioning gap, and ranked action steps in 90 seconds. Free, no account needed.",
  path: "/scan",
});

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

const HOW_TO_LD = howToLd({
  name: "How to scan your product with ReachKit",
  description:
    "Get a free discoverability score and ranked action plan for your App Store listing or website in under two minutes.",
  steps: [
    {
      name: "Paste your URL",
      text: "Copy your App Store URL, Google Play URL, or website address and paste it into the scan input.",
    },
    {
      name: "Wait ~90 seconds",
      text: "ReachKit fetches your live product page, extracts 18 discoverability signals, and runs the four-question analysis engine.",
    },
    {
      name: "Read your report",
      text: "Review your Discoverability Score, positioning mirror, search gap analysis, and ranked action steps. Free, no account required.",
    },
  ],
});

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const PROOF_CHIPS: SocialProofMarqueeContent = {
  label: "Recent scans",
  chips: [
    { label: "journaling app · 63 / 100", score: 63 },
    { label: "invoicing tool · 41 / 100", score: 41 },
    { label: "fitness tracker · 77 / 100", score: 77 },
    { label: "recipe SaaS · 29 / 100", score: 29 },
    { label: "habit tracker · 55 / 100", score: 55 },
    { label: "expense reporter · 71 / 100", score: 71 },
    { label: "meditation app · 82 / 100", score: 82 },
    { label: "language tutor · 44 / 100", score: 44 },
  ],
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ScanPage() {
  return (
    <main
      className="relative flex flex-col items-center overflow-hidden px-(--spacing-content-x) pb-(--spacing-section-y) pt-20 sm:pt-28"
      style={{ background: "var(--color-bg)" }}
      aria-label="Scan your product"
    >
      {/* HowTo JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_TO_LD) }}
      />

      {/* Ambient glow — CSS only */}
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

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-14">
        {/* Hero block */}
        <div className="flex flex-col items-center gap-5 text-center">
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

          <h1
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ color: "var(--color-fg)", lineHeight: 1.08 }}
          >
            Paste a URL.
            <br />
            <span style={{ color: "var(--color-accent)" }}>
              Get your score.
            </span>
          </h1>

          <p
            className="max-w-sm text-base leading-relaxed"
            style={{ color: "var(--color-muted)" }}
          >
            ReachKit analyses your App Store listing or website and returns a
            Discoverability Score + ranked action steps in ~90 seconds.
          </p>
        </div>

        {/* ── The single action ── */}
        <ScanInput />

        {/* Three-step reassurance */}
        <div
          className="flex w-full flex-col gap-3 rounded-xl border p-7"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--fill-subtle)",
          }}
          aria-label="How it works"
        >
          {[
            {
              n: "01",
              label: "Paste your URL",
              detail: "App Store, Google Play, or any website",
            },
            {
              n: "02",
              label: "Wait ~90 seconds",
              detail: "We fetch, extract 18 signals, and analyse",
            },
            {
              n: "03",
              label: "Read your report",
              detail: "Score + positioning gap + ranked actions",
            },
          ].map((step) => (
            <div key={step.n} className="flex items-start gap-4">
              <span
                className="mt-0.5 font-mono text-[10px] font-bold tabular-nums"
                style={{ color: "var(--color-accent-900)" }}
              >
                {step.n}
              </span>
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--color-fg)" }}
                >
                  {step.label}
                </p>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof marquee */}
        <div className="w-screen max-w-2xl">
          <Suspense fallback={<SocialProofMarquee content={PROOF_CHIPS} />}>
            <RecentScans fallback={PROOF_CHIPS.chips} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
