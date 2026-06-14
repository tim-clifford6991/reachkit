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
import { PricingTable } from "@/components/sections/pricing-table";
import { Faq } from "@/components/sections/faq";
import { PricingCheckoutLinks } from "./pricing-checkout-links";
import type { PricingTableContent } from "@/components/sections/pricing-table";
import type { FaqContent } from "@/components/sections/faq";

export const metadata = buildMetadata({
  title: "Pricing — ReachKit",
  description:
    "Free to scan. $29/mo to turn your report into a weekly action engine. No lock-in.",
  path: "/pricing",
});

// ---------------------------------------------------------------------------
// Content objects
// ---------------------------------------------------------------------------

const PRICING_CONTENT = {
  eyebrow: "Transparent pricing",
  headline: "Free to scan.\nPaid to act.",
  subhead:
    "Run your first scan for free. Upgrade when you're ready to turn the report into a weekly engine — queue, drafts, deltas, verification.",
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
            borderColor: "var(--hairline-strong)",
            color: "var(--color-fg)",
            background: "var(--fill-subtle)",
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
      cta: <PricingCheckoutLinks plan="solo" label="Start 7-day free trial" highlighted />,
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
      cta: <PricingCheckoutLinks plan="growth" label="Start 7-day free trial" />,
    },
  ],
} satisfies PricingTableContent;

const FAQ_CONTENT = {
  eyebrow: "Common questions",
  headline: "Honest answers",
  items: [
    {
      q: "What counts as a scan?",
      a: "One App Store URL or website URL analysed by the four-question engine. Free accounts get one scan; paid accounts can re-scan the same app weekly.",
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
    priceUsd: 29,
  });
  // Product + Offer ladder (Free / Solo $29 / Growth $99) — §22.2 GEO pricing.
  const productLd = offerLd({
    name: `${SITE.name} subscription`,
    url: `${SITE.url}/pricing`,
    tiers: [
      { name: "Free", priceUsd: 0, description: "One scan, a full report, 3 sample actions." },
      { name: "Solo", priceUsd: 29, description: "1 app, weekly queue, drafts, monitoring." },
      { name: "Growth", priceUsd: 99, description: "3 apps, higher quotas, deeper rank tracking." },
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

        {/* Sections composed from the §21.1 section library */}
        <PricingTable content={PRICING_CONTENT} />
        <Faq content={FAQ_CONTENT} />
      </div>
    </main>
  );
}
