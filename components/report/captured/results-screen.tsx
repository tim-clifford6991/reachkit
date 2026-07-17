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
import { tierByPlan, fmtPrice } from "@/lib/billing/pricing";
import { CapturedShareButton } from "./share-button";
import { UnlockLink } from "./unlock-link";

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

/** Band → {label, fg, bg}: labels from SCORE_BANDS (single source of truth —
 *  the long conversion variant where one exists); fg/bg keep the exact mockup
 *  hex ramp so shipped visuals don't move. */
const BAND_VIZ: Record<string, { fg: string; bg: string }> = {
  invisible: { fg: "#E5484D", bg: "var(--c-tint-red)" },
  hard: { fg: "#E0731C", bg: "var(--c-tint-orange)" },
  fair: { fg: "#C98A12", bg: "var(--c-tint-amber)" },
  findable: { fg: "#1F9D5B", bg: "var(--c-tint-green)" },
  high: { fg: "#0E7A48", bg: "var(--c-tint-green)" },
};
function bandViz(score: number) {
  const b = bandFor(score);
  const viz = BAND_VIZ[b.key] ?? { fg: "#C98A12", bg: "var(--c-tint-amber)" };
  return { label: b.longLabel ?? b.label, fg: viz.fg, bg: viz.bg };
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

/** Responsive rules for the captured report, scoped to its own class hooks.
 *  Base is the mobile-safe single column; >=768px restores the desktop
 *  gauge-beside-copy hero. Kept as a scoped <style> (not inline styles) because
 *  inline styles cannot express a media query. */
const RESULTS_CSS = `
.rk-report-hero{grid-template-columns:1fr}
.rk-wrap-any{overflow-wrap:anywhere;min-width:0}
@media (min-width:768px){
  .rk-report-hero{grid-template-columns:auto 1fr}
}
`;

/** Price stated up front on the unlock CTA — visitors used to first learn the
 *  price inside Stripe Checkout. Reads from the single pricing source
 *  (`lib/billing/pricing.ts`) so it can never drift from what Checkout charges. */
const PRICE_LINE = `${fmtPrice(tierByPlan("solo").monthly)}/mo · cancel anytime`;

export interface Pillar { label: string; value: number; note: string; measured?: boolean }
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
  /** Scan id — threads the anonymous Stripe checkout into every inline "unlock"
   *  CTA across the report (via UnlockLink). Absent on the design/demo render. */
  scanId?: string;
  /** Custom unlock-CTA button (e.g. start-trial / upgrade). Falls back to a
   *  static button. */
  unlockButton?: ReactNode;
  /** Title/subtitle for the unlock band (defaults to the free-teaser copy). */
  unlockTitle?: string;
  unlockSub?: string;
  /** Hide the unlock band entirely (e.g. a fully-unlocked paid report). */
  hideUnlock?: boolean;
  /** F2 — off-site "Market position" grade (paid-only; null on free/public). Shown
   *  beside the on-site headline so a tidy landing page can't imply market strength. */
  marketPosition?: number | null;
  /** Free-tier Search Visibility (iteration 2) — the honest gap beside the on-site
   *  score: how much of the domain's real search footprint is its category vs just
   *  other companies' brand names. Null on paid (uses market position instead). */
  searchVisibility?: {
    score: number;
    /** The on-page readiness driver (v4 headlineScore) — the OTHER half of the
     *  unified Discoverability Score, shown as the second driver bar. */
    onPageReadiness: number;
    /** TRUE total when `footprintComplete`, else the top-sample count (labelled). */
    keywordsRanked: number;
    estMonthlyVisits: number;
    /** Whether keywordsRanked/estMonthlyVisits are true domain totals or a sample. */
    footprintComplete: boolean;
    /** Traffic split — ALWAYS over the top ranked terms (a sample), labelled as such. */
    brandPct: number;
    categoryPct: number;
    offTopicPct: number;
    categoryWins: number;
    /** Total monthly searches in the category (Σ named seed-phrase volumes). */
    categoryDemand: number;
    /** Every named category phrase + its volume — so categoryDemand reconciles (G4). */
    categoryPhrases: { keyword: string; volume: number }[];
  } | null;
  /** Real competitor names we discovered (the compare-set). Per-rival share is paid. */
  competitors?: string[];
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
      {/* Mobile: the hero is a gauge + copy row on desktop; below 768px it
          stacks so the copy column isn't crushed to nothing beside the 200px
          gauge. `rk-wrap-any` lets a long unbroken host (a domain has no spaces,
          so its min-content is the whole string) wrap instead of forcing the
          column wider than the screen — the real overflow this report hit. */}
      <style>{RESULTS_CSS}</style>
      <main style={{ ...(p.embedded ? {} : { background: "var(--c-bg2)", minHeight: "100vh" }), fontFamily: PJ, color: "var(--c-ink)" }}>
        <div style={{ maxWidth: p.embedded ? "100%" : "var(--spacing-content-max)", margin: "0 auto", padding: p.embedded ? 0 : "32px clamp(24px, 4vw, 48px) 70px" }}>
          {/* Report context bar (standalone only) — the global nav already
              carries the ReachKit wordmark, so this is just scan context +
              Share, no duplicate logo. The app shell provides its own header. */}
          {!p.embedded && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 20 }}>
            <span className="rk-wrap-any" style={{ fontFamily: JM, fontSize: 12.5, color: "var(--c-faint)" }}>{p.hideUnlock ? "full report" : "free scan"} · {p.siteLabel}</span>
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
          <div className="rk-report-hero" style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 20, padding: "clamp(20px, 5vw, 32px)", boxShadow: "rgba(40, 33, 84, 0.3) 0px 16px 44px -26px", display: "grid", gap: 34, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <svg viewBox="0 0 200 200" style={{ display: "block", width: "100%", height: "auto", maxWidth: 200, margin: "0 auto", ["viewTransitionName" as string]: "score-circle" }}>
                <path d={track} fill="none" stroke="#EEECF5" strokeWidth="15" strokeLinecap="round" />
                <path d={fill} fill="none" stroke={band.fg} strokeWidth="15" strokeLinecap="round" />
                <text x="100" y="107.2" textAnchor="middle" style={{ font: `700 40px ${JM}, monospace`, fill: "var(--c-ink)" }}>{p.score}</text>
                <text x="100" y="126.2" textAnchor="middle" style={{ font: `600 11px ${JM}, monospace`, fill: "var(--c-faint)", letterSpacing: 1 }}>/ 100</text>
              </svg>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: band.bg, color: band.fg, fontWeight: 700, fontSize: 13, padding: "5px 13px", borderRadius: 8, marginTop: 8, fontFamily: SG }}>{band.label}</div>
              {(() => {
                // The unified Discoverability Score = how findable you actually are
                // (page quality × search presence). Name that so the number reads as
                // intentional, not a page-tidiness score.
                const note = p.searchVisibility
                  ? "How findable you actually are — your page quality × your presence in search."
                  : "On-page readiness. Search presence unlocks with the full scan.";
                return note ? (
                  <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.45, color: "var(--c-faint)", fontFamily: JM, maxWidth: 200 }}>{note}</div>
                ) : null;
              })()}
              {/* F2 — Market position: the honest cohort-relative grade beside the
                  on-site headline (paid-only). A tidy landing page can score 98
                  on-site yet sit low here vs its real rivals. */}
              {p.marketPosition != null && (() => {
                const mp = bandViz(p.marketPosition);
                return (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--c-line2)" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--c-faint)", marginBottom: 4 }}>Market position vs rivals</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 22, color: mp.fg }}>{p.marketPosition}</span>
                      <span style={{ fontSize: 11, color: "var(--c-faint)" }}>/ 100</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: mp.fg, background: mp.bg, padding: "2px 8px", borderRadius: 6, fontFamily: SG }}>{mp.label}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.4, color: "var(--c-faint)", fontFamily: JM, maxWidth: 200 }}>Off-site footprint (keywords, backlinks, presence) measured against your discovered competitors.</div>
                  </div>
                );
              })()}
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
                    <span className="rk-wrap-any" style={{ fontFamily: JM, fontSize: 13, fontWeight: 600, color: "var(--c-muted)" }}>{p.siteHost}</span>
                  )}
                </div>
              )}
              <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>{p.headline}</h1>
              <p className="rk-wrap-any" style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-muted)", margin: "0 0 14px" }}>
                {p.siteLabel} {p.intro}
              </p>
              {/* The two drivers of the unified Discoverability Score. Showing them
                  beside the gauge makes the geometric mean legible: a great page
                  (on-page readiness high) that nobody finds (search presence low)
                  is WHY the headline is low — no more "98 vs Invisible" whiplash.
                  Paid scans (no free searchVisibility) keep the 3 on-page pillars. */}
              {p.searchVisibility ? (() => {
                const drivers = [
                  { label: "On-page readiness", value: p.searchVisibility!.onPageReadiness, note: "how well your page is built" },
                  { label: "Search presence", value: p.searchVisibility!.score, note: "how findable you are in search" },
                ];
                // Name whichever driver is actually weaker — an unconditional
                // "Search presence is your gap." contradicts the bars directly
                // above it whenever on-page readiness is the lower of the two
                // (MINOR 4: e.g. an established brand with strong search but a
                // weak page).
                const weakerDriver = p.searchVisibility!.onPageReadiness < p.searchVisibility!.score
                  ? "On-page readiness"
                  : "Search presence";
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                    {drivers.map((d) => {
                      const c = pillarColor(d.value);
                      return (
                        <div key={d.label}>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{d.label}</span>
                            <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 15, color: c }}>{d.value}<span style={{ fontSize: 11, color: "var(--c-faint)", fontWeight: 500 }}>/100</span></span>
                          </div>
                          <div style={{ height: 8, borderRadius: 5, background: "var(--c-fill)", overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 5, width: `${d.value}%`, background: c }} />
                          </div>
                          <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--c-faint)", fontFamily: JM }}>{d.note}</div>
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--c-muted)", fontFamily: JM, paddingTop: 4, borderTop: "1px dashed var(--c-line2)", marginTop: 2 }}>
                      Your score multiplies both — a flawless page nobody finds still scores low. <strong style={{ color: "var(--c-fg)" }}>{weakerDriver} is your gap.</strong>
                    </div>
                  </div>
                );
              })() : (
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {p.pillars.map((pil) => {
                  const c = pillarColor(pil.value);
                  // An unmeasured pillar (no signal on this scan) renders as a
                  // grey "Not measured" strip — never a 0/100 that reads as a
                  // failing surface when it was simply never assessed.
                  if (pil.measured === false) {
                    return (
                      <div key={pil.label} style={{ display: "flex", alignItems: "center", gap: 12, opacity: 0.75 }}>
                        <div style={{ width: 74, fontSize: 13, fontWeight: 600 }}>{pil.label}</div>
                        <div style={{ flex: "1 1 0%", height: 8, borderRadius: 5, background: "repeating-linear-gradient(90deg, var(--c-fill) 0 6px, transparent 6px 12px)" }} />
                        <div style={{ width: 78, fontSize: 12.5, color: "var(--c-faint)" }}>unlock to measure</div>
                        <div style={{ width: 44, textAlign: "right", fontFamily: JM, fontWeight: 600, fontSize: 11.5, color: "var(--c-faint)" }}>Not&nbsp;yet</div>
                      </div>
                    );
                  }
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
              )}
            </div>
          </div>

          {/* Search Visibility — your category's demand + how much you actually capture */}
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: "32px 0 6px" }}>Your category, and how much of it you own</h2>
          <p style={{ fontSize: 14, color: "var(--c-faint)", margin: "0 0 14px" }}>How much your buyers are searching, how much of it you capture, and who&apos;s taking the rest.</p>
          {/* Zero-state — the site ranks for nothing. This IS the insight (never hide
              it): a young product is invisible in organic search. */}
          {p.searchVisibility && p.searchVisibility.keywordsRanked === 0 && (() => {
            const sv = p.searchVisibility!;
            return (
              <div style={{ background: "var(--c-tint-red)", borderLeft: "3px solid #E5484D", borderRadius: "0 12px 12px 0", padding: "18px 20px", marginBottom: 14, fontSize: 14.5, lineHeight: 1.6, color: "#3A3744" }}>
                <strong style={{ fontFamily: SG, fontSize: 16 }}>Google ranks you for 0 searches.</strong><br />
                You&apos;re invisible in organic search — buyers can&apos;t find you unless they already type your name
                {sv.categoryDemand > 0 ? `, while ${sv.categoryDemand.toLocaleString()} searches a month in your category go to everyone else` : ""}. That&apos;s the single biggest thing standing between you and inbound demand.
              </div>
            );
          })()}
          {/* Category demand (free): the real market size (Σ named seed-phrase
              volumes) and how many of those terms you actually win. NO capture bar
              — the old "You capture {cap}%" was the search score under a second
              label (categoryCaptureRate === score), a metric aliased to another
              metric (guard G1). We state the two REAL, reconcilable numbers instead:
              the category demand, and the count of category terms you rank top-3 for. */}
          {p.searchVisibility && p.searchVisibility.categoryDemand > 0 && (() => {
            const sv = p.searchVisibility!;
            const wins = Math.max(0, sv.categoryWins);
            const comps = (p.competitors ?? []).slice(0, 5);
            return (
              <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "20px 22px", marginBottom: 14 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 26 }}>{sv.categoryDemand.toLocaleString()}</span>
                  <span style={{ fontSize: 13.5, color: "var(--c-muted)" }}>searches/mo across your category</span>
                </div>
                <div style={{ fontSize: 13.5, color: "var(--c-muted)", marginBottom: 10 }}>
                  {wins > 0 ? (
                    <>You rank in the top 3 for <strong style={{ color: "#1F9D5B" }}>{wins}</strong> of your category&apos;s searches.</>
                  ) : (
                    <><strong style={{ color: "#E5484D" }}>You don&apos;t rank in the top 3</strong> for any of your category&apos;s searches yet.</>
                  )}
                </div>
                {/* G4: itemise the phrases behind the demand total, so "N searches/mo"
                    is reconcilable against its named parts (was a mystery number). */}
                {sv.categoryPhrases.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", fontSize: 12.5, color: "var(--c-faint)", fontFamily: JM }}>
                    {sv.categoryPhrases.slice(0, 8).map((ph) => (
                      <span key={ph.keyword} style={{ background: "var(--c-fill)", borderRadius: 6, padding: "2px 8px" }}>
                        {ph.keyword} <span style={{ color: "var(--c-muted)", fontWeight: 600 }}>{ph.volume.toLocaleString()}</span>
                      </span>
                    ))}
                  </div>
                )}
                {comps.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--c-line2)", fontSize: 13, color: "var(--c-muted)" }}>
                    Buyers compare you to <strong style={{ color: "var(--c-ink)" }}>{comps.join(", ")}</strong>. <UnlockLink scanId={p.scanId}>Unlock to see how much of your category each one takes →</UnlockLink>
                  </div>
                )}
              </div>
            );
          })()}
          {/* Footprint split (free): brand vs your category vs other companies' names.
              For a directory/aggregator this exposes that most "traffic" is incidental. */}
          {p.searchVisibility && p.searchVisibility.keywordsRanked > 0 && (() => {
            const sv = p.searchVisibility!;
            const seg = (label: string, pct: number, color: string) => pct > 0 ? (
              <div key={label} title={`${label}: ${pct}%`} style={{ width: `${pct}%`, background: color }} />
            ) : null;
            return (
              <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "18px 22px", marginBottom: 14 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 14 }}>
                  {/* keywordsRanked/estMonthlyVisits are TRUE domain totals when
                      footprintComplete (domain_rank_overview); on the degraded
                      fallback they're the top-ranked sample — labelled so, never a
                      cap dressed as a total (the old "50" lie). */}
                  <div><div style={{ fontFamily: JM, fontWeight: 700, fontSize: 20 }}>{sv.keywordsRanked.toLocaleString()}</div><div style={{ fontSize: 11.5, color: "var(--c-faint)" }}>{sv.footprintComplete ? "keywords ranked" : "top keywords ranked"}</div></div>
                  <div><div style={{ fontFamily: JM, fontWeight: 700, fontSize: 20 }}>~{sv.estMonthlyVisits.toLocaleString()}</div><div style={{ fontSize: 11.5, color: "var(--c-faint)" }}>{sv.footprintComplete ? "est. visits / mo" : "est. visits / mo (top terms)"}</div></div>
                  <div><div style={{ fontFamily: JM, fontWeight: 700, fontSize: 20, color: sv.categoryPct < 25 ? "#E5484D" : "var(--c-ink)" }}>{sv.categoryPct}%</div><div style={{ fontSize: 11.5, color: "var(--c-faint)" }}>category (top terms)</div></div>
                </div>
                <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: "var(--c-fill)" }}>
                  {seg("Your brand", sv.brandPct, "var(--c-action)")}
                  {seg("Your category", sv.categoryPct, "#1F9D5B")}
                  {seg("Other companies' names", sv.offTopicPct, "#E5A23B")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10, fontSize: 11.5, color: "var(--c-faint)", fontFamily: JM }}>
                  <span><span style={{ color: "var(--c-action)" }}>■</span> your brand {sv.brandPct}%</span>
                  <span><span style={{ color: "#1F9D5B" }}>■</span> your category {sv.categoryPct}%</span>
                  <span><span style={{ color: "#E5A23B" }}>■</span> other companies&apos; names {sv.offTopicPct}%</span>
                </div>
                {/* G3: the split is a SAMPLE (top ranked terms by traffic) — disclose it. */}
                <div style={{ marginTop: 6, fontSize: 11, color: "var(--c-faint)" }}>Traffic split across your top-ranked terms.</div>
                {sv.offTopicPct >= 40 && (
                  <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--c-tint-orange)", borderLeft: "3px solid #E0731C", borderRadius: "0 10px 10px 0", fontSize: 13.5, lineHeight: 1.55, color: "#3A3744" }}>
                    Most of your search traffic comes from <strong>other companies&apos; names you list or mention</strong> — real visits, but not buyers searching for what <em>you</em> do. Only <strong>{sv.categoryPct}%</strong> is your own category.
                  </div>
                )}
              </div>
            );
          })()}
          {/* Biggest opportunity — we promote the single HIGHEST-value category
              search you don't win (sorted by volume upstream), framed by the score
              lever it moves, instead of a flat Low/Med/High table that buried the
              big win under tiny near-misses. The rest are teased behind checkout. */}
          {(() => {
            const top = p.gapRows[0];
            if (!top) {
              // No parsed opportunities — tease the paid keyword-gap plan (free), or
              // stay honest on a paid report with genuinely no data.
              return !p.hideUnlock ? (
                <div style={{ background: "var(--c-tint-violet)", border: "1px solid var(--c-tint-violet-line)", borderRadius: 16, padding: "18px 22px", fontSize: 14, lineHeight: 1.55, color: "#3A3744" }}>
                  🔒 The full keyword-gap plan{p.gapTotal > 0 ? ` (${p.gapTotal} queries)` : ""} — every buyer search where rivals outrank you, ranked by opportunity. <UnlockLink scanId={p.scanId}>Unlock the plan to win them →</UnlockLink>
                </div>
              ) : p.gapTotal === 0 ? (
                <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "18px 22px", fontSize: 14, color: "var(--c-faint)" }}>
                  Search-gap data wasn&apos;t available for this scan — keyword rankings could not be measured for this site yet.
                </div>
              ) : null;
            }
            const more = Math.max(0, p.gapTotal - 1);
            const oc = oppColors(top.opp);
            return (
              <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "22px 24px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--c-action)", marginBottom: 10 }}>Your biggest untapped opportunity</div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <span style={{ fontFamily: SG, fontWeight: 700, fontSize: 22, letterSpacing: "-0.01em" }}>{top.query}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: oc.fg, background: oc.bg, padding: "3px 10px", borderRadius: 6 }}>{top.opp} opportunity</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 26 }}>
                  <div><div style={{ fontFamily: JM, fontWeight: 700, fontSize: 22 }}>{top.volume}</div><div style={{ fontSize: 11.5, color: "var(--c-faint)" }}>searches / mo</div></div>
                  <div><div style={{ fontFamily: JM, fontWeight: 700, fontSize: 22, color: "#E5484D" }}>{top.rank}</div><div style={{ fontSize: 11.5, color: "var(--c-faint)" }}>where you are today</div></div>
                </div>
                <div style={{ marginTop: 16, padding: "13px 15px", background: "var(--c-bg2)", borderRadius: 10, fontSize: 13.5, lineHeight: 1.55, color: "var(--c-muted)" }}>
                  {/* G5: "the weaker half" is CONDITIONAL — search presence is the
                      stronger half on 40% of prod scans (on-page 48 / search 100 etc.).
                      Only claim it when search presence is actually the lower driver. */}
                  Winning this term lifts your <strong style={{ color: "var(--c-fg)" }}>Search presence</strong>
                  {p.searchVisibility && p.searchVisibility.score < p.searchVisibility.onPageReadiness
                    ? <> — the weaker half of your Discoverability Score.</>
                    : <>.</>}
                  {more > 0 && <> There {more === 1 ? "is" : "are"} <strong style={{ color: "var(--c-fg)" }}>{more} more</strong> like it in your category.</>}
                </div>
                {!p.hideUnlock && (
                  <div style={{ marginTop: 14, textAlign: "center", fontSize: 14, fontWeight: 600 }}>
                    <UnlockLink scanId={p.scanId}>🔒 Unlock all {p.gapTotal} category {p.gapTotal === 1 ? "opportunity" : "opportunities"} + the plan to win them →</UnlockLink>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Top ranked fixes */}
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: "32px 0 6px" }}>{p.fixes.length > 0 ? `Your top ${p.fixes.length} ranked fixes` : "Your ranked fixes"}</h2>
          <p style={{ fontSize: 14, color: "var(--c-faint)", margin: "0 0 14px" }}>
            {/* Tier-aware: the old copy hardcoded "Free scans show X of Y" for
                every viewer, mislabeling paid reports. */}
            Ordered by expected score impact.{!p.hideUnlock && ` Free scans show ${p.fixes.length} of ${p.fixes.length + p.lockedCount}.`}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Graceful floor for already-persisted reports with an empty action
                plan — never render a bare "top 0 fixes" section. */}
            {p.fixes.length === 0 && p.lockedCount === 0 && (
              <div style={{ background: "var(--c-surface)", border: "1px dashed #D9D6E4", borderRadius: 14, padding: "18px 20px", fontSize: 14, color: "var(--c-faint)" }}>
                We couldn&apos;t rank fixes for this scan. The pillar bars above show where you&apos;re weakest — re-run the scan to regenerate a full action plan.
              </div>
            )}
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
                {/* lockedWorth can legitimately be 0 (zero-delta cards, or a
                    lockedCount derived from totalActions with no rest rows) —
                    "worth an estimated +0" reads as broken, so the worth clause
                    only renders when there's a real number behind it
                    (housekeeping, remediation plan 2026-07-15 Task 5.4). */}
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-faint)" }}>🔒 {p.lockedCount} more ranked fixes{p.lockedWorth > 0 ? <> — worth an estimated +{p.lockedWorth}</> : null} — <UnlockLink scanId={p.scanId}>unlock the full plan →</UnlockLink></span>
              </div>
            )}
          </div>

          {/* Positioning Mirror — reworked (was two heavy chip columns that read as
              garbage and buried the point). Now the GAP insight leads; the intended
              vs actual audience is a single compact "aim → reads as" line beneath it,
              de-emphasised. Hides entirely if there's genuinely nothing to show. */}
          {(p.intendedTags.length > 0 || p.actualTags.length > 0 || (p.mirrorGap && p.mirrorGap.trim().length > 0)) && (
            <>
              <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: "32px 0 6px" }}>Positioning Mirror</h2>
              <p style={{ fontSize: 14, color: "var(--c-faint)", margin: "0 0 14px" }}>Whether your page reads as the audience you actually want.</p>
              <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: 24 }}>
                {p.mirrorGap && p.mirrorGap.trim().length > 0 && (
                  <div style={{ padding: "16px 18px", background: "var(--c-tint-red)", borderLeft: "3px solid #E5484D", borderRadius: "0 10px 10px 0", fontSize: 15, lineHeight: 1.6, color: "#3A3744" }}>{p.mirrorGap}</div>
                )}
                {(p.intendedTags.length > 0 || p.actualTags.length > 0) && (
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px", marginTop: p.mirrorGap && p.mirrorGap.trim().length > 0 ? 16 : 0, fontSize: 13.5 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--c-faint)" }}>You aim for</span>
                    <span style={{ fontWeight: 600, color: "var(--c-action)" }}>{p.intendedTags.length > 0 ? p.intendedTags.join(", ") : "—"}</span>
                    <span style={{ color: "var(--c-faint)" }}>→</span>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--c-faint)" }}>Your page reads as</span>
                    <span style={{ fontWeight: 600, color: "#E0731C" }}>{p.actualTags.length > 0 ? p.actualTags.join(", ") : "—"}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Evidence footnote */}
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--c-faint)", fontFamily: JM }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1F9D5B", display: "inline-block" }} />
            {/* G6: no hardcoded signal count. The free scan MEASURES ~9 signals, not
                18 (the registry size) — claiming "18 signals" over-stated what we
                analyzed about YOU. The evidence claim below is true without a number. */}
            Scanned {p.siteLabel} just now · every claim links to extracted evidence
          </div>

          {/* Unlock CTA */}
          {!p.hideUnlock && (
            <div style={{ marginTop: 18, background: "linear-gradient(135deg, var(--c-dark), var(--c-dark2))", borderRadius: 18, padding: "30px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 22, color: "#fff", margin: "0 0 6px" }}>{p.unlockTitle ?? (p.lockedCount > 0
                  ? `Unlock ${p.lockedCount} more ranked fix${p.lockedCount === 1 ? "" : "es"} + the full playbook`
                  : "Get the full growth playbook + weekly tracking")}</h3>
                <p style={{ fontSize: 14.5, color: "#B7B4C4", margin: 0, maxWidth: 430 }}>{p.unlockSub ?? (p.lockedCount > 0
                  ? "Plus ready-to-ship drafts, your competitor & keyword-gap intel, the full signal breakdown, and score tracking as you fix each one."
                  : "Ready-to-ship drafts, competitor & keyword-gap intel, the full signal breakdown, and weekly score tracking as you ship.")}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                {p.unlockButton ?? (
                  <button style={{ fontFamily: PJ, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", background: "var(--c-surface)", border: "none", borderRadius: 10, padding: "13px 24px", cursor: "pointer", whiteSpace: "nowrap" }}>Unlock full report →</button>
                )}
                <span style={{ fontFamily: JM, fontSize: 12.5, color: "#B7B4C4" }}>{PRICE_LINE}</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export type { ReportPayload };
