/**
 * ResultsScreen — the Claude Design "results" screen (ReachKit.dc.html),
 * converted to React 1:1 from the Phase-0 capture (exact inline styles) and
 * wired to live report data. Light-only, matching the mockup.
 *
 * Gauge geometry is calibrated to reproduce the capture's exact arc path
 * (center 100,100 · r 88.5 · 280° sweep starting at 40°, gap on the right).
 */

import type { ReactNode, CSSProperties } from "react";
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
export interface Fix { rank: number; title: string; why: string; effort: string; pillar: string; pred: number;
  /** Data-driven keyword-opportunity fixes carry their real monthly search
   *  volume (e.g. "110,000/mo") — rendered as the lead data chip so the growth
   *  moves read as sized opportunities, not hygiene. Absent on on-page fixes. */
  metric?: string }
export interface GapRow { query: string; volume: string; rank: string; ranked: boolean; opp: string }

/** Data-board P3 — the shape `<MarketCard>` renders. Mirrors
 *  `CategoryLadderCard` (lib/scan/search-visibility.ts) field-for-field but is
 *  declared locally (not imported) so this captured component keeps its
 *  existing discipline of taking only inline prop shapes, same as
 *  `searchVisibility.marketTiers` above. */
export interface MarketCardData {
  label: string;
  demand: number;
  rankedTop3: { keyword: string; volume: number; yourPosition?: number }[];
  gaps: { keyword: string; volume: number; yourPosition?: number }[];
}

const MARKET_CARD_STYLE: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "18px 20px", minWidth: 0 };

/** ONE reusable card for BOTH "Your Category" (broad) and "Your Niche"
 *  (specific) — sections 2 and 3 of the six-section data board (P3). DRY per
 *  the brief: identical structure, different pill/tint/zero-state copy. Every
 *  number renders straight off `card` (part of the persisted payload), so R2
 *  (report-rubric.ts) is satisfied for free — no derivation to register. */
