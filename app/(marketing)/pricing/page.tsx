/**
 * Pricing page — §12 tier table (§21.1 refactor onto PricingTable section).
 *
 * Now composes the reusable PricingTable + Faq sections from the
 * §21.1 section library. The tier data and FAQ items are defined here
 * as content objects and passed as props.
 *
 * Marketing route — light bundle, static server component.
 */

import Link from "next/link";
import { buildMetadata, softwareApplicationLd, offerLd, SITE } from "@/lib/seo";
import { Faq } from "@/components/sections/faq";
import { PlansGrid } from "./pricing-plans";
import { BillingToggle } from "./billing-toggle";
import type { FaqContent } from "@/components/sections/faq";

export const metadata = buildMetadata({
  title: "Pricing — ReachKit",
  description:
    "Your first scan is free. From $59/mo to turn the report into a weekly action engine — or save two months with annual billing. No lock-in.",
  path: "/pricing",
});

// ---------------------------------------------------------------------------
// Content objects
// ---------------------------------------------------------------------------

const FAQ_CONTENT = {
  eyebrow: "Common questions",
  headline: "Honest answers",
  items: [
    {
      q: "What counts as a scan?",
      a: "One App Store URL or website URL analysed by the four-question engine. Your first scan is always free; paid plans re-scan the same product weekly with fresh data.",
    },
    {
      q: "Monthly or annual?",
      a: "Both. Monthly is $59 for Solo and $129 for Growth. Annual bills once a year and gives you two months free — $590/yr for Solo (≈ $49/mo) and $1,290/yr for Growth (≈ $108/mo).",
    },
    {
      q: "Is there a free trial?",
      a: "Two ways in. Your first scan is always free and gives you the full report — including score, positioning mirror, and 3 sample action cards. And every paid plan starts with a 7-day free trial: full access to the queue, drafts, and verification before your first charge. Cancel any time during the trial and you won't be billed.",
    },
    {
      q: "Can I cancel?",
      a: "Yes, any time. Your subscription cancels at the end of the billing period. No long-term contract.",
    },
    {
      q: "What is action verification?",
      a: "When you mark an action complete, ReachKit checks the live URL (or your self-report) and updates your Discoverability Score accordingly.",
    },
  ],
} satisfies FaqContent;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingPage() {
  const appLd = softwareApplicationLd({
    name: SITE.name,
    url: SITE.url,
    priceUsd: 59,
  });
  // Product + Offer ladder (Solo $59 / Growth $129) — §22.2 GEO pricing.
  const productLd = offerLd({
    name: `${SITE.name} subscription`,
    url: `${SITE.url}/pricing`,
    tiers: [
      { name: "Solo", priceUsd: 59, description: "1 product, weekly queue, drafts, monitoring." },
      { name: "Growth", priceUsd: 129, description: "3 products, higher quotas, deeper rank tracking." },
    ],
  });

  return (
    <main
      className="relative min-h-dvh"
      style={{ background: "var(--color-bg)" }}
    >
      {/* SoftwareApplication + Product/Offer JSON-LD (FAQPage emitted by <Faq />) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />

      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-32 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, var(--color-accent) 0%, transparent 70%)",
            opacity: 0.06,
          }}
        />
      </div>

      <div className="relative">
        {/* Back link */}
        <div className="px-(--spacing-content-x) pt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest transition-colors duration-150"
            style={{ color: "var(--color-muted)" }}
          >
            ← ReachKit
          </Link>
        </div>

        {/* Pricing header + interactive plans (monthly/annual toggle) */}
        <section
          className="flex flex-col items-center gap-12 px-(--spacing-content-x) py-(--spacing-section-y)"
          aria-label="Pricing"
        >
          <div className="flex max-w-lg flex-col items-center gap-4 text-center">
            <p
              className="font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--color-accent-400)" }}
            >
              Transparent pricing
            </p>
            <h1
              className="text-3xl font-bold tracking-[var(--tracking-display)] sm:text-4xl lg:text-5xl"
              style={{ color: "var(--color-fg)", lineHeight: 1.05 }}
            >
              Scan free. Pay to act.
            </h1>
            <p className="text-base leading-relaxed" style={{ color: "var(--color-muted)" }}>
              Your first scan is free. Upgrade when you&apos;re ready to turn the report into a
              weekly engine — queue, drafts, deltas, verification. Save two months with annual
              billing.
            </p>
          </div>

          <BillingToggle
            monthly={<PlansGrid interval="month" />}
            annual={<PlansGrid interval="year" />}
          />
        </section>

        <Faq content={FAQ_CONTENT} />
      </div>
    </main>
  );
}
