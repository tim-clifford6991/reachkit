/* @mirrors components/report/captured/results-screen.tsx */
import * as React from "react";

/**
 * ResultsScreen — the free-scan report rendered at /scan/[id]: a context bar
 * (free scan · site + Share), the hero card (280° gauge + band + headline +
 * pillar bars + basis note), the top ranked fixes with the locked teaser, the
 * Positioning Mirror (you-think vs page-reads + gap), the Search Gap Analysis
 * table, the evidence footnote, and the unlock CTA band. Mirrors the live
 * captured report (`components/report/captured/results-screen.tsx`).
 */
export interface ResultsScreenProps {
  _unused?: never;
}

const SG = "var(--font-display)", JM = "var(--font-mono)";

// 280° gauge starting at 40° (matches the live report geometry).
const CX = 100, CY = 100, R = 88.5, START = 40, SWEEP = 280;
const pt = (deg: number) => { const a = (deg * Math.PI) / 180; return `${(CX + R * Math.cos(a)).toFixed(2)} ${(CY + R * Math.sin(a)).toFixed(2)}`; };
const arc = (frac: number) => { const end = START + SWEEP * frac; return `M ${pt(START)} A ${R} ${R} 0 ${SWEEP * frac > 180 ? 1 : 0} 1 ${pt(end)}`; };

// Score-band viz (thresholds/labels match SCORE_BANDS; DS uses the --c-band-* tokens).
function band(score: number) {
  if (score < 30) return { label: "Invisible", fg: "var(--c-band-invisible)", bg: "var(--c-tint-red)" };
  if (score < 50) return { label: "Hard to find", fg: "var(--c-band-hard)", bg: "var(--c-tint-orange)" };
  if (score < 70) return { label: "Fair — room to climb", fg: "var(--c-band-fair)", bg: "var(--c-tint-amber)" };
  if (score < 85) return { label: "Findable", fg: "var(--c-band-findable)", bg: "var(--c-tint-green)" };
  return { label: "Highly discoverable", fg: "var(--c-band-high)", bg: "var(--c-tint-green)" };
}
const pillarColor = (v: number) => (v < 30 ? "var(--c-band-invisible)" : v < 50 ? "var(--c-band-hard)" : v < 70 ? "var(--c-band-fair)" : "var(--c-band-findable)");

const SCORE = 47;
const SITE = "bloom.io";
const PILLARS = [
  { label: "Content", value: 56, note: "room to climb" },
  { label: "Outreach", value: 29, note: "biggest lever" },
  { label: "SEO", value: 54, note: "needs work" },
];
const FIXES = [
  { rank: 1, title: "Publish 3 “bloom vs [rival]” comparison pages", why: "Buyers run these head-to-head searches today and land on rivals' pages.", effort: "Medium", pillar: "Content", pred: 6, ec: { bg: "var(--c-tint-amber)", fg: "var(--c-band-fair)" } },
  { rank: 2, title: "Claim your G2 + Capterra listings", why: "Directory presence is a ranking and trust signal you're missing.", effort: "Quick", pillar: "Outreach", pred: 5, ec: { bg: "var(--c-tint-blue)", fg: "var(--c-action)" } },
  { rank: 3, title: "Add FAQ schema to your pricing page", why: "Structured data wins rich results for high-intent queries.", effort: "Quick", pillar: "SEO", pred: 4, ec: { bg: "var(--c-tint-green)", fg: "var(--c-band-findable)" } },
];
const INTENDED = ["habit tracking", "productivity", "wellness"];
const ACTUAL = ["mood journal", "self-care app", "daily check-in"];
// Free teaser (PR B): the subject's OWN not-winning searches — real ranks (#N),
// no rival data (that's the paid reveal). All rows show a subject position.
const GAP_ROWS = [
  { query: "best habit tracker 2026", volume: "8,100/mo", rank: "#42", ranked: true, opp: "High", oppC: { bg: "var(--c-tint-red)", fg: "var(--c-band-invisible)" } },
  { query: "free habit tracker template", volume: "3,300/mo", rank: "#18", ranked: true, opp: "High", oppC: { bg: "var(--c-tint-red)", fg: "var(--c-band-invisible)" } },
  { query: "habit tracker for adhd", volume: "2,400/mo", rank: "#12", ranked: true, opp: "High", oppC: { bg: "var(--c-tint-red)", fg: "var(--c-band-invisible)" } },
  { query: "daily habit app", volume: "1,200/mo", rank: "#7", ranked: true, opp: "Med", oppC: { bg: "var(--c-tint-amber)", fg: "var(--c-band-fair)" } },
];

