/* @mirrors components/sections/captured/pricing-html.ts */
import * as React from "react";

/**
 * PlanCards — the shared three-tier plan grid (Free scan €0 · Solo €59 · Growth
 * €129, Solo flagged MOST POPULAR) used by BOTH the landing pricing preview
 * (`PricingBlock`) and the `/pricing` page (`PricingScreen`), so the plans,
 * prices and features are defined ONCE. Mirrors the plan cards in the live
 * pricing markup.
 */
export interface PlanCardsProps {
  tiers?: Tier[];
}

export interface Tier {
  name: string;
  price: string;
  per?: string;
  sub: string;
  cta: string;
  features: string[];
  popular?: boolean;
}

const SG = "var(--font-display)";

export const DEFAULT_TIERS: Tier[] = [
  { name: "Free scan", price: "€0", sub: "one-time, no card", cta: "Scan my site", features: ["Your Discoverability Score", "3 pillar sub-scores", "Top 3 ranked fixes", "Positioning Mirror"] },
  { name: "Solo", price: "€59", per: "/mo", sub: "for one product", cta: "Start Solo", popular: true, features: ["Everything in Free, unlocked", "Weekly re-scan + score history", "Verified action engine", "Full 18-signal breakdown", "20-keyword rank depth"] },
  { name: "Growth", price: "€129", per: "/mo", sub: "up to 3 products", cta: "Start Growth", features: ["Everything in Solo", "Track 3 products", "50-keyword rank depth"] },
];

function TierCard({ t }: { t: Tier }) {
  return (
    <div style={{ position: "relative", background: "var(--c-surface)", border: t.popular ? "2px solid var(--c-action)" : "1px solid var(--c-line)", borderRadius: 18, padding: 28, display: "flex", flexDirection: "column", boxShadow: t.popular ? "0 20px 50px -24px rgba(110,86,247,0.5)" : "none" }}>
      {t.popular && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "var(--c-action)", color: "var(--c-on-dark)", fontSize: 11.5, fontWeight: 700, padding: "4px 12px", borderRadius: 7, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>MOST POPULAR</div>}
      <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 18, color: t.popular ? "var(--c-action)" : "var(--c-ink)" }}>{t.name}</div>
      <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 40, margin: "12px 0 2px" }}>{t.price}{t.per && <span style={{ fontSize: 16, color: "var(--c-faint)", fontWeight: 600 }}>{t.per}</span>}</div>
      <div style={{ fontSize: 13, color: "var(--c-faint)", marginBottom: 18 }}>{t.sub}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 14, color: "var(--c-muted)", flex: 1 }}>
        {t.features.map((f) => <div key={f}>✓ {f}</div>)}
      </div>
      <button style={{ marginTop: 20, fontFamily: "var(--font-sans)", fontWeight: t.popular ? 700 : 600, fontSize: 14.5, padding: t.popular ? 12 : 11, borderRadius: 10, cursor: "pointer", color: t.popular ? "var(--c-on-dark)" : "var(--c-ink)", background: t.popular ? "var(--c-action)" : "var(--c-surface)", border: t.popular ? "1px solid transparent" : "1.5px solid var(--c-line)" }}>{t.cta}</button>
    </div>
  );
}

export function PlanCards({ tiers = DEFAULT_TIERS }: PlanCardsProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 18, alignItems: "stretch" }}>
      {tiers.map((t) => <TierCard key={t.name} t={t} />)}
    </div>
  );
}
