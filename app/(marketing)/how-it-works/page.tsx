import type { Metadata } from "next";

import { buildMetadata, howToLd } from "@/lib/seo";
import { ScanInput } from "@/app/(marketing)/scan-input";
import { HowItWorksScroll } from "@/components/sections/how-it-works-scroll";
import { FinalCta, type FinalCtaContent } from "@/components/sections/final-cta";

export const metadata: Metadata = buildMetadata({
  title: "How it works",
  description:
    "How ReachKit works: scan your App Store listing or website, read a four-question report, and work a weekly, verified action queue. From URL to action list in ~90 seconds.",
  path: "/how-it-works",
});

const HOW_TO_LD = howToLd({
  name: "How ReachKit works",
  description:
    "Scan your product, read your Discoverability report, and work a weekly action queue.",
  steps: [
    { name: "Scan", text: "Paste your App Store URL or website. ReachKit fetches it and scores 18 discoverability signals in about 90 seconds." },
    { name: "Report", text: "Read a four-question report: what you offer, who it's for, where they are, and what to fix first — grounded in your live page." },
    { name: "Engine", text: "Paid plans unlock a weekly, prioritised action queue that verifies each fix and tracks your score over time." },
  ],
});

const FINAL_CTA: FinalCtaContent = {
  eyebrow: "Free, no account needed",
  headline: "See it on your own product",
  subhead: "Paste your URL and get your Discoverability Score and ranked action list in ~90 seconds.",
};

export default function HowItWorksPage() {
  return (
    <main aria-label="How ReachKit works">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_TO_LD) }} />

      {/* Hero */}
      <section className="relative flex flex-col items-center gap-6 overflow-hidden px-(--spacing-content-x) pb-(--spacing-section-y) pt-20 text-center sm:pt-28">
        <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--color-accent-400)" }}>
          How it works
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-[var(--tracking-display)] sm:text-5xl lg:text-6xl" style={{ color: "var(--color-fg)", lineHeight: 1.05 }}>
          From a URL to a ranked action list — in about 90 seconds
        </h1>
        <p className="max-w-xl text-lg leading-relaxed" style={{ color: "var(--color-muted)" }}>
          No agency, no audit deck, no guesswork. ReachKit reads your live product page and hands
          you a score and the specific fixes that move it.
        </p>
      </section>

      {/* The 3 modules */}
      <HowItWorksScroll />

      {/* CTA */}
      <FinalCta content={FINAL_CTA}>
        <ScanInput />
      </FinalCta>
    </main>
  );
}
