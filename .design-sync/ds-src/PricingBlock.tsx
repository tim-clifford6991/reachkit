/* @mirrors components/sections/captured/landing-html.ts */
import * as React from "react";

/**
 * PricingBlock — the landing's pricing preview: the "Pricing / One number. Then
 * a short, verified list." heading and the three plan cards (Free scan $0 · Solo
 * $59 · Growth $129, Growth flagged MOST POPULAR). Mirrors the pricing section of
 * the live landing (`landing-html.ts`). The full compare matrix lives on
 * `PricingScreen` (/pricing).
 */
export interface PricingBlockProps {
  _unused?: never;
}

const SG = "var(--font-display)";
type Tier = { name: string; price: string; per?: string; sub: string; cta: string; features: string[]; popular?: boolean };
const TIERS: Tier[] = [
  { name: "Free scan", price: "$0", sub: "one-time, no card", cta: "Scan my site", features: ["Your Discoverability Score", "3 pillar sub-scores", "Top 3 ranked fixes", "Positioning Mirror"] },
  { name: "Solo", price: "$59", per: "/mo", sub: "for one product", cta: "Start Solo", features: ["Everything in Free, unlocked", "Weekly re-scan + score history", "Verified action engine", "Full 18-signal breakdown", "20-keyword rank depth"] },
  { name: "Growth", price: "$129", per: "/mo", sub: "up to 3 products", cta: "Start Growth", popular: true, features: ["Everything in Solo", "Track 3 products", "50-keyword rank depth", "Shareable score cards", "One-click public teardowns"] },
];

function Tier({ t }: { t: Tier }) {
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

export function PricingBlock() {
  return (
    <section style={{ maxWidth: 1080, margin: "0 auto", padding: "30px 28px 70px" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-action)", textTransform: "uppercase" }}>Pricing</div>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 36, letterSpacing: "-0.03em", margin: "12px 0 0" }}>One number. Then a short, verified list.</h2>
        <p style={{ fontSize: 16, color: "var(--c-muted)", margin: "10px 0 0" }}>Your first scan is free. Upgrade when you&apos;re ready to make that number the weekly meter of your marketing — and watch the gap close.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, alignItems: "stretch" }}>
        {TIERS.map((t) => <Tier key={t.name} t={t} />)}
      </div>
    </section>
  );
}
