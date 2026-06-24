/**
 * PlansGrid — server-rendered grid of paid tier cards for one billing interval.
 *
 * Free is no longer a plan (the first scan is a free lead magnet, not a tier).
 * Solo / Growth render with monthly or annual pricing; annual = 2 months free.
 * The interval is threaded into Stripe checkout via PricingCheckoutLinks.
 *
 * Server component — only the checkout button and the billing toggle are client
 * islands, which keeps the (marketing) First Load JS under budget.
 */

import { TierCard } from "@/components/sections/pricing-table";
import type { PricingTier } from "@/components/sections/pricing-table";
import { PricingCheckoutLinks } from "./pricing-checkout-links";

type Interval = "month" | "year";

interface PlanDef {
  plan: "solo" | "growth";
  name: string;
  description: string;
  features: readonly string[];
  highlighted?: boolean;
  badge?: string;
  monthly: { price: string; period: string };
  annual: { price: string; period: string; note: string };
}

const PLANS: readonly PlanDef[] = [
  {
    plan: "solo",
    name: "Solo",
    description: "1 product, weekly action queue, drafts, monitoring.",
    features: [
      "Weekly action queue",
      "Draft copy for every action",
      "Score history & weekly deltas",
      "Action verification",
      "20 keyword rank-depth",
    ],
    highlighted: true,
    badge: "Most popular",
    monthly: { price: "$59", period: "/ month" },
    annual: { price: "$590", period: "/ year", note: "≈ $49/mo · 2 months free" },
  },
  {
    plan: "growth",
    name: "Growth",
    description: "3 products, higher quotas, deeper rank tracking.",
    features: [
      "Everything in Solo",
      "3 products tracked",
      "100 draft actions per refresh",
      "50 keyword rank-depth",
      "Priority support",
    ],
    monthly: { price: "$129", period: "/ month" },
    annual: { price: "$1,290", period: "/ year", note: "≈ $108/mo · 2 months free" },
  },
];

function toTier(def: PlanDef, interval: Interval): PricingTier {
  const money = interval === "year" ? def.annual : def.monthly;
  return {
    name: def.name,
    price: money.price,
    period: money.period,
    priceNote: interval === "year" ? def.annual.note : undefined,
    description: def.description,
    features: def.features,
    highlighted: def.highlighted,
    badge: def.badge,
    cta: (
      <PricingCheckoutLinks
        plan={def.plan}
        interval={interval}
        label="Get started"
        highlighted={def.highlighted}
      />
    ),
  };
}

export function PlansGrid({ interval }: { interval: Interval }) {
  return (
    <div
      className="grid w-full max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2"
      role="list"
      aria-label="Pricing tiers"
    >
      {PLANS.map((def) => (
        <div key={def.plan} role="listitem">
          <TierCard tier={toTier(def, interval)} />
        </div>
      ))}
    </div>
  );
}
