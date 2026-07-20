/* @mirrors components/report/captured/results-screen.tsx */
import * as React from "react";

/**
 * ResultsScreen — the free-scan report rendered at /scan/[id]: a context bar
 * (free scan · site + Share), the hero card (280° gauge showing the UNIFIED
 * Discoverability Score + band + headline + its TWO driver bars: on-page
 * readiness × search presence + the Overview hero stat — the CATEGORY size),
 * the P3 (2026-07-20, data board) SIX-SECTION BOARD: Category (broad) + Niche
 * (specific) MarketCards side by side, a terse "Compared to: {names}" rivalry
 * tease in BOTH its states (rivals found → names + unlock; none found → an
 * honest "See who's winning these searches" degrade, WS-E), the Opportunity
 * section (the niche's own gap keywords by volume), the top ranked fixes (2
 * shown + up to 2 blurred locked-preview rows + the "N more" band), the
 * evidence footnote, and ONE consolidated unlock CTA. A payload whose
 * categoryCard isn't yet grounded (pre-P2 / legacy) falls back to the OLD
 * three-tier ladder + footprint-split render instead — documented as a note
 * below, not duplicated as a second full demo (the DS shows the CANONICAL
 * going-forward experience; every new scan carries a ready categoryCard).
 *
 * P4 (2026-07-20, data-driven terseness — Tim's critical directive): the
 * Positioning Mirror (a full LLM prose paragraph) is REMOVED from the free
 * board entirely; every section subtitle SENTENCE is gone (short pill/title
 * labels only); fix cards drop their "why" reasoning sentence (title + a
 * delta chip only); the rivalry line is a bare keyword tease; the two
 * separate upgrade CTAs (this band + public-report.tsx's own card) collapse
 * into ONE terse "Unlock the full plan" component, matching the approved
 * wireframe (https://claude.ai/code/artifact/47e3c03c-b3f8-49c3-a1bc-
 * 58279eb49ba0). Mirrors the live captured report
 * (`components/report/captured/results-screen.tsx`).
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

// v5 unified Discoverability Score = geomean of the two drivers. A tidy page (high
// on-page) that nobody finds (low search presence) reads low — the whole point.
const ON_PAGE = 72, SEARCH = 40;
const SCORE = Math.round(Math.sqrt(ON_PAGE * SEARCH)); // 54 — "Fair"
// Names whichever driver is actually weaker (search here: 40 < 72) — an
// unconditional "Search presence is your gap." would contradict the bars
// whenever on-page is the lower driver instead.
const WEAKER_DRIVER = ON_PAGE < SEARCH ? "On-page readiness" : "Search presence";
const SITE = "bloom.io";
// R1 (2026-07-19) — the listing's own self-description, rendered as a small
// line before the headline.
const IDENTITY_LINE = "Habit and mood tracking for people building daily routines.";
// P3 (2026-07-20, data board §2-3): the CATEGORY (broad, laddered-large — D2:
// a small category is a too-narrow definition, never fabricated) and NICHE
// (specific, small-is-honest) MarketCards. `rankedTop3`/`gaps` partition every
// priced phrase (`splitRankedGaps`) — CATEGORY here demos the zero-state ("None
// yet." — an honest hook, not a blank) and NICHE demos a real top-3 win, so
// both card states are visible in one demo.
const CATEGORY_CARD = {
  label: "productivity software",
  demand: 90500,
  rankedTop3: [] as { keyword: string; volume: number; yourPosition?: number }[],
  gaps: [{ keyword: "productivity software", volume: 90500 }, { keyword: "task management app", volume: 40200 }],
};
const NICHE_CARD = {
  label: "habit tracker app",
  demand: 8820,
  rankedTop3: [{ keyword: "habit journal app", volume: 720, yourPosition: 2 }],
  gaps: [{ keyword: "habit tracker app", volume: 8100 }],
};
// The Overview hero stat (§1) — the CATEGORY's own laddered demand, a
// DIFFERENT number from any legacy `categoryDemand` field (the two coexist by
// design; see search-visibility.ts's doc comment on `categoryCard`).
const HERO_MARKET_DEMAND = CATEGORY_CARD.demand;
// Opportunity (§4) — the NICHE's own gap keywords, by volume. Omitted
// entirely when there's nothing to show (invariant #11), same discipline as
// every other section here.
const NICHE_OPPORTUNITY_ROWS = NICHE_CARD.gaps;
const DRIVERS = [
  { label: "On-page readiness", value: ON_PAGE, note: "how well your page is built" },
  { label: "Search presence", value: SEARCH, note: "how findable you are in search" },
];
// P4 (2026-07-20, terseness): 2 shown fixes — no "why" reasoning sentence
// (title + effort/pillar keyword chips + a delta chip only). LOCKED_PREVIEW
// is the "2+2" paywall tease: up to 2 MORE real fix cards, rendered blurred.
const FIXES = [
  { rank: 1, title: "Publish 3 “bloom vs [rival]” comparison pages", effort: "Medium", pillar: "Content", pred: 6, ec: { bg: "var(--c-tint-amber)", fg: "var(--c-band-fair)" } },
  { rank: 2, title: "Claim your G2 + Capterra listings", effort: "Quick", pillar: "Outreach", pred: 5, ec: { bg: "var(--c-tint-blue)", fg: "var(--c-action)" } },
];
const LOCKED_PREVIEW = [
  { rank: 3, title: "Add FAQ schema to your pricing page", pred: 4 },
  { rank: 4, title: "Fix thin meta descriptions across 6 pages", pred: 3 },
];

const CARD: React.CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16 };
const H2: React.CSSProperties = { fontFamily: SG, fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em", margin: "32px 0 6px" };
const SUB: React.CSSProperties = { fontSize: 14, color: "var(--c-faint)", margin: "0 0 12px" };
const UNLOCK: React.CSSProperties = { color: "var(--c-action)", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" };

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

        {/* Hero card — ONE unified score + its two drivers (no more "98 vs Invisible") */}
        <div style={{ ...CARD, borderRadius: 20, padding: "clamp(20px, 5vw, 32px)", boxShadow: "0 16px 44px -26px rgba(40,33,84,0.3)", display: "grid", gridTemplateColumns: "auto 1fr", gap: 34, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <svg width="200" height="200" viewBox="0 0 200 200" style={{ display: "block" }} aria-hidden="true">
              <path d={arc(1)} fill="none" stroke="var(--c-fill)" strokeWidth="15" strokeLinecap="round" />
              <path d={arc(SCORE / 100)} fill="none" stroke={b.fg} strokeWidth="15" strokeLinecap="round" />
              <text x="100" y="106" textAnchor="middle" style={{ font: `700 40px ${JM}, monospace`, fill: "var(--c-ink)" }}>{SCORE}</text>
              <text x="100" y="126" textAnchor="middle" style={{ font: `600 11px ${JM}, monospace`, fill: "var(--c-faint)", letterSpacing: 1 }}>/ 100</text>
            </svg>
            <span style={{ display: "inline-block", background: b.bg, color: b.fg, fontWeight: 700, fontSize: 13, padding: "5px 13px", borderRadius: 8, fontFamily: SG, marginTop: 4 }}>{b.label}</span>
            <div style={{ fontSize: 11.5, color: "var(--c-faint)", fontFamily: JM, maxWidth: 200, margin: "10px auto 0" }}>Page quality × search presence.</div>
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: "var(--c-faint)", margin: "0 0 8px", lineHeight: 1.5 }}>{IDENTITY_LINE}</div>
            {/* Part C (2026-07-19) — a JS-shell fetch our one Tavily Extract
                escalation also couldn't recover degrades to this honest line,
                in the SAME identity-strip slot, replacing false-confidence
                findings framing. Demo shows the healthy IDENTITY_LINE above
                (the common case); this note discloses the exact copy shown
                live when `fetchDegraded` is true. */}
            <div style={{ fontSize: 11.5, color: "var(--c-faint)", fontStyle: "italic", margin: "0 0 4px" }}>
              fetchDegraded (unreadable page) → the identity line above is replaced with: "We couldn&apos;t fully read this page (it renders in the browser). On-page findings may be incomplete."
            </div>
            <h1 style={{ fontFamily: SG, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>Your category gets 12,400 searches a month — and you&apos;re barely visible for any of them.</h1>
            {/* ON_PAGE (72) >= 60 → the intro credits the on-page driver, never
                the unified SCORE (54) — the intro gates on onPageReadiness so
                a tidy page nobody finds can't be told it "has real on-page
                gaps" beside its own high on-page bar (live fix: the intro's
                gate in to-results-props.ts reads onPageReadiness, not the
                mixed unified total). */}
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--c-muted)", margin: "0 0 18px" }}>{SITE} is in decent on-page shape. The plan below focuses on where you can still gain ground.</p>
            {/* The two drivers of the unified score */}
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {DRIVERS.map((d) => (
                <div key={d.label}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{d.label}</span>
                    <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 15, color: pillarColor(d.value) }}>{d.value}<span style={{ fontSize: 11, color: "var(--c-faint)", fontWeight: 500 }}>/100</span></span>
                  </div>
                  <div style={{ height: 8, borderRadius: 5, background: "var(--c-fill)", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 5, width: `${d.value}%`, background: pillarColor(d.value) }} /></div>
                  <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--c-faint)", fontFamily: JM }}>{d.note}</div>
                </div>
              ))}
              <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--c-muted)", fontFamily: JM, paddingTop: 4, borderTop: "1px dashed var(--c-line2)", marginTop: 2 }}>
                Your score multiplies both. <strong style={{ color: "var(--c-ink)" }}>{WEAKER_DRIVER} is your gap.</strong>
              </div>
              {/* P3 (data board §1, Overview): the hero stat — the CATEGORY
                  size, laddered-large and grounded (D2: a small category is a
                  too-narrow definition, never fabricated). Sits at the bottom
                  of the SAME hero card, beneath the driver bars. */}
              <div style={{ marginTop: 2, paddingTop: 12, borderTop: "1px solid var(--c-line2)", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 26 }}>{HERO_MARKET_DEMAND.toLocaleString()}</span>
                <span style={{ fontSize: 12, color: "var(--c-muted)" }}>searches/mo in your market — you&apos;re in a real category</span>
              </div>
            </div>
          </div>
        </div>

        {/* Alt-state notes for the hero — this demo shows the common free/
            searchVisibility-present case; the paid + zero-ranking states are
            documented (exact live copy), not duplicated as full demos. */}
        <div style={{ marginTop: -6, marginBottom: 6, fontSize: 11.5, color: "var(--c-faint)", fontStyle: "italic" }}>
          Paid report (marketPosition present) → the gauge column also shows a &quot;<strong>Market position vs rivals</strong>&quot; grade beneath a dashed divider — the off-site cohort strength vs discovered competitors.
        </div>
        <div style={{ marginTop: -6, marginBottom: 6, fontSize: 11.5, color: "var(--c-faint)", fontStyle: "italic" }}>
          Paid report, no free searchVisibility → the two driver bars are replaced by 3 on-page pillar bars; an unmeasured pillar renders &quot;unlock to measure&quot; / &quot;<strong>Not yet</strong>&quot;, never a false 0/100 it never earned.
        </div>
        <div style={{ marginTop: -6, marginBottom: 14, fontSize: 11.5, color: "var(--c-faint)", fontStyle: "italic" }}>
          keywordsRanked 0 → &quot;<strong>Google ranks you for 0 searches.</strong>&quot; replaces the category-demand zero-state above the card grid — invisible in organic search IS the insight, never hidden.
        </div>

        {/* Your category, and how much of it you own */}
        <h2 style={H2}>Your category, and how much of it you own</h2>
        {/* P3 (2026-07-20, data board §2-3): ONE reusable MarketCard, used
            TWICE — Category (broad) and Niche (specific) — in the
            intrinsic-collapse grid idiom (dashboard-hero.tsx's
            `repeat(auto-fit, minmax(min(100%, 240px), 1fr))`, no media query
            needed — mobile-safe by construction). Replaces the old BROAD |
            CATEGORY | NICHE three-tier ladder (E1, 2026-07-19) — that design
            is retired going forward; a payload whose categoryCard isn't yet
            grounded (pre-P2/legacy) falls back to it instead of this board
            (invariant #11: don't crash, don't blank; see the live component's
            `marketCardReady` gate). CATEGORY demos the zero-state ("None
            yet." — a real hook, not a blank); NICHE demos a real top-3 win —
            so both card states are visible in one demo. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 14, marginBottom: 14 }}>
          <div style={CARD}>
            <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", padding: "3px 9px", borderRadius: 999, background: "var(--c-tint-violet)", color: "var(--c-action)" }}>YOUR CATEGORY</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 2px" }}>
              <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 26 }}>{CATEGORY_CARD.demand.toLocaleString()}</span>
              <span style={{ fontSize: 12, color: "var(--c-muted)" }}>searches / mo</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 12 }}>{CATEGORY_CARD.label}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "12px 0 7px" }}>You rank top 3 for</div>
            {/* "None yet." — the single most useful thing the card can say
                (savvycal.com ranks for ZERO scheduling terms, live): an
                honest hook, never a blank. P4 (2026-07-20, terseness): the
                old trailing sentence ("You don't rank for a single term in
                your own category.") is gone — the bare label is the whole
                point, data not description. */}
            <div style={{ fontSize: 12.5, color: "var(--c-muted)", background: "var(--c-tint-red)", borderLeft: "3px solid var(--c-band-invisible)", borderRadius: "0 8px 8px 0", padding: "8px 11px" }}>
              <strong style={{ color: "var(--c-band-invisible)" }}>None yet.</strong>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "12px 0 7px" }}>You don&apos;t rank for</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CATEGORY_CARD.gaps.map((g) => (
                <span key={g.keyword} style={{ fontFamily: JM, fontSize: 11.5, padding: "4px 9px", borderRadius: 7, background: "var(--c-fill)", color: "var(--c-muted)" }}>{g.keyword} <strong style={{ color: "var(--c-ink)" }}>{g.volume.toLocaleString()}</strong></span>
              ))}
            </div>
          </div>
          <div style={CARD}>
            <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", padding: "3px 9px", borderRadius: 999, background: "var(--c-tint-amber)", color: "var(--c-band-fair)" }}>YOUR NICHE</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 2px" }}>
              <span style={{ fontFamily: JM, fontWeight: 700, fontSize: 26 }}>{NICHE_CARD.demand.toLocaleString()}</span>
              <span style={{ fontSize: 12, color: "var(--c-muted)" }}>searches / mo</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 12 }}>{NICHE_CARD.label}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "12px 0 7px" }}>You rank top 3 for</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {NICHE_CARD.rankedTop3.map((r) => (
                <span key={r.keyword} style={{ fontFamily: JM, fontSize: 11.5, padding: "4px 9px", borderRadius: 7, background: "var(--c-tint-green)", color: "var(--c-band-high)", display: "inline-flex", gap: 6, alignItems: "baseline" }}>
                  <strong style={{ color: "var(--c-band-high)" }}>#{r.yourPosition}</strong> {r.keyword} <strong>{r.volume.toLocaleString()}</strong>
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "12px 0 7px" }}>You don&apos;t rank for</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {NICHE_CARD.gaps.map((g) => (
                <span key={g.keyword} style={{ fontFamily: JM, fontSize: 11.5, padding: "4px 9px", borderRadius: 7, background: "var(--c-fill)", color: "var(--c-muted)" }}>{g.keyword} <strong style={{ color: "var(--c-ink)" }}>{g.volume.toLocaleString()}</strong></span>
              ))}
            </div>
          </div>
        </div>
        {/* P3fix (2026-07-20): a niche with genuinely 0 priced phrases
            (e.g. trustmrr.com — a real directory whose niche terms don't
            clear pricing) used to be OMITTED entirely, silently collapsing
            the two-card grid to one column. It now ALWAYS renders when the
            niche label exists — either the real MarketCard above, or this
            honest empty state in its place (same pill + label, "You rank
            top 3 for"/"You don't rank for" sections replaced by one line).
            Demo shows the populated case above; this note is the exact
            copy shown live for the empty case. */}
        <div style={{ marginTop: -6, marginBottom: 14, fontSize: 11.5, color: "var(--c-faint)", fontStyle: "italic" }}>
          Niche demand genuinely 0 (0 priced phrases) → the niche card still renders its real label, replacing the rank/gap sections with: "No measurable niche demand yet — your niche is still small or emerging."
        </div>
        {/* WS-E (2026-07-19) / P4 (2026-07-20, terseness): both rivalry
            states render live now — a scan with zero discovered rivals used
            to drop the "someone is winning" insight entirely instead of
            degrading. The old prose ("…and rivals are taking the searches
            above. Unlock to see how each one ranks, why they win…") is gone
            — a bare keyword tease: real competitor NAMES (the one deliberate
            deviation from the wireframe's 6 sections — kept as a strong,
            honest paid hook) + a bare unlock link. Demo shows the common
            "found" case; the note below is the exact copy shown live when no
            rivals are discovered. Sits BELOW the card grid — it's not tied to
            either card, it's about the category as a whole. */}
        <div style={{ ...CARD, marginBottom: 14, fontSize: 13, color: "var(--c-muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: JM, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-faint)" }}>Compared to</span>
          <strong style={{ color: "var(--c-ink)" }}>Streaks, Habitica, Way of Life</strong>
          <span style={UNLOCK}>🔒 unlock →</span>
        </div>
        <div style={{ marginTop: -6, marginBottom: 14, fontSize: 11.5, color: "var(--c-faint)", fontStyle: "italic" }}>
          No rivals discovered → degrades to: &quot;<span style={UNLOCK}>🔒 See who&apos;s winning these searches →</span>&quot;
        </div>
        {/* P3 (data board §4): Opportunity — the NICHE's own gap keywords,
            100% real positions + DataForSEO volumes, zero LLM, by volume.
            Replaces the old "biggest untapped opportunity" promoted-row card
            (the wireframe has exactly ONE opportunity section, never two
            competing framings back to back) — omitted entirely when there's
            nothing to show (invariant #11), same discipline as every other
            section here. */}
        <div style={{ ...CARD, padding: "18px 20px", marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--c-band-fair)", marginBottom: 4 }}>Opportunity · your niche</div>
          <div style={{ fontSize: 12.5, color: "var(--c-faint)", marginBottom: 10 }}>Where the searches are — and you&apos;re not there.</div>
          {NICHE_OPPORTUNITY_ROWS.map((row) => (
            <div key={row.keyword} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--c-line2)", fontSize: 13 }}>
              <span style={{ fontWeight: 600, minWidth: 0 }} className="rk-wrap-any">{row.keyword}</span>
              <span style={{ fontFamily: JM, color: "var(--c-muted)", fontSize: 12.5, whiteSpace: "nowrap" }}>{row.volume.toLocaleString()} / mo</span>
              <span style={{ fontFamily: JM, fontWeight: 700, color: "var(--c-band-invisible)", fontSize: 12, whiteSpace: "nowrap" }}>not ranking</span>
            </div>
          ))}
        </div>
        {/* D3/P3: the aggregation strip — reframes a directory/aggregator's
            footprint as its OWN engine, not leaked/scolded traffic. Fires
            whenever aggregatedPct ≥ 40 (unconditional on categoryCard — a P1
            field). This demo's site isn't a directory, so the strip doesn't
            render live here; the note documents the exact copy + trigger. */}
        <div style={{ marginBottom: 14, fontSize: 11.5, color: "var(--c-faint)", fontStyle: "italic" }}>
          aggregatedPct ≥ 40 (directory/aggregator pattern, e.g. trustmrr.com 78%) → renders a "DIRECTORY PATTERN DETECTED" card: "<strong>78%</strong> of your traffic is the names of companies you list (cometly, trimrx…) — your directory engine, not lost buyers."
        </div>
        {/* Legacy note — a payload captured before P2 (categoryCard never
            grounded) falls back to the OLD BROAD | CATEGORY | NICHE ladder +
            the brand/category/other-companies footprint-split bar + the
            "biggest untapped opportunity" promoted card. Documented (with the
            exact live copy, so the label-drift gate stays green), not
            duplicated as a second demo.
            Review fix (2026-07-20): this fallback branch was found still
            rendering full LLM-ish prose sentences after P4 stripped the NEW
            board — closed by tersing it to match: the YOUR CATEGORY card's
            "You rank in the top 3 for N…" sentence is now a bare "top 3 × N"
            / "not ranking" chip beside the pill (same idiom as the sibling
            broad/niche cards' `standing()`), and the "biggest untapped
            opportunity" callout's explainer paragraph ("Winning this lifts
            Search presence — your weaker half. There are N more like it in
            your category.") is gone outright — the query/volume/rank chips
            above it already carry that meaning; a bare "🔒 +N more" chip is
            all that survives of the "N more" count. */}
        <div style={{ marginBottom: 14, fontSize: 11.5, color: "var(--c-faint)", fontStyle: "italic" }}>
          Legacy payload (no categoryCard) → falls back to the pre-P2 three-tier ladder (YOUR CATEGORY card shows a terse "top 3 × N" / "not ranking" chip beside the pill, no sentence) + the footprint-split bar ("Traffic split across your top-ranked terms.") + the promoted "Your biggest untapped opportunity" card (query + volume + rank chips, a bare "🔒 +N more" chip, no explainer sentence; degrading to "Unlock to see who wins them and how →" when nothing parses) instead of the board above (don&apos;t crash, don&apos;t blank).
        </div>

        {/* Ranked fixes — P4 (2026-07-20, terseness): no subtitle sentence
            ("Ordered by expected score impact. Free scans show N of M." is
            gone — the cards + the "N more" band already say it). */}
        <h2 style={H2}>Your top {FIXES.length} ranked fixes</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FIXES.map((f) => (
            <div key={f.rank} style={{ ...CARD, borderRadius: 14, padding: "18px 20px", display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: f.ec.bg, color: f.ec.fg, fontFamily: JM, fontWeight: 700 }}>{f.rank}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15.5 }}>{f.title}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 6, padding: "3px 8px", color: f.ec.fg, background: f.ec.bg }}>{f.effort}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 6, padding: "3px 8px", color: "var(--c-muted)", background: "var(--c-fill)" }}>{f.pillar}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 18, color: "var(--c-band-findable)" }}>+{f.pred}</div>
              </div>
            </div>
          ))}
          {/* P4 "2+2" deliverable: up to 2 blurred locked-preview rows —
              real rank-3/4 title + delta when the plan carries them, a
              content-free skeleton bar otherwise (never a fabricated title). */}
          {LOCKED_PREVIEW.map((f) => (
            <div key={f.rank} aria-hidden="true" style={{ ...CARD, borderRadius: 14, padding: "18px 20px", display: "flex", gap: 16, alignItems: "center", filter: "blur(3px)", opacity: 0.55, userSelect: "none" }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--c-fill)", color: "var(--c-faint)", fontFamily: JM, fontWeight: 700 }}>{f.rank}</span>
              <div style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 15.5 }}>{f.title}</div>
              <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 18, color: "var(--c-band-findable)", flexShrink: 0 }}>+{f.pred}</div>
            </div>
          ))}
          {/* Live renders the "worth an estimated +N" clause only when
              lockedWorth > 0 (never "+0" — housekeeping 2026-07-16); this
              demo's worth is 21, so the clause renders here. */}
          <div style={{ border: "1px dashed var(--c-line2)", borderRadius: 14, padding: "16px 20px", fontSize: 14, fontWeight: 600, color: "var(--c-faint)" }}>🔒 5 more ranked fixes — worth an estimated +21 — <span style={UNLOCK}>unlock the full plan →</span></div>
        </div>

        {/* P4 (2026-07-20, terseness): Positioning Mirror REMOVED from the
            free board — a full LLM prose paragraph, the single worst prose
            violation, and it isn't in the approved wireframe. Render removal
            only — the underlying data (intendedTags/actualTags/mirrorGap)
            still flows through to-results-props.ts unchanged. */}

        {/* Evidence footnote */}
        <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--c-faint)", fontFamily: JM }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--c-band-findable)" }} />
          Scanned {SITE} just now · every claim links to extracted evidence
        </div>

        {/* P4 (2026-07-20, terseness): ONE upgrade component, matching the
            approved wireframe exactly — title + 3 keyword features (mono,
            stacked) + button + price. Replaces the old two-paragraph
            title/subtitle marketing sentences AND the second, separate
            "Close the gap before your rivals widen it" CTA card that
            public-report.tsx used to stack below this — the two CTAs the
            brief calls out to collapse into one. */}
        <div style={{ marginTop: 18, background: "linear-gradient(135deg, var(--c-dark), var(--c-dark2))", borderRadius: 18, padding: "30px 32px", textAlign: "center" }}>
          <h3 style={{ color: "var(--c-on-dark)", fontFamily: SG, fontWeight: 700, fontSize: 22, margin: "0 0 16px" }}>Unlock the full plan</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: JM, fontSize: 13, color: "var(--c-on-dark-muted)", marginBottom: 20 }}>
            <span>Daily fix calendar</span>
            <span>Weekly rank tracking</span>
            <span>Distribution &amp; outreach</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <button style={{ background: "var(--c-surface)", color: "var(--c-ink)", borderRadius: 10, padding: "13px 24px", border: "none", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, cursor: "pointer", whiteSpace: "nowrap" }}>Unlock →</button>
            {/* Price stated up front on the unlock CTA (from lib/billing/pricing.ts's
                tierByPlan/fmtPrice on the live report — never learned only inside
                Stripe Checkout). */}
            <span style={{ fontFamily: JM, fontSize: 12.5, color: "#B7B4C4" }}>€59/mo · cancel anytime</span>
          </div>
        </div>
      </div>
    </main>
  );
}
