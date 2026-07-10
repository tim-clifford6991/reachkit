/* @mirrors app/(marketing)/teardowns/[slug]/page.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { PageHeader } from "./PageHeader";
import { Footer } from "./Footer";

/**
 * TeardownsScreen — a public teardown detail (`/teardowns/[slug]`): NavBar, a
 * header for the analysed site, the Discoverability Score panel (total + band +
 * pillar breakdown), the "what we found" fixes, a run-your-own CTA, then footer.
 * Mirrors the live teardown detail page.
 */
export interface TeardownsScreenProps {
  _unused?: never;
}

const JM = "var(--font-mono)", SG = "var(--font-display)";
const scoreColor = (s: number) => (s < 35 ? "var(--c-band-invisible)" : s < 55 ? "var(--c-band-hard)" : s < 70 ? "var(--c-band-fair)" : "var(--c-band-findable)");
const scoreLabel = (s: number) => (s >= 80 ? "Excellent" : s >= 60 ? "Good" : s >= 40 ? "Fair" : s >= 20 ? "Needs Work" : "Critical");

const SCORE = 88;
const BREAKDOWN = [{ label: "Content", value: 84 }, { label: "Outreach", value: 90 }, { label: "SEO", value: 90 }];
const FINDINGS = [
  { title: "Rich structured data across the site", note: "Schema on product, pricing, and blog pages wins rich results." },
  { title: "Dense referral footprint", note: "Backlinks from 1,200+ quality domains — community, press, directories." },
  { title: "Room to grow: comparison pages", note: "Few head-to-head “vs” pages for high-intent buyer searches." },
];

export function TeardownsScreen() {
  const c = scoreColor(SCORE);
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <PageHeader eyebrow="Teardown" title="linear.app" subhead="A public discoverability teardown — the score, the strengths, and the gaps that would move it." />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 28px 64px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Score panel */}
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-faint)" }}>Discoverability Score</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "6px 0 2px" }}>
                <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 40, lineHeight: 1, color: c }}>{SCORE}</span>
                <span style={{ fontFamily: JM, fontSize: 14, color: "var(--c-faint)" }}>/ 100</span>
              </div>
              <div style={{ fontFamily: JM, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: c }}>{scoreLabel(SCORE)}</div>
            </div>
            <div style={{ flex: "1 1 340px", minWidth: 280, display: "flex", flexDirection: "column", gap: 10 }}>
              {BREAKDOWN.map((p) => (
                <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 74, fontSize: 13, color: "var(--c-muted)" }}>{p.label}</span>
                  <span style={{ flex: 1, height: 8, borderRadius: 5, background: "var(--c-fill)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${p.value}%`, background: scoreColor(p.value) }} /></span>
                  <span style={{ width: 28, textAlign: "right", fontFamily: JM, fontWeight: 700, fontSize: 14, color: scoreColor(p.value) }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Findings */}
        <div>
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: "8px 0 12px" }}>What we found</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {FINDINGS.map((f) => (
              <div key={f.title} style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{f.title}</div>
                <p style={{ fontSize: 13.5, color: "var(--c-muted)", margin: "6px 0 0", lineHeight: 1.5 }}>{f.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ background: "linear-gradient(135deg, var(--c-dark), var(--c-dark2))", borderRadius: 18, padding: "28px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 18 }}>
          <div>
            <h3 style={{ color: "var(--c-on-dark)", fontFamily: SG, fontWeight: 700, fontSize: 20, margin: 0 }}>Want a teardown like this for your product?</h3>
            <p style={{ color: "var(--c-on-dark-muted)", margin: "6px 0 0", fontSize: 14 }}>Your first scan is free and takes under a minute.</p>
          </div>
          <a href="/scan" style={{ background: "var(--c-surface)", color: "var(--c-ink)", borderRadius: 10, padding: "12px 22px", fontWeight: 700, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}>Scan your site free</a>
        </div>
      </div>
      <Footer />
    </div>
  );
}
