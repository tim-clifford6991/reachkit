/**
 * ResultsScreen — the Claude Design "results" screen (ReachKit.dc.html),
 * converted to React 1:1 from the Phase-0 capture (exact inline styles) and
 * wired to live report data. Light-only, matching the mockup.
 *
 * Gauge geometry is calibrated to reproduce the capture's exact arc path
 * (center 100,100 · r 88.5 · 280° sweep starting at 40°, gap on the right).
 */

import type { ReactNode } from "react";
import type { ReportPayload } from "@/lib/scan/report";
import { bandFor } from "@/lib/scan/score-bands";
import { CapturedShareButton } from "./share-button";

// ── helpers ─────────────────────────────────────────────────────────────────
const CX = 100, CY = 100, R = 88.5, START = 40, SWEEP = 280;
function pt(deg: number) {
  const r = (deg * Math.PI) / 180;
  return [CX + R * Math.cos(r), CY + R * Math.sin(r)] as const;
}
function arc(fromDeg: number, toDeg: number) {
  const [x1, y1] = pt(fromDeg);
  const [x2, y2] = pt(toDeg);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Mockup band → {label, fg, bg} using exact mockup hex. */
function bandViz(score: number) {
  if (score < 30) return { label: "Invisible", fg: "#E5484D", bg: "var(--c-tint-red)" };
  if (score < 50) return { label: "Hard to find", fg: "#E0731C", bg: "var(--c-tint-orange)" };
  if (score < 70) return { label: "Fair — room to climb", fg: "#C98A12", bg: "var(--c-tint-amber)" };
  if (score < 85) return { label: "Findable", fg: "#1F9D5B", bg: "var(--c-tint-green)" };
  return { label: "Highly discoverable", fg: "#0E7A48", bg: "var(--c-tint-green)" };
}
// pillar value → bar color (mockup ramp)
function pillarColor(v: number) {
  if (v < 30) return "#E5484D";
  if (v < 50) return "#E0731C";
  if (v < 70) return "#C98A12";
  return "#1F9D5B";
}
// effort → rank-tile / chip colors (mockup)
function effortColors(effort: string) {
  if (/\$0|free/i.test(effort)) return { bg: "var(--c-tint-green)", fg: "#1F9D5B" };
  if (/quick/i.test(effort)) return { bg: "var(--c-tint-blue)", fg: "#3B6FE0" };
  return { bg: "var(--c-tint-amber)", fg: "#C98A12" };
}
// opportunity → heat colors (mockup: High = red, Med = amber, Low = grey)
function oppColors(opp: string) {
  if (/high/i.test(opp)) return { fg: "#E5484D", bg: "var(--c-tint-red)" };
  if (/med/i.test(opp)) return { fg: "#C98A12", bg: "var(--c-tint-amber)" };
  return { fg: "var(--c-faint)", bg: "var(--c-fill)" };
}

const SG = "Space Grotesk", PJ = "Plus Jakarta Sans", JM = "JetBrains Mono";

export interface Pillar { label: string; value: number; note: string }
export interface Fix { rank: number; title: string; why: string; effort: string; pillar: string; pred: number }
export interface GapRow { query: string; volume: string; rank: string; ranked: boolean; opp: string }

export interface ResultsScreenProps {
  siteLabel: string;
  score: number;
  headline: string;
  intro: string; // sentence after the headline (without the site label, which is prepended)
  pillars: Pillar[];
  fixes: Fix[];
  lockedCount: number;
  lockedWorth: number;
  intendedTags: string[];
  actualTags: string[];
  mirrorGap: string;
  gapRows: GapRow[];
  gapTotal: number;
  /** Client brand mark (favicon/logo) + bare host, for personalisation. */
  logoUrl?: string;
  siteHost?: string;
  /** When set, the "Share score" button opens the interactive share modal. */
  slug?: string;
  /** Custom unlock-CTA button (e.g. start-trial / upgrade). Falls back to a
   *  static button. */
  unlockButton?: ReactNode;
  /** Title/subtitle for the unlock band (defaults to the free-teaser copy). */
  unlockTitle?: string;
  unlockSub?: string;
  /** Hide the unlock band entirely (e.g. a fully-unlocked paid report). */
  hideUnlock?: boolean;
  /** Embedded inside the app shell: drop the full-page bg + outer padding + the
   *  ReachKit banner header (the shell already provides chrome + spacing). */
  embedded?: boolean;
}

export function ResultsScreen(p: ResultsScreenProps) {
  const band = bandViz(p.score);
  const frac = Math.max(0, Math.min(1, p.score / 100));
  const track = arc(START, START + SWEEP);
  const fill = arc(START, START + SWEEP * frac);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
      />
      <main style={{ ...(p.embedded ? {} : { background: "var(--c-bg2)", minHeight: "100vh" }), fontFamily: PJ, color: "var(--c-ink)" }}>
        <div style={{ maxWidth: p.embedded ? "100%" : "var(--spacing-content-max)", margin: "0 auto", padding: p.embedded ? 0 : "32px clamp(24px, 4vw, 48px) 70px" }}>
          {/* Report context bar (standalone only) — the global nav already
              carries the ReachKit wordmark, so this is just scan context +
              Share, no duplicate logo. The app shell provides its own header. */}
          {!p.embedded && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 20 }}>
            <span style={{ fontFamily: JM, fontSize: 12.5, color: "var(--c-faint)" }}>free scan · {p.siteLabel}</span>
            {p.slug ? (
              <CapturedShareButton slug={p.slug} score={p.score} bandLabel={band.label} siteLabel={p.siteLabel} />
            ) : (
              <button style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: PJ, fontWeight: 600, fontSize: 13.5, color: "var(--c-action)", background: "var(--c-surface)", border: "1.5px solid #E2DBF7", borderRadius: 9, padding: "8px 14px", cursor: "pointer" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6E56F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
                </svg>
                Share score
              </button>
            )}
          </div>
          )}

          {/* Hero: gauge + headline + pillars */}
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 20, padding: 32, boxShadow: "rgba(40, 33, 84, 0.3) 0px 16px 44px -26px", display: "grid", gridTemplateColumns: "auto 1fr", gap: 34, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <svg width="200" height="200" viewBox="0 0 200 200" style={{ display: "block", ["viewTransitionName" as string]: "score-circle" }}>
                <path d={track} fill="none" stroke="#EEECF5" strokeWidth="15" strokeLinecap="round" />
                <path d={fill} fill="none" stroke={band.fg} strokeWidth="15" strokeLinecap="round" />
                <text x="100" y="107.2" textAnchor="middle" style={{ font: `700 40px ${JM}, monospace`, fill: "var(--c-ink)" }}>{p.score}</text>
                <text x="100" y="126.2" textAnchor="middle" style={{ font: `600 11px ${JM}, monospace`, fill: "var(--c-faint)", letterSpacing: 1 }}>/ 100</text>
              </svg>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: band.bg, color: band.fg, fontWeight: 700, fontSize: 13, padding: "5px 13px", borderRadius: 8, marginTop: 8, fontFamily: SG }}>{band.label}</div>
            </div>
            <div>
              {/* Personalisation: the client's own brand mark + domain. */}
              {p.logoUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.logoUrl}
                    alt=""
                    width={36}
                    height={36}
                    style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid var(--c-line)", background: "var(--c-surface)", objectFit: "contain", flex: "0 0 auto" }}
                  />
                  {p.siteHost && (
                    <span style={{ fontFamily: JM, fontSize: 13, fontWeight: 600, color: "var(--c-muted)" }}>{p.siteHost}</span>
                  )}
                </div>
              )}
              <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{p.headline}</h1>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-muted)", margin: "0 0 14px" }}>
                {p.siteLabel} {p.intro}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {p.pillars.map((pil) => {
                  const c = pillarColor(pil.value);
                  return (
                    <div key={pil.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 74, fontSize: 13, fontWeight: 600 }}>{pil.label}</div>
                      <div style={{ flex: "1 1 0%", height: 8, borderRadius: 5, background: "var(--c-fill)", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 5, width: `${pil.value}%`, background: c }} />
                      </div>
                      <div style={{ width: 78, fontSize: 12.5, color: "var(--c-muted)" }}>{pil.note}</div>
                      <div style={{ width: 28, textAlign: "right", fontFamily: JM, fontWeight: 700, fontSize: 14, color: c }}>{pil.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top ranked fixes */}
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: "32px 0 6px" }}>Your top {p.fixes.length} ranked fixes</h2>
          <p style={{ fontSize: 14, color: "var(--c-faint)", margin: "0 0 14px" }}>Ordered by expected score impact. Free scans show {p.fixes.length} of {p.fixes.length + p.lockedCount}.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {p.fixes.map((f) => {
              const ec = effortColors(f.effort);
              return (
                <div key={f.rank} style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: ec.bg, color: ec.fg, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: JM, flex: "0 0 auto" }}>{f.rank}</span>
                  <div style={{ flex: "1 1 0%" }}>
                    <div style={{ fontWeight: 600, fontSize: 15.5 }}>{f.title}</div>
                    <div style={{ fontSize: 13.5, color: "var(--c-faint)", marginTop: 3 }}>{f.why}</div>
                    <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: ec.fg, background: ec.bg, padding: "3px 9px", borderRadius: 6 }}>{f.effort}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--c-muted)", background: "var(--c-fill)", padding: "3px 9px", borderRadius: 6 }}>{f.pillar}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                    <div style={{ fontSize: 11, color: "var(--c-faint)", fontWeight: 600 }}>Predicted</div>
                    <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 18, color: "#1F9D5B" }}>+{f.pred}</div>
                  </div>
                </div>
              );
            })}
            {p.lockedCount > 0 && (
              <div style={{ position: "relative", background: "var(--c-surface)", border: "1px dashed #D9D6E4", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-faint)" }}>🔒 {p.lockedCount} more ranked fixes — worth an estimated +{p.lockedWorth} — unlock with a free account</span>
              </div>
            )}
          </div>

          {/* Positioning Mirror */}
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: "32px 0 6px" }}>Positioning Mirror</h2>
          <p style={{ fontSize: 14, color: "var(--c-faint)", margin: "0 0 14px" }}>Who you think you target, vs. who your page actually reads as.</p>
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ border: "1px solid var(--c-tint-violet-line)", background: "var(--c-tint-violet)", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--c-action)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>You think you target</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {p.intendedTags.map((t) => (
                    <span key={t} style={{ fontSize: 13, fontWeight: 600, background: "var(--c-surface)", border: "1px solid #E2DEF0", color: "#3A3744", padding: "6px 12px", borderRadius: 8 }}>{t}</span>
                  ))}
                </div>
              </div>
              <div style={{ border: "1px solid var(--c-tint-orange-line)", background: "var(--c-tint-orange)", borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#E0731C", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>Your page actually reads as</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {p.actualTags.map((t) => (
                    <span key={t} style={{ fontSize: 13, fontWeight: 600, background: "var(--c-surface)", border: "1px solid #F0E0D2", color: "#3A3744", padding: "6px 12px", borderRadius: 8 }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 18, padding: "16px 18px", background: "var(--c-tint-red)", borderLeft: "3px solid #E5484D", borderRadius: "0 10px 10px 0", fontSize: 14.5, lineHeight: 1.55, color: "#3A3744" }}>{p.mirrorGap}</div>
          </div>

          {/* Search Gap Analysis */}
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: "32px 0 6px" }}>Search Gap Analysis</h2>
          <p style={{ fontSize: 14, color: "var(--c-faint)", margin: "0 0 14px" }}>High-intent queries your buyers use — where you&apos;re invisible.</p>
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 0.9fr", padding: "13px 22px", borderBottom: "1px solid var(--c-line2)", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", color: "var(--c-faint)", textTransform: "uppercase", background: "var(--c-bg2)" }}>
              <span>Query</span><span>Volume / mo</span><span>Your rank</span><span>Opportunity</span>
            </div>
            {p.gapRows.map((g, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 0.9fr", padding: "14px 22px", borderBottom: "1px solid var(--c-fill)", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{g.query}</span>
                <span style={{ fontFamily: JM, fontSize: 13, color: "#3A3744" }}>{g.volume}</span>
                <span style={{ fontFamily: JM, fontSize: 13, color: g.ranked ? "#3A3744" : "#E5484D" }}>{g.rank}</span>
                <span><span style={{ fontSize: 11.5, fontWeight: 700, color: oppColors(g.opp).fg, background: oppColors(g.opp).bg, padding: "3px 10px", borderRadius: 6 }}>{g.opp}</span></span>
              </div>
            ))}
            <div style={{ padding: "14px 22px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--c-action)", background: "var(--c-tint-violet)", cursor: "pointer" }}>Showing {p.gapRows.length} of {p.gapTotal} queries — unlock full depth →</div>
          </div>

          {/* Evidence footnote */}
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--c-faint)", fontFamily: JM }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1F9D5B", display: "inline-block" }} />
            Scanned {p.siteLabel} just now · 18 signals · every claim links to extracted evidence
          </div>

          {/* Unlock CTA */}
          {!p.hideUnlock && (
            <div style={{ marginTop: 18, background: "linear-gradient(135deg, var(--c-dark), var(--c-dark2))", borderRadius: 18, padding: "30px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 22, color: "#fff", margin: "0 0 6px" }}>{p.unlockTitle ?? `Unlock all ${p.fixes.length + p.lockedCount} fixes + weekly tracking`}</h3>
                <p style={{ fontSize: 14.5, color: "#B7B4C4", margin: 0, maxWidth: 430 }}>{p.unlockSub ?? "Unlock the full report to see the full 18-signal breakdown, track your score over time, and verify each fix as you ship it."}</p>
              </div>
              {p.unlockButton ?? (
                <button style={{ fontFamily: PJ, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", background: "var(--c-surface)", border: "none", borderRadius: 10, padding: "13px 24px", cursor: "pointer", whiteSpace: "nowrap" }}>Unlock full report →</button>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export type { ReportPayload };