function MarketCard({ kind, card }: { kind: "category" | "niche"; card: MarketCardData }) {
  const pill = kind === "category"
    ? { label: "YOUR CATEGORY", bg: "var(--c-tint-violet)", fg: "var(--c-action)" }
    : { label: "YOUR NICHE", bg: "var(--c-tint-amber)", fg: "#C98A12" };
  return (
    <div style={MARKET_CARD_STYLE}>
      <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", padding: "3px 9px", borderRadius: 999, background: pill.bg, color: pill.fg }}>{pill.label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 2px" }}>
        <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 26 }}>{card.demand.toLocaleString()}</span>
        <span style={{ fontSize: 12, color: "var(--c-muted)" }}>searches / mo</span>
      </div>
      <div className="rk-wrap-any" style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 12 }}>{card.label}</div>

      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "12px 0 7px" }}>You rank top 3 for</div>
      {card.rankedTop3.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {card.rankedTop3.map((r) => (
            <span key={r.keyword} className="rk-wrap-any" style={{ fontFamily: JM, fontSize: 11.5, padding: "4px 9px", borderRadius: 7, background: "var(--c-tint-green)", color: "#1F9D5B", display: "inline-flex", gap: 6, alignItems: "baseline" }}>
              <b style={{ color: "#1F9D5B" }}>#{r.yourPosition}</b> {r.keyword} <b>{r.volume.toLocaleString()}</b>
            </span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: "var(--c-muted)", background: "var(--c-tint-red)", borderLeft: "3px solid #E5484D", borderRadius: "0 8px 8px 0", padding: "8px 11px" }}>
          <b style={{ color: "#E5484D" }}>None yet.</b>
        </div>
      )}

      {card.gaps.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "12px 0 7px" }}>You don&apos;t rank for</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {card.gaps.slice(0, 6).map((g) => (
              <span key={g.keyword} className="rk-wrap-any" style={{ fontFamily: JM, fontSize: 11.5, padding: "4px 9px", borderRadius: 7, background: "var(--c-fill)", color: "var(--c-muted)" }}>
                {g.keyword} <b style={{ color: "var(--c-ink)" }}>{g.volume.toLocaleString()}</b>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** P3fix (2026-07-20): the honest empty state for a niche that genuinely has
 *  no measurable demand yet (0 grounded/priced phrases — e.g. trustmrr.com,
 *  a real directory whose niche terms just don't clear pricing). Previously
 *  the niche slot was OMITTED entirely when this happened, which silently
 *  collapsed the two-card layout to one column and dropped the niche's own
 *  LABEL (real LLM output, just with no priced phrases) with no explanation.
 *  Shows the SAME pill + label as a real `<MarketCard>` so the two-card
 *  layout holds, plus one honest line — never a fabricated demand number
 *  (invariant #11: degrade, never invent). */
function NicheEmptyCard({ label }: { label: string }) {
  return (
    <div style={MARKET_CARD_STYLE}>
      <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", padding: "3px 9px", borderRadius: 999, background: "var(--c-tint-amber)", color: "#C98A12" }}>YOUR NICHE</span>
      <div className="rk-wrap-any" style={{ fontSize: 13, color: "var(--c-muted)", margin: "10px 0 12px" }}>{label}</div>
      <div style={{ fontSize: 12.5, color: "var(--c-muted)", background: "var(--c-fill)", borderLeft: "3px solid var(--c-line)", borderRadius: "0 8px 8px 0", padding: "8px 11px" }}>
        No measurable niche demand yet — your niche is still small or emerging.
      </div>
    </div>
  );
}

/** A card is renderable when it actually carries priced, grounded phrases —
 *  never an empty "0 searches/mo, None yet, None yet" shell (invariant #11:
 *  degrade, never invent an empty section). `demand` alone can't gate this on
 *  its own (a card could theoretically have 0 demand and 0 phrases at once,
 *  or a >0 demand with every phrase landing in one bucket) — checking the
 *  actual phrase count (rankedTop3 ∪ gaps, the same partition
 *  `computeCategoryLadder`'s `splitRankedGaps` produces) is the real signal. */
function marketCardReady(card: MarketCardData | null | undefined): card is MarketCardData {
  return !!card && card.rankedTop3.length + card.gaps.length > 0;
}

/** Same phrase-count check as `marketCardReady`, but on an ALREADY non-null
 *  card and returning a PLAIN boolean (no `is` type predicate). Needed
 *  because the niche slot picks between two DIFFERENT RENDERS of the SAME
 *  card object (a real `<MarketCard>` vs `<NicheEmptyCard>`) — "ready" here
 *  is a runtime distinction (does this card have priced phrases?), not a
 *  type distinction, so reusing `marketCardReady`'s predicate on an
 *  already-`MarketCardData` value would make TS narrow the false branch to
 *  `never` (excluding the only type left in the union). */
function hasCardPhrases(card: MarketCardData): boolean {
  return card.rankedTop3.length + card.gaps.length > 0;
}

export interface ResultsScreenProps {
  siteLabel: string;
  /** R1 (2026-07-19) — the listing's own self-description (`positioningMirror.
   *  listingSays`), rendered as a small line before the headline. Absent/empty
   *  on a degraded scan (guard: `p.identityLine ?` — never render a blank line). */
  identityLine?: string;
  /** Part C (2026-07-19) — true when the site fetch returned a JS-shell/garbage
   *  capture AND the one Tavily Extract escalation also failed/was garbage
   *  (`report_payload.fetchDegraded`). Renders one honest line in the
   *  identity-strip slot instead of implying confident findings over a page we
   *  never actually read. Defaults to `false` at the props boundary. */
  fetchDegraded?: boolean;
  score: number;
  headline: string;
  intro: string; // sentence after the headline (without the site label, which is prepended)
  pillars: Pillar[];
  fixes: Fix[];
  /** P4 (2026-07-20) — up to 2 real fix cards (rank/title/delta) for the
   *  blurred locked-preview rows between `fixes` and the "N more" band, drawn
   *  from whatever the (already free-redacted) plan carries beyond the shown
   *  cards. `?? []` at the props boundary — absent on any payload/caller that
   *  predates P4. A blurred slot beyond this array's length renders as a
   *  content-free skeleton, never a fabricated title. */
  lockedPreview?: Fix[];
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
    /** v6: the search-presence value the gauge multiplies (raw score floored by the
     *  findability footprint) — what the "Search presence" driver bar shows so it
     *  reconciles with the gauge. Optional: legacy payloads fall back to `score`. */
    searchPresenceEffective?: number;
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
    /** D3/P3 (2026-07-20, data board) — share of traffic on third-party
     *  entity pages (directory/aggregator listings). Drives the aggregation
     *  strip below the hero when material (≥40). `?? 0` at the props
     *  boundary — absent on any payload captured before P1. */
    aggregatedPct: number;
    /** A few named third-party entities the aggregation strip cites as
     *  evidence (e.g. ["cometly", "trimrx"]). `?? []` at the props boundary. */
    aggregatedExamples: string[];
    offTopicPct: number;
    categoryWins: number;
    /** Total monthly searches in the category (Σ named seed-phrase volumes). */
    categoryDemand: number;
    /** Every named category phrase + its volume — so categoryDemand reconciles (G4). */
    categoryPhrases: { keyword: string; volume: number }[];
    /** Task B (2026-07-19, ladder restructure) — at most `[broad?, niche?]`.
     *  BROAD renders ABOVE the category-demand hero (only when its demand
     *  exceeds the hero's, per the inversion guard); NICHE renders BELOW the
     *  hero's own phrase chips. MEDIUM is never present here — it duplicated
     *  the hero (the SAME concept at the SAME altitude) and was dropped. */
    marketTiers: {
      tier: "broad" | "niche";
      label: string;
      demand: number;
      bestPosition: number | null;
      /** FINAL-REVIEW FIX: every phrase priced into this rung's `demand` sum —
       *  so a multi-phrase rung can itemise the rest as chips and its number
       *  reconciles to its parts (the same G4 idiom as `categoryPhrases`). */
      phrases: { keyword: string; volume: number }[];
    }[];
    /** WS-D (2026-07-19) — categoryRanked rows the subject already ranks
     *  top-3 for, so the report shows wins alongside gaps. */
    winsRows: { keyword: string; volume: number; yourPosition: number }[];
    /** WS-D (2026-07-19) — a few named off-topic keywords, so the >=40%
     *  warning is concrete ("e.g. you rank for 'spanglish translator'"). */
    offTopicExamples: string[];
    /** P2/P3 (2026-07-20, data board) — the CATEGORY (broad, laddered-large)
     *  and NICHE (specific, small-is-honest) cards `<MarketCard>` renders as
     *  sections 2+3 of the six-section board. `null`/absent on any payload
     *  captured before P2 (or when the synth had no `categoryNiche` seed) —
     *  the renderer falls back to the pre-P2 market-tier ladder render below
     *  (legacy safety: don't crash, don't blank). */
    categoryCard?: MarketCardData | null;
    nicheCard?: MarketCardData | null;
    /** Phase A: the leader domain the category market was sized from (provenance).
     *  Absent when the card came from the subject's own ladder. */
    categoryLeader?: string | null;
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
                // intentional, not a page-tidiness score. E2 (facts-first copy sweep,
                // 2026-07-20): numbers lead, clauses die — "Page quality × search
                // presence." says the same thing in a third of the words.
                const note = p.searchVisibility
                  ? "Page quality × search presence."
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
              {p.identityLine ? (
                <div style={{ fontSize: 12.5, color: "var(--c-faint)", margin: "0 0 8px", lineHeight: 1.5 }} className="rk-wrap-any">{p.identityLine}</div>
              ) : null}
              {/* Part C — honest degrade state: the fetch was unreadable (a
                  JS-shell page) and our one Tavily Extract fallback also
                  couldn't recover it. Replaces false-confidence findings
                  framing with a plain disclosure, in the identity-strip slot. */}
              {p.fetchDegraded ? (
                <div style={{ fontSize: 12.5, color: "var(--c-band-hard)", margin: "0 0 8px", lineHeight: 1.5 }} className="rk-wrap-any">
                  We couldn&apos;t fully read this page (it renders in the browser). On-page findings may be incomplete.
                </div>
              ) : null}
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
                // v6: the "Search presence" bar shows the EFFECTIVE value the gauge
                // multiplies (raw score floored by the findability footprint), so the
                // two bars reconcile with the gauge — never gauge 76 beside a
                // contradictory "Search presence 0" for a site ranking 17k keywords.
                // `?? score` for legacy payloads that predate searchPresenceEffective.
                const searchPresenceShown = p.searchVisibility!.searchPresenceEffective ?? p.searchVisibility!.score;
                const drivers = [
                  { label: "On-page readiness", value: p.searchVisibility!.onPageReadiness, note: "how well your page is built" },
                  { label: "Search presence", value: searchPresenceShown, note: "how findable you are in search" },
                ];
                // Name whichever driver is actually weaker — an unconditional
                // "Search presence is your gap." contradicts the bars directly
                // above it whenever on-page readiness is the lower of the two
                // (MINOR 4: e.g. an established brand with strong search but a
                // weak page).
                const weakerDriver = p.searchVisibility!.onPageReadiness < searchPresenceShown
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
                    {/* E2 (facts-first copy sweep, 2026-07-20): the old line spelled
                        out the geomean mechanic in prose ("a flawless page nobody
                        finds still scores low") — the two bars right above it already
                        SHOW that. Numbers lead, clauses die. */}
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--c-muted)", fontFamily: JM, paddingTop: 4, borderTop: "1px dashed var(--c-line2)", marginTop: 2 }}>
                      Your score multiplies both. <strong style={{ color: "var(--c-fg)" }}>{weakerDriver} is your gap.</strong>
                    </div>
                    {/* Data board §1 (Overview): the market stat — the CATEGORY
                        size, positive and data-led ("N searches/mo in your
                        market — you're in a real category"). This is the free
                        board's category hook (owner note 2026-07-22: the old
                        "your category gets X … barely visible" HEADLINE was
                        dropped in favour of this positive stat). Only when
                        categoryCard carries a priced phrase — never an empty
                        "0 searches/mo" claim. */}
                    {marketCardReady(p.searchVisibility!.categoryCard) && (
                      <div style={{ marginTop: 2, paddingTop: 12, borderTop: "1px solid var(--c-line2)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 26 }}>{p.searchVisibility!.categoryCard.demand.toLocaleString()}</span>
                        <span style={{ fontSize: 12, color: "var(--c-muted)" }}>searches/mo in your market — you&apos;re in a real category</span>
                        {p.searchVisibility!.categoryLeader && (
                          <span style={{ fontSize: 11, color: "var(--c-muted)", fontFamily: JM }}>· sized from {p.searchVisibility!.categoryLeader}</span>
                        )}
                      </div>
                    )}
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
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: "32px 0 14px" }}>Your category, and how much of it you own</h2>
          {/* Zero-state — the site ranks for nothing. This IS the insight (never hide
              it): a young product is invisible in organic search. */}
          {p.searchVisibility && p.searchVisibility.keywordsRanked === 0 && (() => {
            const sv = p.searchVisibility!;
            return (
              <div style={{ background: "var(--c-tint-red)", borderLeft: "3px solid #E5484D", borderRadius: "0 12px 12px 0", padding: "18px 20px", marginBottom: 14, fontSize: 14.5, lineHeight: 1.6, color: "#3A3744" }}>
                {/* E2 (facts-first copy sweep, 2026-07-20): dropped "buyers can't
                    find you unless they already type your name" (restates the bold
                    line above) and "That's the single biggest thing…" (editorial,
                    not a fact) — numbers lead, clauses die. */}
                <strong style={{ fontFamily: SG, fontSize: 16 }}>Google ranks you for 0 searches.</strong><br />
                You&apos;re invisible in organic search
                {sv.categoryDemand > 0 ? `, while ${sv.categoryDemand.toLocaleString()} searches/mo in your category go to everyone else` : ""}.
              </div>
            );
          })()}
          {/* Owner note (2026-07-22): the "DIRECTORY PATTERN DETECTED"
              aggregation strip was REMOVED — a notification-style panel that
              cluttered the data board. `aggregatedPct` still feeds the footprint
              classification (and thus the score); only its render is gone.
              `aggregatedExamples` now has no consumer (a cheap derived field). */}
          {/* Category demand (free): the real market size and how many of those
              terms you actually win. Once a payload carries a READY categoryCard
              (P2 — real priced phrases, never an empty shell: `marketCardReady`),
              this renders the six-section board's Category/Niche/Opportunity
              (sections 2-4, the wireframe at docs/plans/2026-07-20-free-scan-
              databoard.md §3). A legacy payload (categoryCard absent/ungrounded)
              falls through to the pre-P2 market-tier ladder, UNCHANGED — the
              brief's "don't crash, don't blank" legacy-safety rule. */}
          {p.searchVisibility && (() => {
            const sv = p.searchVisibility!;
            const comps = (p.competitors ?? []).slice(0, 5);
            const CARD_STYLE: CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "18px 20px" };
            // WS-E (2026-07-19): both rivalry states, not just the found case.
            // Discovered rival NAMES are free (the compare-set); per-rival intel
            // is the paid unlock. Shared by BOTH the new and legacy branches
            // below (P3 DRY fix — was duplicated per-branch pre-P3).
            // P4 (2026-07-20, terseness) + L1 (2026-07-23): the tease is
            // keyword-only and data-driven — the compare-set NAMES (real, free) +
            // a bare unlock link. The link now names what paid actually delivers
            // post-M3a (rival rank + the keyword spine), not the retired "why they
            // win / share of category" prose. This is the one deliberate deviation
            // from the wireframe's 6 sections (no rivalry section) — kept because
            // the names are a strong, honest paid hook.
            const rivalryTeaser = comps.length > 0 ? (
              <div style={{ ...CARD_STYLE, marginBottom: 14, fontSize: 13, color: "var(--c-muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-faint)" }}>Compared to</span>
                <strong className="rk-wrap-any" style={{ color: "var(--c-ink)" }}>{comps.join(", ")}</strong>
                <UnlockLink scanId={p.scanId}>🔒 See how each rival ranks + your keyword spine →</UnlockLink>
              </div>
            ) : !p.hideUnlock ? (
              <div style={{ ...CARD_STYLE, marginBottom: 14, fontSize: 13, color: "var(--c-muted)" }}>
                <UnlockLink scanId={p.scanId}>🔒 See who wins these + your weekly plan →</UnlockLink>
              </div>
            ) : null;

            // ── P3: the NEW six-section board (sections 2-4) ──────────────
            if (marketCardReady(sv.categoryCard)) {
              const categoryCard = sv.categoryCard!;
              // P3fix (2026-07-20): a niche with genuinely 0 priced phrases
              // (trustmrr.com — a real directory) used to be OMITTED entirely,
              // silently collapsing the two-card layout to one column. The
              // card's LABEL is real LLM output regardless of whether any
              // phrase priced — so when `sv.nicheCard` exists at all, ALWAYS
              // render its slot: a real `<MarketCard>` when it's ready
              // (priced phrases), else the honest `<NicheEmptyCard>` (never a
              // fabricated demand number — invariant #11). Only a wholly
              // ABSENT nicheCard (legacy payload, predates P2) renders nothing.
              const nicheCardData = sv.nicheCard ?? null;
              const nicheReady = !!nicheCardData && hasCardPhrases(nicheCardData);
              return (
                <>
                  {/* The intrinsic-collapse grid idiom (dashboard-hero.tsx): the
                      category + niche cards side by side, collapsing to one
                      column with NO media query — mobile-safe by construction
                      (the CI-blocking mobile gate needs nothing extra here). */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14, marginBottom: 14 }}>
                    <MarketCard kind="category" card={categoryCard} />
                    {nicheCardData && (hasCardPhrases(nicheCardData) ? <MarketCard kind="niche" card={nicheCardData} /> : <NicheEmptyCard label={nicheCardData.label} />)}
                  </div>
                  {sv.categoryDemand > 0 && rivalryTeaser}
                  {/* Opportunity — section 4: the niche's OWN gap keywords (real
                      demand + real positions, zero LLM), by volume — "where the
                      searches are, and you're not there." Omitted entirely when
                      the niche has nothing to show (invariant #11: an empty
                      input renders no section, never an empty list) — the
                      empty-state CARD above still shows, but there is nothing
                      to itemise here. */}
                  {nicheReady && nicheCardData!.gaps.length > 0 && (() => {
                    const gaps = nicheCardData!.gaps.slice(0, 5);
                    // Bars are sized against the biggest shown gap — a visual
                    // demand ranking ("win the tall bars first"). Pure ratio of
                    // real volumes; the numbers themselves are the payload values.
                    const maxVol = Math.max(...gaps.map((g) => g.volume), 1);
                    return (
                    <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "20px 22px", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                        <div style={{ fontFamily: SG, fontWeight: 700, fontSize: 16 }}>What to rank for next</div>
                        <div style={{ fontFamily: JM, fontSize: 11.5, color: "var(--c-faint)" }}>{gaps.length} niche searches · you don&apos;t rank</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                        {gaps.map((row) => {
                          const pct = Math.max(6, Math.round((row.volume / maxVol) * 100));
                          const ranks = typeof row.yourPosition === "number";
                          return (
                            <div key={row.keyword}>
                              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
                                <span className="rk-wrap-any" style={{ fontWeight: 600, fontSize: 13.5, minWidth: 0 }}>{row.keyword}</span>
                                <span style={{ display: "inline-flex", gap: 8, alignItems: "baseline", flex: "0 0 auto" }}>
                                  <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 13 }}>{row.volume.toLocaleString()}</span>
                                  <span style={{ fontSize: 11, color: "var(--c-faint)" }}>/ mo</span>
                                  <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 11, color: ranks ? "#C98A12" : "#E5484D", whiteSpace: "nowrap" }}>{ranks ? `#${row.yourPosition}` : "not ranking"}</span>
                                </span>
                              </div>
                              {/* Demand bar — width ∝ real monthly volume. */}
                              <div style={{ height: 7, borderRadius: 5, background: "var(--c-fill)", overflow: "hidden" }}>
                                <div style={{ height: "100%", borderRadius: 5, width: `${pct}%`, background: "linear-gradient(90deg, var(--c-action), #8B74FF)" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Paid bridge — the niche opportunity IS the paid thesis:
                          the pages to win these + weekly tracking as the score
                          climbs. Named up front, one line, no prose. */}
                      {!p.hideUnlock && (
                        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--c-line2)", fontSize: 13, fontWeight: 600 }}>
                          <UnlockLink scanId={p.scanId}>🔒 Get the pages to win these + weekly rank tracking →</UnlockLink>
                        </div>
                      )}
                    </div>
                    );
                  })()}
                </>
              );
            }

            // ── Legacy fallback: the pre-P2 market-tier ladder, UNCHANGED ──
            if (sv.categoryDemand <= 0) return null;
            const wins = Math.max(0, sv.categoryWins);
            // Task B (2026-07-19, ladder restructure): at most one BROAD and one
            // NICHE rung. MEDIUM never renders — it duplicated the category hero.
            const broadTier = (sv.marketTiers ?? []).find((t) => t.tier === "broad");
            const nicheTier = (sv.marketTiers ?? []).find((t) => t.tier === "niche");

            // E1 (2026-07-20, three-card market split, Tim: "two/three individual
            // UI components side by side"). Replaces the old ladder ROWS + in-card
            // hero arrangement with sibling cards — BROAD | YOUR CATEGORY | NICHE.
            const pill = (label: string) => (
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", color: "var(--c-faint)" }}>{label}</span>
            );
            const standing = (bestPosition: number | null) => (
              <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 13, color: bestPosition != null ? "#C98A12" : "#E5484D" }}>
                {bestPosition != null ? `best #${bestPosition}` : "not ranking"}
              </span>
            );
            // Every rung's phrase(s) — always itemised as chips (G4/R2), even a
            // single phrase: with no separate "label" line in the card design
            // (unlike the old row layout), the chip IS how the card says WHAT
            // its demand number is for.
            const phraseChips = (phrases: { keyword: string; volume: number }[]) => (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", fontSize: 12.5, color: "var(--c-faint)", fontFamily: JM, marginTop: 10 }}>
                {phrases.map((ph) => (
                  <span key={ph.keyword} style={{ background: "var(--c-fill)", borderRadius: 6, padding: "2px 8px" }}>
                    {ph.keyword} <span style={{ color: "var(--c-muted)", fontWeight: 600 }}>{ph.volume.toLocaleString()}</span>
                  </span>
                ))}
              </div>
            );
            // BROAD/NICHE sibling card — "this is the big industry" (broad) or "a
            // cheap, additional altitude" (niche). BROAD only survives the
            // lib-level inversion guard (its priced demand exceeds the category
            // hero's — an inverted ladder is dropped, never rendered dishonestly);
            // NICHE has no such guard, it never claims to be the "biggest" market.
            const tierCard = (tier: "broad" | "niche", t: NonNullable<typeof broadTier>) => (
              <div key={tier} style={CARD_STYLE}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                  {pill(tier.toUpperCase())}
                  {standing(t.bestPosition)}
                </div>
                <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 22 }}>{t.demand.toLocaleString()}</div>
                <div style={{ fontSize: 12.5, color: "var(--c-muted)" }}>searches/mo</div>
                {phraseChips(t.phrases)}
                {/* Only the BROAD card carries the bridge to the category card
                    beside it — the reader's eye moves broad → category → niche. */}
                {tier === "broad" && (
                  <div style={{ fontSize: 11.5, color: "var(--c-faint)", marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--c-line2)" }}>
                    Your category, where the plan below starts: →
                  </div>
                )}
              </div>
            );
            return (
              <>
                {/* The intrinsic-collapse grid idiom (dashboard-hero.tsx): up to
                    three sibling cards side by side, collapsing to one column with
                    NO media query — mobile-safe by construction (the CI-blocking
                    mobile gate needs nothing extra here). */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14, marginBottom: 14 }}>
                  {broadTier && tierCard("broad", broadTier)}
                  {/* YOUR CATEGORY card — the hero's own identity, independent of
                      whichever sibling rungs render, so it always states the
                      concept plainly. Its "standing" is a terse top-3-count chip
                      (P4 review fix, 2026-07-20: was a full sentence — "You rank
                      in the top 3 for N of your category's searches." — the
                      winsRows chips below already itemise WHICH terms, so the
                      header only needs the count, matching `standing()`'s
                      pill+chip idiom used by the sibling broad/niche cards). */}
                  <div style={CARD_STYLE}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                      {pill("YOUR CATEGORY")}
                      <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 13, color: wins > 0 ? "#1F9D5B" : "#E5484D" }}>
                        {wins > 0 ? `top 3 × ${wins}` : "not ranking"}
                      </span>
                    </div>
                    <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 26 }}>{sv.categoryDemand.toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 10 }}>searches/mo across your category</div>
                    {/* WS-D (2026-07-19): the "you already win" strip — categoryRanked
                        rows the subject already ranks top-3 for, so the card shows
                        wins alongside gaps, not gaps only. */}
                    {(sv.winsRows ?? []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", fontSize: 12.5, fontFamily: JM, marginBottom: 10 }}>
                        {(sv.winsRows ?? []).map((w) => (
                          <span key={w.keyword} style={{ background: "var(--c-tint-green)", color: "#0E7A48", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                            #{w.yourPosition} {w.keyword} <span style={{ fontWeight: 700 }}>{w.volume.toLocaleString()}</span>
                          </span>
                        ))}
                        {/* FINAL-REVIEW FIX: the wins SENTENCE above ("you rank in the
                            top 3 for N…") is uncapped, but these chips are the
                            volume-capped categoryRanked top-15 filtered to top-3 and
                            sliced to 3 — so the sentence's N can exceed the chips
                            shown, with no disclosure that the strip is partial. */}
                        {wins > (sv.winsRows ?? []).length && (
                          <span style={{ color: "var(--c-faint)", fontWeight: 600, padding: "2px 4px" }}>+{wins - (sv.winsRows ?? []).length} more</span>
                        )}
                      </div>
                    )}
                    {/* G4: itemise the phrases behind the demand total, so "N searches/mo"
                        is reconcilable against its named parts (was a mystery number). */}
                    {sv.categoryPhrases.length > 0 && phraseChips(sv.categoryPhrases.slice(0, 8))}
                  </div>
                  {nicheTier && tierCard("niche", nicheTier)}
                </div>
                {rivalryTeaser}
              </>
            );
          })()}
          {/* Footprint split (free): brand vs your category vs other companies' names.
              For a directory/aggregator this exposes that most "traffic" is incidental.
              P3: superseded by the category/niche MarketCards + the aggregation strip
              above once a payload carries a ready categoryCard — legacy-only below. */}
          {p.searchVisibility && p.searchVisibility.keywordsRanked > 0 && !marketCardReady(p.searchVisibility.categoryCard) && (() => {
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
                  /* P4 review fix (2026-07-20, "not buyers looking for you" — the
                     last prose sibling): the old block was a full sentence
                     ("{offTopicPct}% of your search traffic is other companies'
                     names — not buyers looking for you.") — the split bar +
                     percentage chips above already carry that number. Dropped
                     to a terse label chip: the percentage + named examples
                     (still real, still derivable), no sentence framing. */
                  <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--c-tint-orange)", borderLeft: "3px solid #E0731C", borderRadius: "0 10px 10px 0", fontSize: 12.5, fontFamily: JM, fontWeight: 600, color: "#3A3744" }}>
                    other companies&apos; names {sv.offTopicPct}%
                    {(sv.offTopicExamples ?? []).length > 0 && (
                      <span style={{ fontWeight: 700 }}> · e.g. {(sv.offTopicExamples ?? []).map((ex) => `"${ex}"`).join(", ")}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          {/* Biggest opportunity — we promote the single HIGHEST-value category
              search you don't win (sorted by volume upstream), framed by the score
              lever it moves, instead of a flat Low/Med/High table that buried the
              big win under tiny near-misses. The rest are teased behind checkout.
              P3: superseded by the "Opportunity · your niche" section (rendered
              above, inside the categoryCard branch) once a payload's categoryCard
              is ready — the wireframe's six sections have exactly ONE opportunity
              section, never two competing framings back to back. Legacy-only. */}
          {!marketCardReady(p.searchVisibility?.categoryCard) && (() => {
            const top = p.gapRows[0];
            if (!top) {
              // No parsed opportunities — tease the paid keyword-gap plan (free), or
              // stay honest on a paid report with genuinely no data.
              return !p.hideUnlock ? (
                <div style={{ background: "var(--c-tint-violet)", border: "1px solid var(--c-tint-violet-line)", borderRadius: 16, padding: "18px 22px", fontSize: 14, lineHeight: 1.55, color: "#3A3744" }}>
                  🔒 The full keyword-gap plan{p.gapTotal > 0 ? ` (${p.gapTotal} queries)` : ""} — every buyer search where rivals outrank you, ranked by opportunity. <UnlockLink scanId={p.scanId}>Unlock to see who wins them and how →</UnlockLink>
                </div>
              ) : p.gapTotal === 0 ? (
                <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: "18px 22px", fontSize: 14, color: "var(--c-faint)" }}>
                  Search-gap data wasn&apos;t available for this scan — keyword rankings could not be measured for this site yet.
                </div>
              ) : null;
            }
            const more = Math.max(0, p.gapTotal - Math.min(p.gapRows.length, 4));
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
                {/* P4 review fix (2026-07-20): the old block here was two prose
                    sentences ("Winning this lifts Search presence — your weaker
                    half." + "There are N more like it in your category.") — the
                    query/volume/rank chips above already carry that meaning.
                    Dropped entirely; the "+N more" count (still real, still
                    derivable — R2/R4) survives as a bare chip, no sentence. */}
                {more > 0 && (
                  <div style={{ marginTop: 14, fontSize: 12.5, fontFamily: JM, fontWeight: 600, color: "var(--c-faint)" }}>🔒 +{more} more</div>
                )}
                {p.gapRows.length > 1 && (
                  <div style={{ marginTop: 14, borderTop: "1px solid var(--c-line2)", paddingTop: 4 }}>
                    {p.gapRows.slice(1, 4).map((row) => (
                      <div key={row.query} style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--c-line2)", fontSize: 13.5 }}>
                        <span style={{ fontFamily: SG, fontWeight: 600, flex: "1 1 160px", minWidth: 0 }} className="rk-wrap-any">{row.query}</span>
                        <span style={{ fontFamily: JM, color: "var(--c-muted)" }}>{row.volume}/mo</span>
                        <span style={{ fontFamily: JM, fontWeight: 700, color: row.ranked ? "#C98A12" : "#E5484D" }}>{row.rank}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!p.hideUnlock && p.gapTotal > 0 && (
                  <div style={{ marginTop: 14, textAlign: "center", fontSize: 14, fontWeight: 600 }}>
                    <UnlockLink scanId={p.scanId}>
                      🔒 Unlock the plan to win {p.gapTotal === 1 ? "this opportunity" : `all ${p.gapTotal} opportunities`} — pages, drafts, and weekly tracking →
                    </UnlockLink>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Top ranked fixes — P4 (2026-07-20, terseness): dropped the "Ordered
              by expected score impact. Free scans show N of M." subtitle
              sentence (the count is now conveyed by the cards themselves: 2
              shown + up to 2 blurred-locked previews + the "N more" band). */}
          <h2 style={{ fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: "32px 0 14px" }}>{p.fixes.length > 0 ? `Your top ${p.fixes.length} ranked fixes` : "Your ranked fixes"}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Graceful floor for already-persisted reports with an empty action
                plan — never render a bare "top 0 fixes" section. */}
            {p.fixes.length === 0 && p.lockedCount === 0 && (
              <div style={{ background: "var(--c-surface)", border: "1px dashed #D9D6E4", borderRadius: 14, padding: "18px 20px", fontSize: 14, color: "var(--c-faint)" }}>
                We couldn&apos;t rank fixes for this scan. The pillar bars above show where you&apos;re weakest — re-run the scan to regenerate a full action plan.
              </div>
            )}
            {/* P4 terse fix card: rank tile · title · effort/pillar keyword chips ·
                +N delta. The old "why" sentence (a full LLM-generated reasoning
                paragraph) is GONE — Tim's directive: titles + minor keywords +
                numbers only, no long sentences. */}
            {p.fixes.map((f) => {
              const ec = effortColors(f.effort);
              return (
                <div key={f.rank} style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: ec.bg, color: ec.fg, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: JM, flex: "0 0 auto" }}>{f.rank}</span>
                  <div style={{ flex: "1 1 0%", minWidth: 0 }}>
                    <div className="rk-wrap-any" style={{ fontWeight: 600, fontSize: 15.5 }}>{f.title}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 8 }}>
                      {/* Data-driven keyword opportunities lead with their real
                          search volume — the number that makes it a growth move. */}
                      {f.metric && (
                        <span style={{ fontFamily: JM, fontSize: 11.5, fontWeight: 700, color: "#1F9D5B", background: "var(--c-tint-green)", padding: "3px 9px", borderRadius: 6 }}>{f.metric}</span>
                      )}
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: ec.fg, background: ec.bg, padding: "3px 9px", borderRadius: 6 }}>{f.effort}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--c-muted)", background: "var(--c-fill)", padding: "3px 9px", borderRadius: 6 }}>{f.pillar}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                    <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 18, color: "#1F9D5B" }}>+{f.pred}</div>
                  </div>
                </div>
              );
            })}
            {/* Phase C / D4 (2026-07-21): the free board ALWAYS blurs 2 locked
                rows below the 3 shown fixes — a CONSISTENT paywall tease ("the
                plan continues on upgrade"), shown even when no specific free fix
                is withheld. A slot uses REAL rank-4/5 data when the (already
                free-redacted) plan carries it (`p.lockedPreview`); otherwise it
                renders a content-free skeleton bar — honest, never a fabricated
                title (invariant #11). Gated on `fixes.length > 0` so the degraded
                empty-plan branch above owns the zero case. */}
            {p.fixes.length > 0 && Array.from({ length: 2 }).map((_, i) => {
              const real = (p.lockedPreview ?? [])[i];
              return (
                <div
                  key={`locked-preview-${i}`}
                  aria-hidden="true"
                  style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, filter: "blur(3px)", opacity: 0.55, userSelect: "none", pointerEvents: "none" }}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--c-fill)", color: "var(--c-faint)", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: JM, flex: "0 0 auto" }}>{p.fixes.length + i + 1}</span>
                  <div style={{ flex: "1 1 0%", minWidth: 0 }}>
                    {real ? (
                      <div className="rk-wrap-any" style={{ fontWeight: 600, fontSize: 15.5 }}>{real.title}</div>
                    ) : (
                      <div style={{ height: 15, width: "72%", borderRadius: 4, background: "var(--c-fill)" }} />
                    )}
                  </div>
                  <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                    {real ? (
                      <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 18, color: "#1F9D5B" }}>+{real.pred}</div>
                    ) : (
                      <div style={{ height: 18, width: 30, borderRadius: 4, background: "var(--c-fill)" }} />
                    )}
                  </div>
                </div>
              );
            })}
            {/* The unlock CTA. When a real withheld count exists it names it
                ("N more ranked fixes [worth +W]" — the number derives ONLY from
                the real collection, R4/G10); otherwise a generic unlock CTA with
                NO fabricated count. `worth` clause only when > 0 (a "+0" reads as
                broken). */}
            {p.fixes.length > 0 && (
              <div style={{ position: "relative", background: "var(--c-surface)", border: "1px dashed #D9D6E4", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-faint)" }}>
                  🔒 {p.lockedCount > 0 ? <>{p.lockedCount} more ranked fixes{p.lockedWorth > 0 ? <> — worth an estimated +{p.lockedWorth}</> : null} — </> : null}<UnlockLink scanId={p.scanId}>unlock the full plan →</UnlockLink>
                </span>
              </div>
            )}
          </div>

          {/* P4 (2026-07-20, terseness): Positioning Mirror REMOVED from the free
              board — it was the single worst prose violation (a full LLM
              paragraph, "The listing emphasizes…") and isn't in the approved
              wireframe. This is a RENDER removal only: `intendedTags` /
              `actualTags` / `mirrorGap` still flow through `toResultsProps`
              unchanged (paid /app may still consume them) — nothing upstream
              was touched, per invariant #11's grounding work staying intact. */}

          {/* Evidence footnote */}
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--c-faint)", fontFamily: JM }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1F9D5B", display: "inline-block" }} />
            {/* G6: no hardcoded signal count. The free scan MEASURES ~9 signals, not
                18 (the registry size) — claiming "18 signals" over-stated what we
                analyzed about YOU. The evidence claim below is true without a number. */}
            Scanned {p.siteLabel} just now · every claim links to extracted evidence
          </div>

          {/* P4 (2026-07-20, terseness): ONE upgrade component, matching the
              wireframe exactly — title + 3 keyword features (mono, stacked) +
              button + price. Replaces the old two-paragraph title/subtitle
              (dynamic marketing sentences describing what's inside) AND the
              second, separate "Close the gap before your rivals widen it" CTA
              card that public-report.tsx stacked below this one — the two
              CTAs the brief calls out to collapse into one. Price stays (a
              number, not prose — "stated up front" per the original decision). */}
          {!p.hideUnlock && (
            <div style={{ marginTop: 18, background: "linear-gradient(135deg, var(--c-dark), var(--c-dark2))", borderRadius: 18, padding: "30px 32px", textAlign: "center" }}>
              <h3 style={{ fontFamily: SG, fontWeight: 700, fontSize: 22, color: "#fff", margin: "0 0 16px" }}>Unlock the full plan</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: JM, fontSize: 13, color: "#D8D5E6", marginBottom: 20 }}>
                <span>Weekly action plan + keyword spine</span>
                <span>Weekly rank tracking &amp; score history</span>
                <span>Referrer lessons &amp; community targets</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                {p.unlockButton ?? (
                  <button style={{ fontFamily: PJ, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", background: "var(--c-surface)", border: "none", borderRadius: 10, padding: "13px 24px", cursor: "pointer", whiteSpace: "nowrap" }}>Unlock →</button>
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
