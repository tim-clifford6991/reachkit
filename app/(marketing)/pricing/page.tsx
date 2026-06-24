/**
 * Pricing page — the Claude Design pricing page imported 1:1 (captured HTML +
 * hydrated CTAs). Keeps the SoftwareApplication + Offer JSON-LD.
 */

import { buildMetadata, softwareApplicationLd, offerLd, SITE } from "@/lib/seo";
import { PricingScreen } from "@/components/sections/captured/pricing-screen";

export const metadata = buildMetadata({
  title: "Pricing — ReachKit",
  description:
    "Your first scan is free. From $59/mo to turn the report into a weekly action engine — or save two months with annual billing. No lock-in.",
  path: "/pricing",
});

export default function PricingPage() {
  const appLd = softwareApplicationLd({ name: SITE.name, url: SITE.url, priceUsd: 59 });
  const productLd = offerLd({
    name: `${SITE.name} subscription`,
    url: `${SITE.url}/pricing`,
    tiers: [
      { name: "Solo", priceUsd: 59, description: "1 product, weekly queue, drafts, monitoring." },
      { name: "Growth", priceUsd: 129, description: "3 products, higher quotas, deeper rank tracking." },
    ],
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }} />
      <PricingScreen />
    </>
  );
}
