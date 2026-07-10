/* @mirrors components/sections/captured/pricing-screen.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { PlanCards } from "./PlanCards";
import { Footer } from "./Footer";

/**
 * PricingScreen — the marketing pricing page (`/pricing`), mirroring the LIVE
 * captured screen: NavBar, a centred "PRICING" header ("One number. Then a
 * short, verified list."), the shared `PlanCards` grid (Free $0 · Solo $59 ·
 * Growth $129), and the "Compare every plan" matrix, then the footer.
 * Self-contained; renders fully with no props.
 */
export interface PricingScreenProps {
  _unused?: never;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";
const SECTION: React.CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };

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
const COLS = "1.6fr 1fr 1fr 1fr";

export function PricingScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)", minHeight: "100%" }}>
      <NavBar />

      <div style={{ ...SECTION, padding: "56px 24px 12px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ fontFamily: JM, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--c-action)" }}>PRICING</span>
        <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(1.9rem, 4vw, 44px)", letterSpacing: "-0.025em", margin: 0 }}>One number. Then a short, verified list.</h1>
        <p style={{ fontSize: 16, color: "var(--c-muted)", maxWidth: 600, margin: "0 auto", lineHeight: 1.6 }}>Your first scan is free. Track it weekly when you&apos;re ready to move. Cancel in one click.</p>
      </div>

      <div style={{ ...SECTION, padding: "32px 24px 56px" }}>
        <PlanCards />
      </div>

      <div style={{ ...SECTION, padding: "0 24px 72px" }}>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 26, textAlign: "center", letterSpacing: "-0.02em", margin: "0 0 24px" }}>Compare every plan</h2>
        <div style={{ border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: COLS, background: "var(--c-bg2)", borderBottom: "1px solid var(--c-line)", padding: "12px 18px", fontFamily: JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--c-faint)" }}>
            <span>FEATURE</span><span style={{ textAlign: "center" }}>FREE</span><span style={{ textAlign: "center" }}>SOLO</span><span style={{ textAlign: "center", color: "var(--c-action)" }}>GROWTH</span>
          </div>
          {COMPARE.map((row, i) => (
            <div key={row.feature} style={{ display: "grid", gridTemplateColumns: COLS, padding: "13px 18px", borderTop: i === 0 ? "none" : "1px solid var(--c-line2)", alignItems: "center" }}>
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