const CARD: React.CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16 };
const H2: React.CSSProperties = { fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: "32px 0 6px" };
const SUB: React.CSSProperties = { fontSize: 14, color: "var(--c-faint)", margin: "0 0 12px" };

export function ResultsScreen() {
  const b = band(SCORE);
  return (
    <main style={{ background: "var(--c-bg2)", minHeight: "100vh", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px clamp(24px,4vw,48px) 70px" }}>
        {/* Context bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: JM, fontSize: 12.5, color: "var(--c-faint)" }}>free scan · {SITE}</span>
          <button style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 13, color: "var(--c-action)", background: "var(--c-surface)", border: "1.5px solid var(--c-tint-violet-line)", borderRadius: 9, padding: "8px 14px", cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-action)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
            Share score
          </button>
        </div>

        {/* Hero card */}
        <div style={{ ...CARD, borderRadius: 20, padding: 32, boxShadow: "0 16px 44px -26px rgba(40,33,84,0.3)", display: "grid", gridTemplateColumns: "auto 1fr", gap: 34, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <svg width="200" height="200" viewBox="0 0 200 200" style={{ display: "block" }} aria-hidden="true">
              <path d={arc(1)} fill="none" stroke="var(--c-fill)" strokeWidth="15" strokeLinecap="round" />
              <path d={arc(SCORE / 100)} fill="none" stroke={b.fg} strokeWidth="15" strokeLinecap="round" />
              <text x="100" y="106" textAnchor="middle" style={{ font: `700 40px ${JM}, monospace`, fill: "var(--c-ink)" }}>{SCORE}</text>
              <text x="100" y="126" textAnchor="middle" style={{ font: `600 11px ${JM}, monospace`, fill: "var(--c-faint)", letterSpacing: 1 }}>/ 100</text>
            </svg>
            <span style={{ display: "inline-block", background: b.bg, color: b.fg, fontWeight: 700, fontSize: 13, padding: "5px 13px", borderRadius: 8, fontFamily: SG, marginTop: 4 }}>{b.label}</span>
            <div style={{ fontSize: 11.5, color: "var(--c-faint)", fontFamily: JM, maxWidth: 190, margin: "10px auto 0" }}>On-site readiness — off-site reach unlocks with the full scan</div>
          </div>
          <div>
            <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>A {SCORE} means real customers are searching — and landing on someone else.</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-muted)", margin: "0 0 18px" }}>{SITE} is technically fine. The gap is discoverability: you&apos;re absent from the comparison and directory surfaces where your buyers actually decide.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {PILLARS.map((p) => (
                <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 74, fontSize: 13, fontWeight: 600 }}>{p.label}</span>
                  <span style={{ flex: 1, height: 8, borderRadius: 5, background: "var(--c-fill)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${p.value}%`, background: pillarColor(p.value) }} /></span>
                  <span style={{ width: 78, fontSize: 12.5, color: "var(--c-muted)" }}>{p.note}</span>
                  <span style={{ width: 28, textAlign: "right", fontFamily: JM, fontWeight: 700, fontSize: 14, color: pillarColor(p.value) }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ranked fixes */}
        <h2 style={H2}>Your top {FIXES.length} ranked fixes</h2>
        <p style={SUB}>Ordered by expected score impact. Free scans show {FIXES.length} of {FIXES.length + 5}.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FIXES.map((f) => (
            <div key={f.rank} style={{ ...CARD, borderRadius: 14, padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: f.ec.bg, color: f.ec.fg, fontFamily: JM, fontWeight: 700 }}>{f.rank}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15.5 }}>{f.title}</div>
                <div style={{ fontSize: 13.5, color: "var(--c-faint)", margin: "3px 0 8px" }}>{f.why}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 6, padding: "3px 8px", color: f.ec.fg, background: f.ec.bg }}>{f.effort}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 6, padding: "3px 8px", color: "var(--c-muted)", background: "var(--c-fill)" }}>{f.pillar}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: "var(--c-faint)", fontWeight: 600 }}>Predicted</div>
                <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 18, color: "var(--c-band-findable)" }}>+{f.pred}</div>
              </div>
            </div>
          ))}
          <div style={{ border: "1px dashed var(--c-line2)", borderRadius: 14, padding: "16px 20px", fontSize: 14, fontWeight: 600, color: "var(--c-faint)" }}>🔒 5 more ranked fixes — worth an estimated +21 — unlock with a free account</div>
        </div>

        {/* Positioning Mirror */}
        <h2 style={H2}>Positioning Mirror</h2>
        <p style={SUB}>Who you think you target, vs. who your page actually reads as.</p>
        <div style={{ ...CARD, padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ border: "1px solid var(--c-tint-violet-line)", background: "var(--c-tint-violet)", borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-action)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>You think you target</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{INTENDED.map((t) => <span key={t} style={{ fontSize: 13, background: "var(--c-surface)", border: "1px solid var(--c-tint-violet-line)", color: "var(--c-ink)", borderRadius: 999, padding: "4px 11px" }}>{t}</span>)}</div>
            </div>
            <div style={{ border: "1px solid var(--c-tint-orange-line)", background: "var(--c-tint-orange)", borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-band-hard)", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>Your page actually reads as</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{ACTUAL.map((t) => <span key={t} style={{ fontSize: 13, background: "var(--c-surface)", border: "1px solid var(--c-tint-orange-line)", color: "var(--c-ink)", borderRadius: 999, padding: "4px 11px" }}>{t}</span>)}</div>
            </div>
          </div>
          <div style={{ marginTop: 16, background: "var(--c-tint-red)", borderLeft: "3px solid var(--c-band-invisible)", borderRadius: "0 10px 10px 0", padding: "12px 16px", fontSize: 14.5, color: "var(--c-ink)" }}>Buyers searching for a habit tracker never see themselves in your page — it reads as a mood journal, so you lose them before the comparison.</div>
        </div>

        {/* Search Gap Analysis */}
        <h2 style={H2}>Search Gap Analysis</h2>
        <p style={SUB}>High-volume searches where you already rank — but not in the top 3, where the clicks go.</p>
        <div style={{ ...CARD, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 0.9fr", background: "var(--c-bg2)", padding: "11px 16px", fontFamily: JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--c-faint)" }}>
            <span>Query</span><span>Volume / mo</span><span>Your rank</span><span>Opportunity</span>
          </div>
          {GAP_ROWS.map((g) => (
            <div key={g.query} style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 0.9fr", padding: "12px 16px", borderTop: "1px solid var(--c-fill)", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{g.query}</span>
              <span style={{ fontFamily: JM, fontSize: 13, color: "var(--c-muted)" }}>{g.volume}</span>
              <span style={{ fontFamily: JM, fontSize: 13, color: g.ranked ? "var(--c-muted)" : "var(--c-band-invisible)" }}>{g.rank}</span>
              <span style={{ justifySelf: "start", fontSize: 11.5, fontWeight: 700, borderRadius: 6, padding: "3px 8px", color: g.oppC.fg, background: g.oppC.bg }}>{g.opp}</span>
            </div>
          ))}
          <div style={{ padding: "11px 16px", background: "var(--c-tint-violet)", fontSize: 13, fontWeight: 600, color: "var(--c-action)" }}>Showing {GAP_ROWS.length} of 12 queries — unlock full depth →</div>
        </div>

        {/* Evidence footnote */}
        <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--c-faint)", fontFamily: JM }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--c-band-findable)" }} />
          Scanned {SITE} just now · 18 signals · every claim links to extracted evidence
        </div>

        {/* Unlock band */}
        <div style={{ marginTop: 18, background: "linear-gradient(135deg, var(--c-dark), var(--c-dark2))", borderRadius: 18, padding: "30px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
          <div>
            <h3 style={{ color: "var(--c-on-dark)", fontFamily: SG, fontWeight: 700, fontSize: 22, margin: 0 }}>Get the full growth playbook + weekly tracking</h3>
            <p style={{ color: "var(--c-on-dark-muted)", maxWidth: 430, margin: "8px 0 0", fontSize: 14, lineHeight: 1.5 }}>Ready-to-ship drafts, competitor &amp; keyword-gap intel, the full 18-signal breakdown, and weekly score tracking as you ship.</p>
          </div>
          <button style={{ background: "var(--c-surface)", color: "var(--c-ink)", borderRadius: 10, padding: "13px 24px", border: "none", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, cursor: "pointer", whiteSpace: "nowrap" }}>Unlock full report →</button>
        </div>
      </div>
    </main>
  );
}
