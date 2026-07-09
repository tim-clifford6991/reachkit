/* @mirrors components/sections/captured/pricing-screen.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { Footer } from "./Footer";

/**
 * PricingScreen — the marketing pricing page (`/pricing`), mirroring the LIVE
 * captured screen: NavBar, a centred "PRICING" header ("One number. Then a
 * short, verified list."), the three plan cards (Free scan $0 · Solo $59 ·
 * Growth $129, Growth flagged MOST POPULAR), and the "Compare every plan"
 * matrix, then the footer. Self-contained; renders fully with no props.
 */
export interface PricingScreenProps {
  _unused?: never;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";
const SECTION: React.CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };

type Tier = {
  name: string; price: string; per?: string; sub: string; cta: string;
  features: string[]; popular?: boolean;
};

const TIERS: Tier[] = [
  { name: "Free scan", price: "$0", sub: "one-time, no card", cta: "Scan my site",
    features: ["Your Discoverability Score", "3 pillar sub-scores", "Top 3 ranked fixes", "Positioning Mirror"] },
  { name: "Solo", price: "$59", per: "/mo", sub: "for one product", cta: "Start Solo",
    features: ["Everything in Free, unlocked", "Weekly re-scan + score history", "Verified action engine", "Full 18-signal breakdown", "20-keyword rank depth"] },
  { name: "Growth", price: "$129", per: "/mo", sub: "up to 3 products", cta: "Start Growth", popular: true,
    features: ["Everything in Solo", "Track 3 products", "50-keyword rank depth", "Shareable score cards", "One-click public teardowns"] },
];

const COMPARE: { feature: string; cells: [string, string, string] }[] = [
  { feature: "Discoverability Score + 3 pillars", cells: ["✓", "✓", "✓"] },
  { feature: "Positioning Mirror", cells: ["✓", "✓", "✓"] },
  { feature: "Ranked fixes", cells: ["Top 3", "All 7", "All 7"] },
  { feature: "Full 18-signal breakdown", cells: ["—", "✓", "✓"] },
  { feature: "Weekly re-scan + score history", cells: ["—", "✓", "✓"] },
  { feature: "Verified action engine", cells: ["—", "✓", "✓"] },
  { feature: "Keyword rank depth", cells: ["—", "20", "50"] },
  { feature: "Products tracked", cells: ["1", "1", "3"] },
  { feature: "Shareable score cards", cells: ["—", "—", "✓"] },
];

function Check() {
  return <span style={{ color: "var(--c-band-findable)", fontWeight: 700 }}>✓</span>;
}

function TierCard({ t }: { t: Tier }) {
  return (
    <div style={{ position: "relative", background: "var(--c-surface)", border: t.popular ? "2px solid var(--c-action)" : "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", padding: "26px 24px", boxShadow: t.popular ? "var(--elevation-glow)" : "none", display: "flex", flexDirection: "column" }}>
      {t.popular && (
        <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "var(--c-action)", color: "var(--c-on-dark)", fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", padding: "4px 12px", borderRadius: 999, whiteSpace: "nowrap" }}>MOST POPULAR</span>
      )}
      <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 18, color: t.popular ? "var(--c-action)" : "var(--c-ink)" }}>{t.name}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "10px 0 2px" }}>
        <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 40, letterSpacing: "-0.02em" }}>{t.price}</span>
        {t.per && <span style={{ fontSize: 15, color: "var(--c-faint)" }}>{t.per}</span>}
      </div>
      <div style={{ fontSize: 13, color: "var(--c-faint)", marginBottom: 18 }}>{t.sub}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, flex: 1 }}>
        {t.features.map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 14, color: "var(--c-muted)" }}>
            <Check />{f}
          </div>
        ))}
      </div>
      <button style={{ marginTop: 22, width: "100%", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, padding: "12px 16px", borderRadius: "var(--radius-lg)", cursor: "pointer", color: t.popular ? "var(--c-on-dark)" : "var(--c-ink)", background: t.popular ? "var(--c-action)" : "var(--c-surface)", border: t.popular ? "1px solid transparent" : "1px solid var(--c-line)" }}>{t.cta}</button>
    </div>
  );
}

export function PricingScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)", minHeight: "100%" }}>
      <NavBar />

      <div style={{ ...SECTION, padding: "56px 24px 12px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ fontFamily: JM, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--c-action)" }}>PRICING</span>
        <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(1.9rem, 4vw, 44px)", letterSpacing: "-0.025em", margin: 0 }}>One number. Then a short, verified list.</h1>
        <p style={{ fontSize: 16, color: "var(--c-muted)", maxWidth: 600, margin: "0 auto", lineHeight: 1.6 }}>Your first scan is free. Track it weekly when you&apos;re ready to move. Cancel in one click.</p>
      </div>

      <div style={{ ...SECTION, padding: "32px 24px 56px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, alignItems: "stretch" }}>
        {TIERS.map((t) => <TierCard key={t.name} t={t} />)}
      </div>

      <div style={{ ...SECTION, padding: "0 24px 72px" }}>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 26, textAlign: "center", letterSpacing: "-0.02em", margin: "0 0 24px" }}>Compare every plan</h2>
        <div style={{ border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", background: "var(--c-bg2)", borderBottom: "1px solid var(--c-line)", padding: "12px 18px", fontFamily: JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--c-faint)" }}>
            <span>FEATURE</span><span style={{ textAlign: "center" }}>FREE</span><span style={{ textAlign: "center" }}>SOLO</span><span style={{ textAlign: "center", color: "var(--c-action)" }}>GROWTH</span>
          </div>
          {COMPARE.map((row, i) => (
            <div key={row.feature} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", padding: "13px 18px", borderTop: i === 0 ? "none" : "1px solid var(--c-line2)", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)" }}>{row.feature}</span>
              {row.cells.map((c, j) => (
                <span key={j} style={{ textAlign: "center", fontFamily: c === "✓" || c === "—" ? "inherit" : JM, fontSize: 13, color: c === "✓" ? "var(--c-band-findable)" : c === "—" ? "var(--c-faint)" : "var(--c-muted)", fontWeight: c === "✓" ? 700 : 500 }}>{c}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
