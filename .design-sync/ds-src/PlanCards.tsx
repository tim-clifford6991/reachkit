/* @mirrors components/sections/captured/pricing-html.ts */
import * as React from "react";

/**
 * PlanCards — the shared three-tier plan grid (Free scan €0 · Solo €59 · Growth
 * €129, Solo flagged MOST POPULAR). In its default (grid) mode it is the plan
 * grid reused by the landing pricing preview (`PricingBlock`); with `page` it
 * renders the FULL captured pricing page (`pricing-html.ts`) — header, the plan
 * grid, the "Compare every plan" matrix, the "Questions, answered" FAQ, and the
 * closing "Start with a free scan." CTA — so `PricingScreen` (/pricing) can
 * delegate to a single source and the plans, prices, features and matrix copy
 * are defined ONCE. Mirrors the live pricing markup 1:1.
 */
export interface PlanCardsProps {
  tiers?: Tier[];
  /** Render the whole captured pricing page (header + grid + compare + FAQ + CTA)
   *  instead of just the plan grid. Used by PricingScreen; the landing
   *  PricingBlock leaves it off for a bare grid. */
  page?: boolean;
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
const JM = "var(--font-mono)";

export const DEFAULT_TIERS: Tier[] = [
  { name: "Free scan", price: "€0", sub: "one-time, no card", cta: "Scan my site", features: ["Your Discoverability Score", "3 pillar sub-scores", "Top 3 ranked fixes", "Positioning Mirror"] },
  { name: "Solo", price: "€59", per: "/mo", sub: "for one product", cta: "Start Solo", popular: true, features: ["Everything in Free, unlocked", "Weekly re-scan + score history", "Verified action engine", "Full 18-signal breakdown", "20-keyword rank depth"] },
  { name: "Growth", price: "€129", per: "/mo", sub: "up to 3 products", cta: "Start Growth", features: ["Everything in Solo", "Track 3 products", "50-keyword rank depth"] },
];

// The "Compare every plan" matrix — rows/cells verbatim from the live pricing
// page. Note the Free "Products tracked" cell reads "1 scan", not "1".
const COMPARE: { feature: string; cells: [string, string, string] }[] = [
  { feature: "Discoverability Score + 3 pillars", cells: ["✓", "✓", "✓"] },
  { feature: "Positioning Mirror", cells: ["✓", "✓", "✓"] },
  { feature: "Ranked fixes", cells: ["Top 3", "Full plan (up to 8)", "Full plan (up to 8)"] },
  { feature: "Full 18-signal breakdown", cells: ["—", "✓", "✓"] },
  { feature: "Weekly re-scan + score history", cells: ["—", "✓", "✓"] },
  { feature: "Verified action engine", cells: ["—", "✓", "✓"] },
  { feature: "Keyword rank depth", cells: ["—", "20", "50"] },
  { feature: "Products tracked", cells: ["1 scan", "1", "3"] },
];
const COLS = "2fr 1fr 1fr 1fr";

const FAQ: { q: string; a: string }[] = [
  { q: "Do I need a credit card for the free scan?", a: "No. Your first scan and full report preview are free with no card — you only add payment when you want weekly tracking." },
  { q: 'What counts as a "product"?', a: "One URL — an App Store, Play Store, or website page. Solo tracks one product; Growth tracks up to three." },
  { q: "How is the Discoverability Score calculated?", a: "Two 0–100 drivers multiplied together: on-page readiness (8 on-site fundamentals of your page) and search presence (your real ranked keywords). Both have to be strong — a perfect page nobody finds still scores low. Both drivers are broken out in your report." },
  { q: "Can I cancel anytime?", a: "Yes. Plans are month-to-month — cancel in one click and keep access until the end of your billing period." },
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

function PlanGrid({ tiers }: { tiers: Tier[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 18, alignItems: "stretch" }}>
      {tiers.map((t) => <TierCard key={t.name} t={t} />)}
    </div>
  );
}

function CompareMatrix() {
  return (
    <>
      <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 24, letterSpacing: "-0.02em", margin: "54px 0 18px", textAlign: "center" }}>Compare every plan</h2>
      <div style={{ border: "1px solid var(--c-line)", borderRadius: 16, overflow: "hidden", background: "var(--c-surface)" }}>
        <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "14px 22px", borderBottom: "1px solid var(--c-line2)", background: "var(--c-bg2)", fontSize: 12, fontWeight: 700, letterSpacing: "0.03em", color: "var(--c-faint)", textTransform: "uppercase" }}>
          <span>Feature</span><span style={{ textAlign: "center" }}>Free</span><span style={{ textAlign: "center", color: "var(--c-action)" }}>Solo</span><span style={{ textAlign: "center" }}>Growth</span>
        </div>
        {COMPARE.map((row) => (
          <div key={row.feature} style={{ display: "grid", gridTemplateColumns: COLS, padding: "13px 22px", borderBottom: "1px solid var(--c-fill)", alignItems: "center", fontSize: 14 }}>
            <span style={{ fontWeight: 600, color: "var(--c-muted)" }}>{row.feature}</span>
            {row.cells.map((c, j) => (
              <span key={j} style={{ textAlign: "center", fontFamily: JM, fontSize: 13, fontWeight: j === 2 ? 700 : 500, color: c === "✓" ? (j === 2 ? "var(--c-action)" : "var(--c-band-findable)") : c === "—" ? "var(--c-faint)" : "var(--c-muted)" }}>{c}</span>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function FaqBlock() {
  return (
    <>
      <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 24, letterSpacing: "-0.02em", margin: "54px 0 18px", textAlign: "center" }}>Questions, answered</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16 }}>
        {FAQ.map((f) => (
          <div key={f.q} style={{ border: "1px solid var(--c-line)", borderRadius: 14, padding: 22, background: "var(--c-surface)" }}>
            <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{f.q}</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--c-muted)" }}>{f.a}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function ClosingCta() {
  return (
    <div style={{ marginTop: 40, background: "linear-gradient(135deg, var(--c-dark), var(--c-dark2))", borderRadius: 18, padding: 34, textAlign: "center" }}>
      <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 24, color: "var(--c-on-dark)", margin: "0 0 8px" }}>Start with a free scan.</h3>
      <p style={{ fontSize: 15, color: "var(--c-on-dark-muted)", margin: "0 0 20px" }}>See your number in under a minute. Upgrade only when you want to track it.</p>
      <button style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, color: "var(--c-ink)", background: "var(--c-surface)", border: "none", borderRadius: 10, padding: "13px 26px", cursor: "pointer" }}>Analyze my site</button>
    </div>
  );
}

export function PlanCards({ tiers = DEFAULT_TIERS, page = false }: PlanCardsProps) {
  if (!page) return <PlanGrid tiers={tiers} />;
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "72px 28px 80px" }}>
      <div style={{ textAlign: "center", marginBottom: 42 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-action)", textTransform: "uppercase" }}>Pricing</div>
        <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 42, letterSpacing: "-0.03em", margin: "12px 0 0" }}>One number. Then a short, verified list.</h1>
        <p style={{ fontSize: 17, color: "var(--c-muted)", margin: "12px auto 0", maxWidth: 540 }}>Your first scan is free. Track it weekly when you&apos;re ready to move. Cancel in one click.</p>
      </div>
      <PlanGrid tiers={tiers} />
      <CompareMatrix />
      <FaqBlock />
      <ClosingCta />
    </main>
  );
}
