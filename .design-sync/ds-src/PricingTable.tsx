import * as React from "react";

export interface PricingTier {
  name: string;
  price: string;
  period?: string;
  tagline: string;
  features: string[];
  cta: string;
  featured?: boolean;
}

/**
 * PricingTable — ReachKit's plan-selection block: a responsive row of plan cards.
 * The `featured` tier is promoted with a violet border, a "Most popular" pill, a
 * raised shadow, and a solid-violet CTA. Renders fully with no props.
 */
export interface PricingTableProps {
  tiers?: PricingTier[];
}

const DEFAULT_TIERS: PricingTier[] = [
  { name: "Free", price: "$0", tagline: "One free scan to see your score", features: ["1 discoverability scan", "Score + top 3 fixes", "Positioning Mirror"], cta: "Scan your site" },
  { name: "Solo", price: "$19", period: "/mo", featured: true, tagline: "For founders shipping solo", features: ["1 product, weekly re-scan", "All 7 ranked fixes + draft copy", "18-signal breakdown", "Score history & verified fixes"], cta: "Start Solo" },
  { name: "Growth", price: "$49", period: "/mo", tagline: "For multiple products", features: ["Up to 5 products", "Everything in Solo", "Priority scans", "Email digests"], cta: "Start Growth" },
];

export function PricingTable({ tiers = DEFAULT_TIERS }: PricingTableProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18, alignItems: "stretch", maxWidth: 1080, margin: "0 auto", fontFamily: "var(--font-sans)" }}>
      {tiers.map((tier) => {
        const featured = !!tier.featured;
        return (
          <div key={tier.name} style={{ position: "relative", display: "flex", flexDirection: "column", padding: 28, background: "var(--c-surface)", border: featured ? "2px solid var(--c-action)" : "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", transform: featured ? "translateY(-8px)" : "none", boxShadow: featured ? "rgba(110, 86, 247, 0.5) 0px 20px 50px -24px" : "none" }}>
            {featured && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "var(--c-action)", color: "var(--c-on-dark)", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.03em", padding: "4px 12px", borderRadius: "var(--radius-lg)", whiteSpace: "nowrap" }}>Most popular</div>}
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: featured ? "var(--c-action)" : "var(--c-ink)" }}>{tier.name}</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 40, color: "var(--c-ink)", margin: "12px 0 2px" }}>{tier.price}{tier.period && <span style={{ fontSize: 16, fontWeight: 600, color: "var(--c-muted)" }}>{tier.period}</span>}</div>
            <div style={{ fontSize: 13, color: "var(--c-faint)", marginBottom: 18 }}>{tier.tagline}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--c-muted)", flex: "1 1 0%" }}>
              {tier.features.map((feature, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ flex: "0 0 auto", marginTop: 1, width: 16, height: 16, borderRadius: 999, background: "var(--c-soft)", color: "var(--c-action)", fontSize: 11, fontWeight: 700, lineHeight: "16px", textAlign: "center" }}>✓</span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <button type="button" style={{ marginTop: 20, fontFamily: "var(--font-sans)", fontWeight: featured ? 700 : 600, fontSize: 14.5, padding: featured ? 12 : 11, borderRadius: "var(--radius-lg)", cursor: "pointer", color: featured ? "var(--c-on-dark)" : "var(--c-ink)", background: featured ? "var(--c-action)" : "var(--c-surface)", border: featured ? "none" : "1.5px solid var(--c-line)" }}>{tier.cta}</button>
          </div>
        );
      })}
    </div>
  );
}
