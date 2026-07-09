/* @mirrors components/sections/captured/landing-screen.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { ScanInput } from "./ScanInput";
import { FeatureStep } from "./FeatureStep";
import { ComparisonTable } from "./ComparisonTable";
import { PricingTable } from "./PricingTable";
import { FaqItem } from "./FaqItem";
import { Footer } from "./Footer";

/**
 * LandingScreen — the marketing home page (`/`), mirroring the LIVE composition
 * (`landing-screen.tsx` → `scan-hero.tsx` + `company-ticker.tsx` + captured
 * sections): the shared ScanHero (two-line headline with the highlighted italic
 * "You aren't.", evidence pill, scan input on the left; a browser-framed proof
 * card — gauge + band, you-vs-rival bars, next best action, search-gap rows — on
 * the right), the "companies we've analyzed" logo ticker, the 3-step "how it
 * works", the comparison matrix, pricing, FAQ, and footer.
 */
export interface LandingScreenProps {
  _unused?: never;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";
const SECTION: React.CSSProperties = { maxWidth: 1180, margin: "0 auto", padding: "0 28px" };

// Demo proof-card gauge: 280° track + a 47/100 fill (band: "hard to find").
const CX = 80, CY = 80, R = 62, START = 130, SWEEP = 280;
const gpt = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(CX + R * Math.cos(a)).toFixed(2)} ${(CY + R * Math.sin(a)).toFixed(2)}`;
};
const arc = (frac: number) => {
  const end = START + SWEEP * frac;
  const large = SWEEP * frac > 180 ? 1 : 0;
  return `M ${gpt(START)} A ${R} ${R} 0 ${large} 1 ${gpt(end)}`;
};

const RIVAL_BARS = [
  { label: "You", value: 47, color: "var(--c-band-hard)" },
  { label: "Top rival", value: 81, color: "var(--c-band-high)" },
] as const;

const GAP_ROWS = [
  { q: "habit tracker vs [rival]", vol: "2,400/mo", you: "Not ranking", ranked: false },
  { q: "best habit tracker 2026", vol: "8,100/mo", you: "#42", ranked: true },
  { q: "free habit tracker template", vol: "3,300/mo", you: "Not ranking", ranked: false },
] as const;

const chip = (color: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", fontFamily: JM, fontSize: 11, fontWeight: 700,
  color, background: `color-mix(in oklab, ${color} 11%, transparent)`, borderRadius: 7, padding: "3px 9px", whiteSpace: "nowrap",
});

// Browser-framed slice of the paid dashboard (demo data) — matches scan-hero.tsx.
function ProofCard() {
  return (
    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px -28px rgba(40,33,84,0.22)", textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--c-line2)", background: "var(--c-bg2)" }}>
        <span style={{ display: "flex", gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#FF5F57" }} />
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#FEBC2E" }} />
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#28C840" }} />
        </span>
        <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-faint)", background: "var(--c-fill)", borderRadius: 7, padding: "5px 12px" }}>app.reachkit.io/scan/bloom.io</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, padding: "24px 26px" }}>
        <div style={{ flex: "0 1 216px", minWidth: 196, textAlign: "center" }}>
          <svg width="160" height="160" viewBox="0 0 160 160" style={{ display: "block", margin: "0 auto" }} aria-hidden="true">
            <path d={arc(1)} fill="none" stroke="var(--c-fill)" strokeWidth="12" strokeLinecap="round" />
            <path d={arc(0.47)} fill="none" stroke="var(--c-band-hard)" strokeWidth="12" strokeLinecap="round" />
            <text x="80" y="82" textAnchor="middle" style={{ font: `700 34px ${JM}, monospace`, fill: "var(--c-ink)" }}>47</text>
            <text x="80" y="99" textAnchor="middle" style={{ font: `600 10px ${JM}, monospace`, fill: "var(--c-faint)" }}>/ 100</text>
          </svg>
          <div style={{ fontFamily: JM, fontSize: 11, color: "var(--c-faint)", marginTop: 2 }}>Discoverability Score</div>
          <span style={{ ...chip("var(--c-band-hard)"), fontFamily: SG, fontSize: 12, padding: "4px 11px", marginTop: 8 }}>Hard to find</span>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--c-line2)", display: "flex", flexDirection: "column", gap: 9, textAlign: "left" }}>
            {RIVAL_BARS.map((b) => (
              <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 62, fontSize: 12, fontWeight: 600, color: "var(--c-ink)" }}>{b.label}</span>
                <span style={{ flex: 1, height: 6, borderRadius: 4, background: "var(--c-fill)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${b.value}%`, borderRadius: 4, background: b.color }} />
                </span>
                <span style={{ fontFamily: JM, fontSize: 12, fontWeight: 700, color: b.color }}>{b.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: "1 1 240px", minWidth: 280, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "var(--c-tint-violet)", border: "1px solid var(--c-tint-violet-line)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-action)" }}>NEXT BEST ACTION</div>
            <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 15.5, color: "var(--c-ink)", margin: "7px 0 5px" }}>Publish 3 &ldquo;bloom vs [rival]&rdquo; comparison pages</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--c-muted)", margin: "0 0 10px" }}>Buyers comparing habit trackers run these head-to-head searches today — and land on your rivals&apos; pages, not yours.</p>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <span style={{ ...chip("var(--c-action)"), background: "var(--c-soft)" }}>Content</span>
              <span style={chip("var(--c-band-findable)")}>+6 pts est.</span>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "0 2px 8px" }}>
              <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-faint)" }}>SEARCH GAP</span>
              <span style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)" }}>queries rivals rank for — you don&apos;t</span>
            </div>
            <div style={{ border: "1px solid var(--c-line2)", borderRadius: 12, overflow: "hidden" }}>
              {GAP_ROWS.map((r, i) => (
                <div key={r.q} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 13px", borderTop: i === 0 ? "none" : "1px solid var(--c-line2)" }}>
                  <span style={{ flex: 1, fontFamily: JM, fontSize: 12.5, color: "var(--c-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.q}</span>
                  <span style={{ fontFamily: JM, fontSize: 12, color: "var(--c-muted)" }}>{r.vol}</span>
                  <span style={{ ...chip(r.ranked ? "var(--c-muted)" : "var(--c-band-invisible)"), width: 84, justifyContent: "center" }}>{r.you}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />

      {/* SHARED HERO — mirrors scan-hero.tsx (split at wide widths) */}
      <div style={{ background: "radial-gradient(1100px 480px at 50% -8%, var(--c-soft) 0%, transparent 62%), var(--c-bg)" }}>
        <div style={{ ...SECTION, padding: "70px 28px 40px", display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
          <div style={{ flex: "1 1 440px", minWidth: 300, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: JM, fontSize: 12.5, fontWeight: 600, letterSpacing: "0.04em", color: "var(--c-action)", background: "var(--c-surface)", border: "1px solid var(--c-tint-violet-line)", borderRadius: 999, padding: "7px 15px", whiteSpace: "nowrap" }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--c-action)", flexShrink: 0 }} />
              Every claim grounded in your live page.
            </span>
            <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: "clamp(1.7rem, 3vw, 40px)", lineHeight: 1.14, letterSpacing: "-0.035em", margin: "22px 0 0" }}>
              <span style={{ display: "block" }}>Your competitors are being</span>
              <span style={{ display: "block" }}>
                found.{" "}
                <span style={{ display: "inline-block", fontStyle: "italic", color: "var(--c-ink)", background: "color-mix(in oklab, var(--c-action) 20%, var(--c-surface))", padding: "0.02em 0.22em", borderRadius: "0.14em" }}>You aren&apos;t.</span>
              </span>
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: "var(--c-muted)", maxWidth: 620, margin: "18px 0 0" }}>
              Paste your URL. In under a minute ReachKit reads your live page the way a buyer&apos;s search does — then shows you the searches your rivals win, the score that measures the gap, and the ranked fixes that close it.
            </p>
            <div style={{ width: "100%", maxWidth: 520, margin: "26px 0 0" }}><ScanInput /></div>
            <p style={{ fontFamily: JM, fontSize: 12.5, color: "var(--c-faint)", margin: "14px 0 0" }}>Under a minute · No login for your first scan · Try: bloom.io</p>
          </div>
          <div style={{ flex: "1 1 460px", minWidth: 300 }}><ProofCard /></div>
        </div>

        {/* LOGO TICKER — company-ticker.tsx */}
        <div style={{ ...SECTION, padding: "18px 28px 44px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 26, justifyContent: "center" }}>
          <span style={{ fontFamily: JM, fontSize: 11, letterSpacing: "0.08em", color: "var(--c-faint)" }}>COMPANIES WE&apos;VE ANALYZED</span>
          {["Raycast", "Cal.com", "Plausible", "Reflect", "Linear", "Resend", "Bearable", "CardPointers"].map((c) => (
            <span key={c} style={{ fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-muted)", opacity: 0.85 }}>{c}</span>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div style={{ ...SECTION, padding: "56px 28px", display: "flex", flexDirection: "column", gap: 24 }}>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 28, letterSpacing: "-0.02em", textAlign: "center", margin: 0 }}>From URL to a ranked plan in three steps</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center" }}>
          <div style={{ flex: "1 1 260px", maxWidth: 320 }}><FeatureStep step={1} title="Paste a URL. Get a score in under a minute." body="We scan your live page and score how findable you are across Content, Outreach and SEO — no login for your first scan." /></div>
          <div style={{ flex: "1 1 260px", maxWidth: 320 }}><FeatureStep step={2} title="See how rivals get found." body="We discover your real competitors and where their customers come from — the channels, keywords and content you can copy." /></div>
          <div style={{ flex: "1 1 260px", maxWidth: 320 }}><FeatureStep step={3} title="Work a ranked weekly plan." body="A calendar of the highest-leverage moves — with drafts ready to send — that lifts your score over time." /></div>
        </div>
      </div>

      {/* COMPARISON */}
      <div style={{ ...SECTION, padding: "24px 28px 56px" }}>
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
      <div style={{ ...SECTION, padding: "56px 28px", maxWidth: 760, display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 24, textAlign: "center", margin: "0 0 12px" }}>Questions</h2>
        <FaqItem question="How long does a scan take?" answer="Your first free scan takes under a minute. The deep paid scan (competitors + customers + plan) runs in a couple of minutes." open />
        <FaqItem question="Do I need to install anything?" answer="No. Paste your URL — we scan your live public page and public SEO signals. Nothing to embed." />
        <FaqItem question="Will this auto-post for me?" answer="Never. We draft everything and hand it to you to review and publish — auto-posting risks shadow-bans. You stay in control." />
      </div>

      <Footer />
    </div>
  );
}
