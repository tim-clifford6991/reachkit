import * as React from "react";
import { NavBar } from "./NavBar";
import { ScanInput } from "./ScanInput";
import { ScoreGauge } from "./ScoreGauge";
import { FeatureStep } from "./FeatureStep";
import { ComparisonTable } from "./ComparisonTable";
import { PricingTable } from "./PricingTable";
import { FaqItem } from "./FaqItem";
import { Footer } from "./Footer";

/**
 * LandingScreen — the marketing home page (`/`), mirroring the LIVE composition
 * (`landing-screen.tsx` → `scan-hero.tsx` + `company-ticker.tsx` + captured
 * sections): a SPLIT hero (headline + evidence pill + scan input on the left, a
 * live report-card mock on the right), the logo ticker, the 3-step "how it works",
 * the feature-comparison matrix, pricing, FAQ, and footer. Composes the real
 * primitives so the whole page is viewable + tweakable in one card.
 */
export interface LandingScreenProps {
  _unused?: never;
}

const JM = "var(--font-mono)";
const SECTION: React.CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "0 24px" };

function ReportMock() {
  return (
    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-lg)", padding: 22, display: "flex", flexDirection: "column", gap: 16, transform: "rotate(1.2deg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}>bloom.io · discoverability</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, fontFamily: JM, color: "var(--c-band-hard)", background: "var(--c-tint-orange)", padding: "3px 8px", borderRadius: 999 }}>Hard to find</span>
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <ScoreGauge score={41} size={116} showBand={false} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
          {[{ l: "Content", v: 58 }, { l: "Outreach", v: 22 }, { l: "SEO", v: 44 }].map((p) => (
            <div key={p.l} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 58, fontSize: 12, color: "var(--c-muted)" }}>{p.l}</span>
              <div style={{ flex: 1, height: 7, borderRadius: 4, background: "var(--c-fill)" }}><div style={{ width: `${p.v}%`, height: "100%", borderRadius: 4, background: p.v >= 55 ? "var(--c-band-findable)" : p.v >= 40 ? "var(--c-band-fair)" : "var(--c-band-invisible)" }} /></div>
              <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-ink)" }}>{p.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />

      {/* SPLIT HERO (radial fade) */}
      <div style={{ background: "radial-gradient(1100px 460px at 30% -10%, var(--c-soft), transparent 70%)" }}>
        <div style={{ ...SECTION, padding: "56px 24px 40px", display: "flex", flexWrap: "wrap", gap: 40, alignItems: "center" }}>
          <div style={{ flex: "1 1 440px", minWidth: 300, display: "flex", flexDirection: "column", gap: 20 }}>
            <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "var(--c-action)", background: "var(--c-soft)", border: "1px solid var(--c-tint-violet-line)", padding: "5px 11px", borderRadius: 999 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--c-action)" }} /> Grounded in your live page — not generic advice
            </span>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2.2rem, 5vw, 3.4rem)", lineHeight: 1.05, letterSpacing: "-0.025em", margin: 0 }}>
              Your competitors are being found. <em style={{ fontStyle: "italic", color: "var(--c-muted)" }}>You aren't.</em> <span style={{ color: "var(--c-action)" }}>See exactly why.</span>
            </h1>
            <p style={{ fontSize: 17, color: "var(--c-muted)", lineHeight: 1.6, margin: 0, maxWidth: 520 }}>Paste your URL for a free discoverability score — the SEO gaps, positioning blind spots, and the ranked plan to fix them.</p>
            <ScanInput />
            <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)" }}>Under a minute · No login for your first scan · Try: bloom.io</span>
          </div>
          <div style={{ flex: "1 1 340px", minWidth: 280 }}><ReportMock /></div>
        </div>

        {/* LOGO TICKER */}
        <div style={{ ...SECTION, padding: "8px 24px 40px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 22, justifyContent: "center", opacity: 0.7 }}>
          <span style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)" }}>SCANNED THIS WEEK</span>
          {["linear.app", "notion.so", "cal.com", "resend.com", "posthog.com"].map((c) => (
            <span key={c} style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--c-muted)" }}>{c}</span>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ ...SECTION, padding: "56px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, letterSpacing: "-0.02em", textAlign: "center", margin: 0 }}>From URL to a ranked plan in three steps</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center" }}>
          <div style={{ flex: "1 1 260px", maxWidth: 320 }}><FeatureStep step={1} title="Paste a URL. Get a score in under a minute." body="We scan your live page and score how findable you are across Content, Outreach and SEO — no login for your first scan." /></div>
          <div style={{ flex: "1 1 260px", maxWidth: 320 }}><FeatureStep step={2} title="See how rivals get found." body="We discover your real competitors and where their customers come from — the channels, keywords and content you can copy." /></div>
          <div style={{ flex: "1 1 260px", maxWidth: 320 }}><FeatureStep step={3} title="Work a ranked weekly plan." body="A calendar of the highest-leverage moves — with drafts ready to send — that lifts your score over time." /></div>
        </div>
      </div>

      {/* COMPARISON */}
      <div style={{ ...SECTION, padding: "24px 24px 56px" }}>
        <ComparisonTable
          tools={["ReachKit", "Ahrefs", "Doing it manually"]}
          rows={[
            { capability: "Discoverability score", cells: [true, false, false] },
            { capability: "Competitor channel teardown", cells: [true, "partial", false] },
            { capability: "Ranked weekly plan", cells: [true, false, false] },
            { capability: "Draft copy per fix", cells: [true, false, false] },
            { capability: "Backlink index", cells: [false, true, false] },
          ]}
        />
      </div>

      {/* PRICING */}
      <div style={{ background: "var(--c-surface)", borderTop: "1px solid var(--c-line)", borderBottom: "1px solid var(--c-line)", padding: "56px 0" }}>
        <div style={SECTION}><PricingTable /></div>
      </div>

      {/* FAQ */}
      <div style={{ ...SECTION, padding: "56px 24px", maxWidth: 760, display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, textAlign: "center", margin: "0 0 12px" }}>Questions</h2>
        <FaqItem question="How long does a scan take?" answer="Your first free scan takes under a minute. The deep paid scan (competitors + customers + plan) runs in a couple of minutes." open />
        <FaqItem question="Do I need to install anything?" answer="No. Paste your URL — we scan your live public page and public SEO signals. Nothing to embed." />
        <FaqItem question="Will this auto-post for me?" answer="Never. We draft everything and hand it to you to review and publish — auto-posting risks shadow-bans. You stay in control." />
      </div>

      <Footer />
    </div>
  );
}
